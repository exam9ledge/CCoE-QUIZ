export const ERR_MAP: Record<string, string> = {
  QUIZ_NOT_FOUND: "No quiz found with this 6-digit code. Please check the code shown on the screen.",
  NAME_TAKEN: "This name is already registered with a different PIN. Enter your original PIN or use your full name.",
  QUIZ_ENDED: "This quiz session has already ended.",
  BAD_NAME: "Please enter your name (minimum 2 characters).",
  BAD_PIN_FORMAT: "PIN must be exactly 4 numeric digits.",
  BAD_PIN: "PIN does not match the registered trainee profile. Please rejoin.",
  PLAYER_NOT_FOUND: "Trainee profile was not found. Please join again.",
  REMOVED: "Your entry was reset by the trainer.",
  QUIZ_NOT_LIVE: "The quiz is not currently accepting answers.",
  RESTART_DISABLED: "Restarting has been disabled for this training quiz.",
  BAD_LOGIN: "Invalid administrator username or password.",
  TOO_MANY_ATTEMPTS: "Too many attempts. Please wait 5 minutes.",
  NOT_LOGGED_IN: "Your session has expired. Please log in again.",
  BAD_OLD_PASSWORD: "The current password entered is incorrect.",
  WEAK_PASSWORD: "New password must be at least 8 characters long.",
  HAS_PLAYERS: "Trainees have already joined this session. Reset the session first to modify questions.",
  QUESTION_CLOSED: "Time is up for this question.",
  NO_LIFELINES: "No 50:50 lifelines remaining.",
  ALREADY_ANSWERED: "You have already submitted your answer for this question.",
  FIFTY_NOT_POSSIBLE: "50:50 lifeline requires at least 3 available options.",
  JOIN_LOCKED: "The trainer has locked joining for this session.",
  NOT_REVEALED: "The correct answer has not been revealed yet.",
  BAD_QUESTION: "Question format is invalid.",
  NO_QUESTIONS: "No valid questions were found in the uploaded file."
};

export function getErrorMessage(err: any): string {
  if (!err) return "An unexpected error occurred.";
  const msg = err.message || String(err);
  return ERR_MAP[msg] || msg;
}

export const storage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  del(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
};

export async function api<T = any>(fn: string, args: Record<string, any> = {}): Promise<T> {
  const response = await fetch(`/api/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const error = new Error(data?.message || `HTTP ${response.status}`);
    throw error;
  }

  return data as T;
}

export function triggerConfetti(durationMs: number = 3000) {
  let canvas = document.getElementById('coe-confetti-canvas') as HTMLCanvasElement;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'coe-confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);
  }

  canvas.style.display = 'block';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const colors = ['#fbbf24', '#22c55e', '#3b82f6', '#ec4899', '#a855f7', '#f97316', '#eab308'];
  const particles = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.4,
    r: 4 + Math.random() * 6,
    vx: -2 + Math.random() * 4,
    vy: 2.5 + Math.random() * 4.5,
    a: Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));

  const startTime = performance.now();
  function animate(now: number) {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.a += 0.08;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.restore();
    });

    if (now - startTime < durationMs) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = 'none';
    }
  }

  requestAnimationFrame(animate);
}
