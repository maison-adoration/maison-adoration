// La configuration accepte un fichier .env copié de .env.example avec des champs vides.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const run = (env) =>
  spawnSync(process.execPath, ['-e', 'const c = require("./src/config"); console.log(JSON.stringify({ f: c.flexpay.enabled, s: c.smtp.enabled }))'], {
    cwd: path.join(__dirname, '..'),
    env: { PATH: process.env.PATH, DOTENV_CONFIG_PATH: '/nonexistent', ...env },
    encoding: 'utf8',
  });

test('les variables vides sont ignorées', () => {
  const r = run({
    DATABASE_URL: 'postgresql://x@localhost/x',
    JWT_SECRET: 'x'.repeat(40),
    FLEXPAY_PAYMENT_URL: '',
    FLEXPAY_CHECK_URL: '',
    API_PUBLIC_URL: '',
    SMTP_PORT: '',
  });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { f: false, s: false });
});

test('une URL invalide non vide est refusée', () => {
  const r = run({ DATABASE_URL: 'postgresql://x@localhost/x', JWT_SECRET: 'x'.repeat(40), FLEXPAY_CHECK_URL: 'pas-une-url' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FLEXPAY_CHECK_URL/);
});

test('JWT_SECRET trop court refusé', () => {
  const r = run({ DATABASE_URL: 'postgresql://x@localhost/x', JWT_SECRET: 'court' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /JWT_SECRET/);
});
