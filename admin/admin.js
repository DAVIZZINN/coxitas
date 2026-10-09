/* Coxitas · painel da loja.
   Login pelo Supabase Auth; todos os dados passam pelas funções do banco, que conferem se a pessoa logada é da equipe
   (supabase/01-estrutura.sql). Esconder esta página não é a proteção: sem login e sem cadastro na equipe o banco não
   entrega nada. Pedidos novos chegam em tempo real; se o tempo real cair, o painel confere sozinho a cada 20 segundos. */
(() => {
  'use strict';
  // não deixa o painel ser aberto dentro de outro site (clique enganado)
  if (window.top !== window.self) { document.documentElement.textContent = ''; return; }

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CIDADE = 'Votuporanga - SP';
  const CX = window.COXITAS || {};
  const views = $$('[data-v]');
  const mostraTela = v => views.forEach(el => { el.hidden = el.dataset.v !== v; });

  if (!CX.supabaseUrl || !CX.supabaseChave || !window.supabase) { mostraTela('config'); return; }
  const sb = window.supabase.createClient(CX.supabaseUrl, CX.supabaseChave, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cx-painel-sessao' },
  });

  /* ---------- formatos ---------- */
  const fmt = c => { const [r, d] = (Math.abs(+c || 0) / 100).toFixed(2).split('.'); return 'R$ ' + r.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
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

  /* ---------- erros ---------- */
  const ERRO = {
    sem_acesso: 'Sua conta não tem acesso ao painel.',
    so_dono: 'Só o dono da loja pode fazer isso.',
    status_mudou: 'Outra pessoa mudou este pedido antes. A tela foi atualizada.',
    mudanca_invalida: 'Essa mudança de status não vale para este pedido agora.',
    nao_encontrado: 'Pedido não encontrado.',
    nota_longa: 'O motivo ficou longo demais (até 300 letras).',
    pagamentos_invalidos: 'Confira as formas de pagamento (de 1 a 10, uma por linha).',
  };
  const textoErro = e => (e && ERRO[e.message]) || (e && /fetch|network|Failed/i.test(e.message || '') ? 'Sem conexão com o banco. Confira a internet.' : 'Não deu certo agora. Tente de novo.');
  async function rpc(fn, args) {
    const { data, error } = await sb.rpc(fn, args || {});
    if (error) {
      if (error.message === 'sem_acesso') mostraTela('negado');
      throw error;
    }
    return data;
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
  somBtn.addEventListener('click', () => { som = !som; try { localStorage.setItem('cx-painel-som', som ? 'on' : 'off'); } catch (e) {} syncSom(); if (som) bip(); });
  // o navegador só deixa tocar som depois de um clique na página
  document.addEventListener('pointerdown', () => { if (som && audio && audio.state === 'suspended') audio.resume(); }, { passive: true });
  syncSom();

  /* ---------- estado ---------- */
  let eu = null;
  const f = { periodo: 'hoje', de: null, ate: null, testes: false, status: '', busca: '' };
  let pular = 0, totalLista = 0, aberto = null, abertoDe = null;
  const avisados = new Set();
  let conhecidos = null;           // números já vistos (para avisar pedido novo quando o tempo real não estiver ligado)

  function intervalo() {
    // dias contados pelo relógio de Votuporanga
    const inicioDia = desloc => { const sp = new Date(Date.now() - 3 * 3600e3); return new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() - desloc) + 3 * 3600e3).toISOString(); };
    if (f.periodo === 'hoje') return { p_de: inicioDia(0), p_ate: null };
    if (f.periodo === '7') return { p_de: inicioDia(6), p_ate: null };
    if (f.periodo === '30') return { p_de: inicioDia(29), p_ate: null };
    if (f.periodo === 'datas') {
      const d = v => (v ? new Date(`${v}T00:00:00-03:00`) : null);
      const de = d(f.de), ate = d(f.ate);
      return { p_de: de ? de.toISOString() : null, p_ate: ate ? new Date(ate.getTime() + 86400000).toISOString() : null };
    }
    return { p_de: null, p_ate: null };
  }

  /* ---------- abas ---------- */
  const TITULO = { painel: 'Painel', pedidos: 'Pedidos', loja: 'Loja' };
  let aba = 'painel';
  function vaiPara(nova) {
    aba = TITULO[nova] ? nova : 'painel';
    $$('[data-tab]').forEach(a => { if (a.dataset.tab === aba) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $$('[data-tab-view]').forEach(v => { v.hidden = v.dataset.tabView !== aba; });
    $('[data-titulo]').textContent = TITULO[aba];
    $('[data-filtros]').hidden = aba === 'loja';
    if (aba === 'loja') carregaConfig(); else atualiza();
  }
  window.addEventListener('hashchange', () => vaiPara(location.hash.slice(1)));

  /* ---------- filtros ---------- */
  $$('[data-p]').forEach(b => b.addEventListener('click', () => {
    f.periodo = b.dataset.p;
    $$('[data-p]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('[data-datas]').hidden = f.periodo !== 'datas';
    if (f.periodo !== 'datas') atualiza({ reinicia: true });
  }));
  $('[data-de]').addEventListener('change', e => { f.de = e.target.value || null; atualiza({ reinicia: true }); });
  $('[data-ate]').addEventListener('change', e => { f.ate = e.target.value || null; atualiza({ reinicia: true }); });
  $('[data-testes]').addEventListener('change', e => { f.testes = e.target.checked; conhecidos = null; atualiza({ reinicia: true }); });
  const statusBtns = $$('[data-s]');
  function marcaStatus(s) { f.status = s; statusBtns.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.s === s))); }
  statusBtns.forEach(b => b.addEventListener('click', () => { marcaStatus(b.dataset.s); carregaLista(true); }));
  let tBusca = 0;
  $('[data-busca]').addEventListener('input', e => { clearTimeout(tBusca); tBusca = setTimeout(() => { f.busca = e.target.value.trim(); carregaLista(true); }, 300); });
  $$('[data-k]').forEach(k => { if (k.tagName === 'BUTTON') k.addEventListener('click', () => { marcaStatus(k.dataset.filtro || ''); location.hash = 'pedidos'; }); });
  $$('[data-tab-link]').forEach(a => a.addEventListener('click', () => marcaStatus('')));
  $('[data-recarregar]').addEventListener('click', () => atualiza({ reinicia: true }));
  $('[data-mais]').addEventListener('click', () => carregaLista(false));

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
    const r = await rpc('admin_resumo', { ...intervalo(), p_teste: f.testes });
    $$('[data-k]').forEach(k => {
      const v = r[k.dataset.k];
      const alvo = k.tagName === 'BUTTON' ? $('b', k) : k;
      alvo.textContent = /centavos/.test(k.dataset.k) ? fmt(v) : String(v ?? 0);
      if (k.dataset.k === 'novos') k.classList.toggle('tem', v > 0);
    });
    const recentes = await rpc('admin_pedidos', { ...intervalo(), p_teste: f.testes, p_limite: 8 });
    const ul = $('[data-recentes]');
    ul.innerHTML = '';
    if (!recentes.pedidos.length) vazio(ul, f.periodo === 'hoje' ? 'Nenhum pedido hoje ainda' : 'Nenhum pedido no período', 'Quando um cliente pedir pelo site, ele aparece aqui na hora.');
    recentes.pedidos.forEach(p => ul.appendChild(linhaPedido(p)));
  }
  async function carregaLista(reinicia) {
    if (reinicia) pular = 0;
    const st = f.status ? f.status.split(',') : null;
    const r = await rpc('admin_pedidos', { ...intervalo(), p_status: st, p_busca: f.busca || null, p_teste: f.testes, p_limite: 30, p_pular: pular });
    const ul = $('[data-lista]');
    if (reinicia) ul.innerHTML = '';
    totalLista = r.total;
    r.pedidos.forEach(p => ul.appendChild(linhaPedido(p)));
    pular += r.pedidos.length;
    if (!totalLista) vazio(ul, f.busca ? 'Nada encontrado' : 'Nenhum pedido aqui', f.busca ? 'Confira o número, o nome ou o telefone.' : 'Mude o período ou o filtro de status.');
    $('[data-contagem]').textContent = totalLista ? `${totalLista} ${totalLista === 1 ? 'pedido' : 'pedidos'}${pular < totalLista ? ` (mostrando ${pular})` : ''}` : '';
    $('[data-mais]').hidden = pular >= totalLista;
  }
  // pedidos novos (fora do período escolhido também): número no menu e no título da aba
  async function carregaNovos() {
    const r = await rpc('admin_pedidos', { p_status: ['novo'], p_teste: f.testes, p_limite: 20 });
    const n = r.total;
    const b = $('[data-badge-novos]');
    b.textContent = String(n); b.hidden = !n;
    document.title = `${n ? `(${n}) ` : ''}Painel · Coxitas`;
    // sem tempo real, é aqui que o pedido novo é percebido
    const nums = new Set(r.pedidos.map(p => p.numero));
    if (conhecidos) r.pedidos.forEach(p => { if (!conhecidos.has(p.numero)) avisaNovo(p); });
    conhecidos = conhecidos ? new Set([...conhecidos, ...nums]) : nums;
  }
  let ocupado = false, deNovo = false;
  async function atualiza(o = {}) {
    if (!eu) return;
    if (ocupado) { deNovo = true; return; }
    ocupado = true;
    try {
      await carregaNovos();
      if (aba === 'painel') await carregaResumo();
      if (aba === 'pedidos') await carregaLista(true);
      if (aberto && !o.semDetalhe) await recarregaDetalhe();
      marcaConexao();
    } catch (e) {
      if (e && e.message !== 'sem_acesso') { conexaoFalhou = true; marcaConexao(); if (!o.silencioso) toast('Não deu para atualizar', textoErro(e), { erro: true, tempo: 5000 }); }
    } finally {
      ocupado = false;
      if (deNovo) { deNovo = false; atualiza({ silencioso: true }); }
    }
  }
  let tAgenda = 0;
  const agenda = () => { clearTimeout(tAgenda); tAgenda = setTimeout(() => atualiza({ silencioso: true }), 400); };

  function avisaNovo(p) {
    if (avisados.has(p.numero)) return;
    avisados.add(p.numero);
    if (conhecidos) conhecidos.add(p.numero);
    bip();
    toast(`Pedido novo nº ${p.numero}`, `${p.cliente_nome} · ${fmt(p.total_centavos)}`, { abrir: p.id, tempo: 15000 });
    requestAnimationFrame(() => $$(`.order[data-id="${p.id}"]`).forEach(x => x.classList.add('flash')));
  }

  /* ---------- tempo real (e o plano B) ---------- */
  let canal = null, aoVivo = false, conexaoFalhou = false, relogio = 0;
  function marcaConexao() {
    const l = $('[data-live]'), t = $('[data-live-txt]');
    l.classList.remove('on', 'poll', 'off');
    if (!navigator.onLine) { l.classList.add('off'); t.textContent = 'Sem internet'; l.title = 'Sem internet: os pedidos voltam a aparecer quando a conexão voltar.'; return; }
    if (aoVivo) { l.classList.add('on'); t.textContent = 'Ao vivo'; l.title = 'Pedidos novos aparecem na hora.'; }
    else { l.classList.add('poll'); t.textContent = 'Conferindo a cada 20s'; l.title = 'O tempo real não conectou; o painel confere os pedidos a cada 20 segundos.'; }
    conexaoFalhou = false;
  }
  function ligaTempoReal() {
    canal = sb.channel('painel-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, ev => {
        const n = ev.new || {};
        if (ev.eventType === 'INSERT' && n.status === 'novo' && (!n.teste || f.testes)) avisaNovo(n);
        agenda();
      })
      .subscribe(st => { aoVivo = st === 'SUBSCRIBED'; marcaConexao(); if (aoVivo) agenda(); });
    clearInterval(relogio);
    // conferência periódica: a cada 20s sem tempo real, a cada 60s com ele (rede de segurança)
    let passo = 0;
    relogio = setInterval(() => { passo++; if (document.hidden) return; if (!aoVivo || passo % 3 === 0) atualiza({ silencioso: true }); }, 20000);
  }
  window.addEventListener('online', () => { marcaConexao(); atualiza({ silencioso: true }); });
  window.addEventListener('offline', marcaConexao);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && eu) atualiza({ silencioso: true }); });

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
    try { desenhaDetalhe(await rpc('admin_pedido', { p_id: aberto.id })); }
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
      const novo = await rpc('admin_mudar_status', { p_id: p.id, p_para: para, p_de: p.status, p_nota: nota || null });
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
      const c = await rpc('admin_config');
      cfgForm.aceitando_pedidos.checked = c.aceitando_pedidos;
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
      await rpc('admin_salvar_config', { p: { aceitando_pedidos: cfgForm.aceitando_pedidos.checked, mensagem_pausa: cfgForm.mensagem_pausa.value, taxa_entrega_centavos: taxa == null ? '' : taxa, pedido_minimo_centavos: minimo || 0, pagamentos: pags } });
      ok.hidden = false;
      await carregaConfig();
    } catch (ex) { err.textContent = textoErro(ex); err.hidden = false; }
    finally { btn.removeAttribute('aria-busy'); btn.disabled = false; }
  });
  $('[data-apagar-testes]').addEventListener('click', async e => {
    if (!confirm('Apagar todos os pedidos marcados como teste? Os pedidos reais não são apagados.')) return;
    const msg = $('[data-apagar-msg]');
    e.currentTarget.disabled = true;
    try { const n = await rpc('admin_apagar_testes'); msg.textContent = `${n} ${n === 1 ? 'pedido de teste apagado' : 'pedidos de teste apagados'}.`; }
    catch (ex) { msg.textContent = textoErro(ex); }
    finally { e.currentTarget.disabled = false; }
  });

  /* ---------- login e sessão ---------- */
  const login = $('[data-login]');
  login.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('[data-login-err]'), btn = $('[data-login-btn]');
    err.hidden = true;
    const email = login.email.value.trim(), senha = login.senha.value;
    if (!email || !senha) { err.textContent = 'Preencha o e-mail e a senha.'; err.hidden = false; return; }
    btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    btn.removeAttribute('aria-busy'); btn.disabled = false;
    if (error) {
      err.textContent = /invalid/i.test(error.message) ? 'E-mail ou senha errados.' : /rate|many/i.test(error.message) ? 'Muitas tentativas. Espere alguns minutos.' : /fetch|network/i.test(error.message) ? 'Sem conexão. Confira a internet.' : 'Não deu para entrar agora.';
      err.hidden = false;
      login.senha.select();
      return;
    }
    login.senha.value = '';
    entra();
  });
  async function sair() {
    // para tudo antes de sair, para nenhuma conferência agendada rodar já sem login
    eu = null; clearInterval(relogio); clearTimeout(tAgenda); clearTimeout(tBusca);
    try { await sb.removeAllChannels(); } catch (e) {}
    await sb.auth.signOut();
    conhecidos = null; avisados.clear(); fechaPedido();
    document.title = 'Painel · Coxitas';
    mostraTela('login');
    login.email.focus();
  }
  $$('[data-sair]').forEach(b => b.addEventListener('click', sair));
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && eu) { eu = null; clearInterval(relogio); mostraTela('login'); toast('Sua sessão terminou', 'Entre de novo para continuar.', { erro: true }); } });

  async function entra() {
    try {
      eu = await rpc('admin_eu');
    } catch (e) {
      if (e.message === 'sem_acesso') return mostraTela('negado');
      mostraTela('login');
      const err = $('[data-login-err]'); err.textContent = textoErro(e); err.hidden = false;
      return;
    }
    $('[data-me-nome]').textContent = eu.nome;
    $('[data-me-papel]').textContent = eu.papel === 'dono' ? 'Dono' : 'Atendente';
    mostraTela('app');
    ligaTempoReal();
    vaiPara(location.hash.slice(1) || 'painel');
  }

  (async () => {
    const { data } = await sb.auth.getSession();
    if (data.session) entra(); else { mostraTela('login'); login.email.focus(); }
  })();
})();
