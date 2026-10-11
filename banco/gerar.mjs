// Gera banco/cardapio.sql (a partir do cardápio do index.html) e lib/esquema.js (esquema + cardápio que a API
// instala sozinha). Rode depois de mudar preço, item ou sabor no site:  node banco/gerar.mjs
// O preço que vale no pedido é o do banco; o navegador não consegue mudar o valor.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const raiz = join(here, '..');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');
const ent = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const centavos = s => Math.round(parseFloat(s.replace(/[^\d,]/g, '').replace(',', '.')) * 100);
const attr = (tag, nome) => { const m = tag.match(new RegExp(`${nome}="([^"]*)"`)); return m ? ent(m[1]) : ''; };

const produtos = [];
const re = /<article class="prod( prod-opt)?"[^>]*>[\s\S]*?<\/article>/g;
let m, ordem = 0;
while ((m = re.exec(html))) {
  const bloco = m[0], tag = bloco.slice(0, bloco.indexOf('>') + 1);
  const id = attr(tag, 'data-id'), nome = attr(tag, 'data-nome');
  if (m[1]) {
    const un = attr(tag, 'data-un');
    for (const r of bloco.matchAll(/<input type="radio"[^>]*value="(\d+)"[^>]*><span><b>[^<]*<\/b><em>([^<]+)<\/em>/g)) {
      produtos.push({ id: `${id}-${r[1]}`, nome, detalhe: `${r[1]} ${un}`, preco: centavos(r[2]), ordem: ordem++ });
    }
  } else {
    const preco = bloco.match(/data-price[^>]*><small>R\$<\/small>\s*([\d.,]+)/);
    produtos.push({ id, nome, detalhe: attr(tag, 'data-detalhe'), preco: centavos(preco[1]), ordem: ordem++ });
  }
}
// combos e salgados por quantidade: o cliente escolhe os sabores (o mesmo critério do site)
produtos.forEach(p => { p.sabores = /^(combo|salgados)-/.test(p.id); });
const ulSab = html.match(/<ul class="flavors[^"]*">([\s\S]*?)<\/ul>/)[1];
const sabores = [...ulSab.matchAll(/data-sabor="([^"]+)"/g)].map(x => ent(x[1]).trim());
if (!produtos.length || !sabores.length || produtos.some(p => !p.id || !p.nome || !(p.preco > 0))) throw new Error('cardápio não lido direito');

const q = s => `'${String(s).replace(/'/g, "''")}'`;
const cardapio = `-- Gerado por banco/gerar.mjs a partir do index.html. Não edite à mão: mude o site e rode o gerador de novo.
-- ${produtos.length} produtos e ${sabores.length} sabores.
insert into public.produtos (id, nome, detalhe, preco_centavos, pede_sabores, ativo, ordem) values
${produtos.map(p => `  (${q(p.id)}, ${q(p.nome)}, ${q(p.detalhe)}, ${p.preco}, ${p.sabores}, true, ${p.ordem})`).join(',\n')}
on conflict (id) do update set nome = excluded.nome, detalhe = excluded.detalhe, preco_centavos = excluded.preco_centavos,
  pede_sabores = excluded.pede_sabores, ativo = true, ordem = excluded.ordem;
-- o que saiu do site fica inativo (não pode ser pedido), mas continua nos pedidos antigos
update public.produtos set ativo = false where id not in (${produtos.map(p => q(p.id)).join(', ')});
update public.loja_config set sabores = array[${sabores.map(q).join(', ')}] where id = 1;
`;
writeFileSync(join(here, 'cardapio.sql'), cardapio);

const esquema = readFileSync(join(here, 'esquema.sql'), 'utf8').replace(/\r\n/g, '\n');
const tudo = `${esquema}\n${cardapio}`;
const versao = createHash('sha256').update(tudo).digest('hex').slice(0, 16);
writeFileSync(join(raiz, 'lib', 'esquema.js'), `// Gerado por banco/gerar.mjs (esquema.sql + cardapio.sql). Não edite à mão.
// A API compara VERSAO com a gravada no banco e, se mudou, roda o SQL de novo (ele é seguro para repetir).
export const VERSAO = '${versao}';
export const SQL = ${JSON.stringify(tudo)};
`);
console.log(`banco/cardapio.sql e lib/esquema.js (versão ${versao}): ${produtos.length} produtos, ${sabores.length} sabores`);
