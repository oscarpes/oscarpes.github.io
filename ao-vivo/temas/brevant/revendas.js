/* ---------------------------------------------------------------------------------------------
   REVENDA ATIVA — a logo da revenda em bolinhas no canto da tela (tema Brevant, 04/out/2026).

   João: "quando ela for falar de mocellin, sobe a logo da mocellin em bolinhas num canto da tela".
   E as regras dele, do mesmo dia:
     - a abertura e o bom dia mostram SÓ a Brevant: a logo de uma revenda só se forma quando ela
       diz que vai falar daquela revenda ("vamos falar sobre a Mocellin");
     - trocou de revenda, troca a logo; com "todas" (apresentação para o gestor) não há logo — a
       não ser a da revenda em FOCO na pergunta ("e a Defender?"), que some quando ela volta ao geral;
     - revenda sem logo: só o nome, em vidro.

   Quem decide a revenda é o SERVIDOR (carteira-revenda.ts, pelo que ela falou); a página só recebe
   o `escopo` da resposta (evento `aovivo-escopo`, disparado pelo motor em ouvido.js) e desenha.
   O mapa logo → arquivo mora em revendas.json (o campo `logo` vem do índice da carteira).
   Também dá à tabela das revendas (desenhos.js) a logo pequena ao lado do nome:
   window.AO_VIVO_LOGO_REVENDA(logo) → endereço do arquivo, ou null.
   --------------------------------------------------------------------------------------------- */
(function () {
  'use strict';
  const TEMA = window.TEMA || {};
  const BASE = TEMA.base || 'temas/brevant/';
  const CALMO = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // --- o mapa e os arquivos que existem de verdade (o primeiro que carregar vale) ---------------
  const achadas = {};        // logo → endereço que carregou
  let mapa = { pasta: '/ao-vivo/revendas/', logos: {} };
  const carregar = (url) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url; });
  async function resolver(logo) {
    if (!logo) return null;
    if (logo in achadas) return achadas[logo];
    const nomes = (mapa.logos || {})[logo] || [`${logo}.svg`, `${logo}.png`];
    for (const n of nomes) {
      if (!/^[a-z0-9-]+\.(png|svg)$/.test(n)) continue;
      const url = (mapa.pasta || '/ao-vivo/revendas/') + n;
      if (await carregar(url)) { achadas[logo] = url; return url; }
    }
    achadas[logo] = null;
    return null;
  }
  const pronto = fetch(BASE + 'revendas.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((m) => {
    if (m && m.logos) mapa = m;
    // já resolve todas (a tabela das revendas pede a logo pequena sem esperar)
    return Promise.all(Object.keys(mapa.logos || {}).map(resolver));
  }).catch(() => null);
  window.AO_VIVO_LOGO_REVENDA = (logo) => (logo && achadas[logo]) || null;

  // --- o canto ---------------------------------------------------------------------------------
  const estilo = document.createElement('style');
  estilo.textContent = `
    #revenda-ativa{position:fixed;bottom:22px;right:22px;z-index:40;display:flex;flex-direction:column-reverse;align-items:flex-end;gap:6px;pointer-events:none;
      opacity:0;transform:translateY(6px);transition:opacity .5s ease,transform .5s ease}
    #revenda-ativa.mostra{opacity:1;transform:none}
    #revenda-ativa .vidro{background:rgba(250,250,252,.10);border:1px solid rgba(250,250,252,.22);border-radius:14px;
      backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:10px 12px;box-shadow:0 8px 28px rgba(0,0,0,.25)}
    #revenda-ativa canvas{display:block;width:190px;height:86px}
    #revenda-ativa .nome{font-family:"Outfit",Inter,sans-serif;font-weight:700;color:#fbfbfc;font-size:20px;letter-spacing:.02em;max-width:280px;text-align:right}
    #revenda-ativa .selo{font-family:"Outfit",Inter,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#f9c48a;opacity:.85}
    @media (max-width:759px){#revenda-ativa{bottom:86px;right:10px}#revenda-ativa canvas{width:140px;height:70px}#revenda-ativa .nome{font-size:15px}}`;
  document.head.appendChild(estilo);
  const caixa = document.createElement('div');
  caixa.id = 'revenda-ativa';
  caixa.setAttribute('aria-live', 'polite');
  document.body.appendChild(caixa);

  let atual = '';          // o que está desenhado agora (chave da logo/nome)
  let quadro = 0;          // a animação das bolinhas

  /** A logo se forma de bolinhas (as cores dela), voando de um espalhado para o lugar. */
  function formarLogo(canvas, img) {
    cancelAnimationFrame(quadro);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 190, H = canvas.clientHeight || 86;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    // amostra a logo num canvas pequeno (cabe no quadro, centrada)
    const f = Math.min(W / (img.naturalWidth || img.width || 1), H / (img.naturalHeight || img.height || 1));
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * f)), h = Math.max(1, Math.round((img.naturalHeight || img.height) * f));
    const ox = (W - w) / 2, oy = (H - h) / 2;
    const am = document.createElement('canvas'); am.width = w; am.height = h;
    const ax = am.getContext('2d', { willReadFrequently: true }); ax.drawImage(img, 0, 0, w, h);
    let px;
    try { px = ax.getImageData(0, 0, w, h).data; } catch (e) { ctx.drawImage(img, ox, oy, w, h); return; }
    const passo = Math.max(2, Math.round(Math.sqrt((w * h) / 1400)));
    const pts = [];
    for (let y = 0; y < h; y += passo) for (let x = 0; x < w; x += passo) {
      const i = (y * w + x) * 4;
      if (px[i + 3] < 110) continue;
      pts.push({ tx: ox + x, ty: oy + y, x: Math.random() * W, y: Math.random() * H * 1.6 - H * 0.3, c: `rgba(${px[i]},${px[i + 1]},${px[i + 2]},${(px[i + 3] / 255).toFixed(2)})`, d: Math.random() * 380 });
    }
    const r = Math.max(1, passo * 0.55);
    const t0 = performance.now(), dur = CALMO ? 0 : 1100;
    const desenhar = (agora) => {
      ctx.clearRect(0, 0, W, H);
      let falta = false;
      for (const p of pts) {
        const k = dur ? Math.min(1, Math.max(0, (agora - t0 - p.d) / dur)) : 1;
        const e = 1 - Math.pow(1 - k, 3);
        if (k < 1) falta = true;
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x + (p.tx - p.x) * e, p.y + (p.ty - p.y) * e, r, 0, Math.PI * 2); ctx.fill();
      }
      if (falta) quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
  }

  function esconder() {
    atual = '';
    cancelAnimationFrame(quadro);
    caixa.classList.remove('mostra');
    setTimeout(() => { if (!atual) caixa.innerHTML = ''; }, 520);
  }

  /** escopo = { chave, nome, logo?, foco?: { chave, nome, logo? } } | null (o servidor manda) */
  async function mostrar(escopo) {
    await pronto;
    if (!escopo) return esconder();
    const todas = escopo.chave === 'todas';
    const alvo = todas ? escopo.foco : escopo;            // com "todas", só a revenda em foco tem logo
    const selo = todas ? 'Todas as revendas' : 'Revenda';
    if (!alvo) {
      // "todas" sem foco: nenhuma logo de revenda — só o selo discreto
      const k = 'todas';
      if (atual === k) return;
      atual = k; cancelAnimationFrame(quadro);
      caixa.innerHTML = `<div class="selo">${esc(selo)}</div>`;
      caixa.classList.add('mostra');
      return;
    }
    const url = await resolver(alvo.logo);
    const k = (url || 'nome:' + alvo.nome) + '|' + selo;
    if (atual === k) return;
    atual = k;
    if (url) {
      caixa.innerHTML = `<div class="vidro"><canvas aria-label="${esc(alvo.nome)}"></canvas></div><div class="selo">${esc(todas ? 'Em foco · ' + alvo.nome : alvo.nome)}</div>`;
      caixa.classList.add('mostra');
      const img = await carregar(url);
      const cv = caixa.querySelector('canvas');
      if (img && cv && atual === k) formarLogo(cv, img);
    } else {
      // sem logo: o nome em vidro
      caixa.innerHTML = `<div class="vidro nome">${esc(alvo.nome)}</div><div class="selo">${esc(todas ? 'Em foco' : 'Revenda')}</div>`;
      caixa.classList.add('mostra');
    }
  }

  window.addEventListener('aovivo-escopo', (e) => { mostrar(e.detail || null).catch(() => {}); });
  // a página que recarrega começa sem revenda (a abertura é só a marca da casa)
  window.RevendaAtiva = { mostrar, esconder };
})();
