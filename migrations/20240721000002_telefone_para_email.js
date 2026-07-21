/**
 * Troca a chave telefone por email na tabela escolhidos
 * (bancos que já rodaram a migration antiga).
 */
module.exports = {
  name: '20240721000002_telefone_para_email',
  async up(db) {
    const cols = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'escolhidos'
    `);
    const nomes = cols.map((c) => c.column_name);

    if (nomes.includes('telefone') && !nomes.includes('email')) {
      await db.exec(`
        ALTER TABLE escolhidos RENAME COLUMN telefone TO email;
        ALTER TABLE escolhidos ALTER COLUMN email TYPE VARCHAR(254);
      `);
      return;
    }

    if (!nomes.includes('email')) {
      await db.exec(`
        ALTER TABLE escolhidos ADD COLUMN email VARCHAR(254);
      `);
    }
  },
  async down(db) {
    const cols = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'escolhidos'
    `);
    const nomes = cols.map((c) => c.column_name);

    if (nomes.includes('email') && !nomes.includes('telefone')) {
      await db.exec(`
        ALTER TABLE escolhidos RENAME COLUMN email TO telefone;
        ALTER TABLE escolhidos ALTER COLUMN telefone TYPE VARCHAR(20);
      `);
    }
  },
};
