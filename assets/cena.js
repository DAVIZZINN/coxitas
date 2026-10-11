/* Coxitas · cena animada do acompanhamento: o mascote (uma coxinha) mostra a etapa do pedido.
   Recebido: toca o sininho. Confirmado: joinha. Em preparo: de chapéu de chef, fritando as coxinhas.
   Pronto para retirar: fechando a caixa. Saiu para entrega: de capacete na motinha pela cidade.
   Entregue: coração e confete. Cancelado: chuvinha. Tudo SVG + CSS (assets/pedido.css), sem imagem nem biblioteca. */
(() => {
  'use strict';
  const DEFS = `<defs>
    <linearGradient id="cxMassa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC75A"/><stop offset=".55" stop-color="#F2992E"/><stop offset="1" stop-color="#D9701C"/></linearGradient>
    <linearGradient id="cxOleo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7C04A"/><stop offset="1" stop-color="#C77A16"/></linearGradient>
    <linearGradient id="cxCeu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A160B"/><stop offset="1" stop-color="#1A0D06"/></linearGradient>
    <radialGradient id="cxLuz" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#F7B53D" stop-opacity=".35"/><stop offset="1" stop-color="#F7B53D" stop-opacity="0"/></radialGradient>
  </defs>`;

  // o mascote, centrado em (0,0), uns 100 px de altura
  function mascote({ humor = 'feliz', chapeu = false, capacete = false, bracos = '' } = {}) {
    const boca = humor === 'triste'
      ? '<path d="M-7 27 Q0 20 7 27" fill="none" stroke="#5A260C" stroke-width="2.6" stroke-linecap="round"/>'
      : '<path d="M-9 19 Q0 29 9 19" fill="#8A3412" stroke="#5A260C" stroke-width="2.2" stroke-linejoin="round"/><path d="M-4.5 23.5 Q0 26.5 4.5 23.5" fill="#FF8A65"/>';
    const olhos = humor === 'triste'
      ? '<path d="M-17 2 Q-11 -1 -5 2" fill="none" stroke="#5A260C" stroke-width="2" stroke-linecap="round"/><path d="M5 2 Q11 -1 17 2" fill="none" stroke="#5A260C" stroke-width="2" stroke-linecap="round"/><ellipse cx="-11" cy="9" rx="5" ry="5.5" fill="#fff"/><ellipse cx="11" cy="9" rx="5" ry="5.5" fill="#fff"/><circle cx="-10.5" cy="10.5" r="2.8" fill="#2A1306"/><circle cx="11.5" cy="10.5" r="2.8" fill="#2A1306"/>'
      : '<g class="cx-pisca"><ellipse cx="-11" cy="7" rx="6" ry="7" fill="#fff"/><ellipse cx="11" cy="7" rx="6" ry="7" fill="#fff"/><circle cx="-10" cy="8" r="3.4" fill="#2A1306"/><circle cx="12" cy="8" r="3.4" fill="#2A1306"/><circle cx="-8.8" cy="6.6" r="1.2" fill="#fff"/><circle cx="13.2" cy="6.6" r="1.2" fill="#fff"/></g>';
    const topo = chapeu
      ? '<g class="cx-chapeu"><rect x="-17" y="-52" width="34" height="9" rx="3" fill="#FFF7EA" stroke="#E9D7BF" stroke-width="1.5"/><circle cx="-11" cy="-58" r="9" fill="#FFF7EA"/><circle cx="0" cy="-63" r="10.5" fill="#FFF7EA"/><circle cx="11" cy="-58" r="9" fill="#FFF7EA"/></g>'
      : capacete
        ? '<path d="M-29 -18 C-29 -48 29 -48 29 -18 Z" fill="#E8604A" stroke="#B8432F" stroke-width="2"/><path d="M-22 -22 C-18 -36 10 -40 22 -26 L22 -20 L-22 -20 Z" fill="#7FB4FF" opacity=".55"/><rect x="-31" y="-20" width="62" height="6" rx="3" fill="#B8432F"/>'
        : '<path d="M-4 -47 Q0 -56 6 -50" fill="none" stroke="#7A3B12" stroke-width="2.4" stroke-linecap="round"/>';
    return `<g class="cx-mascote">
      <ellipse cx="0" cy="50" rx="30" ry="5" fill="#000" opacity=".28"/>
      ${bracos}
      <path d="M0 -48 C14 -31 35 -9 35 14 C35 35 18 47 0 47 C-18 47 -35 35 -35 14 C-35 -9 -14 -31 0 -48 Z" fill="url(#cxMassa)" stroke="#B8611B" stroke-width="2"/>
      <g fill="#C96A1E" opacity=".45"><circle cx="-20" cy="-4" r="1.6"/><circle cx="22" cy="30" r="1.8"/><circle cx="-24" cy="32" r="1.4"/><circle cx="16" cy="-14" r="1.3"/><circle cx="-6" cy="38" r="1.5"/><circle cx="26" cy="8" r="1.2"/></g>
      ${topo}${olhos}
      <ellipse cx="-21" cy="19" rx="5.5" ry="3.4" fill="#FF8A65" opacity=".55"/><ellipse cx="21" cy="19" rx="5.5" ry="3.4" fill="#FF8A65" opacity=".55"/>
      ${boca}
    </g>`;
  }
  const braco = (cls, d) => `<path class="${cls}" d="${d}" fill="none" stroke="#E08A2A" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  // no SVG a animação (CSS transform) apaga o transform do elemento: a posição fica num grupo de fora e a animação no de dentro
  const em = (pos, cls, dentro) => `<g transform="${pos}"><g class="${cls}">${dentro}</g></g>`;
  const coxinha = (x, y, s = 1, cls = '') => em(`translate(${x} ${y}) scale(${s})`, cls, '<path d="M0 -14 C5 -9 11 -3 11 4 C11 10 6 14 0 14 C-6 14 -11 10 -11 4 C-11 -3 -5 -9 0 -14 Z" fill="url(#cxMassa)" stroke="#B8611B" stroke-width="1.4"/>');
  const brilho = (x, y, cls = 'cx-brilho') => em(`translate(${x} ${y})`, cls, '<path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" fill="#F7B53D"/>');

  const CENAS = {
    novo: () => `
      <circle cx="160" cy="92" r="80" fill="url(#cxLuz)"/>
      <g transform="translate(222 62)"><g class="cx-sino">
        <path d="M0 -26 C-14 -26 -20 -14 -20 0 L-20 10 L-26 18 L26 18 L20 10 L20 0 C20 -14 14 -26 0 -26 Z" fill="#F7B53D" stroke="#B87A12" stroke-width="2"/>
        <circle cx="0" cy="23" r="5" fill="#B87A12"/><rect x="-3" y="-32" width="6" height="7" rx="2" fill="#B87A12"/>
      </g></g>
      <g class="cx-ondas" fill="none" stroke="#F7B53D" stroke-width="2.5" stroke-linecap="round"><path d="M254 40 q8 8 0 16"/><path d="M262 34 q13 14 0 28"/><path d="M190 40 q-8 8 0 16"/><path d="M182 34 q-13 14 0 28"/></g>
      <g transform="translate(112 102)"><g class="cx-pula">${mascote({ bracos: braco('cx-aceno', 'M28 8 Q44 -6 46 -22') + braco('', 'M-28 10 Q-38 22 -32 32') })}</g></g>`,
    confirmado: () => `
      <circle cx="160" cy="92" r="80" fill="url(#cxLuz)"/>
      <g transform="translate(226 64)"><g class="cx-pop"><circle r="24" fill="#4CD08A"/><path d="M-11 0 l7 7 l15 -15" fill="none" stroke="#0D2E1C" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g></g>
      ${brilho(258, 36)}${brilho(196, 40, 'cx-brilho b2')}${brilho(250, 100, 'cx-brilho b3')}
      <g transform="translate(118 102)"><g class="cx-pula">${mascote({ bracos: braco('', 'M28 8 Q42 0 44 -12') + '<g transform="translate(46 -18)"><g class="cx-joia"><rect x="-6" y="-4" width="12" height="11" rx="4" fill="#E08A2A"/><rect x="-3" y="-14" width="6" height="12" rx="3" fill="#E08A2A"/></g></g>' + braco('', 'M-28 10 Q-38 22 -32 32') })}</g></g>`,
    em_preparo: () => `
      <circle cx="160" cy="96" r="84" fill="url(#cxLuz)"/>
      <g class="cx-vapor" fill="none" stroke="#FFF1DE" stroke-width="3" stroke-linecap="round" opacity=".5"><path class="v1" d="M206 74 q-6 -10 0 -20 q6 -10 0 -20"/><path class="v2" d="M232 70 q-6 -10 0 -20 q6 -10 0 -20"/><path class="v3" d="M258 74 q-6 -10 0 -20 q6 -10 0 -20"/></g>
      <g transform="translate(0 0)">
        <rect x="186" y="86" width="96" height="58" rx="12" fill="#3A3330" stroke="#1E1A18" stroke-width="2"/>
        <rect x="174" y="84" width="120" height="10" rx="5" fill="#57504C"/>
        <ellipse cx="234" cy="89" rx="54" ry="7" fill="url(#cxOleo)"/>
        ${coxinha(212, 84, .85, 'cx-frita f1')}${coxinha(236, 82, .9, 'cx-frita f2')}${coxinha(258, 85, .8, 'cx-frita f3')}
        <g class="cx-bolhas" fill="#FFE29A"><circle class="b1" cx="200" cy="90" r="2.4"/><circle class="b2" cx="226" cy="91" r="2"/><circle class="b3" cx="248" cy="90" r="2.6"/><circle class="b4" cx="270" cy="91" r="2"/></g>
        <rect x="282" y="104" width="22" height="7" rx="3.5" fill="#1E1A18"/>
        <rect x="200" y="144" width="70" height="8" rx="4" fill="#000" opacity=".25"/>
      </g>
      <g transform="translate(110 100)">${mascote({ chapeu: true, bracos: '<g class="cx-mexe">' + braco('', 'M28 6 Q48 -4 66 -12') + '<path d="M60 -15 L100 -3" stroke="#9C9389" stroke-width="5" stroke-linecap="round"/><path d="M97 -8 L113 -3 L110 7 L94 2 Z" fill="#C7BFB6" stroke="#8A837C" stroke-width="1.2"/></g>' + braco('', 'M-28 10 Q-38 22 -32 32') })}</g>`,
    pronto_retirada: () => `
      <circle cx="160" cy="96" r="84" fill="url(#cxLuz)"/>
      <g transform="translate(232 112)">
        <path d="M-40 -6 L40 -6 L34 34 L-34 34 Z" fill="#C98B4E" stroke="#8C5A2B" stroke-width="2"/>
        ${coxinha(-16, -10, .9, 'cx-cai c1')}${coxinha(4, -12, .95, 'cx-cai c2')}${coxinha(22, -9, .85, 'cx-cai c3')}
        <path class="cx-tampa t1" d="M-40 -6 L-6 -6 L-14 -30 L-46 -24 Z" fill="#D9A066" stroke="#8C5A2B" stroke-width="2"/>
        <path class="cx-tampa t2" d="M40 -6 L6 -6 L14 -30 L46 -24 Z" fill="#D9A066" stroke="#8C5A2B" stroke-width="2"/>
        <circle cx="0" cy="14" r="10" fill="#F2782A"/><text x="0" y="18.5" text-anchor="middle" font-size="13" font-weight="800" fill="#1A0C05" font-family="Figtree,system-ui,sans-serif">C</text>
      </g>
      ${brilho(276, 52)}${brilho(190, 58, 'cx-brilho b2')}
      <g transform="translate(118 102)"><g class="cx-pula">${mascote({ bracos: braco('', 'M28 8 Q50 6 66 -2') + braco('', 'M-28 10 Q-38 22 -32 32') })}</g></g>`,
    saiu_entrega: () => `
      <rect x="0" y="0" width="320" height="180" fill="url(#cxCeu)"/>
      <circle cx="262" cy="36" r="14" fill="#FFF1DE" opacity=".85"/><circle cx="268" cy="32" r="12" fill="#2A160B"/>
      <g class="cx-cidade" fill="#3A2214">
        <g><rect x="0" y="70" width="34" height="70"/><rect x="38" y="52" width="26" height="88"/><rect x="68" y="80" width="40" height="60"/><rect x="112" y="60" width="22" height="80"/><rect x="138" y="90" width="44" height="50"/><rect x="186" y="66" width="30" height="74"/><rect x="220" y="84" width="46" height="56"/><rect x="270" y="58" width="24" height="82"/><rect x="298" y="76" width="22" height="64"/></g>
        <g transform="translate(320 0)"><rect x="0" y="70" width="34" height="70"/><rect x="38" y="52" width="26" height="88"/><rect x="68" y="80" width="40" height="60"/><rect x="112" y="60" width="22" height="80"/><rect x="138" y="90" width="44" height="50"/><rect x="186" y="66" width="30" height="74"/><rect x="220" y="84" width="46" height="56"/><rect x="270" y="58" width="24" height="82"/><rect x="298" y="76" width="22" height="64"/></g>
      </g>
      <g class="cx-cidade" fill="#F7B53D" opacity=".55"><g><rect x="44" y="64" width="4" height="5"/><rect x="54" y="80" width="4" height="5"/><rect x="118" y="72" width="4" height="5"/><rect x="194" y="78" width="4" height="5"/><rect x="278" y="70" width="4" height="5"/></g><g transform="translate(320 0)"><rect x="44" y="64" width="4" height="5"/><rect x="54" y="80" width="4" height="5"/><rect x="118" y="72" width="4" height="5"/><rect x="194" y="78" width="4" height="5"/><rect x="278" y="70" width="4" height="5"/></g></g>
      <rect x="0" y="140" width="320" height="40" fill="#120905"/>
      <g class="cx-faixa" stroke="#F7B53D" stroke-width="3" stroke-dasharray="18 16" opacity=".6"><path d="M0 162 H660"/></g>
      <g class="cx-vento" stroke="#FFF1DE" stroke-width="2.5" stroke-linecap="round" opacity=".45"><path d="M58 96 h-30"/><path d="M66 112 h-40"/><path d="M60 128 h-26"/></g>
      <g transform="translate(150 118)"><g class="cx-moto">
        <g transform="translate(-44 26)"><g class="cx-roda"><circle r="15" fill="#1E1A18"/><circle r="8" fill="#57504C"/><path d="M-8 0 H8 M0 -8 V8" stroke="#9C9389" stroke-width="2"/></g></g>
        <g transform="translate(48 26)"><g class="cx-roda"><circle r="15" fill="#1E1A18"/><circle r="8" fill="#57504C"/><path d="M-8 0 H8 M0 -8 V8" stroke="#9C9389" stroke-width="2"/></g></g>
        <rect x="-74" y="-30" width="36" height="32" rx="5" fill="#F2782A" stroke="#B4541A" stroke-width="2"/><circle cx="-56" cy="-14" r="8" fill="#1A0C05"/><text x="-56" y="-10" text-anchor="middle" font-size="10" font-weight="800" fill="#F7B53D" font-family="Figtree,system-ui,sans-serif">C</text>
        <path d="M-50 6 L-30 -4 L30 -4 L52 10 L40 22 L-40 22 Z" fill="#E8604A" stroke="#B8432F" stroke-width="2"/>
        <rect x="-22" y="-9" width="34" height="8" rx="4" fill="#3A3330"/>
        <path d="M34 -4 L46 -26 L54 -26" fill="none" stroke="#3A3330" stroke-width="5" stroke-linecap="round"/>
        <circle cx="56" cy="-2" r="5" fill="#FFF1DE"/><path class="cx-farol" d="M60 -6 L96 -18 L96 14 L60 2 Z" fill="#FFF1DE" opacity=".18"/>
      </g></g>
      <g transform="translate(150 84) scale(.6)"><g class="cx-moto">${mascote({ capacete: true, bracos: braco('', 'M26 12 Q52 18 70 4') })}</g></g>`,
    concluido: () => `
      <circle cx="160" cy="92" r="80" fill="url(#cxLuz)"/>
      <g class="cx-confete">${[[60, '#F2782A'], [96, '#4CD08A'], [130, '#7FB4FF'], [190, '#F7B53D'], [226, '#E8604A'], [262, '#B48CFF'], [80, '#F7B53D'], [244, '#4CD08A']].map(([x, c], i) => `<rect class="k${i}" x="${x}" y="-10" width="7" height="11" rx="2" fill="${c}"/>`).join('')}</g>
      <g transform="translate(212 52)"><g class="cx-coracao"><path d="M0 12 C-18 0 -16 -14 -6 -14 C-2 -14 0 -10 0 -8 C0 -10 2 -14 6 -14 C16 -14 18 0 0 12 Z" fill="#E8604A"/></g></g>
      <g transform="translate(150 102)"><g class="cx-pula">${mascote({ bracos: braco('cx-aceno', 'M28 6 Q46 -8 48 -24') + braco('cx-aceno b', 'M-28 6 Q-46 -8 -48 -24') })}</g></g>`,
    cancelado: () => `
      <g transform="translate(160 40)"><g class="cx-nuvem"><circle cx="-22" cy="4" r="16" fill="#57504C"/><circle cx="0" cy="-4" r="20" fill="#6A625D"/><circle cx="24" cy="4" r="15" fill="#57504C"/><rect x="-36" y="4" width="74" height="14" rx="7" fill="#57504C"/></g></g>
      <g class="cx-chuva" stroke="#7FB4FF" stroke-width="2.4" stroke-linecap="round" opacity=".8"><path class="g1" d="M140 64 v8"/><path class="g2" d="M156 66 v8"/><path class="g3" d="M172 62 v8"/><path class="g4" d="M186 66 v8"/></g>
      <g transform="translate(160 118) scale(.82)">${mascote({ humor: 'triste', bracos: braco('', 'M26 14 Q36 26 30 36') + braco('', 'M-26 14 Q-36 26 -30 36') })}</g>`,
  };

  function desenha(el, status, modalidade) {
    const chave = `${status}|${modalidade}`;
    if (el.dataset.cena === chave) return;
    el.dataset.cena = chave;
    const fn = CENAS[status === 'concluido' || status === 'cancelado' ? status : status] || CENAS.novo;
    el.innerHTML = `<svg viewBox="0 0 320 180" role="img" aria-hidden="true" class="cx-cena cx-${status}">${DEFS}${fn(modalidade)}</svg>`;
  }
  window.CxCena = { desenha };
})();
