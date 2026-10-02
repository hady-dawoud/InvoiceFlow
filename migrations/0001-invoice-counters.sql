CREATE TABLE IF NOT EXISTS invoice_monthly_usage (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);
CREATE TABLE IF NOT EXISTS invoice_sequences (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year)
);
