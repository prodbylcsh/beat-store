PRAGMA foreign_keys = ON;

CREATE TABLE beats (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  bpm INTEGER NOT NULL CHECK (bpm BETWEEN 30 AND 300),
  musical_key TEXT NOT NULL,            -- např. "F#m", "C"
  genre TEXT NOT NULL,
  duration_sec REAL NOT NULL DEFAULT 0,
  peaks TEXT NOT NULL DEFAULT '',       -- base64 (Uint8) obálka waveformu, z ní se generuje artwork
  seed INTEGER NOT NULL DEFAULT 0,      -- otisk zvuku pro generativní vzhled desky
  price_wav INTEGER NOT NULL CHECK (price_wav >= 0),
  price_stems INTEGER NOT NULL CHECK (price_stems >= 0),
  price_exclusive INTEGER NOT NULL CHECK (price_exclusive >= 0),
  preview_key TEXT,                     -- R2: veřejná ukázka (MP3)
  wav_key TEXT,                         -- R2: soukromý WAV
  wav_name TEXT,
  stems_key TEXT,                       -- R2: soukromý ZIP se stopami
  stems_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'sold')),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE checkout_intents (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,      -- SHA-256 tajného tokenu objednávky (token sám se neukládá)
  kind TEXT NOT NULL CHECK (kind IN ('license', 'service')),
  beat_id TEXT REFERENCES beats(id),
  license TEXT CHECK (license IN ('wav', 'stems', 'exclusive')),
  service_order_id TEXT,
  lemon_variant_id TEXT NOT NULL,
  price_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  artist_name TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT 'cs',
  ip_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'expired', 'failed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  lemon_order_id TEXT NOT NULL UNIQUE,
  lemon_subscription_id TEXT,
  order_number TEXT,
  checkout_intent_id TEXT REFERENCES checkout_intents(id),
  kind TEXT NOT NULL DEFAULT 'license',
  beat_id TEXT REFERENCES beats(id),
  beat_title TEXT,
  license TEXT,
  buyer_email TEXT,
  buyer_name TEXT,
  artist_name TEXT,
  currency TEXT,
  total_minor INTEGER,
  payment_status TEXT NOT NULL,         -- paid | refunded | partial_refund
  license_status TEXT NOT NULL DEFAULT 'active', -- active | cancelled (doběhne) | expired | revoked
  term_started_at TEXT,
  term_ends_at TEXT,                    -- NULL = bez časového omezení (exclusive)
  needs_review INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  is_test INTEGER NOT NULL CHECK (is_test IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE service_orders (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL CHECK (service IN ('mix', 'master', 'mixmaster')),
  songs INTEGER NOT NULL DEFAULT 1,
  addons TEXT NOT NULL DEFAULT '[]',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  project TEXT NOT NULL DEFAULT '',
  files_url TEXT NOT NULL DEFAULT '',
  reference_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  price_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'cs',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'paid', 'in_progress', 'done', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,                  -- SHA-256 syrového těla
  event_type TEXT NOT NULL,
  lemon_order_id TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  processing_status TEXT NOT NULL DEFAULT 'received',
  detail TEXT NOT NULL DEFAULT ''
);

CREATE TABLE rate_limits (
  bucket TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL
);

CREATE INDEX idx_beats_status_sort ON beats(status, sort_order, created_at);
CREATE INDEX idx_intents_beat ON checkout_intents(beat_id);
CREATE INDEX idx_intents_created ON checkout_intents(created_at);
CREATE INDEX idx_orders_intent ON orders(checkout_intent_id);
CREATE INDEX idx_orders_beat ON orders(beat_id, license_status);
CREATE INDEX idx_orders_sub ON orders(lemon_subscription_id);
CREATE INDEX idx_orders_email ON orders(buyer_email);
CREATE INDEX idx_webhook_order ON webhook_events(lemon_order_id);
CREATE INDEX idx_service_created ON service_orders(created_at);
