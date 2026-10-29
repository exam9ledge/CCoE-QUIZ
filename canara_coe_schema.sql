-- ============================================================================
-- Canara COE Knowledge Challenge – Independent PostgreSQL / Supabase Schema
-- Trainer: Punit Dhull | Senior Manager
-- Institution: Canara Centre of Excellence
-- ============================================================================

-- 1. Quizzes Table
CREATE TABLE IF NOT EXISTS public.coe_quizzes (
    code VARCHAR(6) PRIMARY KEY,
    title TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'live', 'paused', 'ended')),
    settings JSONB NOT NULL DEFAULT '{"mode": "student", "shuffle": true, "timerAll": 30, "lifelines": 2, "showExplanation": true, "allowRestart": true, "locked": false}'::jsonb,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    live JSONB NOT NULL DEFAULT '{"phase": "lobby", "q": 0, "pos": 0, "seq": 1}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Participants / Trainees Table
CREATE TABLE IF NOT EXISTS public.coe_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_code VARCHAR(6) NOT NULL REFERENCES public.coe_quizzes(code) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    pin VARCHAR(4) NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    wrong INTEGER NOT NULL DEFAULT 0,
    answered INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    finished BOOLEAN NOT NULL DEFAULT FALSE,
    q_order JSONB NOT NULL DEFAULT '[]'::jsonb,
    done JSONB NOT NULL DEFAULT '[]'::jsonb,
    fifty JSONB NOT NULL DEFAULT '[]'::jsonb,
    fifty_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_name_per_quiz UNIQUE (quiz_code, name)
);

-- 3. Administrator Table
CREATE TABLE IF NOT EXISTS public.coe_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    must_change BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Admin Session Tokens
CREATE TABLE IF NOT EXISTS public.coe_admin_tokens (
    token VARCHAR(64) PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Indexes for lightning fast live leaderboards and lookup
CREATE INDEX IF NOT EXISTS idx_coe_players_quiz_score ON public.coe_players (quiz_code, score DESC, correct DESC);
CREATE INDEX IF NOT EXISTS idx_coe_players_lookup ON public.coe_players (quiz_code, name);
CREATE INDEX IF NOT EXISTS idx_coe_quizzes_status ON public.coe_quizzes (status);

-- Security: Enable Row Level Security (RLS)
ALTER TABLE public.coe_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coe_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coe_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coe_admin_tokens ENABLE ROW LEVEL SECURITY;

-- Note: The built-in Express server provides server-side answer hiding and scoring
-- without requiring an external Supabase instance. If deploying on Supabase directly,
-- the equivalent RPC functions (qb_quiz_state, qb_join, qb_submit, etc.) can be
-- executed using the security-definer pattern.
