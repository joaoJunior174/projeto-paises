require('dotenv').config();

const os = require('os');
const app = require('./app');
const db = require('./config/database');
const { runSeed } = require('./db/seedData');

const migrations = [
  require('../migrations/20240721000001_create_tables'),
  require('../migrations/20240721000002_telefone_para_email'),
];

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_IP = (process.env.PUBLIC_IP || '').trim();

function listarIpsLocais() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const nome of Object.keys(interfaces)) {
    for (const info of interfaces[nome] || []) {
      if (info.family === 'IPv4' && !info.internal) {
        ips.push(info.address);
      }
    }
  }

  return ips;
}

async function ensureMigrations() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const migration of migrations) {
    const rows = await db.query('SELECT name FROM schema_migrations WHERE name = ?', [
      migration.name,
    ]);

    if (!rows.length) {
      await migration.up(db);
      await db.run('INSERT INTO schema_migrations (name) VALUES (?)', [migration.name]);
      console.log(`Migration aplicada: ${migration.name}`);
    }
  }

  const contagem = await db.query('SELECT COUNT(*) AS total FROM paises');
  const total = Number(contagem[0]?.total || 0);

  if (total === 0) {
    const info = await runSeed(db);
    console.log(`Seed aplicado: ${info.total} países.`);
  }
}

async function bootstrap() {
  try {
    await ensureMigrations();
  } catch (err) {
    console.error('Falha ao preparar o banco:', err.message);
    console.error('Rode: npm run db:create && npm run setup');
  }

  app.listen(PORT, HOST, () => {
    const ipsLocais = listarIpsLocais();

    console.log('');
    console.log('=== Servidor aberto para acesso externo ===');
    console.log(`Bind: ${HOST}:${PORT}`);
    console.log(`PostgreSQL: ${db.getConnectionInfo()}`);
    console.log('');
    console.log('Acesse por:');
    console.log(`  - Este PC ........ http://localhost:${PORT}`);

    for (const ip of ipsLocais) {
      console.log(`  - Rede local ..... http://${ip}:${PORT}`);
    }

    if (PUBLIC_IP) {
      console.log(`  - IP público ..... http://${PUBLIC_IP}:${PORT}`);
    } else {
      console.log('  - IP público ..... (defina PUBLIC_IP no .env quando tiver)');
    }

    console.log('');
    console.log('Endpoints: GET /api/paises | POST /api/sorteio | GET /api/health');
    console.log('Lembrete: libere a porta no Firewall do Windows e no roteador (port forward).');
    console.log('');
  });
}

bootstrap();
