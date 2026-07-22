/**
 * Valida se cada prato do seed tem imagem local correspondente e legível.
 */
const fs = require('fs');
const path = require('path');
const { DADOS_GASTRONOMICOS, imagemUrl, slugify } = require('../src/db/seedPratosCuriosidades');

const OUT_DIR = path.join(__dirname, '..', 'public', 'img', 'pratos');

function main() {
  const entries = Object.entries(DADOS_GASTRONOMICOS);
  let ok = 0;
  let missing = 0;
  let small = 0;
  const problemas = [];

  for (const [pais] of entries) {
    for (const tipo of ['principal', 'sobremesa']) {
      const web = imagemUrl(pais, tipo);
      const file = `${slugify(pais)}-${tipo}.jpg`;
      const abs = path.join(OUT_DIR, file);

      if (!fs.existsSync(abs)) {
        missing += 1;
        problemas.push({ pais, tipo, erro: 'arquivo ausente', web });
        continue;
      }

      const size = fs.statSync(abs).size;
      if (size < 2000) {
        small += 1;
        problemas.push({ pais, tipo, erro: `muito pequeno (${size}b)`, web });
        continue;
      }

      // magic bytes JPEG/PNG/WEBP
      const buf = fs.readFileSync(abs);
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
      const isPng = buf[0] === 0x89 && buf[1] === 0x50;
      const isWebp = buf.toString('ascii', 0, 4) === 'RIFF';
      if (!isJpeg && !isPng && !isWebp) {
        problemas.push({ pais, tipo, erro: 'formato inválido', web });
        continue;
      }

      ok += 1;
    }
  }

  console.log(`Total esperado: ${entries.length * 2}`);
  console.log(`OK: ${ok}`);
  console.log(`Ausentes: ${missing}`);
  console.log(`Pequenos/inválidos: ${small + problemas.filter((p) => p.erro.startsWith('formato')).length}`);
  if (problemas.length) {
    console.log('\nProblemas:');
    for (const p of problemas.slice(0, 40)) {
      console.log(` - ${p.pais}/${p.tipo}: ${p.erro}`);
    }
    if (problemas.length > 40) console.log(` ... +${problemas.length - 40}`);
    process.exitCode = 1;
  } else {
    console.log('Todas as imagens locais estão válidas.');
  }
}

main();
