/* Coxitas · painel da loja.
   Login com código no e-mail ou com a conta da Vercel (api/auth.js). Todos os dados passam pela API do próprio site (api/admin.js), que confere
   a sessão e se o e-mail continua ativo na equipe: esconder esta página não é a proteção, sem sessão a API não entrega
   nada. Pedidos novos: o painel confere a cada 10 segundos (mais devagar com a aba escondida, com a loja fechada ou
   sem ninguém mexendo há horas, para o banco do plano grátis poder descansar). */
(() => {
  'use strict';
  // não deixa o painel ser aberto dentro de outro site (clique enganado)
  if (window.top !== window.self) { document.documentElement.textContent = ''; return; }
  // o endereço oficial é o da Vercel (o link antigo do GitHub Pages leva para lá)
  if (/\.github\.io$/.test(location.hostname)) { location.replace('https://coxitas.vercel.app/admin/' + location.hash); return; }

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CIDADE = 'Votuporanga - SP';
  const views = $$('[data-v]');
  const mostraTela = v => views.forEach(el => { el.hidden = el.dataset.v !== v; });

  /* ---------- formatos ---------- */
  const fmt = c => { const [r, d] = (Math.abs(+c || 0) / 100).toFixed(2).split('.'); return 'R$ ' + r.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
  const TZ = 'America/Sao_Paulo';
  const fHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const fDia = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' });
  const hoje = () => fDia.format(new Date());
  const quando = iso => { const d = new Date(iso); const dd = fDia.format(d); return dd === hoje() ? fHora.format(d) : `${dd} ${fHora.format(d)}`; };
  const telBonito = d => (d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d);
  const NOME = { novo: 'Novo', confirmado: 'Confirmado', em_preparo: 'Em preparo', saiu_entrega: 'Saiu para entrega', pronto_retirada: 'Pronto para retirada', concluido: 'Concluído', cancelado: 'Cancelado' };
  const ACAO = { confirmado: 'Confirmar pedido', em_preparo: 'Começar o preparo', saiu_entrega: 'Saiu para entrega', pronto_retirada: 'Pronto para retirada', concluido: m => (m === 'retirada' ? 'Cliente retirou: concluir' : 'Entregue: concluir'), cancelado: 'Cancelar pedido' };
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  const ico = id => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ico'); s.setAttribute('aria-hidden', 'true'); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', `#${id}`); s.appendChild(u); return s; };
  const badgeStatus = s => { const b = el('span', `st st-${s}`, NOME[s] || s); return b; };

  /* ---------- conversa com a API ---------- */
  const ERRO = {
    so_dono: 'Só o dono da loja pode fazer isso.',
    status_mudou: 'Outra pessoa mudou este pedido antes. A tela foi atualizada.',
    mudanca_invalida: 'Essa mudança de status não vale para este pedido agora.',
    nao_encontrado: 'Pedido não encontrado.',
    nota_longa: 'O motivo ficou longo demais (até 300 letras).',
    pagamentos_invalidos: 'Confira as formas de pagamento (de 1 a 10, uma por linha).',
    dados_invalidos: 'Algum dado não foi aceito. Confira e tente de novo.',
    email_invalido: 'Confira o e-mail.',
    nome_invalido: 'O nome precisa ter de 2 a 60 letras.',
    nao_pode_se_rebaixar: 'Você não pode tirar o seu próprio acesso de dono.',
    nao_pode_se_remover: 'Você não pode se remover da equipe.',
    sem_login: 'Sua sessão terminou. Entre de novo.',
    origem: 'Bloqueado por segurança. Recarregue a página e tente de novo.',
    sem_banco: 'O banco de pedidos não está ligado.',
    interno: 'O servidor teve um problema. Tente de novo em instantes.',
  };
  const textoErro = e => (e && ERRO[e.message]) || (e && e.rede ? 'Sem conexão com o servidor. Confira a internet.' : 'Não deu certo agora. Tente de novo.');
  // GET para ler; POST com JSON para mudar (a API só aceita mudança vinda deste mesmo site)
  async function api(acao, params, corpo) {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => { if (v != null && v !== '' && v !== false) qs.set(k, String(v)); });
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
    let r;
    try {
      const s = qs.toString();
      r = await fetch(`../api/admin/${acao}${s ? `?${s}` : ''}`, corpo === undefined
        ? { cache: 'no-store', signal: ctl.signal }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: ctl.signal });
    } catch (e) { throw Object.assign(new Error('rede'), { rede: true }); } finally { clearTimeout(t); }
    const b = await r.json().catch(() => null);
    if (!r.ok) {
      if (r.status === 401) sessaoAcabou();
      throw Object.assign(new Error((b && b.erro) || 'falhou'), { status: r.status });
    }
    return b;
  }

  /* ---------- avisos na tela e som ---------- */
  const toasts = $('[data-toasts]');
  function toast(titulo, sub, opts = {}) {
    const t = el('button', `toast${opts.erro ? ' erro' : ''}`);
    t.type = 'button';
    const d = el('div'); d.append(el('span', null, titulo)); if (sub) d.append(el('small', null, sub));
    t.appendChild(d);
    t.addEventListener('click', () => { t.remove(); if (opts.abrir) abrePedido(opts.abrir); });
    toasts.appendChild(t);
    // no máximo 3 avisos na tela: o mais antigo sai
    while (toasts.children.length > 3) toasts.firstElementChild.remove();
    setTimeout(() => t.remove(), opts.tempo || 9000);
  }
  let som = false, audio = null;
  try { som = localStorage.getItem('cx-painel-som') === 'on'; } catch (e) {}
  const somBtn = $('[data-som]');
  function syncSom() {
    somBtn.setAttribute('aria-pressed', String(som));
    $('use', somBtn).setAttribute('href', som ? '#i-bell' : '#i-bell-off');
    $('[data-som-txt]').textContent = som ? 'Desligar o som de pedido novo' : 'Ligar o som de pedido novo';
    somBtn.title = som ? 'Som de pedido novo: ligado' : 'Som de pedido novo: desligado';
  }
  function bip() {
    if (!som) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime;
      [[880, 0], [1175, .18]].forEach(([f, dt]) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.25, t0 + dt + .02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + .16);
        o.connect(g).connect(audio.destination); o.start(t0 + dt); o.stop(t0 + dt + .18);
      });
    } catch (e) {}
  }
  somBtn.addEventListener('click', () => { som = !som; try { localStorage.setItem('cx-painel-som', som ? 'on' : 'off'); } catch (e) {} syncSom(); if (som) bip(); alarme(); });
  // o navegador só deixa tocar som depois de um clique na página
  document.addEventListener('pointerdown', () => { if (som && audio && audio.state === 'suspended') audio.resume(); }, { passive: true });
  syncSom();


  /* ---------- estado ---------- */
  let eu = null;
  const f = { periodo: 'hoje', de: null, ate: null, testes: false, status: '', busca: '' };
  let pular = 0, totalLista = 0, aberto = null, abertoDe = null;
  const avisados = new Set();
  let conhecidos = null;           // números já vistos (para avisar pedido novo)

  // dias contados pelo relógio de Votuporanga
  const inicioDia = desloc => { const sp = new Date(Date.now() - 3 * 3600e3); return new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() - desloc) + 3 * 3600e3).toISOString(); };
  function intervalo() {
    if (f.periodo === 'hoje') return { de: inicioDia(0) };
    if (f.periodo === '7') return { de: inicioDia(6) };
    if (f.periodo === '30') return { de: inicioDia(29) };
    if (f.periodo === 'datas') {
      const d = v => (v ? new Date(`${v}T00:00:00-03:00`) : null);
      const de = d(f.de), ate = d(f.ate);
      return { de: de ? de.toISOString() : null, ate: ate ? new Date(ate.getTime() + 86400000).toISOString() : null };
    }
    return {};
  }

  /* ---------- abas ---------- */
  const TITULO = { quadro: 'Quadro de pedidos', painel: 'Painel', pedidos: 'Pedidos', loja: 'Loja' };
  let aba = 'quadro';
  function vaiPara(nova) {
    aba = TITULO[nova] ? nova : 'quadro';
    $$('[data-tab]').forEach(a => { if (a.dataset.tab === aba) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $$('[data-tab-view]').forEach(v => { v.hidden = v.dataset.tabView !== aba; });
    $('[data-titulo]').textContent = TITULO[aba];
    $('[data-filtros]').hidden = aba === 'loja';
    $('[data-filtros]').classList.toggle('so-testes', aba === 'quadro');
    if (aba === 'loja') { carregaConfig(); carregaEquipe(); }
    atualiza({ forca: true });
  }
  window.addEventListener('hashchange', () => { if (eu) vaiPara(location.hash.slice(1)); });

  /* ---------- filtros ---------- */
  $$('[data-p]').forEach(b => b.addEventListener('click', () => {
    f.periodo = b.dataset.p;
    $$('[data-p]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('[data-datas]').hidden = f.periodo !== 'datas';
    if (f.periodo !== 'datas') atualiza({ forca: true });
  }));
  $('[data-de]').addEventListener('change', e => { f.de = e.target.value || null; atualiza({ forca: true }); });
  $('[data-ate]').addEventListener('change', e => { f.ate = e.target.value || null; atualiza({ forca: true }); });
  $('[data-testes]').addEventListener('change', e => { f.testes = e.target.checked; conhecidos = null; atualiza({ forca: true }); });
  const statusBtns = $$('[data-s]');
  function marcaStatus(s) { f.status = s; statusBtns.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.s === s))); }
  const erroLista = e => toast('Não deu para carregar a lista', textoErro(e), { erro: true, tempo: 5000 });
  statusBtns.forEach(b => b.addEventListener('click', () => { marcaStatus(b.dataset.s); carregaLista(true).catch(erroLista); }));
  let tBusca = 0;
  $('[data-busca]').addEventListener('input', e => { clearTimeout(tBusca); tBusca = setTimeout(() => { f.busca = e.target.value.trim(); carregaLista(true).catch(erroLista); }, 300); });
  $$('[data-k]').forEach(k => { if (k.tagName === 'BUTTON') k.addEventListener('click', () => { marcaStatus(k.dataset.filtro || ''); location.hash = 'pedidos'; }); });
  $$('[data-tab-link]').forEach(a => a.addEventListener('click', () => marcaStatus('')));
  $('[data-recarregar]').addEventListener('click', () => { if (aba === 'loja') { carregaConfig(); carregaEquipe(); } atualiza({ forca: true }); });
  $('[data-mais]').addEventListener('click', () => carregaLista(false).catch(erroLista));

  /* ---------- linha de pedido ---------- */
  function resumoItens(p) { return p.itens.map(i => `${i.quantidade}x ${i.nome}${/unidades/.test(i.detalhe) ? ` (${i.detalhe.replace(' unidades', ' un')})` : ''}`).join(', '); }
  function linhaPedido(p) {
    const li = el('li');
    const b = el('button', `order${p.status === 'novo' ? ' novo' : ''}`);
    b.type = 'button'; b.dataset.id = p.id;
    const num = el('span', 'o-num', `#${p.numero}`); num.appendChild(el('small', null, quando(p.criado_em)));
    const main = el('span', 'o-main');
    const nome = el('b', null, p.cliente_nome);
    main.append(nome, el('span', null, resumoItens(p)), el('span', null, `${p.modalidade === 'retirada' ? 'Retirada' : 'Entrega'} · ${p.pagamento} · ${telBonito(p.cliente_telefone)}`));
    const side = el('span', 'o-side');
    side.append(el('b', null, fmt(p.total_centavos) + (p.modalidade === 'entrega' && p.taxa_entrega_centavos == null ? ' +' : '')), badgeStatus(p.status));
    if (p.teste) side.appendChild(el('span', 'tag-teste', 'teste'));
    b.append(num, main, side);
    b.addEventListener('click', () => abrePedido(p.id, b));
    li.appendChild(b);
    return li;
  }
  function vazio(ul, titulo, sub) { const li = el('li', 'empty'); li.append(el('b', null, titulo), sub || ''); ul.appendChild(li); }

  /* ---------- carregar ---------- */
  async function carregaResumo() {
    const iv = intervalo();
    const r = await api('resumo', { ...iv, teste: f.testes });
    $$('[data-k]').forEach(k => {
      const v = r[k.dataset.k];
      const alvo = k.tagName === 'BUTTON' ? $('b', k) : k;
      alvo.textContent = /centavos/.test(k.dataset.k) ? fmt(v) : String(v ?? 0);
      if (k.dataset.k === 'novos') k.classList.toggle('tem', v > 0);
    });
    const recentes = await api('pedidos', { ...iv, teste: f.testes, limite: 8 });
    const ul = $('[data-recentes]');
    ul.innerHTML = '';
    if (!recentes.pedidos.length) vazio(ul, f.periodo === 'hoje' ? 'Nenhum pedido hoje ainda' : 'Nenhum pedido no período', 'Quando um cliente pedir pelo site, ele aparece aqui em poucos segundos.');
    recentes.pedidos.forEach(p => ul.appendChild(linhaPedido(p)));
  }
  async function carregaLista(reinicia) {
    if (reinicia) pular = 0;
    const r = await api('pedidos', { ...intervalo(), status: f.status, busca: f.busca, teste: f.testes, limite: 30, pular });
    const ul = $('[data-lista]');
    if (reinicia) ul.innerHTML = '';
    totalLista = r.total;
    r.pedidos.forEach(p => ul.appendChild(linhaPedido(p)));
    pular += r.pedidos.length;
    if (!totalLista) vazio(ul, f.busca ? 'Nada encontrado' : 'Nenhum pedido aqui', f.busca ? 'Confira o número, o nome ou o telefone.' : 'Mude o período ou o filtro de status.');
    $('[data-contagem]').textContent = totalLista ? `${totalLista} ${totalLista === 1 ? 'pedido' : 'pedidos'}${pular < totalLista ? ` (mostrando ${pular})` : ''}` : '';
    $('[data-mais]').hidden = pular >= totalLista;
  }

  // uma chamada só traz o que muda o tempo todo: pedidos em andamento (para o quadro, o número no menu e o aviso de
  // pedido novo), os finalizados de hoje e se a loja está aberta. Se nada mudou desde a última vez, a API responde
  // só "igual" e o painel não redesenha nada.
  let marca = null, marcaChave = '', lojaAberta = true, ativosAgora = 0;
  async function carregaPainel(forca) {
    const de = inicioDia(0), chave = `${de}|${f.testes}`;
    const r = await api('painel', { de, teste: f.testes, marca: !forca && chave === marcaChave ? marca : null });
    lojaAberta = r.aceitando !== false;
    if (r.igual) return false;
    marca = r.marca; marcaChave = chave;
    ativosAgora = r.ativos.length;
    const novos = r.ativos.filter(p => p.status === 'novo');
    const n = novos.length;
    if (n !== novosAgora) { novosAgora = n; alarme(); }
    const b = $('[data-badge-novos]');
    b.textContent = String(n); b.hidden = !n;
    document.title = `${n ? `(${n}) ` : ''}Painel · Coxitas`;
    const nums = new Set(novos.map(p => p.numero));
    if (conhecidos) novos.forEach(p => { if (!conhecidos.has(p.numero)) avisaNovo(p); });
    conhecidos = conhecidos ? new Set([...conhecidos, ...nums]) : nums;
    if (aba === 'quadro') desenhaQuadro(r.ativos, r.fim);
    return true;
  }
  let ocupado = false, deNovo = null;
  async function atualiza(o = {}) {
    if (!eu) return;
    if (ocupado) { deNovo = { silencioso: true, forca: !!(o.forca || (deNovo && deNovo.forca)) }; return; }
    ocupado = true;
    try {
      const mudou = await carregaPainel(o.forca);
      if (mudou || o.forca) {
        if (aba === 'painel') await carregaResumo();
        if (aba === 'pedidos') await carregaLista(true);
        if (aberto && !o.semDetalhe) await recarregaDetalhe();
      }
      falhou = false;
    } catch (e) {
      if (eu && e.message !== 'sem_login') { falhou = true; if (!o.silencioso) toast('Não deu para atualizar', textoErro(e), { erro: true, tempo: 5000 }); }
    } finally {
      ocupado = false;
      if (eu) marcaConexao();
      if (deNovo) { const d = deNovo; deNovo = null; atualiza(d); } else agendaConferencia();
    }
  }

  function avisaNovo(p) {
    if (avisados.has(p.numero)) return;
    avisados.add(p.numero);
    if (conhecidos) conhecidos.add(p.numero);
    bip();
    toast(`Pedido novo nº ${p.numero}`, `${p.cliente_nome} · ${fmt(p.total_centavos)}`, { abrir: p.id, tempo: 15000 });
    requestAnimationFrame(() => $$(`.order[data-id="${p.id}"]`).forEach(x => x.classList.add('flash')));
  }

  /* ---------- quadro de pedidos (como o gestor do iFood): cada etapa numa coluna, o mais antigo primeiro ---------- */
  const COLS = { novo: ['novo'], preparo: ['confirmado', 'em_preparo'], pronto: ['pronto_retirada', 'saiu_entrega'] };
  const PROXIMO = { novo: () => 'confirmado', confirmado: () => 'em_preparo', em_preparo: p => (p.modalidade === 'retirada' ? 'pronto_retirada' : 'saiu_entrega'), pronto_retirada: () => 'concluido', saiu_entrega: () => 'concluido' };
  const BOTAO = { novo: () => 'Aceitar pedido', confirmado: () => 'Começar o preparo', em_preparo: p => (p.modalidade === 'retirada' ? 'Pronto para retirada' : 'Saiu para entrega'), pronto_retirada: () => 'Cliente retirou', saiu_entrega: () => 'Entregue' };
  const VAZIO = { novo: 'Nenhum pedido esperando.', preparo: 'Nada no preparo agora.', pronto: 'Nenhum pedido pronto ou a caminho.', fim: 'Nenhum pedido finalizado hoje.' };
  const minutos = iso => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  const tempoTxt = m => (m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);
  // pedido novo esperando mais de 5 min fica amarelo e mais de 10 vermelho; em andamento, 40 e 60 min
  const nivel = (status, iso) => { const m = minutos(iso); return status === 'novo' ? (m >= 10 ? 'atraso' : m >= 5 ? 'atencao' : '') : (m >= 60 ? 'atraso' : m >= 40 ? 'atencao' : ''); };
  let cancelarAoAbrir = false;

  function cartao(p, fim) {
    const li = el('li', `cp cp-${p.status} ${fim ? '' : nivel(p.status, p.criado_em)}`.trim());
    li.dataset.id = p.id; li.dataset.criado = p.criado_em; li.dataset.status = p.status;
    const abre = el('button', 'cp-abre'); abre.type = 'button'; abre.title = `Abrir o pedido nº ${p.numero}`;
    const l1 = el('span', 'cp-l1');
    l1.append(el('b', 'cp-num', `#${p.numero}`));
    if (p.teste) l1.append(el('span', 'tag-teste', 'teste'));
    l1.append(fim ? badgeStatus(p.status) : el('span', 'cp-tempo', tempoTxt(minutos(p.criado_em))));
    abre.append(l1, el('span', 'cp-nome', p.cliente_nome));
    if (!fim) {
      abre.append(el('span', 'cp-itens', resumoItens(p)));
      const rec = el('span', 'cp-rec');
      rec.append(ico(p.modalidade === 'retirada' ? 'i-bag' : 'i-moto'), p.modalidade === 'retirada' ? 'Retirada' : (p.endereco || 'Entrega'));
      abre.append(rec);
      const l4 = el('span', 'cp-l4');
      l4.append(el('span', null, p.pagamento + (p.troco_para_centavos ? ` · troco p/ ${fmt(p.troco_para_centavos)}` : '')), el('b', null, fmt(p.total_centavos) + (p.modalidade === 'entrega' && p.taxa_entrega_centavos == null ? ' +' : '')));
      abre.append(l4);
      if (COLS.preparo.includes(p.status) || COLS.pronto.includes(p.status)) abre.append(badgeStatus(p.status));
    } else abre.append(el('span', 'cp-l4', fmt(p.total_centavos)));
    abre.addEventListener('click', () => abrePedido(p.id, abre));
    li.appendChild(abre);
    if (!fim && PROXIMO[p.status]) {
      const acoes = el('div', 'cp-acoes');
      const para = PROXIMO[p.status](p);
      const ok = el('button', `btn btn-sm ${p.status === 'novo' ? 'btn-aceitar' : ''}`.trim(), BOTAO[p.status](p));
      ok.type = 'button';
      ok.addEventListener('click', () => avanca(p, para, ok));
      acoes.appendChild(ok);
      if (p.status === 'novo') {
        const nao = el('button', 'btn btn-red btn-sm', 'Recusar'); nao.type = 'button';
        nao.addEventListener('click', () => { cancelarAoAbrir = true; abrePedido(p.id, nao); });
        acoes.appendChild(nao);
      }
      li.appendChild(acoes);
    }
    return li;
  }
  function coluna(nome, lista, fim) {
    const sec = $(`[data-col="${nome}"]`);
    $('[data-col-n]', sec).textContent = String(lista.length);
    const ul = $('[data-col-list]', sec);
    ul.innerHTML = '';
    if (!lista.length) { ul.appendChild(el('li', 'col-vazio', VAZIO[nome])); return; }
    lista.forEach(p => ul.appendChild(cartao(p, fim)));
  }
  function desenhaQuadro(ativos, fim) {
    const fila = (a, b) => (a.criado_em < b.criado_em ? -1 : 1);
    for (const [nome, sts] of Object.entries(COLS)) coluna(nome, ativos.filter(p => sts.includes(p.status)).sort(fila), false);
    coluna('fim', fim, true);
  }
  async function avanca(p, para, btn) {
    $$('button', btn.closest('.cp')).forEach(b => { b.disabled = true; });
    btn.setAttribute('aria-busy', 'true');
    try {
      await api('status', null, { id: p.id, para, de: p.status });
      toast(`Pedido nº ${p.numero}: ${NOME[para]}`, null, { tempo: 3000 });
    } catch (e) {
      toast('Não mudou o status', textoErro(e), { erro: true });
    } finally {
      atualiza({ silencioso: true, forca: true });
    }
  }
  // o tempo de espera de cada cartão anda sozinho
  setInterval(() => {
    $$('.board .cp[data-criado]').forEach(li => {
      if (li.closest('[data-col="fim"]')) return;
      const t = $('.cp-tempo', li); if (t) t.textContent = tempoTxt(minutos(li.dataset.criado));
      li.classList.remove('atencao', 'atraso');
      const n = nivel(li.dataset.status, li.dataset.criado); if (n) li.classList.add(n);
    });
  }, 30000);

  // como no iFood: enquanto houver pedido novo sem aceitar, o toque repete a cada 20 segundos (com o som ligado)
  let novosAgora = 0, tAlarme = 0;
  function alarme() {
    clearInterval(tAlarme);
    if (som && novosAgora > 0) tAlarme = setInterval(() => { if (novosAgora > 0 && som && eu) bip(); else clearInterval(tAlarme); }, 20000);
  }

  /* ---------- conferência automática ---------- */
  // 10 s com a tela à vista; 30 s com a aba escondida. Com a loja fechada, ou sem ninguém mexer no painel há 3 horas e
  // sem pedido em andamento, confere a cada 5 minutos: o banco do plano grátis dorme depois de 5 minutos parado e assim
  // não gasta a cota à toa. Qualquer toque na tela volta ao normal na hora.
  let tConf = 0, falhou = false, ultimoToque = Date.now();
  const economia = () => !lojaAberta || (Date.now() - ultimoToque > 3 * 3600e3 && ativosAgora === 0);
  const espera = () => (economia() ? 300e3 : document.hidden ? 30e3 : 10e3);
  function agendaConferencia() { clearTimeout(tConf); if (eu) tConf = setTimeout(() => atualiza({ silencioso: true }), espera()); }
  function marcaConexao() {
    const l = $('[data-live]'), t = $('[data-live-txt]');
    l.classList.remove('on', 'poll', 'off');
    if (!navigator.onLine) { l.classList.add('off'); t.textContent = 'Sem internet'; l.title = 'Sem internet: os pedidos voltam a aparecer quando a conexão voltar.'; return; }
    if (falhou) { l.classList.add('off'); t.textContent = 'Sem conexão'; l.title = 'Não deu para falar com o servidor agora; o painel tenta de novo sozinho.'; return; }
    if (economia()) {
      l.classList.add('poll');
      t.textContent = lojaAberta ? 'Modo economia' : 'Loja fechada';
      l.title = lojaAberta ? 'Ninguém mexe no painel há 3 horas: ele confere os pedidos a cada 5 minutos. Toque em qualquer lugar para voltar ao normal.' : 'A loja está fechada para pedidos pelo site: o painel confere a cada 5 minutos.';
      return;
    }
    l.classList.add('on'); t.textContent = 'Atualiza a cada 10 s'; l.title = 'O painel confere os pedidos sozinho a cada 10 segundos.';
  }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => {
    const estava = !!eu && economia();
    ultimoToque = Date.now();
    if (estava && !economia()) { marcaConexao(); atualiza({ silencioso: true }); }
  }, { passive: true }));
  window.addEventListener('online', () => { if (eu) { marcaConexao(); atualiza({ silencioso: true }); } });
  window.addEventListener('offline', () => { if (eu) marcaConexao(); });
  document.addEventListener('visibilitychange', () => { if (eu) { if (document.hidden) agendaConferencia(); else atualiza({ silencioso: true }); } });

  /* ---------- detalhe do pedido ---------- */
  const sheet = $('[data-sheet]'), sheetBg = $('[data-sheet-bg]'), corpo = $('[data-d-body]');
  async function abrePedido(id, origem) {
    abertoDe = origem || document.activeElement;
    aberto = { id };
    sheet.hidden = false; sheetBg.hidden = false;
    corpo.innerHTML = '';
    corpo.appendChild(el('p', 'muted', 'Carregando…'));
    sheet.focus();
    await recarregaDetalhe();
  }
  function fechaPedido() {
    aberto = null; sheet.hidden = true; sheetBg.hidden = true;
    if (abertoDe && document.contains(abertoDe)) abertoDe.focus();
  }
  $('[data-fechar]').addEventListener('click', fechaPedido);
  sheetBg.addEventListener('click', fechaPedido);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && aberto) fechaPedido(); });

  async function recarregaDetalhe() {
    if (!aberto) return;
    try { desenhaDetalhe(await api('pedido', { id: aberto.id })); }
    catch (e) { corpo.innerHTML = ''; corpo.appendChild(el('p', 'alert', textoErro(e))); }
  }
  function sec(titulo) { const s = el('section', 'd-sec'); s.appendChild(el('h3', null, titulo)); return s; }
  function desenhaDetalhe(p) {
    if (!aberto || aberto.id !== p.id) return;
    const rolagem = corpo.scrollTop;
    aberto = p;
    $('[data-d-num]').textContent = `nº ${p.numero}`;
    const st = $('[data-d-st]'); st.className = `st st-${p.status}`; st.textContent = NOME[p.status];
    corpo.innerHTML = '';

    // ações primeiro: é o que a equipe mais usa
    const acoes = el('div', 'd-actions');
    if (p.proximos.length) {
      p.proximos.filter(s => s !== 'cancelado').forEach(s => {
        const b = el('button', 'btn', typeof ACAO[s] === 'function' ? ACAO[s](p.modalidade) : ACAO[s]);
        b.type = 'button';
        b.addEventListener('click', () => mudaStatus(p, s, null, b));
        acoes.appendChild(b);
      });
      if (p.proximos.includes('cancelado')) {
        const c = el('button', 'btn btn-red', 'Cancelar pedido'); c.type = 'button';
        c.addEventListener('click', () => {
          const box = el('div', 'cancel-box');
          const lab = el('label', 'field');
          lab.append(el('span', null, 'Motivo do cancelamento (opcional)'));
          const ta = el('textarea', 'input'); ta.rows = 2; ta.maxLength = 300; lab.appendChild(ta);
          const ok = el('button', 'btn btn-red', 'Confirmar cancelamento'); ok.type = 'button';
          const volta = el('button', 'link', 'Voltar'); volta.type = 'button';
          ok.addEventListener('click', () => mudaStatus(p, 'cancelado', ta.value, ok));
          volta.addEventListener('click', () => { box.replaceWith(c); c.focus(); });
          box.append(lab, ok, volta);
          c.replaceWith(box); ta.focus();
        });
        acoes.appendChild(c);
      }
    } else acoes.appendChild(el('p', 'd-final', p.status === 'concluido' ? 'Pedido concluído.' : 'Pedido cancelado.'));
    corpo.appendChild(acoes);
    if (cancelarAoAbrir) { cancelarAoAbrir = false; const c = $$('.btn-red', acoes).find(b => b.textContent === 'Cancelar pedido'); if (c) c.click(); }

    // cliente
    const cli = sec('Cliente');
    cli.appendChild(el('p', 'd-big', p.cliente_nome));
    const tel = telBonito(p.cliente_telefone);
    cli.appendChild(el('p', 'num', tel));
    const botoes = el('div', 'd-row d-noprint');
    const zap = el('a', 'btn btn-wa btn-sm'); zap.append(ico('i-wa'), 'WhatsApp');
    zap.href = `https://wa.me/55${p.cliente_telefone}?text=${encodeURIComponent(`Olá, ${p.cliente_nome.split(' ')[0]}! Aqui é da Coxitas, sobre o seu pedido nº ${p.numero}.`)}`;
    zap.target = '_blank'; zap.rel = 'noopener';
    const lig = el('a', 'btn btn-line btn-sm'); lig.append(ico('i-phone'), 'Ligar'); lig.href = `tel:+55${p.cliente_telefone}`;
    botoes.append(zap, lig);
    cli.appendChild(botoes);
    corpo.appendChild(cli);

    // recebimento e pagamento
    const rec = sec(p.modalidade === 'retirada' ? 'Retirada na loja' : 'Entrega');
    if (p.modalidade === 'entrega') {
      rec.appendChild(el('p', 'd-big', p.endereco));
      const mapa = el('a', 'btn btn-line btn-sm d-noprint'); mapa.append(ico('i-pin'), 'Abrir no mapa');
      mapa.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.endereco}, ${CIDADE}`)}`; mapa.target = '_blank'; mapa.rel = 'noopener';
      const r = el('div', 'd-row'); r.appendChild(mapa); rec.appendChild(r);
    } else rec.appendChild(el('p', null, 'O cliente vem buscar na loja.'));
    rec.appendChild(el('p', null, `Pagamento: ${p.pagamento}${p.troco_para_centavos ? ` · troco para ${fmt(p.troco_para_centavos)}` : ''}`));
    corpo.appendChild(rec);

    // itens
    const it = sec('Itens');
    const ul = el('ul', 'd-items');
    p.itens.forEach(i => { const li = el('li'); li.append(el('span', null, `${i.quantidade}x ${i.nome} · ${i.detalhe}`), el('span', null, fmt(i.total_centavos))); ul.appendChild(li); });
    it.appendChild(ul);
    if (p.sabores && p.sabores.length) it.appendChild(el('p', null, `Sabores preferidos: ${p.sabores.join(', ')}`));
    if (p.observacao) it.appendChild(el('p', 'd-obs', p.observacao));
    const tot = el('div', 'd-tot');
    const linha = (a, b, g) => { const d = el('div', g ? 'g' : ''); d.append(el('span', null, a), el('span', 'num', b)); tot.appendChild(d); };
    linha('Itens', fmt(p.subtotal_centavos));
    if (p.modalidade === 'entrega') linha('Entrega', p.taxa_entrega_centavos == null ? 'a combinar' : fmt(p.taxa_entrega_centavos));
    linha('Total', fmt(p.total_centavos) + (p.modalidade === 'entrega' && p.taxa_entrega_centavos == null ? ' + entrega' : ''), true);
    it.appendChild(tot);
    corpo.appendChild(it);

    // histórico
    const hi = sec('Histórico');
    const tl = el('ol', 'timeline');
    p.eventos.forEach(e => {
      const li = el('li');
      const t = el('time', null, quando(e.criado_em)); t.dateTime = e.criado_em;
      li.append(t, el('b', null, NOME[e.status_para] || e.status_para));
      li.appendChild(el('small', null, e.autor_nome ? `por ${e.autor_nome}` : ''));
      if (e.nota) li.appendChild(el('em', null, e.nota));
      tl.appendChild(li);
    });
    hi.appendChild(tl);
    if (p.teste) hi.appendChild(el('p', 'tag-teste', 'pedido de teste'));
    corpo.appendChild(hi);

    const imp = el('button', 'btn btn-line btn-sm d-noprint'); imp.type = 'button'; imp.append(ico('i-print'), 'Imprimir para a cozinha');
    imp.addEventListener('click', () => window.print());
    const r2 = el('div', 'd-row'); r2.appendChild(imp); corpo.appendChild(r2);
    corpo.scrollTop = rolagem;
  }
  async function mudaStatus(p, para, nota, btn) {
    $$('button', corpo).forEach(b => { b.disabled = true; });
    if (btn) btn.setAttribute('aria-busy', 'true');
    try {
      const novo = await api('status', null, { id: p.id, para, de: p.status, nota: nota || null });
      desenhaDetalhe(novo);
      toast(`Pedido nº ${p.numero}: ${NOME[para]}`, null, { tempo: 3500 });
      atualiza({ silencioso: true, semDetalhe: true });
    } catch (e) {
      toast('Não mudou o status', textoErro(e), { erro: true });
      await recarregaDetalhe();
    }
  }

  /* ---------- loja ---------- */
  const cfgForm = $('[data-cfg]');
  const reais = c => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));
  const centavos = v => { const s = String(v || '').trim(); if (!s) return null; const n = Math.round(parseFloat(s.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) * 100); return Number.isFinite(n) ? n : NaN; };
  async function carregaConfig() {
    try {
      const c = await api('config');
      cfgForm.aceitando_pedidos.checked = c.aceitando_pedidos;
      lojaAberta = c.aceitando_pedidos !== false;
      marcaConexao();
      cfgForm.mensagem_pausa.value = c.mensagem_pausa || '';
      cfgForm.taxa.value = reais(c.taxa_entrega_centavos);
      cfgForm.minimo.value = c.pedido_minimo_centavos ? reais(c.pedido_minimo_centavos) : '';
      cfgForm.pagamentos.value = (c.pagamentos || []).join('\n');
      const dono = eu && eu.papel === 'dono';
      $$('input, textarea, button', cfgForm).forEach(x => { x.disabled = !dono; });
      $('[data-cfg-so-dono]').hidden = dono;
      $('[data-testes-box]').hidden = !dono;
    } catch (e) { toast('Não deu para abrir as configurações', textoErro(e), { erro: true }); }
  }
  cfgForm.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('[data-cfg-err]'), ok = $('[data-cfg-ok]'), btn = $('[data-cfg-btn]');
    err.hidden = true; ok.hidden = true;
    const taxa = centavos(cfgForm.taxa.value), minimo = centavos(cfgForm.minimo.value);
    const pags = cfgForm.pagamentos.value.split('\n').map(x => x.trim()).filter(Boolean);
    if (Number.isNaN(taxa) || Number.isNaN(minimo) || (taxa != null && taxa > 100000)) { err.textContent = 'Confira os valores em reais (ex.: 5,00).'; err.hidden = false; return; }
    if (!pags.length) { err.textContent = 'Deixe pelo menos uma forma de pagamento.'; err.hidden = false; return; }
    btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
    try {
      await api('salvar_config', null, { p: { aceitando_pedidos: cfgForm.aceitando_pedidos.checked, mensagem_pausa: cfgForm.mensagem_pausa.value, taxa_entrega_centavos: taxa == null ? '' : taxa, pedido_minimo_centavos: minimo || 0, pagamentos: pags } });
      ok.hidden = false;
      await carregaConfig();
      atualiza({ silencioso: true });
    } catch (ex) { err.textContent = textoErro(ex); err.hidden = false; }
    finally { btn.removeAttribute('aria-busy'); btn.disabled = false; }
  });
  $('[data-apagar-testes]').addEventListener('click', async e => {
    if (!confirm('Apagar todos os pedidos marcados como teste? Os pedidos reais não são apagados.')) return;
    const msg = $('[data-apagar-msg]'), b = e.currentTarget;
    b.disabled = true;
    try { const { apagados: n } = await api('apagar_testes', null, {}); msg.textContent = `${n} ${n === 1 ? 'pedido de teste apagado' : 'pedidos de teste apagados'}.`; }
    catch (ex) { msg.textContent = textoErro(ex); }
    finally { b.disabled = false; }
  });

  /* ---------- equipe (só o dono vê e mexe) ---------- */
  const eqBox = $('[data-equipe-box]'), eqLista = $('[data-equipe]'), eqForm = $('[data-equipe-form]');
  const fData = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  async function carregaEquipe() {
    const dono = !!eu && eu.papel === 'dono';
    eqBox.hidden = !dono;
    if (!dono) return;
    try {
      const { equipe } = await api('equipe');
      eqLista.innerHTML = '';
      equipe.forEach(p => {
        const li = el('li', p.ativo ? '' : 'inativo');
        const info = el('div', 'eq-info');
        const nome = el('b', null, p.nome);
        if (p.email === eu.email) nome.append(el('span', 'muted', ' (você)'));
        info.append(nome, el('span', 'eq-email', p.email), el('small', null, `${p.papel === 'dono' ? 'Dono' : 'Atendente'}${p.ativo ? '' : ' · desativado'} · ${p.ultimo_login ? `último login ${fData.format(new Date(p.ultimo_login))}` : 'ainda não entrou'}`));
        li.appendChild(info);
        if (p.email !== eu.email) {
          const acoes = el('div', 'eq-acoes');
          const at = el('button', 'btn btn-line btn-sm', p.ativo ? 'Desativar' : 'Reativar'); at.type = 'button';
          at.addEventListener('click', () => salvaPessoa({ email: p.email, nome: p.nome, papel: p.papel, ativo: !p.ativo }, at));
          const rm = el('button', 'btn btn-red btn-sm', 'Remover'); rm.type = 'button';
          rm.addEventListener('click', async () => {
            if (!confirm(`Remover ${p.nome} (${p.email}) da equipe? O acesso ao painel acaba na hora.`)) return;
            rm.disabled = true;
            try { await api('equipe_remover', null, { email: p.email }); await carregaEquipe(); }
            catch (e) { toast('Não removeu', textoErro(e), { erro: true }); rm.disabled = false; }
          });
          acoes.append(at, rm);
          li.appendChild(acoes);
        }
        eqLista.appendChild(li);
      });
    } catch (e) { toast('Não deu para abrir a equipe', textoErro(e), { erro: true }); }
  }
  async function salvaPessoa(p, btn) {
    btn.disabled = true;
    try { await api('equipe_salvar', null, p); await carregaEquipe(); }
    catch (e) { toast('Não salvou', textoErro(e), { erro: true }); btn.disabled = false; }
  }
  eqForm.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('[data-equipe-err]'), btn = $('button[type=submit]', eqForm);
    err.hidden = true;
    const email = eqForm.email.value.trim().toLowerCase(), nome = eqForm.nome.value.trim();
    const erro = nome.length < 2 ? 'Escreva o nome (pelo menos 2 letras).' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'Confira o e-mail.' : '';
    if (erro) { err.textContent = erro; err.hidden = false; return; }
    btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
    try {
      await api('equipe_salvar', null, { email, nome, papel: eqForm.dono.checked ? 'dono' : 'atendente', ativo: true });
      eqForm.reset();
      await carregaEquipe();
      toast(`${nome} entrou na equipe`, `Já pode entrar no painel com o código que chega em ${email}.`, { tempo: 8000 });
    } catch (ex) { err.textContent = textoErro(ex); err.hidden = false; }
    finally { btn.removeAttribute('aria-busy'); btn.disabled = false; }
  });

  /* ---------- login e sessão ---------- */
  const ERRO_LOGIN = {
    login_cancelado: 'O login foi cancelado.',
    login_expirado: 'O login demorou demais ou foi aberto em outra aba. Tente de novo.',
    login_recusado: 'A Vercel não confirmou o login. Tente de novo.',
    email_nao_verificado: 'O e-mail da sua conta da Vercel ainda não foi confirmado. Confirme o e-mail na Vercel e tente de novo.',
    muitas_tentativas: 'Muitas tentativas seguidas. Espere 10 minutos e tente de novo.',
    sessao: 'Sua sessão terminou. Entre de novo para continuar.',
    sem_conexao: 'Sem conexão com o servidor. Confira a internet e recarregue a página.',
  };
  function mostraLogin(codigo) {
    const err = $('[data-login-err]');
    err.textContent = ERRO_LOGIN[codigo] || '';
    err.hidden = !ERRO_LOGIN[codigo];
    $('[data-entrar]').removeAttribute('aria-busy');
    mostraTela('login');
    if (!cf.hidden) (emailCodigo ? cf.codigo : cf.email).focus();
  }

  /* ---------- entrar com código no e-mail ---------- */
  // 1) e-mail -> o servidor pede ao login do Neon para mandar o código (só se o e-mail for da equipe);
  // 2) código -> o servidor confere com o Neon e abre a sessão. O código nunca passa por este arquivo além do formulário.
  const cf = $('[data-codigo-form]'), cfBtn = $('[data-codigo-btn]'), reenviar = $('[data-reenviar]');
  let emailCodigo = '', tReenvio = 0;
  const ERRO_COD = {
    email_invalido: 'Confira o e-mail.',
    codigo_invalido: 'Código errado. Use o do último e-mail que chegou.',
    codigo_expirado: 'Esse código venceu. Toque em "Reenviar código".',
    codigo_bloqueado: 'Muitas tentativas com esse código. Toque em "Reenviar código".',
    muitas_tentativas: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
    envio_falhou: 'Não deu para mandar o código agora. Tente de novo em instantes.',
    codigo_nao_configurado: 'O login por código ainda não está ligado.',
    sem_banco: 'O banco de pedidos não está ligado.',
    origem: 'Bloqueado por segurança. Recarregue a página.',
  };
  const erroLogin = txt => { const err = $('[data-login-err]'); err.textContent = txt; err.hidden = !txt; };
  try { cf.email.value = localStorage.getItem('cx-painel-email') || ''; } catch (e) {}
  async function postAuth(acao, dados) {
    try {
      const r = await fetch(`../api/auth/${acao}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
      const b = await r.json().catch(() => null);
      return { ok: r.ok, erro: (b && b.erro) || (r.ok ? '' : 'falhou') };
    } catch (e) { return { ok: false, erro: 'rede' }; }
  }
  function passoCodigo(on) {
    $$('[data-passo-codigo]', cf).forEach(x => { x.hidden = !on; });
    $('[data-passo-email]', cf).hidden = on;
    cfBtn.textContent = on ? 'Entrar' : 'Receber código';
    if (on) { cf.codigo.value = ''; cf.codigo.focus(); } else cf.email.focus();
  }
  function contaReenvio() {
    clearInterval(tReenvio);
    let falta = 60;
    reenviar.disabled = true;
    const passo = () => { reenviar.textContent = falta > 0 ? `Reenviar em ${falta}s` : 'Reenviar código'; if (falta-- <= 0) { reenviar.disabled = false; clearInterval(tReenvio); } };
    passo(); tReenvio = setInterval(passo, 1000);
  }
  async function pedeCodigo(email) {
    const r = await postAuth('codigo', { email });
    if (!r.ok) { erroLogin(r.erro === 'rede' ? ERRO_LOGIN.sem_conexao : ERRO_COD[r.erro] || 'Não deu certo agora. Tente de novo.'); return false; }
    $('[data-codigo-dica]').textContent = `Se ${email} for da equipe, o código chega em instantes. Olhe também o spam e as promoções. Ele vale por poucos minutos.`;
    contaReenvio();
    return true;
  }
  cf.addEventListener('submit', async e => {
    e.preventDefault();
    erroLogin('');
    if (cfBtn.getAttribute('aria-busy') === 'true') return;
    if (!emailCodigo) {
      const email = cf.email.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { erroLogin('Digite o e-mail completo, por exemplo nome@gmail.com.'); cf.email.focus(); return; }
      cfBtn.setAttribute('aria-busy', 'true');
      const foi = await pedeCodigo(email);
      cfBtn.removeAttribute('aria-busy');
      if (!foi) return;
      emailCodigo = email;
      try { localStorage.setItem('cx-painel-email', email); } catch (ex) {}
      passoCodigo(true);
      return;
    }
    const codigo = cf.codigo.value.replace(/\D/g, '');
    if (codigo.length < 6) { erroLogin('Digite os 6 números do código.'); cf.codigo.focus(); return; }
    cfBtn.setAttribute('aria-busy', 'true');
    const r = await postAuth('codigo_entrar', { email: emailCodigo, codigo });
    cfBtn.removeAttribute('aria-busy');
    if (!r.ok) { erroLogin(r.erro === 'rede' ? ERRO_LOGIN.sem_conexao : ERRO_COD[r.erro] || 'Não deu certo agora. Tente de novo.'); cf.codigo.select(); return; }
    clearInterval(tReenvio);
    emailCodigo = ''; passoCodigo(false);
    inicia();
  });
  // colou ou digitou os 6 números: entra sozinho
  cf.codigo.addEventListener('input', () => { if (cf.codigo.value.replace(/\D/g, '').length === 6) cf.requestSubmit(); });
  reenviar.addEventListener('click', async () => { erroLogin(''); reenviar.disabled = true; if (!(await pedeCodigo(emailCodigo))) reenviar.disabled = false; else cf.codigo.focus(); });
  $('[data-trocar-email]').addEventListener('click', () => { clearInterval(tReenvio); emailCodigo = ''; erroLogin(''); passoCodigo(false); });
  // o que falta ligar na Vercel (a API só conta se está ligado ou não; segredo nenhum passa por aqui)
  function mostraConfig(est) {
    const passo = (nome, ok, txt) => { const li = $(`[data-passo="${nome}"]`); li.classList.toggle('ok', ok); $('span', li).textContent = txt; };
    if (!est) {
      $('[data-cfg-msg]').textContent = 'Não deu para falar com a API do site. Confira a internet e recarregue a página.';
      $('[data-passos]').hidden = true;
    } else {
      passo('banco', est.banco, est.banco ? 'Ligado.' : 'Falta ligar o Postgres (Neon) na aba Storage do projeto na Vercel.');
      const algum = est.login || est.codigo;
      passo('login', algum, algum ? [est.codigo && 'Código por e-mail ligado.', est.login && 'Conta da Vercel ligada.'].filter(Boolean).join(' ') : 'Falta ligar o login do Neon (Auth) no banco ou as chaves do app da Vercel.');
      $('[data-retorno]').textContent = est.retorno;
    }
    mostraTela('config');
  }
  function para() {
    eu = null; clearTimeout(tConf); clearTimeout(tBusca); clearInterval(tAlarme);
    novosAgora = 0; conhecidos = null; marca = null; marcaChave = ''; avisados.clear(); fechaPedido();
    document.title = 'Painel · Coxitas';
  }
  function sessaoAcabou() { if (!eu) return; para(); mostraLogin('sessao'); }
  async function sair() {
    para();
    try { await fetch('../api/auth/sair', { method: 'POST' }); } catch (e) {}
    mostraLogin();
  }
  $$('[data-sair]').forEach(b => b.addEventListener('click', sair));
  $('[data-entrar]').addEventListener('click', e => { e.currentTarget.setAttribute('aria-busy', 'true'); });
  // entrada de teste sem a Vercel: a API só liga isso no computador de quem desenvolve (nunca na Vercel)
  $('[data-dev]').addEventListener('submit', e => {
    e.preventDefault();
    location.href = `../api/auth/dev?email=${encodeURIComponent(e.currentTarget.email.value.trim())}`;
  });

  function entra(dados) {
    eu = dados;
    $('[data-me-nome]').textContent = eu.nome;
    $('[data-me-papel]').textContent = eu.papel === 'dono' ? 'Dono' : 'Atendente';
    mostraTela('app');
    marcaConexao();
    vaiPara(location.hash.slice(1) || 'quadro');
  }

  async function inicia() {
    // a volta do login da Vercel traz ?erro=... (e o e-mail, quando a conta não é da equipe); sai do endereço depois de lido
    const q = new URLSearchParams(location.search);
    const erro = q.get('erro') || '', emailNegado = q.get('email') || '';
    if (location.search) history.replaceState(null, '', location.pathname + location.hash);
    let est = null;
    try { const r = await fetch('../api/auth/estado', { cache: 'no-store' }); if (r.ok) est = await r.json(); } catch (e) {}
    if (!est || !est.banco || (!est.login && !est.codigo && !est.dev)) return mostraConfig(est);
    $('[data-dev]').hidden = !est.dev;
    cf.hidden = !est.codigo;
    $('[data-entrar]').hidden = !est.login;
    $('[data-ou]').hidden = !(est.codigo && est.login);
    if (!est.codigo) $('[data-login-txt]').textContent = 'Área da equipe. Entre com a sua conta da Vercel: o painel confere se o e-mail dela está na equipe da loja.';
    if (erro === 'sem_acesso') { $('[data-negado-email]').textContent = emailNegado || 'desta conta'; return mostraTela('negado'); }
    if (est.eu) entra(est.eu); else mostraLogin(erro);
  }
  inicia();
})();
