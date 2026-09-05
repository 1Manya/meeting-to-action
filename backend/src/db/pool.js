const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.warn('[db] Warning: DATABASE_URL is not set. Set it in .env before running migrations or the server.');
}

// Neon/Supabase require SSL; local Postgres usually doesn't.
// This flag lets both work without editing code.
const useSSL = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client', err);
});

module.exports = pool;
