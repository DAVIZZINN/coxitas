/* Coxitas · gráficos do painel (SVG à mão, sem biblioteca: a CSP do painel só deixa rodar código daqui).
   Regras: uma medida por gráfico (nunca dois eixos), barras de até 24 px com ponta arredondada e base reta, 2 px de
   respiro entre barras, grade fininha, texto sempre na cor do texto (a cor da marca fica só nas barras), dica ao passar
   o mouse ou o dedo, e a tabela com os números embaixo de cada gráfico ("Ver os números"). */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, at = {}) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };

  // eixo com números redondos (0 / 50 / 100...)
  function escala(max, passos = 4) {
    if (!(max > 0)) return { topo: 1, ticks: [0, 1] };
    const bruto = max / passos, mag = 10 ** Math.floor(Math.log10(bruto));
    const passo = [1, 2, 2.5, 5, 10].map(m => m * mag).find(p => p >= bruto);
    const topo = Math.ceil(max / passo) * passo;
    const ticks = []; for (let v = 0; v <= topo + 1e-9; v += passo) ticks.push(+v.toFixed(6));
    return { topo, ticks };
  }
  // barra com ponta arredondada (4 px) e base reta
  function barraV(x, y, w, h, r = 4) {
    r = Math.min(r, w / 2, h);
    return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
  }
  function barraH(x, y, w, h, r = 4) {
    r = Math.min(r, h / 2, w);
    return `M${x} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x}Z`;
  }

  // dica que segue o mouse/dedo dentro do cartão do gráfico
  function dica(caixa) {
    let d = caixa.querySelector('.g-dica');
    if (!d) { d = el('div', 'g-dica'); d.setAttribute('role', 'status'); d.hidden = true; caixa.appendChild(d); }
    return {
      mostra(linhas, ev) {
        d.innerHTML = '';
        linhas.forEach(([rot, val], i) => { const p = el('p', i ? '' : 'g-dica-t'); if (val != null) { p.append(el('span', null, rot), el('b', null, val)); } else p.textContent = rot; d.appendChild(p); });
        d.hidden = false;
        const r = caixa.getBoundingClientRect(), dw = d.offsetWidth, dh = d.offsetHeight;
        let x = ev.clientX - r.left + 14, y = ev.clientY - r.top - dh - 10;
        if (x + dw > r.width - 6) x = ev.clientX - r.left - dw - 14;
        if (y < 4) y = ev.clientY - r.top + 16;
        d.style.transform = `translate(${Math.max(4, x)}px, ${y}px)`;
      },
      esconde() { d.hidden = true; },
    };
  }

  function tabela(caixa, cab, linhas) {
    let det = caixa.querySelector('.g-tabela');
    if (det) det.remove();
    det = el('details', 'g-tabela');
    det.appendChild(el('summary', null, 'Ver os números'));
    const t = el('table'), th = el('tr');
    cab.forEach(c => th.appendChild(el('th', null, c)));
    const thead = el('thead'); thead.appendChild(th); t.appendChild(thead);
    const tb = el('tbody');
    linhas.forEach(l => { const tr = el('tr'); l.forEach(c => tr.appendChild(el('td', null, c))); tb.appendChild(tr); });
    t.appendChild(tb); det.appendChild(t); caixa.appendChild(det);
  }

  /* colunas: [{ rot, valor, dica: [[rótulo, valor]...] }]; opts.fmt = formato do eixo; opts.rotA = mostrar 1 a cada N rótulos */
  function colunas(alvo, dados, opts = {}) {
    const caixa = alvo.closest('.g-card') || alvo.parentElement;
    alvo.innerHTML = '';
    const W = Math.max(280, alvo.clientWidth || 600), H = opts.altura || 220;
    const m = { t: 12, r: 8, b: 26, l: 44 };
    const max = Math.max(0, ...dados.map(d => d.valor));
    if (!dados.length || max === 0) { alvo.appendChild(el('p', 'g-vazio', opts.vazio || 'Sem vendas no período.')); return; }
    const { topo, ticks } = escala(max);
    const fmt = opts.fmt || (v => String(v));
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': opts.titulo || '' });
    const ih = H - m.t - m.b, iw = W - m.l - m.r, y = v => m.t + ih - (v / topo) * ih;
    ticks.forEach(t => {
      s.appendChild(svg('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t ? 'g-grade' : 'g-base' }));
      const tx = svg('text', { x: m.l - 8, y: y(t) + 4, class: 'g-eixo', 'text-anchor': 'end' }); tx.textContent = fmt(t); s.appendChild(tx);
    });
    const slot = iw / dados.length, bw = Math.max(2, Math.min(24, slot - 2));
    const pula = opts.rotA || Math.max(1, Math.ceil(dados.length / Math.floor(iw / 38)));
    const tip = dica(caixa);
    let maior = 0; dados.forEach((d, i) => { if (d.valor > dados[maior].valor) maior = i; });
    dados.forEach((d, i) => {
      const x = m.l + slot * i + (slot - bw) / 2, h = Math.max(0, ih - (y(d.valor) - m.t));
      const g = svg('g', { class: 'g-col' });
      if (h > 0) g.appendChild(svg('path', { d: barraV(x, y(d.valor), bw, h), class: 'g-barra' }));
      // área de toque maior que a barra
      const alvoToque = svg('rect', { x: m.l + slot * i, y: m.t, width: slot, height: ih, class: 'g-toque' });
      g.appendChild(alvoToque);
      const mostra = ev => { g.classList.add('on'); tip.mostra(d.dica || [[d.rot], ['', fmt(d.valor)]], ev); };
      alvoToque.addEventListener('pointermove', mostra);
      alvoToque.addEventListener('pointerdown', mostra);
      alvoToque.addEventListener('pointerleave', () => { g.classList.remove('on'); tip.esconde(); });
      s.appendChild(g);
      if (i % pula === 0 || i === dados.length - 1 && dados.length <= 12) {
        const tx = svg('text', { x: m.l + slot * i + slot / 2, y: H - 8, class: 'g-eixo', 'text-anchor': 'middle' }); tx.textContent = d.rot; s.appendChild(tx);
      }
    });
    // o maior valor ganha o número na ponta (só ele: o resto fica na dica e na tabela)
    if (opts.marcaMaior !== false) {
      const d = dados[maior], x = m.l + slot * maior + slot / 2;
      const tx = svg('text', { x, y: y(d.valor) - 6, class: 'g-valor', 'text-anchor': x < m.l + 30 ? 'start' : x > W - 30 ? 'end' : 'middle' }); tx.textContent = fmt(d.valor); s.appendChild(tx);
    }
    alvo.appendChild(s);
    if (opts.tabela) tabela(caixa, opts.tabela.cab, opts.tabela.linhas);
  }

  /* barras deitadas (ranking): [{ rot, valor, extra }]; o número fica na ponta de cada barra (poucas linhas) */
  function barras(alvo, dados, opts = {}) {
    const caixa = alvo.closest('.g-card') || alvo.parentElement;
    alvo.innerHTML = '';
    if (!dados.length || !dados.some(d => d.valor > 0)) { alvo.appendChild(el('p', 'g-vazio', opts.vazio || 'Nada no período.')); return; }
    const max = Math.max(...dados.map(d => d.valor));
    const fmt = opts.fmt || (v => String(v));
    const lista = el('ol', 'g-rank');
    const tip = dica(caixa);
    dados.forEach(d => {
      const li = el('li');
      const nome = el('span', 'g-rank-rot', d.rot);
      const trilho = el('span', 'g-rank-trilho');
      const barra = el('i', 'g-rank-barra');
      barra.style.width = `${Math.max(1.5, (d.valor / max) * 100)}%`;
      trilho.appendChild(barra);
      const val = el('b', 'g-rank-val', fmt(d.valor));
      li.append(nome, trilho, val);
      if (d.extra) li.appendChild(el('small', 'g-rank-extra', d.extra));
      if (d.dica) {
        li.addEventListener('pointermove', ev => tip.mostra(d.dica, ev));
        li.addEventListener('pointerleave', () => tip.esconde());
      }
      lista.appendChild(li);
    });
    alvo.appendChild(lista);
    if (opts.tabela) tabela(caixa, opts.tabela.cab, opts.tabela.linhas);
  }

  /* mapa das entregas: a loja no centro, anéis de distância e um ponto por entrega (direção e distância reais) */
  function radar(alvo, pontos, loja, opts = {}) {
    const caixa = alvo.closest('.g-card') || alvo.parentElement;
    alvo.innerHTML = '';
    if (!pontos.length) { alvo.appendChild(el('p', 'g-vazio', 'Sem entregas com endereço conferido no período.')); return; }
    const [la, lo, raio] = loja;
    const kmX = 111.32 * Math.cos((la * Math.PI) / 180), kmY = 110.57;
    const pts = pontos.map(([lat, lng]) => ({ x: (lng - lo) * kmX, y: (la - lat) * kmY })).map(p => ({ ...p, d: Math.hypot(p.x, p.y) }));
    const alcance = Math.max(2, Math.min(+raio || 12, Math.ceil(Math.max(...pts.map(p => p.d)) + 0.5)));
    const S = 320, c = S / 2, k = (c - 24) / alcance;
    const s = svg('svg', { viewBox: `0 0 ${S} ${S}`, class: 'g-radar', role: 'img', 'aria-label': opts.titulo || 'Mapa das entregas' });
    const aneis = [1, 2, 4, 7, 12].filter(r => r <= alcance);
    if (!aneis.includes(alcance) && alcance - aneis[aneis.length - 1] > 1) aneis.push(alcance);
    aneis.forEach(r => {
      s.appendChild(svg('circle', { cx: c, cy: c, r: r * k, class: 'g-anel' }));
      // rótulo do anel na diagonal de cima à direita, longe das letras N/S/L/O
      const t = svg('text', { x: c + r * k * 0.71 + 3, y: c - r * k * 0.71 - 3, class: 'g-eixo' }); t.textContent = `${String(r).replace('.', ',')} km`; s.appendChild(t);
    });
    s.appendChild(svg('line', { x1: c, x2: c, y1: 8, y2: S - 8, class: 'g-grade' }));
    s.appendChild(svg('line', { y1: c, y2: c, x1: 8, x2: S - 8, class: 'g-grade' }));
    [['N', c, 18], ['S', c, S - 8], ['L', S - 10, c + 4], ['O', 10, c + 4]].forEach(([l, x, y]) => { const t = svg('text', { x, y, class: 'g-eixo', 'text-anchor': 'middle' }); t.textContent = l; s.appendChild(t); });
    pts.forEach(p => s.appendChild(svg('circle', { cx: c + p.x * k, cy: c + p.y * k, r: 4.5, class: 'g-ponto' })));
    s.appendChild(svg('circle', { cx: c, cy: c, r: 8, class: 'g-loja' }));
    const tl = svg('text', { x: c + 12, y: c + 16, class: 'g-valor' }); tl.textContent = 'Loja'; s.appendChild(tl);
    alvo.appendChild(s);
  }

  window.CxGraf = { colunas, barras, radar, escala };
})();
