// Atualiza no vercel.json a lista de scripts escritos dentro do HTML que o navegador pode rodar (Content-Security-Policy).
// Rode sempre que mudar um <script> sem src em index.html ou 404.html; sem isso o navegador bloqueia o script mudado.
//
// Uso:  node ferramentas/cabecalhos.mjs          (atualiza)
//       node ferramentas/cabecalhos.mjs --conferir (só confere; sai com erro se estiver desatualizado)
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const hashes = new Set();
for (const f of ['index.html', '404.html', 'pedido/index.html']) {
  // o GitHub guarda com LF (é o que a Vercel serve), mesmo que o Windows mostre CRLF na pasta
  const html = readFileSync(join(raiz, f), 'utf8').replace(/\r\n/g, '\n');
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1] || '';
    if (/\ssrc=/.test(attrs) || /application\/ld\+json/.test(attrs)) continue;
    hashes.add(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
  }
}
const arq = join(raiz, 'vercel.json');
const txt = readFileSync(arq, 'utf8');
const lista = [...hashes].join(' ');
// troca o que vem depois de "script-src 'self'" na política do site (a do painel não tem script escrito no HTML)
const novo = txt.replace(/(default-src 'self'; script-src 'self') (?:HASHES|(?:'sha256-[A-Za-z0-9+/=]+' ?)+);/, `$1 ${lista};`);
if (process.argv.includes('--conferir')) {
  if (novo !== txt) { console.error('vercel.json desatualizado: rode node ferramentas/cabecalhos.mjs'); process.exit(1); }
  console.log('vercel.json em dia:', lista);
} else {
  writeFileSync(arq, novo);
  JSON.parse(novo);
  console.log(novo === txt ? 'Nada mudou.' : 'vercel.json atualizado:', lista);
}
