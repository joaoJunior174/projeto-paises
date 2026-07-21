require('dotenv').config();
const db = require('../src/config/database');
const { runSeed } = require('../src/db/seedData');

runSeed(db)
  .then((info) => {
    console.log(
      `Seed concluído: ${info.total} países. Excluídos: ${info.excluidos.join(', ')}`
    );
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (db.pg) await db.pg.end();
  });
