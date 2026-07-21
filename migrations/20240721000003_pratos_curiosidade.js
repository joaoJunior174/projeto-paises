/**
 * Cria tabelas pratos e curiosidade vinculadas a paises.
 */

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS pratos (
    id SERIAL PRIMARY KEY,
    pais_id INTEGER NOT NULL UNIQUE REFERENCES paises(id) ON DELETE CASCADE,
    prato_principal TEXT NOT NULL,
    sobremesa TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS curiosidade (
    id SERIAL PRIMARY KEY,
    pais_id INTEGER NOT NULL UNIQUE REFERENCES paises(id) ON DELETE CASCADE,
    prato_principal TEXT NOT NULL,
    sobremesa TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_pratos_pais_id ON pratos(pais_id);
  CREATE INDEX IF NOT EXISTS idx_curiosidade_pais_id ON curiosidade(pais_id);
`;

const DROP_SQL = `
  DROP TABLE IF EXISTS curiosidade;
  DROP TABLE IF EXISTS pratos;
`;

module.exports = {
  name: '20240721000003_pratos_curiosidade',
  async up(db) {
    await db.exec(CREATE_SQL);
  },
  async down(db) {
    await db.exec(DROP_SQL);
  },
};
