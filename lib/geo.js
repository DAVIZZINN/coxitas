// Coxitas · confere no mapa se a rua de entrega existe em Votuporanga e a que distância fica da loja. Só no servidor.
// 1º Nominatim (OpenStreetMap, busca da rua exata na cidade). Se não achar ou estiver fora do ar, Photon (também
// OpenStreetMap, aceita erro de digitação, mas só vale se o nome achado for quase igual ao digitado).
// O resultado fica guardado no banco: 30 dias para rua achada, 1 dia para rua não achada.
// O número da casa não entra na busca: o mapa de Votuporanga quase não tem número, só a rua (para o raio basta).
import { q } from './db.js';

const UA = 'CoxitasSite/1.0 (+https://coxitas.vercel.app)';
const CIDADE = 'Votuporanga';
// retângulo do município (para o Photon não sugerir rua de outra cidade)
const CAIXA = '-50.16,-20.58,-49.85,-20.31';

export const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// "R. Amazonas" -> "Rua Amazonas", "Av Brasil" -> "Avenida Brasil"
const TIPOS = [[/^(r|rua)\.?\s+/i, 'Rua '], [/^(av|avda|avenida)\.?\s+/i, 'Avenida '], [/^(al|alameda)\.?\s+/i, 'Alameda '],
  [/^(tv|trav|travessa)\.?\s+/i, 'Travessa '], [/^(est|estrada)\.?\s+/i, 'Estrada '], [/^(p[cç]a?|praça|praca)\.?\s+/i, 'Praça '],
  [/^(rod|rodovia)\.?\s+/i, 'Rodovia ']];
export function arrumaRua(rua) {
  let r = String(rua || '').replace(/\s+/g, ' ').trim();
  for (const [re, t] of TIPOS) if (re.test(r)) { r = r.replace(re, t); break; }
  return r.slice(0, 120);
}

export function distanciaKm(a, b) {
  const rad = x => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function levenshtein(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let ant = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, ant + (a[i - 1] === b[j - 1] ? 0 : 1)); ant = t; }
  }
  return d[b.length];
}
// nome achado quase igual ao digitado (sem contar "Rua", "Avenida"...): tolera um ou dois erros de digitação
export function parecido(a, b) {
  const tira = s => semAcento(s).replace(/^(rua|avenida|alameda|travessa|estrada|praca|rodovia) /, '');
  a = tira(a); b = tira(b);
  if (!a || !b) return false;
  if (a === b) return true;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length) >= 0.8;
}

const maisPerto = (lista, origem) => lista.sort((x, y) => distanciaKm(origem, x) - distanciaKm(origem, y))[0] || null;

async function nominatim(rua, origem) {
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.search = new URLSearchParams({ street: rua, city: CIDADE, state: 'SP', country: 'Brasil', format: 'jsonv2', addressdetails: '1', limit: '10', 'accept-language': 'pt-BR' }).toString();
  const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`nominatim ${r.status}`);
  const d = await r.json();
  const ruas = d.filter(x => (x.category === 'highway' || x.category === 'place') && x.address && (x.address.road || x.name))
    .map(x => ({ lat: +x.lat, lng: +x.lon, rua: x.address.road || x.name }));
  return maisPerto(ruas, origem);
}

async function photon(rua, origem) {
  const u = new URL('https://photon.komoot.io/api/');
  u.search = new URLSearchParams({ q: `${rua}, ${CIDADE}`, limit: '8', lat: String(origem.lat), lon: String(origem.lng), bbox: CAIXA }).toString();
  const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`photon ${r.status}`);
  const d = await r.json();
  const ruas = (d.features || []).filter(f => f.properties && f.properties.osm_key === 'highway' && semAcento(f.properties.city) === semAcento(CIDADE) && parecido(f.properties.name, rua))
    .map(f => ({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], rua: f.properties.name }));
  return maisPerto(ruas, origem);
}

// { achou: true, lat, lng, rua } | { achou: false } | { indisponivel: true }
export async function conferirRua(ruaDigitada, origem) {
  const rua = arrumaRua(ruaDigitada);
  const chave = `${semAcento(CIDADE)}|${semAcento(rua)}`;
  const c = await q(`select resultado from public.geo_cache where chave = $1
    and criado_em > now() - case when (resultado ->> 'achou')::boolean then interval '30 days' else interval '1 day' end`, [chave]);
  if (c.rows[0]) return c.rows[0].resultado;
  let achado = null, respondeu = false;
  try { achado = await nominatim(rua, origem); respondeu = true; } catch (e) { console.error('mapa (nominatim):', e.message); }
  if (!achado) {
    try { achado = await photon(rua, origem); respondeu = true; } catch (e) { console.error('mapa (photon):', e.message); }
  }
  if (!respondeu) return { indisponivel: true };
  const resultado = achado ? { achou: true, lat: achado.lat, lng: achado.lng, rua: achado.rua } : { achou: false };
  await q(`insert into public.geo_cache (chave, resultado) values ($1, $2::jsonb)
    on conflict (chave) do update set resultado = excluded.resultado, criado_em = now()`, [chave, JSON.stringify(resultado)]);
  if (Math.random() < 0.02) await q(`delete from public.geo_cache where criado_em < now() - interval '60 days'`);
  return resultado;
}

// a rua existe e fica dentro do raio da loja? (raio e ponto da loja vêm da configuração no banco)
// subtotal -1 = taxa só pela distância (o site aplica o "grátis acima de"); no pedido o banco calcula tudo de novo
export async function conferirEntrega(rua, subtotal = -1) {
  const cfg = (await q('select loja_lat, loja_lng, raio_entrega_km from public.loja_config where id = 1')).rows[0];
  const origem = { lat: +cfg.loja_lat, lng: +cfg.loja_lng };
  const raio = +cfg.raio_entrega_km;
  const g = await conferirRua(rua, origem);
  if (g.indisponivel) return { erro: 'mapa_indisponivel' };
  if (!g.achou) return { erro: 'endereco_nao_encontrado' };
  const d = distanciaKm(origem, g);   // o banco confere de novo com a mesma conta, sem arredondar
  const t = (await q('select public.taxa_por_distancia(c, $1::float8, $2::int) as t from public.loja_config c where c.id = 1',
    [d, Math.max(-1, Math.min(10000000, Math.round(+subtotal) || 0))])).rows[0].t;
  return { erro: d > raio ? 'fora_da_area' : null, km: Math.round(d * 10) / 10, raio, rua: g.rua, lat: g.lat, lng: g.lng, taxa: t };
}
