// OSCARPES AO VIVO — raizes.js
// O fundo: raízes vivas crescendo no solo (canvas #fundo). Tema com outro fundo não desenha nada.
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import { fase } from './cena.js?v=20261010213811';
import { $ } from './base.js?v=20261010213811';

// FUNDO: raízes vivas (João, 02/out/2026: "raízes se mexendo e crescendo, as
// vezes uma simulação de solo com raízes e água e nutrientes, mas tudo bem
// leve"). Saem de baixo da folha e crescem devagar até o fundo; pontinhos de
// água (bege) e nutriente (laranja) sobem por elas até a folha. Linhas bem
// apagadas no fundo fazem as camadas do solo. Cresce, fica, apaga, renasce.
(() => {
  if (TEMA.fundo !== 'raizes') return;      // tema com outro fundo (no tema.css): sem raízes
  const c = $('fundo'), x = c.getContext('2d');
  let W, H, dpr, segs = [], gotas = [], inicio = 0, origem = null, ciclo = 0, discreto = 1, parado = false;
  const VEL = 70;            // px por segundo de crescimento (em px de tela)
  const VIDA = 34;           // segundos de um ciclo (cresce, fica, apaga)
  function tam() { dpr = Math.min(2, devicePixelRatio || 1); W = c.width = innerWidth * dpr; H = c.height = innerHeight * dpr; c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px'; origem = null; }
  addEventListener('resize', tam); tam();
  function pontoDaFolha() { const r = $('esfera').getBoundingClientRect(); return [(r.left + r.width / 2) * dpr, (r.top + r.height * 0.8) * dpr]; }
  function plantar() {
    segs = []; gotas = []; inicio = performance.now() / 1000; ciclo++;
    const [ox, oy] = origem = pontoDaFolha();
    const pilha = [];
    const celular = innerWidth < 640;
    const raizes = celular ? 3 + Math.floor(Math.random() * 2) : 5 + Math.floor(Math.random() * 3);
    const teto = celular ? 420 : 800;
    for (let k = 0; k < raizes; k++) pilha.push({ x: ox + (k - raizes / 2) * 6 * dpr, y: oy, a: Math.PI / 2 + (k - (raizes - 1) / 2) * 0.38 + (Math.random() - 0.5) * 0.2, prof: 0, dist: 0, pai: -1, vida: 26 + Math.random() * 18 });
    while (pilha.length && segs.length < teto) {
      const p = pilha.shift();
      let { x: px, y: py, a, dist, pai } = p;
      for (let n = 0; n < p.vida && segs.length < teto; n++) {
        const passo = (7 + Math.random() * 6) * dpr;
        a += (Math.random() - 0.5) * 0.35 + (Math.PI / 2 - a) * 0.04;     // serpenteia, tende a descer
        const nx = px + Math.cos(a) * passo, ny = py + Math.sin(a) * passo;
        if (ny > H || nx < 0 || nx > W) break;
        segs.push({ x1: px, y1: py, x2: nx, y2: ny, t: dist / (VEL * dpr), prof: p.prof, pai });
        pai = segs.length - 1; dist += passo; px = nx; py = ny;
        if (p.prof < 3 && Math.random() < 0.07) pilha.push({ x: px, y: py, a: a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5), prof: p.prof + 1, dist, pai, vida: p.vida * 0.55 });
      }
    }
  }
  function caminho(i) { const out = []; while (i >= 0) { out.push(i); i = segs[i].pai; } return out; }
  function quadro(ms) {
    const agora = ms / 1000;
    const [fx, fy] = pontoDaFolha();
    if (!origem || Math.hypot(fx - origem[0], fy - origem[1]) > 40 * dpr || agora - inicio > VIDA) plantar();
    const idade = agora - inicio;
    // com painel na tela as raízes somem (não brigam com os números) e PARAM de
    // ser desenhadas: o fundo parado poupa a TV de refazer o desfoque do vidro
    // a cada quadro (02/out/2026)
    discreto += ((document.body.classList.contains('com-paineis') ? 0 : 1) - discreto) * 0.05;
    if (discreto < 0.01) { if (!parado) { x.clearRect(0, 0, W, H); parado = true; } requestAnimationFrame(quadro); return; }
    parado = false;
    const sumir = Math.max(0, Math.min(1, (VIDA - idade) / 5));      // apaga nos últimos 5 s
    const surgir = Math.min(1, idade / 1.5);
    x.clearRect(0, 0, W, H);
    // camadas de solo
    x.lineWidth = 1 * dpr;
    for (let k = 0; k < 4; k++) {
      const y0 = H * (0.62 + k * 0.1);
      x.strokeStyle = `rgba(125,76,1,${(0.08 - k * 0.012) * discreto})`;
      x.beginPath();
      for (let xx = 0; xx <= W; xx += 24 * dpr) x.lineTo(xx, y0 + Math.sin(xx / (140 * dpr) + k * 1.7 + agora * 0.05) * 6 * dpr);
      x.stroke();
    }
    // raízes
    const vivo = fase === 'falando' ? 1.6 : fase === 'pensando' ? 1.3 : 1;
    x.lineCap = 'round';
    for (const sg of segs) {
      if (sg.t > idade) continue;
      const fresco = Math.min(1, (idade - sg.t) * 2);
      const balanca = Math.sin(agora * 0.8 + sg.y1 / (60 * dpr)) * 1.2 * dpr * vivo;
      x.strokeStyle = `rgba(162,167,42,${(0.16 - sg.prof * 0.035) * fresco * sumir * surgir * discreto})`;
      x.lineWidth = Math.max(0.6, 2.4 - sg.prof * 0.6) * dpr;
      x.beginPath(); x.moveTo(sg.x1 + balanca * 0.6, sg.y1); x.lineTo(sg.x2 + balanca, sg.y2); x.stroke();
    }
    // água e nutrientes subindo pelas raízes já crescidas
    if (gotas.length < (fase === 'falando' ? 40 : 22) && segs.length && Math.random() < 0.3) {
      const pontas = segs.map((s, i) => i).filter((i) => segs[i].t < idade - 1);
      if (pontas.length) { const i = pontas[Math.floor(Math.random() * pontas.length)]; gotas.push({ rota: caminho(i), k: 0, f: 0, nut: Math.random() < 0.35 }); }
    }
    gotas = gotas.filter((g) => g.k < g.rota.length - 1);
    for (const g of gotas) {
      g.f += 0.12 * vivo; while (g.f >= 1 && g.k < g.rota.length - 1) { g.f -= 1; g.k++; }
      const sg = segs[g.rota[Math.min(g.k, g.rota.length - 1)]];
      const px = sg.x2 + (sg.x1 - sg.x2) * g.f, py = sg.y2 + (sg.y1 - sg.y2) * g.f;
      x.fillStyle = g.nut ? `rgba(249,163,34,${0.5 * sumir * discreto})` : `rgba(225,212,155,${0.4 * sumir * discreto})`;
      x.beginPath(); x.arc(px, py, (g.nut ? 1.8 : 1.4) * dpr, 0, 6.29); x.fill();
    }
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
})();
