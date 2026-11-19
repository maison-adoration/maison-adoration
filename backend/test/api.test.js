// Tests de bout en bout de l'API sur une vraie base PostgreSQL de test.
// Lancer : TEST_DATABASE_URL=postgresql://... npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres@localhost:5432/man_test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.FLEXPAY_MERCHANT = 'TEST';
process.env.FLEXPAY_TOKEN = 'Bearer test-token';
process.env.FLEXPAY_PAYMENT_URL = 'https://flexpay.invalid/pay';
process.env.FLEXPAY_CHECK_URL = 'https://flexpay.invalid/check';
process.env.API_PUBLIC_URL = 'https://api.invalid';

const request = require('supertest');
const { Client } = require('pg');
const { migrate } = require('../scripts/db-migrate');

let app, db, flexpay, storage;
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

async function resetDb() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await c.end();
  await migrate({ databaseUrl: process.env.DATABASE_URL, log: () => {} });
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });
let userToken, user, user2Token, user2, adminToken, paidId, freeId;

before(async () => {
  await resetDb();
  app = require('../src/app');
  db = require('../src/db');
  flexpay = require('../src/services/flexpay');
  storage = require('../src/services/storage').storage;
  storage.uploadFile = async (file, kind) => `https://cdn.test/${kind}/${file.originalname}`;

  // Super-admin créé directement en base (comme le script create-super-admin)
  const bcrypt = require('bcryptjs');
  await db.query(
    "INSERT INTO users (email, name, password_hash, role) VALUES ('admin@man.test', 'Admin', $1, 'super-admin')",
    [await bcrypt.hash('motdepasse-admin', 4)],
  );
  adminToken = (await request(app).post('/auth/login').send({ email: 'admin@man.test', password: 'motdepasse-admin' })).body.token;
});

after(async () => {
  await db.pool.end();
});

test('inscription : rôle et accès injectés sont ignorés', async () => {
  const res = await request(app).post('/auth/register').send({
    name: 'Fidèle Un', email: 'Fidele1@Man.test', password: 'motdepasse1', tel: '+243970000001', country: 'Congo',
    role: 'super-admin', conferences: ['x'], isVerified: true,
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.role, 'user');
  assert.equal(res.body.user.email, 'fidele1@man.test');
  assert.equal(res.body.user.passwordHash, undefined);
  assert.equal(JSON.stringify(res.body).includes('$2'), false, 'aucun hash renvoyé');
  userToken = res.body.token;
  user = res.body.user;

  const r2 = await request(app).post('/auth/register').send({ name: 'Fidèle Deux', email: 'fidele2@man.test', password: 'motdepasse2' });
  user2Token = r2.body.token;
  user2 = r2.body.user;
});

test('inscription : e-mail en double et mot de passe court refusés', async () => {
  assert.equal((await request(app).post('/auth/register').send({ name: 'X Y', email: 'fidele1@man.test', password: 'motdepasse1' })).status, 409);
  assert.equal((await request(app).post('/auth/register').send({ name: 'X Y', email: 'z@man.test', password: 'court' })).status, 400);
});

test('connexion : bon et mauvais mot de passe, /auth/me', async () => {
  assert.equal((await request(app).post('/auth/login').send({ email: 'fidele1@man.test', password: 'faux-mdp' })).status, 401);
  assert.equal((await request(app).post('/auth/login').send({ email: 'inconnu@man.test', password: 'faux-mdp' })).status, 401);
  const ok = await request(app).post('/auth/login').send({ email: 'FIDELE1@man.test', password: 'motdepasse1' });
  assert.equal(ok.status, 200);
  assert.equal((await request(app).get('/auth/me')).status, 401);
  assert.equal((await request(app).get('/auth/me').set(auth('jeton-bidon'))).status, 401);
  const me = await request(app).get('/auth/me').set(auth(ok.body.token));
  assert.equal(me.body.id, user.id);
});

test('/settings ne contient aucun secret', async () => {
  const res = await request(app).get('/settings');
  assert.equal(res.status, 200);
  const body = JSON.stringify(res.body);
  assert.equal(body.includes('test-token'), false);
  assert.equal(body.includes('TEST'), false);
  assert.deepEqual(Object.keys(res.body).sort(), ['currency', 'paymentsEnabled', 'vapidPublicKey']);
});

test('profil : impossible de changer son rôle ou ses accès, ni le profil des autres', async () => {
  const bad = await request(app).put(`/users/${user.id}`).set(auth(userToken)).send({ role: 'super-admin' });
  assert.equal(bad.status, 400);
  const bad2 = await request(app).put(`/users/${user.id}`).set(auth(userToken)).send({ conferences: ['a'] });
  assert.equal(bad2.status, 400);
  const other = await request(app).put(`/users/${user2.id}`).set(auth(userToken)).send({ name: 'Piraté' });
  assert.equal(other.status, 403);
  const ok = await request(app).put(`/users/${user.id}`).set(auth(userToken)).send({ name: 'Fidèle Modifié', smsOptIn: false });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.name, 'Fidèle Modifié');
  assert.equal(ok.body.smsOptIn, false);
  assert.equal(ok.body.role, 'user');
});

test('mot de passe : seulement le sien, avec le mot de passe actuel', async () => {
  assert.equal((await request(app).put(`/users/${user2.id}/password`).set(auth(userToken)).send({ currentPassword: 'motdepasse1', newPassword: 'nouveau-mdp-1' })).status, 403);
  assert.equal((await request(app).put(`/users/${user.id}/password`).set(auth(userToken)).send({ currentPassword: 'faux', newPassword: 'nouveau-mdp-1' })).status, 400);
  assert.equal((await request(app).put(`/users/${user.id}/password`).set(auth(userToken)).send({ currentPassword: 'motdepasse1', newPassword: 'nouveau-mdp-1' })).status, 200);
  assert.equal((await request(app).post('/auth/login').send({ email: 'fidele1@man.test', password: 'nouveau-mdp-1' })).status, 200);
});

test('liste des utilisateurs réservée aux admins', async () => {
  assert.equal((await request(app).get('/users')).status, 401);
  assert.equal((await request(app).get('/users').set(auth(userToken))).status, 403);
  const res = await request(app).get('/users?search=fidele').set(auth(adminToken));
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
});

test('export CSV des inscrits réservé aux admins', async () => {
  assert.equal((await request(app).get('/users/export.csv')).status, 401);
  assert.equal((await request(app).get('/users/export.csv').set(auth(userToken))).status, 403);
  const res = await request(app).get('/users/export.csv').set(auth(adminToken));
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/csv/);
  assert.ok(res.text.includes('fidele1@man.test'));
  assert.ok(res.text.includes('"\'+243970000001"'), 'protection contre les formules');
  assert.equal(res.text.includes('$2'), false);
});

test('création de contenus (admin) et validation', async () => {
  assert.equal((await request(app).post('/contents').set(auth(userToken)).field('type', 'video').field('title', 'X')).status, 403);
  const noPoster = await request(app).post('/contents').set(auth(adminToken)).field('type', 'video').field('title', 'Sans affiche').field('url', 'https://youtu.be/abc');
  assert.equal(noPoster.status, 400);
  const badType = await request(app).post('/contents').set(auth(adminToken)).field('type', 'virus').field('title', 'Titre').attach('poster', PNG, { filename: 'a.png', contentType: 'image/png' });
  assert.equal(badType.status, 400);

  const paid = await request(app).post('/contents').set(auth(adminToken))
    .field('type', 'video').field('title', 'Séminaire de la Vie Intérieure').field('price', '5')
    .field('url', 'https://www.youtube.com/watch?v=qBNkq_SKLY0')
    .attach('poster', PNG, { filename: 'poster.png', contentType: 'image/png' });
  assert.equal(paid.status, 201, JSON.stringify(paid.body));
  assert.equal(paid.body.posterUrl, 'https://cdn.test/poster/poster.png');
  paidId = paid.body.id;

  const free = await request(app).post('/contents').set(auth(adminToken))
    .field('type', 'pdf').field('title', 'Livret gratuit')
    .attach('poster', PNG, { filename: 'p.png', contentType: 'image/png' })
    .attach('pdf', Buffer.from('%PDF-1.4'), { filename: 'livret.pdf', contentType: 'application/pdf' });
  assert.equal(free.status, 201, JSON.stringify(free.body));
  freeId = free.body.id;
});

test('modification partielle : les autres champs ne changent pas', async () => {
  const res = await request(app).put(`/contents/${paidId}`).set(auth(adminToken)).send({ title: 'Séminaire de la Vie Intérieure (Jour 1)' });
  assert.equal(res.status, 200);
  assert.equal(res.body.title, 'Séminaire de la Vie Intérieure (Jour 1)');
  assert.equal(res.body.price, 5);
  assert.equal(res.body.url, 'https://www.youtube.com/watch?v=qBNkq_SKLY0');
  assert.equal((await request(app).put(`/contents/${paidId}`).set(auth(adminToken)).send({ role: 'x' })).status, 400);
});

test('le lien d\'un contenu payant est caché sans accès', async () => {
  const anon = await request(app).get('/contents');
  const p = anon.body.find((c) => c.id === paidId);
  const f = anon.body.find((c) => c.id === freeId);
  assert.equal(p.url, null);
  assert.equal(p.hasAccess, false);
  assert.equal(f.url, 'https://cdn.test/pdf/livret.pdf');
  const asUser = await request(app).get(`/contents/${paidId}`).set(auth(userToken));
  assert.equal(asUser.body.url, null);
  const asAdmin = await request(app).get(`/contents/${paidId}`).set(auth(adminToken));
  assert.ok(asAdmin.body.url);
  const filtered = await request(app).get('/contents?type=pdf');
  assert.deepEqual(filtered.body.map((c) => c.id), [freeId]);
});

test('participants : admin uniquement, sans mot de passe', async () => {
  assert.equal((await request(app).get(`/contents/${paidId}/participants`)).status, 401);
  assert.equal((await request(app).get(`/contents/${paidId}/participants`).set(auth(userToken))).status, 403);
  const add = await request(app).post(`/contents/${paidId}/enrollments`).set(auth(adminToken)).send({ email: 'fidele2@man.test' });
  assert.equal(add.status, 201);
  assert.equal((await request(app).post(`/contents/${paidId}/enrollments`).set(auth(adminToken)).send({ email: 'fidele2@man.test' })).status, 409);
  const list = await request(app).get(`/contents/${paidId}/participants`).set(auth(adminToken));
  assert.equal(list.body.length, 1);
  assert.deepEqual(Object.keys(list.body[0]).sort(), ['country', 'email', 'enrolledAt', 'id', 'name', 'source', 'tel']);
  const seen = await request(app).get(`/contents/${paidId}`).set(auth(user2Token));
  assert.ok(seen.body.url, 'accès manuel donne le lien');
});

test('paiement : une fausse confirmation ne donne pas accès', async () => {
  let checkResult = 'pending';
  flexpay.startPayment = async () => ({ accepted: true, orderNumber: 'ORD-1', message: 'ok' });
  flexpay.checkPayment = async () => checkResult;

  const start = await request(app).post('/payments/flexpay').set(auth(userToken)).send({ contentId: paidId, phone: '+243 970 000 001' });
  assert.equal(start.status, 201, JSON.stringify(start.body));
  assert.equal(start.body.status, 'pending');
  assert.equal(start.body.amount, 5);

  // Quelqu'un envoie une fausse confirmation « code 0 » : FlexPay dit toujours « en attente »
  await request(app).post('/payments/flexpay/callback').send({ orderNumber: 'ORD-1', code: '0', reference: 'x' }).expect(200);
  assert.equal((await request(app).get(`/contents/${paidId}`).set(auth(userToken))).body.url, null);

  // Un autre utilisateur ne voit pas ce paiement
  assert.equal((await request(app).get(`/payments/${start.body.id}`).set(auth(user2Token))).status, 404);

  // FlexPay confirme réellement
  checkResult = 'success';
  await request(app).post('/payments/flexpay/callback').send({ orderNumber: 'ORD-1' }).expect(200);
  const status = await request(app).get(`/payments/${start.body.id}`).set(auth(userToken));
  assert.equal(status.body.status, 'success');
  const content = await request(app).get(`/contents/${paidId}`).set(auth(userToken));
  assert.equal(content.body.hasAccess, true);
  assert.ok(content.body.url);

  // Rappel en double : pas de double traitement
  await request(app).post('/payments/flexpay/callback').send({ orderNumber: 'ORD-1' }).expect(200);
  const { rows } = await db.query('SELECT count(*)::int AS n FROM enrollments WHERE user_id = $1', [user.id]);
  assert.equal(rows[0].n, 1);

  // Déjà acheté → refus d'un second paiement ; contenu gratuit → refus
  assert.equal((await request(app).post('/payments/flexpay').set(auth(userToken)).send({ contentId: paidId, phone: '243970000001' })).status, 409);
  assert.equal((await request(app).post('/payments/flexpay').set(auth(userToken)).send({ contentId: freeId, phone: '243970000001' })).status, 400);
});

test('paiement refusé par FlexPay', async () => {
  flexpay.startPayment = async () => ({ accepted: false, message: 'Solde insuffisant' });
  const res = await request(app).post('/payments/flexpay').set(auth(user2Token)).send({ contentId: paidId, phone: '243970000002' });
  // user2 a déjà un accès manuel
  assert.equal(res.status, 409);
  const r3 = await request(app).post('/auth/register').send({ name: 'Fidèle Trois', email: 'f3@man.test', password: 'motdepasse3' });
  const res2 = await request(app).post('/payments/flexpay').set(auth(r3.body.token)).send({ contentId: paidId, phone: '243970000003' });
  assert.equal(res2.status, 502);
  assert.equal(res2.body.payment.status, 'failed');
});

test('un contenu déjà vendu ne peut pas être supprimé ; un gratuit oui', async () => {
  assert.equal((await request(app).delete(`/contents/${paidId}`).set(auth(adminToken))).status, 409);
  assert.equal((await request(app).delete(`/contents/${freeId}`).set(auth(userToken))).status, 403);
  assert.equal((await request(app).delete(`/contents/${freeId}`).set(auth(adminToken))).status, 200);
});

test('suppression de comptes : règles de rôles', async () => {
  assert.equal((await request(app).delete(`/users/${user2.id}`).set(auth(userToken))).status, 403);
  const { rows } = await db.query("SELECT id FROM users WHERE role = 'super-admin'");
  assert.equal((await request(app).delete(`/users/${rows[0].id}`).set(auth(adminToken))).status, 403);
  assert.equal((await request(app).delete(`/users/${user2.id}`).set(auth(adminToken))).status, 200);
});

test('statistiques, santé et route inconnue', async () => {
  const s = await request(app).get('/stats');
  assert.equal(s.body.nUsers, 3);
  assert.equal(s.body.nCourses, 1);
  assert.equal(s.body.nCountries, 1);
  assert.equal((await request(app).get('/health')).status, 200);
  assert.equal((await request(app).get('/users/781227')).status, 401);
  assert.equal((await request(app).get('/nexiste-pas')).status, 404);
});

test('CORS : origine inconnue refusée', async () => {
  const res = await request(app).get('/settings').set('Origin', 'https://pirate.example');
  assert.equal(res.status, 403);
  const ok = await request(app).get('/settings').set('Origin', 'http://localhost:5173');
  assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:5173');
});
