/**
 * Testes do fluxo com e-mail.
 * - Sempre: validação + checagem de arquivos do front/API
 * - Com servidor: integração HTTP em http://localhost:3000
 *
 * Uso: npm run test:email
 */
const fs = require('fs');
const path = require('path');
const { normalizarEmail } = require('../src/services/sorteioService');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const root = path.join(__dirname, '..');

function assert(condicao, mensagem) {
  if (!condicao) {
    throw new Error(mensagem);
  }
}

function testValidacaoEmail() {
  assert(normalizarEmail('Nome@Empresa.COM') === 'nome@empresa.com', 'deve normalizar e-mail');
  assert(normalizarEmail(' ok@mail.com ') === 'ok@mail.com', 'deve trimar e-mail');
  assert(normalizarEmail('invalido') === null, 'deve rejeitar e-mail inválido');
  assert(normalizarEmail('') === null, 'deve rejeitar vazio');
  assert(normalizarEmail(null) === null, 'deve rejeitar null');
  assert(normalizarEmail('a@b.c') === 'a@b.c', 'deve aceitar e-mail simples');
  console.log('OK validação de e-mail');
}

function testArquivos() {
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');
  const route = fs.readFileSync(path.join(root, 'src', 'routes', 'sorteio.js'), 'utf8');
  const service = fs.readFileSync(path.join(root, 'src', 'services', 'sorteioService.js'), 'utf8');
  const migration = fs.readFileSync(
    path.join(root, 'migrations', '20240721000001_create_tables.js'),
    'utf8'
  );

  assert(html.includes('id="email"'), 'HTML deve ter campo email');
  assert(!html.includes('id="telefone"'), 'HTML não deve ter campo telefone');
  assert(html.toLowerCase().includes('e-mail'), 'HTML deve mencionar e-mail');

  assert(js.includes("getElementById('email')"), 'JS deve ler o campo email');
  assert(js.includes("JSON.stringify({ email })"), 'JS deve enviar email no POST');
  assert(!js.includes('telefone'), 'JS não deve referenciar telefone');

  assert(route.includes('{ email }'), 'rota deve ler email do body');
  assert(!route.includes('telefone'), 'rota não deve usar telefone');

  assert(service.includes('normalizarEmail'), 'service deve ter normalizarEmail');
  assert(service.includes('INSERT INTO escolhidos (email'), 'insert deve usar email');
  assert(!service.includes('telefone'), 'service não deve usar telefone');

  assert(migration.includes('email VARCHAR(254) PRIMARY KEY'), 'migration deve usar email como PK');
  assert(!migration.includes('telefone'), 'migration inicial não deve usar telefone');

  console.log('OK arquivos (front, rota, service, migration)');
}

async function request(pathname, options = {}) {
  const res = await fetch(`${BASE}${pathname}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function servidorDisponivel() {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch (_) {
    return false;
  }
}

async function testApi() {
  const health = await request('/api/health');
  assert(health.status === 200, `health falhou: ${health.status}`);

  const paises = await request('/api/paises');
  assert(paises.status === 200, `GET /api/paises falhou: ${paises.status}`);
  assert(Array.isArray(paises.data.paises), 'lista de países inválida');
  assert(paises.data.total >= 2, 'precisa de ao menos 2 países para sortear');
  console.log(`OK GET /api/paises (${paises.data.total} disponíveis)`);

  const email = `teste.${Date.now()}@exemplo.com`;

  const invalid = await request('/api/sorteio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nao-e-email' }),
  });
  assert(invalid.status === 400, `e-mail inválido deveria retornar 400, veio ${invalid.status}`);
  console.log('OK POST /api/sorteio e-mail inválido (400)');

  const missing = await request('/api/sorteio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert(missing.status === 400, `sem e-mail deveria retornar 400, veio ${missing.status}`);
  console.log('OK POST /api/sorteio sem e-mail (400)');

  const before = paises.data.total;
  const sorteio = await request('/api/sorteio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  assert(sorteio.status === 201, `sorteio falhou: ${sorteio.status} ${JSON.stringify(sorteio.data)}`);
  assert(sorteio.data.email === email, 'e-mail retornado diferente');
  assert(sorteio.data.prato_principal?.nome, 'faltou prato principal');
  assert(sorteio.data.sobremesa?.nome, 'faltou sobremesa');
  assert(
    sorteio.data.prato_principal.id !== sorteio.data.sobremesa.id,
    'países do sorteio não podem ser iguais'
  );
  console.log(
    `OK POST /api/sorteio => ${sorteio.data.prato_principal.nome} / ${sorteio.data.sobremesa.nome}`
  );

  const dup = await request('/api/sorteio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  assert(dup.status === 409, `e-mail duplicado deveria retornar 409, veio ${dup.status}`);
  console.log('OK POST /api/sorteio e-mail duplicado (409)');

  const depois = await request('/api/paises');
  assert(
    depois.data.total === before - 2,
    `esperava ${before - 2} países, veio ${depois.data.total}`
  );
  console.log('OK países removidos da lista após sorteio');

  const home = await fetch(`${BASE}/`);
  assert(home.status === 200, 'front HTML não respondeu 200');
  const html = await home.text();
  assert(html.includes('id="email"'), 'front deveria ter campo email');
  assert(!html.includes('id="telefone"'), 'front não deveria ter campo telefone');
  console.log('OK front servido com campo e-mail');
}

async function main() {
  try {
    testValidacaoEmail();
    testArquivos();

    if (await servidorDisponivel()) {
      await testApi();
    } else {
      console.log(
        'AVISO: servidor/API indisponível (PostgreSQL provavelmente offline). Testes HTTP pulados.'
      );
    }

    console.log('\nTodos os testes executáveis passaram.');
  } catch (err) {
    console.error('\nFalha nos testes:', err.message);
    process.exitCode = 1;
  }
}

main();
