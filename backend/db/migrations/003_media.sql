-- Module média (réécrit d'après le rôle « média » du projet MAN Platform) :
-- sermons et séries, galerie photo, podcasts, communiqués de presse, directs.
-- Le studio et les cours en direct de MAN Platform reposent sur LiveKit : non repris ici.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'media';

CREATE TYPE stream_platform AS ENUM ('youtube', 'facebook', 'custom');
CREATE TYPE stream_type     AS ENUM ('culte', 'conference', 'prayer', 'cours');

CREATE TABLE sermon_series (
  id              text PRIMARY KEY DEFAULT gen_object_id(),
  name            text NOT NULL,
  description     text NOT NULL DEFAULT '',
  cover_image_url text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER sermon_series_updated_at BEFORE UPDATE ON sermon_series
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE sermons (
  id            text PRIMARY KEY DEFAULT gen_object_id(),
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  preacher      text NOT NULL DEFAULT '',
  sermon_date   date NOT NULL DEFAULT current_date,
  video_url     text,
  audio_url     text,
  pdf_url       text,
  thumbnail_url text,
  series_id     text REFERENCES sermon_series (id) ON DELETE SET NULL,
  is_published  boolean NOT NULL DEFAULT false,
  is_featured   boolean NOT NULL DEFAULT false,
  views_count   integer NOT NULL DEFAULT 0,
  published_at  timestamptz,
  created_by_id text REFERENCES users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sermons_published_date_idx ON sermons (is_published, sermon_date DESC);
CREATE TRIGGER sermons_updated_at BEFORE UPDATE ON sermons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE gallery_albums (
  id              text PRIMARY KEY DEFAULT gen_object_id(),
  title           text NOT NULL,
  description     text NOT NULL DEFAULT '',
  event_date      date,
  cover_image_url text,
  is_published    boolean NOT NULL DEFAULT false,
  published_at    timestamptz,
  created_by_id   text REFERENCES users (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER gallery_albums_updated_at BEFORE UPDATE ON gallery_albums
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE gallery_photos (
  id         text PRIMARY KEY DEFAULT gen_object_id(),
  album_id   text NOT NULL REFERENCES gallery_albums (id) ON DELETE CASCADE,
  url        text NOT NULL,
  caption    text NOT NULL DEFAULT '',
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gallery_photos_album_idx ON gallery_photos (album_id, position);

CREATE TABLE podcasts (
  id             text PRIMARY KEY DEFAULT gen_object_id(),
  title          text NOT NULL,
  description    text NOT NULL DEFAULT '',
  audio_url      text NOT NULL,
  thumbnail_url  text,
  season_number  integer NOT NULL DEFAULT 1 CHECK (season_number > 0),
  episode_number integer CHECK (episode_number > 0),
  is_published   boolean NOT NULL DEFAULT false,
  published_at   timestamptz,
  plays_count    integer NOT NULL DEFAULT 0,
  created_by_id  text REFERENCES users (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER podcasts_updated_at BEFORE UPDATE ON podcasts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE press_releases (
  id              text PRIMARY KEY DEFAULT gen_object_id(),
  title           text NOT NULL,
  excerpt         text NOT NULL DEFAULT '',
  content         text NOT NULL,
  cover_image_url text,
  tags            text[] NOT NULL DEFAULT '{}',
  is_published    boolean NOT NULL DEFAULT false,
  published_at    timestamptz,
  created_by_id   text REFERENCES users (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER press_releases_updated_at BEFORE UPDATE ON press_releases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Directs diffusés sur YouTube / Facebook (ou autre lien) et annoncés sur le site.
CREATE TABLE live_streams (
  id            text PRIMARY KEY DEFAULT gen_object_id(),
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  platform      stream_platform NOT NULL DEFAULT 'youtube',
  type          stream_type NOT NULL DEFAULT 'culte',
  stream_url    text,
  thumbnail_url text,
  scheduled_at  timestamptz,
  is_live       boolean NOT NULL DEFAULT false,
  started_at    timestamptz,
  ended_at      timestamptz,
  recording_url text,
  created_by_id text REFERENCES users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_streams_schedule_idx ON live_streams (is_live, scheduled_at);
CREATE TRIGGER live_streams_updated_at BEFORE UPDATE ON live_streams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
