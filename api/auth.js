// Coxitas · login do painel. Dois jeitos, os dois terminam numa sessão nossa (cookie HttpOnly) e só para quem está
// ativo na equipe:
//   1. código de 6 números no e-mail (quem tem acesso ao e-mail entra). Quem gera e manda o código é o login do Neon
//      (Managed Better Auth, ligado junto com o banco: NEON_AUTH_BASE_URL); esta função só conversa com ele pelo servidor.
//   2. conta da Vercel ("Sign in with Vercel", OAuth 2 + OpenID com PKCE).
//   GET  /api/auth/estado         o que está configurado (sem segredos) e quem está logado neste navegador
//   POST /api/auth/codigo         {email} manda o código (só se o e-mail for da equipe; a resposta é igual para todos)
//   POST /api/auth/codigo_entrar  {email, codigo} confere o código e abre a sessão
//   GET  /api/auth/entrar   manda para a tela de login da Vercel
//   GET  /api/auth/retorno  a Vercel devolve aqui; confere o token, o e-mail verificado e a equipe, e abre a sessão
//   POST /api/auth/sair     fecha a sessão
// Precisa de: VERCEL_APP_CLIENT_ID e VERCEL_APP_CLIENT_SECRET (app criado em Settings > Apps da Vercel),
// ADMIN_EMAILS (quem vira dono no primeiro login) e o banco ligado.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { q, temBanco } from '../lib/db.js';
import { json, redireciona, lerCookies, cookie, corpo, ip, mesmaOrigem, falha } from '../lib/http.js';
import { hash, aleatorio, sessaoAtual, criarSessao, encerrarSessao, dentroDoLimite, emailsDono } from '../lib/sessao.js';
import { createHash } from 'node:crypto';

const CLIENT_ID = () => (process.env.VERCEL_APP_CLIENT_ID || '').trim();
const CLIENT_SECRET = () => (process.env.VERCEL_APP_CLIENT_SECRET || '').trim();
// só liga o botão da Vercel com chaves que têm cara de chave de verdade (o ID começa com cl_, o segredo não tem espaço);
// texto colado por engano deixa o botão escondido em vez de levar a uma tela de erro da Vercel
const loginVercel = () => /^cl_\w{6,}$/.test(CLIENT_ID()) && /^\S{16,}$/.test(CLIENT_SECRET());
const COOKIE_OAUTH = '__Host-cx_oauth';
const NEON_AUTH = () => (process.env.NEON_AUTH_BASE_URL || '').replace(/\/+$/, '');
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ISSUER = 'https://vercel.com';
let jwks = null;
const chaves = () => (jwks = jwks || createRemoteJWKSet(new URL('https://vercel.com/.well-known/jwks')));
// login de teste sem a Vercel: só no computador de quem desenvolve, nunca na Vercel (lá a variável VERCEL existe)
const devLogin = () => !process.env.VERCEL && process.env.CX_DEV_LOGIN === '1';
const volta = (erro, extra = '') => redireciona(`/admin/?erro=${encodeURIComponent(erro)}${extra}`, [cookie(COOKIE_OAUTH, '', { maxAge: 0, sameSite: 'Lax' })]);

async function entraNaEquipe(email, nomeVercel) {
  // dono configurado na Vercel (ADMIN_EMAILS) entra na equipe no primeiro login
  if (emailsDono().includes(email)) {
    const nome = (nomeVercel || email.split('@')[0]).slice(0, 60).padEnd(2, '.');
    await q(`insert into public.equipe (email, nome, papel, ativo) values ($1, $2, 'dono', true)
      on conflict (email) do update set papel = 'dono', ativo = true`, [email, nome]);
  }
  const r = await q('select email from public.equipe where email = $1 and ativo', [email]);
  return !!r.rows[0];
}

// pode receber código: dono pelo ADMIN_EMAILS ou alguém ativo na equipe
async function podeEntrar(email) {
  if (emailsDono().includes(email)) return true;
  return !!(await q('select 1 from public.equipe where email = $1 and ativo', [email])).rows[0];
}

// conversa servidor a servidor com o login do Neon (sem cookie, sem passar pelo navegador)
async function neonAuth(caminho, dados) {
  const r = await fetch(NEON_AUTH() + caminho, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(dados),
    signal: AbortSignal.timeout(10000),
  });
  return { ok: r.ok, status: r.status, d: await r.json().catch(() => ({})) };
}

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const acao = url.searchParams.get('acao');
    const retorno = `${url.origin}/api/auth/retorno`;
    try {
      if (acao === 'estado') {
        // quem já tem sessão abre o painel direto (sem uma chamada a mais que daria 401 no console)
        const eu = temBanco() ? await sessaoAtual(req).catch(() => null) : null;
        return json(200, { login: loginVercel(), codigo: !!NEON_AUTH(), banco: temBanco(), dev: devLogin(), retorno, eu });
      }

      if (acao === 'codigo' || acao === 'codigo_entrar') {
        if (req.method !== 'POST' || !mesmaOrigem(req)) return json(403, { erro: 'origem' });
        if (!temBanco()) return json(503, { erro: 'sem_banco' });
        if (!NEON_AUTH()) return json(503, { erro: 'codigo_nao_configurado' });
        const b = await corpo(req, 2048);
        const email = String(b.email || '').trim().toLowerCase();
        if (!EMAIL.test(email) || email.length > 120) return json(400, { erro: 'email_invalido' });

        if (acao === 'codigo') {
          if (!(await dentroDoLimite(`codigo-ip:${ip(req)}`, 10, 600)) || !(await dentroDoLimite(`codigo:${email}`, 5, 900))) return json(429, { erro: 'muitas_tentativas' });
          // só manda para quem é da equipe; para os outros a resposta é a mesma e nada sai (ninguém descobre quem é da equipe)
          if (await podeEntrar(email)) {
            const r = await neonAuth('/email-otp/send-verification-otp', { email, type: 'sign-in' });
            if (!r.ok) { console.error('código não saiu', r.status, (r.d && (r.d.code || r.d.message)) || ''); return json(502, { erro: 'envio_falhou', detalhe: `neon_${r.status}` }); }
          }
          return json(200, { ok: true });
        }

        const codigo = String(b.codigo || '').replace(/\D/g, '');
        if (codigo.length < 4 || codigo.length > 10) return json(400, { erro: 'codigo_invalido' });
        if (!(await dentroDoLimite(`entrar-ip:${ip(req)}`, 20, 600)) || !(await dentroDoLimite(`entrar:${email}`, 8, 900))) return json(429, { erro: 'muitas_tentativas' });
        if (!(await podeEntrar(email))) return json(400, { erro: 'codigo_invalido' });
        const r = await neonAuth('/sign-in/email-otp', { email, otp: codigo });
        if (!r.ok) {
          const c = String((r.d && (r.d.code || r.d.message)) || '');
          if (/TOO_MANY/i.test(c)) return json(400, { erro: 'codigo_bloqueado' });
          if (/EXPIRED/i.test(c)) return json(400, { erro: 'codigo_expirado' });
          if (r.status < 500 && /OTP|INVALID/i.test(c)) return json(400, { erro: 'codigo_invalido' });
          // resposta inesperada do Neon: o código de status ajuda a achar o problema sem expor nada
          console.error('login do Neon falhou', r.status, c);
          return json(502, { erro: 'envio_falhou', detalhe: `neon_${r.status}` });
        }
        // o código só vale se o Neon confirmar este mesmo e-mail
        const confirmado = String((r.d && r.d.user && r.d.user.email) || '').toLowerCase();
        if (confirmado !== email || !(await entraNaEquipe(email, r.d.user.name))) return json(400, { erro: 'codigo_invalido' });
        return json(200, { ok: true }, { 'set-cookie': await criarSessao(email, req) });
      }
      if (!temBanco()) return volta('sem_banco');

      if (acao === 'entrar') {
        if (!loginVercel()) return volta('login_nao_configurado');
        if (!(await dentroDoLimite(`login:${ip(req)}`, 20, 600))) return volta('muitas_tentativas');
        const estado = aleatorio(24), verificador = aleatorio(48), nonce = aleatorio(16);
        const desafio = createHash('sha256').update(verificador).digest('base64url');
        await q(`delete from public.oauth_estados where criado_em < now() - interval '10 minutes'`);
        await q('insert into public.oauth_estados (id_hash, verificador, nonce) values ($1, $2, $3)', [hash(estado), verificador, nonce]);
        const ir = new URL('https://vercel.com/oauth/authorize');
        ir.search = new URLSearchParams({
          client_id: CLIENT_ID(), redirect_uri: retorno, response_type: 'code', scope: 'openid email profile',
          code_challenge: desafio, code_challenge_method: 'S256', state: estado, nonce,
        }).toString();
        return redireciona(ir.toString(), [cookie(COOKIE_OAUTH, estado, { maxAge: 600, sameSite: 'Lax' })]);
      }

      if (acao === 'retorno') {
        const estado = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
        if (url.searchParams.get('error')) return volta('login_cancelado');
        if (!estado || !code || lerCookies(req)[COOKIE_OAUTH] !== estado) return volta('login_expirado');
        // o estado vale uma vez só e por 10 minutos
        const r = await q(`delete from public.oauth_estados where id_hash = $1 and criado_em > now() - interval '10 minutes' returning verificador, nonce`, [hash(estado)]);
        if (!r.rows[0]) return volta('login_expirado');
        const { verificador, nonce } = r.rows[0];
        const tok = await fetch('https://api.vercel.com/login/oauth/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
          body: new URLSearchParams({ grant_type: 'authorization_code', client_id: CLIENT_ID(), client_secret: CLIENT_SECRET(), code, code_verifier: verificador, redirect_uri: retorno }),
        });
        const t = await tok.json().catch(() => ({}));
        if (!tok.ok || !t.id_token) { console.error('token da Vercel recusado', tok.status, t.error || ''); return volta('login_recusado'); }
        // o token tem que ter sido assinado pela Vercel, para este app, e com o nonce deste login
        const { payload } = await jwtVerify(t.id_token, chaves(), { issuer: ISSUER, audience: CLIENT_ID() });
        if (payload.nonce !== nonce) return volta('login_recusado');
        let email = payload.email, verificado = payload.email_verified, nome = payload.name;
        if (!email && t.access_token) {
          const ui = await fetch('https://api.vercel.com/login/oauth/userinfo', { method: 'POST', headers: { authorization: `Bearer ${t.access_token}` } });
          const d = await ui.json().catch(() => ({}));
          email = d.email; verificado = d.email_verified; nome = nome || d.name;
        }
        email = String(email || '').toLowerCase();
        if (!email || verificado !== true) return volta('email_nao_verificado');
        if (!(await entraNaEquipe(email, nome))) return volta('sem_acesso', `&email=${encodeURIComponent(email)}`);
        return redireciona('/admin/', [await criarSessao(email, req), cookie(COOKIE_OAUTH, '', { maxAge: 0, sameSite: 'Lax' })]);
      }

      if (acao === 'sair') {
        if (req.method !== 'POST' || !mesmaOrigem(req)) return json(403, { erro: 'origem' });
        return new Response(null, { status: 204, headers: { 'set-cookie': await encerrarSessao(req), 'cache-control': 'no-store' } });
      }

      if (acao === 'dev' && devLogin()) {
        const email = String(url.searchParams.get('email') || '').toLowerCase();
        if (!(await entraNaEquipe(email, null))) return volta('sem_acesso', `&email=${encodeURIComponent(email)}`);
        return redireciona('/admin/', [await criarSessao(email, req)]);
      }
      return json(404, { erro: 'acao' });
    } catch (e) {
      if (acao === 'retorno') { console.error('login falhou', e && e.message); return volta('login_recusado'); }
      return falha(e);
    }
  },
};
