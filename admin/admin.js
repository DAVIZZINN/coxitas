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
    horarios_invalidos: 'Confira o horário: cada dia aberto precisa de hora de abrir e de fechar diferentes.',
    taxas_invalidas: 'Confira as faixas de taxa: km entre 0,5 e 50 (sem repetir) e valor até R$ 200.',
    periodo_invalido: 'Período inválido para o relatório.',
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
  // som ligado de fábrica: só fica desligado se alguém desligar no sininho
  let som = true, audio = null;
  try { som = localStorage.getItem('cx-painel-som') !== 'off'; } catch (e) {}
  const somBtn = $('[data-som]');
  function syncSom() {
    somBtn.setAttribute('aria-pressed', String(som));
    $('use', somBtn).setAttribute('href', som ? '#i-bell' : '#i-bell-off');
    $('[data-som-txt]').textContent = som ? 'Desligar o som de pedido novo' : 'Ligar o som de pedido novo';
    somBtn.title = som ? 'Som de pedido novo: ligado' : 'Som de pedido novo: desligado';
  }
  const garanteAudio = () => { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} return audio; };
  const somBloqueado = $('[data-som-bloqueado]');
  // sirene: duas ondas subindo e descendo, várias vezes, num compressor (o mais alto que o aparelho deixa)
  function sirene(vezes = 3) {
    if (!som || !garanteAudio()) return;
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    if (audio.state !== 'running') { somBloqueado.hidden = false; return; }
    try {
      const t0 = audio.currentTime + 0.03, comp = audio.createDynamicsCompressor(), vol = audio.createGain();
      comp.threshold.value = -14; comp.ratio.value = 8; vol.gain.value = 1;
      comp.connect(vol).connect(audio.destination);
      for (let i = 0; i < vezes; i++) {
        const t = t0 + i * 0.62;
        [['square', 1, 0.55], ['sawtooth', 1.5, 0.25]].forEach(([tipo, mult, alto]) => {
          const o = audio.createOscillator(), g = audio.createGain();
          o.type = tipo;
          o.frequency.setValueAtTime(700 * mult, t); o.frequency.linearRampToValueAtTime(1350 * mult, t + 0.28); o.frequency.linearRampToValueAtTime(700 * mult, t + 0.56);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(alto, t + 0.03); g.gain.setValueAtTime(alto, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.59);
          o.connect(g).connect(comp); o.start(t); o.stop(t + 0.6);
        });
      }
    } catch (e) {}
  }
  const bip = () => sirene(1);
  somBtn.addEventListener('click', () => { som = !som; try { localStorage.setItem('cx-painel-som', som ? 'on' : 'off'); } catch (e) {} syncSom(); if (som) sirene(1); alarme(); });
  // o navegador só deixa tocar som depois de um toque na página; o primeiro toque também pede a notificação do sistema
  let pediuNotif = false;
  document.addEventListener('pointerdown', () => {
    if (garanteAudio() && audio.state === 'suspended') audio.resume().then(() => { somBloqueado.hidden = true; }).catch(() => {});
    else somBloqueado.hidden = true;
    if (!pediuNotif && eu && 'Notification' in window && Notification.permission === 'default') { pediuNotif = true; try { Notification.requestPermission(); } catch (e) {} }
  }, { passive: true });
  somBloqueado.addEventListener('click', () => { somBloqueado.hidden = true; sirene(1); });
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
  const TITULO = { quadro: 'Quadro de pedidos', painel: 'Painel', pedidos: 'Pedidos', relatorios: 'Relatórios', loja: 'Loja' };
  let aba = 'quadro';
  function vaiPara(nova) {
    aba = TITULO[nova] ? nova : 'quadro';
    $$('[data-tab]').forEach(a => { if (a.dataset.tab === aba) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $$('[data-tab-view]').forEach(v => { v.hidden = v.dataset.tabView !== aba; });
    $('[data-titulo]').textContent = TITULO[aba];
    $('[data-filtros]').hidden = aba === 'loja' || aba === 'relatorios';
    $('[data-filtros]').classList.toggle('so-testes', aba === 'quadro');
    if (aba === 'loja') { carregaConfig(); carregaEquipe(); }
    if (aba === 'relatorios') carregaRelatorio();
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
    lojaAberta = r.aceitando !== false && r.no_horario !== false;
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
    atualizaAlarme(novos);
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
    notifica(p);
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
      rec.append(ico(p.modalidade === 'retirada' ? 'i-bag' : 'i-moto'), p.modalidade === 'retirada' ? 'Retirada' : `${p.endereco || 'Entrega'}${p.entrega_km != null ? ` · ${String(p.entrega_km).replace('.', ',')} km` : ''}`);
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

  // depois que alguém abriu o pedido pelo alarme, enquanto ele seguir "novo" a sirene lembra a cada 30 segundos
  let novosAgora = 0, tAlarme = 0;
  function alarme() {
    clearInterval(tAlarme);
    if (som && novosAgora > 0) tAlarme = setInterval(() => { if (novosAgora > 0 && som && eu && alarmeEl.hidden && Date.now() >= silencioAte) sirene(1); else if (!novosAgora) clearInterval(tAlarme); }, 30000);
  }

  /* ---------- alarme de pedido novo: tela cheia + sirene a cada 4 s até aceitar ou abrir o pedido ---------- */
  const alarmeEl = $('[data-alarme]');
  const reconhecidos = new Set();
  let fila = [], tSirene = 0, silencioAte = 0, tTitulo = 0;
  function atualizaAlarme(novos) {
    const ids = new Set(novos.map(p => p.id));
    [...reconhecidos].forEach(id => { if (!ids.has(id)) reconhecidos.delete(id); });
    fila = novos.filter(p => !reconhecidos.has(p.id)).sort((a, b) => (a.criado_em < b.criado_em ? -1 : 1));
    if (!fila.length) return fechaAlarme();
    const p = fila[0], km = p.entrega_km != null ? ` ${String(p.entrega_km).replace('.', ',')} km` : '';
    $('[data-al-num]').textContent = p.numero;
    $('[data-al-info]').textContent = `${p.cliente_nome} · ${fmt(p.total_centavos)} · ${p.modalidade === 'retirada' ? 'Retirada' : `Entrega${km}`}`;
    $('[data-al-itens]').textContent = resumoItens(p);
    $('[data-al-mais]').textContent = fila.length > 1 ? `E mais ${fila.length - 1} ${fila.length === 2 ? 'pedido novo esperando' : 'pedidos novos esperando'}.` : '';
    const nova = alarmeEl.hidden || alarmeEl.dataset.id !== p.id;
    alarmeEl.dataset.id = p.id;
    if (alarmeEl.hidden) { alarmeEl.hidden = false; $('[data-al-aceitar]').focus({ preventScroll: true }); }
    if (nova) tocaAlarme();
  }
  function tocaAlarme() {
    clearInterval(tSirene); clearInterval(tTitulo);
    const toca = () => { if (!alarmeEl.hidden && Date.now() >= silencioAte) sirene(3); };
    toca(); tSirene = setInterval(toca, 4000);
    let pisca = false;
    tTitulo = setInterval(() => { pisca = !pisca; document.title = pisca ? '🔔 PEDIDO NOVO' : `(${novosAgora}) Painel · Coxitas`; }, 1000);
  }
  function fechaAlarme() {
    alarmeEl.hidden = true; clearInterval(tSirene); clearInterval(tTitulo);
    document.title = `${novosAgora ? `(${novosAgora}) ` : ''}Painel · Coxitas`;
  }
  $('[data-al-aceitar]').addEventListener('click', async e => {
    const p = fila[0]; if (!p) return fechaAlarme();
    const b = e.currentTarget; b.disabled = true; b.setAttribute('aria-busy', 'true');
    try {
      await api('status', null, { id: p.id, para: 'confirmado', de: 'novo' });
      reconhecidos.add(p.id);
      toast(`Pedido nº ${p.numero} aceito`, 'Ele foi para "Em preparo" no quadro.', { tempo: 3500 });
      atualizaAlarme(fila.slice(1));
      atualiza({ silencioso: true, forca: true });
    } catch (ex) { toast('Não deu para aceitar', textoErro(ex), { erro: true }); if (ex.message === 'status_mudou') { reconhecidos.add(p.id); atualiza({ forca: true }); } }
    finally { b.disabled = false; b.removeAttribute('aria-busy'); }
  });
  $('[data-al-ver]').addEventListener('click', () => {
    const p = fila[0]; if (!p) return fechaAlarme();
    reconhecidos.add(p.id);
    atualizaAlarme(fila.slice(1));
    abrePedido(p.id);
  });
  $('[data-al-silenciar]').addEventListener('click', e => {
    silencioAte = Date.now() + 120000;
    e.currentTarget.textContent = 'Silenciado por 2 minutos';
    setTimeout(() => { $('[data-al-silenciar]').textContent = 'Silenciar por 2 minutos'; }, 120000);
  });
  // notificação do sistema (aparece mesmo com o navegador minimizado), ligada de fábrica: o primeiro toque pede a permissão
  function notifica(p) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const n = new Notification(`Pedido novo nº ${p.numero}`, { body: `${p.cliente_nome} · ${fmt(p.total_centavos)} · ${p.modalidade === 'retirada' ? 'retirada' : 'entrega'}`, icon: '../assets/img/icon-192.png', tag: `cx-novo-${p.id}`, requireInteraction: true });
      n.onclick = () => { window.focus(); abrePedido(p.id); n.close(); };
    } catch (e) {}
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
          lab.append(el('span', null, 'Motivo do cancelamento (o cliente vê no acompanhamento)'));
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
      if (p.entrega_km != null) rec.appendChild(el('p', 'muted', `Cerca de ${String(p.entrega_km).replace('.', ',')} km da loja (rua conferida no mapa)`));
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
      montaHorario(c.horarios);
      $('[data-faixas]').innerHTML = '';
      (c.taxas_entrega || []).forEach(linhaFaixa);
      cfgForm.gratis.value = c.entrega_gratis_acima_centavos != null ? reais(c.entrega_gratis_acima_centavos) : '';
      cfgForm.minimo.value = c.pedido_minimo_centavos ? reais(c.pedido_minimo_centavos) : '';
      cfgForm.raio.value = String(c.raio_entrega_km ?? 12).replace('.', ',');
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
    const minimo = centavos(cfgForm.minimo.value), gratis = centavos(cfgForm.gratis.value);
    const horarios = leHorario(), faixas = leFaixas();
    if (horarios.erro || faixas.erro) { err.textContent = horarios.erro || faixas.erro; err.hidden = false; return; }
    const pags = cfgForm.pagamentos.value.split('\n').map(x => x.trim()).filter(Boolean);
    const raio = Math.round(parseFloat(String(cfgForm.raio.value || '12').replace(',', '.')) * 10) / 10;
    if (!(raio >= 1 && raio <= 50)) { err.textContent = 'O raio de entrega precisa ficar entre 1 e 50 km.'; err.hidden = false; return; }
    if (Number.isNaN(minimo) || Number.isNaN(gratis)) { err.textContent = 'Confira os valores em reais (ex.: 5,00).'; err.hidden = false; return; }
    if (!pags.length) { err.textContent = 'Deixe pelo menos uma forma de pagamento.'; err.hidden = false; return; }
    btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
    try {
      await api('salvar_config', null, { p: { aceitando_pedidos: cfgForm.aceitando_pedidos.checked, mensagem_pausa: cfgForm.mensagem_pausa.value, pedido_minimo_centavos: minimo || 0, pagamentos: pags, raio_entrega_km: raio,
        horarios: horarios.lista, taxas_entrega: faixas.lista, entrega_gratis_acima_centavos: gratis == null ? '' : gratis } });
      ok.hidden = false;
      await carregaConfig();
      atualiza({ silencioso: true });
    } catch (ex) { err.textContent = textoErro(ex); err.hidden = false; }
    finally { btn.removeAttribute('aria-busy'); btn.disabled = false; }
  });
  // horário: uma linha por dia (segunda primeiro), com "Abre" e as horas
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  function montaHorario(h) {
    const box = $('[data-horario]');
    box.innerHTML = '';
    [1, 2, 3, 4, 5, 6, 0].forEach(d => {
      const v = Array.isArray(h) && Array.isArray(h[d]) ? h[d] : null;
      const li = el('div', `dia-linha${v ? '' : ' fechado'}`); li.dataset.dia = d;
      const lab = el('label', 'check'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!v; cb.dataset.abre = '';
      lab.append(cb, el('span', null, 'Abre'));
      const horas = el('div', 'horas'), a = el('input'), b = el('input');
      a.type = b.type = 'time'; a.value = v ? v[0] : '09:00'; b.value = v ? v[1] : '21:00'; a.dataset.a = ''; b.dataset.b = '';
      a.setAttribute('aria-label', `${DIAS[d]}: abre às`); b.setAttribute('aria-label', `${DIAS[d]}: fecha às`);
      horas.append(a, el('span', null, 'às'), b);
      cb.addEventListener('change', () => li.classList.toggle('fechado', !cb.checked));
      li.append(el('b', null, DIAS[d]), lab, horas);
      box.appendChild(li);
    });
  }
  function leHorario() {
    const lista = Array(7).fill(null);
    for (const li of $$('.dia-linha')) {
      if (!$('[data-abre]', li).checked) continue;
      const a = $('[data-a]', li).value, b = $('[data-b]', li).value;
      if (!a || !b || a === b) return { erro: `Confira o horário de ${DIAS[+li.dataset.dia].toLowerCase()}: abrir e fechar precisam ser diferentes.` };
      lista[+li.dataset.dia] = [a, b];
    }
    return { lista };
  }
  // faixas de taxa: "Até X km: R$ Y"
  function linhaFaixa(f) {
    const li = el('div', 'faixa');
    const km = el('input', 'input num'); km.inputMode = 'decimal'; km.dataset.km = ''; km.setAttribute('aria-label', 'Até quantos km');
    const rs = el('input', 'input num'); rs.inputMode = 'decimal'; rs.dataset.rs = ''; rs.placeholder = '0,00'; rs.setAttribute('aria-label', 'Taxa em reais');
    if (f) { km.value = String(f.ate_km).replace('.', ','); rs.value = reais(f.centavos); }
    const rm = el('button', 'icon-btn'); rm.type = 'button'; rm.title = 'Tirar esta faixa'; rm.append(ico('i-x'), el('span', 'sr', 'Tirar esta faixa'));
    rm.addEventListener('click', () => li.remove());
    li.append(el('span', null, 'Até'), km, el('span', null, 'km: R$'), rs, el('span', 'faixa-r'), rm);
    $('[data-faixas]').appendChild(li);
  }
  $('[data-faixa-nova]').addEventListener('click', () => { linhaFaixa(); const k = $$('[data-faixas] [data-km]'); k[k.length - 1].focus(); });
  function leFaixas() {
    const lista = [], vistos = new Set();
    for (const li of $$('[data-faixas] .faixa')) {
      const kmTxt = $('[data-km]', li).value.trim(), rsTxt = $('[data-rs]', li).value.trim();
      if (!kmTxt && !rsTxt) continue;
      const km = Math.round(parseFloat(kmTxt.replace(',', '.')) * 10) / 10, c = centavos(rsTxt || '0');
      if (!(km >= 0.5 && km <= 50) || vistos.has(km)) return { erro: 'Cada faixa precisa de uma distância entre 0,5 e 50 km, sem repetir.' };
      if (Number.isNaN(c) || c == null || c < 0 || c > 20000) return { erro: 'A taxa de cada faixa vai de R$ 0,00 a R$ 200,00.' };
      vistos.add(km); lista.push({ ate_km: km, centavos: c });
    }
    return { lista: lista.sort((a, b) => a.ate_km - b.ate_km) };
  }

  /* ---------- relatórios ---------- */
  const rel = { periodo: '30', ag: null, me: 'centavos', testes: false, dados: null, antes: null, de: null, ate: null };
  const SP = 3 * 3600e3;
  const fMes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'short', year: '2-digit' });
  const fDiaMes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
  const fDiaLongo = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' });
  const curto = c => { const r = c / 100; return r >= 1000 ? `R$ ${(r / 1000).toFixed(r >= 10000 ? 0 : 1).replace('.', ',')} mil` : `R$ ${Math.round(r)}`; };
  const pct = (a, t) => (t ? `${Math.round((a / t) * 100)}%` : '0%');
  function periodoRel() {
    const amanha = new Date(new Date(inicioDia(0)).getTime() + 864e5);
    if (rel.periodo === 'mes' || rel.periodo === 'mes-1') {
      const sp = new Date(Date.now() - SP); let y = sp.getUTCFullYear(), m = sp.getUTCMonth();
      if (rel.periodo === 'mes-1') { m -= 1; if (m < 0) { m = 11; y -= 1; } }
      return { de: new Date(Date.UTC(y, m, 1) + SP), ate: rel.periodo === 'mes' ? amanha : new Date(Date.UTC(y, m + 1, 1) + SP) };
    }
    return { de: new Date(amanha.getTime() - +rel.periodo * 864e5), ate: amanha };
  }
  $$('[data-r]').forEach(b => b.addEventListener('click', () => {
    rel.periodo = b.dataset.r; rel.ag = null;
    $$('[data-r]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    carregaRelatorio();
  }));
  $('[data-rel-testes]').addEventListener('change', e => { rel.testes = e.target.checked; carregaRelatorio(); });
  $$('[data-ag]').forEach(b => b.addEventListener('click', () => { rel.ag = b.dataset.ag; desenhaSerie(); }));
  $$('[data-me]').forEach(b => b.addEventListener('click', () => { rel.me = b.dataset.me; $$('[data-me]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); desenhaSerie(); }));
  async function carregaRelatorio() {
    const { de, ate } = periodoRel(), dur = ate - de, de0 = new Date(de.getTime() - dur);
    rel.de = de; rel.ate = ate;
    const dias = Math.round(dur / 864e5);
    $('[data-rel-periodo]').textContent = `De ${fDiaMes.format(new Date(de.getTime() - SP))} a ${fDiaMes.format(new Date(ate.getTime() - SP - 1))} (${dias} ${dias === 1 ? 'dia' : 'dias'}), comparado com os ${dias} dias antes. Cancelados ficam fora das vendas.`;
    try {
      const [a, b] = await Promise.all([
        api('relatorio', { de: de.toISOString(), ate: ate.toISOString(), teste: rel.testes }),
        api('relatorio', { de: de0.toISOString(), ate: de.toISOString(), teste: rel.testes }),
      ]);
      rel.dados = a; rel.antes = b;
      desenhaRelatorio();
    } catch (e) { toast('Não deu para abrir os relatórios', textoErro(e), { erro: true }); }
  }
  function stat(rot, val, atual, antes, bomSobe = true, sufixo = '') {
    const d = el('div', 'stat');
    d.append(el('span', null, rot), el('b', null, val));
    const small = el('small');
    if (antes > 0) {
      const v = (atual - antes) / antes, sobe = v > 0.005, desce = v < -0.005;
      const i = el('i', sobe === bomSobe && (sobe || desce) ? 'bom' : (sobe || desce) ? 'ruim' : '', `${sobe ? '▲' : desce ? '▼' : '='} ${Math.abs(Math.round(v * 100))}%`);
      small.append(i, ` vs. período anterior${sufixo}`);
    } else small.textContent = antes === 0 && atual > 0 ? 'sem vendas no período anterior' : ' ';
    d.appendChild(small);
    return d;
  }
  function desenhaRelatorio() {
    const r = rel.dados, a = rel.antes, R = r.resumo, A = a.resumo;
    const ticket = R.pedidos ? Math.round(R.faturamento_centavos / R.pedidos) : 0, ticketA = A.pedidos ? Math.round(A.faturamento_centavos / A.pedidos) : 0;
    const cancel = R.pedidos + R.cancelados ? R.cancelados / (R.pedidos + R.cancelados) : 0, cancelA = A.pedidos + A.cancelados ? A.cancelados / (A.pedidos + A.cancelados) : 0;
    const k = $('[data-rel-kpis]'); k.innerHTML = '';
    k.append(
      stat('Faturamento', fmt(R.faturamento_centavos), R.faturamento_centavos, A.faturamento_centavos),
      stat('Pedidos', String(R.pedidos), R.pedidos, A.pedidos),
      stat('Ticket médio', fmt(ticket), ticket, ticketA),
      stat('Clientes diferentes', String(R.clientes), R.clientes, A.clientes),
      stat('Taxas de entrega', fmt(R.taxas_centavos), R.taxas_centavos, A.taxas_centavos),
      stat('Cancelados', `${R.cancelados} (${Math.round(cancel * 100)}%)`, cancel, cancelA, false),
    );
    desenhaSerie();
    const DS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], DSL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const sem = DS.map((rot, i) => { const x = r.semana.find(w => w.dow === i) || { pedidos: 0, centavos: 0 }; return { rot, valor: x.pedidos, dica: [[DSL[i]], ['Pedidos', String(x.pedidos)], ['Faturamento', fmt(x.centavos)]] }; });
    CxGraf.colunas($('[data-g=semana]'), sem, { titulo: 'Pedidos por dia da semana', tabela: { cab: ['Dia', 'Pedidos', 'Faturamento'], linhas: sem.map((d, i) => [DSL[i], String(d.valor), d.dica[2][1]]) } });
    const horas = Array.from({ length: 24 }, (_, h) => { const x = r.horas.find(w => w.hora === h) || { pedidos: 0 }; return { rot: `${h}h`, valor: x.pedidos, dica: [[`${h}h às ${h + 1}h`], ['Pedidos', String(x.pedidos)]] }; });
    const usadas = horas.filter(h => h.valor > 0).map(h => parseInt(h.rot, 10));
    const h0 = usadas.length ? Math.max(0, Math.min(8, ...usadas)) : 8, h1 = usadas.length ? Math.min(23, Math.max(22, ...usadas)) : 22;
    CxGraf.colunas($('[data-g=horas]'), horas.slice(h0, h1 + 1), { titulo: 'Pedidos por hora', rotA: 2, tabela: { cab: ['Hora', 'Pedidos'], linhas: horas.filter(h => h.valor).map(h => [h.dica[0][0], String(h.valor)]) } });
    const prod = r.produtos.map(p => ({ rot: p.nome, valor: p.quantidade, extra: fmt(p.centavos), dica: [[p.nome], ['Unidades', String(p.quantidade)], ['Vendido', fmt(p.centavos)]] }));
    CxGraf.barras($('[data-g=produtos]'), prod, { fmt: v => `${v} un`, tabela: { cab: ['Produto', 'Unidades', 'Vendido'], linhas: r.produtos.map(p => [p.nome, String(p.quantidade), fmt(p.centavos)]) } });
    const comSabor = r.sabores.length ? R.pedidos : 0;
    CxGraf.barras($('[data-g=sabores]'), r.sabores.map(x => ({ rot: x.sabor, valor: x.pedidos, dica: [[x.sabor], ['Pedidos', String(x.pedidos)], ['Dos pedidos', pct(x.pedidos, comSabor)]] })),
      { fmt: v => `${v}`, vazio: 'Nenhum sabor escolhido no período.', tabela: { cab: ['Sabor', 'Pedidos'], linhas: r.sabores.map(x => [x.sabor, String(x.pedidos)]) } });
    CxGraf.barras($('[data-g=bairros]'), r.bairros.map(x => ({ rot: x.bairro, valor: x.pedidos, extra: `${fmt(x.centavos)}${x.km != null ? ` · ${String(x.km).replace('.', ',')} km em média` : ''}`, dica: [[x.bairro], ['Entregas', String(x.pedidos)], ['Vendido', fmt(x.centavos)]] })),
      { fmt: v => `${v}`, vazio: 'Sem entregas com bairro no período.', tabela: { cab: ['Bairro', 'Entregas', 'Vendido', 'Distância média'], linhas: r.bairros.map(x => [x.bairro, String(x.pedidos), fmt(x.centavos), x.km != null ? `${x.km} km` : '']) } });
    CxGraf.radar($('[data-g=radar]'), r.pontos, r.loja || [-20.4317, -49.9475, 12]);
    const dist = Array.from({ length: 12 }, (_, i) => { const x = r.distancias.find(d => d.faixa === i) || { pedidos: 0 }; return { rot: `${i}-${i + 1}`, valor: x.pedidos, dica: [[`De ${i} a ${i + 1} km`], ['Entregas', String(x.pedidos)]] }; });
    const ultimo = Math.max(3, ...dist.map((d, i) => (d.valor ? i + 1 : 0)));
    CxGraf.colunas($('[data-g=distancias]'), dist.slice(0, ultimo), { titulo: 'Entregas por distância', vazio: 'Sem entregas com distância no período.', fmt: v => String(v), tabela: { cab: ['Distância', 'Entregas'], linhas: dist.filter(d => d.valor).map(d => [`${d.rot} km`, String(d.valor)]) } });
    const tp = r.pagamentos.reduce((n, x) => n + x.pedidos, 0);
    CxGraf.barras($('[data-g=pagamentos]'), r.pagamentos.map(x => ({ rot: x.pagamento, valor: x.pedidos, extra: pct(x.pedidos, tp), dica: [[x.pagamento], ['Pedidos', String(x.pedidos)], ['Do total', pct(x.pedidos, tp)]] })), { fmt: v => `${v}` });
    const tm = R.entregas + R.retiradas;
    CxGraf.barras($('[data-g=modalidades]'), [{ rot: 'Entrega', valor: R.entregas, extra: `${pct(R.entregas, tm)}${R.km_medio != null ? ` · ${String(R.km_medio).replace('.', ',')} km em média` : ''}` }, { rot: 'Retirada na loja', valor: R.retiradas, extra: pct(R.retiradas, tm) }], { fmt: v => `${v}` });
  }
  // vendas no tempo: dia a dia, por semana (começando na segunda) ou por mês; dias sem venda entram com zero
  function desenhaSerie() {
    if (!rel.dados) return;
    const dias = Math.round((rel.ate - rel.de) / 864e5);
    const ag = rel.ag || (dias <= 31 ? 'dia' : dias <= 120 ? 'semana' : 'mes');
    $$('[data-ag]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.ag === ag)));
    const mapa = new Map(rel.dados.dias.map(d => [String(d.dia).slice(0, 10), d]));
    const grupos = new Map();
    for (let t = rel.de.getTime() - SP; t < rel.ate.getTime() - SP; t += 864e5) {
      const dia = new Date(t), chaveDia = dia.toISOString().slice(0, 10), x = mapa.get(chaveDia) || { pedidos: 0, centavos: 0 };
      let chave = chaveDia, rot = fDiaMes.format(dia), titulo = fDiaLongo.format(dia);
      if (ag === 'semana') { const seg = new Date(t - ((dia.getUTCDay() + 6) % 7) * 864e5); chave = seg.toISOString().slice(0, 10); rot = fDiaMes.format(seg); titulo = `Semana de ${fDiaMes.format(seg)}`; }
      if (ag === 'mes') { chave = chaveDia.slice(0, 7); rot = fMes.format(dia).replace('. de ', '/').replace('.', ''); titulo = rot; }
      const g = grupos.get(chave) || { rot, titulo, pedidos: 0, centavos: 0 };
      g.pedidos += x.pedidos; g.centavos += x.centavos; grupos.set(chave, g);
    }
    const lista = [...grupos.values()], ehR = rel.me === 'centavos';
    $('[data-serie-sub]').textContent = `${ehR ? 'faturamento' : 'pedidos'} por ${ag === 'dia' ? 'dia' : ag === 'semana' ? 'semana' : 'mês'}, sem os cancelados`;
    CxGraf.colunas($('[data-g=serie]'), lista.map(g => ({ rot: g.rot, valor: ehR ? g.centavos : g.pedidos, dica: [[g.titulo], ['Faturamento', fmt(g.centavos)], ['Pedidos', String(g.pedidos)], ['Ticket médio', g.pedidos ? fmt(Math.round(g.centavos / g.pedidos)) : '-']] })),
      { titulo: 'Vendas no período', altura: 240, fmt: ehR ? curto : (v => String(v)), tabela: { cab: [ag === 'dia' ? 'Dia' : ag === 'semana' ? 'Semana' : 'Mês', 'Pedidos', 'Faturamento'], linhas: lista.map(g => [g.titulo, String(g.pedidos), fmt(g.centavos)]) } });
  }
  let tRedesenha = 0;
  addEventListener('resize', () => { clearTimeout(tRedesenha); tRedesenha = setTimeout(() => { if (aba === 'relatorios' && rel.dados) desenhaRelatorio(); }, 200); });

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
    eu = null; clearTimeout(tConf); clearTimeout(tBusca); clearInterval(tAlarme); fechaAlarme(); reconhecidos.clear();
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
    // som ligado mas o navegador ainda não deixou tocar: pede um toque na tela
    if (som && garanteAudio() && audio.state !== 'running') audio.resume().then(() => { somBloqueado.hidden = audio.state === 'running'; }).catch(() => { somBloqueado.hidden = false; });
    setTimeout(() => { if (eu && som && audio && audio.state !== 'running') somBloqueado.hidden = false; }, 600);
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
