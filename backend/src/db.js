const { Pool, types } = require('pg');
const config = require('./config');

// Les colonnes numeric (prix) arrivent en texte : on les convertit en nombre.
types.setTypeParser(types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

/** Requête simple. */
const query = (text, params) => pool.query(text, params);

/** Exécute `fn(client)` dans une transaction (tout ou rien). */
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction };
