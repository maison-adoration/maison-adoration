// Pages modifiables (sections) et inscriptions Man Kids.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres@localhost:5432/man_test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.CORS_ORIGINS = 'http://localhost:5173';

const request = require('supertest');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { migrate } = require('../scripts/db-migrate');

let app, db, adminToken, userToken;
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

before(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await c.end();
  await migrate({ databaseUrl: process.env.DATABASE_URL, log: () => {} });
  app = require('../src/app');
  db = require('../src/db');
  require('../src/services/storage').storage.uploadFile = async (f, kind) => `https://cdn.test/${kind}/x.jpg`;
  await db.query("INSERT INTO users (email, name, password_hash, role) VALUES ('a@man.test', 'Admin', $1, 'admin')", [await bcrypt.hash('motdepasse', 4)]);
  adminToken = (await request(app).post('/auth/login').send({ email: 'a@man.test', password: 'motdepasse' })).body.token;
  userToken = (await request(app).post('/auth/register').send({ name: 'Parent', email: 'p@man.test', password: 'motdepasse' })).body.token;
});

after(async () => db.pool.end());

test('contenu initial : seules les sections publiées sont visibles', async () => {
  const pub = await request(app).get('/sections?page=ministeres');
  assert.equal(pub.status, 200);
  const slugs = pub.body.map((s) => s.slug);
  assert.ok(slugs.includes('man-kids'));
  assert.ok(slugs.includes('man-bible-college'));
  assert.equal(slugs.includes('jeunesse'), false, 'brouillon caché');
  const adm = await request(app).get('/sections?page=ministeres').set(auth(adminToken));
  assert.ok(adm.body.length > pub.body.length);
  assert.equal((await request(app).get('/sections?page=dons')).body.length, 0, 'dons pas encore remplis');
  assert.equal((await request(app).get('/sections?page=inconnue')).status, 400);
});

test('les informations vides ne sont pas montrées aux visiteurs', async () => {
  const adm = await request(app).get('/sections?page=dons').set(auth(adminToken));
  const mm = adm.body.find((s) => s.slug === 'mobile-money');
  const details = mm.details.map((d) => (d.label === 'M-Pesa' ? { ...d, value: '+243 81 000 0000' } : d));
  const res = await request(app).put(`/sections/${mm.id}`).set(auth(adminToken)).send({ details, published: true, body: 'Merci !' });
  assert.equal(res.status, 200);
  const pub = await request(app).get('/sections?page=dons');
  assert.equal(pub.body.length, 1);
  assert.deepEqual(pub.body[0].details, [{ label: 'M-Pesa', value: '+243 81 000 0000' }]);
  assert.equal(pub.body[0].title, 'Mobile Money', 'modification partielle : titre conservé');
});

test('seuls les admins modifient les sections', async () => {
  const { rows } = await db.query("SELECT id FROM site_sections WHERE slug = 'jeunesse'");
  assert.equal((await request(app).put(`/sections/${rows[0].id}`).send({ published: true })).status, 401);
  assert.equal((await request(app).put(`/sections/${rows[0].id}`).set(auth(userToken)).send({ published: true })).status, 403);
  assert.equal((await request(app).put(`/sections/${rows[0].id}`).set(auth(adminToken)).send({ slug: 'pirate' })).status, 400);
  const created = await request(app).post('/sections').set(auth(adminToken)).send({ page: 'extensions', slug: 'man-kinshasa', title: 'MAN Kinshasa', published: true });
  assert.equal(created.status, 201);
  assert.equal((await request(app).post('/sections').set(auth(adminToken)).send({ page: 'extensions', slug: 'man-kinshasa', title: 'Doublon' })).status, 409);
  assert.equal((await request(app).post('/sections').set(auth(adminToken)).send({ page: 'extensions', slug: 'Pas Valide!', title: 'X Y' })).status, 400);
  const img = await request(app).put(`/sections/${created.body.id}/image`).set(auth(adminToken)).attach('poster', PNG, { filename: 'a.png', contentType: 'image/png' });
  assert.equal(img.body.imageUrl, 'https://cdn.test/section/x.jpg');
  const rm = await request(app).put(`/sections/${created.body.id}/image?remove=1`).set(auth(adminToken));
  assert.equal(rm.body.imageUrl, null);
  assert.equal((await request(app).delete(`/sections/${created.body.id}`).set(auth(adminToken))).status, 200);
});

test('inscription Man Kids : formulaire public, suivi admin', async () => {
  const bad = await request(app).post('/kids-registrations').send({ parentName: 'Maman', parentPhone: '123', childName: 'Joie', childAge: 7 });
  assert.equal(bad.status, 400);
  assert.equal((await request(app).post('/kids-registrations').send({ parentName: 'Maman', parentPhone: '+243970000009', childName: 'Joie', childAge: 19 })).status, 400);
  const ok = await request(app).post('/kids-registrations').send({ parentName: 'Maman Grâce', parentPhone: '+243 970 000 009', parentEmail: '', childName: 'Joie', childAge: 7, notes: 'Allergie arachide' });
  assert.equal(ok.status, 201);
  assert.deepEqual(ok.body, { ok: true });
  await request(app).post('/kids-registrations').set(auth(userToken)).send({ parentName: 'Parent', parentPhone: '0970000010', childName: 'David', childAge: 4 }).expect(201);

  assert.equal((await request(app).get('/kids-registrations')).status, 401);
  assert.equal((await request(app).get('/kids-registrations').set(auth(userToken))).status, 403);
  const list = await request(app).get('/kids-registrations').set(auth(adminToken));
  assert.equal(list.body.length, 2);
  const joie = list.body.find((r) => r.childName === 'Joie');
  assert.equal((await request(app).put(`/kids-registrations/${joie.id}`).set(auth(adminToken)).send({ status: 'archived' })).body.status, 'archived');
  assert.equal((await request(app).get('/kids-registrations').set(auth(adminToken))).body.length, 1, 'archivées masquées par défaut');
  assert.equal((await request(app).get('/kids-registrations?status=archived').set(auth(adminToken))).body.length, 1);
  assert.equal((await request(app).delete(`/kids-registrations/${joie.id}`).set(auth(adminToken))).status, 200);
});
