-- Dons en ligne (dîme, offrande, projet) par Mobile Money, sans compte obligatoire,
-- et demandes de première visite envoyées depuis l'accueil.

-- Un paiement concerne soit un contenu payant, soit un don.
ALTER TABLE payments ALTER COLUMN content_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN donation_kind text
  CHECK (donation_kind IN ('dime', 'offrande', 'projet'));
ALTER TABLE payments ADD COLUMN donor_name text;
-- Jeton (haché) remis au donateur sans compte pour suivre son paiement.
ALTER TABLE payments ADD COLUMN status_token_hash text;
ALTER TABLE payments ADD CONSTRAINT payments_purpose_chk
  CHECK ((content_id IS NOT NULL) <> (donation_kind IS NOT NULL));
CREATE INDEX IF NOT EXISTS payments_donation_idx ON payments (donation_kind, created_at DESC)
  WHERE donation_kind IS NOT NULL;

CREATE TYPE visit_status AS ENUM ('new', 'welcomed', 'archived');

CREATE TABLE visits (
  id         text PRIMARY KEY DEFAULT gen_object_id(),
  user_id    text REFERENCES users (id) ON DELETE SET NULL,
  name       text NOT NULL,
  phone      text,
  day        text NOT NULL CHECK (day IN ('mer', 'ven', 'dim')),
  status     visit_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visits_created_idx ON visits (created_at DESC);
