// Médiathèque : programmation, passages bibliques, bibliothèque publique,
// direct (discussion, appels à l'action, archivage), prière, partage, podcast.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres@localhost:5432/man_test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.SITE_URL = 'https://site.test';

const request = require('supertest');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { migrate } = require('../scripts/db-migrate');
const { parseScriptures } = require('../src/utils/bible');

let app, db, adminToken, mediaToken, userToken;
const auth = (t) => ({ Authorization: `Bearer ${t}` });

before(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await c.end();
  await migrate({ databaseUrl: process.env.DATABASE_URL, log: () => {} });
  app = require('../src/app');
  db = require('../src/db');
  const hash = await bcrypt.hash('motdepasse', 4);
  await db.query(
    `INSERT INTO users (email, name, password_hash, role) VALUES
     ('a@man.test', 'Admin', $1, 'admin'), ('m@man.test', 'Équipe Média', $1, 'media'), ('u@man.test', 'Grâce', $1, 'user')`,
    [hash],
  );
  const login = async (email) => (await request(app).post('/auth/login').send({ email, password: 'motdepasse' })).body.token;
  adminToken = await login('a@man.test');
  mediaToken = await login('m@man.test');
  userToken = await login('u@man.test');
});

after(async () => db.pool.end());

test('passages bibliques : lecture souple des références', () => {
  const r = parseScriptures('Jean 3:16 ; 1 Cor 13.4-7, II Rois 2, Psaume 23, Héb 11');
  assert.deepEqual(r.books, ['2 Rois', 'Psaumes', 'Jean', '1 Corinthiens', 'Hébreux'], 'ordre biblique');
  assert.deepEqual(parseScriptures('Jean 3:16,18').refs, ['Jean 3:16,18']);
  assert.equal(r.unknown.length, 0);
  assert.deepEqual(parseScriptures('Livre inconnu 4:2').unknown, ['Livre inconnu 4:2']);
});

test('message : passages, chapitres, lien court, programmation', async () => {
  const s = await request(app).post('/media/sermons').set(auth(mediaToken)).send({
    title: 'La foi qui persévère', preacher: 'Prophète Israel Kayembe', sermonDate: '2026-11-22',
    videoUrl: 'https://youtu.be/qBNkq_SKLY0', scriptures: 'Hébreux 11:1-6; Jacques 1',
    chapters: [{ t: 600, label: 'Prédication' }, { t: 0, label: 'Louange' }],
  });
  assert.equal(s.status, 201);
  assert.equal(s.body.slug, 'la-foi-qui-persevere');
  assert.deepEqual(s.body.bible_books, ['Hébreux', 'Jacques']);
  assert.deepEqual(s.body.chapters.map((c) => c.t), [0, 600], 'chapitres triés');
  const twin = await request(app).post('/media/sermons').set(auth(mediaToken)).send({ title: 'La foi qui persévère' });
  assert.equal(twin.body.slug, 'la-foi-qui-persevere-2', 'lien unique');
  assert.equal((await request(app).post('/media/sermons').set(auth(mediaToken)).send({ title: 'X Y', scriptures: 'Zorglub 4' })).status, 400);

  // programmé demain : invisible jusque-là
  const later = new Date(Date.now() + 86400000).toISOString();
  await request(app).post(`/media/sermons/${twin.body.id}/publish`).set(auth(mediaToken)).send({ publishAt: later }).expect(200);
  await request(app).post(`/media/sermons/${s.body.id}/publish`).set(auth(mediaToken)).expect(200);
  const lib = await request(app).get('/media/public/sermons');
  assert.equal(lib.body.total, 1, 'le message programmé reste caché');
  assert.equal((await request(app).get('/media/public/sermons/by-slug/la-foi-qui-persevere-2')).status, 404);
  const one = await request(app).get('/media/public/sermons/by-slug/la-foi-qui-persevere');
  assert.equal(one.body.title, 'La foi qui persévère');
  assert.equal(one.body.created_by_id, undefined);
  assert.ok(Array.isArray(one.body.related));
});

test('bibliothèque : recherche et filtres', async () => {
  const mk = async (b) => {
    const r = await request(app).post('/media/sermons').set(auth(mediaToken)).send(b);
    await request(app).post(`/media/sermons/${r.body.id}/publish`).set(auth(mediaToken)).expect(200);
  };
  await mk({ title: 'Le bon berger', preacher: 'Pasteur Ruth', sermonDate: '2025-04-06', scriptures: 'Jean 10:11' });
  await mk({ title: "L'amour véritable", preacher: 'Pasteur Ruth', sermonDate: '2026-02-14', scriptures: '1 Corinthiens 13' });
  const by = (q) => request(app).get('/media/public/sermons').query(q);
  assert.equal((await by({ preacher: 'Pasteur Ruth' })).body.total, 2);
  assert.equal((await by({ year: 2025 })).body.total, 1);
  assert.equal((await by({ book: '1 Corinthiens' })).body.items[0].title, "L'amour véritable");
  assert.equal((await by({ search: 'berger' })).body.total, 1);
  assert.equal((await by({ search: '100%_' })).body.total, 0, 'caractères spéciaux neutralisés');
  const f = await request(app).get('/media/public/sermons/facets');
  assert.deepEqual(f.body.preachers.map((p) => p.value), ['Pasteur Ruth', 'Prophète Israel Kayembe']);
  assert.deepEqual(f.body.books.map((b) => b.value), ['Jean', '1 Corinthiens', 'Hébreux', 'Jacques'], 'ordre biblique');
});

test('direct : discussion modérée, appel à l’action, archivage en message', async () => {
  const st = await request(app).post('/media/streams').set(auth(mediaToken)).send({
    title: 'Culte dominical', streamUrl: 'https://www.youtube.com/watch?v=qBNkq_SKLY0',
  });
  assert.equal(st.body.chat_enabled, true);
  const sid = st.body.id;
  const say = (body, t) => request(app).post(`/media/public/live/${sid}/chat`).set(t ? auth(t) : {}).send({ name: 'Paul', body });
  assert.equal((await say('Amen !')).status, 409, 'fermé hors direct');
  await request(app).post(`/media/streams/${sid}/go-live`).set(auth(mediaToken)).expect(200);
  assert.equal((await say('Gloire à Dieu')).status, 201);
  const own = await say('Bonjour', userToken);
  assert.equal(own.body.name, 'Grâce', 'nom du compte connecté');
  assert.equal((await say('voir www.spam.test')).status, 400, 'liens refusés');
  await request(app).post(`/media/streams/${sid}/chat`).set(auth(mediaToken)).send({ body: 'Bienvenue à tous' }).expect(201);

  let room = await request(app).get(`/media/public/live/${sid}/room`);
  assert.equal(room.body.messages.length, 3);
  assert.equal(room.body.messages[2].isHost, true);
  await request(app).put(`/media/chat/${own.body.id}`).set(auth(mediaToken)).send({ isHidden: true }).expect(200);
  room = await request(app).get(`/media/public/live/${sid}/room`).query({ since: new Date(Date.now() - 60000).toISOString() });
  assert.equal(room.body.messages.length, 2, 'message masqué retiré');
  assert.deepEqual(room.body.hidden, [own.body.id]);
  assert.equal((await request(app).put(`/media/chat/${own.body.id}`).set(auth(userToken)).send({ isHidden: false })).status, 403);

  // appels à l'action : un seul actif à la fois
  const give = await request(app).post(`/media/streams/${sid}/moments`).set(auth(mediaToken)).send({ kind: 'give', title: 'Soutenir l’œuvre', buttonLabel: 'Donner' });
  const salv = await request(app).post(`/media/streams/${sid}/moments`).set(auth(mediaToken)).send({ kind: 'salvation', title: "J'ai donné ma vie à Christ" });
  assert.equal((await request(app).post(`/media/streams/${sid}/moments`).set(auth(mediaToken)).send({ kind: 'link', title: 'Lien' })).status, 400);
  await request(app).post(`/media/moments/${give.body.id}/activate`).set(auth(mediaToken)).expect(200);
  assert.equal((await request(app).post(`/media/public/moments/${salv.body.id}/respond`).send({ name: 'Jean', wantsContact: false })).status, 404, 'pas encore ouvert');
  await request(app).post(`/media/moments/${salv.body.id}/activate`).set(auth(mediaToken)).expect(200);
  room = await request(app).get(`/media/public/live/${sid}/room`);
  assert.equal(room.body.moment.kind, 'salvation');
  assert.equal((await request(app).post(`/media/public/moments/${salv.body.id}/respond`).send({ name: 'Jean', wantsContact: true })).status, 400, 'numéro requis');
  await request(app).post(`/media/public/moments/${salv.body.id}/respond`).send({ name: 'Jean Mukendi', phone: '+243 970 000 000' }).expect(201);
  const régie = await request(app).get(`/media/streams/${sid}/room`).set(auth(mediaToken));
  assert.equal(régie.body.messages.length, 3, 'la régie voit aussi les messages masqués');
  assert.equal(régie.body.moments.find((m) => m.kind === 'salvation').responses, 1);

  // fin + archivage automatique en message
  const end = await request(app).post(`/media/streams/${sid}/end`).set(auth(mediaToken)).send({ archive: true, preacher: 'Prophète Israel Kayembe' });
  assert.equal(end.status, 200);
  assert.ok(end.body.archivedSermon);
  assert.equal(end.body.archivedSermon.video_url, 'https://www.youtube.com/watch?v=qBNkq_SKLY0');
  room = await request(app).get(`/media/public/live/${sid}/room`);
  assert.equal(room.body.ended, true);
  assert.equal(room.body.moment, null, 'appels fermés à la fin');
  assert.equal(room.body.archivedSlug, 'culte-dominical');
  const again = await request(app).post(`/media/streams/${sid}/end`).set(auth(mediaToken)).send({ archive: true });
  assert.equal(again.body.archivedSermon, null, 'pas de doublon');
});

test('prière : demandes publiques, équipe de prière, exports', async () => {
  assert.equal((await request(app).post('/prayer-requests').send({ name: 'Marie', request: 'Pour ma famille', wantsCall: true })).status, 400);
  await request(app).post('/prayer-requests').send({ name: 'Marie K.', phone: '+243 990 000 000', request: 'Pour la guérison de ma mère', wantsCall: true }).expect(201);
  await request(app).post('/prayer-requests').set(auth(userToken)).send({ name: 'Grâce', request: 'Pour mes examens' }).expect(201);
  assert.equal((await request(app).get('/prayer-requests').set(auth(mediaToken))).status, 403, 'réservé à la gestion');
  const list = await request(app).get('/prayer-requests').set(auth(adminToken));
  assert.equal(list.body.items.length, 2);
  assert.equal(list.body.counts.new, 2);
  await request(app).put(`/prayer-requests/${list.body.items[0].id}`).set(auth(adminToken)).send({ status: 'praying' }).expect(200);
  const x = await request(app).get('/prayer-requests/export.xlsx').set(auth(adminToken)).buffer().parse((res, cb) => {
    const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d)));
  });
  assert.equal(x.status, 200);
  assert.match(x.headers['content-disposition'], /demandes-de-priere/);
  const dec = await request(app).get('/faith-decisions').set(auth(adminToken));
  assert.equal(dec.body.length, 1);
  await request(app).put(`/faith-decisions/${dec.body[0].id}`).set(auth(adminToken)).send({ status: 'contacted' }).expect(200);
  assert.equal((await request(app).get('/faith-decisions/export.pdf').set(auth(adminToken))).status, 200);
});

test('partage et podcast', async () => {
  const share = await request(app).get('/partage/m/la-foi-qui-persevere?t=754');
  assert.equal(share.status, 200);
  assert.match(share.text, /og:title" content="La foi qui persévère"/);
  assert.match(share.text, /i\.ytimg\.com\/vi\/qBNkq_SKLY0/);
  assert.match(share.text, /https:\/\/site\.test\/message\?m=la-foi-qui-persevere&amp;t=754/);
  assert.equal((await request(app).get('/partage/m/inconnu')).status, 302);

  const p = await request(app).post('/media/podcasts').set(auth(mediaToken)).send({
    title: 'Prière du matin <1>', audioUrl: 'https://cdn.test/matin.m4a', episodeNumber: 3, durationSeconds: 1865, audioBytes: 12345,
  });
  await request(app).post(`/media/podcasts/${p.body.id}/publish`).set(auth(mediaToken)).expect(200);
  const rss = await request(app).get('/podcast.xml');
  assert.equal(rss.status, 200);
  assert.match(rss.headers['content-type'], /rss\+xml/);
  assert.match(rss.text, /<itunes:category text="Religion &amp; Spirituality"><itunes:category text="Christianity"\/>/);
  assert.match(rss.text, /Prière du matin &lt;1&gt;/);
  assert.match(rss.text, /length="12345" type="audio\/x-m4a"/);
  assert.match(rss.text, /<itunes:duration>00:31:05<\/itunes:duration>/);
});
