-- =====================================================================
-- ManLab App — Esquema PostgreSQL (handoff dev)
-- Versión 2.0 · Ejecutable. Correr contra una base limpia.
-- Convención: todas las tablas con created_at / updated_at donde aplica.
-- Llaves foráneas con ON DELETE razonado.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- email case-insensitive

-- ---------------------------------------------------------------------
-- 1. USUARIOS Y DERECHOS
-- ---------------------------------------------------------------------

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT UNIQUE NOT NULL,
  display_name    TEXT,
  country         TEXT,                       -- registro/voz y conciliación de pago
  password_hash   TEXT,                       -- null si solo magic link
  role            TEXT NOT NULL DEFAULT 'user' -- 'user' | 'admin'
                  CHECK (role IN ('user','admin')),
  onesignal_player_id TEXT,                    -- push (último device registrado)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una suscripción por usuario (la vigente). Histórico se conserva por filas.
CREATE TABLE subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID REFERENCES users(id) ON DELETE CASCADE,
  source                 TEXT NOT NULL CHECK (source IN ('stripe','manual')),
  plan_code              TEXT CHECK (plan_code IN ('mensual','anual','fundador')),
  price_locked           BOOLEAN NOT NULL DEFAULT false,   -- fundador = true
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  status                 TEXT NOT NULL DEFAULT 'none'
                         CHECK (status IN ('active','past_due','canceled','none')),
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user        ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_cust ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status      ON subscriptions(status);

-- NOTA: entitlement_status del usuario se DERIVA de la subscription vigente.
--       active si status='active' Y (current_period_end IS NULL OR > now()).

-- ---------------------------------------------------------------------
-- 1b. PENDING ENTITLEMENTS  (caso "pagó con un email, se registró con otro")
--     Si llega un pago de Stripe y NO existe user con ese email todavía,
--     se guarda aquí. Al registrarse/verificar un email que coincida,
--     se materializa la subscription. Admin puede relincar manualmente.
-- ---------------------------------------------------------------------

CREATE TABLE pending_entitlements (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  CITEXT NOT NULL,
  source                 TEXT NOT NULL CHECK (source IN ('stripe','manual')),
  plan_code              TEXT,
  price_locked           BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  current_period_end     TIMESTAMPTZ,
  resolved               BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pending_email ON pending_entitlements(email) WHERE resolved = false;

-- ---------------------------------------------------------------------
-- 2. RETO 100 DE 100 — EDICIÓN HIERRO  (núcleo del MOAT)
--    5 frentes FIJOS, no renombrar: intelectual, espiritual, fisico,
--    economico, social_atraccion (etiqueta visible "Social / Atracción").
-- ---------------------------------------------------------------------

CREATE TABLE reto_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  edition     TEXT NOT NULL DEFAULT 'HIERRO',
  start_date  DATE NOT NULL,
  day_index   INT  NOT NULL DEFAULT 1,        -- día actual 1..100
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','completed','broken')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_enrollments_user ON reto_enrollments(user_id);

-- Una fila por día por usuario.
CREATE TABLE reto_daily_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id       UUID REFERENCES reto_enrollments(id) ON DELETE CASCADE,
  log_date            DATE NOT NULL,
  day_index           INT  NOT NULL,          -- 1..100
  f_intelectual       BOOLEAN NOT NULL DEFAULT false,
  f_espiritual        BOOLEAN NOT NULL DEFAULT false,
  f_fisico            BOOLEAN NOT NULL DEFAULT false,
  f_economico         BOOLEAN NOT NULL DEFAULT false,
  f_social_atraccion  BOOLEAN NOT NULL DEFAULT false,
  note                TEXT,                    -- bitácora libre (la lee el Veredicto)
  is_complete         BOOLEAN GENERATED ALWAYS AS   -- 100% o nada
                      (f_intelectual AND f_espiritual AND f_fisico
                       AND f_economico AND f_social_atraccion) STORED,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, log_date)
);
CREATE INDEX idx_logs_enrollment_date ON reto_daily_logs(enrollment_id, log_date);

CREATE TABLE reto_verdicts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id    UUID REFERENCES reto_enrollments(id) ON DELETE CASCADE,
  generated_for_day INT NOT NULL,
  weak_link        TEXT,                       -- frente más fallado en la ventana
  verdict_text     TEXT NOT NULL,              -- texto en voz de Master (salida LLM)
  trigger          TEXT,                       -- 'manual' | 'racha_rota' | 'eslabon_persistente'
  llm_provider     TEXT,                       -- observabilidad: 'anthropic' | 'openai'
  llm_cost_usd     NUMERIC(10,6),              -- costo por llamada
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_verdicts_enrollment ON reto_verdicts(enrollment_id);

-- NOTA: el análisis de químicos sanguíneos NO se modela aquí.
--       Se maneja FUERA de la app (correo + lectura en vivo con Master).

-- ---------------------------------------------------------------------
-- 3. CONTENIDO  (libros, audiolibros, videos, consejo del día)
-- ---------------------------------------------------------------------

CREATE TABLE books (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  language    TEXT NOT NULL CHECK (language IN ('es','en')),
  epub_url    TEXT NOT NULL,                  -- EPUB en storage protegido
  cover_url   TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audiobooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  language    TEXT NOT NULL CHECK (language IN ('es','en')),
  audio_url   TEXT NOT NULL,                  -- M4B/MP3 en storage protegido (signed URL)
  cover_url   TEXT,
  chapters    JSONB,                          -- [{title, start_seconds}]
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE videos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  bunny_video_id TEXT NOT NULL,               -- id en Bunny/Mux
  category       TEXT,                         -- módulo de UDH
  duration_s     INT,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_videos_category ON videos(category);

CREATE TABLE daily_tips (              -- "Consejo del día"
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body      TEXT NOT NULL,
  active    BOOLEAN NOT NULL DEFAULT true,
  shown_on  DATE,                       -- opcional: programación
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. HERMANDAD, RANGOS, PROGRESO DE CONTENIDO
-- ---------------------------------------------------------------------

CREATE TABLE accountability_pairs (    -- parejas de responsabilidad del Reto
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     UUID REFERENCES users(id) ON DELETE CASCADE,
  user_b     UUID REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','dissolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ranks (                   -- rangos por racha (estatus "Hombre en obra")
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  min_streak INT  NOT NULL,            -- racha mínima para alcanzarlo
  sort_order INT  NOT NULL DEFAULT 0
);

CREATE TABLE content_progress (        -- avance de lectura/escucha/video
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT CHECK (content_type IN ('book','audiobook','video')),
  content_id   UUID,
  position     JSONB,                  -- {cfi} libro, {seconds} audio/video
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_type, content_id)
);

-- ---------------------------------------------------------------------
-- 5. NOTIFICACIONES Y DUNNING (observabilidad / admin)
-- ---------------------------------------------------------------------

CREATE TABLE notifications_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT,                    -- 'reto_reminder'|'verdict'|'live'|'new_video'|'broadcast'|'dunning'
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,  -- null si broadcast
  payload     JSONB,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dunning_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  state        TEXT,                   -- 'failed'|'retry_scheduled'|'recovered'|'lost'
  attempt      INT DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dunning_user ON dunning_events(user_id);

-- ---------------------------------------------------------------------
-- 6. CONFIG DE PRECIOS (editable desde admin, no hardcodear)
-- ---------------------------------------------------------------------

CREATE TABLE plan_config (
  plan_code      TEXT PRIMARY KEY CHECK (plan_code IN ('mensual','anual','fundador')),
  stripe_price_id TEXT,
  amount_usd     NUMERIC(10,2) NOT NULL,
  interval       TEXT NOT NULL,        -- 'month' | 'year'
  is_public      BOOLEAN NOT NULL DEFAULT true,
  highlighted    BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- SEEDS (valores cerrados — Anexo A del documento de build)
-- =====================================================================

INSERT INTO plan_config (plan_code, amount_usd, interval, is_public, highlighted) VALUES
  ('mensual',  39.00, 'month', true,  false),
  ('anual',   349.00, 'year',  true,  true ),   -- destacado en checkout
  ('fundador', 29.00, 'month', false, false);   -- NO público: win-back + migración Clon

-- Rangos "Hombre en obra" (ajustables; estatus ganado, no gamificación blanda)
INSERT INTO ranks (name, min_streak, sort_order) VALUES
  ('Hombre en obra',      1,   1),
  ('Hombre en forja',     14,  2),
  ('Hombre en hierro',    33,  3),
  ('Hombre templado',     66,  4),
  ('Hombre de acero',     100, 5);
