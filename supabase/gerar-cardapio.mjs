// Gera o 02-cardapio.sql a partir do cardápio do index.html (o preço escrito no site é o preço do banco).
// Uso: node supabase/gerar-cardapio.mjs   (depois rode o 02-cardapio.sql no SQL Editor do Supabase)
// Mudou um preço no site? Rode de novo e cole o arquivo no Supabase, senão o pedido sai com o preço antigo.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
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

// sabores: cartões com data-sabor (ou, no formato antigo, o texto de cada <li>)
const ulSab = html.match(/<ul class="flavors[^"]*">([\s\S]*?)<\/ul>/)[1];
let sabores = [...ulSab.matchAll(/data-sabor="([^"]+)"/g)].map(x => ent(x[1]).trim());
if (!sabores.length) sabores = [...ulSab.matchAll(/<li>([^<]+)<\/li>/g)].map(x => ent(x[1]).trim());
if (!produtos.length || produtos.some(p => !p.id || !p.nome || !(p.preco > 0))) throw new Error('cardápio não lido direito: ' + JSON.stringify(produtos));

const q = s => `'${String(s).replace(/'/g, "''")}'`;
const sql = `-- Gerado por supabase/gerar-cardapio.mjs a partir do index.html em ${new Date().toISOString().slice(0, 10)}. Não edite à mão:
-- mude o preço no site e rode o gerador de novo.
-- ${produtos.length} produtos e ${sabores.length} sabores.

insert into public.produtos (id, nome, detalhe, preco_centavos, pede_sabores, ativo, ordem) values
${produtos.map(p => `  (${q(p.id)}, ${q(p.nome)}, ${q(p.detalhe)}, ${p.preco}, ${p.sabores}, true, ${p.ordem})`).join(',\n')}
on conflict (id) do update set nome = excluded.nome, detalhe = excluded.detalhe, preco_centavos = excluded.preco_centavos,
  pede_sabores = excluded.pede_sabores, ativo = true, ordem = excluded.ordem;

-- o que saiu do site fica inativo (não aparece e não pode ser pedido), mas continua nos pedidos antigos
update public.produtos set ativo = false where id not in (${produtos.map(p => q(p.id)).join(', ')});

update public.loja_config set sabores = array[${sabores.map(q).join(', ')}] where id = 1;
`;
writeFileSync(join(here, '02-cardapio.sql'), sql);

// instalar.sql: tudo num arquivo só (estrutura + cardápio + acesso do dono), para colar uma vez no SQL Editor
const estrutura = readFileSync(join(here, '01-estrutura.sql'), 'utf8');
const dono = `
-- =====================================================================================
-- Acesso do dono ao painel. Antes de rodar: crie a conta em Authentication > Users > Add user
-- e troque o e-mail e o nome abaixo. (Rodar sem trocar não faz nada.)
-- =====================================================================================
insert into public.equipe (user_id, nome, papel)
select id, 'Dono da Coxitas', 'dono' from auth.users where email = 'EMAIL-DO-DONO@exemplo.com'
on conflict (user_id) do update set nome = excluded.nome, papel = 'dono', ativo = true;

-- confere: deve aparecer uma linha com o e-mail do dono e papel "dono"
select u.email, e.nome, e.papel, e.ativo from public.equipe e join auth.users u on u.id = e.user_id;
`;
writeFileSync(join(here, 'instalar.sql'), `-- Coxitas · instalação completa do banco de pedidos (gerado por supabase/gerar-cardapio.mjs; não edite à mão,
-- só o e-mail do dono lá no fim). Cole tudo no SQL Editor do Supabase e clique em Run. Pode rodar de novo.

${estrutura}
${sql}
${dono}`);
console.log(`02-cardapio.sql e instalar.sql: ${produtos.length} produtos, ${sabores.length} sabores`);
produtos.forEach(p => console.log(`  ${p.id.padEnd(18)} ${String(p.preco).padStart(6)}  ${p.nome} · ${p.detalhe}`));
