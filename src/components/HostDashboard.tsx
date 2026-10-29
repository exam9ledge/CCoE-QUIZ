import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api, getErrorMessage, triggerConfetti } from '../lib/api';
import { sound } from '../lib/audio';
import { Quiz, Question } from '../types/quiz';
import { ChampionsPodium } from './ChampionsPodium';
import {
  Play, Pause, Square, Plus, SkipForward, ArrowLeft, ArrowRight,
  Award, Users, Download, Sparkles, RefreshCw, Eye, Flame, CheckCircle, XCircle
} from 'lucide-react';

const LETTERS = ["A", "B", "C", "D", "E"];
const OPTION_BG_COLORS = [
  "from-blue-600 to-indigo-700",
  "from-emerald-600 to-teal-700",
  "from-amber-600 to-orange-700",
  "from-rose-600 to-pink-700",
  "from-purple-600 to-violet-700"
];

interface HostDashboardProps {
  code: string;
  token?: string;
  onOpenLibrary: () => void;
  onEditQuiz: (code: string) => void;
}

export const HostDashboard: React.FC<HostDashboardProps> = ({ code, token, onOpenLibrary, onEditQuiz }) => {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [liveData, setLiveData] = useState<any>({ players: 0, answered: 0, counts: {} });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [topN, setTopN] = useState<number>(10);
  const [autoReveal, setAutoReveal] = useState<boolean>(true);
  const [showPodium, setShowPodium] = useState<boolean>(false);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Timer refs
  const pollTimerRef = useRef<any>(null);
  const autoRevealedSeqRef = useRef<number | null>(null);

  // Fetch initial quiz data
  const loadQuiz = async () => {
    try {
      const q = await api('admin_get', { p_token: token, p_code: code });
      setQuiz(q);
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  useEffect(() => {
    loadQuiz();
  }, [code, token]);

  // Main polling loop for Host: live answers + leaderboard
  useEffect(() => {
    if (!token || !code) return;

    const poll = async () => {
      try {
        const [liveResp, boardResp] = await Promise.all([
          api('host_live', { p_token: token, p_code: code }),
          api('board', { p_code: code })
        ]);

        setLiveData(liveResp);
        if (quiz && liveResp.status !== quiz.status) {
          setQuiz(prev => prev ? { ...prev, status: liveResp.status, live: liveResp.live } : null);
        } else if (quiz && liveResp.live) {
          setQuiz(prev => prev ? { ...prev, live: liveResp.live } : null);
        }

        if (boardResp?.players) {
          setLeaderboard(boardResp.players.sort((a: any, b: any) => b.score - a.score || b.correct - a.correct));
        }

        // Auto-reveal when timer expires in question phase
        if (
          autoReveal &&
          liveResp?.live?.phase === 'question' &&
          liveResp?.live?.ends_at
        ) {
          const remainingMs = new Date(liveResp.live.ends_at).getTime() - Date.now();
          if (remainingMs <= 0 && autoRevealedSeqRef.current !== liveResp.live.seq) {
            autoRevealedSeqRef.current = liveResp.live.seq;
            handleLiveAction('reveal');
          }
        }
      } catch {}
    };

    poll();
    pollTimerRef.current = setInterval(poll, 1500);
    return () => clearInterval(pollTimerRef.current);
  }, [code, token, autoReveal, quiz?.status]);

  // Status controls
  const handleSetStatus = async (newStatus: 'lobby' | 'live' | 'paused' | 'ended') => {
    try {
      await api('host_set_status', { p_token: token, p_code: code, p_status: newStatus });
      setQuiz(prev => prev ? { ...prev, status: newStatus } : null);
      if (newStatus === 'ended') {
        setShowPodium(true);
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  // Live Teacher Action (open, reveal, add, skip, etc.)
  const handleLiveAction = async (action: string, extra: any = {}) => {
    try {
      const resp = await api('host_live_action', {
        p_token: token,
        p_code: code,
        p_action: action,
        ...extra
      });
      setQuiz(prev => prev ? { ...prev, live: resp.live } : null);
      if (action === 'reveal') {
        sound.playApplause(3);
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  // Simulator for Classroom testing
  const handleSimulateTrainees = async () => {
    setSimulating(true);
    try {
      await api('admin_simulate_trainees', { p_token: token, p_code: code, p_count: 5 });
      sound.playCorrect();
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setSimulating(false);
    }
  };

  // Export Results to Excel
  const handleExportExcel = async () => {
    try {
      const stats = await api('host_stats', { p_token: token, p_code: code }) || [];
      const statsMap = new Map(stats.map((s: any) => [s.i, s]));

      // Sheet 1: Leaderboard
      const wsLeaderboard = XLSX.utils.json_to_sheet(
        leaderboard.map((p, idx) => ({
          Rank: idx + 1,
          "Trainee Name": p.name,
          "Total Score": p.score,
          "Correct Answers": p.correct,
          "Mistakes": p.wrong,
          "Answered Questions": p.answered,
          "Accuracy %": p.answered ? Math.round((p.correct / p.answered) * 100) : 0
        }))
      );

      // Sheet 2: Question Stats
      const wsQuestions = XLSX.utils.json_to_sheet(
        (quiz?.questions || []).map((q, idx) => {
          const s: any = statsMap.get(q.i) || { n: 0, ok: 0 };
          return {
            "Q No": idx + 1,
            "Topic": q.t || "General",
            "Question": q.q,
            "Correct Answer": `(${LETTERS[q.a]}) ${q.o[q.a]}`,
            "Total Attempts": s.n,
            "Correct Count": s.ok,
            "Accuracy %": s.n ? Math.round((s.ok / s.n) * 100) : 0
          };
        })
      );

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsLeaderboard, "Trainee Leaderboard");
      XLSX.utils.book_append_sheet(wb, wsQuestions, "Question Analytics");

      XLSX.writeFile(wb, `Canara_COE_Challenge_${code}_Results.xlsx`);
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  if (!quiz) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-slate-400 font-heading">
        Loading Classroom Presentation Dashboard...
      </div>
    );
  }

  const live = quiz.live || { phase: 'lobby', q: 0, pos: 0 };
  const currentQ: Question | undefined = quiz.questions[live.q ?? 0];
  const isTeacherPaced = (quiz.settings?.mode || 'student') === 'teacher';
  const remainingSecs = live.ends_at
    ? Math.max(0, Math.ceil((new Date(live.ends_at).getTime() - Date.now()) / 1000))
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Projector Banner: Join Code & Live Status */}
      <div className="bg-slate-900/90 border border-indigo-900/70 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur flex flex-wrap items-center justify-between gap-4">
        {/* Big Code & URL */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="bg-slate-950 p-3 rounded-2xl border-2 border-indigo-700/60 shadow-inner">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Join Code</div>
            <div className="text-3xl sm:text-5xl font-mono font-black text-amber-400 tracking-wider">
              {code}
            </div>
          </div>

          <div>
            <span className="text-xs text-indigo-300 font-semibold block">
              Trainees enter code on phones at:
            </span>
            <div className="font-heading font-black text-base sm:text-xl text-white">
              {window.location.host}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                quiz.status === 'live' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                quiz.status === 'paused' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                quiz.status === 'ended' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
              }`}>
                ● {quiz.status.toUpperCase()}
              </span>
              <span className="text-xs text-slate-400 font-bold">
                {isTeacherPaced ? '👩‍🏫 Teacher-Paced' : '🧑‍🎓 Student-Paced'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center gap-3">
          <div className="text-center px-4 py-2 bg-slate-950/80 rounded-xl border border-indigo-900/50">
            <div className="text-xl sm:text-2xl font-heading font-black text-white">
              {liveData.players || 0}
            </div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Trainees Joined</div>
          </div>

          <div className="text-center px-4 py-2 bg-slate-950/80 rounded-xl border border-indigo-900/50">
            <div className="text-xl sm:text-2xl font-heading font-black text-amber-400">
              {liveData.answered || 0}
            </div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Answers In</div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {quiz.status === 'lobby' ? (
            <button
              onClick={() => {
                handleSetStatus('live');
                if (isTeacherPaced) handleLiveAction('open', { p_q: 0, p_pos: 0 });
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-heading font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/30"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Session</span>
            </button>
          ) : quiz.status === 'live' ? (
            <button
              onClick={() => handleSetStatus('paused')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-heading font-bold text-sm bg-amber-500 text-slate-950 hover:bg-amber-400"
            >
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </button>
          ) : quiz.status === 'paused' ? (
            <button
              onClick={() => handleSetStatus('live')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-heading font-bold text-sm bg-emerald-500 text-white hover:bg-emerald-400"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume</span>
            </button>
          ) : null}

          {quiz.status !== 'ended' && (
            <button
              onClick={() => {
                if (confirm("End the quiz and show the Champions Podium?")) {
                  handleSetStatus('ended');
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-heading font-bold text-sm bg-rose-600/80 hover:bg-rose-600 text-white"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>End Quiz</span>
            </button>
          )}

          {/* Quick simulator */}
          <button
            onClick={handleSimulateTrainees}
            disabled={simulating}
            title="Inject 5 simulated participants with randomized responses to test live multiplayer features"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-heading font-bold text-xs bg-indigo-900/80 hover:bg-indigo-800 text-amber-300 border border-indigo-700/60"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{simulating ? "Adding..." : "+5 Trainees"}</span>
          </button>

          <button
            onClick={handleExportExcel}
            title="Download Results as Excel"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Classroom Screen Layout */}
      {isTeacherPaced && quiz.status === 'live' && currentQ ? (
        <div className="space-y-6">
          {/* Question Stage on Big Screen */}
          <div className="bg-slate-900/95 border border-indigo-900/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur relative">
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-heading font-black text-xs sm:text-sm">
                Question {(live.pos ?? 0) + 1} of {quiz.questions.length}
              </span>
              {currentQ.t && (
                <span className="text-xs font-bold text-indigo-300 bg-indigo-950 px-3 py-1 rounded-full border border-indigo-800">
                  {currentQ.t}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-4xl font-heading font-black text-white leading-tight mb-8">
              {currentQ.q}
            </h2>

            {/* Options 2x2 Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentQ.o.map((opt, idx) => {
                const isRevealed = live.phase === 'reveal';
                const isCorrect = isRevealed && idx === currentQ.a;
                const count = liveData.counts?.[idx] || 0;

                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-2xl flex items-center justify-between font-heading font-bold text-lg sm:text-xl transition-all shadow-xl ${
                      isRevealed
                        ? isCorrect
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-300 scale-[1.02]'
                          : 'bg-slate-800/40 text-slate-400 opacity-40'
                        : `bg-gradient-to-r ${OPTION_BG_COLORS[idx % 5]} text-white`
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-black/25 flex items-center justify-center font-black text-lg">
                        {LETTERS[idx]}
                      </span>
                      <span>{opt}</span>
                    </div>

                    {isRevealed && (
                      <span className="px-3 py-1 rounded-lg bg-black/40 text-white text-base font-mono font-black">
                        {count} votes
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Explanation on Reveal */}
            {live.phase === 'reveal' && currentQ.e && (
              <div className="mt-6 p-4 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-sm sm:text-base font-medium animate-rise">
                💡 <b>Banking Regulation Context:</b> {currentQ.e}
              </div>
            )}
          </div>

          {/* Teacher Action Control Bar */}
          <div className="bg-slate-900/90 border border-indigo-900/70 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-2">
              <button
                disabled={(live.pos ?? 0) <= 0}
                onClick={() => {
                  const prevPos = Math.max(0, (live.pos ?? 0) - 1);
                  handleLiveAction('review', { p_q: prevPos, p_pos: prevPos });
                }}
                className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-bold disabled:opacity-30"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              {live.phase === 'question' ? (
                <>
                  <button
                    onClick={() => handleLiveAction('add', { p_secs: 10 })}
                    className="px-3 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs hover:bg-amber-500/30"
                  >
                    +10s
                  </button>

                  <button
                    onClick={() => handleLiveAction('reveal')}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-heading font-black text-sm shadow-md"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Reveal Correct Answer</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm("Skip this question without awarding points?")) {
                        handleLiveAction('skip', { p_q: live.q, p_pos: live.pos });
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-xs"
                  >
                    Skip
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    const nextPos = (live.pos ?? 0) + 1;
                    if (nextPos < quiz.questions.length) {
                      handleLiveAction('open', { p_q: nextPos, p_pos: nextPos });
                    } else {
                      handleSetStatus('ended');
                    }
                  }}
                  className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-white font-heading font-black text-sm shadow-lg shadow-emerald-500/30"
                >
                  <span>{(live.pos ?? 0) + 1 >= quiz.questions.length ? "Finish & Show Podium 🏆" : "Next Question ➜"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs font-bold text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoReveal}
                  onChange={e => setAutoReveal(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4"
                />
                <span>Auto-reveal at 0s</span>
              </label>

              {live.phase === 'question' && (
                <div className="font-mono text-amber-400 text-base font-black flex items-center gap-1">
                  <span>⏱ {remainingSecs}s</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Live Classroom Leaderboard Table */}
      <div className="bg-slate-900/90 border border-indigo-900/70 rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-400" />
            <h3 className="font-heading font-black text-xl sm:text-2xl text-white">
              {quiz.status === 'ended' ? "🏆 Final Leaderboard Standings" : "Live Trainee Leaderboard"}
            </h3>
          </div>

          <div className="flex items-center gap-1 text-xs font-bold">
            {[5, 10, 25, 0].map(n => (
              <button
                key={n}
                onClick={() => setTopN(n)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  topN === n ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {n ? `Top ${n}` : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Table Rows */}
        <div className="space-y-2">
          {leaderboard.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium">
              No trainees have answered yet. Trainees join using code <b>{code}</b>!
            </div>
          ) : (
            (topN ? leaderboard.slice(0, topN) : leaderboard).map((trainee, idx) => {
              const rank = idx + 1;
              return (
                <div
                  key={trainee.id}
                  className={`p-3.5 sm:p-4 rounded-xl flex items-center justify-between gap-3 transition-transform ${
                    rank === 1 ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/40 text-amber-200' :
                    rank === 2 ? 'bg-gradient-to-r from-slate-400/20 to-transparent border border-slate-400/30 text-slate-200' :
                    rank === 3 ? 'bg-gradient-to-r from-orange-500/20 to-transparent border border-orange-500/30 text-orange-200' :
                    'bg-slate-950/60 border border-indigo-900/30 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-heading font-black text-sm ${
                      rank === 1 ? 'bg-amber-400 text-slate-950' :
                      rank === 2 ? 'bg-slate-300 text-slate-950' :
                      rank === 3 ? 'bg-orange-500 text-white' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
                    </span>
                    <span className="font-heading font-bold text-base sm:text-lg text-white truncate max-w-[180px] sm:max-w-xs">
                      {trainee.name}
                    </span>
                    {trainee.streak >= 3 && (
                      <span className="flex items-center text-xs font-black text-orange-400">
                        <Flame className="w-3.5 h-3.5" /> {trainee.streak}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs sm:text-sm font-bold">
                    <span className="text-emerald-400 hidden sm:inline">
                      {trainee.correct} ✔
                    </span>
                    <span className="text-rose-400 hidden sm:inline">
                      {trainee.wrong} ✘
                    </span>
                    <span className="font-heading font-black text-base sm:text-xl text-amber-400 min-w-[70px] text-right">
                      {trainee.score.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Podium Overlay */}
      {showPodium && leaderboard.length > 0 && (
        <ChampionsPodium
          top3={leaderboard.slice(0, 3)}
          onClose={() => setShowPodium(false)}
        />
      )}
    </div>
  );
};
