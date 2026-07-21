require('dotenv').config();
const db = require('../src/config/database');

const migrations = [
  require('../migrations/20240721000001_create_tables'),
  require('../migrations/20240721000002_telefone_para_email'),
  require('../migrations/20240721000003_pratos_curiosidade'),
];

async function ensureMigrationsTable() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function alreadyRan(name) {
  const rows = await db.query('SELECT name FROM schema_migrations WHERE name = ?', [name]);
  return rows.length > 0;
}

async function migrate() {
  await ensureMigrationsTable();

  for (const migration of migrations) {
    if (await alreadyRan(migration.name)) {
      console.log(`Migration já aplicada: ${migration.name}`);
      continue;
    }

    await migration.up(db);
    await db.run('INSERT INTO schema_migrations (name) VALUES (?)', [migration.name]);
    console.log(`Migration aplicada: ${migration.name}`);
  }
}

async function rollback() {
  await ensureMigrationsTable();

  for (const migration of [...migrations].reverse()) {
    if (!(await alreadyRan(migration.name))) {
      continue;
    }

    await migration.down(db);
    await db.run('DELETE FROM schema_migrations WHERE name = ?', [migration.name]);
    console.log(`Migration revertida: ${migration.name}`);
    return;
  }

  console.log('Nenhuma migration para reverter.');
}

async function main() {
  const isRollback = process.argv.includes('--rollback');
  try {
    if (isRollback) {
      await rollback();
    } else {
      await migrate();
    }
  } catch (err) {
    console.error(err.message || err);
    process.exitCode = 1;
  } finally {
    await db.pg.end();
  }
}

main();
