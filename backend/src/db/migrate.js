// Minimal migration runner for a solo project — no need for a heavy
// migration framework at this scale. Just runs every .sql file in
// /migrations, in filename order, inside a transaction.

const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  if (files.length === 0) {
    console.log('[migrate] No migration files found.');
    return;
  }

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      console.log(`[migrate] Running ${file} ...`);
      await client.query(sql);
      console.log(`[migrate] Done: ${file}`);
    }
    console.log('[migrate] All migrations applied successfully.');
  } catch (err) {
    console.error('[migrate] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
