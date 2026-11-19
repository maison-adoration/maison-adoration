-- Les paiements sont un historique financier : supprimer un compte ne doit plus les effacer.
-- Le lien vers le membre devient vide, et l'e-mail du payeur est conservé dans le paiement.

ALTER TABLE payments ADD COLUMN payer_email text;
UPDATE payments p SET payer_email = u.email FROM users u WHERE u.id = p.user_id;

ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE payments DROP CONSTRAINT payments_user_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL;
