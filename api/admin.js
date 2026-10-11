// Coxitas · API do painel. Toda chamada passa pela sessão (login com a Vercel + e-mail ativo na equipe);
// sem ela, 401. Ações que mudam alguma coisa só valem vindas do próprio site. Dono e atendente veem e atendem os
// pedidos; só o dono muda a loja, apaga testes e cuida da equipe.
import { q, temBanco } from '../lib/db.js';
import { json, corpo, mesmaOrigem, falha } from '../lib/http.js';
import { sessaoAtual } from '../lib/sessao.js';

const iso = v => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
const sim = v => v === 'true' || v === '1';
const so = (s, papel) => s.papel === papel;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const u = url.searchParams;
    const acao = u.get('acao');
    if (!temBanco()) return json(503, { erro: 'sem_banco' });
    try {
      const s = await sessaoAtual(req);
      if (!s) return json(401, { erro: 'sem_login' });
      const get = req.method === 'GET';
      if (!get && (req.method !== 'POST' || !mesmaOrigem(req))) return json(403, { erro: 'origem' });
      const b = get ? {} : await corpo(req, 32768);
      const um = async (sql, params) => (await q(sql, params)).rows[0].r;

      switch (acao) {
        case 'eu':
          return json(200, s);
        case 'painel': {
          // o que o painel confere a cada poucos segundos. A "marca" muda quando entra, muda ou some algum pedido; se o
          // painel já tem a marca atual, volta só "igual" (uma consulta pequena em vez de três)
          const m = (await q(`select (select count(*) from public.pedidos)::text || ':' || coalesce((select max(atualizado_em) from public.pedidos)::text, '-') as marca,
            coalesce((select aceitando_pedidos from public.loja_config where id = 1), true) as aceitando`)).rows[0];
          if (u.get('marca') === m.marca) return json(200, { marca: m.marca, aceitando: m.aceitando, igual: true });
          const t = sim(u.get('teste'));
          const ativos = await um(`select public.admin_pedidos(p_status => $1::text[], p_teste => $2::boolean, p_limite => 200) as r`,
            [['novo', 'confirmado', 'em_preparo', 'pronto_retirada', 'saiu_entrega'], t]);
          const fim = await um(`select public.admin_pedidos(p_de => $1::timestamptz, p_status => $2::text[], p_teste => $3::boolean, p_limite => 30) as r`,
            [iso(u.get('de')), ['concluido', 'cancelado'], t]);
          return json(200, { marca: m.marca, aceitando: m.aceitando, ativos: ativos.pedidos, fim: fim.pedidos });
        }
        case 'resumo':
          return json(200, await um('select public.admin_resumo($1::timestamptz, $2::timestamptz, $3::boolean) as r', [iso(u.get('de')), iso(u.get('ate')), sim(u.get('teste'))]));
        case 'pedidos': {
          const st = (u.get('status') || '').split(',').map(x => x.trim()).filter(Boolean);
          return json(200, await um(`select public.admin_pedidos(p_de => $1::timestamptz, p_ate => $2::timestamptz, p_status => $3::text[],
            p_busca => $4, p_teste => $5::boolean, p_limite => $6::int, p_pular => $7::int) as r`,
          [iso(u.get('de')), iso(u.get('ate')), st.length ? st : null, (u.get('busca') || '').slice(0, 80) || null, sim(u.get('teste')),
            Math.min(200, +u.get('limite') || 50), Math.max(0, +u.get('pular') || 0)]));
        }
        case 'pedido':
          return json(200, await um('select public.admin_pedido($1::uuid) as r', [u.get('id')]));
        case 'status':
          if (get) break;
          return json(200, await um('select public.admin_mudar_status($1::uuid, $2, $3, $4, $5, $6) as r',
            [b.id, String(b.para || ''), b.de || null, b.nota || null, s.email, s.nome]));
        case 'config':
          return json(200, await um('select public.admin_config() as r'));
        case 'salvar_config':
          if (get) break;
          if (!so(s, 'dono')) return json(403, { erro: 'so_dono' });
          return json(200, await um('select public.admin_salvar_config($1::jsonb) as r', [JSON.stringify(b.p || {})]));
        case 'apagar_testes':
          if (get) break;
          if (!so(s, 'dono')) return json(403, { erro: 'so_dono' });
          return json(200, { apagados: await um('select public.admin_apagar_testes() as r') });
        case 'equipe': {
          if (!so(s, 'dono')) return json(403, { erro: 'so_dono' });
          const r = await q('select email, nome, papel, ativo, ultimo_login from public.equipe order by papel, nome');
          return json(200, { equipe: r.rows });
        }
        case 'equipe_salvar': {
          if (get) break;
          if (!so(s, 'dono')) return json(403, { erro: 'so_dono' });
          const email = String(b.email || '').trim().toLowerCase(), nome = String(b.nome || '').trim();
          const papel = b.papel === 'dono' ? 'dono' : 'atendente', ativo = b.ativo !== false;
          if (!EMAIL.test(email) || email.length > 120) return json(400, { erro: 'email_invalido' });
          if (nome.length < 2 || nome.length > 60) return json(400, { erro: 'nome_invalido' });
          if (email === s.email && (papel !== 'dono' || !ativo)) return json(400, { erro: 'nao_pode_se_rebaixar' });
          await q(`insert into public.equipe (email, nome, papel, ativo) values ($1, $2, $3, $4)
            on conflict (email) do update set nome = excluded.nome, papel = excluded.papel, ativo = excluded.ativo`, [email, nome, papel, ativo]);
          if (!ativo) await q('delete from public.sessoes where email = $1', [email]);
          return json(200, { ok: true });
        }
        case 'equipe_remover': {
          if (get) break;
          if (!so(s, 'dono')) return json(403, { erro: 'so_dono' });
          const email = String(b.email || '').trim().toLowerCase();
          if (email === s.email) return json(400, { erro: 'nao_pode_se_remover' });
          await q('delete from public.equipe where email = $1', [email]);
          return json(200, { ok: true });
        }
        default:
          return json(404, { erro: 'acao' });
      }
      return json(405, { erro: 'metodo' });
    } catch (e) {
      return falha(e);
    }
  },
};
