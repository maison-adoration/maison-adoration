#!/usr/bin/env node
// Comptes de démonstration, un par rôle, pour présenter ou tester la plateforme.
//
//   npm run demo:accounts                 crée ou réinitialise les 4 comptes
//   npm run demo:accounts -- --remove     supprime les comptes de démonstration
//
// Les mots de passe sont tirés au hasard à chaque exécution et affichés une
// seule fois (ils ne sont enregistrés nulle part en clair). Pour imposer un
// mot de passe commun : DEMO_PASSWORD=... npm run demo:accounts
//
// Sur un serveur de production (NODE_ENV=production), il faut ajouter
// --production : un compte super-admin de démonstration y donne accès à tout.
require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const ACCOUNTS = [
  { role: 'user', email: 'demo.membre@man.test', name: 'Démo Membre', space: 'Mon espace (contenus, profil, dons)' },
  { role: 'media', email: 'demo.media@man.test', name: 'Démo Équipe média', space: 'Médiathèque : messages, directs, régie, galerie' },
  { role: 'admin', email: 'demo.admin@man.test', name: "Démo Gestion de l'église", space: "Gestion de l'église (/adm)" },
  { role: 'super-admin', email: 'demo.superadmin@man.test', name: 'Démo Administration système', space: 'Gestion + Administration du système (/systeme)' },
];
const LABEL = { user: 'Membre', media: 'Équipe média', admin: "Gestion de l'église", 'super-admin': 'Administration du système' };

// 14 caractères lisibles (sans 0/O, 1/l/I) : faciles à recopier pendant une démo.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const randomPassword = () =>
  Array.from(crypto.randomBytes(14), (b) => ALPHABET[b % ALPHABET.length]).join('').replace(/^(.{4})(.{5})(.{5})$/, '$1-$2-$3');

(async () => {
  const args = process.argv.slice(2);
  const remove = args.includes('--remove');
  if (process.env.NODE_ENV === 'production' && !remove && !args.includes('--production')) {
    console.error('❌ Serveur de production : relancez avec --production si vous voulez vraiment des comptes de démonstration ici.');
    process.exit(1);
  }
  const fixed = process.env.DEMO_PASSWORD;
  if (fixed && fixed.length < 8) throw new Error('DEMO_PASSWORD doit faire au moins 8 caractères');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: ['true', '1'].includes(process.env.DATABASE_SSL) ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    if (remove) {
      const r = await client.query('DELETE FROM users WHERE email = ANY($1)', [ACCOUNTS.map((a) => a.email)]);
      console.log(`✅ ${r.rowCount} compte(s) de démonstration supprimé(s).`);
      return;
    }
    const out = [];
    for (const a of ACCOUNTS) {
      const password = fixed || randomPassword();
      const hash = await bcrypt.hash(password, 12);
      await client.query(
        `INSERT INTO users (email, name, password_hash, role, is_verified, tel, country, email_opt_in, sms_opt_in)
         VALUES ($1, $2, $3, $4, true, '+243970000000', 'Democratic Republic of the Congo', false, false)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role, is_verified = true, email_opt_in = false, sms_opt_in = false`,
        [a.email, a.name, hash, a.role],
      );
      out.push({ ...a, password });
    }
    console.log('\n✅ Comptes de démonstration prêts (mots de passe affichés une seule fois) :\n');
    for (const a of out) {
      console.log(`  ${LABEL[a.role]}`);
      console.log(`    E-mail        : ${a.email}`);
      console.log(`    Mot de passe  : ${a.password}`);
      console.log(`    Accès         : ${a.space}\n`);
    }
    console.log('Pour les retirer : npm run demo:accounts -- --remove');
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
