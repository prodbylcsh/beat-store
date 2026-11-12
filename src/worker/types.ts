export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  APP_ENV: 'development' | 'test' | 'production';
  APP_ORIGIN: string;
  CURRENCY: string;
  LEMON_STORE_ID: string;
  LEMON_VARIANT_WAV: string;
  LEMON_VARIANT_STEMS: string;
  LEMON_VARIANT_EXCLUSIVE: string;
  LEMON_VARIANT_SERVICE: string;
  LEMONSQUEEZY_API_KEY?: string;
  LEMONSQUEEZY_WEBHOOK_SECRET?: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  NOTIFY_WEBHOOK_URL?: string;
}

export interface BeatRow {
  id: string; slug: string; title: string; bpm: number; musical_key: string; genre: string;
  duration_sec: number; peaks: string; seed: number;
  price_wav: number; price_stems: number; price_exclusive: number;
  preview_key: string | null; wav_key: string | null; wav_name: string | null;
  stems_key: string | null; stems_name: string | null;
  status: 'draft' | 'active' | 'sold'; sort_order: number; created_at: string; updated_at: string;
}

export interface IntentRow {
  id: string; token_hash: string; kind: 'license' | 'service'; beat_id: string | null;
  license: 'wav' | 'stems' | 'exclusive' | null; service_order_id: string | null;
  lemon_variant_id: string; price_minor: number; currency: string; artist_name: string;
  lang: string; status: string; created_at: string; expires_at: string;
}

export interface OrderRow {
  id: string; lemon_order_id: string; lemon_subscription_id: string | null; order_number: string | null;
  checkout_intent_id: string | null; kind: string; beat_id: string | null; beat_title: string | null;
  license: 'wav' | 'stems' | 'exclusive' | null; buyer_email: string | null; buyer_name: string | null;
  artist_name: string | null; currency: string | null; total_minor: number | null;
  payment_status: string; license_status: string; term_started_at: string | null; term_ends_at: string | null;
  needs_review: number; note: string; is_test: number; created_at: string; updated_at: string;
}
