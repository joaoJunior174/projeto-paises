const db = require('../config/database');

async function idsPaisesJaEscolhidos(executor = db) {
  const rows = await executor.query(
    'SELECT pais_principal_id, pais_sobremesa_id FROM escolhidos'
  );
  const ids = new Set();
  for (const row of rows) {
    ids.add(row.pais_principal_id);
    ids.add(row.pais_sobremesa_id);
  }
  return [...ids];
}

async function listarPaisesDisponiveis() {
  await db.ready;

  const usados = await idsPaisesJaEscolhidos();
  const excluidosRows = await db.query('SELECT pais_id FROM exclusoes');
  const excluidos = excluidosRows.map((r) => r.pais_id);
  const bloqueados = [...new Set([...usados, ...excluidos])];

  if (!bloqueados.length) {
    return db.query(
      'SELECT id, nome, continente, peso FROM paises ORDER BY nome ASC'
    );
  }

  const placeholders = bloqueados.map(() => '?').join(', ');
  return db.query(
    `SELECT id, nome, continente, peso FROM paises WHERE id NOT IN (${placeholders}) ORDER BY nome ASC`,
    bloqueados
  );
}

function sortearComPeso(paises) {
  if (!paises.length) {
    return null;
  }

  const total = paises.reduce((acc, p) => acc + Number(p.peso || 1), 0);
  let sorteio = Math.random() * total;

  for (const pais of paises) {
    sorteio -= Number(pais.peso || 1);
    if (sorteio <= 0) {
      return pais;
    }
  }

  return paises[paises.length - 1];
}

async function realizarSorteio(email) {
  await db.ready;

  const emailNormalizado = normalizarEmail(email);

  if (!emailNormalizado) {
    const erro = new Error('E-mail inválido. Exemplo: nome@empresa.com');
    erro.status = 400;
    throw erro;
  }

  const jaExiste = await db.query('SELECT email FROM escolhidos WHERE email = ?', [
    emailNormalizado,
  ]);

  if (jaExiste.length) {
    const erro = new Error('Este e-mail já participou do sorteio.');
    erro.status = 409;
    throw erro;
  }

  return db.transaction(async (trx) => {
    const usados = await idsPaisesJaEscolhidos(trx);
    const excluidosRows = await trx.query('SELECT pais_id FROM exclusoes');
    const excluidos = excluidosRows.map((r) => r.pais_id);
    const bloqueados = [...new Set([...usados, ...excluidos])];

    let disponiveis;
    if (!bloqueados.length) {
      disponiveis = await trx.query(
        'SELECT id, nome, continente, peso FROM paises'
      );
    } else {
      const placeholders = bloqueados.map(() => '?').join(', ');
      disponiveis = await trx.query(
        `SELECT id, nome, continente, peso FROM paises WHERE id NOT IN (${placeholders})`,
        bloqueados
      );
    }

    if (disponiveis.length < 2) {
      const erro = new Error('Não há países suficientes disponíveis para o sorteio.');
      erro.status = 422;
      throw erro;
    }

    const principal = sortearComPeso(disponiveis);
    const restantes = disponiveis.filter((p) => p.id !== principal.id);
    const sobremesa = sortearComPeso(restantes);

    await trx.run(
      'INSERT INTO escolhidos (email, pais_principal_id, pais_sobremesa_id) VALUES (?, ?, ?)',
      [emailNormalizado, principal.id, sobremesa.id]
    );

    return {
      email: emailNormalizado,
      prato_principal: {
        id: principal.id,
        nome: principal.nome,
        continente: principal.continente,
      },
      sobremesa: {
        id: sobremesa.id,
        nome: sobremesa.nome,
        continente: sobremesa.continente,
      },
    };
  });
}

function normalizarEmail(email) {
  if (!email) return null;
  const valor = String(email).trim().toLowerCase();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(valor) || valor.length > 254) {
    return null;
  }
  return valor;
}

module.exports = {
  listarPaisesDisponiveis,
  realizarSorteio,
  normalizarEmail,
};
