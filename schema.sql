-- ──────────────────────────────────────────────────────────────────────────────
-- Portfolio Tracker — schema Supabase
-- Esegui questo SQL in Supabase → SQL Editor → New query → Run
-- ──────────────────────────────────────────────────────────────────────────────

-- Tabella transazioni
CREATE TABLE IF NOT EXISTS transactions (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date        DATE    NOT NULL,
  type        TEXT    NOT NULL CHECK (type IN ('Acquisto', 'Vendita')),
  ticker      TEXT    NOT NULL,
  name        TEXT,
  cls         TEXT,
  qty         NUMERIC NOT NULL,
  price       NUMERIC NOT NULL,
  fees        NUMERIC DEFAULT 0,
  currency    TEXT    DEFAULT 'EUR',
  broker      TEXT,
  isin        TEXT,
  note        TEXT,
  aliquota    TEXT,
  exchange    TEXT    DEFAULT '',
  fx_rate     NUMERIC DEFAULT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "utenti vedono le proprie transazioni" ON transactions
  FOR ALL USING (auth.uid() = user_id);

-- Migrazione: aggiungi fx_rate se la tabella esiste già
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fx_rate NUMERIC DEFAULT NULL;

-- Tabella asset custom (ticker non presenti in MARKET_DATA)
CREATE TABLE IF NOT EXISTS custom_assets (
  id       UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id  UUID  REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker   TEXT  NOT NULL,
  name     TEXT  NOT NULL,
  cls      TEXT  NOT NULL,
  price    NUMERIC DEFAULT 0,
  day      NUMERIC DEFAULT 0,
  isin     TEXT    DEFAULT '',
  UNIQUE (user_id, ticker)
);

ALTER TABLE custom_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "utenti vedono i propri asset custom" ON custom_assets
  FOR ALL USING (auth.uid() = user_id);
