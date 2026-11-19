#!/usr/bin/env node
// Applique les fichiers db/migrations/*.sql pas encore appliqués, dans l'ordre.
// Usage : npm run db:migrate
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ quiet: true });

async function migrate({ databaseUrl = process.env.DATABASE_URL, ssl = process.env.DATABASE_SSL, log = console.log } = {}) {
  if (!databaseUrl) throw new Error('DATABASE_URL manquant');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: ssl === 'true' || ssl === '1' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    const dir = path.join(__dirname, '..', 'db', 'migrations');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        log(`✅ Migration appliquée : ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Échec de ${file} : ${err.message}`);
      }
    }
    log('Base de données à jour.');
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
}

module.exports = { migrate };
