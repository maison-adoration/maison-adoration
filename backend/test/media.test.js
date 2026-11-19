// Module média : rôle media, contenus, publication, pages publiques.
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

let app, db, superToken, mediaToken, userToken, mediaUserId;
const auth = (t) => ({ Authorization: `Bearer ${t}` });

before(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await c.end();
  await migrate({ databaseUrl: process.env.DATABASE_URL, log: () => {} });
  app = require('../src/app');
  db = require('../src/db');
  require('../src/services/storage').storage.uploadFile = async (f, kind) => `https://cdn.test/${kind}/${f.originalname}`;
  await db.query("INSERT INTO users (email, name, password_hash, role) VALUES ('s@man.test', 'Super', $1, 'super-admin')", [await bcrypt.hash('motdepasse', 4)]);
  superToken = (await request(app).post('/auth/login').send({ email: 's@man.test', password: 'motdepasse' })).body.token;
  const m = await request(app).post('/auth/register').send({ name: 'Équipe Média', email: 'media@man.test', password: 'motdepasse' });
  mediaUserId = m.body.user.id;
  mediaToken = m.body.token;
  userToken = (await request(app).post('/auth/register').send({ name: 'Membre', email: 'u@man.test', password: 'motdepasse' })).body.token;
});

after(async () => db.pool.end());

test('rôle média : donné par le super-admin, refusé aux membres', async () => {
  assert.equal((await request(app).get('/media/dashboard').set(auth(mediaToken))).status, 403);
  const r = await request(app).put(`/users/${mediaUserId}/role`).set(auth(superToken)).send({ role: 'media' });
  assert.equal(r.status, 200);
  assert.equal(r.body.role, 'media');
  assert.equal((await request(app).get('/media/dashboard').set(auth(mediaToken))).status, 200);
  assert.equal((await request(app).get('/media/dashboard').set(auth(userToken))).status, 403);
  assert.equal((await request(app).get('/media/dashboard')).status, 401);
  // l'équipe média n'a pas les droits admin
  assert.equal((await request(app).get('/users').set(auth(mediaToken))).status, 403);
});

test('envoi de fichiers : type contrôlé', async () => {
  const ok = await request(app).post('/media/uploads?kind=audio').set(auth(mediaToken))
    .attach('file', Buffer.from('ID3'), { filename: 'culte.mp3', contentType: 'audio/mpeg' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.url, 'https://cdn.test/audio/culte.mp3');
  const bad = await request(app).post('/media/uploads?kind=image').set(auth(mediaToken))
    .attach('file', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/octet-stream' });
  assert.equal(bad.status, 400);
  assert.equal((await request(app).post('/media/uploads?kind=video').set(auth(mediaToken))
    .attach('file', Buffer.from('x'), { filename: 'a.mp4', contentType: 'video/mp4' })).status, 400);
});

test('sermons et séries : brouillon, publication, page publique', async () => {
  const series = await request(app).post('/media/series').set(auth(mediaToken)).send({ name: 'Vie intérieure' });
  assert.equal(series.status, 201);
  const s = await request(app).post('/media/sermons').set(auth(mediaToken)).send({
    title: 'Séminaire de la Vie Intérieure, jour 1', preacher: 'Prophète Israel Kayembe', sermonDate: '2026-11-15',
    videoUrl: 'https://www.youtube.com/watch?v=qBNkq_SKLY0', seriesId: series.body.id,
  });
  assert.equal(s.status, 201);
  assert.equal(s.body.is_published, false);
  assert.equal((await request(app).post('/media/sermons').set(auth(mediaToken)).send({ title: 'X Y', seriesId: 'inexistante' })).status, 404);
  assert.equal((await request(app).post('/media/sermons').set(auth(mediaToken)).send({ title: 'X Y', videoUrl: 'pas un lien' })).status, 400);

  let pub = await request(app).get('/media/public/overview');
  assert.equal(pub.body.sermons.length, 0, 'brouillon invisible');
  await request(app).post(`/media/sermons/${s.body.id}/publish`).set(auth(mediaToken)).expect(200);
  pub = await request(app).get('/media/public/overview');
  assert.equal(pub.body.sermons.length, 1);
  assert.equal(pub.body.sermons[0].series_name, 'Vie intérieure');
  assert.equal(pub.body.sermons[0].sermon_date, '2026-11-15', 'date sans décalage de fuseau');
  assert.equal(pub.body.series[0].sermons_count, 1);

  const upd = await request(app).put(`/media/sermons/${s.body.id}`).set(auth(mediaToken)).send({ isFeatured: true });
  assert.equal(upd.body.is_featured, true);
  assert.equal(upd.body.preacher, 'Prophète Israel Kayembe', 'modification partielle');
  assert.equal((await request(app).put(`/media/sermons/${s.body.id}`).set(auth(mediaToken)).send({ views_count: 999 })).status, 400);

  await request(app).post(`/media/public/sermons/${s.body.id}/view`).expect(200);
  const dash = await request(app).get('/media/dashboard').set(auth(mediaToken));
  assert.equal(dash.body.stats.totalViews, 1);
  assert.equal(dash.body.stats.publishedSermons, 1);

  // supprimer la série détache le sermon sans le supprimer
  await request(app).delete(`/media/series/${series.body.id}`).set(auth(mediaToken)).expect(200);
  const after = await request(app).get('/media/sermons').set(auth(mediaToken));
  assert.equal(after.body.length, 1);
  assert.equal(after.body[0].series_id, null);
});

test('galerie : album, photos, publication', async () => {
  const a = await request(app).post('/media/gallery').set(auth(mediaToken)).send({ title: 'Culte de Noël', eventDate: '2026-12-25' });
  assert.equal(a.status, 201);
  const ph = await request(app).post(`/media/gallery/${a.body.id}/photos`).set(auth(mediaToken)).send({
    photos: [{ url: 'https://cdn.test/1.jpg', caption: 'Louange' }, { url: 'https://cdn.test/2.jpg' }],
  });
  assert.equal(ph.status, 201);
  assert.deepEqual(ph.body.map((p) => p.position), [0, 1]);
  assert.equal((await request(app).get(`/media/public/albums/${a.body.id}`)).status, 404, 'non publié');
  await request(app).post(`/media/gallery/${a.body.id}/publish`).set(auth(mediaToken)).expect(200);
  const pub = await request(app).get(`/media/public/albums/${a.body.id}`);
  assert.equal(pub.body.photos.length, 2);
  assert.equal(pub.body.cover, 'https://cdn.test/1.jpg', 'couverture = première photo');
  assert.equal(pub.body.created_by_id, undefined);
  await request(app).delete(`/media/photos/${ph.body[0].id}`).set(auth(mediaToken)).expect(200);
  assert.equal((await request(app).get(`/media/public/albums/${a.body.id}`)).body.photos.length, 1);
});

test('podcasts et communiqués', async () => {
  assert.equal((await request(app).post('/media/podcasts').set(auth(mediaToken)).send({ title: 'Épisode 1' })).status, 400, 'audio obligatoire');
  const p = await request(app).post('/media/podcasts').set(auth(mediaToken)).send({ title: 'Épisode 1', audioUrl: 'https://cdn.test/e1.mp3', episodeNumber: 1 });
  assert.equal(p.status, 201);
  await request(app).post(`/media/podcasts/${p.body.id}/publish`).set(auth(mediaToken)).expect(200);
  await request(app).post(`/media/public/podcasts/${p.body.id}/play`).expect(200);
  const pr = await request(app).post('/media/press').set(auth(mediaToken)).send({ title: 'Convention 2027', content: 'Texte complet', tags: ['convention'] });
  assert.equal(pr.status, 201);
  assert.equal((await request(app).get(`/media/public/press/${pr.body.id}`)).status, 404);
  await request(app).post(`/media/press/${pr.body.id}/publish`).set(auth(mediaToken)).expect(200);
  const one = await request(app).get(`/media/public/press/${pr.body.id}`);
  assert.equal(one.body.content, 'Texte complet');
  const ov = await request(app).get('/media/public/overview');
  assert.equal(ov.body.podcasts[0].plays_count, 1);
  assert.equal(ov.body.press.length, 1);
  assert.equal(ov.body.press[0].content, undefined, 'la liste ne contient que l\'extrait');
});

test('directs : programmation, lancement, fin, rediffusion', async () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const st = await request(app).post('/media/streams').set(auth(mediaToken)).send({ title: 'Culte dominical', scheduledAt: future });
  assert.equal(st.status, 201);
  let ov = await request(app).get('/media/public/overview');
  assert.equal(ov.body.upcoming.length, 1);
  assert.equal(ov.body.live, null);
  assert.equal((await request(app).post(`/media/streams/${st.body.id}/go-live`).set(auth(mediaToken))).status, 400, 'lien obligatoire');
  await request(app).put(`/media/streams/${st.body.id}`).set(auth(mediaToken)).send({ streamUrl: 'https://www.youtube.com/watch?v=abc' }).expect(200);
  await request(app).post(`/media/streams/${st.body.id}/go-live`).set(auth(mediaToken)).expect(200);
  ov = await request(app).get('/media/public/overview');
  assert.equal(ov.body.live.title, 'Culte dominical');
  assert.equal(ov.body.upcoming.length, 0);
  await request(app).post(`/media/streams/${st.body.id}/end`).set(auth(mediaToken)).expect(200);
  await request(app).put(`/media/streams/${st.body.id}`).set(auth(mediaToken)).send({ recordingUrl: 'https://www.youtube.com/watch?v=abc' }).expect(200);
  ov = await request(app).get('/media/public/overview');
  assert.equal(ov.body.live, null);
  assert.equal(ov.body.replays.length, 1);
  assert.equal((await request(app).post('/media/streams').set(auth(mediaToken)).send({ title: 'X Y', platform: 'tiktok' })).status, 400);
});
