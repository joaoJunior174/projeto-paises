/**
 * Adiciona URLs de imagem aos pratos (principal e sobremesa).
 */

module.exports = {
  name: '20240721000004_pratos_imagens',
  async up(db) {
    await db.exec(`
      ALTER TABLE pratos ADD COLUMN IF NOT EXISTS imagem_prato_principal TEXT;
      ALTER TABLE pratos ADD COLUMN IF NOT EXISTS imagem_sobremesa TEXT;
    `);
  },
  async down(db) {
    await db.exec(`
      ALTER TABLE pratos
        DROP COLUMN IF EXISTS imagem_prato_principal,
        DROP COLUMN IF EXISTS imagem_sobremesa;
    `);
  },
};
