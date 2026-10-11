// Coxitas · API pública do site (qualquer visitante):
//   GET  /api/publico/config      formas de pagamento, taxa, sabores e se a loja está recebendo pedidos
//   POST /api/publico/pedido      grava o pedido (o preço é recalculado no banco; o valor do navegador é ignorado)
//   POST /api/publico/acompanhar  andamento do pedido (código do link, ou número + 4 últimos dígitos do telefone)
//   POST /api/publico/endereco    a rua existe em Votuporanga e fica dentro do raio de entrega? (conferido no mapa)
import { q, temBanco } from '../lib/db.js';
import { json, corpo, ip, mesmaOrigem, falha } from '../lib/http.js';
import { dentroDoLimite } from '../lib/sessao.js';
import { conferirEntrega } from '../lib/geo.js';

const texto = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
// resposta da conferência do endereço, igual para o botão do site e para o pedido
function respostaEndereco(c) {
  if (c.erro === 'mapa_indisponivel') return json(503, { erro: c.erro });
  if (c.erro === 'fora_da_area') return json(400, { erro: c.erro, detalhe: `${c.km}|${c.raio}`, km: c.km, raio: c.raio, rua: c.rua });
  if (c.erro) return json(400, { erro: c.erro });
  return null;
}

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const acao = url.searchParams.get('acao');
    if (!temBanco()) return json(503, { erro: 'sem_banco' });
    try {
      if (acao === 'config') {
        if (req.method !== 'GET') return json(405, { erro: 'metodo' });
        const r = await q('select public.config_publica() as r');
        // a CDN da Vercel guarda a resposta por 15 s: muita gente abrindo o site não acorda o banco a cada visita
        return json(200, r.rows[0].r, { 'cache-control': 'public, max-age=0, must-revalidate', 'vercel-cdn-cache-control': 'max-age=15' });
      }
      if (req.method !== 'POST') return json(405, { erro: 'metodo' });
      if (!mesmaOrigem(req)) return json(403, { erro: 'origem' });
      const b = await corpo(req, 16384);
      if (acao === 'pedido') {
        // além do freio por telefone e da loja (no banco), até 15 pedidos por IP por hora
        if (!(await dentroDoLimite(`pedido:${ip(req)}`, 15, 3600))) return json(429, { erro: 'muitos_pedidos' });
        const p = b && typeof b.p === 'object' ? b.p : b;
        // entrega: a rua tem que existir no mapa e ficar dentro do raio; o endereço gravado é montado aqui, com o nome
        // oficial da rua, e o ponto no mapa vai separado (o navegador não manda coordenada nenhuma)
        let geo = null;
        if (p && p.modalidade === 'entrega') {
          const e = p.endereco_partes && typeof p.endereco_partes === 'object' ? p.endereco_partes : {};
          const rua = texto(e.rua, 120), numero = texto(e.numero, 12), bairro = texto(e.bairro, 60), comp = texto(e.complemento, 80);
          if (rua.length < 3 || !numero || bairro.length < 2) return json(400, { erro: 'endereco_invalido' });
          const c = await conferirEntrega(rua);
          const ruim = respostaEndereco(c);
          if (ruim) return ruim;
          p.endereco = `${c.rua}, ${numero} - ${bairro}${comp ? ` (${comp})` : ''}`.slice(0, 200);
          geo = { lat: c.lat, lng: c.lng };
        }
        const r = await q('select public.criar_pedido($1::jsonb, $2::jsonb) as r', [JSON.stringify(p), geo && JSON.stringify(geo)]);
        return json(200, r.rows[0].r);
      }
      if (acao === 'endereco') {
        if (!(await dentroDoLimite(`endereco:${ip(req)}`, 40, 600))) return json(429, { erro: 'muitas_tentativas' });
        const rua = texto(b.rua, 120);
        if (rua.length < 3) return json(400, { erro: 'endereco_invalido' });
        const c = await conferirEntrega(rua);
        return respostaEndereco(c) || json(200, { ok: true, km: c.km, raio: c.raio, rua: c.rua });
      }
      if (acao === 'acompanhar') {
        if (!(await dentroDoLimite(`rastreio:${ip(req)}`, 60, 600))) return json(429, { erro: 'muitas_tentativas' });
        const numero = String(b.numero || '').replace(/\D/g, '').slice(0, 12);
        if (!numero) return json(200, { erro: 'nao_encontrado' });
        const codigo = typeof b.codigo === 'string' ? b.codigo.toLowerCase().slice(0, 64) : null;
        const final = typeof b.final === 'string' ? b.final.replace(/\D/g, '').slice(0, 4) : null;
        const r = await q('select public.acompanhar_pedido($1::bigint, $2, $3) as r', [numero, codigo, final]);
        return json(200, r.rows[0].r);
      }
      return json(404, { erro: 'acao' });
    } catch (e) {
      return falha(e);
    }
  },
};
