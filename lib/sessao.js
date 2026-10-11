// Coxitas · sessão do painel e freio por IP. O navegador guarda só um código aleatório (cookie HttpOnly);
// o banco guarda o hash dele, com validade, e confere a cada chamada se a pessoa continua ativa na equipe.
import { createHash, randomBytes } from 'node:crypto';
import { q } from './db.js';
import { lerCookies, cookie, ip } from './http.js';

export const hash = s => createHash('sha256').update(String(s)).digest('hex');
export const aleatorio = (n = 32) => randomBytes(n).toString('base64url');
export const COOKIE_SESSAO = '__Host-cx_sessao';
const HORAS = 12;

export async function sessaoAtual(req) {
  const tok = lerCookies(req)[COOKIE_SESSAO];
  if (!tok || tok.length < 20 || tok.length > 100) return null;
  const r = await q(`select e.email, e.nome, e.papel from public.sessoes s join public.equipe e on e.email = s.email
    where s.id_hash = $1 and s.expira_em > now() and e.ativo`, [hash(tok)]);
  return r.rows[0] || null;
}

export async function criarSessao(email, req) {
  const tok = aleatorio(32);
  await q(`insert into public.sessoes (id_hash, email, expira_em, ip, agente) values ($1, $2, now() + make_interval(hours => $3), $4, $5)`,
    [hash(tok), email, HORAS, ip(req), (req.headers.get('user-agent') || '').slice(0, 200)]);
  await q(`update public.equipe set ultimo_login = now() where email = $1`, [email]);
  // limpeza do que já venceu
  await q(`delete from public.sessoes where expira_em < now() - interval '1 day'`);
  return cookie(COOKIE_SESSAO, tok, { maxAge: HORAS * 3600 });
}

export async function encerrarSessao(req) {
  const tok = lerCookies(req)[COOKIE_SESSAO];
  if (tok) await q(`delete from public.sessoes where id_hash = $1`, [hash(tok)]);
  return cookie(COOKIE_SESSAO, '', { maxAge: 0 });
}

// freio: no máximo `max` usos da mesma chave (ex.: "pedido:IP") dentro da janela em segundos
export async function dentroDoLimite(chave, max, janelaSeg) {
  const r = await q(`with novo as (insert into public.limites (chave) values ($1) returning 1)
    select count(*)::int as n from public.limites where chave = $1 and criado_em > now() - make_interval(secs => $2)`, [chave, janelaSeg]);
  if (Math.random() < 0.02) await q(`delete from public.limites where criado_em < now() - interval '1 day'`);
  return r.rows[0].n < max;
}

// e-mails que viram dono no primeiro login (variável ADMIN_EMAILS na Vercel, separados por vírgula)
export const emailsDono = () => (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
