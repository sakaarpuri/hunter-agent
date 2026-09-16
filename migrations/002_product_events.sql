CREATE TABLE IF NOT EXISTS product_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_events_user_time ON product_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_name_time ON product_events(event_name, occurred_at DESC);
ALTER TABLE product_events ENABLE ROW LEVEL SECURITY;

