/**
 * Migration PostgreSQL — cria tabelas paises, escolhidos e exclusoes.
 */

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS paises (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL UNIQUE,
    continente VARCHAR(40) NOT NULL,
    peso INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS escolhidos (
    email VARCHAR(254) PRIMARY KEY,
    pais_principal_id INTEGER NOT NULL REFERENCES paises(id),
    pais_sobremesa_id INTEGER NOT NULL REFERENCES paises(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS exclusoes (
    id SERIAL PRIMARY KEY,
    pais_id INTEGER NOT NULL UNIQUE REFERENCES paises(id),
    motivo VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const DROP_SQL = `
  DROP TABLE IF EXISTS exclusoes;
  DROP TABLE IF EXISTS escolhidos;
  DROP TABLE IF EXISTS paises;
`;

module.exports = {
  name: '20240721000001_create_tables',
  async up(db) {
    await db.exec(CREATE_SQL);
  },
  async down(db) {
    await db.exec(DROP_SQL);
  },
};
