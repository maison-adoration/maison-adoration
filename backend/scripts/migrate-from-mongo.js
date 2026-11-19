#!/usr/bin/env node
/*
 * Migration des données MongoDB (ancien serveur) vers PostgreSQL.
 *
 * Usage :
 *   MONGO_URI="mongodb+srv://..." DATABASE_URL="postgresql://..." npm run migrate-from-mongo
 *   Ajouter --dry-run pour tout vérifier sans rien écrire.
 *
 * Ce qui est copié :
 *   users        → users        (mêmes identifiants, mots de passe chiffrés conservés : chacun garde son mot de passe)
 *   webinars     → contents     (mêmes identifiants ; tyype « activité » → « activity »)
 *   conferences  → enrollments  (les accès déjà achetés ou donnés)
 *   pushnotifs   → push_subscriptions
 * Les anciennes collections de boutique (orders, items, categories, settings, reports,
 * donwloadscounts) ne sont pas utilisées par le site : elles sont sauvegardées en JSON
 * dans backend/mongo-backup/ par sécurité.
 *
 * Le script peut être relancé : les lignes déjà copiées sont ignorées.
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { Client } = require('pg');
const { migrate } = require('./db-migrate');

const TYPE_MAP = {
  'activité': 'activity',
  activite: 'activity',
  atelier: 'activity',
  podcast: 'podcast',
  video: 'video',
  'vidéo': 'video',
  pdf: 'pdf',
  cours: 'video',
};
const ROLES = new Set(['user', 'admin', 'super-admin']);
const BACKUP_ONLY = ['orders', 'items', 'categories', 'settings', 'reports', 'donwloadscounts'];

const str = (v) => (v === undefined || v === null ? null : String(v).trim() || null);
const date = (v) => (v instanceof Date && !isNaN(v) ? v : v ? new Date(v) : new Date());

/** Numéros courts uniques : garde les anciens, attribue la suite aux documents qui n'en ont pas. */
function assignNumbers(docs, field) {
  const used = new Set();
  let max = docs.reduce((m, d) => (Number.isInteger(d[field]) ? Math.max(m, d[field]) : m), 0);
  const numbers = new Map();
  for (const d of docs) {
    let n = Number.isInteger(d[field]) && d[field] > 0 && !used.has(d[field]) ? d[field] : ++max;
    used.add(n);
    numbers.set(String(d._id), n);
  }
  return numbers;
}

async function run({ mongoUri, databaseUrl, dryRun = false, log = console.log, backupDir } = {}) {
  if (!mongoUri) throw new Error('MONGO_URI manquant');
  if (!databaseUrl) throw new Error('DATABASE_URL manquant');

  if (!dryRun) await migrate({ databaseUrl, ssl: process.env.DATABASE_SSL, log: () => {} });

  const mongo = new MongoClient(mongoUri);
  await mongo.connect();
  const mdb = mongo.db();
  const pg = new Client({
    connectionString: databaseUrl,
    ssl: ['true', '1'].includes(process.env.DATABASE_SSL) ? { rejectUnauthorized: false } : false,
  });
  await pg.connect();

  const report = { users: 0, usersSkipped: [], contents: 0, contentsSkipped: [], enrollments: 0, enrollmentsSkipped: 0, push: 0 };

  try {
    // 0. Sauvegarde JSON des collections non migrées
    const outDir = backupDir || path.join(__dirname, '..', 'mongo-backup');
    if (!dryRun) fs.mkdirSync(outDir, { recursive: true });
    for (const name of BACKUP_ONLY) {
      const docs = await mdb.collection(name).find().toArray();
      if (!docs.length) continue;
      if (!dryRun) fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(docs, null, 2));
      log(`💾 ${name} : ${docs.length} document(s) sauvegardé(s) en JSON`);
    }

    await pg.query('BEGIN');

    if (dryRun) {
      // Simulation sur une base vide : on crée le schéma dans la transaction (annulée à la fin).
      const { rows } = await pg.query("SELECT to_regclass('public.users') AS t");
      if (!rows[0].t) {
        const dir = path.join(__dirname, '..', 'db', 'migrations');
        for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
          await pg.query(fs.readFileSync(path.join(dir, f), 'utf8'));
        }
      }
    }

    // 1. Utilisateurs
    const users = await mdb.collection('users').find().sort({ addedOn: 1 }).toArray();
    const userNumbers = assignNumbers(users, 'userN');
    const seenEmails = new Set();
    const keptUsers = new Set();
    for (const u of users) {
      const id = String(u._id);
      const email = (str(u.email) || str(u.username) || '').toLowerCase();
      if (!email || !u.password) {
        report.usersSkipped.push({ id, reason: 'e-mail ou mot de passe manquant' });
        continue;
      }
      if (seenEmails.has(email)) {
        report.usersSkipped.push({ id, email, reason: 'e-mail en double (le plus ancien compte est gardé)' });
        continue;
      }
      seenEmails.add(email);
      const role = ROLES.has(u.role) ? u.role : 'user';
      const res = await pg.query(
        `INSERT INTO users (id, number, email, password_hash, name, tel, country, role,
                            is_verified, email_opt_in, sms_opt_in, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          id,
          userNumbers.get(id),
          email,
          u.password,
          str(u.name) || str(u.fullname) || email.split('@')[0],
          str(u.tel),
          str(u.country),
          role,
          Boolean(u.isVerified),
          u.emailMe !== false,
          u.smsMe !== false,
          date(u.addedOn),
        ],
      );
      if (res.rowCount) report.users++;
      keptUsers.add(id);
    }

    // 2. Contenus
    const webinars = await mdb.collection('webinars').find().sort({ addedOn: 1 }).toArray();
    const contentNumbers = assignNumbers(webinars, 'webinarN');
    const keptContents = new Set();
    const userIdByUsername = new Map(users.map((u) => [String(u.username || '').toLowerCase(), String(u._id)]));
    for (const w of webinars) {
      const id = String(w._id);
      const type = TYPE_MAP[String(w.tyype || '').toLowerCase()];
      if (!type) {
        report.contentsSkipped.push({ id, title: w.title, reason: `type inconnu « ${w.tyype} »` });
        continue;
      }
      if (!w.poster) {
        report.contentsSkipped.push({ id, title: w.title, reason: 'affiche manquante' });
        continue;
      }
      const createdBy = userIdByUsername.get(String(w.addedBy || '').toLowerCase());
      const res = await pg.query(
        `INSERT INTO contents (id, number, type, title, description, price, url, poster_url, created_by_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          id,
          contentNumbers.get(id),
          type,
          str(w.title) || 'Sans titre',
          str(w.description) || '',
          Math.max(0, Number(w.amount) || 0),
          str(w.ID),
          w.poster,
          createdBy && keptUsers.has(createdBy) ? createdBy : null,
          date(w.addedOn),
        ],
      );
      if (res.rowCount) report.contents++;
      keptContents.add(id);
    }

    // 3. Accès (ancien tableau `conferences`)
    for (const u of users) {
      const userId = String(u._id);
      if (!keptUsers.has(userId)) continue;
      for (const c of new Set((u.conferences || []).map(String))) {
        if (!keptContents.has(c)) {
          report.enrollmentsSkipped++;
          continue;
        }
        const res = await pg.query(
          `INSERT INTO enrollments (user_id, content_id, source) VALUES ($1, $2, 'migration') ON CONFLICT DO NOTHING`,
          [userId, c],
        );
        if (res.rowCount) report.enrollments++;
      }
    }

    // 4. Abonnements push
    const subs = await mdb.collection('pushnotifs').find().toArray();
    const userIdByName = userIdByUsername;
    for (const s of subs) {
      const sub = s.sub || {};
      if (!sub.endpoint || !sub.keys) continue;
      const uid = userIdByName.get(String(s.username || '').toLowerCase());
      const res = await pg.query(
        `INSERT INTO push_subscriptions (endpoint, keys, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [sub.endpoint, sub.keys, uid && keptUsers.has(uid) ? uid : null],
      );
      if (res.rowCount) report.push++;
    }

    // 5. Les compteurs automatiques repartent après les plus grands numéros migrés
    await pg.query(`SELECT setval(pg_get_serial_sequence('users', 'number'), coalesce(max(number), 0) + 1, false) FROM users`);
    await pg.query(`SELECT setval(pg_get_serial_sequence('contents', 'number'), coalesce(max(number), 0) + 1, false) FROM contents`);

    if (dryRun) {
      await pg.query('ROLLBACK');
      log('🔎 Simulation (--dry-run) : rien n\'a été écrit.');
    } else {
      await pg.query('COMMIT');
    }
  } catch (err) {
    await pg.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await pg.end();
    await mongo.close();
  }

  log(`\n✅ Utilisateurs copiés : ${report.users}`);
  log(`✅ Contenus copiés : ${report.contents}`);
  log(`✅ Accès copiés : ${report.enrollments}`);
  log(`✅ Abonnements push copiés : ${report.push}`);
  if (report.usersSkipped.length) log(`⚠️  Utilisateurs ignorés :\n${report.usersSkipped.map((s) => `   - ${s.id} ${s.email || ''} : ${s.reason}`).join('\n')}`);
  if (report.contentsSkipped.length) log(`⚠️  Contenus ignorés :\n${report.contentsSkipped.map((s) => `   - ${s.id} « ${s.title} » : ${s.reason}`).join('\n')}`);
  if (report.enrollmentsSkipped) log(`⚠️  Accès ignorés (contenu supprimé ou introuvable) : ${report.enrollmentsSkipped}`);
  return report;
}

if (require.main === module) {
  run({
    mongoUri: process.env.MONGO_URI,
    databaseUrl: process.env.DATABASE_URL,
    dryRun: process.argv.includes('--dry-run'),
  }).catch((err) => {
    console.error(`❌ Migration interrompue, rien n'a été écrit : ${err.message}`);
    process.exit(1);
  });
}

module.exports = { run };
