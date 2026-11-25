-- Médiathèque complète : bibliothèque de messages (passages, chapitres, page par
-- message), publication programmée, podcast, galerie reliée aux événements,
-- direct vivant (discussion, prière, appels à l'action, archivage).

-- Messages
ALTER TABLE sermons
  ADD COLUMN slug             text,
  ADD COLUMN scriptures       text   NOT NULL DEFAULT '',   -- « Jean 3:16-18 ; Romains 8 »
  ADD COLUMN bible_books      text[] NOT NULL DEFAULT '{}', -- livres normalisés, pour le filtre
  ADD COLUMN chapters         jsonb  NOT NULL DEFAULT '[]', -- [{ "t": secondes, "label": "…" }]
  ADD COLUMN duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  ADD COLUMN audio_bytes      bigint  CHECK (audio_bytes IS NULL OR audio_bytes >= 0);
UPDATE sermons SET slug = 'message-' || id WHERE slug IS NULL;
ALTER TABLE sermons ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX sermons_slug_uq ON sermons (slug);
CREATE INDEX sermons_books_idx ON sermons USING gin (bible_books);
CREATE INDEX sermons_public_idx ON sermons (sermon_date DESC) WHERE is_published;

ALTER TABLE podcasts
  ADD COLUMN duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  ADD COLUMN audio_bytes      bigint  CHECK (audio_bytes IS NULL OR audio_bytes >= 0);

-- Galerie reliée à un événement
ALTER TABLE gallery_albums ADD COLUMN event_id text REFERENCES events (id) ON DELETE SET NULL;

-- Direct vivant
ALTER TABLE live_streams
  ADD COLUMN chat_enabled       boolean NOT NULL DEFAULT true,
  ADD COLUMN prayer_enabled     boolean NOT NULL DEFAULT true,
  ADD COLUMN archived_sermon_id text REFERENCES sermons (id) ON DELETE SET NULL;

CREATE TABLE live_chat_messages (
  id         text PRIMARY KEY DEFAULT gen_object_id(),
  stream_id  text NOT NULL REFERENCES live_streams (id) ON DELETE CASCADE,
  user_id    text REFERENCES users (id) ON DELETE SET NULL,
  name       text NOT NULL,
  body       text NOT NULL,
  is_host    boolean NOT NULL DEFAULT false,  -- message de l'équipe (mis en valeur)
  is_hidden  boolean NOT NULL DEFAULT false,  -- masqué par la modération
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_chat_stream_idx ON live_chat_messages (stream_id, created_at);

CREATE TYPE prayer_status AS ENUM ('new', 'praying', 'answered', 'archived');
CREATE TABLE prayer_requests (
  id         text PRIMARY KEY DEFAULT gen_object_id(),
  stream_id  text REFERENCES live_streams (id) ON DELETE SET NULL,
  user_id    text REFERENCES users (id) ON DELETE SET NULL,
  name       text NOT NULL,
  phone      text NOT NULL DEFAULT '',
  request    text NOT NULL,
  wants_call boolean NOT NULL DEFAULT false,
  status     prayer_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prayer_requests_created_idx ON prayer_requests (created_at DESC);

-- Appels à l'action pendant un direct (un seul actif à la fois par direct).
CREATE TYPE moment_kind AS ENUM ('give', 'event', 'salvation', 'link');
CREATE TABLE live_moments (
  id           text PRIMARY KEY DEFAULT gen_object_id(),
  stream_id    text NOT NULL REFERENCES live_streams (id) ON DELETE CASCADE,
  kind         moment_kind NOT NULL,
  title        text NOT NULL,
  body         text NOT NULL DEFAULT '',
  button_label text NOT NULL DEFAULT '',
  url          text,
  event_id     text REFERENCES events (id) ON DELETE SET NULL,
  is_active    boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_moments_stream_idx ON live_moments (stream_id);

-- « J'ai donné ma vie à Christ » : suivi par l'équipe pastorale.
CREATE TABLE faith_decisions (
  id            text PRIMARY KEY DEFAULT gen_object_id(),
  stream_id     text REFERENCES live_streams (id) ON DELETE SET NULL,
  user_id       text REFERENCES users (id) ON DELETE SET NULL,
  name          text NOT NULL,
  phone         text NOT NULL DEFAULT '',
  wants_contact boolean NOT NULL DEFAULT true,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'archived')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX faith_decisions_created_idx ON faith_decisions (created_at DESC);
