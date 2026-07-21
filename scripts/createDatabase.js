/**
 * Cria o banco "paises" no PostgreSQL local, se ainda não existir.
 */
require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 5432);
  const user = process.env.DB_USER || 'user';
  const password = process.env.DB_PASSWORD || 'password';
  const database = process.env.DB_NAME || 'paises';

  const client = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
  });

  try {
    await client.connect();
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      database,
    ]);

    if (result.rowCount > 0) {
      console.log(`Banco "${database}" já existe.`);
    } else {
      await client.query(`CREATE DATABASE "${database}"`);
      console.log(`Banco "${database}" criado com sucesso.`);
    }
  } catch (err) {
    console.error('Não foi possível criar o banco:', err.code || err.message || err);
    console.error(
      'Verifique se o PostgreSQL está rodando em localhost:5432 e se o usuário/senha estão corretos (user/password).'
    );
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
