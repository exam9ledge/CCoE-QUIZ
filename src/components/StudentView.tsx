import React, { useState, useEffect, useRef } from 'react';
import { api, storage, getErrorMessage, triggerConfetti } from '../lib/api';
import { sound } from '../lib/audio';
import { SanitizedQuestion, Player } from '../types/quiz';
import { Sparkles, Trophy, Flame, Clock, CheckCircle2, XCircle, ArrowRight, RotateCcw, AlertTriangle, HelpCircle } from 'lucide-react';

const LETTERS = ["A", "B", "C", "D", "E"];
const OPTION_COLORS = [
  "from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600",
  "from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600",
  "from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600",
  "from-rose-600 to-pink-700 hover:from-rose-500 hover:to-pink-600",
  "from-purple-600 to-violet-700 hover:from-purple-500 hover:to-violet-600"
];

interface StudentViewProps {
  initialCode?: string;
}

export const StudentView: React.FC<StudentViewProps> = ({ initialCode }) => {
  // Navigation & Session states
  const [step, setStep] = useState<'code' | 'name' | 'waiting' | 'quiz' | 'finish'>('code');
  const [code, setCode] = useState<string>(initialCode || storage.get('coe_last_code', '726849'));
  const [name, setName] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Quiz state
  const [quizState, setQuizState] = useState<any>(null);
  const [questions, setQuestions] = useState<SanitizedQuestion[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<Record<number, { c: number; a: number; ok: boolean; e?: string | null }>>({});

  // Question answering state
  const [currQIndex, setCurrQIndex] = useState<number>(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [timerMax, setTimerMax] = useState<number>(30);
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [myRank, setMyRank] = useState<{ rank: number; total: number } | null>(null);

  // Timing refs
  const questionStartTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<any>(null);
  const pollIntervalRef = useRef<any>(null);

  // Check saved session on load
  useEffect(() => {
    const lastCode = storage.get('coe_last_code', '');
    if (lastCode) {
      const saved = storage.get<{ name?: string; pin?: string; id?: string } | null>(`coe_player_${lastCode}`, null);
      if (saved && saved.name && saved.pin) {
        setName(saved.name);
        setPin(saved.pin);
      }
    }
  }, []);

  // Polling for teacher-paced or state changes
  useEffect(() => {
    if (step === 'waiting' || (step === 'quiz' && quizState?.settings?.mode === 'teacher')) {
      const interval = setInterval(async () => {
        try {
          if (!code) return;
          const q = await api('quiz_state', { p_code: code });
          setQuizState(q);

          if (q.status === 'ended') {
            setStep('finish');
            return;
          }

          if (q.settings?.mode === 'teacher') {
            handleTeacherPacedSync(q);
          } else if (step === 'waiting' && q.status === 'live') {
            setStep('quiz');
          }
        } catch {}
      }, 1500);

      pollIntervalRef.current = interval;
      return () => clearInterval(interval);
    }
    return () => clearInterval(pollIntervalRef.current);
  }, [step, code, quizState?.settings?.mode, currQIndex, doneSet]);

  const handleTeacherPacedSync = async (q: any) => {
    const live = q.live || {};
    const ph = live.phase;

    if (ph === 'lobby' || q.status === 'lobby' || q.status === 'paused') {
      setStep('waiting');
      return;
    }

    if (ph === 'question') {
      const targetQ = live.q ?? 0;
      if (currQIndex !== targetQ || step !== 'quiz') {
        setCurrQIndex(targetQ);
        setSelectedChoice(null);
        setSubmissionResult(null);
        setHiddenOptions([]);
        setStep('quiz');
        setupQuestionTimer(targetQ, live);
      }
    } else if (ph === 'reveal') {
      const targetQ = live.q ?? 0;
      if (!submissionResult && player) {
        try {
          const rev = await api('reveal', { p_player: player.id, p_pin: pin, p_idx: targetQ });
          setSubmissionResult({
            correct: rev.mine?.ok,
            points: rev.mine?.points || 0,
            answer: rev.answer,
            explanation: rev.explanation
          });
          setPlayer(prev => prev ? {
            ...prev,
            score: rev.score,
            correct: rev.correct,
            wrong: rev.wrong,
            answered: rev.answered,
            streak: rev.streak
          } : null);
          setMyRank({ rank: rev.rank, total: rev.total });
        } catch {}
      }
    }
  };

  const setupQuestionTimer = (qIdx: number, liveState?: any) => {
    clearInterval(timerIntervalRef.current);
    const q = questions[qIdx];
    const durationSec = quizState?.settings?.timerAll || q?.s || 30;
    setTimerMax(durationSec);

    if (liveState?.ends_at) {
      const ends = new Date(liveState.ends_at).getTime();
      const remaining = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
      setTimeLeft(remaining);
    } else {
      setTimeLeft(durationSec);
    }

    questionStartTimeRef.current = performance.now();

    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          if (selectedChoice === null && quizState?.settings?.mode === 'student') {
            handleAnswerSubmit(-1); // Timeout
          }
          return 0;
        }
        if (prev <= 5) sound.playTick();
        return prev - 1;
      });
    }, 1000);
  };

  // Step 1: Join with 6-digit Code
  const handleCheckCode = async () => {
    if (!code || code.trim().length !== 6) {
      setError("Please enter a valid 6-digit quiz code.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const state = await api('quiz_state', { p_code: code.trim() });
      setQuizState(state);
      storage.set('coe_last_code', code.trim());
      setStep('name');
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Register Name & 4-Digit PIN (for rejoining)
  const handleJoinQuiz = async () => {
    if (!name.trim() || name.trim().length < 2) {
      setError("Please enter your name (minimum 2 characters).");
      return;
    }
    if (!/^\d{4}$/.test(pin.trim())) {
      setError("PIN must be exactly 4 numeric digits.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const order = quizState?.settings?.shuffle
        ? Array.from({ length: quizState.q_count }, (_, i) => i).sort(() => Math.random() - 0.5)
        : [];

      const resp = await api('join', {
        p_code: code.trim(),
        p_name: name.trim(),
        p_pin: pin.trim(),
        p_order: order
      });

      const joinedPlayer: Player = resp.player;
      setPlayer(joinedPlayer);
      storage.set(`coe_player_${code.trim()}`, { name: joinedPlayer.name, pin: pin.trim(), id: joinedPlayer.id });

      // Fetch sanitized questions
      const qs = await api<SanitizedQuestion[]>('get_questions', { p_code: code.trim() });
      setQuestions(qs);

      // Hydrate previous answers if rejoining
      const done = new Set<number>();
      const res: Record<number, any> = {};
      joinedPlayer.done.forEach(d => {
        done.add(d.i);
        res[d.i] = { c: d.c, ok: d.ok };
      });
      setDoneSet(done);
      setResults(res);

      if (quizState.status === 'ended' || joinedPlayer.finished) {
        setStep('finish');
      } else if (quizState.settings?.mode === 'teacher') {
        if (quizState.live?.phase === 'question') {
          setCurrQIndex(quizState.live.q || 0);
          setStep('quiz');
          setupQuestionTimer(quizState.live.q || 0, quizState.live);
        } else {
          setStep('waiting');
        }
      } else {
        // Student-paced mode: find first unanswered
        const firstUnanswered = (joinedPlayer.q_order || []).find(idx => !done.has(idx)) ?? 0;
        setCurrQIndex(firstUnanswered);
        setStep(quizState.status === 'live' ? 'quiz' : 'waiting');
        if (quizState.status === 'live') {
          setupQuestionTimer(firstUnanswered);
        }
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Submit Answer
  const handleAnswerSubmit = async (choiceIndex: number) => {
    if (selectedChoice !== null || !player) return;
    setSelectedChoice(choiceIndex);
    clearInterval(timerIntervalRef.current);

    const responseMs = Math.round(performance.now() - questionStartTimeRef.current);

    try {
      const resp = await api('submit', {
        p_player: player.id,
        p_pin: pin.trim(),
        p_idx: currQIndex,
        p_choice: choiceIndex,
        p_ms: responseMs
      });

      if (resp.correct) {
        sound.playCorrect();
      } else {
        sound.playWrong();
      }

      setSubmissionResult(resp);
      setPlayer(resp.player);
      setDoneSet(prev => new Set(prev).add(currQIndex));
      setResults(prev => ({
        ...prev,
        [currQIndex]: {
          c: choiceIndex,
          a: resp.answer,
          ok: resp.correct,
          e: resp.explanation
        }
      }));
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  // 50:50 Lifeline
  const handleUseFifty = async () => {
    if (!player) return;
    try {
      const resp = await api('fifty', {
        p_player: player.id,
        p_pin: pin.trim(),
        p_idx: currQIndex
      });
      setHiddenOptions(resp.hidden || []);
      setPlayer(prev => prev ? { ...prev, fifty_used: resp.used } : null);
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  // Advance to next question in student-paced mode
  const handleNextQuestion = () => {
    setSelectedChoice(null);
    setSubmissionResult(null);
    setHiddenOptions([]);

    const order = player?.q_order || questions.map((_, i) => i);
    const nextUnanswered = order.find(i => !doneSet.has(i));

    if (nextUnanswered === undefined || doneSet.size >= questions.length) {
      setStep('finish');
      triggerConfetti(4000);
    } else {
      setCurrQIndex(nextUnanswered);
      setupQuestionTimer(nextUnanswered);
    }
  };

  // Restart quiz in student-paced mode
  const handleRestart = async () => {
    if (!player) return;
    if (!confirm("Are you sure you want to restart? Your score will be reset to 0.")) return;
    try {
      const resp = await api('restart', {
        p_player: player.id,
        p_pin: pin.trim()
      });
      setPlayer(resp.player);
      setDoneSet(new Set());
      setResults({});
      setSubmissionResult(null);
      setSelectedChoice(null);
      setCurrQIndex(0);
      setupQuestionTimer(0);
      setStep('quiz');
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  const currQ = questions[currQIndex];
  const maxLifelines = quizState?.settings?.lifelines || 0;
  const lifelinesLeft = Math.max(0, maxLifelines - (player?.fifty_used || 0));

  return (
    <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
      {/* Step 1: Join with 6-digit Code */}
      {step === 'code' && (
        <div className="bg-slate-900/90 border border-indigo-900/70 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 font-heading font-black text-2xl shadow-lg shadow-amber-400/20 mb-3">
              ⚡
            </div>
            <h2 className="text-2xl sm:text-3xl font-heading font-black text-white">
              Join Banking Challenge
            </h2>
            <p className="text-sm text-indigo-200 mt-1">
              Enter the 6-digit code shown on the classroom screen
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                6-Digit Quiz Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="726849"
                className="w-full text-center text-3xl sm:text-4xl font-mono font-black tracking-[0.4em] py-3.5 px-4 bg-slate-950/80 border-2 border-indigo-700/60 rounded-xl text-amber-400 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/40 rounded-xl text-rose-300 text-xs sm:text-sm font-semibold animate-shake">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleCheckCode}
              disabled={loading}
              className="w-full py-4 rounded-xl font-heading font-black text-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 transition-transform active:scale-95 disabled:opacity-50"
            >
              {loading ? "Checking Code..." : "Enter Quiz ➜"}
            </button>

            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-indigo-900/40 text-xs text-indigo-300 leading-relaxed text-center">
              💡 <b>Tip for Trainees:</b> Active session in progress: <span className="font-mono text-amber-300 font-bold">726849</span> (Digital Banking) or <span className="font-mono text-amber-300 font-bold">839104</span> (Retail Credit).
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Name & 4-Digit Rejoin PIN */}
      {step === 'name' && (
        <div className="bg-slate-900/90 border border-indigo-900/70 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur">
          <div className="mb-6">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-400/10 text-amber-300 border border-amber-400/30">
              Code: {code} · {quizState?.q_count || 0} Questions
            </span>
            <h2 className="text-xl sm:text-2xl font-heading font-black text-white mt-2">
              {quizState?.title || "Banking Training Challenge"}
            </h2>
            <p className="text-xs text-indigo-200 mt-0.5">
              Trainer: Punit Dhull | Canara Centre of Excellence
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Your Full Name & Branch / Circle
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar (COE Bangalore)"
                className="w-full py-3 px-4 bg-slate-950/80 border border-indigo-700/60 rounded-xl text-white font-semibold focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  4-Digit Security PIN
                </label>
                <span className="text-[11px] text-amber-300 font-semibold">
                  Required to resume if disconnected
                </span>
              </div>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full text-center text-2xl font-mono font-black py-3 px-4 bg-slate-950/80 border border-indigo-700/60 rounded-xl text-amber-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/40 rounded-xl text-rose-300 text-xs sm:text-sm font-semibold animate-shake">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleJoinQuiz}
              disabled={loading}
              className="w-full py-4 rounded-xl font-heading font-black text-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/30 transition-transform active:scale-95 disabled:opacity-50"
            >
              {loading ? "Joining..." : "Ready to Start 🚀"}
            </button>

            <button
              onClick={() => setStep('code')}
              className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              ← Change Quiz Code
            </button>
          </div>
        </div>
      )}

      {/* Waiting Lobby Screen */}
      {step === 'waiting' && (
        <div className="bg-slate-900/90 border border-indigo-900/70 rounded-2xl p-8 shadow-2xl text-center backdrop-blur">
          <div className="w-16 h-16 rounded-full bg-indigo-600/30 text-amber-400 mx-auto flex items-center justify-center text-3xl animate-bounce mb-4">
            ⏳
          </div>
          <h2 className="text-2xl font-heading font-black text-white">
            You're In, {player?.name}!
          </h2>
          <p className="text-sm text-indigo-200 mt-2">
            {quizState?.status === 'paused'
              ? "The trainer has paused the session. Please hold on."
              : "Waiting for Trainer Punit Dhull to start the live quiz..."}
          </p>

          <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-indigo-900/60 inline-flex items-center gap-4 text-left">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase">Quiz Code</div>
              <div className="text-lg font-mono font-black text-amber-400">{code}</div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase">Mode</div>
              <div className="text-sm font-bold text-slate-200">
                {quizState?.settings?.mode === 'teacher' ? 'Teacher-Paced' : 'Self-Paced'}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase">Score</div>
              <div className="text-lg font-black text-emerald-400">{player?.score || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Live Question Answering Screen */}
      {step === 'quiz' && currQ && (
        <div className="space-y-4">
          {/* Top Bar: Progress, Timer, Score, Streak */}
          <div className="bg-slate-900/80 border border-indigo-900/60 rounded-xl p-3 flex items-center justify-between text-xs sm:text-sm font-bold shadow-lg">
            <span className="px-2.5 py-1 rounded-md bg-indigo-950 text-indigo-200 border border-indigo-800">
              Q {doneSet.size + 1} / {questions.length}
            </span>

            <div className="flex items-center gap-1.5 text-amber-400 font-mono text-base">
              <Clock className="w-4 h-4" />
              <span>{timeLeft}s</span>
            </div>

            <div className="flex items-center gap-1 text-orange-400 font-black">
              <Flame className="w-4 h-4" />
              <span>{player?.streak || 0}</span>
            </div>

            <div className="px-3 py-1 rounded-md bg-amber-400 text-slate-950 font-black">
              ⭐ {player?.score.toLocaleString('en-IN') || 0}
            </div>
          </div>

          {/* Animated Timer Bar */}
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                timeLeft < 6 ? 'bg-rose-500' : timeLeft < 12 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.max(0, (timeLeft / (timerMax || 30)) * 100)}%` }}
            />
          </div>

          {/* Question Card */}
          <div className="bg-slate-900/95 border border-indigo-900/80 rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur">
            {currQ.t && (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-3">
                {currQ.t}
              </span>
            )}
            <h3 className="text-lg sm:text-xl font-heading font-bold text-white leading-relaxed">
              {currQ.q}
            </h3>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 gap-3">
            {currQ.o.map((opt, idx) => {
              const isHidden = hiddenOptions.includes(idx);
              const isSelected = selectedChoice === idx;
              const hasAnswered = selectedChoice !== null;
              const isCorrect = submissionResult && submissionResult.answer === idx;
              const isWrong = submissionResult && isSelected && !submissionResult.correct;

              let buttonStyle = `bg-gradient-to-r ${OPTION_COLORS[idx % 5]} text-white`;
              if (hasAnswered) {
                if (isCorrect) {
                  buttonStyle = "bg-emerald-600 text-white ring-4 ring-emerald-400 scale-[1.01]";
                } else if (isWrong) {
                  buttonStyle = "bg-rose-600 text-white opacity-90 ring-4 ring-rose-400";
                } else {
                  buttonStyle = "bg-slate-800/60 text-slate-400 opacity-30 grayscale";
                }
              }

              return (
                <button
                  key={idx}
                  disabled={hasAnswered || isHidden}
                  onClick={() => handleAnswerSubmit(idx)}
                  className={`w-full p-4 rounded-xl flex items-center gap-3.5 text-left font-bold text-sm sm:text-base transition-all shadow-md ${buttonStyle} ${
                    isHidden ? 'opacity-15 cursor-not-allowed line-through' : ''
                  }`}
                >
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-black/25 flex items-center justify-center font-black text-sm">
                    {LETTERS[idx]}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {hasAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" />}
                  {hasAnswered && isWrong && <XCircle className="w-5 h-5 text-white flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* 50:50 Lifeline Button */}
          {selectedChoice === null && maxLifelines > 0 && currQ.o.length >= 3 && (
            <button
              onClick={handleUseFifty}
              disabled={lifelinesLeft <= 0 || hiddenOptions.length > 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-heading font-bold text-sm shadow-md hover:from-amber-500 hover:to-orange-500 transition-all disabled:opacity-40"
            >
              🎯 Use 50:50 Lifeline ({lifelinesLeft} remaining)
            </button>
          )}

          {/* Answer Feedback Panel */}
          {submissionResult && (
            <div className={`p-5 rounded-2xl border shadow-2xl animate-rise ${
              submissionResult.correct
                ? 'bg-emerald-950/80 border-emerald-600/70 text-emerald-100'
                : 'bg-rose-950/80 border-rose-600/70 text-rose-100'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-heading font-black text-lg">
                  {submissionResult.correct ? (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      <span>Correct Answer!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-6 h-6 text-rose-400" />
                      <span>{selectedChoice === -1 ? "Time is Up!" : "Incorrect Answer"}</span>
                    </>
                  )}
                </div>
                {submissionResult.correct && (
                  <span className="text-amber-400 font-heading font-black text-lg">
                    +{submissionResult.points.toLocaleString('en-IN')} pts
                  </span>
                )}
              </div>

              {!submissionResult.correct && (
                <div className="mt-3 p-3 bg-black/40 rounded-xl text-xs sm:text-sm font-semibold">
                  Correct Option: <b className="text-emerald-400">({LETTERS[submissionResult.answer]}) {currQ.o[submissionResult.answer]}</b>
                </div>
              )}

              {submissionResult.explanation && (
                <div className="mt-3 text-xs sm:text-sm text-slate-300 bg-black/30 p-3 rounded-xl leading-relaxed">
                  💡 <b>Banking Rule:</b> {submissionResult.explanation}
                </div>
              )}

              {quizState?.settings?.mode === 'student' && (
                <button
                  onClick={handleNextQuestion}
                  className="mt-4 w-full py-3.5 rounded-xl font-heading font-black text-base bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2"
                >
                  <span>{doneSet.size >= questions.length ? "View My Final Score" : "Next Question"}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}

              {quizState?.settings?.mode === 'teacher' && (
                <div className="mt-3 text-xs text-center text-amber-200/80 font-bold">
                  Hold on! The trainer will advance to the next question on the projector.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 5: Finish & Score Summary Screen */}
      {step === 'finish' && player && (
        <div className="bg-slate-900/90 border border-indigo-900/70 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-amber-400/20 text-amber-400 mx-auto flex items-center justify-center text-3xl mb-3">
              🏆
            </div>
            <h2 className="text-2xl sm:text-3xl font-heading font-black text-white">
              Quiz Completed, {player.name}!
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1">
              Canara Centre of Excellence – Knowledge Performance Card
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 bg-slate-950/80 border border-indigo-900/40 rounded-xl">
              <div className="text-lg sm:text-2xl font-heading font-black text-amber-400">
                {player.score.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">Total Score</div>
            </div>

            <div className="p-3 bg-slate-950/80 border border-indigo-900/40 rounded-xl">
              <div className="text-lg sm:text-2xl font-heading font-black text-emerald-400">
                {player.correct}
              </div>
              <div className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">Correct</div>
            </div>

            <div className="p-3 bg-slate-950/80 border border-indigo-900/40 rounded-xl">
              <div className="text-lg sm:text-2xl font-heading font-black text-rose-400">
                {player.wrong}
              </div>
              <div className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">Mistakes</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-center">
            <div className="p-3 bg-slate-950/80 border border-indigo-900/40 rounded-xl">
              <div className="text-base sm:text-xl font-heading font-black text-indigo-300">
                {player.answered ? Math.round((player.correct / player.answered) * 100) : 0}%
              </div>
              <div className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">Accuracy</div>
            </div>

            <div className="p-3 bg-slate-950/80 border border-indigo-900/40 rounded-xl">
              <div className="text-base sm:text-xl font-heading font-black text-orange-400">
                🔥 {player.best_streak || player.streak || 0}
              </div>
              <div className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">Best Streak</div>
            </div>
          </div>

          {/* Mistakes Review */}
          {Object.entries(results).some(([, v]) => !v.ok) && questions.length > 0 && (
            <div className="border-t border-slate-800 pt-4">
              <h4 className="font-heading font-bold text-sm text-slate-200 mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Review of Mistakes ({Object.values(results).filter(v => !v.ok).length})</span>
              </h4>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {Object.entries(results)
                  .filter(([, v]) => !v.ok)
                  .map(([qIdxStr, v]) => {
                    const qIdx = parseInt(qIdxStr, 10);
                    const q = questions[qIdx];
                    if (!q) return null;
                    return (
                      <div key={qIdx} className="p-3 rounded-xl bg-slate-950/90 border border-rose-900/50 text-xs space-y-1.5">
                        <div className="font-semibold text-slate-200">
                          {qIdx + 1}. {q.q}
                        </div>
                        <div className="text-rose-400 font-medium">
                          Your Answer: {v.c >= 0 ? `(${LETTERS[v.c]}) ${q.o[v.c]}` : 'Time Up (No Answer)'}
                        </div>
                        {v.a !== undefined && (
                          <div className="text-emerald-400 font-bold">
                            Correct Answer: ({LETTERS[v.a]}) {q.o[v.a]}
                          </div>
                        )}
                        {v.e && (
                          <div className="text-slate-400 text-[11px] bg-slate-900 p-2 rounded">
                            💡 {v.e}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            {quizState?.settings?.allowRestart !== false && quizState?.status !== 'ended' && (
              <button
                onClick={handleRestart}
                className="w-full py-3 rounded-xl font-heading font-bold text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart Quiz Fresh</span>
              </button>
            )}

            <button
              onClick={() => setStep('code')}
              className="w-full py-3 rounded-xl font-heading font-bold text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md"
            >
              Join Another Quiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
