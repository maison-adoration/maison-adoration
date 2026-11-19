-- Récupération de mot de passe par e-mail + invalidation des connexions
-- ouvertes quand le mot de passe change.

ALTER TABLE users ADD COLUMN password_changed_at timestamptz;

CREATE TABLE password_resets (
  id         text PRIMARY KEY DEFAULT gen_object_id(),
  user_id    text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Seule l'empreinte SHA-256 du jeton est gardée : une fuite de la base ne permet pas de l'utiliser.
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_idx ON password_resets (user_id, created_at DESC);
