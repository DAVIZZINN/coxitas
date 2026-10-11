/* Coxitas · acompanhar pedido. Mostra só o andamento e os itens: nada de telefone, endereço ou nome completo. */
(() => {
  'use strict';
  const WHATSAPP = '5517996433594';
  // o endereço oficial é o da Vercel (o link antigo do GitHub Pages leva para lá)
  if (/\.github\.io$/.test(location.hostname)) { location.replace('https://coxitas.vercel.app/pedido/' + location.search); return; }
  const $ = (s, r = document) => r.querySelector(s);
  // animações: as mesmas do site (quem desligou no rodapé do site fica sem aqui também)
  try { if (localStorage.getItem('cx-anim') === 'off') document.documentElement.classList.add('rm'); } catch (e) {}

  const NOME = { novo: 'Recebido', confirmado: 'Confirmado', em_preparo: 'Em preparo', saiu_entrega: 'Saiu para entrega', pronto_retirada: 'Pronto para retirada', concluido: 'Concluído', cancelado: 'Cancelado' };
  const MSG = {
    novo: 'A Coxitas recebeu o seu pedido e vai confirmar em instantes.',
    confirmado: 'Pedido confirmado! Logo ele entra no preparo.',
    em_preparo: 'Seu pedido está sendo preparado agora.',
    saiu_entrega: 'Seu pedido saiu para entrega. Logo chega aí!',
    pronto_retirada: 'Seu pedido está pronto. Pode vir buscar na loja.',
    concluido: m => (m === 'retirada' ? 'Pedido retirado. Bom apetite!' : 'Pedido entregue. Bom apetite!'),
    cancelado: 'Este pedido foi cancelado.',
  };
  const fmt = c => { const [r, d] = (Math.abs(c) / 100).toFixed(2).split('.'); return 'R$ ' + r.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
  const quando = iso => { const d = new Date(iso); return `${dia.format(d)} às ${hora.format(d)}`; };

  // API do próprio site (funções da Vercel): só devolve andamento e itens, nunca telefone ou endereço
  async function api(args) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    let r;
    try {
      r = await fetch('../api/publico/acompanhar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: ctl.signal });
    } catch (e) { throw { rede: true }; } finally { clearTimeout(t); }
    const body = await r.json().catch(() => null);
    if (!r.ok) throw { code: body && body.erro, status: r.status };
    return body;
  }

  const find = $('[data-find]'), ped = $('[data-ped]'), loading = $('[data-loading]');
  const findForm = $('[data-find-form]'), findErr = $('[data-find-err]'), findBtn = $('[data-find-btn]');
  let atual = null, timer = 0;

  function meus() { try { return JSON.parse(localStorage.getItem('cx-meus-pedidos') || '[]').filter(x => x && x.n && x.c); } catch (e) { return []; } }
  function guarda(p) {
    try {
      const l = meus().filter(x => x.n !== p.numero);
      l.unshift({ n: p.numero, c: p.codigo, t: p.criado_em });
      localStorage.setItem('cx-meus-pedidos', JSON.stringify(l.slice(0, 5)));
    } catch (e) {}
  }

  function mostraBusca(msg) {
    clearTimeout(timer);
    ped.hidden = true; loading.hidden = true; find.hidden = false;
    const l = meus(), lista = $('[data-mine-list]');
    lista.innerHTML = '';
    l.forEach(x => {
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = `?n=${encodeURIComponent(x.n)}&c=${encodeURIComponent(x.c)}`;
      const b = document.createElement('span'); b.textContent = x.t ? quando(x.t) : '';
      a.append(`Pedido nº ${x.n}`, b);
      li.appendChild(a); lista.appendChild(li);
    });
    $('[data-mine]').hidden = !l.length;
    if (msg) { findErr.textContent = msg; findErr.hidden = false; }
  }

  function el(tag, cls, txt) { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; }

  /* ---------- avisos: som, vibração e notificação quando o pedido muda ---------- */
  let som = null;
  const ligaSom = () => { try { som = som || new (window.AudioContext || window.webkitAudioContext)(); if (som.state === 'suspended') som.resume(); } catch (e) {} };
  addEventListener('pointerdown', ligaSom, { passive: true });
  function toca(notas) {
    if (!som || som.state !== 'running') return;
    const t0 = som.currentTime;
    notas.forEach(([f, dt, dur, tipo]) => {
      const o = som.createOscillator(), g = som.createGain();
      o.type = tipo || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.55, t0 + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + dur);
      o.connect(g).connect(som.destination); o.start(t0 + dt); o.stop(t0 + dt + dur + 0.02);
    });
  }
  const temNotif = 'Notification' in window;
  const btnAvisos = $('[data-avisos]');
  function syncAvisos() {
    const ok = temNotif && Notification.permission === 'granted';
    btnAvisos.setAttribute('aria-pressed', String(ok));
    btnAvisos.textContent = ok ? 'Avisos ligados neste aparelho' : temNotif && Notification.permission === 'denied' ? 'Avisos bloqueados no navegador (o som continua)' : 'Me avisar quando o pedido mudar';
  }
  btnAvisos.addEventListener('click', async () => {
    ligaSom();
    if (temNotif && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) {} }
    syncAvisos();
    toca([[784, 0, .14], [1046, .15, .24]]);
  });
  function avisa(p, antes) {
    const cancel = p.status === 'cancelado';
    if (cancel) toca([[880, 0, .22, 'square'], [660, .26, .22, 'square'], [880, .52, .22, 'square'], [660, .78, .22, 'square'], [880, 1.04, .4, 'square']]);
    else toca([[784, 0, .16], [1046, .17, .3]]);
    try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(cancel ? [300, 120, 300, 120, 600] : [120, 60, 120]); } catch (e) {}
    try {
      if (temNotif && Notification.permission === 'granted' && document.hidden) {
        new Notification(cancel ? `Pedido nº ${p.numero} foi cancelado` : `Pedido nº ${p.numero}: ${NOME[p.status]}`,
          { body: cancel ? (p.motivo ? `Motivo: ${p.motivo}` : 'Toque para ver.') : (typeof MSG[p.status] === 'function' ? MSG[p.status](p.modalidade) : MSG[p.status]), icon: '../assets/img/icon-192.png', tag: `cx-pedido-${p.numero}` });
      }
    } catch (e) {}
    if (cancel) { const c = $('[data-ped-cancel]'); c.classList.remove('alerta'); void c.offsetWidth; c.classList.add('alerta'); scrollTo({ top: 0, behavior: 'smooth' }); }
    if (antes) document.title = `• ${document.title}`;
  }

  function mostra(p) {
    const antes = atual && atual.numero === p.numero ? atual.status : null;
    atual = p;
    find.hidden = true; loading.hidden = true; ped.hidden = false;
    document.title = `Pedido nº ${p.numero} · ${NOME[p.status] || ''} · Coxitas`;
    $('[data-ped-num]').textContent = `nº ${p.numero}`;
    $('[data-ped-when]').textContent = `Feito em ${quando(p.criado_em)}${p.primeiro_nome ? ` · ${p.primeiro_nome}` : ''}${p.teste ? ' · teste' : ''}`;
    const st = $('[data-ped-st]');
    st.className = `st st-${p.status}`;
    st.textContent = p.status === 'concluido' ? (p.modalidade === 'retirada' ? 'Retirado' : 'Entregue') : NOME[p.status];
    const m = MSG[p.status];
    $('[data-ped-msg]').textContent = typeof m === 'function' ? m(p.modalidade) : m;
    $('[data-ped-cancel]').hidden = p.status !== 'cancelado';
    $('[data-ped-cancel] span').textContent = p.motivo
      ? `Este pedido foi cancelado. Motivo: ${p.motivo}. Se tiver dúvida, fale com a Coxitas pelo WhatsApp.`
      : 'Este pedido foi cancelado. Se tiver dúvida, fale com a Coxitas pelo WhatsApp.';
    if (window.CxCena) window.CxCena.desenha($('[data-cena]'), p.status, p.modalidade);
    btnAvisos.hidden = p.status === 'concluido' || p.status === 'cancelado';
    syncAvisos();
    // o aviso do site (cartão no topo) usa a mesma marca: assim ninguém toca duas vezes pela mesma mudança
    try { localStorage.setItem('cx-vivo-visto', `${p.numero}|${p.status}`); } catch (e) {}
    if (antes && antes !== p.status) avisa(p, antes);

    // linha do tempo: os passos do tipo de pedido, com o horário de cada um
    const passos = ['novo', 'confirmado', 'em_preparo', p.modalidade === 'retirada' ? 'pronto_retirada' : 'saiu_entrega', 'concluido'];
    const horas = {};
    (p.eventos || []).forEach(e => { horas[e.status] = e.criado_em; });
    const idx = passos.indexOf(p.status);
    const ol = $('[data-steps]');
    ol.innerHTML = '';
    ol.hidden = p.status === 'cancelado';
    passos.forEach((s, i) => {
      const li = el('li', i <= idx ? 'ok' : '');
      if (i === idx) { li.classList.add('atual'); li.setAttribute('aria-current', 'step'); }
      const dot = el('span', 'dot'); dot.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-check"/></svg>';
      const nome = s === 'concluido' ? (p.modalidade === 'retirada' ? 'Retirado' : 'Entregue') : NOME[s];
      const b = el('b', null, nome);
      const t = el('time', null, horas[s] ? hora.format(new Date(horas[s])) : '');
      if (horas[s]) t.dateTime = horas[s];
      li.append(dot, b, t);
      ol.appendChild(li);
    });

    const ul = $('[data-items]');
    ul.innerHTML = '';
    (p.itens || []).forEach(i => {
      const li = el('li');
      const a = el('span'); a.append(el('b', null, `${i.quantidade}x ${i.nome}`), ` · ${i.detalhe}`);
      li.append(a, el('span', 'num', fmt(i.total_centavos)));
      ul.appendChild(li);
    });
    if (p.sabores && p.sabores.length) { const li = el('li'); li.append(el('span', null, `Sabores: ${p.sabores.join(', ')}`)); ul.appendChild(li); }
    const dl = $('[data-tot]');
    dl.innerHTML = '';
    const linha = (rot, val, cls) => { const d = el('div', cls || ''); d.append(el('dt', null, rot), el('dd', null, val)); dl.appendChild(d); };
    linha('Itens', fmt(p.subtotal_centavos));
    linha(p.modalidade === 'retirada' ? 'Retirada na loja' : 'Entrega', p.modalidade === 'retirada' ? 'grátis' : p.taxa_entrega_centavos == null ? 'a combinar' : p.taxa_entrega_centavos === 0 ? 'grátis' : fmt(p.taxa_entrega_centavos));
    linha('Pagamento', p.pagamento);
    linha('Total', fmt(p.total_centavos) + (p.modalidade === 'entrega' && p.taxa_entrega_centavos == null ? ' + entrega' : ''), 'grand');

    $('[data-ped-wa]').href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Olá, Coxitas! Sobre o meu pedido nº ${p.numero}:`)}`;
    const fim = p.status === 'concluido' || p.status === 'cancelado';
    $('[data-ped-upd]').textContent = fim ? '' : `Esta página se atualiza sozinha. Última conferida às ${hora.format(new Date())}.`;
    clearTimeout(timer);
    if (!fim) timer = setTimeout(atualiza, document.hidden ? 45000 : 15000);
  }

  async function atualiza() {
    if (!atual) return;
    try {
      const p = await api({ numero: atual.numero, codigo: atual.codigo });
      if (p && !p.erro) mostra(p); else timer = setTimeout(atualiza, 30000);
    } catch (e) { timer = setTimeout(atualiza, 30000); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && atual) { clearTimeout(timer); atualiza(); } });

  // sem API ou sem banco ligado (site fora da Vercel): explica e manda falar no WhatsApp
  function semApi(err) {
    if (!err || !(err.status === 404 || err.status === 405 || err.status === 503)) return false;
    find.hidden = true; ped.hidden = true; loading.hidden = true;
    $('[data-sem-banco]').hidden = false;
    return true;
  }
  const ERRO = {
    nao_encontrado: 'Não achamos esse pedido. Confira o número e os 4 últimos dígitos do telefone.',
    muitas_tentativas: 'Muitas tentativas erradas para esse pedido. Tente de novo daqui a 1 hora ou fale com a Coxitas pelo WhatsApp.',
  };
  findForm.addEventListener('submit', async e => {
    e.preventDefault();
    findErr.hidden = true;
    const n = findForm.numero.value.replace(/\D/g, ''), f = findForm.final.value.replace(/\D/g, '');
    findForm.numero.toggleAttribute('aria-invalid', !n);
    findForm.final.toggleAttribute('aria-invalid', f.length !== 4);
    if (!n || f.length !== 4) { findErr.textContent = 'Preencha o número do pedido e os 4 últimos dígitos do telefone.'; findErr.hidden = false; return; }
    findBtn.setAttribute('aria-busy', 'true'); findBtn.disabled = true;
    try {
      const p = await api({ numero: n, final: f });
      if (p.erro) { findErr.textContent = ERRO[p.erro] || ERRO.nao_encontrado; findErr.hidden = false; return; }
      guarda(p);
      history.replaceState(null, '', `?n=${encodeURIComponent(p.numero)}&c=${encodeURIComponent(p.codigo)}`);
      mostra(p);
    } catch (err) {
      if (semApi(err)) return;
      findErr.textContent = err && err.rede ? 'Sem conexão agora. Tente de novo em instantes.' : err && err.code === 'muitas_tentativas' ? ERRO.muitas_tentativas : 'Não deu para consultar agora. Tente de novo em instantes.';
      findErr.hidden = false;
    } finally { findBtn.removeAttribute('aria-busy'); findBtn.disabled = false; }
  });
  $('[data-other]').addEventListener('click', () => { atual = null; history.replaceState(null, '', location.pathname); findForm.reset(); mostraBusca(); findForm.numero.focus(); });

  // começo: link com número e código abre direto; sem isso, mostra a busca
  const q = new URLSearchParams(location.search);
  const n = (q.get('n') || '').replace(/\D/g, ''), c = (q.get('c') || '').toLowerCase();
  // sem número no endereço: abre direto o último pedido feito neste aparelho (sem precisar digitar nada)
  const ultimo = !n ? meus()[0] : null;
  if (ultimo && /^[0-9a-f]{32}$/.test(ultimo.c)) history.replaceState(null, '', `?n=${encodeURIComponent(ultimo.n)}&c=${encodeURIComponent(ultimo.c)}`);
  const num = n || (ultimo ? String(ultimo.n) : ''), cod = n ? c : (ultimo ? ultimo.c : '');
  if (num && /^[0-9a-f]{32}$/.test(cod)) {
    loading.hidden = false;
    api({ numero: num, codigo: cod })
      .then(p => { if (p.erro) mostraBusca(ERRO[p.erro] || ERRO.nao_encontrado); else { guarda(p); mostra(p); } })
      .catch(err => semApi(err) || mostraBusca(err && err.rede ? 'Sem conexão agora. Tente de novo em instantes.' : 'Não deu para consultar agora.'));
  } else mostraBusca();
})();
