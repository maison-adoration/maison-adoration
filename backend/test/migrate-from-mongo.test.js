// Test du script de migration MongoDB → PostgreSQL avec des documents au format de l'ancien serveur.
// Nécessite un serveur MongoDB de test : TEST_MONGO_URI=mongodb://127.0.0.1:27017/man_old npm test
// (ignoré si TEST_MONGO_URI n'est pas défini).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MONGO = process.env.TEST_MONGO_URI;
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres@localhost:5432/man_test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';

const { MongoClient, ObjectId } = require('mongodb');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const request = require('supertest');

let mongo, pg;
const ids = {
  alice: new ObjectId(), bob: new ObjectId(), dup: new ObjectId(), admin: new ObjectId(),
  video: new ObjectId(), event: new ObjectId(), weird: new ObjectId(), deleted: new ObjectId(),
};

before(async () => {
  if (!MONGO) return;
  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

  mongo = new MongoClient(MONGO);
  await mongo.connect();
  const db = mongo.db();
  await db.dropDatabase();
  const hash = await bcrypt.hash('ancien-mdp', 10); // même format que l'ancien utils/hash.js
  await db.collection('users').insertMany([
    { _id: ids.admin, username: 'pasteur@man.org', email: 'pasteur@man.org', password: hash, role: 'super-admin', name: 'Pasteur', userN: 1, conferences: [], addedOn: new Date('2023-01-01') },
    { _id: ids.alice, username: 'alice@man.org', email: 'Alice@Man.org', password: hash, role: 'user', name: 'Alice', tel: '+243970000001', country: 'Congo, The Democratic Republic of the', userN: 2, conferences: [String(ids.video), String(ids.deleted), String(ids.video)], emailMe: false, addedOn: new Date('2023-02-01') },
    { _id: ids.bob, username: 'bob@man.org', email: 'bob@man.org', password: hash, name: 'Bob', conferences: [String(ids.event)], addedOn: new Date('2023-03-01') }, // pas de userN
    { _id: ids.dup, username: 'alice@man.org', email: 'alice@man.org', password: hash, name: 'Alice bis', userN: 4, addedOn: new Date('2023-04-01') },
  ]);
  await db.collection('webinars').insertMany([
    { _id: ids.video, tyype: 'video', title: 'Comprendre le Culte Prophétique', description: 'Session 1', amount: 5, ID: 'https://www.youtube.com/watch?v=mtuqnM3Cbak', poster: 'https://res.cloudinary.com/x/p1.jpg', webinarN: 1, addedBy: 'pasteur@man.org', addedOn: new Date('2024-01-01') },
    { _id: ids.event, tyype: 'activité', title: 'Séminaire', amount: 0, poster: 'https://res.cloudinary.com/x/p2.jpg', webinarN: 2, addedOn: new Date('2024-02-01') },
    { _id: ids.weird, tyype: 'inconnu', title: 'Type bizarre', poster: 'https://res.cloudinary.com/x/p3.jpg', webinarN: 3 },
  ]);
  await db.collection('pushnotifs').insertOne({ username: 'alice@man.org', sub: { endpoint: 'https://push.example/abc', keys: { p256dh: 'k', auth: 'a' } } });
  await db.collection('orders').insertOne({ username: 'bob@man.org', content: [], totalWithDelivery: 10 });
});

after(async () => {
  if (!MONGO) return;
  await mongo.close();
  await pg.end();
});

test('migration complète MongoDB → PostgreSQL', { skip: !MONGO && 'TEST_MONGO_URI non défini' }, async () => {
  const { run } = require('../scripts/migrate-from-mongo');
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'man-backup-'));
  const logs = [];

  // Simulation : rien n'est écrit
  await run({ mongoUri: MONGO, databaseUrl: process.env.DATABASE_URL, dryRun: true, log: () => {}, backupDir });
  const tables = await pg.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'users'");
  assert.equal(tables.rows[0].n, 0, 'le dry-run ne crée rien');

  const report = await run({ mongoUri: MONGO, databaseUrl: process.env.DATABASE_URL, log: (l) => logs.push(l), backupDir });
  assert.equal(report.users, 3);
  assert.equal(report.usersSkipped.length, 1, 'doublon e-mail ignoré');
  assert.equal(report.contents, 2);
  assert.equal(report.contentsSkipped.length, 1, 'type inconnu ignoré');
  assert.equal(report.enrollments, 2);
  assert.equal(report.enrollmentsSkipped, 1, 'accès vers un contenu supprimé ignoré');
  assert.equal(report.push, 1);
  assert.ok(fs.existsSync(path.join(backupDir, 'orders.json')), 'commandes sauvegardées en JSON');

  const { rows: users } = await pg.query('SELECT id, number, email, role, email_opt_in FROM users ORDER BY number');
  assert.deepEqual(users.map((u) => [u.id, u.number, u.email, u.role]), [
    [String(ids.admin), 1, 'pasteur@man.org', 'super-admin'],
    [String(ids.alice), 2, 'alice@man.org', 'user'],
    [String(ids.bob), 5, 'bob@man.org', 'user'], // numéro attribué après le plus grand existant (4)
  ]);
  assert.equal(users[1].email_opt_in, false);

  const { rows: contents } = await pg.query('SELECT id, number, type, price, url, created_by_id FROM contents ORDER BY number');
  assert.equal(contents[0].type, 'video');
  assert.equal(contents[0].created_by_id, String(ids.admin));
  assert.equal(contents[1].type, 'activity');

  // Relancer ne duplique rien
  const again = await run({ mongoUri: MONGO, databaseUrl: process.env.DATABASE_URL, log: () => {}, backupDir });
  assert.equal(again.users + again.contents + again.enrollments + again.push, 0);

  // Un ancien membre se connecte avec son ancien mot de passe et voit son contenu acheté
  const app = require('../src/app');
  const login = await request(app).post('/auth/login').send({ email: 'alice@man.org', password: 'ancien-mdp' });
  assert.equal(login.status, 200);
  const c = await request(app).get(`/contents/${ids.video}`).set('Authorization', `Bearer ${login.body.token}`);
  assert.equal(c.body.hasAccess, true);
  assert.equal(c.body.url, 'https://www.youtube.com/watch?v=mtuqnM3Cbak');

  // Les nouveaux comptes reçoivent un numéro libre
  const reg = await request(app).post('/auth/register').send({ name: 'Nouveau', email: 'nouveau@man.org', password: 'motdepasse' });
  assert.equal(reg.body.user.number, 6);
  await require('../src/db').pool.end();
});
