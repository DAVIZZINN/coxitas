// Coxitas · conexão com o Postgres (Neon, ligado pela aba Storage do projeto na Vercel).
// Só as funções da Vercel usam: a DATABASE_URL é secreta e nunca vai para o navegador.
import pg from 'pg';
import { VERSAO, SQL } from './esquema.js';

let pool = null, pronto = null;
export const urlBanco = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const temBanco = () => !!urlBanco();

function getPool() {
  if (pool) return pool;
  pool = new pg.Pool({
    connectionString: urlBanco(),
    max: +(process.env.CX_POOL_MAX || 3),
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
  pool.on('error', () => {}); // conexão parada que caiu: o pool abre outra na próxima consulta
  // na Vercel, fecha as conexões paradas antes de a função dormir
  import('@vercel/functions').then(m => { if (m.attachDatabasePool) m.attachDatabasePool(pool); }).catch(() => {});
  return pool;
}

// instala ou atualiza o esquema uma vez por instância (a versão gravada no banco evita repetir à toa).
// Tudo numa transação com trava de transação: duas instâncias não instalam juntas, nada fica pela metade, e funciona
// com o pooler do Neon (a transação inteira fica numa conexão só; trava de sessão não ficaria)
async function instalar() {
  const c = await getPool().connect();
  try {
    await c.query('begin');
    try {
      await c.query('select pg_advisory_xact_lock(7262041)');
      await c.query('create table if not exists public.cx_meta (chave text primary key, valor text not null)');
      const v = await c.query("select valor from public.cx_meta where chave = 'versao'");
      if (!(v.rows[0] && v.rows[0].valor === VERSAO)) {
        await c.query(SQL);
        await c.query("insert into public.cx_meta (chave, valor) values ('versao', $1) on conflict (chave) do update set valor = excluded.valor", [VERSAO]);
      }
      await c.query('commit');
    } catch (e) {
      await c.query('rollback').catch(() => {});
      throw e;
    }
  } finally {
    c.release();
  }
}

export async function q(texto, params) {
  if (!pronto) pronto = instalar().catch(e => { pronto = null; throw e; });
  await pronto;
  return getPool().query(texto, params);
}
