/* Coxitas · a coxinha em 3D. WebGL puro, sem bibliotecas: a forma, a casquinha e o recheio são desenhados por um shader. */
(function () {
  'use strict';

  // WebGL2: os laços do desenho têm limite vindo de fora (uniform), então o Chrome no Windows não precisa
  // desenrolar tudo ao traduzir para a placa de vídeo e a coxinha fica pronta bem mais rápido
  const VERT2 = `#version 300 es
in vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

  const FRAG = `
precision highp float;
STEPS_DECL
uniform vec2 uRes;
uniform vec3 uPos;      // posição da coxinha no mundo
uniform vec3 uRot;      // giro (y), inclinação (x) e balanço (z)
uniform float uScale;
uniform float uOpen;    // 0 fechada, 1 aberta ao meio

mat2 r2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
uniform sampler2D uNoise;
// ruído 3D lido de uma imagem pequena de ruído (uma leitura em vez de dezenas de contas):
// o canal verde é o vermelho deslocado (37,17), então cada leitura traz duas camadas vizinhas
float noise(vec3 x){vec3 p=floor(x);vec3 f=fract(x);f=f*f*(3.-2.*f);
  vec2 uv=p.xy+vec2(37.,17.)*p.z+f.xy;
  vec2 rg=TEX(uNoise,(uv+.5)/256.).rg;
  return mix(rg.x,rg.y,f.z);}
float smax(float a,float b,float k){float h=clamp(.5-.5*(b-a)/k,0.,1.);return mix(b,a,h)+k*h*(1.-h);}

// perfil de gota: uma bola embaixo e uma ponta arredondada em cima
float sdUC(vec2 p,float r1,float r2,float h){
  p.x=abs(p.x);float b=(r1-r2)/h;float a=sqrt(1.-b*b);float k=dot(p,vec2(-b,a));
  if(k<0.)return length(p)-r1;
  if(k>a*h)return length(p-vec2(0.,h))-r2;
  return dot(p,vec2(a,b))-r1;
}
// a coxinha inteira, em espaço próprio (y para cima). Sem ruído aqui: a forma fica leve para a placa de vídeo
float cox(vec3 p){
  float y=p.y+.16;
  float slim=1.+.2*smoothstep(.05,.8,y);           // cintura mais fina perto da ponta
  vec2 q=vec2(length(p.xz)*slim,y);
  float d=sdUC(q,.6,.075,.98)/slim;
  d=smax(d,-(p.y+.5),.14);                         // fundo achatado, de quem senta no prato
  d+=.009*sin(p.x*6.1+1.3)*sin(p.y*5.3+.4)*sin(p.z*5.7+2.1);   // nenhuma coxinha é perfeitinha
  return d;
}
// cada metade: anda para o lado e gira, mostrando o corte
vec3 halfLocal(vec3 p,float side){
  vec3 q=p-vec3(side*uOpen*.4,-uOpen*.02,-uOpen*.05);
  q.xz=r2(-side*uOpen*.58)*q.xz;
  q.xy=r2(-side*uOpen*.12)*q.xy;
  return q;
}
// as duas metades de uma vez, com o material (0 casquinha, 1 corte por dentro)
vec2 mapObj(vec3 p){
  float side=p.x>0.?1.:-1.;                       // cada lado só precisa da sua metade
  vec3 q=uOpen<.002?p:halfLocal(p,side);
  float body=cox(q);
  if(uOpen<.002)return vec2(body,0.);
  // o recheio estufa um pouco para fora do corte, como numa coxinha de verdade
  float cut=-side*q.x-.05*smoothstep(.1,.32,-body);
  return vec2(max(body,cut),cut>body?1.:0.);
}
// mundo -> objeto
vec3 toObj(vec3 p){
  p-=uPos;
  p.xz=r2(-uRot.x)*p.xz;
  p.yz=r2(-uRot.y)*p.yz;
  p.xy=r2(-uRot.z)*p.xy;
  return p/uScale;
}
vec2 map(vec3 p){vec2 r=mapObj(toObj(p));r.x*=uScale;return r;}

// fios do recheio desfiado: ruído esticado e torcido
float fiber(vec3 q){
  vec3 r=vec3(q.x,q.y*.87+q.z*.5,q.z*.87-q.y*.5);
  float w=sin(q.x*9.+q.z*7.)*.8;
  return noise(vec3(r.x*18.+w,r.y*44.+w,r.z*18.))*.65+noise(vec3(r.x*36.-w,r.y*90.,r.z*36.+w))*.35;
}
// migalhas da farinha de rosca
float crumb(vec3 q){return noise(q*26.)*.55+noise(q*63.)*.45;}

vec3 sRGB(vec3 c){return c*c*(c*.33+.67);}

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 ro=vec3(0.,.06,3.4);
  vec3 rd=normalize(vec3(uv,-1.75));
  // esfera que envolve a coxinha: o raio que passa longe nem é calculado
  float R=(1.05+uOpen*.45)*uScale;
  vec3 oc=ro-uPos;float b=dot(oc,rd);float c=dot(oc,oc)-R*R;float hh=b*b-c;
  if(hh<0.){OUTC=vec4(0.);return;}
  float t=max(-b-sqrt(hh),.01),tEnd=-b+sqrt(hh);
  float px=1.4/(uRes.y*1.75);
  float dmin=1e9,tmin=t;float m=0.;bool hit=false;
  for(int i=0;i<STEPS;i++){
    vec2 h=map(ro+rd*t);
    if(h.x/t<dmin){dmin=h.x/t;tmin=t;m=h.y;}
    if(h.x<.0015*t){hit=true;m=h.y;break;}
    t+=h.x*.9;
    if(t>tEnd)break;
  }
  float alpha=hit?1.:1.-smoothstep(0.,px,dmin);
  if(alpha<=0.){OUTC=vec4(0.);return;}
  if(!hit)t=tmin;
  vec3 p=ro+rd*t;
  // normal pela própria forma: quatro amostras num tetraedro (em vez de seis)
  vec3 n=vec3(0.);
  for(int k=0;k<N4;k++){
    vec3 e=.5773*(2.*vec3(float(((k+3)/2)-((k+3)/4)*2),float((k/2)-(k/4)*2),float(k-(k/2)*2))-1.);
    n+=e*map(p+e*.0015).x;
  }
  n=normalize(n);
  // ponto em espaço da coxinha (ou da metade), para a textura grudar na superfície quando ela gira
  vec3 op=toObj(p);
  vec3 q=uOpen<.002?op:halfLocal(op,op.x>0.?1.:-1.);
  vec3 alb;float peak=0.;
  if(m<.5){
    // casquinha: relevo das migalhas na luz e cor que varia entre dourado e tostado
    float cr=crumb(q);
    float ex=.012;
    vec3 g=vec3(0.);
    for(int k=0;k<N3;k++){vec3 o=vec3(k==0?1.:0.,k==1?1.:0.,k==2?1.:0.);g+=o*(crumb(q+o*ex)-cr);}
    g/=ex;
    n=normalize(n-g*.02);
    float big=noise(q*4.1+1.7);
    peak=smoothstep(.55,.82,cr);
    vec3 deep=sRGB(vec3(.5,.2,.05));
    vec3 gold=sRGB(vec3(.84,.46,.12));
    vec3 light=sRGB(vec3(.98,.68,.27));
    alb=mix(deep,gold,smoothstep(.22,.58,cr));
    alb=mix(alb,light,peak*.6);
    alb=mix(alb,alb*vec3(.86,.72,.62),smoothstep(.35,.8,big)*.6);   // partes que douraram mais
    alb=mix(alb,deep,smoothstep(.6,.95,q.y)*.3);   // a ponta frita um pouco mais
  }else{
    // por dentro: casquinha fina, massa macia e o recheio desfiado
    float depth=-cox(q);
    vec3 crust=sRGB(vec3(.74,.38,.11));
    float dg=noise(q*46.);
    vec3 dough=mix(sRGB(vec3(.86,.7,.44)),sRGB(vec3(.96,.86,.62)),dg);
    float fill_=smoothstep(.115,.15,depth);
    float fb=fiber(q);
    vec3 fill=mix(sRGB(vec3(.58,.33,.14)),sRGB(vec3(.86,.6,.3)),smoothstep(.25,.6,fb));
    fill=mix(fill,sRGB(vec3(.98,.84,.58)),smoothstep(.62,.85,fb));
    fill*=.78+.3*smoothstep(.2,.7,fb);
    alb=mix(crust,dough,smoothstep(.02,.038,depth));
    alb=mix(alb,fill,fill_);
    // relevo do recheio desfiado
    float ex=.006;
    vec3 gq=vec3(0.);
    for(int k=0;k<N2;k++){vec3 o=vec3(k==0?1.:0.,k==1?1.:0.,0.);gq+=o*(fiber(q+o*ex)-fb);}
    gq/=ex;
    n=normalize(n-gq*.028*fill_);
    peak=smoothstep(.6,.85,fb)*fill_;
  }
  // luz: principal quente de cima, contra-luz laranja e um preenchimento suave
  vec3 L1=normalize(vec3(-.55,.78,.62));
  vec3 L2=normalize(vec3(.85,.35,-.7));
  float wrap=clamp((dot(n,L1)+.4)/1.4,0.,1.);
  float back=clamp(dot(n,L2),0.,1.);
  float fr=1.-clamp(dot(n,-rd),0.,1.);
  float rim=fr*fr*fr;
  vec3 hv=normalize(L1-rd);
  float sp=clamp(dot(n,hv),0.,1.);sp*=sp;sp*=sp;sp*=sp;sp*=sp;   // brilho do óleo na casquinha
  float spec=sp*sp*(m<.5?(.18+.7*peak):(.12+.45*peak));
  // sombra de contato nas dobras (uma amostra só)
  float ao=.8+.2*clamp(n.y+.3,0.,1.);
  vec3 col=alb*(.16*ao*vec3(1.,.9,.8)+1.25*wrap*wrap*vec3(1.,.92,.8))
          +alb*back*.55*vec3(1.,.5,.18)
          +rim*vec3(1.,.55,.2)*.35*ao
          +spec*vec3(1.,.88,.7);
  col=1.-exp(-col*1.25);                // tom suave nas altas luzes
  col=sqrt(col);
  OUTC=vec4(col*alpha,alpha);
}
`;

  const FRAG2 = `#version 300 es
` + FRAG.replace('STEPS_DECL', `uniform int uSteps;
uniform int uN;
out vec4 fragOut;`).replace('STEPS', 'uSteps').split('N4').join('uN').split('N3').join('(uN-1)').split('N2').join('(uN-2)').split('OUTC').join('fragOut').split('TEX(').join('texture(');
  const FRAG1 = FRAG.replace('STEPS_DECL', 'uniform float uQ;').replace('i<STEPS;i++){', `i<72;i++){
    if(float(i)>uQ)break;`).split('N4').join('4').split('N3').join('3').split('N2').join('2').split('OUTC').join('gl_FragColor').split('TEX(').join('texture2D(');

  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOut(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function backOut(x) { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const FOCAL = 1.75, CAMZ = 3.4, CAMY = .06;

  // o roteiro do loop (12s): está dentro da tela do celular, sai na direção de quem olha, gira, abre,
  // mostra o recheio, fecha, chega mais perto, e volta para dentro da tela
  const LOOP = 12;
  const Z_IN = -5.2, Z_OUT = .2, Z_NEAR = .62;
  function pose(t, A) {
    // A: âncoras em coordenadas da tela do desenho (meio da foto do post, borda de cima da foto, teto do desenho).
    // Fora da tela ela flutua inteira acima da borda; o tamanho é o maior que cabe até o teto, mesmo quando chega perto.
    const dOut = CAMZ - Z_OUT, dNear = CAMZ - Z_NEAR;
    const room = A.ceil - .03 - A.topY;
    const sOut = Math.max(.34, Math.min(.72, room * dNear / (1.44 * FOCAL)));
    const outY = A.topY + .03 + .5 * sOut * FOCAL / dOut;
    const nearY = A.topY + .03 + .5 * sOut * FOCAL / dNear;
    const s = { ux: A.inX, uy: A.inY, z: Z_IN, yaw: t * .6, pitch: -.1, roll: 0, scale: sOut, open: 0, phase: 'tela', out: 0 };
    const bob = Math.abs(Math.sin(t * 1.6)) * .014;
    if (t < .5) { s.uy += bob * .4; return s; }
    if (t < 2.1) {
      const k = easeInOut(seg(t, .5, 2.1));
      s.phase = 'sai'; s.out = k;
      s.uy = lerp(A.inY, outY, k); s.z = lerp(Z_IN, Z_OUT, k);
      s.yaw = .3 + k * Math.PI * 2; s.pitch = -.1 - .25 * Math.sin(k * Math.PI);
      return s;
    }
    s.out = 1; s.uy = outY + bob; s.z = Z_OUT; s.yaw = .3;
    if (t < 3.3) { s.phase = 'casca'; s.yaw = .3 + .45 * Math.sin(seg(t, 2.1, 3.3) * Math.PI); return s; }
    if (t < 4.1) { const o = seg(t, 3.3, 4.1); s.phase = 'abrindo'; s.open = backOut(o); s.yaw = .3 * (1 - easeOut(o)); s.pitch = -.1 - .14 * easeOut(o); return s; }
    if (t < 6.9) { s.phase = 'aberta'; s.open = 1; s.yaw = Math.sin((t - 4.1) * .9) * .2; s.pitch = -.24; return s; }
    if (t < 7.6) { const c = easeInOut(seg(t, 6.9, 7.6)); s.phase = 'fechando'; s.open = 1 - c; s.pitch = -.24 + .14 * c; s.yaw = Math.sin(2.8 * .9) * .2 * (1 - c); return s; }
    if (t < 8.6) { const g = easeInOut(seg(t, 7.6, 8.6)); s.phase = 'perto'; s.yaw = g * Math.PI * 2; s.z = lerp(Z_OUT, Z_NEAR, g); s.uy = lerp(outY, nearY, g) + bob; s.pitch = -.1 + .12 * g; return s; }
    if (t < 9.6) { s.phase = 'perto'; s.z = Z_NEAR; s.uy = nearY + bob; s.yaw = Math.PI * 2 + Math.sin((t - 8.6) * 2) * .25; s.pitch = .02; return s; }
    if (t < 10.4) { const b = easeInOut(seg(t, 9.6, 10.4)); s.phase = 'gira'; s.z = lerp(Z_NEAR, Z_OUT, b); s.uy = lerp(nearY, outY, b) + bob; s.yaw = Math.PI * 2 + .3 * b; return s; }
    const v = easeInOut(seg(t, 10.4, 12));
    s.phase = 'volta'; s.out = 1 - v;
    s.uy = lerp(outY, A.inY, v); s.z = lerp(Z_OUT, Z_IN, v);
    // termina com duas voltas inteiras: o fim do loop encaixa no começo sem pulo
    s.yaw = lerp(.3, Math.PI * 4, v); s.pitch = -.1 - .2 * Math.sin(v * Math.PI);
    return s;
  }
  // tela do desenho -> mundo (a câmera olha para -z)
  function toWorld(s) {
    const d = CAMZ - s.z;
    return { x: s.ux * d / FOCAL, y: CAMY + s.uy * d / FOCAL, z: s.z };
  }

  /* migalhas de farinha que voam da tela na direção de quem olha */
  const CRUMB_COLORS = ['#E8963A', '#C96F22', '#F2B65A', '#8A4A1A', '#D98A33'];
  function crumbShapes() {
    const out = [];
    for (let k = 0; k < 7; k++) {
      const n = 5 + (k % 3), pts = [];
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = .6 + Math.random() * .5; pts.push([Math.cos(a) * r, Math.sin(a) * r * (.7 + Math.random() * .4)]); }
      out.push(pts);
    }
    return out;
  }

  function mount(canvas, opts) {
    opts = opts || {};
    const ctxOpts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' };
    let gl = canvas.getContext('webgl2', ctxOpts);
    const v2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', ctxOpts);
    if (!gl) return null;
    // o navegador traduz o desenho para a placa de vídeo em segundo plano (KHR_parallel_shader_compile):
    // a página não congela enquanto isso; a coxinha só aparece quando a tradução termina
    const par = gl.getExtension('KHR_parallel_shader_compile');
    const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
    const vs = sh(gl.VERTEX_SHADER, v2 ? VERT2 : VERT), fs = sh(gl.FRAGMENT_SHADER, v2 ? FRAG2 : FRAG1);
    const pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    const U = {};
    let ready = false, failed = false;
    function finish() {
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
        console.warn(gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(pr));
        failed = true; if (opts.onFail) opts.onFail(); return;
      }
      gl.useProgram(pr);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'a');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uPos', 'uRot', 'uScale', 'uOpen', 'uQ', 'uSteps', 'uN', 'uNoise'].forEach(k => { U[k] = gl.getUniformLocation(pr, k); });
      // a imagem de ruído (256x256): vermelho aleatório, verde = vermelho deslocado (37,17)
      const N = 256, px = new Uint8Array(N * N * 4), r = new Uint8Array(N * N);
      for (let i = 0; i < r.length; i++) r[i] = (Math.random() * 256) | 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const o = (y * N + x) * 4;
        px[o] = r[y * N + x];
        px[o + 1] = r[((y + 17) % N) * N + ((x + 37) % N)];
        px[o + 3] = 255;
      }
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.uniform1i(U.uNoise, 0);
      ready = true;
      if (pending != null) { const t = pending; pending = null; renderAt(t); }
      if (running) { last = 0; raf = requestAnimationFrame(frame); }
      if (opts.onReady) opts.onReady();
    }
    let pending = null;
    (function wait() {
      if (par && !gl.getProgramParameter(pr, par.COMPLETION_STATUS_KHR)) { setTimeout(wait, 60); return; }
      // sem a extensão (Safari usa Metal e traduz rápido): espera um respiro e termina
      setTimeout(finish, par ? 0 : 30);
    })();

    let res = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 1.5);
    let w = 0, h = 0, cssW = 0, cssH = 0, raf = 0, running = false, last = 0, clock = 0, shown = 0;
    let fps = opts.fps || 60, acc = 0, nAcc = 0;
    let A = { inX: 0, inY: -.15, topY: .05, ceil: .46 };
    const drag = { yaw: 0, pitch: 0, on: false };
    let lastPhase = '';

    // migalhas
    const cc = opts.crumbs, cctx = cc ? cc.getContext('2d') : null;
    const shapes = crumbShapes();
    let parts = [], cW = 0, cH = 0, origin = { x: 0, y: 0, w: 100 }, burst1 = false, burst2 = false;
    function emit(n, power) {
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (Math.random() - .5) * 2.3;
        const sp = (.35 + Math.random() * .65) * power;
        parts.push({
          x: origin.x + (Math.random() - .5) * origin.w * .7, y: origin.y + Math.random() * 6,
          vx: Math.cos(ang) * sp * cW * .55, vy: Math.sin(ang) * sp * cH * .6 - cH * .1,
          z: 0, vz: .5 + Math.random() * 1.6, rot: Math.random() * 6, vr: (Math.random() - .5) * 8,
          size: 2.2 + Math.random() * 4.2, life: 0, max: 1.3 + Math.random() * 1.1,
          shape: shapes[(Math.random() * shapes.length) | 0], color: CRUMB_COLORS[(Math.random() * CRUMB_COLORS.length) | 0],
        });
      }
    }
    let crumbsDirty = false;
    function drawCrumbs(dt) {
      if (!cctx) return;
      // sem migalhas no ar: não mexe no desenho (nada para limpar, nada para enviar à placa de vídeo)
      if (!parts.length) { if (crumbsDirty) { cctx.clearRect(0, 0, cc.width, cc.height); crumbsDirty = false; } return; }
      cctx.clearRect(0, 0, cc.width, cc.height);
      crumbsDirty = true;
      const k = cc.width / cW;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        if (p.life > p.max) { parts.splice(i, 1); continue; }
        p.vy += cH * .9 * dt;                 // a gravidade puxa as migalhas de volta
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
        const persp = 1 + p.z * .9;           // vindo na direção de quem olha: cresce
        const a = Math.min(1, p.life * 6) * (1 - Math.max(0, (p.life - p.max * .6) / (p.max * .4)));
        cctx.save();
        cctx.globalAlpha = a;
        cctx.translate(p.x * k, p.y * k);
        cctx.rotate(p.rot);
        const sz = p.size * persp * k;
        cctx.scale(sz, sz);
        cctx.beginPath();
        p.shape.forEach((q, j) => (j ? cctx.lineTo(q[0], q[1]) : cctx.moveTo(q[0], q[1])));
        cctx.closePath();
        cctx.fillStyle = p.color;
        cctx.fill();
        cctx.restore();
      }
    }

    function size() {
      const r = canvas.getBoundingClientRect();
      cssW = r.width; cssH = r.height;
      const nw = Math.max(1, Math.round(r.width * res)), nh = Math.max(1, Math.round(r.height * res));
      if (nw !== w || nh !== h) { w = canvas.width = nw; h = canvas.height = nh; gl.viewport(0, 0, w, h); }
      if (cc) {
        const q = cc.getBoundingClientRect();
        cW = q.width; cH = q.height;
        const cr = Math.min(window.devicePixelRatio || 1, 1.5);
        const cw = Math.round(q.width * cr), ch = Math.round(q.height * cr);
        if (cc.width !== cw || cc.height !== ch) { cc.width = cw; cc.height = ch; }
      }
    }
    // o site informa onde está a foto do post (em pixels da página): vira âncora em coordenadas do desenho
    function setAnchors(media, crumbBox) {
      size();
      const r = canvas.getBoundingClientRect();
      const uv = (x, y) => ({ x: (x - r.left - r.width / 2) / r.height, y: (r.top + r.height / 2 - y) / r.height });
      const c = uv((media.tl.x + media.br.x) / 2, (media.tl.y + media.br.y) / 2);
      const top = uv((media.tl.x + media.tr.x) / 2, (media.tl.y + media.tr.y) / 2);
      A = { inX: c.x, inY: c.y + .02, topY: top.y, ceil: .45 };
      if (cc && crumbBox) origin = { x: (media.tl.x + media.tr.x) / 2 - crumbBox.left, y: (media.tl.y + media.tr.y) / 2 - crumbBox.top, w: Math.abs(media.tr.x - media.tl.x) };
    }
    function draw(t, dt) {
      const s = pose(t, A);
      const P = toWorld(s);
      gl.uniform2f(U.uRes, w, h);
      gl.uniform3f(U.uPos, P.x, P.y, P.z);
      gl.uniform3f(U.uRot, s.yaw + drag.yaw, s.pitch + drag.pitch, s.roll);
      gl.uniform1f(U.uScale, s.scale);
      gl.uniform1f(U.uOpen, s.open);
      if (v2) { gl.uniform1i(U.uSteps, opts.steps || 64); gl.uniform1i(U.uN, 4); } else gl.uniform1f(U.uQ, opts.steps || 64);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (shown < 1) { shown = Math.min(1, shown + dt * 1.8); canvas.style.opacity = shown.toFixed(3); }
      // migalhas: uma explosão quando ela atravessa a tela e outra quando chega perto
      if (t > .9 && t < 1.5 && !burst1) { burst1 = true; emit(window.innerWidth < 640 ? 22 : 36, 1); }
      if (t > 7.9 && t < 8.5 && !burst2) { burst2 = true; emit(window.innerWidth < 640 ? 12 : 20, .8); }
      if (t < .5) { burst1 = false; burst2 = false; }
      drawCrumbs(dt);
      if (s.phase !== lastPhase) { lastPhase = s.phase; if (opts.onPhase) opts.onPhase(s.phase, s); }
      if (opts.onFrame) opts.onFrame(s);
    }
    function frame(now) {
      if (!running || !ready) return;
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(.1, (now - last) / 1000) : 0;
      // no máximo 60 desenhos por segundo (30 no modo leve), mesmo em tela de 90, 120 ou 144Hz
      if (last && now - last < 1000 / fps - 1.2) return;
      last = now;
      clock = (clock + dt) % LOOP;
      if (!drag.on) { drag.yaw *= .92; drag.pitch *= .92; }
      // aparelho sofrendo (média de 30 desenhos bem acima do tempo de um quadro): desenha com menos pixels
      if (dt) { acc += dt; nAcc++; }
      if (nAcc >= 30) { if (acc / nAcc > 1.3 / fps && res > .7) { res = Math.max(.7, res * .85); size(); } acc = 0; nAcc = 0; }
      draw(clock, dt);
    }
    function start() { if (running || failed) return; running = true; last = 0; size(); if (ready) raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    function renderAt(t) { if (!ready) { pending = t; return; } size(); clock = t; shown = 1; canvas.style.opacity = '1'; parts = []; draw(t, 0); if (cctx) cctx.clearRect(0, 0, cc.width, cc.height); }
    // arrastar gira a coxinha (mouse ou dedo); solta e ela volta sozinha
    let px = 0, py = 0;
    canvas.addEventListener('pointerdown', e => { drag.on = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (!drag.on) return;
      drag.yaw += (e.clientX - px) * .012; drag.pitch = Math.max(-.6, Math.min(.6, drag.pitch + (e.clientY - py) * .006));
      px = e.clientX; py = e.clientY;
    });
    const up = () => { drag.on = false; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.style.opacity = '0';
    function setFps(f) { fps = f; acc = 0; nAcc = 0; }
    return { start, stop, renderAt, size, setAnchors, setFps, LOOP, get anchors() { return A; } };
  }

  window.Coxinha3D = { mount, pose, LOOP };
})();
