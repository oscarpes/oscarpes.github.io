// OSCARPES AO VIVO — cena.js
// A fase da conversa (espera → ouvindo → pensando → falando) e a FOLHA VIVA: a logo feita de
// bolinhas (three.js, carregado do cdnjs no index.html) que respira, pulsa com a voz e voa até as
// janelas (Esfera.formar).
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import { $, DIAG, diag } from './base.js?v=20261010213811';
import { relogioLegenda } from './ouvido.js?v=20261010213811';
import { avisarFaseAoMac } from './musica.js?v=20261010213811';

// ---------------------------------------------------------------------------
// Estado da conversa: espera → ouvindo → pensando → falando
// ---------------------------------------------------------------------------
let fase = 'espera';
let energia = 0, alvoEnergia = 0.05;
function mudarFase(f) {
  fase = f;
  avisarFaseAoMac(f);
  $('estado').textContent = { espera: 'EM ESPERA', ouvindo: 'OUVINDO', pensando: 'PROCESSANDO', falando: 'FALANDO', toque: 'TOQUE NO MICROFONE PARA FALAR' }[f] || '';
  $('mic').classList.toggle('chama', f === 'toque');
  $('estado').classList.toggle('chama', f === 'toque');
  if (f === 'falando') clearTimeout(relogioLegenda);    // a legenda fica enquanto fala
  alvoEnergia = { espera: 0.05, ouvindo: 0.2, pensando: 0.4, falando: 0.85, toque: 0.1 }[f] || 0.05;
}

// ---------------------------------------------------------------------------
// A FOLHA VIVA — a logo da Oscarpes feita de partículas (three.js)
// ---------------------------------------------------------------------------
// João, 02/out/2026: "a bola redonda se mexendo nao podia ser a logo da
// oscarpes? [...] de bolinhas se mexendo" e "deveria se mexer mais quando o
// jarvis fala, para ligar a uma forma de vida". As bolinhas nascem da folha
// real (folha.png, a mesma da marca): em espera ela respira devagar; ouvindo,
// fica atenta; pensando, as bolinhas giram por dentro; falando, a folha pulsa
// a cada palavra e as bolinhas se soltam e voltam, como algo vivo.
//
// AS BOLINHAS TRAZEM AS JANELAS (02/out/2026, João na TV: "as bolinhas da
// Oscarpes se desfazem e vão trazendo as janelas e trocando as janelas conforme
// vai mudando as perguntas"). O desenho agora ocupa a TELA INTEIRA (#particulas,
// por cima dos painéis, sem pegar clique) e a folha é desenhada onde a caixa
// #esfera está. Quando chega resposta com painéis, Esfera.formar(janelas):
//   1. parte das bolinhas sai da folha e VOA (curva, vindo na direção de quem
//      olha) até o lugar de cada janela, uma janela depois da outra;
//   2. chegando, formam a nuvem do tamanho da janela — e a janela de vidro
//      materializa dali (o CSS espera o mesmo tempo: atrasoDoPainel);
//   3. depois escorrem para a borda e ficam correndo nela, bem apagadas (a borda
//      luminosa) e acendem junto com a voz;
//   4. pergunta nova com painéis novos: as bolinhas saem das janelas velhas (que
//      se dissolvem) direto para as novas; tudo fechado: voltam para a folha.
// Celular/aparelho fraco: menos bolinhas e voo mais curto. Movimento reduzido
// (acessibilidade do sistema): sem voo, as janelas só aparecem.
const CALMO = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const CELULAR = () => !!(window.matchMedia && matchMedia('(max-width: 759px)').matches);
const LEVE = innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
const VOO_MS = CALMO ? 0 : LEVE ? 650 : 950;       // o voo de uma bolinha até a janela
const ESCALONA_MS = CALMO ? 60 : 170;              // uma janela depois da outra
/** Quando a janela j aparece (ms): quando as bolinhas dela já chegaram. */
function atrasoDoPainel(j) { return CALMO ? j * ESCALONA_MS : j * ESCALONA_MS + Math.round(VOO_MS * 0.72); }
const Esfera = (() => {
  const box = $('esfera');
  // TEMA: a forma (imagem), o acento (cor da imagem que acende "ouro") e as cores das bolinhas
  const TP = TEMA.particulas, corHex = (h) => parseInt(String(h).replace('#', ''), 16);
  const nada = { pulso() {}, formar() {}, get bolinhas() { return 0; } };
  if (!window.THREE) return nada;
  let r;
  try { r = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' }); DIAG.webgl = true; }
  catch (e) { DIAG.webgl = false; diag('webgl falhou'); return nada; }
  // 05/out/2026 (João, TV 4K em tela cheia: WindowServer a 105 % de CPU): em tela GRANDE com retina, as bolinhas
  // desenham em resolução 1× — o desenho tela-cheia a 3840×2160 era o que pesava, e bolinha não precisa de retina
  const GRANDE = (innerWidth * (devicePixelRatio || 1)) > 2600;
  const DPR = GRANDE ? 1 : Math.min(LEVE ? 1.5 : 2, devicePixelRatio || 1);
  r.setPixelRatio(DPR);
  r.domElement.id = 'particulas';
  document.body.insertBefore(r.domElement, box);
  const cena = new THREE.Scene();
  // câmera olhando o plano z=0: 1 px de tela = k unidades do mundo nesse plano
  const FOV = 45, DIST = 10, TG = Math.tan(FOV * Math.PI / 360);
  const cam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100); cam.position.z = DIST;
  const N = LEVE ? 1700 : 4200;
  DIAG.bolinhas = N;
  const pos = new Float32Array(N * 3), base = new Float32Array(N * 3), fase0 = new Float32Array(N), solto = new Float32Array(N * 3);
  const alfa = new Float32Array(N).fill(1), tam = new Float32Array(N), ouro = new Float32Array(N);
  // de quem é cada bolinha: -1 = folha; j = janela j. Durante a espera do voo
  // ela segue o dono antigo; no voo vai de `de` até o alvo vivo do dono novo.
  const dono = new Int16Array(N).fill(-1), donoAntes = new Int16Array(N).fill(-1);
  const de = new Float32Array(N * 3), t0 = new Float64Array(N), voo = new Uint8Array(N);   // voo: 0 parado, 1 esperando, 2 voando
  const u = new Float32Array(N), ix = new Float32Array(N), iy = new Float32Array(N), deriva = new Float32Array(N);
  const ordem = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ordem[i], ordem[j]] = [ordem[j], ordem[i]]; }
  // começo numa esfera (enquanto a folha carrega) e depois as bolinhas migram para a folha
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), t = i * Math.PI * (3 - Math.sqrt(5));
    base[i * 3] = Math.cos(t) * rr; base[i * 3 + 1] = y; base[i * 3 + 2] = Math.sin(t) * rr;
    fase0[i] = Math.random() * 6.28;
    const a = Math.random() * 6.28, b = Math.acos(2 * Math.random() - 1);
    solto.set([Math.sin(b) * Math.cos(a), Math.sin(b) * Math.sin(a), Math.cos(b)], i * 3);   // direção de "soltar"
    ouro[i] = Math.random() < TP.ouroAleatorio ? 1 : 0;
    u[i] = Math.random(); ix[i] = Math.random(); iy[i] = Math.random(); deriva[i] = (Math.random() - 0.5) * 0.03;
  }
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'), W = 160, H = Math.round(W * img.height / img.width);
    c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0, W, H);
    const px = x.getImageData(0, 0, W, H).data, dentro = [];
    // acento do tema (ex.: o sol da logo): o pixel dessa cor vira bolinha "ouro" — no padrão não há
    const ac = TP.acento ? [0, 2, 4].map((k) => parseInt(TP.acento.replace('#', '').slice(k, k + 2), 16)) : null;
    const doAcento = (q) => !!ac && Math.abs(px[q] - ac[0]) + Math.abs(px[q + 1] - ac[1]) + Math.abs(px[q + 2] - ac[2]) < 150;
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (px[(yy * W + xx) * 4 + 3] > 140) dentro.push(ac ? [xx, yy, doAcento((yy * W + xx) * 4)] : [xx, yy]);
    DIAG.folha = dentro.length;
    if (!dentro.length) return;
    // logo larga (letreiro): limita a largura para não sair da caixa; no padrão é só a altura
    const escala = TP.larguraMax ? 2.3 / Math.max(H, W / TP.larguraMax) : 2.3 / H;
    for (let i = 0; i < N; i++) {
      const [xx, yy, acento] = dentro[Math.floor(Math.random() * dentro.length)];
      if (ac) ouro[i] = acento ? 1 : 0;
      base[i * 3] = (xx - W / 2 + Math.random() - 0.5) * escala;
      base[i * 3 + 1] = -(yy - H / 2 + Math.random() - 0.5) * escala;
      base[i * 3 + 2] = (Math.random() - 0.5) * 0.16;
    }
    if (ac && g.attributes.aOuro) g.attributes.aOuro.needsUpdate = true;
  };
  img.onerror = () => { DIAG.folha = 'erro'; diag(TP.imagem + ' falhou'); };
  img.src = TP.imagem;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aAlfa', new THREE.BufferAttribute(alfa, 1));
  g.setAttribute('aTam', new THREE.BufferAttribute(tam, 1));
  g.setAttribute('aOuro', new THREE.BufferAttribute(ouro, 1));
  // cada bolinha com o seu brilho e o seu tamanho (a da borda da janela é
  // apagadinha; a que voa é forte) — por isso um shader pequeno, não o PointsMaterial
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCor: { value: new THREE.Color(corHex(TP.espera)) }, uOuro: { value: new THREE.Color(corHex(TP.ouro)) }, uEscala: { value: 1 }, uNucleo: { value: new THREE.Vector3(...TP.nucleo) } },
    vertexShader: 'attribute float aAlfa; attribute float aTam; attribute float aOuro; uniform float uEscala; varying float vAlfa; varying float vOuro;' +
      'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aTam * uEscala / -mv.z; gl_Position = projectionMatrix * mv; vAlfa = aAlfa; vOuro = aOuro; }',
    fragmentShader: 'uniform vec3 uCor; uniform vec3 uOuro; uniform vec3 uNucleo; varying float vAlfa; varying float vOuro;' +
      'void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d); float n = smoothstep(0.2, 0.0, d);' +
      ' vec3 c = mix(mix(uCor, uOuro, vOuro), uNucleo, n * 0.75); gl_FragColor = vec4(c, a * a * vAlfa); }',
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const COR_ESPERA = corHex(TP.espera), COR_OUVE = corHex(TP.ouvindo), COR_FALA = corHex(TP.falando);
  const pontos = new THREE.Points(g, mat); pontos.frustumCulled = false; cena.add(pontos);
  // halo atrás da folha e o anel que aparece quando fala/pensa
  const halo = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), new THREE.MeshBasicMaterial({ color: corHex(TP.halo), transparent: true, opacity: 0.06, depthWrite: false }));
  cena.add(halo);
  const anel = new THREE.Mesh(new THREE.RingGeometry(1.42, 1.428, 160), new THREE.MeshBasicMaterial({ color: corHex(TP.anel), transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
  cena.add(anel);
  let W = 1, H = 1, k = 1;
  function tamanho() { W = innerWidth; H = innerHeight; r.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); k = 2 * DIST * TG / H; mat.uniforms.uEscala.value = H * DPR / (2 * TG); }
  addEventListener('resize', tamanho); tamanho();
  // as janelas (elementos) e os retângulos delas, relidos a cada 3 quadros
  // (acompanha rolagem, troca de tamanho da tela e a folha encolhendo)
  let alvos = [], rects = [], rectsAntes = [], caixaFolha = null, quadroN = 0;
  const lerRect = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
  function relerRects() { rects = alvos.map(lerRect); const b = box.getBoundingClientRect(); caixaFolha = { cx: b.left + b.width / 2, cy: b.top + b.height / 2, h: b.height }; }
  let picos = 0, onda = 0, iniciou = false;
  const suave = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  // alvo de uma bolinha (em coordenadas do mundo) → escreve em A
  const A = [0, 0, 0, 1, 1];          // x, y, z, alfa, tamanho
  let L = null;                       // parâmetros da folha neste quadro
  function alvoDaFolha(i, t) {
    const k3 = i * 3, f = fase0[i];
    const bx = base[k3], by = base[k3 + 1], bz = base[k3 + 2];
    const tremor = (L.fala ? 0.028 : 0.01) * (0.4 + L.e) * Math.sin(t * (L.fala ? 9 : 2) + f);
    const solta = L.fala ? (picos * 0.22 + onda * 0.14) * (0.5 + 0.5 * Math.sin(f + t * 4)) : L.pensa ? 0.06 * Math.sin(t * 5 + f) : 0;
    const giro = L.pensa ? 0.25 * Math.sin(t * 2 + by * 3) : 0;
    const x = (bx + Math.cos(f + t) * tremor + solto[k3] * solta) * L.resp + giro * by * 0.2;
    const y = (by + Math.sin(f * 1.3 + t * 1.1) * tremor + solto[k3 + 1] * solta) * L.resp;
    const z = bz + solto[k3 + 2] * solta + Math.sin(t * 2 + bx * 4) * (L.fala ? 0.06 * L.e : 0.02);
    // a folha não gira inteira (a marca tem de ser lida): balança devagar
    const x1 = x * L.cy + z * L.sy, z1 = -x * L.sy + z * L.cy;
    const y2 = y * L.cx - z1 * L.sx, z2 = y * L.sx + z1 * L.cx;
    A[0] = L.ox + x1 * L.s; A[1] = L.oy + y2 * L.s; A[2] = z2 * L.s;
    A[3] = 1; A[4] = Math.max(2.2 * k, L.tam * L.s);
  }
  function alvoDaJanela(R, i, t, desde) {
    // ponto na borda (corre devagar em volta) e ponto de dentro (a nuvem da janela)
    let uu = (u[i] + t * deriva[i]) % 1; if (uu < 0) uu += 1;
    const P = 2 * (R.w + R.h); let d = uu * P, bx, by;
    if (d < R.w) { bx = R.x + d; by = R.y; } else if ((d -= R.w) < R.h) { bx = R.x + R.w; by = R.y + d; }
    else if ((d -= R.h) < R.w) { bx = R.x + R.w - d; by = R.y + R.h; } else { d -= R.w; bx = R.x; by = R.y + R.h - d; }
    const dx = R.x + R.w * (0.05 + 0.9 * ix[i]), dy = R.y + R.h * (0.05 + 0.9 * iy[i]);
    const s = suave((desde - 120) / 750);           // nuvem → borda
    const px = dx + (bx - dx) * s, py = dy + (by - dy) * s;
    A[0] = (px - W / 2) * k; A[1] = -(py - H / 2) * k; A[2] = Math.sin(t * 1.3 + fase0[i]) * 0.02;
    const brilho = Math.pow(Math.max(0, Math.sin(t * 1.6 + fase0[i] * 3)), 8);
    A[3] = (1 - s) * 0.95 + s * (0.16 + 0.55 * brilho + picos * 0.35);
    A[4] = (3.4 - 0.9 * s) * k;
  }
  function alvo(d, R, i, t, agora) {
    if (d >= 0 && R) alvoDaJanela(R, i, t, agora - t0[i] - VOO_MS);
    else alvoDaFolha(i, t);
  }
  // MODO DESCANSO (05/out/2026): parado (em espera, sem voo, sem voz) desenha 1 quadro em 3 — a folha respira devagar
  // e ninguém vê diferença; acordou (ouviu, pensou, falou, janela nova) volta a 60. Aba escondida: o navegador já para.
  let ativoAte = 0;
  function quadro(ms) {
    const t = ms / 1000, agora = performance.now();
    if (fase !== 'espera' || picos > 0.02) ativoAte = agora + 4000;
    if (agora > ativoAte && quadroN % 3 !== 0) { quadroN++; requestAnimationFrame(quadro); return; }
    if (quadroN++ % 3 === 0 || !caixaFolha) relerRects();
    picos *= 0.88; onda *= 0.94;
    energia += (alvoEnergia + picos - energia) * 0.1;
    const e = Math.min(1.4, energia);
    const fala = fase === 'falando', pensa = fase === 'pensando';
    const ay = Math.sin(t * 0.45) * (fala ? 0.32 : 0.22), ax = Math.sin(t * 0.3) * 0.08;
    // a folha antiga media 2,3 unidades numa caixa de 2,817 → s converte para o mundo
    const s = caixaFolha.h * k / 2.817;
    L = { e, fala, pensa, s, ox: (caixaFolha.cx - W / 2) * k, oy: -(caixaFolha.cy - H / 2) * k,
      resp: 1 + Math.sin(t * (fala ? 3.2 : 1.1)) * (fala ? 0.035 : 0.015),
      cy: Math.cos(ay), sy: Math.sin(ay), cx: Math.cos(ax), sx: Math.sin(ax), tam: 0.036 + e * 0.012 + picos * 0.012 };
    for (let i = 0; i < N; i++) {
      const k3 = i * 3;
      if (voo[i] === 1 && agora >= t0[i]) { voo[i] = 2; de[k3] = pos[k3]; de[k3 + 1] = pos[k3 + 1]; de[k3 + 2] = pos[k3 + 2]; }
      if (voo[i] === 1) {                      // ainda esperando a vez: segue o dono antigo
        const d = donoAntes[i]; alvo(d, rectsAntes[d], i, t, agora + 99999);
        pos[k3] += (A[0] - pos[k3]) * 0.15; pos[k3 + 1] += (A[1] - pos[k3 + 1]) * 0.15; pos[k3 + 2] += (A[2] - pos[k3 + 2]) * 0.15;
        alfa[i] = A[3]; tam[i] = A[4]; continue;
      }
      alvo(dono[i], rects[dono[i]], i, t, agora);
      if (voo[i] === 2) {
        const p = (agora - t0[i]) / Math.max(1, VOO_MS);
        if (p < 1) {
          // curva: sai para o lado e vem na direção de quem olha (cresce), depois pousa
          const q = easeIO(p), m = 1 - q;
          const dist = Math.hypot(A[0] - de[k3], A[1] - de[k3 + 1]);
          const mx = (de[k3] + A[0]) / 2 + solto[k3] * dist * 0.35, my = (de[k3 + 1] + A[1]) / 2 + solto[k3 + 1] * dist * 0.35;
          pos[k3] = m * m * de[k3] + 2 * m * q * mx + q * q * A[0];
          pos[k3 + 1] = m * m * de[k3 + 1] + 2 * m * q * my + q * q * A[1];
          pos[k3 + 2] = m * de[k3 + 2] + q * A[2] + Math.sin(Math.PI * q) * (1.2 + Math.abs(solto[k3 + 2]) * 2.4);
          alfa[i] = 1; tam[i] = Math.max(A[4], 3.6 * k);
          continue;
        }
        voo[i] = 0;
      }
      if (!iniciou) { pos[k3] = A[0]; pos[k3 + 1] = A[1]; pos[k3 + 2] = A[2]; }
      const lerp = dono[i] >= 0 ? 0.22 : 0.12;
      pos[k3] += (A[0] - pos[k3]) * lerp; pos[k3 + 1] += (A[1] - pos[k3 + 1]) * lerp; pos[k3 + 2] += (A[2] - pos[k3 + 2]) * lerp;
      alfa[i] += (A[3] - alfa[i]) * 0.2; tam[i] = A[4];
    }
    iniciou = true;
    g.attributes.position.needsUpdate = true; g.attributes.aAlfa.needsUpdate = true; g.attributes.aTam.needsUpdate = true;
    mat.uniforms.uCor.value.setHex(fala ? COR_FALA : fase === 'ouvindo' ? COR_OUVE : COR_ESPERA);
    halo.position.set(L.ox, L.oy, -0.3 * s); halo.scale.setScalar(s * (1 + picos * 0.25));
    halo.material.opacity = 0.05 + e * 0.08 + picos * 0.12;
    anel.position.set(L.ox, L.oy, 0); anel.scale.setScalar(s * (1 + onda * 0.15));
    anel.material.opacity = fala ? 0.25 + picos * 0.5 : pensa ? 0.15 : 0; anel.rotation.z += 0.004;
    r.render(cena, cam);
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
  return {
    pulso(f = 0.4) { picos = Math.min(1, picos + f); onda = Math.min(1, onda + f * 0.8); },
    get bolinhas() { return N; },
    /** Manda as bolinhas para estas janelas ([] = todas de volta para a folha). */
    formar(els) {
      ativoAte = performance.now() + 4000;     // janela nova: o voo das bolinhas roda a 60
      const antes = alvos;
      rectsAntes = rects.slice();
      alvos = (els || []).slice();
      relerRects();
      // mesmas janelas na mesma ordem (rolagem, tela mudou de tamanho): só segue os retângulos
      if (antes.length === alvos.length && antes.every((el, j) => el === alvos[j])) return;
      const agora = performance.now();
      if (CALMO) { dono.fill(-1); voo.fill(0); return; }       // movimento reduzido: a folha fica inteira
      const fica = alvos.length ? Math.round(N * (LEVE ? 0.45 : 0.3)) : N;
      const per = rects.map((R) => 2 * (R.w + R.h)), total = per.reduce((a, b) => a + b, 0) || 1;
      const acum = []; per.reduce((a, b, j) => (acum[j] = (a + b) / total), 0);
      for (let n = 0; n < N; n++) {
        const i = ordem[n];
        let novo = -1;
        if (n >= fica) { const q = (n - fica) / Math.max(1, N - fica); novo = acum.findIndex((c) => q < c); if (novo < 0) novo = alvos.length - 1; }
        const velho = dono[i];
        const mesmaJanela = novo >= 0 && velho >= 0 && antes[velho] === alvos[novo];
        if ((novo === -1 && velho === -1) || mesmaJanela) { dono[i] = novo; if (mesmaJanela) donoAntes[i] = novo; continue; }
        // indo para a janela: espera a vez dela; voltando à folha: sai logo
        const atraso = novo >= 0 ? novo * ESCALONA_MS + Math.random() * 380 : Math.random() * 450;
        donoAntes[i] = voo[i] === 1 ? -1 : velho; dono[i] = novo; voo[i] = 1; t0[i] = agora + atraso;
        u[i] = Math.random(); ix[i] = Math.random(); iy[i] = Math.random();
      }
    },
  };
})();

// ritmo de fala garantido: nem todo navegador avisa cada palavra (o iPhone às
// vezes não avisa) — enquanto fala, a folha pulsa no compasso de uma fala humana
setInterval(() => { if (fase === 'falando') Esfera.pulso(0.18 + Math.random() * 0.32); }, 230);

export {
  fase, mudarFase, CALMO, CELULAR, VOO_MS, atrasoDoPainel, Esfera,
};
