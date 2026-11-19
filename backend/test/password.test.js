// Mot de passe oublié, mot de passe provisoire, déconnexion des anciennes sessions.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres@localhost:5432/man_test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.SITE_URL = 'https://site.test';
process.env.SMTP_HOST = 'smtp.test';
process.env.SMTP_USER = 'robot@test';
process.env.SMTP_PASS = 'x';

const request = require('supertest');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { migrate } = require('../scripts/db-migrate');

let app, db, notifier, adminToken, member;
const sent = [];
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await c.end();
  await migrate({ databaseUrl: process.env.DATABASE_URL, log: () => {} });
  app = require('../src/app');
  db = require('../src/db');
  notifier = require('../src/services/notifier');
  notifier.sendPasswordReset = async (user, link) => {
    sent.push({ to: user.email, link });
    return true;
  };
  await db.query("INSERT INTO users (email, name, password_hash, role) VALUES ('admin@man.test', 'Admin', $1, 'admin')", [await bcrypt.hash('motdepasse', 4)]);
  adminToken = (await request(app).post('/auth/login').send({ email: 'admin@man.test', password: 'motdepasse' })).body.token;
  member = (await request(app).post('/auth/register').send({ name: 'Membre', email: 'membre@man.test', password: 'ancien-mdp' })).body;
});

after(async () => db.pool.end());

test('mot de passe oublié : même réponse que le compte existe ou non', async () => {
  const unknown = await request(app).post('/auth/forgot-password').send({ email: 'inconnu@man.test' });
  const known = await request(app).post('/auth/forgot-password').send({ email: 'MEMBRE@man.test' });
  assert.deepEqual(unknown.body, known.body);
  assert.deepEqual(known.body, { ok: true, emailEnabled: true });
  await wait(50);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'membre@man.test');
  assert.match(sent[0].link, /^https:\/\/site\.test\/mot-de-passe\?token=[a-f0-9]{64}$/);
  const { rows } = await db.query('SELECT token_hash FROM password_resets');
  assert.equal(rows.length, 1);
  assert.equal(sent[0].link.includes(rows[0].token_hash), false, 'seule l\'empreinte est stockée');
});

test('réinitialisation : lien à usage unique, anciennes sessions déconnectées', async () => {
  const token = sent[0].link.split('token=')[1];
  assert.equal((await request(app).post('/auth/reset-password').send({ token, password: 'court' })).status, 400);
  assert.equal((await request(app).post('/auth/reset-password').send({ token: 'f'.repeat(64), password: 'nouveau-mdp-1' })).status, 400);
  await wait(1100); // le nouveau mot de passe doit être postérieur à l'ancienne session
  const ok = await request(app).post('/auth/reset-password').send({ token, password: 'nouveau-mdp-1' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal((await request(app).post('/auth/reset-password').send({ token, password: 'encore-un-mdp' })).status, 400, 'lien déjà utilisé');
  assert.equal((await request(app).get('/auth/me').set(auth(member.token))).status, 401, 'ancienne session déconnectée');
  assert.equal((await request(app).get('/auth/me').set(auth(ok.body.token))).status, 200);
  assert.equal((await request(app).post('/auth/login').send({ email: 'membre@man.test', password: 'ancien-mdp' })).status, 401);
  assert.equal((await request(app).post('/auth/login').send({ email: 'membre@man.test', password: 'nouveau-mdp-1' })).status, 200);
});

test('lien expiré refusé', async () => {
  await request(app).post('/auth/forgot-password').send({ email: 'membre@man.test' });
  await wait(50);
  const token = sent.at(-1).link.split('token=')[1];
  await db.query("UPDATE password_resets SET expires_at = now() - interval '1 minute' WHERE used_at IS NULL");
  assert.equal((await request(app).post('/auth/reset-password').send({ token, password: 'nouveau-mdp-2' })).status, 400);
});

test('changement de mot de passe : nouveau jeton, autres appareils déconnectés', async () => {
  const s1 = (await request(app).post('/auth/login').send({ email: 'membre@man.test', password: 'nouveau-mdp-1' })).body.token;
  await wait(1100);
  const ch = await request(app).put(`/users/${member.user.id}/password`).set(auth(s1)).send({ currentPassword: 'nouveau-mdp-1', newPassword: 'nouveau-mdp-3' });
  assert.equal(ch.status, 200);
  assert.equal((await request(app).get('/auth/me').set(auth(s1))).status, 401);
  assert.equal((await request(app).get('/auth/me').set(auth(ch.body.token))).status, 200);
});

test('mot de passe provisoire donné par un admin', async () => {
  const userToken = (await request(app).post('/auth/login').send({ email: 'membre@man.test', password: 'nouveau-mdp-3' })).body.token;
  assert.equal((await request(app).post(`/users/${member.user.id}/temporary-password`).set(auth(userToken))).status, 403);
  const { rows } = await db.query("SELECT id FROM users WHERE email = 'admin@man.test'");
  assert.equal((await request(app).post(`/users/${rows[0].id}/temporary-password`).set(auth(adminToken))).status, 403, 'pas sur son propre compte');
  const res = await request(app).post(`/users/${member.user.id}/temporary-password`).set(auth(adminToken));
  assert.equal(res.status, 200);
  assert.match(res.body.password, /^[a-zA-Z2-9]{12}$/);
  assert.equal((await request(app).post('/auth/login').send({ email: 'membre@man.test', password: res.body.password })).status, 200);
});

test('sans e-mail configuré, la demande l\'indique', async () => {
  const config = require('../src/config');
  config.smtp.enabled = false;
  const res = await request(app).post('/auth/forgot-password').send({ email: 'membre@man.test' });
  assert.deepEqual(res.body, { ok: true, emailEnabled: false });
  config.smtp.enabled = true;
});
