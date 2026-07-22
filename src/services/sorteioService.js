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

async function carregarGastronomia(executor, paisId) {
  const pratos = await executor.query(
    `SELECT prato_principal, sobremesa,
            imagem_prato_principal, imagem_sobremesa
     FROM pratos WHERE pais_id = ?`,
    [paisId]
  );
  const curiosidades = await executor.query(
    'SELECT prato_principal, sobremesa FROM curiosidade WHERE pais_id = ?',
    [paisId]
  );

  return {
    prato: pratos[0] || null,
    curiosidade: curiosidades[0] || null,
  };
}

function montarPayloadPais(pais, gastronomia, tipo) {
  const pratoNome =
    tipo === 'principal'
      ? gastronomia.prato?.prato_principal
      : gastronomia.prato?.sobremesa;
  const curiosidadeTexto =
    tipo === 'principal'
      ? gastronomia.curiosidade?.prato_principal
      : gastronomia.curiosidade?.sobremesa;
  const imagem =
    tipo === 'principal'
      ? gastronomia.prato?.imagem_prato_principal
      : gastronomia.prato?.imagem_sobremesa;

  return {
    id: pais.id,
    nome: pais.nome,
    continente: pais.continente,
    prato: pratoNome || 'Prato típico a descobrir',
    curiosidade:
      curiosidadeTexto ||
      'Dica e recomendação: curiosidade gastronômica em breve para este país.',
    imagem: imagem || null,
  };
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

    const gastroPrincipal = await carregarGastronomia(trx, principal.id);
    const gastroSobremesa = await carregarGastronomia(trx, sobremesa.id);

    return {
      email: emailNormalizado,
      prato_principal: montarPayloadPais(principal, gastroPrincipal, 'principal'),
      sobremesa: montarPayloadPais(sobremesa, gastroSobremesa, 'sobremesa'),
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
