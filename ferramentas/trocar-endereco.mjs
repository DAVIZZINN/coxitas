// Troca o endereço oficial do site em todos os lugares de uma vez (canonical, compartilhamento, dados para o Google,
// sitemap, robots e página 404) e, se for domínio próprio, cria o arquivo CNAME do GitHub Pages.
//
// Uso:  node ferramentas/trocar-endereco.mjs https://www.coxitas.com.br/
//       node ferramentas/trocar-endereco.mjs https://coxitas.github.io/
// Depois: commit + push. Domínio próprio: Vercel > projeto > Settings > Domains (ver banco/LEIA-ME.md).
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const novo = process.argv[2];
if (!novo || !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[a-z0-9._-]+)*\/$/i.test(novo)) {
  console.error('Passe o endereço novo completo, com https:// e terminando em /. Ex.: https://www.coxitas.com.br/');
  process.exit(1);
}
const atual = readFileSync(join(raiz, 'index.html'), 'utf8').match(/<link rel="canonical" href="([^"]+)"/)[1];
if (atual === novo) { console.log('O site já está com esse endereço.'); process.exit(0); }
const caminhoAtual = new URL(atual).pathname, caminhoNovo = new URL(novo).pathname;
let n = 0;
for (const f of ['index.html', 'sitemap.xml', 'robots.txt', '404.html', 'pedido/index.html', 'admin/index.html']) {
  const p = join(raiz, f);
  if (!existsSync(p)) continue;
  let s = readFileSync(p, 'utf8');
  const antes = s;
  s = s.split(atual).join(novo);
  // a página 404 manda para o começo do site pelo caminho (ex.: /coxitas/ vira /)
  if (f === '404.html') s = s.split(`'${caminhoAtual}'`).join(`'${caminhoNovo}'`).split(`url=${caminhoAtual}"`).join(`url=${caminhoNovo}"`).split(`href="${caminhoAtual}"`).join(`href="${caminhoNovo}"`);
  if (s !== antes) { writeFileSync(p, s); n++; console.log('atualizado:', f); }
}
const host = new URL(novo).hostname;
const cname = join(raiz, 'CNAME');
// CNAME é coisa do GitHub Pages: endereço *.vercel.app ou *.github.io não leva. Domínio próprio na Vercel se liga
// em Settings > Domains do projeto (o CNAME só serve se o GitHub Pages continuar publicando)
if (/\.(github\.io|vercel\.app)$/i.test(host)) { if (existsSync(cname)) rmSync(cname); }
else { writeFileSync(cname, host + '\n'); console.log('CNAME (só para o GitHub Pages):', host); }
console.log(`${n} arquivos com o endereço ${novo} (antes: ${atual}).`);
