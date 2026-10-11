// OSCARPES AO VIVO — visor.js
// AMPLIAR: o ZOOM/arrasto dentro da janela em foco e o VISOR (mapa em tela cheia, camadas, ←/→,
// baixar PNG, Esc fecha).
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import { chaveCamada } from './mapas.js?v=20261010213811';
import { $, diag, esc } from './base.js?v=20261010213811';
import { desenharTrilha } from './navegacao.js?v=20261010213811';

// ---------------------------------------------------------------------------
// ZOOM E ARRASTO NO MAPA (só no foco): roda do mouse / pinça do trackpad,
// arrastar, dois dedos no celular, duplo clique, botões + − e ⟲.
// ---------------------------------------------------------------------------
const Zoom = (() => {
  const estado = new WeakMap();
  const MAX = 8;
  function aplicar(q) {
    const s = estado.get(q); if (!s) return;
    const r = q.getBoundingClientRect();
    s.e = Math.min(MAX, Math.max(1, s.e));
    if (s.e <= 1.001) { s.x = 0; s.y = 0; }
    else { s.x = Math.min(0, Math.max(r.width * (1 - s.e), s.x)); s.y = Math.min(0, Math.max(r.height * (1 - s.e), s.y)); }
    s.palco.style.transform = `translate(${s.x}px,${s.y}px) scale(${s.e})`;
    q.classList.toggle('ampliado', s.e > 1.01);
    const ind = q.querySelector('.zoom-valor'); if (ind) ind.textContent = Math.round(s.e * 100) + '%';
  }
  /** zoom em volta do ponto (px, py) do quadro */
  function em(q, fator, px, py) {
    const s = estado.get(q); if (!s) return;
    const r = q.getBoundingClientRect();
    if (px == null) { px = r.width / 2; py = r.height / 2; }
    const novo = Math.min(MAX, Math.max(1, s.e * fator));
    s.x = px - (px - s.x) * (novo / s.e); s.y = py - (py - s.y) * (novo / s.e); s.e = novo;
    aplicar(q);
  }
  function ativo(q) { return !!q.closest('.painel.focado, #visor'); }
  function ligar(q) {
    const img = q.querySelector('img'); if (!img || estado.has(q)) return;
    const palco = document.createElement('div'); palco.className = 'palco';
    q.insertBefore(palco, img); palco.appendChild(img);
    const ctl = document.createElement('div'); ctl.className = 'zoom-ctl';
    ctl.innerHTML = '<button data-z="mais" aria-label="Aproximar">+</button><span class="zoom-valor">100%</span><button data-z="menos" aria-label="Afastar">−</button><button data-z="zerar" aria-label="Ver tudo">⟲</button>';
    q.appendChild(ctl);
    const s = { e: 1, x: 0, y: 0, palco };
    estado.set(q, s);
    ctl.addEventListener('click', (ev) => { ev.stopPropagation(); const z = ev.target.closest('button')?.dataset.z; if (z === 'mais') em(q, 1.5); else if (z === 'menos') em(q, 1 / 1.5); else if (z === 'zerar') { s.e = 1; aplicar(q); } });
    q.addEventListener('wheel', (ev) => {
      if (!ativo(q)) return;
      ev.preventDefault();
      const r = q.getBoundingClientRect();
      em(q, Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.012 : 0.0018)), ev.clientX - r.left, ev.clientY - r.top);   // ctrl = pinça do trackpad
    }, { passive: false });
    q.addEventListener('dblclick', (ev) => { if (!ativo(q)) return; const r = q.getBoundingClientRect(); if (s.e > 1.3) { s.e = 1; aplicar(q); } else em(q, 2.5, ev.clientX - r.left, ev.clientY - r.top); });
    const dedos = new Map(); let pinca = null;
    q.addEventListener('pointerdown', (ev) => {
      if (!ativo(q) || ev.target.closest('.zoom-ctl')) return;
      q.setPointerCapture(ev.pointerId); dedos.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (dedos.size === 2) { const [a, b] = [...dedos.values()]; pinca = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), e: s.e }; }
    });
    q.addEventListener('pointermove', (ev) => {
      if (!dedos.has(ev.pointerId)) return;
      const [ax, ay] = dedos.get(ev.pointerId); dedos.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (dedos.size === 1) { s.x += ev.clientX - ax; s.y += ev.clientY - ay; aplicar(q); return; }
      if (dedos.size === 2 && pinca) {
        const [a, b] = [...dedos.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = q.getBoundingClientRect();
        em(q, (pinca.e * d / pinca.d) / s.e, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
      }
    });
    const solta = (ev) => { dedos.delete(ev.pointerId); if (dedos.size < 2) pinca = null; };
    q.addEventListener('pointerup', solta); q.addEventListener('pointercancel', solta);
  }
  return {
    ligar,
    zerar(painel) { painel.querySelectorAll('.quadro').forEach((q) => { const s = estado.get(q); if (s) { s.e = 1; aplicar(q); } }); },
    aproximar(painel, fator) { const q = painel.querySelector('.quadro'); if (q) em(q, fator); },
  };
})();
const Visor = (() => {
  const v = () => $('visor');
  let camadas = [], i = 0, titulo = '';
  function mostrar() {
    const c = camadas[i]; if (!c) return;
    v().querySelector('.quadro img').src = c.src;
    v().querySelector('.titulo').textContent = titulo + (camadas.length > 1 || titulo !== c.nome ? ` — ${c.nome}` : '');
    const a = v().querySelector('.baixar'); a.href = c.src; a.download = `Mapa_${(c.nome + '_' + titulo).replace(/[^\wÀ-ú]+/g, '_').slice(0, 80)}.png`;
    v().querySelectorAll('.camadas button').forEach((x, k) => x.classList.toggle('on', k === i));
    Zoom.zerar(v());
  }
  return {
    get aberto() { return v().classList.contains('on'); },
    abrir(lista, k, t) {
      camadas = lista; i = Math.max(0, Math.min(k || 0, lista.length - 1)); titulo = t || '';
      const q = v().querySelector('.quadro'); Zoom.ligar(q);
      v().querySelector('.barra .camadas').innerHTML = lista.length > 1 ? lista.map((c, n) => `<button data-camada="${n}">${esc(c.nome)}</button>`).join('') : '';
      v().querySelectorAll('.barra .camadas button').forEach((b) => { b.onclick = () => { i = +b.dataset.camada; mostrar(); }; });
      v().querySelector('.dica').textContent = 'roda ou pinça: zoom · arrastar: mover · duplo clique: aproximar' + (lista.length > 1 ? ' · ← → troca a camada' : '') + ' · Esc fecha';
      v().classList.add('on'); mostrar(); diag('visor ' + lista.length); desenharTrilha();
    },
    fechar() { if (!v().classList.contains('on')) return; v().classList.remove('on'); if (typeof desenharTrilha === 'function') desenharTrilha(); },
    passo(d) { if (camadas.length > 1) { i = (i + d + camadas.length) % camadas.length; mostrar(); } },
    zoom(f) { Zoom.aproximar(v(), f); },
  };
})();
$('visor').querySelector('.fechar-visor').onclick = () => Visor.fechar();
addEventListener('keydown', (e) => {
  if (!Visor.aberto) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); Visor.fechar(); }
  else if (e.key === 'ArrowRight') Visor.passo(1);
  else if (e.key === 'ArrowLeft') Visor.passo(-1);
  else if (e.key === '+' || e.key === '=') Visor.zoom(1.5);
  else if (e.key === '-') Visor.zoom(1 / 1.5);
}, true);
/** As camadas (ou a imagem só, ou os anos) de uma janela → visor. Cada camada (nutriente × profundidade × ano) é uma aba. */
function abrirVisorDaJanela(el, inicio) {
  const b = (el._parte.blocos || []).find((x) => x.tipo === 'camadas' || x.tipo === 'imagem' || x.tipo === 'mapas-anos' || x.tipo === 'fotos'); if (!b) return false;
  if (b.tipo === 'fotos') { Visor.abrir(b.itens.map((x, k) => ({ nome: `${k + 1} de ${b.itens.length} · ${x.legenda}`, src: x.src })), inicio || 0, el._parte.titulo); return true; }
  const rot = (c) => [c.prof ? c.prof + ' cm' : '', c.ano || ''].filter(Boolean).join(' · ');
  if (b.tipo === 'mapas-anos') Visor.abrir(b.itens.map((x) => ({ nome: `${b.param} · ${rot(x)}`, src: x.src })), inicio || 0, el._parte.titulo);
  else if (b.tipo === 'camadas') {
    // as camadas já desenhadas, a escolhida primeiro na ordem: atributo → ano → profundidade
    const lista = Object.entries(b.cache).filter(([, v]) => v && v.src).map(([k, v]) => { const [p, pr, a] = k.split('|'); return { nome: `${p} · ${rot({ prof: pr, ano: a })}`, src: v.src, k }; })
      .sort((x, y) => x.k.localeCompare(y.k, 'pt-BR', { numeric: true }));
    const atual = chaveCamada(b.sel.param, b.sel.prof, b.sel.ano);
    if (lista.length) Visor.abrir(lista, Math.max(0, lista.findIndex((x) => x.k === atual)), el._parte.titulo);
  } else Visor.abrir([{ nome: b.legenda || el._parte.titulo || 'Mapa', src: b.src }], 0, el._parte.titulo);
  return true;
}

export {
  Zoom, Visor, abrirVisorDaJanela,
};
