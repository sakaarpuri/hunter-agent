CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ip_address TEXT
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;

CREATE TABLE IF NOT EXISTS workspaces (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_update_leases (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lease_token TEXT NOT NULL,
  lease_until TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discovery_search_cache (
  cache_key TEXT PRIMARY KEY,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
  lease_token TEXT,
  lease_until TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discovery_credit_usage (
  scope TEXT NOT NULL,
  credit_day DATE NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  PRIMARY KEY (scope, credit_day)
);

CREATE TABLE IF NOT EXISTS discovery_user_runs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_response_cache (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,
  response_text TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
  lease_token TEXT,
  lease_until TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cache_key)
);

CREATE TABLE IF NOT EXISTS ai_budget_usage (
  scope TEXT NOT NULL,
  budget_day DATE NOT NULL,
  cents BIGINT NOT NULL DEFAULT 0 CHECK (cents >= 0 AND cents <= 9007199254740991),
  PRIMARY KEY (scope, budget_day)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_token_hash ON password_reset_tokens(token_hash);
DELETE FROM password_reset_tokens older
USING password_reset_tokens newer
WHERE older.user_id = newer.user_id
  AND (older.created_at < newer.created_at OR (older.created_at = newer.created_at AND older.id < newer.id));
CREATE UNIQUE INDEX IF NOT EXISTS idx_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_updated_at ON auth_rate_limits(updated_at);
CREATE INDEX IF NOT EXISTS idx_discovery_cache_expiry ON discovery_search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_discovery_credit_day ON discovery_credit_usage(credit_day);
CREATE INDEX IF NOT EXISTS idx_ai_cache_updated_at ON ai_response_cache(updated_at);
CREATE INDEX IF NOT EXISTS idx_ai_budget_day ON ai_budget_usage(budget_day);

ALTER TABLE workspace_update_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_credit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_user_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_response_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_budget_usage ENABLE ROW LEVEL SECURITY;
