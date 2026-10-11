/* Coxitas · site. JavaScript puro, sem dependências. */
(() => {
  'use strict';

  /* ---------- dados da loja: edite aqui ---------- */
  const LOJA = {
    whatsapp: '5517996433594',   // só números: 55 + DDD + número
    ifood: '',                   // cole aqui o link oficial do iFood; vazio deixa os botões do iFood escondidos
    mensagem: 'Olá, Coxitas! Vi o site e quero fazer um pedido.',
    utc: -3,                     // fuso de Votuporanga (horário de Brasília). O Brasil está sem horário de verão desde 2019; se voltar, use -2 no verão
    // horário de funcionamento: [abre, fecha] em horas, de domingo (0) a sábado (6)
    horarios: [[15, 20], [9, 21], [9, 21], [9, 21], [9, 21], [9, 21], [9, 21]],
    mapa: 'https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1sCoxitas+Salgados+de+Festa,+R.+Francisco+Pelegrini,+5819,+Votuporanga+-+SP!6i16!3m1!1spt-BR!5m1!1spt-BR',
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = () => root.classList.contains('rm');
  // R$ 1.234,56 (o mesmo que o Intl do navegador escreve, sem o custo de montar o formatador ao abrir a página)
  const fmt = c => { const [r, d] = (Math.abs(c) / 100).toFixed(2).split('.'); return (c < 0 ? '-' : '') + 'R$ ' + r.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
  const fmtTxt = c => fmt(c).replace(/\s/g, ' ');
  const kmTxt = k => String(k).replace('.', ',');
  const priceHTML = txt => `<small>R$</small> ${String(txt).replace(/^\s*R\$\s*/, '')}`;
  const toCents = s => Math.round(parseFloat(String(s).replace(/[^\d,]/g, '').replace(',', '.')) * 100) || 0;
  const waURL = text => `https://wa.me/${LOJA.whatsapp}?text=${encodeURIComponent(text)}`;
  const idle = window.requestIdleCallback || (f => setTimeout(f, 300));
  const live = $('#live');
  const say = msg => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); };
  // tamanho da tela lido fora do carregamento, para não obrigar o navegador a montar a página antes da hora
  let VW = 1200, VH = 800;
  requestAnimationFrame(() => { VW = innerWidth; VH = innerHeight; });
  addEventListener('resize', () => { VW = innerWidth; VH = innerHeight; }, { passive: true });

  /* ---------- links de WhatsApp e iFood ---------- */
  $$('[data-wa]').forEach(a => { a.href = waURL(a.dataset.wa || LOJA.mensagem); });
  if (LOJA.ifood) {
    $$('[data-ifood]').forEach(a => { a.href = LOJA.ifood; a.hidden = false; });
    $$('[data-ifood-item],[data-ifood-card]').forEach(el => { el.hidden = false; });
  }
  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  /* ---------- aberto agora? (pelo relógio de Votuporanga, não do aparelho) ---------- */
  // conta direto no relógio mundial (UTC): o formatador de fuso do navegador custa caro para montar no celular
  function agora() {
    const d = new Date(Date.now() + LOJA.utc * 3600e3);
    return { dia: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
  // [abre, fecha] em minutos, de domingo a sábado (null = fechado o dia todo). Começa com o LOJA.horarios e passa a valer
  // o horário do painel assim que a configuração chega da API
  let HOR = LOJA.horarios.map(h => (h ? [h[0] * 60, h[1] * 60] : null));
  const DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const hm = m => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;
  const abertoEm = (h, min) => !!h && (h[0] <= h[1] ? min >= h[0] && (min < h[1] || h[1] >= 1439) : min >= h[0] || min < h[1]);
  function situacao() {
    const { dia, min } = agora();
    const h = HOR[dia];
    if (abertoEm(h, min)) return { dia, aberto: true, texto: `Aberto agora · até ${h[1] >= 1439 ? 'meia-noite' : hm(h[1])}` };
    if (h && min < h[0]) return { dia, aberto: false, texto: `Fechado agora · abre às ${hm(h[0])}`, abre: `hoje às ${hm(h[0])}` };
    for (let k = 1; k <= 7; k++) {
      const d = (dia + k) % 7, x = HOR[d];
      if (x) { const q = k === 1 ? 'amanhã' : DIA[d]; return { dia, aberto: false, texto: `Fechado agora · abre ${q} às ${hm(x[0])}`, abre: `${q} às ${hm(x[0])}` }; }
    }
    return { dia, aberto: false, texto: 'Fechado agora', abre: '' };
  }
  // tabela de horários do rodapé, montada do horário que vale (dias iguais em sequência viram uma linha só)
  function renderHorarios() {
    const tb = $('.hours tbody') || $('.hours');
    if (!tb) return;
    const NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const txt = h => (h ? `${hm(h[0])} às ${h[1] >= 1439 ? '0h' : hm(h[1])}` : 'Fechado');
    const grupos = [];
    [1, 2, 3, 4, 5, 6, 0].forEach(d => { const t = txt(HOR[d]), g = grupos[grupos.length - 1]; if (g && g.t === t) g.dias.push(d); else grupos.push({ t, dias: [d] }); });
    $$('tr', tb).forEach(tr => tr.remove());
    grupos.forEach(g => {
      const tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td');
      tr.dataset.days = g.dias.join(','); th.scope = 'row';
      const a = NOME[g.dias[0]], b = NOME[g.dias[g.dias.length - 1]].toLowerCase();
      th.textContent = g.dias.length === 1 ? a : g.dias.length === 2 ? `${a} e ${b}` : `${a} a ${b}`;
      td.textContent = g.t;
      tr.append(th, td); tb.appendChild(tr);
    });
  }
  function updateStatus() {
    let s;
    try { s = situacao(); } catch (e) { return; }
    $$('[data-status]').forEach(el => {
      el.classList.toggle('is-open', s.aberto);
      el.classList.toggle('is-closed', !s.aberto);
      const t = $('[data-status-text]', el);
      if (t) t.textContent = s.texto;
    });
    $$('.hours tr').forEach(tr => tr.classList.toggle('today', (tr.dataset.days || '').split(',').includes(String(s.dia))));
    try { syncFechado(); } catch (e) {}   // na abertura a parte do pedido ainda não existe: ela chama sozinha depois
  }
  updateStatus();
  setInterval(updateStatus, 60000);

  /* ---------- menu: borda ao rolar, menu de celular, seção atual ---------- */
  const nav = $('#nav');
  const menuBtn = $('.menu-btn');
  const waFloat = $('.wa-float');
  function setMenu(open) {
    nav.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  }
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('menu-open')));
  $$('.menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', e => { if (nav.classList.contains('menu-open') && !nav.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); } });
  matchMedia('(min-width: 900px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  // links para seções da página: as partes de baixo só ganham a altura de verdade quando passam pela tela
  // (content-visibility), então a rolagem confere onde parou e acerta o lugar no fim
  const padTopo = () => parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
  function vaiAte(alvo) {
    alvo.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    let voltas = 0;
    const confere = () => {
      if (Math.abs(alvo.getBoundingClientRect().top - padTopo()) > 6 && voltas++ < 3) { alvo.scrollIntoView({ behavior: 'auto', block: 'start' }); setTimeout(confere, 250); }
    };
    if ('onscrollend' in window) addEventListener('scrollend', () => setTimeout(confere, 60), { once: true }); else setTimeout(confere, 1100);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || a.hash.length < 2) return;
    const alvo = document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!alvo) return;
    e.preventDefault();
    if (location.hash !== a.hash) history.pushState(null, '', a.hash);
    vaiAte(alvo);
  });

  let ticking = false, booted = false, SY = 0;
  function onScroll() {
    ticking = false;
    SY = scrollY;
    nav.classList.toggle('solid', SY > 40);
    waFloat.classList.toggle('show', SY > VH * 0.7 && count() === 0);
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  // a seção no meio da tela decide o link aceso no menu e a luz do fundo
  const navLinks = $$('.nav-links a, .menu a');
  const body = document.body;
  const bgLayers = $$('.bg-layer');
  const sceneIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const id = en.target.id, scene = en.target.dataset.scene;
      if (body.dataset.scene === scene) return;
      body.dataset.scene = scene;
      bgLayers.forEach(l => l.classList.toggle('on', l.dataset.for === scene));
      navLinks.forEach(a => {
        const on = a.hash === '#' + id;
        a.classList.toggle('on', on);
        on ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('[data-scene]', $('main')).forEach(s => sceneIO.observe(s));

  /* ---------- entradas: títulos e blocos sobem quando chegam na tela; fotos grandes respiram ---------- */
  const rvIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); rvIO.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  $$('.rv, .split').forEach(el => rvIO.observe(el));
  const kbIO = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('on', e.isIntersecting)));
  $$('.kb').forEach(el => kbIO.observe(el));
  // vapor, brasas, faixa do cardápio, selo e mascote param quando a parte deles sai da tela (e voltam um pouco antes de reaparecer)
  const zzIO = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('zz', !e.isIntersecting)), { rootMargin: '200px 0px' });
  $$('.hero, .ticker, #coxinha, #sobre, #pedir').forEach(el => zzIO.observe(el));

  /* ---------- fundo: migalhas de farinha subindo devagar (animação de CSS, sem desenho por script) ---------- */
  const bgBox = $('#bgCrumbs');
  if (bgBox) idle(() => {
    const n = innerWidth < 640 ? 8 : 16, cores = ['#E8963A', '#C96F22', '#F2B65A', '#B5651D'];
    const frag = document.createDocumentFragment();
    for (let k = 0; k < n; k++) {
      const depth = .3 + Math.random() * .7, el = document.createElement('i');
      const d = 26 + (1 - depth) * 34 + Math.random() * 10;   // as de perto sobem mais rápido
      el.style.cssText = `--l:${(Math.random() * 100).toFixed(1)}%;--s:${(3 + depth * 6).toFixed(1)}px;--c:${cores[k % cores.length]};--o:${(.2 + depth * .45).toFixed(2)};--d:${d.toFixed(1)}s;--dl:${(-Math.random() * d).toFixed(1)}s;--x:${((Math.random() - .5) * 60).toFixed(0)}px;--r:${((Math.random() - .5) * 540).toFixed(0)}deg`;
      frag.appendChild(el);
    }
    bgBox.appendChild(frag);
  }, { timeout: 1500 });

  /* ---------- o cardápio passando: cada faixa leva uma cópia de si mesma, então a volta nunca dá pulo ---------- */
  $$('.tk-row').forEach(row => {
    const track = $('.tk-track', row);
    const group = $('.tk-group', track);
    track.appendChild(group.cloneNode(true));
    const speed = +row.dataset.speed || 40;    // pixels por segundo
    // a velocidade vem da largura do grupo, lida quando o navegador já mediu tudo (sem obrigá-lo a montar a página
    // antes da hora); muda sozinha quando as letras carregam ou a tela gira
    const fit = w => { if (w) track.style.setProperty('--dur', (w / speed).toFixed(2) + 's'); };
    if (window.ResizeObserver) new ResizeObserver(([e]) => fit(e.borderBoxSize && e.borderBoxSize[0] ? e.borderBoxSize[0].inlineSize : group.getBoundingClientRect().width)).observe(group);
    else addEventListener('load', () => fit(group.getBoundingClientRect().width), { once: true });
    // no celular: segurar o dedo pausa a faixa
    row.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') row.classList.add('hold'); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => row.addEventListener(t, () => row.classList.remove('hold')));
  });

  /* ---------- vídeos em loop: descem depois da página pronta e só tocam na tela ---------- */
  const vids = $$('video[data-src]');
  let videoOk = false;
  // economia de dados ou internet muito lenta: fica a foto de capa, sem baixar vídeo
  const conn = navigator.connection || {};
  const saveData = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  // aparelho fraco (pouca memória ou poucos núcleos): só o vídeo do meio toca, os dos lados ficam na foto
  const weak = saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  const phone = matchMedia('(max-width: 639px)').matches;
  const touch = matchMedia('(pointer: coarse)').matches;
  function syncVideo(v) {
    const side = !v.closest('.reel-c');
    const want = videoOk && v._seen && !reduced() && !saveData && !document.hidden && !(weak && side);
    if (want) {
      if (!v.getAttribute('src')) {
        // computador ganha o vídeo mais nítido; tablet e o vídeo do meio no celular, o médio;
        // os dos lados no celular aparecem pequenos e meio escondidos, então descem o mais leve
        v.src = v.dataset.src + (v.hasAttribute('data-mini')
          ? (VW >= 640 ? '-480.mp4' : '-320.mp4')                                   // sabores: cartões pequenos
          : VW >= 900 ? '-720.mp4' : phone && side ? '-360.mp4' : '-480.mp4');
        v.addEventListener('playing', () => v.classList.add('on'), { once: true });
      }
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    } else if (!v.paused) v.pause();
  }
  const vIO = new IntersectionObserver(entries => entries.forEach(e => { e.target._seen = e.isIntersecting; syncVideo(e.target); }), { rootMargin: '150px 0px' });
  vids.forEach(v => vIO.observe(v));
  document.addEventListener('visibilitychange', () => vids.forEach(syncVideo));
  // os vídeos esperam a página assentar (a capa já está na tela), para não disputar a internet com o resto
  let videosGo = false;
  const goVideos = () => { if (videosGo) return; videosGo = true; idle(() => { videoOk = true; vids.forEach(syncVideo); }, { timeout: 600 }); };

  /* ---------- modo leve automático: o site se defende quando o aparelho está apertado ---------- */
  // aparelho fraco ou economia de dados: leve desde o começo. Senão, 3 engasgos (quadro de mais de 90ms) em 5s
  // deixam os enfeites de fundo descansando por 10s; o cardápio, os vídeos e o pedido continuam iguais
  // no modo leve a coxinha 3D também desenha a 30 quadros por segundo em vez de 60
  let cx = null, cxSeen = false, cxLoading = false;
  let liteUntil = 0, hiccups = [];
  const lite = () => root.classList.contains('lite');
  function setLite(on) {
    if (on === lite()) return;
    root.classList.toggle('lite', on);
    if (cx && cx.setFps) cx.setFps(on ? 30 : 60);
  }
  if (weak) setLite(true);
  else {
    // engasgo na abertura é normal (a página está sendo montada) e não quer dizer aparelho fraco:
    // só conta depois que a página assentou
    let settled = Infinity;
    const settle = () => { settled = performance.now() + 3000; };
    if (document.readyState === 'complete') settle(); else addEventListener('load', settle, { once: true });
    try {
      new PerformanceObserver(list => {
        const now = performance.now();
        list.getEntries().forEach(e => { if (e.duration > 90 && e.startTime > settled) hiccups.push(now); });
        hiccups = hiccups.filter(t => now - t < 5000);
        if (hiccups.length >= 3) { setLite(true); liteUntil = now + 10000; hiccups = []; }
      }).observe({ type: 'long-animation-frame' });
      setInterval(() => { if (liteUntil && performance.now() > liteUntil) { setLite(false); liteUntil = 0; } }, 2000);
    } catch (e) {}
  }

  /* ---------- a coxinha 3D saindo da tela do celular: o código só desce quando a seção chega perto ---------- */
  const stage = $('#stage3d');
  const cv = $('#cx3d');
  const crumbsCv = $('#cxCrumbs');
  const shadow = $('#cxShadow');
  const steps = $$('.show-steps li');
  function cxFail() { stage.classList.add('no3d'); }
  function cxPhase(ph) {
    const p = ph === 'abrindo' ? 'aberta' : ph;
    stage.className = 'stage3d ph-' + p;
    steps.forEach(li => li.classList.toggle('on', li.dataset.step === p));
  }
  // onde está a foto do post na tela: o desenho só aparece dentro dela ou acima da borda de cima (saindo da tela)
  function cxLayout() {
    if (!cx) return;
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    const pt = el => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top }; };
    const m = { tl: pt($('.pm-tl')), tr: pt($('.pm-tr')), br: pt($('.pm-br')), bl: pt($('.pm-bl')) };
    const L = p => `${(p.x - r.left).toFixed(1)}px ${(p.y - r.top).toFixed(1)}px`;
    const W = r.width.toFixed(1);
    cv.style.clipPath = `polygon(0px 0px, ${W}px 0px, ${W}px ${(m.tr.y - r.top).toFixed(1)}px, ${L(m.tr)}, ${L(m.br)}, ${L(m.bl)}, ${L(m.tl)}, 0px ${(m.tl.y - r.top).toFixed(1)}px)`;
    cx.setAnchors(m, crumbsCv.getBoundingClientRect());
    const s = stage.getBoundingClientRect();
    shadow.style.setProperty('--sx', ((m.tl.x + m.tr.x) / 2 - s.left) + 'px');
    shadow.style.setProperty('--sy', ((m.tl.y + m.tr.y) / 2 - s.top + 0.06 * (m.bl.y - m.tl.y)) + 'px');
  }
  let shO = -1;
  function cxFrame(s) {
    // a sombra da coxinha na tela do celular: aparece quando ela está fora, some quando volta para dentro
    const o = Math.round(s.out * (s.z > .5 ? .55 : .8) * 100) / 100;
    if (o !== shO) { shO = o; shadow.style.opacity = o; shadow.style.transform = `scale(${(.7 + .5 * s.out).toFixed(2)})`; }
  }
  function cxSync() {
    if (!cx) return;
    if (reduced()) { cx.stop(); cxLayout(); cx.renderAt(5); cxPhase('aberta'); cxFrame({ out: 1, z: .2 }); return; }
    if (cxSeen && !document.hidden) cx.start(); else cx.stop();
  }
  function cxBoot() {
    if (cxLoading) return;
    cxLoading = true;
    const s = document.createElement('script');
    s.src = 'assets/coxinha3d.js?v=7';
    s.async = true;
    s.onload = () => {
      try { cx = window.Coxinha3D.mount(cv, { maxDpr: VW < 640 ? 1.5 : 1, fps: lite() ? 30 : 60, crumbs: crumbsCv, onPhase: cxPhase, onFrame: cxFrame, onFail: () => { cxFail(); goVideos(); }, onReady: () => setTimeout(goVideos, 250) }); } catch (e) { cx = null; }
      if (!cx) { goVideos(); return cxFail(); }
      cxLayout();
      cxSync();
    };
    s.onerror = () => { cxFail(); goVideos(); };
    document.head.appendChild(s);
  }
  new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) cxBoot(); }, { rootMargin: '700px 0px' }).observe(stage);
  // computador com Windows: a primeira vez que o Chrome liga o 3D a página dá uma parada curta (ele traduz o desenho
  // para o DirectX); isso acontece logo depois de abrir, com a pessoa ainda lendo o topo, e os vídeos começam quando
  // o 3D termina. Celular e o resto: os vídeos começam logo e o 3D desce depois, sem disputar a internet e o
  // processador da abertura (ou antes, se a pessoa rolar até perto dele)
  // o relógio só começa depois que a primeira tela apareceu de verdade (o aviso de "primeira pintura" do navegador):
  // com internet rápida o carregamento termina antes dela, e os vídeos não podem disputar com a capa
  const earlyCx = /Windows/.test(navigator.userAgent) && !touch;
  function afterPaint(f) {
    try {
      if (performance.getEntriesByName('first-contentful-paint').length) return f();
      // o primeiro aviso costuma ser só a cor de fundo ("first-paint"); espera o de conteúdo de verdade
      const po = new PerformanceObserver(list => { if (list.getEntries().some(e => e.name === 'first-contentful-paint')) { po.disconnect(); f(); } });
      po.observe({ type: 'paint' });
    } catch (e) { requestAnimationFrame(() => requestAnimationFrame(f)); }
  }
  const afterLoad = () => afterPaint(() => setTimeout(() => idle(() => {
    if (earlyCx) { cxBoot(); setTimeout(goVideos, 3500); }
    else { goVideos(); setTimeout(() => idle(cxBoot, { timeout: 2000 }), 4000); }
  }, { timeout: 800 }), earlyCx ? 700 : 900));
  if (document.readyState === 'complete') afterLoad(); else addEventListener('load', afterLoad, { once: true });
  new IntersectionObserver(([e]) => { cxSeen = e.isIntersecting; if (cxSeen) cxLayout(); cxSync(); }).observe(stage);
  document.addEventListener('visibilitychange', cxSync);
  let cxRz = 0;
  addEventListener('resize', () => { clearTimeout(cxRz); cxRz = setTimeout(cxLayout, 150); }, { passive: true });

  /* ---------- mapa do Google: entra sozinho quando a seção chega perto ---------- */
  // o mapa do Google é pesado: carregado no meio de uma rolagem ele dá um tranco (principalmente no celular), então
  // espera a pessoa parar de rolar perto dele; com a tela parada, ninguém percebe
  const map = $('#map');
  const mapFrame = $('iframe', map);
  let mapDone = false, mapT = 0;
  function mapLoad() {
    if (mapDone) return;
    mapDone = true;
    removeEventListener('scroll', mapWait);
    mapFrame.addEventListener('load', () => map.classList.add('loaded'), { once: true });
    mapFrame.src = LOJA.mapa;
  }
  function mapWait() { clearTimeout(mapT); mapT = setTimeout(mapLoad, 280); }
  new IntersectionObserver((entries, io) => {
    if (!entries.some(e => e.isIntersecting)) return;
    io.disconnect();
    addEventListener('scroll', mapWait, { passive: true });
    mapWait();
  }, { rootMargin: '900px 0px' }).observe(map);

  /* ---------- cardápio: abas que acompanham a rolagem ---------- */
  const tabsBar = $('.tabs');
  const tabs = $$('.tabs a');
  const catIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    tabs.forEach(a => {
      const on = a.hash === '#' + e.target.id;
      a.classList.toggle('on', on);
      if (on && tabsBar.scrollWidth > tabsBar.clientWidth) tabsBar.scrollTo({ left: a.offsetLeft - 24, behavior: reduced() ? 'auto' : 'smooth' });
    });
  }), { rootMargin: '-30% 0px -60% 0px' });
  $$('.cat').forEach(c => catIO.observe(c));

  /* ---------- catálogo: lido do próprio cardápio (o preço escrito no card é o preço do pedido) ---------- */
  const catalog = new Map();
  $$('.prod').forEach(card => {
    if (card.classList.contains('prod-opt')) {
      $$('input[type=radio]', card).forEach(r => catalog.set(`${card.dataset.id}-${r.value}`, {
        nome: card.dataset.nome, detalhe: `${r.value} ${card.dataset.un}`, preco: toCents($('em', r.nextElementSibling).textContent), card,
      }));
    } else {
      catalog.set(card.dataset.id, { nome: card.dataset.nome, detalhe: card.dataset.detalhe, preco: toCents($('[data-price]', card).textContent), card });
    }
  });

  // quantidade escolhida muda o preço na hora
  $$('.prod-opt').forEach(card => {
    const price = $('[data-price]', card);
    card.addEventListener('change', e => {
      if (e.target.type !== 'radio') return;
      price.innerHTML = priceHTML($('em', e.target.nextElementSibling).textContent);
      if (!reduced() && price.animate) price.animate([{ transform: 'scale(1.08)' }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
    });
  });

  /* ---------- o pedido ---------- */
  const KEY = 'cx-pedido';
  let cart = [];
  let chaveEnvio = null;   // identifica uma tentativa de envio: repetir o envio não duplica o pedido
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { cart = []; }
  cart = Array.isArray(cart) ? cart.filter(i => i && catalog.has(i.id) && i.qtd > 0).map(i => ({ id: i.id, qtd: Math.min(99, Math.floor(i.qtd)) })) : [];
  const items = () => cart.map(i => ({ ...catalog.get(i.id), id: i.id, qtd: i.qtd }));
  const count = () => cart.reduce((n, i) => n + i.qtd, 0);
  const total = () => items().reduce((s, i) => s + i.preco * i.qtd, 0);
  const qtyOf = id => (cart.find(i => i.id === id) || { qtd: 0 }).qtd;
  const needsFlavors = () => cart.some(i => /^(combo|salgados)-/.test(i.id));
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} }
  function setQty(id, q) {
    const it = cart.find(i => i.id === id);
    q = Math.max(0, Math.min(99, q));
    if (it) { if (q) it.qtd = q; else cart = cart.filter(i => i !== it); } else if (q) cart.push({ id, qtd: q });
    chaveEnvio = null;
    save(); render();
  }

  function qtyControl(name) {
    const d = document.createElement('div');
    d.className = 'qty';
    d.innerHTML = `<button type="button" data-dec aria-label="Tirar um ${name}"><svg class="ico" aria-hidden="true"><use href="#i-minus"/></svg></button><output></output><button type="button" data-inc aria-label="Mais um ${name}"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button>`;
    return d;
  }

  // combos: o botão Adicionar vira um contador quando o combo já está no pedido
  $$('.prod:not(.prod-opt)').forEach(card => {
    const id = card.dataset.id, add = $('[data-add]', card), name = $('h4', card).textContent;
    const q = qtyControl(name);
    q.hidden = true;
    add.after(q);
    add.addEventListener('click', () => { setQty(id, qtyOf(id) + 1); added(id, add); if (document.activeElement === add || !add.offsetParent) $('[data-inc]', q).focus(); });
    $('[data-inc]', q).addEventListener('click', e => { setQty(id, qtyOf(id) + 1); added(id, e.currentTarget); });
    $('[data-dec]', q).addEventListener('click', () => {
      setQty(id, qtyOf(id) - 1);
      if (!qtyOf(id)) add.focus();
      say(`${name}: ${qtyOf(id)} no pedido.`);
    });
  });
  // salgados e mini churros: adiciona a quantidade escolhida e mostra um "Adicionado" rápido
  $$('.prod-opt').forEach(card => {
    const add = $('[data-add]', card);
    const label = add.innerHTML;
    let timer;
    add.addEventListener('click', () => {
      const r = $('input[type=radio]:checked', card);
      const id = `${card.dataset.id}-${r.value}`;
      setQty(id, qtyOf(id) + 1);
      added(id, add);
      add.classList.add('done');
      add.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-check"/></svg>Adicionado';
      clearTimeout(timer);
      timer = setTimeout(() => { add.classList.remove('done'); add.innerHTML = label; }, 1400);
    });
  });

  const cartbar = $('#cartbar');
  function added(id, el) {
    const it = catalog.get(id);
    const n = count();
    say(`${it.nome}${it.card.classList.contains('prod-opt') ? `, ${it.detalhe},` : ''} no pedido. ${n} ${n === 1 ? 'item' : 'itens'}, ${fmtTxt(total())}.`);
    pop(el);
    if (!reduced()) { cartbar.classList.remove('bump'); void cartbar.offsetWidth; cartbar.classList.add('bump'); }
  }

  // migalhas douradas saindo do botão
  const COLORS = ['#F2B65A', '#E8963A', '#C96F22', '#F7B53D', '#FFF1DE'];
  function pop(el) {
    if (reduced() || !el || !el.animate) return;
    const r = el.getBoundingClientRect();
    const cx0 = r.left + r.width / 2, cy0 = r.top + r.height / 2;
    for (let k = 0; k < 10; k++) {
      const p = document.createElement('i');
      p.className = 'pop';
      p.style.cssText = `left:${cx0 - 4}px;top:${cy0 - 5}px;width:${5 + Math.random() * 5}px;height:${5 + Math.random() * 4}px;border-radius:${30 + Math.random() * 30}% ${40 + Math.random() * 30}%;background:${COLORS[k % COLORS.length]}`;
      document.body.appendChild(p);
      const ang = (-90 + (k - 4.5) * 19 + (Math.random() * 12 - 6)) * Math.PI / 180;
      const dist = 40 + Math.random() * 34, dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      const rot = Math.random() * 300 - 150;
      p.animate([
        { transform: 'translate(0,0) rotate(0deg) scale(.5)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx * 1.12}px,${dy + 34}px) rotate(${rot * 1.6}deg) scale(.8)`, opacity: 0 },
      ], { duration: 780, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => p.remove();
    }
  }

  /* ---------- gaveta do pedido ---------- */
  const dlg = $('#cart');
  const lines = $('[data-lines]', dlg);
  const form = $('#order');
  const sent = $('[data-sent]', dlg);
  const orderCta = $('[data-order-cta]');
  const orderLabel = $('[data-order-label]');

  function render() {
    const n = count(), t = total(), list = items();
    if (n) { cartbar.hidden = false; requestAnimationFrame(() => cartbar.classList.add('show')); } else { cartbar.classList.remove('show'); cartbar.hidden = true; }
    body.classList.toggle('has-cart', n > 0);
    $$('[data-cart-count]').forEach(el => { el.textContent = n; });
    $$('[data-cart-total]').forEach(el => { el.textContent = fmt(t); });
    $('.cartbar-btn', cartbar).setAttribute('aria-label', `Ver pedido: ${n} ${n === 1 ? 'item' : 'itens'}, ${fmtTxt(t)}`);
    orderLabel.textContent = n ? `Ver pedido (${n})` : 'Pedir agora';
    $('use', orderCta).setAttribute('href', n ? '#i-bag' : '#i-wa');
    if (n) waFloat.classList.remove('show'); else if (booted) onScroll();
    $$('.prod:not(.prod-opt)').forEach(card => {
      const q = qtyOf(card.dataset.id), add = $('[data-add]', card), ctl = $('.qty', card);
      add.hidden = q > 0; ctl.hidden = q === 0;
      $('output', ctl).textContent = q;
    });
    $('[data-empty]', dlg).hidden = n > 0 || !!feito;
    $$('[data-filled]', dlg).forEach(el => { el.hidden = n === 0 || !!feito; });
    lines.hidden = !!feito;
    $('.clear-row', dlg).hidden = n === 0 || !!feito;
    $('[data-done]', dlg).hidden = !feito;
    $('[data-flav-pick]', dlg).hidden = !needsFlavors();
    if (n) { preencheCliente(); renderResumo(); }
    const a = document.activeElement;
    const focusId = dlg.contains(a) && a.closest('li') ? a.closest('li').dataset.id + (a.hasAttribute('data-inc') ? '+' : '-') : null;
    lines.innerHTML = '';
    list.forEach(i => {
      const li = document.createElement('li');
      li.dataset.id = i.id;
      const name = document.createElement('div');
      name.className = 'l-name';
      name.textContent = i.nome;
      const det = document.createElement('span');
      det.className = 'l-det';
      det.textContent = i.detalhe;
      name.appendChild(det);
      const price = document.createElement('span');
      price.className = 'l-price';
      price.textContent = fmt(i.preco * i.qtd);
      const ctrl = document.createElement('div');
      ctrl.className = 'l-ctrl';
      const q = qtyControl(i.nome);
      $('output', q).textContent = i.qtd;
      $('[data-inc]', q).addEventListener('click', () => setQty(i.id, i.qtd + 1));
      $('[data-dec]', q).addEventListener('click', () => { setQty(i.id, i.qtd - 1); if (!qtyOf(i.id)) (lines.querySelector('[data-dec]') || $('[data-close]', dlg)).focus(); });
      const unit = document.createElement('span');
      unit.className = 'l-unit';
      unit.textContent = `${fmt(i.preco)} cada`;
      ctrl.append(q, unit);
      li.append(name, price, ctrl);
      lines.appendChild(li);
    });
    if (focusId) {
      const li = lines.querySelector(`li[data-id="${focusId.slice(0, -1)}"]`);
      if (li) $(focusId.endsWith('+') ? '[data-inc]' : '[data-dec]', li).focus();
    }
    sent.hidden = true;
  }

  function lock(on) { root.classList.toggle('lock', on); }
  function openDlg(d) {
    if (d.open) return;
    d.classList.remove('closing'); d.showModal(); lock(true);
    // rua já preenchida (pedido anterior): confere no mapa quando a pessoa abre o pedido
    if (d === dlg && form.rua.value && !geo.estado) confereEnd();
  }
  function closeDlg(d, after) {
    if (!d.open) return;
    const done = () => { d.classList.remove('closing'); d.close(); if (after) after(); };
    if (reduced() || d.classList.contains('closing')) return done();
    d.classList.add('closing');
    let fired = false;
    const fin = e => { if (e && e.target !== d) return; if (fired) return; fired = true; d.removeEventListener('animationend', fin); done(); };
    d.addEventListener('animationend', fin);
    setTimeout(fin, 420);
  }
  $$('dialog').forEach(d => {
    d.addEventListener('cancel', e => { e.preventDefault(); closeDlg(d); });
    d.addEventListener('close', () => lock(false));
    d.addEventListener('click', e => { if (e.target === d) closeDlg(d); });
    $$('[data-close]', d).forEach(b => b.addEventListener('click', e => {
      const hash = b.getAttribute('href');
      if (hash && hash.startsWith('#')) { e.preventDefault(); closeDlg(d, () => { const t = document.getElementById(hash.slice(1)); if (t) t.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }); }); }
      else closeDlg(d);
    }));
  });

  const openCart = () => { render(); openDlg(dlg); avisoLoja(); carregarLoja(); };
  $$('[data-open-cart]').forEach(b => b.addEventListener('click', openCart));
  orderCta.addEventListener('click', e => { if (count() > 0) { e.preventDefault(); setMenu(false); openCart(); } });
  $('[data-clear]', dlg).addEventListener('click', () => {
    cart = []; chaveEnvio = null; save(); form.reset(); preenchido = false; Object.keys(campos).forEach(k => marca(k, null)); limpaErro();
    syncModalidade(); syncPagamento(); render(); say('Pedido limpo.');
    $('[data-close]', dlg).focus();
  });

  /* ---------- envio do pedido ----------
     O pedido vai para a API do próprio site (funções da Vercel em /api, com o banco Postgres): é gravado e ganha
     número na hora, e o preço que vale é o do banco. Se a API ou o banco não estiverem ligados, ou se falharem,
     o pedido vai pronto para o WhatsApp da loja, como antes. */
  // pedido feito no computador de quem cuida do site (ou com ?teste=1 no endereço) fica marcado como teste no painel
  const TESTE = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || /[?&]teste=1(&|$)/.test(location.search);
  let API = null;   // null = ainda não sabe; true = API e banco respondendo; false = pedido vai pelo WhatsApp
  async function api(acao, corpo) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    let r;
    try {
      r = await fetch(`api/publico/${acao}`, corpo
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: ctl.signal }
        : { signal: ctl.signal });
    } catch (e) {
      throw { rede: true };
    } finally { clearTimeout(timer); }
    const body = await r.json().catch(() => null);
    if (!r.ok) throw { code: body && body.erro, detalhe: body && body.detalhe, status: r.status };
    return body;
  }

  const submitBtn = $('[data-submit]', dlg);
  const waFallback = $('[data-wa-fallback]', dlg);
  const formErr = $('[data-form-err]', dlg);
  const PAG_PADRAO = $$('input[name=pagamento]', form).map(i => i.value);
  let loja = { aceitando_pedidos: true, mensagem_pausa: null, taxa_entrega_centavos: null, pedido_minimo_centavos: 0, pagamentos: PAG_PADRAO };
  let lojaEm = 0, feito = null, enviando = false;
  const modalidade = () => { const r = $('input[name=modalidade]:checked', form); return r ? r.value : 'entrega'; };
  const pagSel = () => { const r = $('input[name=pagamento]:checked', form); return r ? r.value : ''; };
  const usaBanco = () => API === true;
  // fora do horário, ou com os pedidos pausados no painel, o site só mostra o cardápio
  const pausada = () => API === true && loja.aceitando_pedidos === false;
  const podePedir = () => { let st = null; try { st = situacao(); } catch (e) {} return (!st || st.aberto) && !pausada(); };
  const faixas = () => (Array.isArray(loja.taxas_entrega) ? loja.taxas_entrega : []);
  // taxa: 0 na retirada e acima do valor de entrega grátis; pela distância depois que a rua é conferida;
  // undefined = ainda sem endereço conferido; null = a combinar
  const taxaAtual = () => {
    if (modalidade() === 'retirada') return 0;
    const gratis = loja.entrega_gratis_acima_centavos;
    if (usaBanco() && gratis != null && total() >= gratis) return 0;
    if (!usaBanco()) return loja.taxa_entrega_centavos;
    if (geo.estado === 'ok' && geo.taxa !== undefined) return geo.taxa;
    return faixas().length ? undefined : loja.taxa_entrega_centavos;
  };
  function renderTaxas() {
    const el = $('[data-taxas]', form), f = faixas();
    let t = f.length ? `. Taxa: ${f.map(x => `até ${kmTxt(x.ate_km)} km ${x.centavos ? fmtTxt(x.centavos) : 'grátis'}`).join(', ')}` : '';
    if (f.length && loja.entrega_gratis_acima_centavos != null) t += `; grátis acima de ${fmtTxt(loja.entrega_gratis_acima_centavos)}`;
    el.textContent = t;
  }
  const menuFechado = $('[data-menu-fechado]');
  function syncFechado() {
    const pode = podePedir();
    root.classList.toggle('loja-fechada', !pode);
    let st = null; try { st = situacao(); } catch (e) {}
    $('span', menuFechado).textContent = pode ? '' : pausada()
      ? `Os pedidos pelo site estão pausados agora${loja.mensagem_pausa ? `: ${loja.mensagem_pausa}` : '.'} Dá para ver o cardápio à vontade.`
      : `${st ? st.texto : 'Fechado agora'}. Dá para ver o cardápio; os pedidos pelo site voltam ${st && st.abre ? st.abre : 'quando a loja abrir'}.`;
    menuFechado.hidden = pode;
    avisoLoja();
  }
  // com a loja fechada, "Adicionar" só avisa (o clique não chega no botão)
  document.addEventListener('click', e => {
    if (podePedir() || !e.target.closest('.prod [data-add], .prod .qty [data-inc]')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    menuFechado.classList.remove('pisca'); void menuFechado.offsetWidth; menuFechado.classList.add('pisca');
    if (menuFechado.getBoundingClientRect().top < 60 || menuFechado.getBoundingClientRect().bottom > VH) menuFechado.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    say($('span', menuFechado).textContent);
  }, true);

  async function carregarLoja(forca) {
    if (!forca && (API === false || (API === true && Date.now() - lojaEm < 120000))) return;
    try {
      const c = await api('config');
      API = true;
      if (c) {
        loja = { ...loja, ...c }; lojaEm = Date.now();
        if (Array.isArray(c.horarios) && c.horarios.length === 7) {
          const novo = c.horarios.map(d => (Array.isArray(d) ? d.map(t => +String(t).slice(0, 2) * 60 + +String(t).slice(3, 5)) : null));
          if (JSON.stringify(novo) !== JSON.stringify(HOR)) { HOR = novo; renderHorarios(); updateStatus(); }
        }
        montaPagamentos(); renderTaxas(); renderResumo(); avisoLoja(); syncFechado();
        $('[data-raio]', form).textContent = kmTxt(loja.raio_entrega_km || 12);
      }
    } catch (e) {
      // sem API (site aberto fora da Vercel) ou sem banco ligado: o pedido vai pelo WhatsApp
      if (e && (e.status === 404 || e.status === 405 || e.status === 503)) { API = false; avisoLoja(); }
      // internet caiu: tenta de novo na próxima vez que abrir o pedido
    }
  }
  function montaPagamentos() {
    const box = $('[data-pay-opts]', form);
    const lista = loja.pagamentos && loja.pagamentos.length ? loja.pagamentos : PAG_PADRAO;
    if (lista.join('|') === $$('input', box).map(i => i.value).join('|')) return;
    const atual = pagSel();
    box.innerHTML = '';
    lista.forEach(v => {
      const l = document.createElement('label');
      const i = document.createElement('input'); i.type = 'radio'; i.name = 'pagamento'; i.value = v; i.checked = v === atual;
      const sp = document.createElement('span'); sp.textContent = v;
      l.append(i, sp); box.appendChild(l);
    });
    syncPagamento();
  }
  function renderResumo() {
    const sub = total(), tx = taxaAtual(), ret = modalidade() === 'retirada';
    $('[data-sum-sub]', dlg).textContent = fmt(sub);
    $('[data-sum-fee-label]', dlg).textContent = !ret && geo.estado === 'ok' && geo.km != null ? `Entrega (${kmTxt(geo.km)} km)` : 'Entrega';
    $('[data-sum-fee]', dlg).textContent = ret ? 'grátis (retirada)' : tx === undefined ? 'pela distância' : tx === null ? 'a combinar' : tx === 0 ? 'grátis' : fmt(tx);
    $('[data-sum-total]', dlg).textContent = fmt(sub + (tx || 0)) + (tx === undefined ? ' + entrega' : '');
    $('[data-total-note]', dlg).textContent = tx === undefined
      ? 'A taxa de entrega aparece assim que a rua for conferida no mapa.'
      : tx === null ? 'Entrega a combinar com a Coxitas (o total é só dos itens). Você paga na entrega.'
      : `Você paga ${ret ? 'na retirada' : 'na entrega'}.`;
  }
  function avisoLoja() {
    const el = $('[data-order-alert]', form);
    let txt = '', stop = false;
    if (!podePedir()) { txt = $('span', menuFechado).textContent || 'A loja está fechada agora.'; stop = true; }
    el.textContent = txt; el.hidden = !txt; el.classList.toggle('is-stop', stop);
    modoEnvio();
  }
  function modoEnvio() {
    const banco = usaBanco(), pode = podePedir();
    submitBtn.setAttribute('aria-disabled', String(!pode));
    $('[data-submit-label]', dlg).textContent = enviando ? 'Enviando…' : !pode ? 'Loja fechada agora' : banco ? 'Confirmar pedido' : 'Enviar pedido pelo WhatsApp';
    $('use', submitBtn).setAttribute('href', banco ? '#i-check' : '#i-wa');
    submitBtn.classList.toggle('btn-wa', !banco);
  }
  function syncModalidade() {
    const ent = modalidade() === 'entrega';
    $('[data-end-field]', form).hidden = !ent;
    $('[data-pickup-note]', form).hidden = ent;
    if (!ent) { ['rua', 'numero', 'bairro'].forEach(k => marca(k, null)); mostraEnd('', ''); } else if (form.rua.value.trim()) confereEnd();
    renderResumo();
  }
  function syncPagamento() {
    const din = /^dinheiro/i.test(pagSel());
    $('[data-troco]', form).hidden = !din;
    if (!din) marca('troco', null);
  }

  // telefone: aceita com ou sem +55, parênteses, espaço e traço; guarda só os dígitos com DDD
  const digitos = v => String(v || '').replace(/\D/g, '');
  function telNormal(v) { let d = digitos(v); if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2); return d.replace(/^0+/, ''); }
  const telOk = d => /^[1-9][0-9]9?[0-9]{8}$/.test(d);
  const telBonito = d => (d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d);
  form.telefone.addEventListener('blur', () => { const d = telNormal(form.telefone.value); if (telOk(d)) form.telefone.value = telBonito(d); });

  /* ---------- endereço: a rua existe em Votuporanga e fica dentro da área de entrega? ----------
     Quem confere é o servidor (mapa do OpenStreetMap, com o raio configurado no painel); aqui só mostra o resultado
     assim que a pessoa termina de escrever a rua. O pedido é conferido de novo no servidor na hora de gravar. */
  const endStatus = $('[data-end-status]', form);
  const limpa = v => String(v || '').replace(/\s+/g, ' ').trim();
  const partesEnd = () => ({ rua: limpa(form.rua.value), numero: limpa(form.numero.value), bairro: limpa(form.bairro.value), complemento: limpa(form.complemento.value) });
  const juntaEnd = e => `${e.rua}, ${e.numero} - ${e.bairro}${e.complemento ? ` (${e.complemento})` : ''}`;
  const chaveRua = r => r.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  let geo = { chave: '', estado: '' }, geoBusca = null;
  function mostraEnd(estado, txt) {
    endStatus.className = `end-status${estado ? ` is-${estado}` : ''}`;
    $('span', endStatus).textContent = txt || '';
    $('use', endStatus).setAttribute('href', estado === 'ok' ? '#i-check' : '#i-pin');
    endStatus.hidden = !txt;
  }
  function textoEnd(g) {
    if (g.estado === 'ok') return `${g.rua} fica a ${kmTxt(g.km)} km da loja: dentro da área de entrega${g.taxa == null ? '' : g.taxa === 0 ? ', com entrega grátis' : `, taxa de ${fmtTxt(g.taxa)}`}.`;
    if (g.estado === 'fora') return `Esse endereço fica a ${kmTxt(g.km)} km da loja e a Coxitas entrega até ${kmTxt(g.raio)} km. Escolha "Retirar na loja" ou fale pelo WhatsApp.`;
    if (g.estado === 'nao') return 'Não achamos essa rua em Votuporanga. Confira o nome (ex.: Rua Amazonas, Avenida Brasil).';
    return 'Não deu para conferir a rua no mapa agora. Tente de novo em instantes.';
  }
  async function confereEnd() {
    const { rua } = partesEnd();
    if (modalidade() !== 'entrega' || rua.length < 3) { geo = { chave: '', estado: '' }; mostraEnd('', ''); return geo; }
    if (API === null) await carregarLoja(true);
    if (!usaBanco()) { mostraEnd('', ''); return { estado: 'whatsapp' }; }   // pelo WhatsApp a própria loja confere
    const ch = chaveRua(rua);
    if (geo.chave === ch && ['ok', 'fora', 'nao'].includes(geo.estado)) return geo;
    if (geoBusca && geo.chave === ch) return geoBusca;
    geo = { chave: ch, estado: 'conferindo' };
    mostraEnd('conferindo', 'Conferindo a rua no mapa…');
    geoBusca = (async () => {
      let g;
      try {
        const r = await api('endereco', { rua });
        g = { chave: ch, estado: 'ok', km: r.km, raio: r.raio, rua: r.rua, taxa: r.taxa_centavos };
      } catch (err) {
        const c = err && err.code, [km, raio] = String((err && err.detalhe) || '').split('|');
        g = { chave: ch, estado: c === 'fora_da_area' ? 'fora' : c === 'endereco_nao_encontrado' ? 'nao' : 'erro', km, raio };
      }
      if (geo.chave === ch) { geo = g; mostraEnd(g.estado === 'ok' ? 'ok' : g.estado === 'fora' ? 'fora' : 'erro', textoEnd(g)); renderResumo(); }
      geoBusca = null;
      return g;
    })();
    return geoBusca;
  }
  form.rua.addEventListener('change', () => confereEnd());
  form.rua.addEventListener('input', () => { if (geo.chave && geo.chave !== chaveRua(form.rua.value)) { geo = { chave: '', estado: '' }; mostraEnd('', ''); renderResumo(); } });

  const campos = { nome: [form.nome, $('#e-nome')], telefone: [form.telefone, $('#e-tel')], rua: [form.rua, $('#e-rua')], numero: [form.numero, $('#e-num')], bairro: [form.bairro, $('#e-bairro')], pagamento: [$('.pay', form), $('#e-pag')], troco: [form.troco, $('#e-troco')] };
  function marca(nome, msg) {
    const [el, err] = campos[nome];
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    err.textContent = msg || ''; err.hidden = !msg;
  }
  function valida() {
    const e = {};
    const nome = form.nome.value.trim().replace(/\s+/g, ' ');
    if (nome.length < 2) e.nome = 'Escreva o seu nome.';
    const tel = telNormal(form.telefone.value);
    if (!telOk(tel)) e.telefone = 'Confira o telefone com DDD, por exemplo (17) 99999-9999.';
    const end = partesEnd(), ent = modalidade() === 'entrega';
    if (ent && end.rua.length < 3) e.rua = 'Escreva o nome da rua.';
    if (ent && !end.numero) e.numero = 'Escreva o número (ou S/N).';
    if (ent && end.bairro.length < 2) e.bairro = 'Escreva o bairro.';
    const pag = pagSel();
    if (!pag) e.pagamento = 'Escolha como vai pagar.';
    let troco = null;
    if (/^dinheiro/i.test(pag) && form.troco.value.trim()) {
      troco = toCents(form.troco.value);
      if (!(troco > 0) || troco > 1000000) e.troco = 'Escreva só o valor, por exemplo 100.';
    }
    Object.keys(campos).forEach(k => marca(k, e[k]));
    const primeiro = Object.keys(campos).find(k => e[k]);
    if (primeiro) {
      const el = campos[primeiro][0];
      (el.tagName === 'FIELDSET' ? $('input', el) : el).focus();
      say(e[primeiro]);
      return null;
    }
    return { nome, tel, end: ent ? juntaEnd(end) : '', partes: ent ? end : null, pag, troco: /^dinheiro/i.test(pag) ? troco : null, obs: form.obs.value.trim() };
  }
  form.addEventListener('input', e => { const k = e.target.name; if (k && campos[k] && e.target.getAttribute('aria-invalid')) marca(k, null); });
  form.addEventListener('change', e => {
    if (e.target.name === 'modalidade') syncModalidade();
    if (e.target.name === 'pagamento') { marca('pagamento', null); syncPagamento(); }
  });

  // a pessoa não precisa digitar tudo de novo no próximo pedido (fica só neste aparelho)
  const CLI = 'cx-cliente';
  let preenchido = false;
  function preencheCliente() {
    if (preenchido) return;
    preenchido = true;
    try {
      const c = JSON.parse(localStorage.getItem(CLI) || 'null');
      if (!c) return;
      if (!form.nome.value && c.nome) form.nome.value = c.nome;
      if (!form.telefone.value && c.tel) form.telefone.value = telBonito(c.tel);
      if (c.partes) ['rua', 'numero', 'bairro', 'complemento'].forEach(k => { if (!form[k].value && c.partes[k]) form[k].value = c.partes[k]; });
      else if (c.end && !form.rua.value) {
        // endereço guardado antes, numa linha só ("Rua das Flores, 120, Centro"): separa o que der
        const m = /^(.*?),\s*(\d+\s*[a-z]?|s\/?n)\s*(?:[-,]\s*(.*))?$/i.exec(c.end);
        if (m) { form.rua.value = m[1]; form.numero.value = m[2]; form.bairro.value = m[3] || ''; } else form.rua.value = c.end;
      }
    } catch (e) {}
  }
  function guardaCliente(v) { try { localStorage.setItem(CLI, JSON.stringify({ nome: v.nome, tel: v.tel, end: v.end || '', partes: v.partes || null })); } catch (e) {} }
  function guardaPedido(r) {
    try {
      const l = JSON.parse(localStorage.getItem('cx-meus-pedidos') || '[]').filter(x => x && x.n !== r.numero);
      l.unshift({ n: r.numero, c: r.codigo, t: r.criado_em });
      localStorage.setItem('cx-meus-pedidos', JSON.stringify(l.slice(0, 5)));
    } catch (e) {}
  }

  // foto do pedido na hora do envio (o carrinho é limpo depois que o pedido é gravado)
  function retrato(v) {
    return { itens: items(), sabores: needsFlavors() ? $$('input[name=sabor]:checked', form).map(c => c.value) : [], sub: total(), taxa: taxaAtual(), mod: modalidade(), ...v };
  }
  // a mensagem que chega no WhatsApp da Coxitas
  function pedidoTexto(o, numero) {
    const L = [numero ? `Olá, Coxitas! Fiz o pedido nº ${numero} pelo site:` : 'Olá, Coxitas! Quero fazer um pedido pelo site:', ''];
    o.itens.forEach(i => {
      L.push(`• ${i.qtd}x ${i.nome}: ${fmtTxt(i.preco * i.qtd)}`);
      L.push(`   ${i.detalhe}${i.qtd > 1 ? ` (${fmtTxt(i.preco)} cada)` : ''}`);
    });
    if (o.sabores.length) L.push('', `Sabores preferidos: ${o.sabores.join(', ')}`);
    L.push('', `Itens: ${fmtTxt(o.sub)}`);
    L.push(o.mod === 'retirada' ? 'Retirada na loja' : `Entrega: ${o.taxa == null ? 'a combinar' : o.taxa === 0 ? 'grátis' : fmtTxt(o.taxa)}`);
    L.push(`*Total: ${fmtTxt(o.sub + (o.taxa || 0))}${o.mod === 'entrega' && o.taxa == null ? ' + entrega' : ''}*`, '');
    if (o.nome) L.push(`Nome: ${o.nome}`);
    if (o.tel) L.push(`Telefone: ${telBonito(o.tel)}`);
    if (o.mod === 'entrega' && o.end) L.push(`Endereço de entrega: ${o.end}`);
    if (o.pag) L.push(`Pagamento: ${o.pag}${o.troco ? ` (troco para ${fmtTxt(o.troco)})` : ''}`);
    if (o.obs) L.push(`Observação: ${o.obs}`);
    return L.join('\n');
  }
  function enviaWhats(o) {
    const url = waURL(pedidoTexto(o));
    $('[data-sent-link]', dlg).href = url;
    sent.hidden = false;
    window.open(url, '_blank', 'noopener');
  }

  const ERROS = {
    loja_pausada: d => `Os pedidos pelo site estão pausados agora${d ? `: ${d}` : ''}.`,
    loja_fechada: 'A loja está fechada agora. Os pedidos pelo site voltam no horário de funcionamento.',
    sem_banco: 'Os pedidos pelo site estão fora do ar agora. Mande pelo WhatsApp.',
    dados_invalidos: 'Confira os dados do pedido.',
    nome_invalido: 'Confira o seu nome.',
    telefone_invalido: 'Confira o telefone com DDD.',
    endereco_invalido: 'Confira o endereço de entrega: rua, número e bairro.',
    endereco_nao_encontrado: 'Não achamos essa rua em Votuporanga. Confira o nome da rua.',
    fora_da_area: d => { const [k, r] = String(d || '').split('|'); return `Esse endereço fica a ${kmTxt(k)} km da loja e a Coxitas entrega até ${kmTxt(r)} km. Escolha "Retirar na loja" ou fale pelo WhatsApp.`; },
    mapa_indisponivel: 'Não deu para conferir o endereço no mapa agora. Tente de novo em instantes ou mande pelo WhatsApp.',
    pagamento_invalido: 'Essa forma de pagamento não está disponível agora. Escolha outra.',
    troco_invalido: 'Confira o valor do troco.',
    sabor_invalido: 'Algum sabor escolhido não está disponível. Confira os sabores.',
    produto_indisponivel: 'Um item do pedido não está mais disponível. Tire ele do pedido e tente de novo.',
    itens_invalidos: 'Confira as quantidades do pedido (até 50 de cada item).',
    abaixo_do_minimo: d => `O pedido mínimo pelo site é ${fmt(+d || 0)}.`,
    muitos_pedidos: 'Recebemos muitos pedidos deste telefone há pouco. Fale com a Coxitas pelo WhatsApp.',
    observacao_longa: 'A observação ficou longa demais (até 500 letras).',
  };
  function mostraErro(err, o) {
    const f = err && ERROS[err.code];
    formErr.textContent = err && err.rede
      ? 'Não conseguimos falar com a Coxitas agora (sem conexão). Tente de novo em instantes ou mande pelo WhatsApp.'
      : f ? (typeof f === 'function' ? f(err.detalhe) : f) : 'Não conseguimos registrar o pedido agora. Tente de novo ou mande pelo WhatsApp.';
    formErr.hidden = false;
    waFallback.href = waURL(pedidoTexto(o));
    waFallback.hidden = false;
    say(formErr.textContent);
    if (err && (err.code === 'loja_fechada' || err.code === 'loja_pausada')) waFallback.hidden = true;   // fechada: nem pelo WhatsApp
    if (err && (err.code === 'pagamento_invalido' || err.code === 'loja_pausada' || err.code === 'loja_fechada')) carregarLoja(true);
  }
  function limpaErro() { formErr.hidden = true; waFallback.hidden = true; }
  waFallback.addEventListener('click', () => { sent.hidden = false; $('[data-sent-link]', dlg).href = waFallback.href; });

  function novaChave() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!count() || enviando) return;
    if (!podePedir()) { avisoLoja(); say($('[data-order-alert]', form).textContent); return; }
    limpaErro();
    sent.hidden = true;
    const v = valida();
    if (!v) return;
    const o = retrato(v);
    if (API === null) await carregarLoja(true);
    if (!usaBanco()) { enviaWhats(o); guardaCliente(v); return; }
    enviando = true;
    submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true'); modoEnvio();
    chaveEnvio = chaveEnvio || novaChave();
    try {
      // entrega: a rua precisa existir no mapa e ficar dentro da área (o servidor confere de novo ao gravar)
      if (o.mod === 'entrega') {
        const g = await confereEnd();
        if (g.estado === 'nao' || g.estado === 'fora' || g.estado === 'erro') {
          if (g.estado !== 'erro') { form.rua.setAttribute('aria-invalid', 'true'); form.rua.focus(); }
          mostraErro(g.estado === 'fora' ? { code: 'fora_da_area', detalhe: `${g.km}|${g.raio}` } : { code: g.estado === 'nao' ? 'endereco_nao_encontrado' : 'mapa_indisponivel' }, o);
          return;
        }
      }
      const r = await api('pedido', { p: {
        chave: chaveEnvio, nome: v.nome, telefone: v.tel, modalidade: o.mod, endereco: v.end || null, endereco_partes: v.partes, pagamento: v.pag,
        troco_para_centavos: v.troco, observacao: v.obs, sabores: o.sabores, itens: cart.map(i => ({ id: i.id, qtd: i.qtd })), teste: TESTE,
      } });
      guardaPedido(r); guardaCliente(v);
      feito = { ...o, ...r };
      cart = []; chaveEnvio = null; save();
      form.reset(); preenchido = false; geo = { chave: '', estado: '' }; syncModalidade(); syncPagamento();
      mostraFeito(feito);
    } catch (err) {
      mostraErro(err, o);
    } finally {
      enviando = false;
      submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); modoEnvio();
    }
  });

  // tela de pedido confirmado: número, resumo e o link para acompanhar
  function mostraFeito(p) {
    const box = $('[data-done]', dlg);
    const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
    box.innerHTML = '';
    const badge = el('span', 'done-badge'); badge.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-check"/></svg>';
    const h = el('h3'); h.id = 'done-h'; h.append('Pedido ', el('b', null, `nº ${p.numero}`), ' recebido');
    const sub = el('p', 'done-sub', p.repetido
      ? 'Esse pedido já tinha chegado: é o mesmo, não foi duplicado.'
      : 'Seu pedido já está com a Coxitas. Guarde o número: é por ele que a loja te atende.');
    const caixa = el('div', 'done-box');
    const ul = el('ul');
    p.itens.forEach(i => { const li = el('li'); li.append(el('span', null, `${i.qtd}x ${i.nome} · ${i.detalhe}`), el('span', null, fmt(i.preco * i.qtd))); ul.appendChild(li); });
    const meta = el('div', 'done-meta');
    const linha = (rot, val) => { const d = el('p'); d.append(`${rot}: `, el('b', null, val)); meta.appendChild(d); };
    linha('Total', `${fmt(p.total_centavos)}${p.mod === 'entrega' && p.taxa_entrega_centavos == null ? ' + entrega (a combinar)' : ''}`);
    linha('Recebimento', p.mod === 'retirada' ? 'retirada na loja' : 'entrega');
    linha('Pagamento', `${p.pag}${p.troco ? ` (troco para ${fmt(p.troco)})` : ''}`);
    if (p.sabores.length) linha('Sabores', p.sabores.join(', '));
    caixa.append(ul, meta);
    const acoes = el('div', 'done-actions');
    const acomp = el('a', 'btn btn-lg', 'Acompanhar o pedido');
    acomp.href = `pedido/?n=${encodeURIComponent(p.numero)}&c=${encodeURIComponent(p.codigo)}`;
    const zap = el('a', 'btn btn-lg btn-wa');
    zap.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-wa"/></svg>';
    zap.append('Avisar a Coxitas no WhatsApp');
    zap.href = waURL(pedidoTexto(p, p.numero)); zap.target = '_blank'; zap.rel = 'noopener';
    const outro = el('button', 'link-btn', 'Fazer outro pedido'); outro.type = 'button';
    outro.addEventListener('click', () => { feito = null; render(); closeDlg(dlg, () => { const c = document.getElementById('cardapio'); if (c) c.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }); }); });
    acoes.append(acomp, zap, outro);
    const nota = el('p', 'done-note', TESTE
      ? 'Pedido de teste (feito no computador de desenvolvimento ou com ?teste=1): no painel ele só aparece com "Mostrar testes".'
      : 'A Coxitas confirma o pedido com você pelo telefone ou WhatsApp que você deixou.');
    box.append(badge, h, sub, caixa, acoes, nota);
    render();
    $('.drawer-body', dlg).scrollTop = 0;
    box.focus({ preventScroll: true });
    say(`Pedido número ${p.numero} recebido.`);
  }
  dlg.addEventListener('close', () => { if (feito) { feito = null; render(); confereVivo(); } });

  /* ---------- pedido em andamento: aviso no topo para voltar ao acompanhamento ----------
     Enquanto o último pedido feito neste aparelho não foi entregue, um cartão fica no topo do site com o andamento;
     um toque abre a página do pedido. Some quando o pedido é cancelado, ou 40 minutos depois de entregue. */
  const vivo = $('[data-vivo]');
  const ST_VIVO = { novo: 'Recebido pela Coxitas', confirmado: 'Pedido confirmado', em_preparo: 'Sendo preparado agora', saiu_entrega: 'Saiu para entrega', pronto_retirada: 'Pronto para retirar', concluido: 'Entregue. Bom apetite!' };
  const PASSO_VIVO = { novo: 0, confirmado: 1, em_preparo: 2, saiu_entrega: 3, pronto_retirada: 3, concluido: 4 };
  let tVivo = 0, vivoAgora = '';
  const meusPedidos = () => { try { return JSON.parse(localStorage.getItem('cx-meus-pedidos') || '[]').filter(x => x && x.n && /^[0-9a-f]{32}$/.test(x.c || '')); } catch (e) { return []; } };
  function escondeVivo(depois) {
    clearTimeout(tVivo);
    vivo.classList.remove('show'); vivo.hidden = true;
    if (depois) tVivo = setTimeout(confereVivo, depois);
  }
  async function confereVivo() {
    clearTimeout(tVivo);
    const ult = meusPedidos()[0];
    if (!ult || (ult.t && Date.now() - new Date(ult.t).getTime() > 18 * 3600e3)) return escondeVivo();
    let p;
    try { p = await api('acompanhar', { numero: String(ult.n), codigo: ult.c }); }
    catch (e) { return e && (e.status === 404 || e.status === 405 || e.status === 503) ? escondeVivo() : escondeVivo(120000); }
    if (!p || p.erro) return escondeVivo();
    const cancelado = p.status === 'cancelado', fim = p.status === 'concluido' || cancelado;
    const desde = Date.now() - new Date(p.atualizado_em || p.criado_em).getTime();
    if (fim && desde > (cancelado ? 3 * 3600e3 : 40 * 60000)) return escondeVivo();
    vivoAgora = `${p.numero}|${p.status}`;
    avisaMudanca(p);
    let fechado = ''; try { fechado = sessionStorage.getItem('cx-vivo-fechado') || ''; } catch (e) {}
    if (fechado === vivoAgora) return escondeVivo(fim ? 0 : 60000);   // a pessoa escondeu: volta quando o status mudar
    const st = cancelado ? 'Pedido cancelado · toque para ver' : fim && p.modalidade === 'retirada' ? 'Retirado. Bom apetite!' : ST_VIVO[p.status] || 'Acompanhe o seu pedido';
    const link = $('[data-vivo-link]', vivo);
    link.href = `pedido/?n=${encodeURIComponent(p.numero)}&c=${encodeURIComponent(ult.c)}`;
    link.setAttribute('aria-label', `Pedido nº ${p.numero}: ${st}. Abrir o acompanhamento.`);
    $('[data-vivo-num]', vivo).textContent = `Seu pedido nº ${p.numero}`;
    $('[data-vivo-st]', vivo).textContent = st;
    $('.vivo-ico use', vivo).setAttribute('href', cancelado ? '#i-close' : fim ? '#i-check' : p.modalidade === 'retirada' ? '#i-bag' : '#i-moto');
    const passo = PASSO_VIVO[p.status] || 0;
    $$('.vivo-passos i', vivo).forEach((i, k) => { i.className = fim || k < passo ? 'ok' : k === passo ? 'atual' : ''; });
    vivo.classList.toggle('fim', fim && !cancelado);
    vivo.classList.toggle('cancelado', cancelado);
    if (vivo.hidden) { vivo.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => vivo.classList.add('show'))); }
    if (!fim) tVivo = setTimeout(confereVivo, document.hidden ? 60000 : 20000);
  }
  // mudou a etapa desde a última vez que este aparelho viu? toca (recusado toca forte) e avisa no celular
  let somCtx = null;
  addEventListener('pointerdown', () => { try { somCtx = somCtx || new (window.AudioContext || window.webkitAudioContext)(); if (somCtx.state === 'suspended') somCtx.resume(); } catch (e) {} }, { passive: true });
  function toca(notas) {
    if (!somCtx || somCtx.state !== 'running') return;
    const t0 = somCtx.currentTime;
    notas.forEach(([f, dt, dur, tipo]) => {
      const o = somCtx.createOscillator(), g = somCtx.createGain();
      o.type = tipo || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.5, t0 + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + dur);
      o.connect(g).connect(somCtx.destination); o.start(t0 + dt); o.stop(t0 + dt + dur + 0.02);
    });
  }
  function avisaMudanca(p) {
    let visto = ''; try { visto = localStorage.getItem('cx-vivo-visto') || ''; } catch (e) {}
    const agora = `${p.numero}|${p.status}`;
    if (visto === agora) return;
    try { localStorage.setItem('cx-vivo-visto', agora); } catch (e) {}
    if (!visto.startsWith(`${p.numero}|`)) return;   // primeira vez que vê este pedido: sem barulho
    try { sessionStorage.removeItem('cx-vivo-fechado'); } catch (e) {}
    const cancel = p.status === 'cancelado';
    if (cancel) toca([[880, 0, .22, 'square'], [660, .26, .22, 'square'], [880, .52, .22, 'square'], [660, .78, .35, 'square']]);
    else toca([[784, 0, .16], [1046, .17, .28]]);
    try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(cancel ? [300, 120, 300, 120, 500] : [120, 60, 120]); } catch (e) {}
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(cancel ? `Pedido nº ${p.numero} foi cancelado` : `Pedido nº ${p.numero}: ${ST_VIVO[p.status] || 'atualizado'}`,
          { body: cancel ? (p.motivo || 'Toque para ver os detalhes.') : 'Toque para acompanhar.', icon: 'assets/img/icon-192.png', tag: `cx-pedido-${p.numero}` });
      }
    } catch (e) {}
  }
  $('[data-vivo-x]', vivo).addEventListener('click', () => {
    try { sessionStorage.setItem('cx-vivo-fechado', vivoAgora); } catch (e) {}
    escondeVivo(/concluido$/.test(vivoAgora) ? 0 : 60000);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && meusPedidos().length) confereVivo(); });
  // depois que a página terminou de abrir (não atrapalha o carregamento)
  syncFechado();
  const vivoDepois = () => idle(() => setTimeout(() => { carregarLoja(); confereVivo(); }, 800));
  if (document.readyState === 'complete') vivoDepois(); else window.addEventListener('load', vivoDepois, { once: true });

  /* ---------- galeria: foto ampliada ---------- */
  const lb = $('#lightbox');
  const lbImg = $('img', lb);
  const shots = $$('.grid-gal .shot');
  let lbI = 0;
  function showShot(i) {
    lbI = (i + shots.length) % shots.length;
    const s = shots[lbI];
    lbImg.src = s.dataset.full;
    lbImg.alt = $('img', s).alt;
    $('figcaption', lb).textContent = $('.shot-cap', s).textContent;
  }
  shots.forEach((s, i) => s.addEventListener('click', () => { showShot(i); openDlg(lb); }));
  $$('[data-lb]', lb).forEach(b => b.addEventListener('click', () => showShot(lbI + +b.dataset.lb)));
  lb.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') showShot(lbI + 1);
    if (e.key === 'ArrowLeft') showShot(lbI - 1);
  });

  /* ---------- animações: ligadas para todo mundo; o rodapé deixa desligar e religar ---------- */
  const motionBtn = $('#motionToggle');
  function syncMotionUI() {
    const r = reduced();
    motionBtn.textContent = r ? 'Ativar animações' : 'Reduzir animações';
    motionBtn.setAttribute('aria-pressed', String(r));
  }
  motionBtn.addEventListener('click', () => {
    const r = !reduced();
    try { localStorage.setItem('cx-anim', r ? 'off' : 'on'); } catch (e) {}
    root.classList.toggle('rm', r);
    syncMotionUI();
    if (r) $$('.rv, .split').forEach(el => el.classList.add('in'));
    vids.forEach(syncVideo);
    cxSync();
  });
  syncMotionUI();

  render();
  booted = true;
  requestAnimationFrame(onScroll);
})();
