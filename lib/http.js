// Coxitas · ajudantes das funções da Vercel (respostas, cookies, corpo, origem, IP e erros)
export const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});

export function redireciona(local, cookies = []) {
  const h = new Headers({ location: local, 'cache-control': 'no-store' });
  cookies.forEach(c => h.append('set-cookie', c));
  return new Response(null, { status: 302, headers: h });
}

export function lerCookies(req) {
  const out = {};
  (req.headers.get('cookie') || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

// __Host-: só vale neste endereço, com https, para o site todo (ninguém de outro subdomínio consegue mexer)
export function cookie(nome, valor, { maxAge, sameSite = 'Strict' } = {}) {
  const partes = [`${nome}=${encodeURIComponent(valor)}`, 'Path=/', 'HttpOnly', 'Secure', `SameSite=${sameSite}`];
  if (maxAge != null) partes.push(`Max-Age=${maxAge}`);
  return partes.join('; ');
}

export async function corpo(req, max = 16384) {
  const tipo = req.headers.get('content-type') || '';
  if (!tipo.includes('application/json')) throw Object.assign(new Error('tipo'), { http: 415 });
  const txt = await req.text();
  if (txt.length > max) throw Object.assign(new Error('grande'), { http: 413 });
  try { return JSON.parse(txt || '{}'); } catch { throw Object.assign(new Error('json'), { http: 400 }); }
}

// pedidos que mudam alguma coisa só valem vindos deste mesmo site (freio contra outro site agindo no seu nome)
export function mesmaOrigem(req) {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origem = req.headers.get('origin');
  if (!origem) return !!site; // navegador moderno sempre manda um dos dois
  try { return new URL(origem).host === new URL(req.url).host; } catch { return false; }
}

export function ip(req) {
  return (req.headers.get('x-real-ip') || req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sem-ip';
}

// erro do banco com código fixo (falha('nome_invalido') no SQL) vira 400 com o código; o resto, 500 sem detalhes
export function falha(e) {
  if (e && e.http) return json(e.http, { erro: e.message });
  if (e && e.code === 'P0001') return json(400, { erro: e.message, detalhe: e.detail || null });
  if (e && (e.code === '22P02' || e.code === '22003' || e.code === '22007' || e.code === '23514')) return json(400, { erro: 'dados_invalidos' });
  console.error('erro interno', e && (e.stack || e.message || e));
  return json(500, { erro: 'interno' });
}
