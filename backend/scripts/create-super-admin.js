#!/usr/bin/env node
// Crée (ou promeut) un compte super-admin.
// Usage : npm run create-super-admin -- email@exemple.com "Nom Complet"
// Le mot de passe est demandé de façon masquée (ou lu dans SUPER_ADMIN_PASSWORD).
require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const readline = require('readline');
const { Client } = require('pg');

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : '');
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

(async () => {
  const [email, name = 'Super Admin'] = process.argv.slice(2);
  if (!email) {
    console.error('Usage : npm run create-super-admin -- email@exemple.com "Nom Complet"');
    process.exit(1);
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: ['true', '1'].includes(process.env.DATABASE_SSL) ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    const mail = email.trim().toLowerCase();
    const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [mail]);
    if (rows[0]) {
      await client.query("UPDATE users SET role = 'super-admin' WHERE id = $1", [rows[0].id]);
      console.log(`✅ ${mail} est maintenant super-admin (mot de passe inchangé).`);
      return;
    }
    const password = process.env.SUPER_ADMIN_PASSWORD || (await askHidden('Mot de passe (8 caractères min.) : '));
    if (!password || password.length < 8) throw new Error('Mot de passe trop court');
    await client.query(
      "INSERT INTO users (email, name, password_hash, role, is_verified) VALUES ($1, $2, $3, 'super-admin', true)",
      [mail, name, await bcrypt.hash(password, 12)],
    );
    console.log(`✅ Compte super-admin créé : ${mail}`);
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
