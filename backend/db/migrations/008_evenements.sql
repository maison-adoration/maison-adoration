-- Événements annoncés sur le site : entrée libre ou sur inscription.

CREATE TYPE event_registration_mode AS ENUM ('none', 'required');
CREATE TYPE event_registration_status AS ENUM ('registered', 'attended', 'cancelled');

CREATE TABLE events (
  id                    text PRIMARY KEY DEFAULT gen_object_id(),
  title                 text NOT NULL,
  description           text NOT NULL DEFAULT '',
  location              text NOT NULL DEFAULT '',
  starts_at             timestamptz NOT NULL,
  ends_at               timestamptz,
  image_url             text,
  -- none : entrée libre, aucun formulaire ; required : les visiteurs s'inscrivent.
  registration_mode     event_registration_mode NOT NULL DEFAULT 'none',
  capacity              integer CHECK (capacity IS NULL OR capacity > 0),
  registration_deadline timestamptz,
  is_published          boolean NOT NULL DEFAULT false,
  -- Annoncé sur l'accueil (le plus proche des événements mis en avant).
  is_featured           boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX events_upcoming_idx ON events (starts_at) WHERE is_published;

CREATE TABLE event_registrations (
  id         text PRIMARY KEY DEFAULT gen_object_id(),
  event_id   text NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id    text REFERENCES users (id) ON DELETE SET NULL,
  name       text NOT NULL,
  phone      text NOT NULL,
  email      text NOT NULL DEFAULT '',
  -- Nombre de personnes venant avec cette inscription (lui compris).
  seats      integer NOT NULL DEFAULT 1 CHECK (seats BETWEEN 1 AND 10),
  status     event_registration_status NOT NULL DEFAULT 'registered',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Un même numéro ne s'inscrit qu'une fois par événement.
CREATE UNIQUE INDEX event_registrations_phone_uq ON event_registrations (event_id, phone);
CREATE INDEX event_registrations_event_idx ON event_registrations (event_id, created_at DESC);
