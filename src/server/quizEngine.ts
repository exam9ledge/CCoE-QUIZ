import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Quiz, Player, AdminUser, Question, SanitizedQuestion } from '../types/quiz';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'canara_quiz_db.json');

const DEFAULT_BANKING_QUESTIONS: Question[] = [
  {
    i: 0,
    q: "Under RBI guidelines, what is the maximum transaction limit for UPI Lite without entering a UPI PIN?",
    o: ["₹200", "₹500", "₹1,000", "₹2,000"],
    a: 1,
    e: "RBI raised the per-transaction limit for UPI Lite to ₹500, with a cumulative wallet limit of ₹2,000.",
    t: "Digital Banking",
    s: 30
  },
  {
    i: 1,
    q: "Which of the following documents is NOT considered an Officially Valid Document (OVD) for Individual KYC?",
    o: ["Passport", "Driving License", "Ration Card", "Voter's Identity Card"],
    a: 2,
    e: "Ration card is not recognized as an Officially Valid Document (OVD) under RBI Master Direction on KYC.",
    t: "KYC & AML",
    s: 30
  },
  {
    i: 2,
    q: "What is the primary purpose of the Prompt Corrective Action (PCA) framework enforced by the Reserve Bank of India?",
    o: ["To liquidate non-performing banks", "To monitor banks with weak financial metrics before crisis", "To mandate interest rate ceilings", "To regulate NBFC microfinance rates"],
    a: 1,
    e: "PCA is an early-intervention supervisory framework assessing Capital, Asset Quality, and Leverage.",
    t: "Banking Regulations",
    s: 30
  },
  {
    i: 3,
    q: "Under the Canara Bank Retail Lending Scheme, what is the standard CIBIL score benchmark generally required for preferential home loan interest rates?",
    o: ["550 & above", "650 & above", "750 & above", "850 only"],
    a: 2,
    e: "A credit bureau (CIBIL) score of 750 and above qualifies borrowers for standard preferential retail rate slabs.",
    t: "Retail Credit",
    s: 30
  },
  {
    i: 4,
    q: "What is the maximum insurance coverage provided to a bank depositor by DICGC per bank?",
    o: ["₹1 Lakh", "₹2 Lakhs", "₹5 Lakhs", "₹10 Lakhs"],
    a: 2,
    e: "Deposit Insurance and Credit Guarantee Corporation (DICGC) insures deposits up to ₹5 Lakhs per depositor across accounts in the same bank.",
    t: "Compliance & Safety",
    s: 30
  },
  {
    i: 5,
    q: "In cyber fraud prevention, what is the national helpline number for reporting financial cybercrime in India?",
    o: ["1930", "112", "1800-425-0018", "1098"],
    a: 0,
    e: "1930 is the dedicated national cyber financial fraud reporting helpline connected to the Citizen Financial Cyber Fraud Reporting and Management System.",
    t: "Cyber Security",
    s: 30
  }
];

const SEED_QUIZZES: Quiz[] = [
  {
    code: "726849",
    title: "Canara Digital Banking & Cyber Security 2026-27",
    status: "lobby",
    settings: {
      mode: "teacher",
      shuffle: true,
      timerAll: 30,
      lifelines: 2,
      showExplanation: true,
      allowRestart: true,
      locked: false
    },
    questions: DEFAULT_BANKING_QUESTIONS,
    live: {
      phase: "lobby",
      q: 0,
      pos: 0,
      seq: 1,
      started_at: null,
      ends_at: null,
      skipped: []
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    code: "839104",
    title: "Canara Centre of Excellence – Retail Credit & KYC Challenge",
    status: "lobby",
    settings: {
      mode: "student",
      shuffle: true,
      timerAll: 30,
      lifelines: 2,
      showExplanation: true,
      allowRestart: true,
      locked: false
    },
    questions: DEFAULT_BANKING_QUESTIONS.slice(0, 4),
    live: {
      phase: "lobby",
      q: 0,
      pos: 0,
      seq: 1,
      started_at: null,
      ends_at: null,
      skipped: []
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

interface DatabaseData {
  quizzes: Record<string, Quiz>;
  players: Record<string, Player>;
  admin: AdminUser;
  tokens: Record<string, { username: string; expiresAt: number }>;
}

class QuizEngine {
  private quizzes: Map<string, Quiz> = new Map();
  private players: Map<string, Player> = new Map();
  private admin: AdminUser = {
    username: "admin",
    passwordHash: "",
    salt: "",
    mustChange: false
  };
  private tokens: Map<string, { username: string; expiresAt: number }> = new Map();

  constructor() {
    this.initDatabase();
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString('hex');
  }

  private initDatabase() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const data: DatabaseData = JSON.parse(raw);
        Object.entries(data.quizzes || {}).forEach(([k, v]) => this.quizzes.set(k, v));
        Object.entries(data.players || {}).forEach(([k, v]) => this.players.set(k, v));
        if (data.admin) this.admin = data.admin;
        Object.entries(data.tokens || {}).forEach(([k, v]) => this.tokens.set(k, v));
        return;
      } catch (err) {
        console.error("Failed to read DB file, initializing fresh store:", err);
      }
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const defaultPass = process.env.ADMIN_INITIAL_PASSWORD || "Canara@COE2026";
    this.admin = {
      username: "admin",
      passwordHash: this.hashPassword(defaultPass, salt),
      salt,
      mustChange: false
    };

    SEED_QUIZZES.forEach(q => this.quizzes.set(q.code, q));
    this.save();
  }

  private save() {
    try {
      const data: DatabaseData = {
        quizzes: Object.fromEntries(this.quizzes.entries()),
        players: Object.fromEntries(this.players.entries()),
        admin: this.admin,
        tokens: Object.fromEntries(this.tokens.entries())
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error("Error persisting DB:", err);
    }
  }

  public verifyAdminToken(token?: string): boolean {
    if (!token) return false;
    const item = this.tokens.get(token);
    if (!item) return false;
    if (Date.now() > item.expiresAt) {
      this.tokens.delete(token);
      this.save();
      return false;
    }
    return true;
  }

  public adminLogin(user: string, pass: string): { token: string; username: string; must_change: boolean } {
    if (user !== this.admin.username) {
      throw new Error("BAD_LOGIN");
    }
    const computed = this.hashPassword(pass, this.admin.salt);
    if (computed !== this.admin.passwordHash) {
      throw new Error("BAD_LOGIN");
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    this.tokens.set(token, { username: user, expiresAt });
    this.save();

    return { token, username: user, must_change: this.admin.mustChange };
  }

  public adminLogout(token: string) {
    this.tokens.delete(token);
    this.save();
  }

  public adminChangePassword(token: string, oldPass: string, newPass: string) {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    if (newPass.length < 8) throw new Error("WEAK_PASSWORD");

    const computed = this.hashPassword(oldPass, this.admin.salt);
    if (computed !== this.admin.passwordHash) {
      throw new Error("BAD_OLD_PASSWORD");
    }

    const salt = crypto.randomBytes(16).toString('hex');
    this.admin.salt = salt;
    this.admin.passwordHash = this.hashPassword(newPass, salt);
    this.admin.mustChange = false;

    const current = this.tokens.get(token);
    this.tokens.clear();
    if (current) this.tokens.set(token, current);
    this.save();
  }

  public getQuizList(token: string) {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    return Array.from(this.quizzes.values()).map(q => {
      const playerCount = Array.from(this.players.values()).filter(p => p.quiz_code === q.code).length;
      return {
        code: q.code,
        title: q.title,
        status: q.status,
        q_count: q.questions.length,
        players: playerCount,
        updated_at: q.updated_at
      };
    });
  }

  public createQuiz(token: string, title: string, settings: any, questions: Question[]): Quiz {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    if (!questions || !questions.length) throw new Error("NO_QUESTIONS");

    let code = "";
    while (!code || this.quizzes.has(code)) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    }

    const quiz: Quiz = {
      code,
      title: title || "Canara COE Knowledge Challenge",
      status: "lobby",
      settings: {
        mode: settings?.mode || "student",
        shuffle: settings?.shuffle ?? true,
        timerAll: settings?.timerAll !== undefined ? settings.timerAll : 30,
        lifelines: settings?.lifelines !== undefined ? +settings.lifelines : 2,
        showExplanation: settings?.showExplanation ?? true,
        allowRestart: settings?.allowRestart ?? true,
        locked: false
      },
      questions: questions.map((q, idx) => ({ ...q, i: idx })),
      live: {
        phase: "lobby",
        q: 0,
        pos: 0,
        seq: 1,
        started_at: null,
        ends_at: null,
        skipped: []
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.quizzes.set(code, quiz);
    this.save();
    return quiz;
  }

  public getQuizAdmin(token: string, code: string): Quiz & { players: number; q_count: number } {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");
    const players = Array.from(this.players.values()).filter(p => p.quiz_code === code).length;
    return {
      ...quiz,
      players,
      q_count: quiz.questions.length
    };
  }

  public updateQuiz(token: string, code: string, title?: string | null, settingsPatch?: any): Quiz {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");

    if (title) quiz.title = title.trim();
    if (settingsPatch) {
      quiz.settings = { ...quiz.settings, ...settingsPatch };
    }
    quiz.updated_at = new Date().toISOString();
    this.save();
    return quiz;
  }

  public duplicateQuiz(token: string, code: string, title?: string): Quiz {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const original = this.quizzes.get(code);
    if (!original) throw new Error("QUIZ_NOT_FOUND");

    let newCode = "";
    while (!newCode || this.quizzes.has(newCode)) {
      newCode = Math.floor(100000 + Math.random() * 900000).toString();
    }

    const copy: Quiz = {
      ...JSON.parse(JSON.stringify(original)),
      code: newCode,
      title: title || `${original.title} (Copy)`,
      status: "lobby",
      live: {
        phase: "lobby",
        q: 0,
        pos: 0,
        seq: 1,
        started_at: null,
        ends_at: null,
        skipped: []
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.quizzes.set(newCode, copy);
    this.save();
    return copy;
  }

  public deleteQuiz(token: string, code: string) {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    this.quizzes.delete(code);
    for (const [id, p] of this.players.entries()) {
      if (p.quiz_code === code) {
        this.players.delete(id);
      }
    }
    this.save();
  }

  public resetSession(token: string, code: string) {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");

    for (const [id, p] of this.players.entries()) {
      if (p.quiz_code === code) {
        this.players.delete(id);
      }
    }
    quiz.status = "lobby";
    quiz.live = {
      phase: "lobby",
      q: 0,
      pos: 0,
      seq: (quiz.live?.seq || 0) + 1,
      started_at: null,
      ends_at: null,
      skipped: []
    };
    quiz.updated_at = new Date().toISOString();
    this.save();
  }

  public saveQuestion(token: string, code: string, idx: number | null, qData: any) {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");

    if (idx === null || idx === undefined || idx < 0 || idx >= quiz.questions.length) {
      const newIdx = quiz.questions.length;
      quiz.questions.push({ ...qData, i: newIdx });
    } else {
      quiz.questions[idx] = { ...qData, i: idx };
    }
    quiz.updated_at = new Date().toISOString();
    this.save();
  }

  public deleteQuestion(token: string, code: string, idx: number) {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");
    quiz.questions.splice(idx, 1);
    quiz.questions.forEach((q, i) => q.i = i);
    quiz.updated_at = new Date().toISOString();
    this.save();
  }

  public replaceQuestions(token: string, code: string, questions: Question[]) {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");
    quiz.questions = questions.map((q, i) => ({ ...q, i }));
    quiz.updated_at = new Date().toISOString();
    this.save();
  }

  public setAllTimes(token: string, code: string, secs: number) {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");
    quiz.questions.forEach(q => q.s = secs > 0 ? secs : null);
    quiz.settings.timerAll = secs;
    quiz.updated_at = new Date().toISOString();
    this.save();
  }

  public hostSetStatus(token: string, code: string, status: 'lobby' | 'live' | 'paused' | 'ended') {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");
    quiz.status = status;
    quiz.updated_at = new Date().toISOString();
    this.save();
  }

  public hostSetTimer(token: string, code: string, secs: number | null) {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");
    quiz.settings.timerAll = secs;
    quiz.updated_at = new Date().toISOString();
    this.save();
  }

  public hostLiveAction(token: string, code: string, action: string, q?: number | null, pos?: number | null, secs?: number | null) {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");

    const now = Date.now();
    const live = quiz.live || { phase: "lobby", q: 0, pos: 0, seq: 1 };
    live.seq = (live.seq || 0) + 1;

    if (action === "clear") {
      live.phase = "lobby";
      live.started_at = null;
      live.ends_at = null;
      live.skipped = [];
    } else if (action === "open") {
      const qIdx = q ?? 0;
      const question = quiz.questions[qIdx];
      const durationSecs = secs ?? (quiz.settings.timerAll || question?.s || 30);
      live.phase = "question";
      live.q = qIdx;
      live.pos = pos ?? qIdx;
      live.started_at = new Date(now).toISOString();
      live.ends_at = durationSecs > 0 ? new Date(now + durationSecs * 1000).toISOString() : null;
    } else if (action === "reveal") {
      live.phase = "reveal";
      live.ends_at = new Date(now).toISOString();
    } else if (action === "add") {
      if (live.ends_at && secs) {
        const currentEnd = new Date(live.ends_at).getTime();
        const newEnd = Math.max(now, currentEnd) + secs * 1000;
        live.ends_at = new Date(newEnd).toISOString();
      }
    } else if (action === "skip") {
      live.phase = "skipped";
      if (!live.skipped) live.skipped = [];
      if (q !== undefined && q !== null) live.skipped.push(q);
    } else if (action === "review") {
      live.phase = "reveal";
      live.q = q ?? 0;
      live.pos = pos ?? q ?? 0;
      live.ends_at = new Date(now).toISOString();
    }

    quiz.live = live;
    quiz.updated_at = new Date(now).toISOString();
    this.save();

    return { live, now: new Date(now).toISOString() };
  }

  public hostLive(token: string, code: string) {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");

    const quizPlayers = Array.from(this.players.values()).filter(p => p.quiz_code === code);
    const currQ = quiz.live?.q ?? -1;

    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    let answered = 0;

    if (currQ >= 0) {
      quizPlayers.forEach(p => {
        const found = p.done.find(d => d.i === currQ);
        if (found) {
          answered++;
          if (found.c >= 0 && found.c <= 4) {
            counts[found.c] = (counts[found.c] || 0) + 1;
          }
        }
      });
    }

    return {
      status: quiz.status,
      live: quiz.live,
      players: quizPlayers.length,
      answered,
      counts,
      now: new Date().toISOString()
    };
  }

  public hostStats(token: string, code: string) {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");

    const quizPlayers = Array.from(this.players.values()).filter(p => p.quiz_code === code);
    const stats = quiz.questions.map(q => {
      let attempts = 0;
      let okCount = 0;
      quizPlayers.forEach(p => {
        const d = p.done.find(ans => ans.i === q.i);
        if (d) {
          attempts++;
          if (d.ok) okCount++;
        }
      });
      return { i: q.i, n: attempts, ok: okCount };
    });

    return stats;
  }

  public getQuizState(code: string) {
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");

    return {
      code: quiz.code,
      title: quiz.title,
      status: quiz.status,
      q_count: quiz.questions.length,
      settings: quiz.settings,
      live: quiz.live,
      now: new Date().toISOString()
    };
  }

  public getQuestionsForPlayer(code: string): SanitizedQuestion[] {
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");

    return quiz.questions.map(q => ({
      i: q.i,
      q: q.q,
      o: q.o,
      s: q.s,
      t: q.t
    }));
  }

  public join(code: string, name: string, pin: string, order?: number[]): { existing: boolean; player: Player } {
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");
    if (quiz.settings?.locked && quiz.status !== "lobby") throw new Error("JOIN_LOCKED");

    const trimmedName = name.trim();
    if (trimmedName.length < 2) throw new Error("BAD_NAME");
    if (!/^\d{4}$/.test(pin)) throw new Error("BAD_PIN_FORMAT");

    const existing = Array.from(this.players.values()).find(
      p => p.quiz_code === code && p.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existing) {
      if (existing.pin !== pin) {
        throw new Error("NAME_TAKEN");
      }
      existing.last_active = Date.now();
      this.save();
      return { existing: true, player: existing };
    }

    const playerId = crypto.randomUUID();
    const newPlayer: Player = {
      id: playerId,
      name: trimmedName,
      pin,
      quiz_code: code,
      score: 0,
      correct: 0,
      wrong: 0,
      answered: 0,
      streak: 0,
      best_streak: 0,
      finished: false,
      q_order: order && order.length ? order : Array.from({ length: quiz.questions.length }, (_, i) => i),
      done: [],
      fifty: [],
      fifty_used: 0,
      created_at: new Date().toISOString(),
      last_active: Date.now()
    };

    this.players.set(playerId, newPlayer);
    this.save();
    return { existing: false, player: newPlayer };
  }

  public submitAnswer(playerId: string, pin: string, qIdx: number, choice: number, responseMs: number = 0) {
    const player = this.players.get(playerId);
    if (!player) throw new Error("PLAYER_NOT_FOUND");
    if (player.pin !== pin) throw new Error("BAD_PIN");

    const quiz = this.quizzes.get(player.quiz_code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");
    if (quiz.status !== "live" && quiz.status !== "paused") throw new Error("QUIZ_NOT_LIVE");

    if (quiz.settings?.mode === "teacher") {
      if (quiz.live?.phase !== "question" || quiz.live?.q !== qIdx) {
        throw new Error("QUESTION_CLOSED");
      }
      if (quiz.live.ends_at) {
        const deadline = new Date(quiz.live.ends_at).getTime();
        if (Date.now() > deadline + 2500) {
          throw new Error("QUESTION_CLOSED");
        }
      }
    }

    if (player.done.some(d => d.i === qIdx)) {
      throw new Error("ALREADY_ANSWERED");
    }

    const question = quiz.questions[qIdx];
    if (!question) throw new Error("BAD_QUESTION");

    const isCorrect = choice >= 0 && choice === question.a;
    let points = 0;

    if (isCorrect) {
      points = 1000;
      const questionSecs = quiz.settings.timerAll || question.s || 30;
      const totalMs = questionSecs * 1000;
      if (totalMs > 0 && responseMs > 0) {
        const speedRatio = Math.max(0, 1 - (responseMs / totalMs));
        points += Math.round(speedRatio * 500);
      }
      const currentStreak = player.streak || 0;
      const streakMultiplier = Math.min(0.5, currentStreak * 0.1);
      points += Math.round(points * streakMultiplier);

      player.streak = currentStreak + 1;
      if (player.streak > player.best_streak) {
        player.best_streak = player.streak;
      }
      player.correct += 1;
    } else {
      player.streak = 0;
      player.wrong += 1;
    }

    player.score += points;
    player.answered += 1;
    player.done.push({
      i: qIdx,
      c: choice,
      ok: isCorrect,
      points,
      ms: responseMs
    });

    if (player.answered >= quiz.questions.length) {
      player.finished = true;
    }
    player.last_active = Date.now();
    this.save();

    return {
      correct: isCorrect,
      points,
      answer: question.a,
      explanation: question.e || null,
      player
    };
  }

  public useFifty(playerId: string, pin: string, qIdx: number) {
    const player = this.players.get(playerId);
    if (!player) throw new Error("PLAYER_NOT_FOUND");
    if (player.pin !== pin) throw new Error("BAD_PIN");

    const quiz = this.quizzes.get(player.quiz_code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");

    const maxLifelines = quiz.settings?.lifelines || 0;
    if (player.fifty_used >= maxLifelines) {
      throw new Error("NO_LIFELINES");
    }

    if (player.done.some(d => d.i === qIdx)) {
      throw new Error("ALREADY_ANSWERED");
    }

    const question = quiz.questions[qIdx];
    if (!question || question.o.length < 3) {
      throw new Error("FIFTY_NOT_POSSIBLE");
    }

    const existing = (player.fifty || []).find(f => f.i === qIdx);
    if (existing) {
      return { hidden: existing.h, used: player.fifty_used };
    }

    const wrongIndices = question.o.map((_, i) => i).filter(i => i !== question.a);
    const shuffledWrongs = wrongIndices.sort(() => Math.random() - 0.5);
    const hidden = shuffledWrongs.slice(0, 2);

    if (!player.fifty) player.fifty = [];
    player.fifty.push({ i: qIdx, h: hidden });
    player.fifty_used += 1;
    player.last_active = Date.now();
    this.save();

    return { hidden, used: player.fifty_used };
  }

  public restartPlayer(playerId: string, pin: string, order?: number[]) {
    const player = this.players.get(playerId);
    if (!player) throw new Error("PLAYER_NOT_FOUND");
    if (player.pin !== pin) throw new Error("BAD_PIN");

    const quiz = this.quizzes.get(player.quiz_code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");
    if (quiz.settings?.allowRestart === false || quiz.status === "ended") {
      throw new Error("RESTART_DISABLED");
    }

    player.score = 0;
    player.correct = 0;
    player.wrong = 0;
    player.answered = 0;
    player.streak = 0;
    player.best_streak = 0;
    player.finished = false;
    player.done = [];
    player.fifty = [];
    player.fifty_used = 0;
    player.q_order = order && order.length ? order : player.q_order;
    player.last_active = Date.now();
    this.save();

    return { player };
  }

  public revealForPlayer(playerId: string, pin: string, qIdx: number) {
    const player = this.players.get(playerId);
    if (!player) throw new Error("PLAYER_NOT_FOUND");
    if (player.pin !== pin) throw new Error("BAD_PIN");

    const quiz = this.quizzes.get(player.quiz_code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");

    const question = quiz.questions[qIdx];
    if (!question) throw new Error("BAD_QUESTION");

    const ansRecord = player.done.find(d => d.i === qIdx);

    const allPlayers = Array.from(this.players.values())
      .filter(p => p.quiz_code === quiz.code)
      .sort((a, b) => b.score - a.score || b.correct - a.correct);
    const rank = allPlayers.findIndex(p => p.id === playerId) + 1;

    return {
      answer: question.a,
      explanation: question.e || null,
      score: player.score,
      correct: player.correct,
      wrong: player.wrong,
      answered: player.answered,
      streak: player.streak,
      best_streak: player.best_streak,
      rank,
      total: allPlayers.length,
      mine: ansRecord ? { c: ansRecord.c, ok: ansRecord.ok, points: ansRecord.points } : null
    };
  }

  public getPlayerRank(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) throw new Error("PLAYER_NOT_FOUND");

    const allPlayers = Array.from(this.players.values())
      .filter(p => p.quiz_code === player.quiz_code)
      .sort((a, b) => b.score - a.score || b.correct - a.correct);
    const rank = allPlayers.findIndex(p => p.id === playerId) + 1;

    return { rank, total: allPlayers.length };
  }

  public getTopN(code: string, n: number = 3) {
    const all = Array.from(this.players.values())
      .filter(p => p.quiz_code === code)
      .sort((a, b) => b.score - a.score || b.correct - a.correct)
      .slice(0, n)
      .map(p => ({ name: p.name, score: p.score }));
    return all;
  }

  public getLeaderboard(code: string, since?: string) {
    const quizPlayers = Array.from(this.players.values())
      .filter(p => p.quiz_code === code);

    const playersData = quizPlayers.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      correct: p.correct,
      wrong: p.wrong,
      answered: p.answered,
      finished: p.finished,
      streak: p.streak
    }));

    return {
      now: new Date().toISOString(),
      players: playersData
    };
  }

  public simulateTrainees(token: string, code: string, count: number = 5) {
    if (!this.verifyAdminToken(token)) throw new Error("NOT_LOGGED_IN");
    const quiz = this.quizzes.get(code);
    if (!quiz) throw new Error("QUIZ_NOT_FOUND");

    const traineeNames = [
      "Aarav Sharma (COE Bengaluru)",
      "Priya Nair (Circle Office Chennai)",
      "Vikram Rathore (Branch Connaught Place)",
      "Ananya Deshmukh (Branch Pune Camp)",
      "Karthik Subramanian (Circle Office Hyderabad)",
      "Sunita Ghosh (Branch Kolkata Main)",
      "Rohan Verma (Branch Lucknow Central)"
    ];

    const shuffledNames = traineeNames.sort(() => Math.random() - 0.5).slice(0, count);
    const newBots: Player[] = [];

    shuffledNames.forEach((name, idx) => {
      const pid = `sim_bot_${Date.now()}_${idx}`;
      const bot: Player = {
        id: pid,
        name,
        pin: "1234",
        quiz_code: code,
        score: 0,
        correct: 0,
        wrong: 0,
        answered: 0,
        streak: 0,
        best_streak: 0,
        finished: false,
        q_order: Array.from({ length: quiz.questions.length }, (_, i) => i),
        done: [],
        fifty: [],
        fifty_used: 0,
        created_at: new Date().toISOString(),
        last_active: Date.now()
      };

      const accuracy = 0.65 + Math.random() * 0.3;
      const questionsToAnswer = quiz.settings.mode === "student"
        ? quiz.questions.length
        : Math.min(quiz.questions.length, (quiz.live?.pos || 0) + 1);

      for (let q = 0; q < questionsToAnswer; q++) {
        const question = quiz.questions[q];
        const isRight = Math.random() < accuracy;
        const choice = isRight ? question.a : (question.a + 1 + Math.floor(Math.random() * (question.o.length - 1))) % question.o.length;
        const responseMs = 3000 + Math.floor(Math.random() * 12000);
        let pts = 0;
        if (isRight) {
          pts = 1000 + Math.round((1 - responseMs / 30000) * 500);
          bot.correct++;
          bot.streak++;
          if (bot.streak > bot.best_streak) bot.best_streak = bot.streak;
        } else {
          bot.wrong++;
          bot.streak = 0;
        }
        bot.score += pts;
        bot.answered++;
        bot.done.push({ i: q, c: choice, ok: isRight, points: pts, ms: responseMs });
      }

      if (bot.answered >= quiz.questions.length) bot.finished = true;
      this.players.set(pid, bot);
      newBots.push(bot);
    });

    this.save();
    return { added: newBots.length };
  }
}

export const quizEngine = new QuizEngine();
