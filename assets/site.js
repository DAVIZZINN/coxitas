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
  function situacao() {
    const { dia, min } = agora();
    const [abre, fecha] = LOJA.horarios[dia];
    if (min >= abre * 60 && min < fecha * 60) return { dia, aberto: true, texto: `Aberto agora · até ${fecha}h` };
    if (min < abre * 60) return { dia, aberto: false, texto: `Fechado agora · abre às ${abre}h` };
    return { dia, aberto: false, texto: `Fechado agora · abre amanhã às ${LOJA.horarios[(dia + 1) % 7][0]}h` };
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
    $$('.hours tr').forEach(tr => tr.classList.toggle('today', tr.dataset.days.split(',').includes(String(s.dia))));
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
        v.src = v.dataset.src + (VW >= 900 ? '-720.mp4' : phone && side ? '-360.mp4' : '-480.mp4');
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
    $('[data-empty]', dlg).hidden = n > 0;
    $$('[data-filled]', dlg).forEach(el => { el.hidden = n === 0; });
    $('[data-flav-pick]', dlg).hidden = !needsFlavors();
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
  function openDlg(d) { if (d.open) return; d.classList.remove('closing'); d.showModal(); lock(true); }
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

  const openCart = () => { render(); openDlg(dlg); };
  $$('[data-open-cart]').forEach(b => b.addEventListener('click', openCart));
  orderCta.addEventListener('click', e => { if (count() > 0) { e.preventDefault(); setMenu(false); openCart(); } });
  $('[data-clear]', dlg).addEventListener('click', () => {
    cart = []; save(); form.reset(); render(); say('Pedido limpo.');
    $('[data-close]', dlg).focus();
  });

  // a mensagem que chega no WhatsApp da Coxitas
  function pedidoTexto() {
    const L = ['Olá, Coxitas! Quero fazer um pedido pelo site:', ''];
    items().forEach(i => {
      L.push(`• ${i.qtd}x ${i.nome}: ${fmtTxt(i.preco * i.qtd)}`);
      L.push(`   ${i.detalhe}${i.qtd > 1 ? ` (${fmtTxt(i.preco)} cada)` : ''}`);
    });
    const sabores = $$('input[name=sabor]:checked', form).map(c => c.value);
    if (sabores.length && needsFlavors()) L.push('', `Sabores preferidos: ${sabores.join(', ')}`);
    L.push('', `*Total dos itens: ${fmtTxt(total())}*`);
    const nome = form.nome.value.trim(), end = form.endereco.value.trim(), obs = form.obs.value.trim();
    if (nome || end || obs) L.push('');
    if (nome) L.push(`Nome: ${nome}`);
    if (end) L.push(`Endereço de entrega: ${end}`);
    if (obs) L.push(`Observação: ${obs}`);
    return L.join('\n');
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!count()) return;
    const url = waURL(pedidoTexto());
    $('[data-sent-link]', dlg).href = url;
    sent.hidden = false;
    window.open(url, '_blank', 'noopener');
  });

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
