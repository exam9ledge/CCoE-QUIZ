import React, { useState, useEffect } from 'react';
import { api, storage, getErrorMessage } from '../lib/api';
import { parseExcelWorkbook } from '../lib/excel';
import { Quiz, Question } from '../types/quiz';
import {
  Plus, Upload, Trash2, Copy, Play, Edit3, Key, LogOut, Search,
  CheckCircle, AlertCircle, Clock, BookOpen, RotateCcw, Shield
} from 'lucide-react';

const LETTERS = ["A", "B", "C", "D", "E"];

interface AdminQuizzesProps {
  onPresentQuiz: (code: string) => void;
  adminToken: string | null;
  onTokenChange: (token: string | null) => void;
}

export const AdminQuizzes: React.FC<AdminQuizzesProps> = ({ onPresentQuiz, adminToken, onTokenChange }) => {
  // Auth state
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('Canara@COE2026');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Quizzes state
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // New quiz form state
  const [newTitle, setNewTitle] = useState<string>('Digital Banking Masterclass 2026');
  const [newTimer, setNewTimer] = useState<number>(30);
  const [newShuffle, setNewShuffle] = useState<boolean>(true);
  const [newShowExplanation, setNewShowExplanation] = useState<boolean>(true);
  const [excelQuestions, setExcelQuestions] = useState<Question[]>([]);
  const [excelSummary, setExcelSummary] = useState<any>(null);

  // Question editing modal state
  const [editingQIndex, setEditingQIndex] = useState<number | null>(null);
  const [editQText, setEditQText] = useState<string>('');
  const [editQOptions, setEditQOptions] = useState<string[]>(['', '', '', '']);
  const [editQAnswer, setEditQAnswer] = useState<number>(0);
  const [editQExplanation, setEditQExplanation] = useState<string>('');
  const [editQTopic, setEditQTopic] = useState<string>('');
  const [editQTimer, setEditQTimer] = useState<number>(30);

  // Load quiz list
  const loadQuizzes = async () => {
    if (!adminToken) return;
    try {
      const list = await api('admin_list', { p_token: adminToken });
      setQuizzes(list);
    } catch (err: any) {
      if (err.message === 'NOT_LOGGED_IN') {
        onTokenChange(null);
        storage.del('coe_admin_token');
      }
    }
  };

  useEffect(() => {
    if (adminToken) {
      loadQuizzes();
    }
  }, [adminToken]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      const resp = await api('admin_login', { p_user: username.trim(), p_pass: password });
      onTokenChange(resp.token);
      storage.set('coe_admin_token', resp.token);
      if (resp.must_change) {
        setShowPasswordModal(true);
      }
    } catch (err: any) {
      setLoginError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      if (adminToken) await api('admin_logout', { p_token: adminToken });
    } catch {}
    onTokenChange(null);
    storage.del('coe_admin_token');
    setSelectedQuiz(null);
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    try {
      await api('admin_change_password', {
        p_token: adminToken,
        p_old: oldPassword,
        p_new: newPassword
      });
      setShowPasswordModal(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert("Password changed successfully!");
    } catch (err: any) {
      setPasswordError(getErrorMessage(err));
    }
  };

  // Excel File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const result = parseExcelWorkbook(buffer);
      setExcelQuestions(result.questions);
      setExcelSummary(result.summary);
      if (!newTitle) {
        setNewTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
      }
    } catch (err: any) {
      alert(err.message || "Failed to parse Excel file.");
    }
  };

  // Create Quiz from Excel or Form
  const handleCreateQuiz = async () => {
    if (!excelQuestions.length) {
      alert("Please upload an Excel file containing questions first.");
      return;
    }

    try {
      const resp = await api('create_quiz', {
        p_token: adminToken,
        p_title: newTitle.trim() || "Canara Banking Quiz",
        p_settings: {
          mode: 'teacher',
          shuffle: newShuffle,
          timerAll: newTimer,
          lifelines: 2,
          showExplanation: newShowExplanation,
          allowRestart: true
        },
        p_questions: excelQuestions
      });

      alert(`Quiz created successfully! Code: ${resp.code}`);
      setExcelQuestions([]);
      setExcelSummary(null);
      loadQuizzes();
    } catch (err: any) {
      alert(getErrorMessage(err));
    }
  };

  // Open Quiz in Editor
  const handleOpenEdit = async (code: string) => {
    try {
      const q = await api('admin_get', { p_token: adminToken, p_code: code });
      setSelectedQuiz(q);
      setIsEditing(true);
    } catch (err: any) {
      alert(getErrorMessage(err));
    }
  };

  // Duplicate Quiz
  const handleDuplicate = async (code: string, currentTitle: string) => {
    const title = prompt("Enter title for duplicate quiz:", `${currentTitle} (Copy)`);
    if (!title) return;
    try {
      await api('admin_duplicate', { p_token: adminToken, p_code: code, p_title: title });
      loadQuizzes();
    } catch (err: any) {
      alert(getErrorMessage(err));
    }
  };

  // Delete Quiz
  const handleDeleteQuiz = async (code: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}" and all its records?`)) return;
    try {
      await api('admin_delete_quiz', { p_token: adminToken, p_code: code });
      loadQuizzes();
      if (selectedQuiz?.code === code) setSelectedQuiz(null);
    } catch (err: any) {
      alert(getErrorMessage(err));
    }
  };

  // Reset Session
  const handleResetSession = async (code: string) => {
    if (!confirm("Resetting the session will clear all participant scores and set status back to Lobby. Continue?")) return;
    try {
      await api('admin_reset', { p_token: adminToken, p_code: code });
      alert("Quiz session reset successfully.");
      loadQuizzes();
      if (selectedQuiz?.code === code) handleOpenEdit(code);
    } catch (err: any) {
      alert(getErrorMessage(err));
    }
  };

  // Save / Edit Question
  const handleSaveQuestion = async () => {
    if (!selectedQuiz) return;
    if (!editQText.trim()) {
      alert("Please enter question text.");
      return;
    }
    const cleanOptions = editQOptions.filter(o => o.trim() !== '');
    if (cleanOptions.length < 2) {
      alert("At least 2 options are required.");
      return;
    }

    try {
      await api('admin_save_question', {
        p_token: adminToken,
        p_code: selectedQuiz.code,
        p_idx: editingQIndex,
        p_q: {
          q: editQText.trim(),
          o: cleanOptions,
          a: Math.min(editQAnswer, cleanOptions.length - 1),
          e: editQExplanation.trim() || null,
          t: editQTopic.trim() || null,
          s: editQTimer || 30
        }
      });

      setEditingQIndex(null);
      handleOpenEdit(selectedQuiz.code);
    } catch (err: any) {
      alert(getErrorMessage(err));
    }
  };

  // Delete single question
  const handleDeleteQuestion = async (idx: number) => {
    if (!selectedQuiz) return;
    if (!confirm(`Delete question ${idx + 1}?`)) return;
    try {
      await api('admin_delete_question', {
        p_token: adminToken,
        p_code: selectedQuiz.code,
        p_idx: idx
      });
      handleOpenEdit(selectedQuiz.code);
    } catch (err: any) {
      alert(getErrorMessage(err));
    }
  };

  // Set All Timers
  const handleSetAllTimes = async (secs: number) => {
    if (!selectedQuiz) return;
    try {
      await api('admin_set_all_times', {
        p_token: adminToken,
        p_code: selectedQuiz.code,
        p_secs: secs
      });
      alert(`Updated all timers to ${secs}s.`);
      handleOpenEdit(selectedQuiz.code);
    } catch (err: any) {
      alert(getErrorMessage(err));
    }
  };

  // 1. Admin Login View
  if (!adminToken) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-slate-900/95 border border-indigo-900/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-purple-500/20 mb-3">
              <Shield className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-heading font-black text-white">
              Administrator Portal
            </h2>
            <p className="text-xs text-indigo-200 mt-1">
              Canara Centre of Excellence – Training Administration
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full py-2.5 px-3.5 bg-slate-950/80 border border-indigo-700/60 rounded-xl text-white font-semibold focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full py-2.5 px-3.5 bg-slate-950/80 border border-indigo-700/60 rounded-xl text-white font-semibold focus:outline-none focus:border-amber-400"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-semibold">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-heading font-black text-base bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/30 transition-transform active:scale-95 disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Log In as Administrator"}
            </button>

            <div className="text-center pt-2 text-[11px] text-slate-400">
              Default credentials: <span className="text-amber-300 font-mono font-bold">admin</span> / <span className="text-amber-300 font-mono font-bold">Canara@COE2026</span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 2. Main Admin Dashboard View
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Admin Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-indigo-900/60 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/30 text-purple-300 flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-black text-lg text-white">
              Quiz Library & Management
            </h3>
            <p className="text-xs text-indigo-200">
              Logged in as: <b className="text-amber-300">admin</b> | Canara Centre of Excellence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Change Password</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-bold transition-colors border border-rose-800/40"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Editor Modal for single quiz */}
      {isEditing && selectedQuiz ? (
        <div className="bg-slate-900/95 border border-indigo-900/80 rounded-2xl p-6 shadow-2xl backdrop-blur space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-400 text-slate-950">
                Code {selectedQuiz.code}
              </span>
              <h2 className="text-2xl font-heading font-black text-white mt-1">
                {selectedQuiz.title}
              </h2>
              <p className="text-xs text-slate-400">
                {selectedQuiz.questions.length} Questions · Mode: {selectedQuiz.settings.mode}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onPresentQuiz(selectedQuiz.code)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-bold text-sm shadow-md"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Present Quiz</span>
              </button>
              <button
                onClick={() => handleResetSession(selectedQuiz.code)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Session</span>
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Close Editor
              </button>
            </div>
          </div>

          {/* Quick Timer Bulk Apply */}
          <div className="p-4 bg-slate-950/70 border border-indigo-900/50 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-slate-300">
              Bulk Set Timer for All Questions:
            </span>
            <div className="flex items-center gap-2">
              {[15, 20, 30, 45, 60].map(s => (
                <button
                  key={s}
                  onClick={() => handleSetAllTimes(s)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 hover:bg-indigo-900 font-bold"
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-heading font-bold text-lg text-white">
                Questions ({selectedQuiz.questions.length})
              </h4>
              <button
                onClick={() => {
                  setEditingQIndex(selectedQuiz.questions.length);
                  setEditQText('');
                  setEditQOptions(['', '', '', '']);
                  setEditQAnswer(0);
                  setEditQExplanation('');
                  setEditQTopic('');
                  setEditQTimer(30);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                <span>Add Question</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {selectedQuiz.questions.map((q, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950/80 border border-indigo-950 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-indigo-900 text-indigo-200 font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-sm text-slate-100">
                        {q.q}
                      </span>
                    </div>
                    <div className="text-emerald-400 font-semibold pl-8">
                      Answer: ({LETTERS[q.a]}) {q.o[q.a]} · ⏱ {q.s || 30}s {q.t ? `· [${q.t}]` : ''}
                    </div>
                    {q.e && (
                      <div className="text-slate-400 pl-8 text-[11px]">
                        💡 {q.e}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingQIndex(idx);
                        setEditQText(q.q);
                        const opts = [...q.o];
                        while (opts.length < 4) opts.push('');
                        setEditQOptions(opts);
                        setEditQAnswer(q.a);
                        setEditQExplanation(q.e || '');
                        setEditQTopic(q.t || '');
                        setEditQTimer(q.s || 30);
                      }}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(idx)}
                      className="p-2 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Quiz Library Grid & Creation from Excel */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Create New Quiz / Upload Excel */}
          <div className="bg-slate-900/90 border border-indigo-900/70 rounded-2xl p-6 shadow-2xl backdrop-blur space-y-4">
            <h3 className="font-heading font-black text-xl text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-400" />
              <span>Import Quiz from Excel</span>
            </h3>
            <p className="text-xs text-indigo-200">
              Upload .xlsx or .csv containing Question, Options A-D, Answer, Explanation.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Questions File
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
              />
            </div>

            {excelSummary && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs space-y-1">
                <div className="text-emerald-300 font-bold">
                  ✔ {excelSummary.total} Questions parsed successfully!
                </div>
                <div className="text-slate-400 truncate">
                  Sample: {excelSummary.sample.q}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Quiz Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Canara Forex & Treasury 2026-27"
                className="w-full py-2.5 px-3.5 bg-slate-950/80 border border-indigo-700/60 rounded-xl text-white font-semibold text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Default Timer
                </label>
                <select
                  value={newTimer}
                  onChange={e => setNewTimer(+e.target.value)}
                  className="w-full py-2 px-2.5 bg-slate-950 border border-indigo-700/60 rounded-lg text-white font-bold"
                >
                  <option value={15}>15 seconds</option>
                  <option value={20}>20 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={45}>45 seconds</option>
                  <option value={60}>60 seconds</option>
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Shuffle Questions
                </label>
                <select
                  value={newShuffle ? "1" : "0"}
                  onChange={e => setNewShuffle(e.target.value === "1")}
                  className="w-full py-2 px-2.5 bg-slate-950 border border-indigo-700/60 rounded-lg text-white font-bold"
                >
                  <option value="1">Yes (Shuffled)</option>
                  <option value="0">No (Same order)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCreateQuiz}
              disabled={!excelQuestions.length}
              className="w-full py-3.5 rounded-xl font-heading font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-40 transition-transform active:scale-95"
            >
              Create Quiz Session ⚡
            </button>
          </div>

          {/* Right Column: Existing Quiz Library */}
          <div className="lg:col-span-2 bg-slate-900/90 border border-indigo-900/70 rounded-2xl p-6 shadow-2xl backdrop-blur space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-heading font-black text-xl text-white">
                Existing Quizzes ({quizzes.length})
              </h3>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search quizzes..."
                  className="pl-9 pr-4 py-2 bg-slate-950 border border-indigo-800/60 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
              {quizzes
                .filter(q => !searchQuery || q.title.toLowerCase().includes(searchQuery.toLowerCase()) || q.code.includes(searchQuery))
                .map(q => (
                  <div
                    key={q.code}
                    className="p-4 rounded-xl bg-slate-950/80 border border-indigo-900/40 flex flex-wrap items-center justify-between gap-3 hover:border-indigo-600 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                          {q.code}
                        </span>
                        <h4 className="font-heading font-bold text-base text-white truncate max-w-sm">
                          {q.title}
                        </h4>
                      </div>
                      <div className="text-xs text-slate-400">
                        {q.q_count} Questions · {q.players} Trainees Joined · Status: <span className="uppercase text-amber-400 font-bold">{q.status}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onPresentQuiz(q.code)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Present</span>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(q.code)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDuplicate(q.code, q.title)}
                        title="Duplicate"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuiz(q.code, q.title)}
                        title="Delete"
                        className="p-2 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Question Edit / Add Dialog */}
      {editingQIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-indigo-800 rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="font-heading font-black text-xl text-white">
              {editingQIndex >= (selectedQuiz?.questions.length || 0) ? "Add New Question" : `Edit Question ${editingQIndex + 1}`}
            </h3>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Question Text
              </label>
              <textarea
                rows={3}
                value={editQText}
                onChange={e => setEditQText(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-indigo-700/60 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {editQOptions.map((opt, idx) => (
                <div key={idx}>
                  <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Option {LETTERS[idx]}
                  </label>
                  <input
                    type="text"
                    value={opt}
                    onChange={e => {
                      const updated = [...editQOptions];
                      updated[idx] = e.target.value;
                      setEditQOptions(updated);
                    }}
                    className="w-full py-2 px-3 bg-slate-950 border border-indigo-700/60 rounded-lg text-white font-semibold focus:outline-none focus:border-amber-400"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Correct Answer
                </label>
                <select
                  value={editQAnswer}
                  onChange={e => setEditQAnswer(+e.target.value)}
                  className="w-full py-2 px-2.5 bg-slate-950 border border-indigo-700/60 rounded-lg text-white font-bold"
                >
                  {LETTERS.slice(0, editQOptions.length).map((l, i) => (
                    <option key={i} value={i}>Option {l}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Timer (Seconds)
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={editQTimer}
                  onChange={e => setEditQTimer(+e.target.value)}
                  className="w-full py-2 px-2.5 bg-slate-950 border border-indigo-700/60 rounded-lg text-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Topic / Tag
                </label>
                <input
                  type="text"
                  value={editQTopic}
                  onChange={e => setEditQTopic(e.target.value)}
                  placeholder="e.g. Digital Banking"
                  className="w-full py-2 px-2.5 bg-slate-950 border border-indigo-700/60 rounded-lg text-white font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Banking Context & Explanation
              </label>
              <textarea
                rows={2}
                value={editQExplanation}
                onChange={e => setEditQExplanation(e.target.value)}
                placeholder="Explain the correct banking circular or rule..."
                className="w-full p-2.5 bg-slate-950 border border-indigo-700/60 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingQIndex(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuestion}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-black text-xs"
              >
                Save Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Dialog */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form onSubmit={handleChangePassword} className="bg-slate-900 border border-indigo-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-heading font-black text-xl text-white">
              Change Admin Password
            </h3>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                className="w-full py-2 px-3 bg-slate-950 border border-indigo-700/60 rounded-lg text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                New Password (min 8 chars)
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full py-2 px-3 bg-slate-950 border border-indigo-700/60 rounded-lg text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full py-2 px-3 bg-slate-950 border border-indigo-700/60 rounded-lg text-white text-xs"
              />
            </div>

            {passwordError && (
              <div className="text-xs text-rose-400 font-semibold">
                {passwordError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
              >
                Update Password
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
