-- =====================================================================================
-- Coxitas · banco de dados dos pedidos (Supabase, Postgres 15 ou mais novo)
--
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo inteiro e rode.
-- Depois rode o 02-cardapio.sql. Os dois podem ser rodados de novo sem perder pedidos:
-- as tabelas só são criadas se faltarem e as funções são atualizadas.
--
-- Segurança: o site e o painel usam a chave pública (anon). Ela não abre nada sozinha:
-- toda tabela tem RLS ligado e ninguém de fora lê, grava ou apaga direto nas tabelas.
-- O cliente só consegue chamar criar_pedido, acompanhar_pedido e config_publica.
-- O painel só funciona para quem está logado E cadastrado na tabela "equipe".
-- =====================================================================================

-- ---------- configuração da loja (uma linha só) ----------
create table if not exists public.loja_config (
  id smallint primary key default 1 check (id = 1),
  aceitando_pedidos boolean not null default true,
  mensagem_pausa text check (mensagem_pausa is null or char_length(mensagem_pausa) <= 200),
  -- vazio (null) = taxa de entrega combinada com a loja depois do pedido
  taxa_entrega_centavos integer check (taxa_entrega_centavos is null or taxa_entrega_centavos between 0 and 100000),
  pedido_minimo_centavos integer not null default 0 check (pedido_minimo_centavos between 0 and 1000000),
  pagamentos text[] not null default array['Pix', 'Dinheiro', 'Cartão na entrega'],
  sabores text[] not null default '{}',
  atualizado_em timestamptz not null default now()
);
insert into public.loja_config (id) values (1) on conflict (id) do nothing;

-- ---------- cardápio (o preço que vale é o daqui; o site só mostra) ----------
create table if not exists public.produtos (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  nome text not null check (char_length(nome) between 2 and 80),
  detalhe text not null default '' check (char_length(detalhe) <= 160),
  preco_centavos integer not null check (preco_centavos > 0 and preco_centavos <= 1000000),
  pede_sabores boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now()
);

-- ---------- pedidos ----------
create sequence if not exists public.pedido_numero_seq start 1001;

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  -- número que a loja e o cliente falam ("pedido 1042"); não tem nada a ver com o telefone
  numero bigint not null unique default nextval('public.pedido_numero_seq'),
  -- código secreto do link de acompanhamento (128 bits, impossível de adivinhar)
  codigo text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- chave gerada pelo navegador a cada tentativa de envio: tocar duas vezes ou a internet
  -- cair no meio não cria pedido repetido
  chave uuid not null unique,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  status text not null default 'novo'
    check (status in ('novo', 'confirmado', 'em_preparo', 'saiu_entrega', 'pronto_retirada', 'concluido', 'cancelado')),
  cliente_nome text not null check (char_length(cliente_nome) between 2 and 80),
  -- só dígitos: DDD + número (10 ou 11 dígitos)
  cliente_telefone text not null check (cliente_telefone ~ '^[1-9][0-9]9?[0-9]{8}$'),
  modalidade text not null check (modalidade in ('entrega', 'retirada')),
  endereco text check (endereco is null or char_length(endereco) between 5 and 200),
  pagamento text not null check (char_length(pagamento) between 2 and 40),
  troco_para_centavos integer check (troco_para_centavos is null or troco_para_centavos between 0 and 1000000),
  observacao text check (observacao is null or char_length(observacao) <= 500),
  sabores text[] not null default '{}',
  subtotal_centavos integer not null check (subtotal_centavos >= 0),
  taxa_entrega_centavos integer check (taxa_entrega_centavos is null or taxa_entrega_centavos >= 0),
  total_centavos integer not null check (total_centavos >= 0),
  -- pedido feito para testar o sistema (fica fora dos números do painel)
  teste boolean not null default false,
  origem text not null default 'site',
  constraint pedidos_endereco_na_entrega check (modalidade = 'retirada' or endereco is not null)
);
create index if not exists pedidos_criado_idx on public.pedidos (criado_em desc);
create index if not exists pedidos_status_idx on public.pedidos (status, criado_em desc);
create index if not exists pedidos_telefone_idx on public.pedidos (cliente_telefone, criado_em desc);

create table if not exists public.pedido_itens (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  produto_id text not null,
  nome text not null,
  detalhe text not null default '',
  preco_unit_centavos integer not null check (preco_unit_centavos > 0),
  quantidade integer not null check (quantidade between 1 and 50),
  total_centavos integer not null check (total_centavos > 0)
);
create index if not exists pedido_itens_pedido_idx on public.pedido_itens (pedido_id);

-- histórico: cada mudança de status com horário e quem fez
create table if not exists public.pedido_eventos (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  criado_em timestamptz not null default now(),
  status_de text,
  status_para text not null,
  nota text check (nota is null or char_length(nota) <= 300),
  autor uuid,
  autor_nome text
);
create index if not exists pedido_eventos_pedido_idx on public.pedido_eventos (pedido_id, criado_em);

-- quem pode entrar no painel (a conta é criada em Authentication > Users; aqui ela ganha acesso)
create table if not exists public.equipe (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 60),
  papel text not null default 'atendente' check (papel in ('dono', 'atendente')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- tentativas erradas de acompanhar pedido (freio contra quem tenta adivinhar)
create table if not exists public.rastreio_falhas (
  id bigint generated always as identity primary key,
  numero bigint not null,
  criado_em timestamptz not null default now()
);
create index if not exists rastreio_falhas_idx on public.rastreio_falhas (numero, criado_em);
create index if not exists rastreio_falhas_tempo_idx on public.rastreio_falhas (criado_em);

-- atualizado_em sozinho
create or replace function public.tocar_atualizado_em() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists pedidos_atualizado_em on public.pedidos;
create trigger pedidos_atualizado_em before update on public.pedidos for each row execute function public.tocar_atualizado_em();
drop trigger if exists produtos_atualizado_em on public.produtos;
create trigger produtos_atualizado_em before update on public.produtos for each row execute function public.tocar_atualizado_em();
drop trigger if exists loja_config_atualizado_em on public.loja_config;
create trigger loja_config_atualizado_em before update on public.loja_config for each row execute function public.tocar_atualizado_em();

-- =====================================================================================
-- Permissões: RLS em tudo, nada liberado direto nas tabelas para quem vem de fora
-- =====================================================================================
alter table public.loja_config enable row level security;
alter table public.produtos enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.pedido_eventos enable row level security;
alter table public.equipe enable row level security;
alter table public.rastreio_falhas enable row level security;

revoke all on table public.loja_config, public.produtos, public.pedidos, public.pedido_itens,
  public.pedido_eventos, public.equipe, public.rastreio_falhas from anon, authenticated;
revoke all on sequence public.pedido_numero_seq from anon, authenticated;

-- a pessoa logada é da equipe (e está ativa)?
create or replace function public.e_equipe() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.equipe where user_id = auth.uid() and ativo);
$$;
create or replace function public.e_dono() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.equipe where user_id = auth.uid() and ativo and papel = 'dono');
$$;

-- leitura direta só para a equipe (é o que deixa o painel receber pedidos novos na hora)
grant select on public.pedidos, public.pedido_itens, public.pedido_eventos to authenticated;
drop policy if exists equipe_le_pedidos on public.pedidos;
create policy equipe_le_pedidos on public.pedidos for select to authenticated using (public.e_equipe());
drop policy if exists equipe_le_itens on public.pedido_itens;
create policy equipe_le_itens on public.pedido_itens for select to authenticated using (public.e_equipe());
drop policy if exists equipe_le_eventos on public.pedido_eventos;
create policy equipe_le_eventos on public.pedido_eventos for select to authenticated using (public.e_equipe());
-- cardápio é público (só os itens ativos)
grant select on public.produtos to anon, authenticated;
drop policy if exists cardapio_publico on public.produtos;
create policy cardapio_publico on public.produtos for select to anon, authenticated using (ativo);

-- tempo real: o painel é avisado quando entra ou muda um pedido
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos') then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end $$;

-- =====================================================================================
-- Funções auxiliares
-- =====================================================================================

-- erro com código fixo (o site e o painel traduzem o código para uma frase)
create or replace function public.falha(codigo text, detalhe text default null) returns void
language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = codigo, detail = coalesce(detalhe, '');
end $$;

-- o pedido completo como JSON (usado pelo painel)
create or replace function public.pedido_json(p public.pedidos) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p.id, 'numero', p.numero, 'criado_em', p.criado_em, 'atualizado_em', p.atualizado_em,
    'status', p.status, 'cliente_nome', p.cliente_nome, 'cliente_telefone', p.cliente_telefone,
    'modalidade', p.modalidade, 'endereco', p.endereco, 'pagamento', p.pagamento,
    'troco_para_centavos', p.troco_para_centavos, 'observacao', p.observacao, 'sabores', to_jsonb(p.sabores),
    'subtotal_centavos', p.subtotal_centavos, 'taxa_entrega_centavos', p.taxa_entrega_centavos,
    'total_centavos', p.total_centavos, 'teste', p.teste, 'origem', p.origem,
    'itens', coalesce((select jsonb_agg(jsonb_build_object('produto_id', i.produto_id, 'nome', i.nome, 'detalhe', i.detalhe,
        'preco_unit_centavos', i.preco_unit_centavos, 'quantidade', i.quantidade, 'total_centavos', i.total_centavos) order by i.id)
      from public.pedido_itens i where i.pedido_id = p.id), '[]'::jsonb)
  );
$$;

-- quais mudanças de status fazem sentido (evita, por exemplo, concluir um pedido cancelado)
create or replace function public.proximos_status(p_status text, p_modalidade text) returns text[]
language sql immutable as $$
  select case p_status
    when 'novo' then array['confirmado', 'cancelado']
    when 'confirmado' then array['em_preparo', 'cancelado']
    when 'em_preparo' then case when p_modalidade = 'entrega' then array['saiu_entrega', 'cancelado'] else array['pronto_retirada', 'cancelado'] end
    when 'saiu_entrega' then array['concluido', 'cancelado']
    when 'pronto_retirada' then array['concluido', 'cancelado']
    else array[]::text[]
  end;
$$;

-- =====================================================================================
-- Funções do site (qualquer visitante)
-- =====================================================================================

-- o que o carrinho precisa saber antes de enviar
create or replace function public.config_publica() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'aceitando_pedidos', c.aceitando_pedidos, 'mensagem_pausa', c.mensagem_pausa,
    'taxa_entrega_centavos', c.taxa_entrega_centavos, 'pedido_minimo_centavos', c.pedido_minimo_centavos,
    'pagamentos', to_jsonb(c.pagamentos), 'sabores', to_jsonb(c.sabores)
  ) from public.loja_config c where c.id = 1;
$$;

-- recebe o pedido do site. O preço é sempre o do banco: o que o navegador mandar de valor é ignorado.
create or replace function public.criar_pedido(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  cfg public.loja_config;
  v_chave uuid;
  v_nome text; v_tel text; v_mod text; v_end text; v_pag text; v_troco integer; v_obs text;
  v_sab text[] := '{}';
  v_teste boolean;
  v_qtds jsonb := '{}'::jsonb;
  v_it jsonb; v_id text; v_q integer; v_prod public.produtos;
  v_sub integer := 0; v_taxa integer; v_n integer := 0;
  v_ped public.pedidos;
  v_existente public.pedidos;
begin
  if p is null or jsonb_typeof(p) <> 'object' then perform public.falha('pedido_invalido'); end if;

  -- mesma chave = mesmo envio (toque duplo, internet que caiu): devolve o pedido que já existe
  begin
    v_chave := (p ->> 'chave')::uuid;
  exception when others then
    perform public.falha('chave_invalida');
  end;
  if v_chave is null then perform public.falha('chave_invalida'); end if;
  select * into v_existente from public.pedidos where chave = v_chave;
  if found then
    return jsonb_build_object('numero', v_existente.numero, 'codigo', v_existente.codigo, 'criado_em', v_existente.criado_em,
      'subtotal_centavos', v_existente.subtotal_centavos, 'taxa_entrega_centavos', v_existente.taxa_entrega_centavos,
      'total_centavos', v_existente.total_centavos, 'repetido', true);
  end if;

  select * into cfg from public.loja_config where id = 1;
  if not cfg.aceitando_pedidos then perform public.falha('loja_pausada', cfg.mensagem_pausa); end if;

  v_nome := btrim(regexp_replace(coalesce(p ->> 'nome', ''), '\s+', ' ', 'g'));
  if char_length(v_nome) < 2 or char_length(v_nome) > 80 then perform public.falha('nome_invalido'); end if;

  v_tel := regexp_replace(coalesce(p ->> 'telefone', ''), '\D', '', 'g');
  if char_length(v_tel) in (12, 13) and left(v_tel, 2) = '55' then v_tel := substr(v_tel, 3); end if;
  v_tel := regexp_replace(v_tel, '^0+', '');
  if v_tel !~ '^[1-9][0-9]9?[0-9]{8}$' then perform public.falha('telefone_invalido'); end if;

  v_mod := coalesce(p ->> 'modalidade', '');
  if v_mod not in ('entrega', 'retirada') then perform public.falha('modalidade_invalida'); end if;

  v_end := nullif(btrim(regexp_replace(coalesce(p ->> 'endereco', ''), '\s+', ' ', 'g')), '');
  if v_mod = 'entrega' then
    if v_end is null or char_length(v_end) < 5 or char_length(v_end) > 200 then perform public.falha('endereco_invalido'); end if;
  else
    v_end := null;
  end if;

  v_pag := btrim(coalesce(p ->> 'pagamento', ''));
  if not (v_pag = any (cfg.pagamentos)) then perform public.falha('pagamento_invalido'); end if;

  if v_pag ilike 'dinheiro%' and nullif(p ->> 'troco_para_centavos', '') is not null then
    begin
      v_troco := (p ->> 'troco_para_centavos')::integer;
    exception when others then
      perform public.falha('troco_invalido');
    end;
    if v_troco < 0 or v_troco > 1000000 then perform public.falha('troco_invalido'); end if;
  end if;

  v_obs := nullif(btrim(coalesce(p ->> 'observacao', '')), '');
  if char_length(v_obs) > 500 then perform public.falha('observacao_longa'); end if;

  if jsonb_typeof(p -> 'sabores') = 'array' then
    select coalesce(array_agg(distinct s), '{}') into v_sab from jsonb_array_elements_text(p -> 'sabores') s;
    if cardinality(v_sab) > 12 or exists (select 1 from unnest(v_sab) s where not (s = any (cfg.sabores))) then
      perform public.falha('sabor_invalido');
    end if;
  end if;

  v_teste := coalesce((p ->> 'teste') = 'true', false);

  -- itens: soma as quantidades do mesmo produto e confere cada um no cardápio
  if coalesce(jsonb_typeof(p -> 'itens'), '') <> 'array' then perform public.falha('itens_invalidos'); end if;
  if jsonb_array_length(p -> 'itens') = 0 or jsonb_array_length(p -> 'itens') > 30 then perform public.falha('itens_invalidos'); end if;
  for v_it in select * from jsonb_array_elements(p -> 'itens') loop
    v_id := v_it ->> 'id';
    begin
      v_q := (v_it ->> 'qtd')::integer;
    exception when others then
      perform public.falha('itens_invalidos');
    end;
    if v_id is null or v_q is null or v_q < 1 or v_q > 50 then perform public.falha('itens_invalidos'); end if;
    v_qtds := jsonb_set(v_qtds, array[v_id], to_jsonb(coalesce((v_qtds ->> v_id)::integer, 0) + v_q));
  end loop;
  for v_id, v_q in select key, value::integer from jsonb_each_text(v_qtds) loop
    select * into v_prod from public.produtos where id = v_id and ativo;
    if not found then perform public.falha('produto_indisponivel', v_id); end if;
    if v_q > 50 then perform public.falha('itens_invalidos'); end if;
    v_sub := v_sub + v_prod.preco_centavos * v_q;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then perform public.falha('itens_invalidos'); end if;
  if v_sub < cfg.pedido_minimo_centavos then perform public.falha('abaixo_do_minimo', cfg.pedido_minimo_centavos::text); end if;

  -- freio contra robô e brincadeira: até 6 pedidos por telefone por hora e 40 pedidos na loja a cada 5 minutos
  if (select count(*) from public.pedidos where cliente_telefone = v_tel and criado_em > now() - interval '1 hour') >= 6 then
    perform public.falha('muitos_pedidos');
  end if;
  if (select count(*) from public.pedidos where criado_em > now() - interval '5 minutes') >= 40 then
    perform public.falha('muitos_pedidos');
  end if;

  v_taxa := case when v_mod = 'entrega' then cfg.taxa_entrega_centavos else 0 end;

  insert into public.pedidos (chave, cliente_nome, cliente_telefone, modalidade, endereco, pagamento, troco_para_centavos,
    observacao, sabores, subtotal_centavos, taxa_entrega_centavos, total_centavos, teste)
  values (v_chave, v_nome, v_tel, v_mod, v_end, v_pag, v_troco, v_obs, v_sab, v_sub, v_taxa, v_sub + coalesce(v_taxa, 0), v_teste)
  on conflict (chave) do nothing
  returning * into v_ped;

  if v_ped.id is null then
    -- dois envios iguais chegaram juntos: o outro já gravou
    select * into v_existente from public.pedidos where chave = v_chave;
    return jsonb_build_object('numero', v_existente.numero, 'codigo', v_existente.codigo, 'criado_em', v_existente.criado_em,
      'subtotal_centavos', v_existente.subtotal_centavos, 'taxa_entrega_centavos', v_existente.taxa_entrega_centavos,
      'total_centavos', v_existente.total_centavos, 'repetido', true);
  end if;

  insert into public.pedido_itens (pedido_id, produto_id, nome, detalhe, preco_unit_centavos, quantidade, total_centavos)
  select v_ped.id, pr.id, pr.nome, pr.detalhe, pr.preco_centavos, q.qtd, pr.preco_centavos * q.qtd
  from jsonb_each_text(v_qtds) as e(id, qtd_txt)
  cross join lateral (select e.qtd_txt::integer as qtd) q
  join public.produtos pr on pr.id = e.id
  order by pr.ordem, pr.id;

  insert into public.pedido_eventos (pedido_id, status_de, status_para, autor_nome)
  values (v_ped.id, null, 'novo', 'Site');

  return jsonb_build_object('numero', v_ped.numero, 'codigo', v_ped.codigo, 'criado_em', v_ped.criado_em,
    'subtotal_centavos', v_ped.subtotal_centavos, 'taxa_entrega_centavos', v_ped.taxa_entrega_centavos,
    'total_centavos', v_ped.total_centavos, 'repetido', false);
end $$;

-- acompanhamento pelo cliente: com o código do link, ou com o número + 4 últimos dígitos do telefone.
-- Mostra só o andamento e os itens: nada de telefone, endereço ou nome completo.
create or replace function public.acompanhar_pedido(p_numero bigint, p_codigo text default null, p_final_telefone text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v public.pedidos;
begin
  if p_numero is null then return jsonb_build_object('erro', 'nao_encontrado'); end if;
  -- limpeza das tentativas antigas
  delete from public.rastreio_falhas where criado_em < now() - interval '1 day';

  if p_codigo is not null and p_codigo ~ '^[0-9a-f]{32}$' then
    select * into v from public.pedidos where numero = p_numero and codigo = p_codigo;
  elsif p_final_telefone ~ '^[0-9]{4}$' then
    if (select count(*) from public.rastreio_falhas where numero = p_numero and criado_em > now() - interval '1 hour') >= 5
       or (select count(*) from public.rastreio_falhas where criado_em > now() - interval '10 minutes') >= 200 then
      return jsonb_build_object('erro', 'muitas_tentativas');
    end if;
    select * into v from public.pedidos where numero = p_numero and right(cliente_telefone, 4) = p_final_telefone;
    if not found then
      insert into public.rastreio_falhas (numero) values (p_numero);
    end if;
  end if;

  if v.id is null then return jsonb_build_object('erro', 'nao_encontrado'); end if;

  return jsonb_build_object(
    'numero', v.numero, 'codigo', v.codigo, 'status', v.status, 'criado_em', v.criado_em, 'atualizado_em', v.atualizado_em,
    'modalidade', v.modalidade, 'pagamento', v.pagamento, 'primeiro_nome', split_part(v.cliente_nome, ' ', 1),
    'sabores', to_jsonb(v.sabores), 'subtotal_centavos', v.subtotal_centavos,
    'taxa_entrega_centavos', v.taxa_entrega_centavos, 'total_centavos', v.total_centavos, 'teste', v.teste,
    'itens', coalesce((select jsonb_agg(jsonb_build_object('nome', i.nome, 'detalhe', i.detalhe, 'quantidade', i.quantidade,
        'total_centavos', i.total_centavos) order by i.id) from public.pedido_itens i where i.pedido_id = v.id), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('status', e.status_para, 'criado_em', e.criado_em) order by e.criado_em, e.id)
      from public.pedido_eventos e where e.pedido_id = v.id), '[]'::jsonb)
  );
end $$;

-- =====================================================================================
-- Funções do painel (só equipe logada)
-- =====================================================================================

create or replace function public.exigir_equipe() returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.e_equipe() then
    raise exception using errcode = '42501', message = 'sem_acesso';
  end if;
end $$;

-- quem está logado
create or replace function public.admin_eu() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v public.equipe;
begin
  perform public.exigir_equipe();
  select * into v from public.equipe where user_id = auth.uid();
  return jsonb_build_object('nome', v.nome, 'papel', v.papel);
end $$;

-- números do painel no período
create or replace function public.admin_resumo(p_de timestamptz default null, p_ate timestamptz default null, p_teste boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  perform public.exigir_equipe();
  select jsonb_build_object(
    'recebidos', count(*),
    'novos', count(*) filter (where status = 'novo'),
    'em_preparo', count(*) filter (where status in ('confirmado', 'em_preparo')),
    'prontos', count(*) filter (where status in ('pronto_retirada', 'saiu_entrega')),
    'concluidos', count(*) filter (where status = 'concluido'),
    'cancelados', count(*) filter (where status = 'cancelado'),
    'valor_concluidos_centavos', coalesce(sum(total_centavos) filter (where status = 'concluido'), 0),
    'valor_abertos_centavos', coalesce(sum(total_centavos) filter (where status not in ('concluido', 'cancelado')), 0)
  ) into r
  from public.pedidos
  where (p_de is null or criado_em >= p_de) and (p_ate is null or criado_em < p_ate) and teste = coalesce(p_teste, false);
  return r;
end $$;

-- lista com busca (número, nome ou telefone) e filtros
create or replace function public.admin_pedidos(
  p_de timestamptz default null, p_ate timestamptz default null, p_status text[] default null,
  p_busca text default null, p_teste boolean default false, p_limite integer default 50, p_pular integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_dig text := regexp_replace(coalesce(p_busca, ''), '\D', '', 'g');
  v_total integer; v_lista jsonb;
begin
  perform public.exigir_equipe();
  with f as (
    select p.* from public.pedidos p
    where (p_de is null or p.criado_em >= p_de) and (p_ate is null or p.criado_em < p_ate)
      and p.teste = coalesce(p_teste, false)
      and (p_status is null or cardinality(p_status) = 0 or p.status = any (p_status))
      and (v_busca is null
        or p.cliente_nome ilike '%' || replace(replace(v_busca, '%', ''), '_', '') || '%'
        or (v_dig <> '' and (p.numero::text = ltrim(v_dig, '0') or p.cliente_telefone like '%' || v_dig || '%')))
  )
  select (select count(*) from f),
         coalesce((select jsonb_agg(public.pedido_json(x) order by x.criado_em desc)
           from (select * from f order by criado_em desc limit least(greatest(coalesce(p_limite, 50), 1), 200) offset greatest(coalesce(p_pular, 0), 0)) x), '[]'::jsonb)
  into v_total, v_lista;
  return jsonb_build_object('total', v_total, 'pedidos', v_lista);
end $$;

-- um pedido com o histórico
create or replace function public.admin_pedido(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v public.pedidos;
begin
  perform public.exigir_equipe();
  select * into v from public.pedidos where id = p_id;
  if not found then perform public.falha('nao_encontrado'); end if;
  return public.pedido_json(v) || jsonb_build_object(
    'proximos', to_jsonb(public.proximos_status(v.status, v.modalidade)),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('status_de', e.status_de, 'status_para', e.status_para, 'nota', e.nota,
        'autor_nome', e.autor_nome, 'criado_em', e.criado_em) order by e.criado_em, e.id)
      from public.pedido_eventos e where e.pedido_id = v.id), '[]'::jsonb));
end $$;

-- muda o status. p_de = o status que a tela estava mostrando: se outra pessoa mudou antes, avisa em vez de atropelar
create or replace function public.admin_mudar_status(p_id uuid, p_para text, p_de text default null, p_nota text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v public.pedidos;
  v_autor text;
  v_antes text;
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  perform public.exigir_equipe();
  select * into v from public.pedidos where id = p_id for update;
  if not found then perform public.falha('nao_encontrado'); end if;
  if p_de is not null and p_de <> v.status then perform public.falha('status_mudou', v.status); end if;
  if not (p_para = any (public.proximos_status(v.status, v.modalidade))) then perform public.falha('mudanca_invalida', v.status); end if;
  if char_length(v_nota) > 300 then perform public.falha('nota_longa'); end if;
  select nome into v_autor from public.equipe where user_id = auth.uid();
  v_antes := v.status;
  update public.pedidos set status = p_para where id = p_id returning * into v;
  insert into public.pedido_eventos (pedido_id, status_de, status_para, nota, autor, autor_nome)
  values (v.id, v_antes, p_para, v_nota, auth.uid(), v_autor);
  return public.admin_pedido(v.id);
end $$;

-- configuração da loja (ler: equipe; mudar: só o dono)
create or replace function public.admin_config() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.exigir_equipe();
  return (select to_jsonb(c) - 'id' from public.loja_config c where c.id = 1);
end $$;

create or replace function public.admin_salvar_config(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_pag text[];
begin
  perform public.exigir_equipe();
  if not public.e_dono() then raise exception using errcode = '42501', message = 'so_dono'; end if;
  if p ? 'pagamentos' then
    select coalesce(array_agg(btrim(x)), '{}') into v_pag from jsonb_array_elements_text(p -> 'pagamentos') x where btrim(x) <> '';
    if cardinality(v_pag) = 0 or cardinality(v_pag) > 10 or exists (select 1 from unnest(v_pag) x where char_length(x) > 40) then
      perform public.falha('pagamentos_invalidos');
    end if;
  end if;
  update public.loja_config set
    aceitando_pedidos = case when p ? 'aceitando_pedidos' then (p ->> 'aceitando_pedidos')::boolean else aceitando_pedidos end,
    mensagem_pausa = case when p ? 'mensagem_pausa' then nullif(btrim(p ->> 'mensagem_pausa'), '') else mensagem_pausa end,
    taxa_entrega_centavos = case when p ? 'taxa_entrega_centavos' then nullif(p ->> 'taxa_entrega_centavos', '')::integer else taxa_entrega_centavos end,
    pedido_minimo_centavos = case when p ? 'pedido_minimo_centavos' then coalesce(nullif(p ->> 'pedido_minimo_centavos', '')::integer, 0) else pedido_minimo_centavos end,
    pagamentos = coalesce(v_pag, pagamentos)
  where id = 1;
  return public.admin_config();
end $$;

-- apaga só pedidos marcados como teste (só o dono)
create or replace function public.admin_apagar_testes() returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  perform public.exigir_equipe();
  if not public.e_dono() then raise exception using errcode = '42501', message = 'so_dono'; end if;
  delete from public.pedidos where teste;
  get diagnostics n = row_count;
  return n;
end $$;

-- =====================================================================================
-- Quem pode chamar cada função
-- =====================================================================================
revoke execute on function public.tocar_atualizado_em(), public.e_equipe(), public.e_dono(), public.falha(text, text),
  public.pedido_json(public.pedidos), public.proximos_status(text, text), public.exigir_equipe(),
  public.config_publica(), public.criar_pedido(jsonb), public.acompanhar_pedido(bigint, text, text),
  public.admin_eu(), public.admin_resumo(timestamptz, timestamptz, boolean),
  public.admin_pedidos(timestamptz, timestamptz, text[], text, boolean, integer, integer), public.admin_pedido(uuid),
  public.admin_mudar_status(uuid, text, text, text), public.admin_config(), public.admin_salvar_config(jsonb),
  public.admin_apagar_testes()
  from public, anon, authenticated;

grant execute on function public.config_publica(), public.criar_pedido(jsonb), public.acompanhar_pedido(bigint, text, text)
  to anon, authenticated;
grant execute on function public.e_equipe() to authenticated;
grant execute on function public.admin_eu(), public.admin_resumo(timestamptz, timestamptz, boolean),
  public.admin_pedidos(timestamptz, timestamptz, text[], text, boolean, integer, integer), public.admin_pedido(uuid),
  public.admin_mudar_status(uuid, text, text, text), public.admin_config(), public.admin_salvar_config(jsonb),
  public.admin_apagar_testes()
  to authenticated;
