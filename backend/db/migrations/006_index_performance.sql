-- Index pour les listes et compteurs les plus appelés (accélère les pages
-- publiques et l'administration quand les tables grossissent).

-- Liste des contenus sans filtre de type (accueil, recherche) et titres.
CREATE INDEX IF NOT EXISTS contents_created_idx ON contents (created_at DESC);

-- Administration : listes triées par date.
CREATE INDEX IF NOT EXISTS users_created_idx ON users (created_at DESC);
CREATE INDEX IF NOT EXISTS payments_created_idx ON payments (created_at DESC);
-- Vérification « contenu déjà acheté » avant suppression.
CREATE INDEX IF NOT EXISTS payments_content_status_idx ON payments (content_id, status);

-- Médiathèque : nombre de sermons par série, épisodes et communiqués publiés.
CREATE INDEX IF NOT EXISTS sermons_series_idx ON sermons (series_id) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS podcasts_published_idx ON podcasts (published_at DESC) WHERE is_published;
CREATE INDEX IF NOT EXISTS press_published_idx ON press_releases (published_at DESC) WHERE is_published;
