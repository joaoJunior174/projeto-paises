/**
 * Download rápido e paralelo das imagens dos pratos.
 * Fontes: Openverse + Wikimedia Commons.
 *
 * node scripts/downloadPratoImages.js
 * node scripts/downloadPratoImages.js --force
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');
const { DADOS_GASTRONOMICOS } = require('../src/db/seedPratosCuriosidades');

const OUT_DIR = path.join(__dirname, '..', 'public', 'img', 'pratos');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const UA = 'ProjetoPaises/1.0 (educational; dish image seed)';
const CONCURRENCY = 3;

function slugify(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function limparNome(nome) {
  return String(nome)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function queryBusca(nome, keyword) {
  const kw = String(keyword || '')
    .replace(/,/g, ' ')
    .replace(/\b(com|de|da|do|e)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (kw.length > 3) return kw;
  return limparNome(nome).split(/\s+/).slice(0, 3).join(' ');
}

function nomeArquivo(pais, tipo) {
  return `${slugify(pais)}-${tipo}.jpg`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 429) {
    await sleep(2500);
    throw new Error('429');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function baixar(url, dest) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
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

async function urlsOpenverse(q) {
  const params = new URLSearchParams({
    q,
    page_size: '6',
    license: 'cc0,by,by-sa,pdm',
  });
  const data = await fetchJson(`https://api.openverse.org/v1/images/?${params}`);
  const out = [];
  for (const r of data.results || []) {
    if (r.thumbnail) out.push({ url: r.thumbnail, fonte: 'openverse', titulo: r.title || q });
    if (r.url) out.push({ url: r.url, fonte: 'openverse', titulo: r.title || q });
  }
  return out;
}

async function urlsCommons(q) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${q} food dish`,
    gsrnamespace: '6',
    gsrlimit: '6',
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
      if (!info || !String(info.mime || '').startsWith('image/') || String(info.mime).includes('svg')) {
        return null;
      }
      return {
        url: info.thumburl || info.url,
        fonte: 'commons',
        titulo: p.title,
      };
    })
    .filter(Boolean);
}

async function urlsWikipedia(q) {
  const title = encodeURIComponent(q.replace(/\s+/g, '_'));
  const out = [];
  for (const lang of ['en', 'pt']) {
    try {
      const data = await fetchJson(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${title}`
      );
      const url = data.thumbnail?.source || data.originalimage?.source;
      if (url && data.type !== 'disambiguation') {
        out.push({ url, fonte: `${lang}.wiki`, titulo: data.title });
      }
    } catch (_) {}
  }
  return out;
}

async function baixarPrato(job) {
  const dest = path.join(OUT_DIR, job.file);
  const q = queryBusca(job.nome, job.keyword);
  const candidatos = [];
  const vistos = new Set();

  const add = (lista) => {
    for (const c of lista) {
      if (c?.url && !vistos.has(c.url)) {
        vistos.add(c.url);
        candidatos.push(c);
      }
    }
  };

  try {
    add(await urlsOpenverse(q));
  } catch (_) {}
  if (candidatos.length < 2) {
    try {
      add(await urlsWikipedia(q));
    } catch (_) {}
  }
  if (candidatos.length < 2) {
    try {
      add(await urlsCommons(q));
    } catch (_) {}
  }
  if (!candidatos.length && q !== limparNome(job.nome)) {
    try {
      add(await urlsOpenverse(limparNome(job.nome).split(/\s+/).slice(0, 2).join(' ')));
    } catch (_) {}
  }

  let lastErr = new Error('sem candidatos');
  for (const c of candidatos.slice(0, 8)) {
    try {
      const bytes = await baixar(c.url, dest);
      return { ...c, bytes, query: q };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function mapPool(items, limit, worker) {
  const ret = new Array(items.length);
  let idx = 0;
  async function run() {
    while (idx < items.length) {
      const i = idx++;
      ret[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return ret;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const force = process.argv.includes('--force');
  const manifest = fs.existsSync(MANIFEST)
    ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
    : {};

  const jobs = [];
  for (const [pais, dados] of Object.entries(DADOS_GASTRONOMICOS)) {
    const [prato, sobremesa, , , kwP, kwS] = dados;
    for (const [tipo, nome, keyword] of [
      ['principal', prato, kwP],
      ['sobremesa', sobremesa, kwS],
    ]) {
      const file = nomeArquivo(pais, tipo);
      const dest = path.join(OUT_DIR, file);
      if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 2500) {
        manifest[`${pais}|${tipo}`] = {
          pais,
          tipo,
          prato: nome,
          arquivo: `/img/pratos/${file}`,
          status: 'local',
        };
        continue;
      }
      jobs.push({ pais, tipo, nome, keyword, file });
    }
  }

  console.log(`Pendentes: ${jobs.length} | já locais: ${394 - jobs.length}`);

  let ok = 0;
  let fail = 0;

  await mapPool(jobs, CONCURRENCY, async (job, i) => {
    const key = `${job.pais}|${job.tipo}`;
    process.stdout.write(`[${i + 1}/${jobs.length}] ${job.pais}/${job.tipo} ... `);
    try {
      const r = await baixarPrato(job);
      manifest[key] = {
        pais: job.pais,
        tipo: job.tipo,
        prato: job.nome,
        arquivo: `/img/pratos/${job.file}`,
        fonte: r.fonte,
        titulo: r.titulo,
        query: r.query,
        urlOriginal: r.url,
        bytes: r.bytes,
        status: 'ok',
      };
      ok += 1;
      console.log(`OK ${Math.round(r.bytes / 1024)}KB [${r.fonte}]`);
    } catch (err) {
      fail += 1;
      manifest[key] = {
        pais: job.pais,
        tipo: job.tipo,
        prato: job.nome,
        arquivo: null,
        erro: err.message,
        status: 'fail',
      };
      console.log(`FALHA: ${err.message}`);
    }
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    }
  });

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log('\n=== Resumo ===');
  console.log(`OK agora: ${ok}`);
  console.log(`Falhas: ${fail}`);
  console.log(`Manifest: ${MANIFEST}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = { slugify, nomeArquivo };
