/**
 * Preenche imagens faltantes usando apenas Wikimedia (download estável).
 * node scripts/fillMissingPratoImages.js
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');
const { DADOS_GASTRONOMICOS, slugify } = require('../src/db/seedPratosCuriosidades');

const OUT_DIR = path.join(__dirname, '..', 'public', 'img', 'pratos');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const UA = 'ProjetoPaises/1.0 (educational dish images; fill gaps)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function limpar(nome) {
  return String(nome)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function queriesPara(nome, keyword) {
  const kw = String(keyword || '')
    .replace(/,/g, ' ')
    .replace(/\b(com|de|da|do|e)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const base = limpar(nome);
  const palavras = base.split(/\s+/).filter((p) => p.length > 2);
  return [...new Set([kw, base, palavras.slice(0, 2).join(' '), palavras[0]].filter((q) => q && q.length > 2))];
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
  });
  if (res.status === 429) {
    await sleep(5000);
    throw new Error('429');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function baixar(url, dest) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`DL ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2500) throw new Error('pequeno');
  const ok =
    (buf[0] === 0xff && buf[1] === 0xd8) ||
    (buf[0] === 0x89 && buf[1] === 0x50) ||
    buf.toString('ascii', 0, 4) === 'RIFF';
  if (!ok) throw new Error('formato');
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function commonsUrls(q) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: q,
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '800',
    format: 'json',
  });
  const data = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`);
  const pages = data.query?.pages ? Object.values(data.query.pages) : [];
  return pages
    .map((p) => {
      const info = p.imageinfo?.[0];
      if (!info) return null;
      const mime = String(info.mime || '');
      if (!mime.startsWith('image/') || mime.includes('svg')) return null;
      const url = info.thumburl || info.url;
      if (!url || !url.includes('upload.wikimedia.org')) return null;
      return { url, titulo: p.title, fonte: 'commons' };
    })
    .filter(Boolean);
}

async function wikiUrls(q) {
  const title = encodeURIComponent(q.replace(/\s+/g, '_'));
  const out = [];
  for (const lang of ['en', 'pt']) {
    try {
      const data = await fetchJson(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${title}`
      );
      const url = data.thumbnail?.source || data.originalimage?.source;
      if (url && data.type !== 'disambiguation' && url.includes('upload.wikimedia.org')) {
        out.push({ url, titulo: data.title, fonte: `${lang}.wiki` });
      }
    } catch (_) {}
  }
  return out;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = fs.existsSync(MANIFEST)
    ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
    : {};

  const missing = [];
  for (const [pais, dados] of Object.entries(DADOS_GASTRONOMICOS)) {
    const [prato, sobremesa, , , kwP, kwS] = dados;
    for (const [tipo, nome, keyword] of [
      ['principal', prato, kwP],
      ['sobremesa', sobremesa, kwS],
    ]) {
      const file = `${slugify(pais)}-${tipo}.jpg`;
      const dest = path.join(OUT_DIR, file);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 2500) continue;
      missing.push({ pais, tipo, nome, keyword, file, dest });
    }
  }

  console.log(`Faltam ${missing.length} imagens. Preenchendo via Wikimedia...`);
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < missing.length; i++) {
    const job = missing[i];
    process.stdout.write(`[${i + 1}/${missing.length}] ${job.pais}/${job.tipo} (${job.nome}) ... `);
    const qs = queriesPara(job.nome, job.keyword);
    let salvo = null;
    let lastErr = null;

    for (const q of qs.slice(0, 2)) {
      let cands = [];
      try {
        cands = cands.concat(await wikiUrls(q));
      } catch (e) {
        lastErr = e;
      }
      await sleep(250);
      try {
        cands = cands.concat(await commonsUrls(`${q} food`));
      } catch (e) {
        lastErr = e;
      }

      for (const c of cands.slice(0, 4)) {
        try {
          const bytes = await baixar(c.url, job.dest);
          salvo = { ...c, bytes, query: q };
          break;
        } catch (e) {
          lastErr = e;
          await sleep(200);
        }
      }
      if (salvo) break;
      await sleep(500);
    }

    const key = `${job.pais}|${job.tipo}`;
    if (salvo) {
      ok += 1;
      manifest[key] = {
        pais: job.pais,
        tipo: job.tipo,
        prato: job.nome,
        arquivo: `/img/pratos/${job.file}`,
        fonte: salvo.fonte,
        titulo: salvo.titulo,
        query: salvo.query,
        urlOriginal: salvo.url,
        bytes: salvo.bytes,
        status: 'ok',
      };
      console.log(`OK ${Math.round(salvo.bytes / 1024)}KB [${salvo.fonte}]`);
    } else {
      fail += 1;
      manifest[key] = {
        pais: job.pais,
        tipo: job.tipo,
        prato: job.nome,
        arquivo: null,
        erro: lastErr?.message || 'falha',
        status: 'fail',
      };
      console.log(`FALHA: ${lastErr?.message || 'sem imagem'}`);
    }

    if ((i + 1) % 5 === 0) {
      fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    }
    await sleep(600);
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\n=== Resumo fill ===\nOK: ${ok}\nFalhas: ${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
