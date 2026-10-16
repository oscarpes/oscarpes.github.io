/* ---------------------------------------------------------------------------------------------
   PLAYBOOK DE HÍBRIDOS — tema Brevant da tela ao vivo (03/out/2026).

   João: "quando alguém abrir o Jarvis, puxar para os pontos positivos, janela de plantio que você
   recomenda, colocar do lado de quem, desviar de quem, para cada híbrido … para que o
   representante quando acessar seja MOTIVADO e ENSINADO ao mesmo tempo; SUBA A PLACA DO HÍBRIDO
   quando for falar dele; algo muito futurista". E, no mesmo dia: "Não compare nossos híbridos
   entre eles, pois a estratégia é tentar vender todos; tem que achar competitividade contra os
   concorrentes" — por isso aqui NADA põe um Brevant contra outro: cada um aparece pelos próprios
   méritos contra a concorrência, a ordem é sempre a numérica e "compara B2701 com B2703" é
   recusado com educação.

   Como entra na página: o carregador de tema (index.html) carrega os "modulos" listados no
   tema.json da Brevant DEPOIS do motor (DOMContentLoaded). Sem ?tema=brevant este arquivo nem é
   baixado. Funciona SEM servidor: tudo vem de playbook.json (gerado por
   scripts/brevant/gerar-playbook.py a partir das tabelas da análise — nenhum número é digitado).

   Ligação com o motor (a página é feita de módulos ES; nada aqui mexe dentro deles):
     - window.AO_VIVO (ponte criada pelo main.js SÓ quando o tema tem "modulos"): a voz e a legenda
       do motor, as bolinhas da logo (formar: voam para a placa e para as janelas), fechar as
       janelas do motor e tirar o "Brevant," do começo da frase;
     - window.AO_VIVO_FRASE (definida aqui): o perguntar() do motor pergunta a ela primeiro; se a
       frase é do playbook, resolve aqui; senão o playbook fecha e o motor segue como sempre.
   --------------------------------------------------------------------------------------------- */
(function () {
  'use strict';
  const TEMA = window.TEMA || {};
  const BASE = TEMA.base || 'temas/brevant/';
  const CALMO = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const celular = () => !!(window.matchMedia && matchMedia('(max-width: 759px)').matches);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  // números em português: +5,6 · 84% · 156,4
  const br = (x, casas = 1, sinal = true) => {
    if (x == null || !isFinite(x)) return '—';
    let s = Number(x).toFixed(casas);
    if (sinal && Number(s) > 0) s = '+' + s;
    if (Number(s) === 0) s = Number(0).toFixed(casas);
    return s.replace('-', '−').replace('.', ',');
  };
  const pc = (x) => Math.round(x * 100) + '%';
  const glifos = (html) => String(html).replace(/[º±]/g, (g) => `<i class="pb-glifo">${g}</i>`);
  const sem = (c) => String(c || '').replace(/(PWU|VYHR)$/, '');            // B2701PWU → B2701
  // cores fixas por híbrido (só para distinguir no mapa; nenhuma ordem de mérito)
  const COR = { B2701PWU: '#f47c06', B2702VYHR: '#9ad0ff', B2703PWU: '#ffffff', B2815PWU: '#ffc857', B2884PWU: '#7fd1c7', B2900PWU: '#c9a2ff' };

  // a ponte do motor (main.js) — sem ela (página de outro jeito) o playbook ainda abre pelo clique
  const A = () => window.AO_VIVO || null;
  const usar = (f) => { const a = A(); if (!a) return undefined; try { return f(a); } catch (e) { console.log('[playbook] motor', e); return undefined; } };
  const motor = {
    // a voz diz "B vinte e sete zero um"; a legenda mostra "B2701"
    falar(txt) { if (mudo) return; const tela = HIB.reduce((t, h) => t.split(h.fala_codigo).join(h.codigo), txt); usar((a) => { a.pararVoz(); a.legenda(esc(tela)); a.falar(txt); }); },
    legenda(html) { usar((a) => a.legenda(html)); },
    legendaSome(ms) { usar((a) => a.legendaSome(ms)); },
    formar(els) { usar((a) => a.formar(els)); },
    fecharJanelas() { usar((a) => a.fecharJanelas()); },
    semChamada(t) { const r = usar((a) => a.semChamada(t)); return r == null ? t : r; },
    conversa() { usar((a) => a.abrirConversa()); },
  };

  let mudo = false;                    // modo apresentação: as vistas abrem caladas (quem fala é o roteiro)
  let PB = null;                       // o playbook.json
  let HIB = [];                        // híbridos (ordem numérica)
  let estado = { vista: null };        // o que está na tela
  let quiz = null;                     // { ordem, i, acertos, feitas, respondida }
  let relogioAbas = null;

  // ------------------------------------------------------------------------------------------
  // CAMADA DA TELA
  // ------------------------------------------------------------------------------------------
  const raiz = document.createElement('div');
  raiz.id = 'pb';
  raiz.setAttribute('aria-live', 'polite');
  raiz.innerHTML = '<div class="pb-hud"><span class="pb-hud-rot">PLAYBOOK DE HÍBRIDOS</span><span class="pb-hud-nav"></span><button class="pb-fechar" type="button">FECHAR ✕</button></div><div class="pb-palco"></div>';
  document.body.appendChild(raiz);
  const palco = $('.pb-palco', raiz);
  $('.pb-fechar', raiz).onclick = () => fechar();
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && estado.vista && document.activeElement !== $('#digitado')) fechar(); });
  // clique em qualquer elemento com data-cmd = o mesmo que falar o comando
  raiz.addEventListener('click', (e) => {
    const el = e.target.closest('[data-cmd]');
    if (el) { e.preventDefault(); tratar(el.dataset.cmd, { clique: true }); }
  });

  // 05/out/2026, noite (João: "a abertura dele é ruim… não precisa trazer aquelas sugestões"): sem a dica permanente nem os
  // botões de exemplo — na abertura, só a esfera, a frase e o nome
  // e na tela de INICIAR
  const caixaAbertura = $('#abertura .caixa');
  if (caixaAbertura) {
    const p = document.createElement('p');
    p.className = 'pb-abre-diga';
    p.innerHTML = 'Depois de iniciar, diga: <b>“Brevant, me apresenta o portfólio”</b>';
    const botao = $('#comecar', caixaAbertura);
    caixaAbertura.insertBefore(p, botao || null);
  }

  // ------------------------------------------------------------------------------------------
  // PEÇAS VISUAIS
  // ------------------------------------------------------------------------------------------
  // A PLACA DE CAMPO (João, 03/out: "formato real da placa"): o desenho da placa oficial
  // (~/Downloads/PlacaB2701PWU.pdf, 2000 × 1455) refeito em vetor nas MESMAS medidas — contorno branco
  // com os ombros, meio-disco laranja (o nascer do sol) com a logo empilhada em preto, faixa maroon de
  // ponta a ponta com o código em branco e a faixa branca de baixo LIMPA (no original ela leva logos de
  // tecnologia de terceiros e o endosso — nada disso entra; só a sigla da tecnologia, em texto).
  // SÓ para híbrido Brevant: concorrente nunca ganha placa.
  const CONTORNO = 'M245,575 A789,789 0 0 1 1755,575 L1985,575 L1985,1155 L1862,1155 L1862,1440 L135,1440 L135,1155 L13,1155 L13,575 Z';
  let idPlaca = 0;
  function placa(h, tam = 'g', extra = '') {
    const id = 'pbp' + (++idPlaca);
    return `<div class="pb-placa pb-tam-${tam}" data-cod="${esc(h.completo)}" ${extra}>
      <div class="pb-chapa">
        <svg class="pb-placa-svg" viewBox="0 0 2000 1455" role="img" aria-label="Placa ${esc(h.completo)}">
          <defs><clipPath id="${id}"><path d="${CONTORNO}"/></clipPath>
            <linearGradient id="${id}l" x1="0" x2="1"><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
          <path d="${CONTORNO}" fill="#ffffff" stroke="#cfcfcf" stroke-width="5" stroke-linejoin="round"/>
          <path d="M275,614 A749,749 0 0 1 1725,614 Z" fill="#e77a2b"/>
          <image href="${BASE}logo-placa.png" x="735" y="180" width="530" height="395"/>
          <rect x="52" y="614" width="1895" height="503" fill="#772139"/>
          <text class="pb-placa-cod" x="1000" y="1037" text-anchor="middle" textLength="1640" lengthAdjust="spacingAndGlyphs">${esc(h.completo)}</text>
          <text class="pb-placa-tec" x="1000" y="1318" text-anchor="middle">${esc(h.sufixo)}</text>
          <g clip-path="url(#${id})"><rect class="pb-placa-luz" x="-2000" y="0" width="2000" height="1455" fill="url(#${id}l)"/></g>
        </svg>
      </div>
      <div class="pb-haste"></div>
    </div>`;
  }
  // a frase OFICIAL do híbrido (com fonte no playbook.json) e, separada e rotulada, a nossa leitura
  function frases(h, curto = false) {
    const of = h.slogan ? `<p class="pb-slogan">${esc(h.slogan.texto)}</p>` : '';
    const ins = h.insight ? `<p class="pb-insight"><span>O que os ensaios mostram:</span> ${esc(h.insight)}</p>` : '';
    return `<div class="pb-frases${curto ? ' curto' : ''}">${of}${ins}</div>`;
  }
  // nome de concorrente dentro de texto grande: volta ao tamanho de texto (nunca destaque)
  const discreto = (html) => String(html).replace(/\b(?!B2\d{3})([A-Z]{1,4}\d{2,5}[A-Z0-9]*)\b/g, '<span class="pb-conc">$1</span>');
  const painel = (cls, rot, corpo, i = 0) =>
    `<section class="pb-p ${cls}" style="--i:${i}"><header class="pb-rot"><span>${rot}</span></header><div class="pb-corpo">${corpo}</div></section>`;
  const tag = (cod, num, cmd) => `<span class="pb-tag" style="--c:${COR[cod] || '#f47c06'}" ${cmd ? `data-cmd="${esc(cmd)}"` : ''}><i></i>${esc(sem(cod))}${num != null ? ` <b>${num}</b>` : ''}</span>`;
  const sig = (s) => (s === '**' ? '<em class="pb-sig" title="diferença significativa (p < 0,01)">●●</em>' : s === '*' ? '<em class="pb-sig" title="diferença significativa (p < 0,05)">●</em>' : '');

  function linhaVs(c, cmd) {
    const p = Math.max(0, Math.min(1, c.pct));
    return `<div class="pb-vs ${c.pct >= 0.5 && c.dif > 0 ? 'bom' : 'ruim'}" ${cmd ? `data-cmd="${esc(cmd)}"` : ''}>
      <div class="pb-vs-cab"><b>${esc(c.concorrente)}</b><small>${esc(c.marca || '')}</small><span>${br(c.dif)} <small>sc/ha</small> ${sig(c.sig)}</span></div>
      <div class="pb-vs-barra"><i style="--p:${p}"></i><span>${pc(p)}</span></div>
      <small class="pb-vs-placar">${c.vitorias} de ${c.n} lavouras lado a lado</small>
    </div>`;
  }

  // janela de plantio: as 4 épocas, barra para cima/para baixo do zero, a janela ideal acesa
  function janela(h) {
    const J = h.janela;
    const teto = Math.max(8, ...J.epocas.map((e) => Math.abs(e.v)));
    const cols = J.epocas.map((e) => {
      const ideal = J.ideal.includes(e.id);
      // barra a partir da linha do zero: para cima (ganhou) até 50 px, para baixo (perdeu) até 32 px
      const px = Math.max(2, Math.round((Math.abs(e.v) / teto) * (e.v >= 0 ? 50 : 32)));
      return `<div class="pb-ep ${ideal ? 'ideal' : ''} ${e.v < 0 ? 'neg' : ''}">
        <div class="pb-ep-vao"><i class="${e.v >= 0 ? 'p' : 'n'}" style="height:${px}px"></i></div>
        <b data-n="${e.v}">${br(e.v)}</b><span>${esc(e.rotulo)}</span><small>${pc(e.pct)} · n ${e.n}</small>
      </div>`;
    }).join('');
    return `<div class="pb-tl">${cols}</div><div class="pb-tl-eixo"><span>dez</span><span>20/jan</span><span>05/fev</span><span>20/fev</span><span>mar</span></div><p class="pb-txt">${esc(J.texto)}</p><small class="pb-mudo">sc/ha acima da média dos concorrentes no mesmo local · % de lavouras à frente</small>`;
  }

  // mapa estilizado (RO, MT, MS, GO) com pontos ou quadrículas
  let PROJ = null;
  function projecao() {
    if (PROJ) return PROJ;
    const todos = Object.values(PB.mapa.ufs || {}).flat(3);          // [uf][anel][ponto][lon,lat] → números
    let x0 = 999, x1 = -999, y0 = 999, y1 = -999;
    for (let i = 0; i < todos.length; i += 2) { const lo = todos[i], la = todos[i + 1]; x0 = Math.min(x0, lo); x1 = Math.max(x1, lo); y0 = Math.min(y0, la); y1 = Math.max(y1, la); }
    if (x0 > x1) { x0 = -66; x1 = -46; y0 = -24; y1 = -7; }
    const k = Math.cos(((y0 + y1) / 2) * Math.PI / 180), L = 1000, A = Math.round(((y1 - y0) / ((x1 - x0) * k)) * L);
    PROJ = { L, A, p: (lo, la) => [((lo - x0) / (x1 - x0)) * L, ((y1 - la) / (y1 - y0)) * A], esc: L / ((x1 - x0) * k) };
    return PROJ;
  }
  function svgMapa(desenho) {
    const P = projecao();
    const ufs = Object.entries(PB.mapa.ufs || {}).map(([uf, aneis]) => aneis.map((anel) => `<path class="pb-uf" d="M${anel.map(([lo, la]) => P.p(lo, la).map((v) => v.toFixed(1)).join(',')).join('L')}Z"/>`).join('') +
      (() => { const a = aneis[0]; if (!a) return ''; const cx = a.reduce((s, q) => s + q[0], 0) / a.length, cy = a.reduce((s, q) => s + q[1], 0) / a.length; const [x, y] = P.p(cx, cy); return `<text class="pb-uf-nome" x="${x.toFixed(0)}" y="${y.toFixed(0)}">${uf}</text>`; })()).join('');
    return `<svg class="pb-geo" viewBox="0 0 ${P.L} ${P.A}" preserveAspectRatio="xMidYMid meet"><g>${ufs}</g>${desenho(P)}</svg>`;
  }
  function pontosDoHibrido(h) {
    return svgMapa((P) => h.pontos.slice().sort((a, b) => a[2] - b[2]).map(([lo, la, v], i) => {
      const [x, y] = P.p(lo, la), r = 4 + Math.min(14, Math.abs(v)) * 0.55;
      return `<circle class="${v > 0 ? 'pb-ganhou' : 'pb-perdeu'}" style="--d:${(i % 40) * 18}ms" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/>`;
    }).join(''));
  }
  function quadriculas(foco) {
    return svgMapa((P) => PB.mapa.quadriculas.map((q) => {
      const [x, y] = P.p(q.lon, q.lat + 1), [x2, y2] = P.p(q.lon + 1, q.lat), w = x2 - x, hh = y2 - y;
      const quem = q.quem;
      const n = quem.length, lado = Math.min(w / Math.ceil(Math.sqrt(n)), hh / Math.ceil(n / Math.ceil(Math.sqrt(n)))) - 3;
      const por = Math.ceil(Math.sqrt(n));
      const quad = quem.map((c, i) => {
        const cx = x + 4 + (i % por) * (lado + 3), cy = y + 4 + Math.floor(i / por) * (lado + 3);
        const apaga = foco && c.hib !== foco ? ' style="opacity:.18"' : '';
        return `<rect x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${Math.max(4, lado - 4).toFixed(1)}" height="${Math.max(4, lado - 4).toFixed(1)}" rx="3" fill="${COR[c.hib]}"${apaga}><title>${sem(c.hib)} ${br(c.v)} sc/ha · n ${c.n}</title></rect>`;
      }).join('');
      return `<rect class="pb-quad" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}"/>${quad}`;
    }).join(''));
  }

  // ------------------------------------------------------------------------------------------
  // VISTAS
  // ------------------------------------------------------------------------------------------
  function montar(vista, html, alvosExtra = []) {
    clearInterval(relogioAbas);
    motor.fecharJanelas();
    // 05/out/2026: a apresentação da revenda (carteira.js) e o playbook nunca ficam abertos juntos
    if (window.CarteiraBrevant) window.CarteiraBrevant.fechar(true);
    estado = Object.assign({ vista: vista.tipo }, vista);
    raiz.dataset.vista = vista.tipo;
    palco.innerHTML = html;
    document.body.classList.add('pb-aberto');
    raiz.classList.remove('on'); void raiz.offsetWidth; raiz.classList.add('on');
    $('.pb-hud-nav', raiz).innerHTML = navHud();
    contarNumeros();
    // as bolinhas da logo: primeiro desenham a moldura das placas; depois correm as janelas
    const placas = $$('.pb-placa', palco).slice(0, celular() ? 2 : 4);
    const janelas = $$('.pb-p', palco).slice(0, celular() ? 2 : 8);
    motor.formar([]);
    setTimeout(() => motor.formar(placas.length ? placas : janelas.slice(0, 1)), CALMO ? 0 : 160);
    setTimeout(() => { if (estado.vista === vista.tipo) motor.formar([...placas, ...janelas, ...alvosExtra]); }, CALMO ? 0 : 1300);
    palco.scrollTop = 0;
  }
  function navHud() {
    return HIB.map((h) => `<button data-cmd="me fala do ${h.codigo}" class="${estado.cod === h.completo ? 'on' : ''}">${h.codigo}</button>`).join('') +
      '<button data-cmd="monta o plano para um cliente" class="' + (estado.vista === 'plano' ? 'on' : '') + '">PLANO</button>' +
      '<button data-cmd="mapa de posicionamento" class="' + (estado.vista === 'mapa' ? 'on' : '') + '">MAPA</button>' +
      '<button data-cmd="modo treino" class="' + (estado.vista === 'treino' ? 'on' : '') + '">TREINO</button>';
  }
  function contarNumeros(dentro) {
    if (CALMO) return;
    for (const el of $$('[data-n]', dentro || palco)) {
      const alvo = Number(el.dataset.n), inteiro = el.dataset.fmt === 'int', ini = performance.now(), dur = 900;
      const fmt = (v) => (inteiro ? String(Math.round(v)) : br(v, 1));
      const passo = (t) => { const q = Math.min(1, (t - ini) / dur), e = 1 - Math.pow(1 - q, 3); el.textContent = fmt(alvo * e); if (q < 1) requestAnimationFrame(passo); else el.textContent = fmt(alvo); };
      requestAnimationFrame(passo);
    }
  }
  function fechar(calado) {
    clearInterval(relogioAbas);
    if (!estado.vista) return;
    estado = { vista: null }; quiz = null;
    raiz.classList.remove('on');
    document.body.classList.remove('pb-aberto');
    delete raiz.dataset.vista;
    setTimeout(() => { if (!estado.vista) palco.innerHTML = ''; }, 400);
    motor.formar([]);
    if (!calado) motor.legendaSome(800);
  }

  // --- HÍBRIDO -------------------------------------------------------------------------------
  function vistaHibrido(h, aba = 'defesas') {
    const fortes = h.fortes.map((f, i) => `<div class="pb-forte" style="--j:${i}"><b ${/^[+−-]\d+([.,]\d+)?$/.test(f.valor) ? `data-n="${String(f.valor).replace(',', '.').replace('−', '-')}"` : ''}>${glifos(esc(f.valor))}</b><div><span>${esc(f.rotulo)}</span><small>${esc(f.texto)}</small></div></div>`).join('');
    const aoLado = h.ao_lado.slice(0, 4).map((c) => linhaVs(c, `compara ${h.codigo} com ${c.concorrente}`)).join('');
    const desvie = h.desvie.map((d) => `<div class="pb-desvie" ${d.confronto ? `data-cmd="compara ${h.codigo} com ${d.confronto.concorrente}"` : ''}><b>${esc(d.alvo)}</b><small>${esc(d.dado)}</small><p>${esc(d.como)}</p></div>`).join('');
    const onde = h.posicionar.map((p) => `<div class="pb-onde"><b>${esc(p.rotulo)}</b><span>${esc(p.texto)}</span></div>`).join('');
    const abas = {
      defesas: h.defesas.map((d) => `<div class="pb-def"><b>${esc(d.objecao)}</b><p>${esc(d.resposta)}</p></div>`).join(''),
      estrategia: `<p class="pb-perfil"><b>PERFIL</b> ${esc(h.estrategia.perfil)}</p><ol class="pb-passos">${h.estrategia.passos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>`,
      tecnica: `<p class="pb-txt">${esc(h.tecnica)}</p><p class="pb-mudo">${esc(PB.abertura.ressalva)}</p>`,
    };
    const clima = climaDoHibrido(h.completo);
    if (clima) abas.clima = clima;                // CENÁRIO DE CLIMA: só quando a análise de clima existir
    const ROT = { defesas: 'DEFESAS', estrategia: 'ESTRATÉGIA', tecnica: 'NOTA TÉCNICA', clima: 'CENÁRIO DE CLIMA' };
    const html = `<div class="pb-hib${h.amostra_pequena ? ' pb-amostra' : ''}">
      <div class="pb-col pb-esq">
        ${painel('pb-fortes', 'PONTOS FORTES', fortes, 1)}
        ${painel('pb-janela', 'JANELA DE PLANTIO', janela(h), 2)}
      </div>
      <div class="pb-centro">
        <div class="pb-palco-placa"><div class="pb-chao"></div>${placa(h, 'g')}</div>
        ${frases(h)}
        ${painel('pb-forta', 'FORTALEZA', `<p class="pb-fortaleza">${esc(h.fortaleza)}</p><p class="pb-gatilho"><span>PERGUNTA-GATILHO</span>“${esc(h.gatilho)}”</p>`, 3)}
        ${painel('pb-abas', `<span class="pb-abas-bt">${Object.keys(abas).map((k) => `<button data-aba="${k}" class="${k === aba ? 'on' : ''}">${ROT[k]}</button>`).join('')}</span>`, Object.entries(abas).map(([k, v]) => `<div class="pb-aba ${k === aba ? 'on' : ''}" data-aba="${k}">${v}</div>`).join(''), 4)}
      </div>
      <div class="pb-col pb-dir">
        ${painel('pb-versus', 'COLOQUE AO LADO DE', aoLado + `<header class="pb-rot pb-rot2"><span>DESVIE DE</span></header>` + desvie, 5)}
        ${painel('pb-ondep', 'ONDE POSICIONAR', `<div class="pb-ondes">${onde}</div><div class="pb-minimapa">${pontosDoHibrido(h)}<div class="pb-legmapa"><span><i class="g"></i>ganhou do concorrente</span><span><i class="p"></i>perdeu</span><span>${h.pontos.length} lavouras</span></div></div>`, 6)}
      </div>
    </div>`;
    montar({ tipo: 'hibrido', cod: h.completo }, html);
    // abas: clique ou voz; giram sozinhas a cada 9 s até a pessoa escolher
    const trocar = (k) => { $$('.pb-abas-bt button', palco).forEach((b) => b.classList.toggle('on', b.dataset.aba === k)); $$('.pb-aba', palco).forEach((a) => a.classList.toggle('on', a.dataset.aba === k)); estado.aba = k; };
    $$('.pb-abas-bt button', palco).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); clearInterval(relogioAbas); trocar(b.dataset.aba); }));
    estado.trocarAba = (k) => { clearInterval(relogioAbas); trocar(k); };
    estado.aba = aba;
    const ordem = Object.keys(abas);
    if (!CALMO) relogioAbas = setInterval(() => trocar(ordem[(ordem.indexOf(estado.aba) + 1) % ordem.length]), 9000);
  }

  // --- HÍBRIDO × CONCORRENTE ------------------------------------------------------------------
  function vistaVersus(h, c) {
    const bom = c.pct >= 0.5 && c.dif > 0;
    const dv = h.desvie.find((d) => d.confronto && d.confronto.concorrente === c.concorrente);
    const rival = (PB.inimigos || []).find((r) => r.codigo === c.concorrente);
    const conselho = bom
      ? `<p class="pb-veredito bom">COLOQUE LADO A LADO</p><p class="pb-txt">Janela onde o ${esc(h.codigo)} mais ganha da concorrência: <b>${esc(h.janela.epocas.filter((e) => h.janela.ideal.includes(e.id)).map((e) => e.rotulo).join(' e '))}</b>. ${esc(h.estrategia.passos[0] || '')}</p>`
      : `<p class="pb-veredito ruim">NÃO VIRE DUELO</p><p class="pb-txt">${esc(dv ? dv.como : 'Aqui a conversa é de janela e de ambiente, não de duelo: leve o ' + h.codigo + ' para onde ele ganha da concorrência (veja a janela de plantio) e mostre o placar contra o resto do mercado.')}</p>`;
    const anel = (p) => { const r = 54, C = 2 * Math.PI * r; return `<svg class="pb-anel" viewBox="0 0 140 140"><circle cx="70" cy="70" r="${r}" class="fundo"/><circle cx="70" cy="70" r="${r}" class="frente" style="--off:${(C * (1 - p)).toFixed(1)};--c:${C.toFixed(1)}"/><text x="70" y="66">${pc(p)}</text><text x="70" y="88" class="pq">vitórias</text></svg>`; };
    const html = `<div class="pb-versusv">
      <div class="pb-lado">${placa(h, 'm')}</div>
      <div class="pb-meio">
        ${painel('pb-placar', `${esc(h.codigo)} × ${esc(c.concorrente)}`, `
          <div class="pb-placar-l">${anel(c.pct)}
            <div class="pb-placar-n"><b>${c.vitorias} <small>×</small> ${c.n - c.vitorias}</b><span>placar em ${c.n} lavouras lado a lado</span></div></div>
          <div class="pb-kpis"><div><b data-n="${c.dif}">${br(c.dif)}</b><span>sc/ha em média ${sig(c.sig)}</span></div><div><b>${glifos('±')}${br(c.ic, 1, false)}</b><span>margem (IC 95%)</span></div><div><b>${br(c.umid)}</b><span>p.p. de umidade</span></div></div>
          ${conselho}
          ${rival ? `<p class="pb-mudo">Carta do rival: <a data-cmd="estratégia contra ${rival.codigo}">${esc(rival.codigo)} — ${esc(rival.papel)}</a></p>` : ''}`, 1)}
      </div>
      <div class="pb-lado pb-lado-conc"><small>contra o concorrente</small><span>${esc(c.concorrente)}</span><em>${esc(c.marca || '')}</em></div>
    </div>`;
    montar({ tipo: 'versus', cod: h.completo, rival: c.concorrente }, html);
  }

  // --- RIVAL (carta do inimigo) ---------------------------------------------------------------
  function rivalDe(cod) {
    const r = (PB.inimigos || []).find((x) => x.codigo === cod);
    if (r) return r;
    // concorrente fora da lista principal: monta a carta só com os placares a favor
    const levar = HIB.map((h) => (h.confrontos || []).find((c) => c.concorrente === cod) && Object.assign({ brevant: h.completo }, h.confrontos.find((c) => c.concorrente === cod)))
      .filter((c) => c && c.n >= 8 && c.pct >= 0.5 && c.dif > 0);
    const qualquer = HIB.map((h) => (h.confrontos || []).find((c) => c.concorrente === cod)).find(Boolean);
    if (!qualquer) return null;
    return { codigo: cod, marca: qualquer.marca, papel: levar.length ? 'ALVO DE ATAQUE' : 'CONCORRENTE', postura: levar.length ? 'ataque' : 'cuidado', conversa: levar.length ? 'Leve o placar: os Brevant abaixo ganharam dele lado a lado.' : 'Sem placar a favor com 8+ lavouras: a conversa é de janela e de ambiente, não de duelo.', levar };
  }
  function vistaRival(r) {
    const levar = r.levar.map((c) => {
      const h = HIB.find((x) => x.completo === c.brevant);
      return `<div class="pb-levar" data-cmd="compara ${h.codigo} com ${r.codigo}">${placa(h, 'p')}<div>${linhaVs(c)}</div></div>`;
    }).join('') || '<p class="pb-txt">Nenhum Brevant com placar a favor em 8+ lavouras.</p>';
    const perfil = r.posicao ? `<div class="pb-kpis"><div><b>${r.posicao}${glifos('º')}</b><span>de ${PB.hibridos[0].numeros.de} no ranking ajustado</span></div><div><b>${br(r.media_ajustada, 1, false)}</b><span>sc/ha ajustado</span></div><div><b>${br(r.umid_pp)}</b><span>p.p. de umidade vs concorrentes</span></div>${r.ardido_pp != null ? `<div><b>${br(r.ardido_pp)}</b><span>p.p. de grão ardido</span></div>` : ''}<div><b>${br(r.b, 2, false)}</b><span>b (estabilidade)</span></div></div>` : '';
    const perfilTxt = r.posicao ? `${r.posicao}º de ${PB.hibridos[0].numeros.de} no ranking ajustado · ${br(r.media_ajustada, 1, false)} sc/ha · umidade ${br(r.umid_pp)} p.p.${r.ardido_pp != null ? ' · ardido ' + br(r.ardido_pp) + ' p.p.' : ''} · b ${br(r.b, 2, false)}` : '';
    // João, 03/out: o concorrente não sobe placa nem ganha destaque — é só o assunto, em texto
    // pequeno; o que aparece grande é como cada Brevant ganha dele (onde, quando, em que ambiente)
    const html = `<div class="pb-rivalv2 pb-postura-${r.postura}">
      <p class="pb-sujeito">Como ganhar do <span>${esc(r.codigo)}</span> <small>${esc(r.marca || '')}${perfilTxt ? ' · ' + esc(perfilTxt) : ''}</small></p>
      <div class="pb-rival-grade">
        ${painel('pb-levar-p', `LEVE ${r.levar.length > 1 ? 'ESTES BREVANT' : 'ESTE BREVANT'} · SAFRA`, levar, 1)}
        <div class="pb-col pb-rival-dir">
          ${painel('pb-conversa', 'A CONVERSA', `<p class="pb-fortaleza">${discreto(esc(r.conversa))}</p>`, 2)}
          ${r.janela ? painel('pb-rival-jan', 'NA JANELA: QUEM GANHA DELE EM CADA ÉPOCA', `<div class="pb-rj">${r.janela.map((j) => `<div class="pb-rj-ep"><b>${esc(PB.epocas.find((e) => e.id === j.epoca).rotulo)}</b>${j.quem.map((q) => tag(q.brevant, `${pc(q.pct)} ${br(q.dif)}${q.n < 8 ? ' ·n' + q.n : ''}`, `compara ${sem(q.brevant)} com ${r.codigo}`)).join('') || '<small>sem placar a favor</small>'}</div>`).join('')}</div>` +
            (r.clima && r.clima.length ? `<header class="pb-rot pb-rot2"><span>NO CLIMA</span></header>${r.clima.map((c) => `<div class="pb-situ"><b>${esc(String(c.rotulo).split(' · ')[0])}</b><span>${c.quem.map((q) => tag(q.brevant, `${pc(q.vit)} ${br(q.delta)}${q.n < 8 ? ' ·n' + q.n : ''}`)).join('')}</span></div>`).join('')}` : ''), 3) : ''}
        </div>
      </div>
    </div>`;
    montar({ tipo: 'rival', rival: r.codigo }, html);
  }

  // --- PORTFÓLIO ------------------------------------------------------------------------------
  function vistaPortfolio() {
    const A = PB.abertura;
    const kpis = A.destaques.map((d, i) => `<div class="pb-kpi" style="--j:${i}"><b>${esc(d.valor)}</b><span>${esc(d.rotulo)}</span></div>`).join('');
    const placas = HIB.map((h, i) => `<div class="pb-port" style="--j:${i}" data-cmd="me fala do ${h.codigo}">${placa(h, 'p')}${frases(h, true)}</div>`).join('');
    const html = `<div class="pb-portv">
      <h2 class="pb-titulo">${esc(A.titulo)}</h2><p class="pb-sub">${esc(A.subtitulo)}</p>
      <div class="pb-kpis-port">${kpis}</div>
      <div class="pb-fila">${placas}</div>
      <p class="pb-diga-port">Diga o código (“me fala do B2815”), <a data-cmd="mapa de posicionamento">“mapa de posicionamento”</a>, <a data-cmd="onde o B2815 se destacou">“onde o B2815 se destacou”</a> ou <a data-cmd="modo treino">“modo treino”</a> — ou <a data-cmd="monta o plano para um cliente que planta de 25/jan a 05/mar no Parecis, 1.000 ha">“monta o plano para um cliente que planta de 25/jan a 05/mar no Parecis”</a>.</p>
      <p class="pb-ressalva">${esc(A.ressalva)}</p>
    </div>`;
    montar({ tipo: 'portfolio' }, html, $$('.pb-kpi', palco));
  }

  // --- MAPA DE POSICIONAMENTO -----------------------------------------------------------------
  function vistaMapa(foco) {
    const EP = PB.epocas, AM = PB.ambientes;
    const cab = `<div class="pb-g-c"></div>` + EP.map((e) => `<div class="pb-g-cab">${esc(e.rotulo)}</div>`).join('');
    const linhas = AM.map((a) => `<div class="pb-g-lin">${esc(a.rotulo)}</div>` + EP.map((e) => {
      const g = PB.mapa.grade.find((x) => x.epoca === e.id && x.ambiente === a.id);
      const ativo = foco && foco.epoca === e.id && (!foco.ambiente || foco.ambiente === a.id);
      return `<div class="pb-g-cel ${ativo ? 'foco' : ''} ${g.fonte === 'epoca' ? 'pela-epoca' : ''}">${g.quem.map((c) => tag(c.hib, br(c.v), `me fala do ${sem(c.hib)}`)).join('')}${g.fonte === 'epoca' ? '<small>pela época</small>' : ''}</div>`;
    }).join('')).join('');
    const situ = PB.mapa.situacoes.map((s) => `<div class="pb-situ ${foco && foco.situacao === s.situacao ? 'foco' : ''}"><b>${esc(s.situacao)}</b><span>${s.quem.map((c) => tag(c.hib, br(c.v), `me fala do ${sem(c.hib)}`)).join('') || '<small>—</small>'}</span></div>`).join('');
    const leg = HIB.map((h) => `<span><i style="background:${COR[h.completo]}"></i>${h.codigo}</span>`).join('');
    const html = `<div class="pb-mapav">
      ${painel('pb-grade', 'ÉPOCA × AMBIENTE — QUEM GANHA DA CONCORRÊNCIA', `<div class="pb-gr">${cab}${linhas}</div><small class="pb-mudo">sc/ha acima da média dos concorrentes do mesmo local (5+ lavouras e ≥ 50% de vitórias). Ordem numérica — cada Brevant no seu nicho.</small>`, 1)}
      ${painel('pb-geo-p', 'ONDE CADA BREVANT GANHA (QUADRÍCULAS DE 1°)', `${quadriculas()}<div class="pb-legmapa">${leg}</div>`, 2)}
      ${painel('pb-situ-p', 'SITUAÇÕES', situ, 3)}
    </div>`;
    montar({ tipo: 'mapa' }, html);
    const f = $('.pb-g-cel.foco, .pb-situ.foco', palco);
    if (f && celular()) setTimeout(() => f.scrollIntoView({ block: 'center', behavior: CALMO ? 'auto' : 'smooth' }), 500);
  }

  // --- RECOMENDAÇÃO (pergunta de situação: as placas de quem ganha ali sobem juntas) ---------------
  function vistaRecomendacao(titulo, quem, fonte) {
    const placas = quem.map((c, i) => {
      const h = HIB.find((x) => x.completo === c.hib);
      return `<div class="pb-rec" style="--j:${i}" data-cmd="me fala do ${h.codigo}">${placa(h, 'm')}<div class="pb-rec-n"><b data-n="${c.v}">${br(c.v)}</b><span>sc/ha sobre os concorrentes</span><small>${pc(c.pct)} de vitórias · n ${c.n}</small></div></div>`;
    }).join('');
    const html = `<div class="pb-recv"><h2 class="pb-titulo">${esc(titulo)}</h2><p class="pb-sub">Quem ganha da concorrência nesta situação${fonte === 'epoca' ? ' (pela época — pouco dado no cruzamento)' : ''}</p>
      <div class="pb-fila pb-fila-rec">${placas}</div>
      <p class="pb-diga-port"><a data-cmd="mapa de posicionamento">Ver o mapa de posicionamento completo</a></p>
      <p class="pb-ressalva">${esc(PB.abertura.ressalva)}</p></div>`;
    montar({ tipo: 'recomendacao', titulo }, html);
  }

  // --- PLANO DE PORTFÓLIO NA JANELA ----------------------------------------------------------
  // João, 03/out: "O conceito é o NOSSO contra os OUTROS, em qual posicionamento? E como ENCAIXAR
  // ELES O MÁXIMO JUNTO POSSÍVEL DENTRO DA JANELA". A janela do cliente é cortada nas épocas da
  // análise; em cada pedaço entram TODOS os Brevant que ganham da concorrência ali (fatia época ×
  // região × ambiente do playbook.json, com o recuo dito na tela), cada um com os concorrentes que
  // ele vence naquele pedaço e o que evitar. A área se divide pelos dias de plantio de cada pedaço
  // e, dentro dele, igual entre os Brevant (o que veio de dado mais largo pesa a metade).
  const MES = { dez: 12, jan: 1, fev: 2, mar: 3 };
  const NOME_MES = { 12: 'dez', 1: 'jan', 2: 'fev', 3: 'mar' };
  const diaDe = (m, d) => ({ 12: 0, 1: 31, 2: 62, 3: 90 }[m] ?? NaN) + d;      // dias desde 1º/dez
  const diaMd = (md) => { const [m, d] = md.split('-').map(Number); return diaDe(m, d); };
  const dataDe = (n) => { const m = n > 90 ? 3 : n > 62 ? 2 : n > 31 ? 1 : 12; const d = n - { 12: 0, 1: 31, 2: 62, 3: 90 }[m]; return `${String(d).padStart(2, '0')}/${NOME_MES[m]}`; };
  function lerDatas(bruto) {
    const t = String(bruto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const achadas = [];
    for (const m of t.matchAll(/(\d{1,2})\s*(?:\/|de\s+|\s)\s*(dez|jan|fev|mar)\w*/g)) achadas.push({ i: m.index, d: diaDe(MES[m[2]], +m[1]) });
    for (const m of t.matchAll(/\b(\d{1,2})\/(\d{1,2})\b/g)) { const mm = +m[2]; if ([12, 1, 2, 3].includes(mm)) achadas.push({ i: m.index, d: diaDe(mm, +m[1]) }); }
    return achadas.filter((x) => isFinite(x.d)).sort((a, b) => a.i - b.i).map((x) => x.d);
  }
  function lerArea(bruto) {
    const m = /(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:ha\b|hectare)/i.exec(String(bruto || ''));
    return m ? Number(m[1].replace(/[.\s]/g, '')) : null;
  }
  function lerFiltro(s) {
    if (/baixada|abaixo de 350|baixa altitude|area baixa|terra baixa/.test(s)) return 'BAIXA';
    if (/acima de 500|altitude alta|chapada/.test(s)) return 'ALTA';
    if (/350 a 500|entre 350/.test(s)) return 'MEIA';
    if (/rondonia|cone sul|vilhena/.test(s)) return 'RO';
    if (/parecis|campo novo|sapezal|campos de julio|diamantino|tangara/.test(s)) return 'MT3';
    if (/medio norte|br 163|sorriso|sinop|lucas|nova mutum|vera|ipiranga|nova ubirata/.test(s)) return 'MT2';
    if (/leste|araguaia|canarana|querencia|agua boa|mt1/.test(s)) return 'MT1';
    if (/sul de mt|sul do mt|mato grosso do sul|\bms\b|goias|rondonopolis|primavera|campo verde/.test(s)) return 'SUL';
    return 'todas';
  }
  function calcularPlano(p) {
    const J = PB.plano.janela;
    const slots = [];
    for (const e of J.epocas) {
      const de = Math.max(diaMd(e.de), p.ini), ate = Math.min(diaMd(e.ate), p.fim);
      if (ate < de) continue;
      const quem = (PB.plano.fatias[`${e.id}|${p.fil}|${p.amb}`] || []).map((c) => Object.assign({}, c));
      slots.push({ e, de, ate, dias: ate - de + 1, quem });
    }
    const total = slots.reduce((a, s) => a + s.dias, 0) || 1;
    for (const s of slots) {
      s.frac = s.dias / total;
      const pesos = s.quem.map((c) => (c.nivel === 'exato' ? 1 : 0.5)), soma = pesos.reduce((a, b) => a + b, 0) || 1;
      s.quem.forEach((c, i) => { c.frac = s.frac * pesos[i] / soma; c.ha = p.area ? Math.max(5, Math.round((p.area * c.frac) / 5) * 5) : null; });
    }
    const porHib = new Map();
    for (const s of slots) for (const c of s.quem) { const x = porHib.get(c.hib) || { hib: c.hib, frac: 0, ha: 0, slots: [] }; x.frac += c.frac; x.ha += c.ha || 0; x.slots.push(s.e.id); porHib.set(c.hib, x); }
    return { slots, porHib: [...porHib.values()].sort((a, b) => a.hib.localeCompare(b.hib)) };
  }
  function vistaPlano(p) {
    const { slots, porHib } = calcularPlano(p);
    const J = PB.plano.janela, j0 = diaMd(J.inicio), j1 = diaMd(J.fim), larg = j1 - j0;
    const X = (d) => (((d - j0) / larg) * 100).toFixed(2) + '%';
    const F = PB.plano.filtros.find((x) => x.id === p.fil);
    const filtros = [`JANELA ${dataDe(p.ini)} → ${dataDe(p.fim)}`, F ? F.rotulo.toUpperCase() : 'TODAS AS REGIÕES', p.amb === 'todos' ? 'TODOS OS AMBIENTES' : `AMBIENTE ${p.amb.toUpperCase()}`, p.area ? `${p.area.toLocaleString('pt-BR')} ha` : 'ÁREA: diga “1.000 ha”'].concat(p.clima ? [`CLIMA: ${rotuloClima(p.clima).toUpperCase()}`] : []);
    const regua = `<div class="pb-regua">
      ${J.epocas.map((e) => `<div class="pb-regua-ep" style="left:${X(diaMd(e.de))};width:calc(${X(diaMd(e.ate) + 1)} - ${X(diaMd(e.de))})"><span>${esc(PB.epocas.find((q) => q.id === e.id).rotulo)}</span></div>`).join('')}
      <div class="pb-regua-cli" style="left:${X(p.ini)};width:calc(${X(p.fim + 1)} - ${X(p.ini)})"><span>JANELA DO CLIENTE · ${dataDe(p.ini)} → ${dataDe(p.fim)}</span></div>
      ${['12-20', '01-01', '01-20', '02-05', '02-20', '03-10'].map((md) => `<i class="pb-regua-tick" style="left:${X(diaMd(md))}"><b>${dataDe(diaMd(md))}</b></i>`).join('')}
    </div>`;
    const NIVEL = { exato: '', 'sem ambiente': 'sem filtro de ambiente', 'só época': 'pela época (pouca lavoura na região)' };
    const cards = slots.map((sl, k) => `<section class="pb-p pb-slot" style="--i:${k + 1}">
      <header class="pb-rot"><span>${dataDe(sl.de)} → ${dataDe(sl.ate)}</span></header>
      <div class="pb-corpo"><div class="pb-slot-area">${sl.quem.length} BREVANT · ${pc(sl.frac)} da área${p.area ? ` · ≈ ${Math.round(p.area * sl.frac).toLocaleString('pt-BR')} ha` : ''}</div>
      ${sl.quem.map((c, i) => { const h = HIB.find((x) => x.completo === c.hib); return `<div class="pb-enc" style="--j:${i};--k:${k}" data-cmd="me fala do ${h.codigo}">
        ${placa(h, 'p')}
        <div class="pb-enc-info">
          <div class="pb-enc-n"><b>${br(c.v)}</b><span>sc/ha · ${pc(c.pct)} · n ${c.n}</span>${c.ha ? `<em>≈ ${c.ha.toLocaleString('pt-BR')} ha</em>` : ''}</div>
          ${NIVEL[c.nivel] ? `<small class="pb-nivel">${esc(NIVEL[c.nivel])}</small>` : ''}
          ${p.clima ? (() => { const k = climaDe(c.hib, p.clima); return k ? `<div class="pb-enc-vs ${k.brilha ? '' : 'ruim'}"><span class="pb-mini-rot">${k.brilha ? 'NO CLIMA' : 'CUIDADO'}</span><span class="pb-vchip">${br(k.delta)} sc/ha <b>${pc(k.vit)}</b> n${k.n}</span>${k.brilha ? k.vence.slice(0, 2).map((v) => `<span class="pb-vchip">${esc(v.concorrente)} <b>${pc(v.vit)}</b></span>`).join('') : ''}</div>` : ''; })() : ''}
          <div class="pb-enc-vs"><span class="pb-mini-rot">VENCE</span>${c.vence.map((v) => `<span class="pb-vchip">${esc(v.concorrente)} <b>${pc(v.pct)}</b> ${br(v.dif)}${v.n < 8 ? '<small>·n' + v.n + '</small>' : ''}</span>`).join('') || '<small>—</small>'}</div>
          ${c.evitar.length ? `<div class="pb-enc-vs ruim"><span class="pb-mini-rot">DESVIE</span>${c.evitar.map((v) => `<span class="pb-vchip">${esc(v.concorrente)} <b>${pc(v.pct)}</b></span>`).join('')}</div>` : ''}
        </div></div>`; }).join('') || '<p class="pb-txt">Sem Brevant com vantagem comprovada neste pedaço — fale de manejo e janela.</p>'}
      </div></section>`).join('');
    const resumo = porHib.map((x) => `<span class="pb-res">${tag(x.hib, p.area ? `${Math.round(x.ha).toLocaleString('pt-BR')} ha` : pc(x.frac), `me fala do ${sem(x.hib)}`)}</span>`).join('');
    const clima = climaDoPlano(porHib.map((x) => x.hib), p.clima);
    const html = `<div class="pb-planov">
      <header class="pb-plano-cab"><div><h2 class="pb-titulo">PLANO DE PORTFÓLIO NA JANELA</h2><p class="pb-sub">O nosso contra os outros, encaixado dia a dia na janela de plantio do cliente</p></div>
        <div class="pb-plano-total"><b data-n="${porHib.length}" data-fmt="int">${porHib.length}</b><span>BREVANT<br>NA CONTA</span></div></header>
      <div class="pb-plano-filtros">${filtros.map((f) => `<span>${esc(f)}</span>`).join('')}</div>
      ${regua}
      <div class="pb-slots" style="--n:${slots.length}">${cards}</div>
      <div class="pb-plano-rodape"><span class="pb-mini-rot">DIVISÃO</span>${resumo}${clima}</div>
      <p class="pb-ressalva">${esc(PB.abertura.ressalva)} Área dividida pelos dias de plantio de cada época; dentro dela, igual entre os Brevant.</p>
    </div>`;
    montar({ tipo: 'plano', plano: p }, html);
    return { slots, porHib };
  }

  // --- CENÁRIO DE CLIMA (opcional) ------------------------------------------------------------
  // playbook.json "clima" vem da análise de clima por lavoura (clima_posicionamento.json: chuva
  // combinada calibrada no INMET, temperatura e radiação, fases por graus-dia). Sem ela, null — e a
  // seção some. Sempre Brevant contra concorrente de outra marca.
  const CLIMA_RE = [
    [/chuva (cort|par|acab)\w* cedo|fim das chuvas cedo|seca no enchimento|veranico|chuva cortando|cortar cedo|corta cedo/, 'A3'],
    [/quente e seco|calor no florescimento|seca no florescimento|muito calor|ano quente/, 'A4'],
    [/agua farta|chuva farta|ano chuvoso|chuva boa|muita chuva|chuva ate o enchimento/, 'A1'],
    [/agua regular|chuva regular|ano normal/, 'A2'],
  ];
  const acharClima = (s) => { if (!PB.clima) return null; for (const [re, id] of CLIMA_RE) if (re.test(s)) return id; return null; };
  const climaDe = (cod, id) => ((PB.clima && PB.clima.hibridos[cod]) || []).find((c) => c.id === id) || null;
  const rotuloClima = (id) => { const C = PB.clima; if (!C) return id; const a = C.ambientes.find((x) => x.id === id) || (C.cenarios_chuva || []).find((x) => x.id === id); return a ? a.rotulo : id; };
  function climaDoHibrido(cod) {
    const lista = PB.clima && PB.clima.hibridos[cod];
    if (!lista || !lista.length) return '';
    const card = (c) => `<div class="pb-def pb-clima-c ${c.brilha ? '' : 'cuidado'}"><b>${c.brilha ? 'Em ano de' : 'Cuidado em'} ${esc(c.rotulo)}</b>
      <p>${br(c.delta)} sc/ha sobre a média dos concorrentes · ${pc(c.vit)} · n ${c.n}${c.confianca ? ` · confiança ${esc(c.confianca)}` : ''}</p>
      ${c.vence.length ? `<div class="pb-enc-vs"><span class="pb-mini-rot">LEVE CONTRA</span>${c.vence.map((v) => `<span class="pb-vchip">${esc(v.concorrente)} <b>${pc(v.vit)}</b> ${br(v.delta)}${v.n < 8 ? `<small>·n${v.n}</small>` : ''}</span>`).join('')}</div>` : ''}</div>`;
    const primeiro = (a, b) => (b.brilha ? 1 : 0) - (a.brilha ? 1 : 0);          // onde ele brilha vem antes
    const amb = lista.filter((c) => c.tipo === 'ambiente').sort(primeiro), chuva = lista.filter((c) => c.tipo !== 'ambiente').sort(primeiro);
    return `${amb.map(card).join('')}${chuva.length ? `<p class="pb-mudo" style="margin-top:.6em">CHUVA NO CICLO</p>${chuva.map(card).join('')}` : ''}<p class="pb-mudo">${esc(PB.clima.fonte || '')}</p>`;
  }
  function climaDoPlano(hibs, foco) {
    // agrupado por CENÁRIO de risco (chuva cortando cedo, quente e seco): "se acontecer X, estes
    // Brevant do plano seguem à frente da concorrência" — sem foco, os dois cenários de risco
    if (!PB.clima) return '';
    const ids = foco ? [foco] : ['A3', 'A4'];
    const grupos = ids.map((id) => {
      const quem = hibs.map((h) => climaDe(h, id)).map((c, i) => c && c.brilha ? tag(hibs[i], br(c.delta)) : '').filter(Boolean);
      return quem.length ? `<span class="pb-clima"><b>SE ${esc(String(rotuloClima(id)).split(' · ')[0]).toUpperCase()}:</b> ${quem.join('')}</span>` : '';
    }).filter(Boolean);
    return grupos.length ? `<span class="pb-mini-rot">CENÁRIO DE CLIMA</span>${grupos.join('')}` : '';
  }


  // --- MODO TREINO ----------------------------------------------------------------------------
  function vistaTreino() {
    if (!quiz) {
      const ordem = PB.treino.map((_, i) => i);
      for (let i = ordem.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ordem[i], ordem[j]] = [ordem[j], ordem[i]]; }
      quiz = { ordem, i: 0, acertos: 0, feitas: 0, respondida: false };
    }
    const Q = PB.treino[quiz.ordem[quiz.i % quiz.ordem.length]];
    quiz.respondida = false;
    const ops = Q.opcoes.map((cod) => { const h = HIB.find((x) => x.completo === cod); return `<button class="pb-op" data-op="${cod}">${placa(h, 'p')}</button>`; }).join('');
    const html = `<div class="pb-treinov">
      ${painel('pb-pergunta', `MODO TREINO · ${quiz.feitas + 1}ª PERGUNTA · ${quiz.acertos} ACERTO${quiz.acertos === 1 ? '' : 'S'}`, `<p class="pb-q">${discreto(esc(Q.pergunta))}</p><div class="pb-ops">${ops}</div><div class="pb-feed"></div><p class="pb-mudo">Responda falando o código (“B2815”) ou tocando na placa. “Próxima” pula; “sair do treino” encerra.</p>`, 1)}
    </div>`;
    montar({ tipo: 'treino' }, html);
    $$('.pb-op', palco).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); responder(b.dataset.op); }));
    motor.falar(Q.pergunta.replace(/B(\d{4})(PWU|VYHR)?/g, (m) => falaDe(m)));
  }
  function responder(cod) {
    if (!quiz || quiz.respondida) return;
    const Q = PB.treino[quiz.ordem[quiz.i % quiz.ordem.length]];
    const certo = Q.certas.includes(cod);
    quiz.respondida = true; quiz.feitas++; if (certo) quiz.acertos++;
    $$('.pb-op', palco).forEach((b) => { b.classList.add('feita'); if (Q.certas.includes(b.dataset.op)) b.classList.add('certa'); else if (b.dataset.op === cod) b.classList.add('errada'); });
    const nomes = Q.certas.map((c) => falaDe(c));
    const lista = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0];
    const feed = $('.pb-feed', palco);
    feed.innerHTML = `<p class="pb-veredito ${certo ? 'bom' : 'ruim'}">${certo ? 'ACERTOU!' : 'QUASE!'}</p><p class="pb-txt">${esc(Q.explica)}</p><button class="pb-prox" data-cmd="próxima pergunta">PRÓXIMA ›</button>`;
    $('.pb-rot span', palco).textContent = `MODO TREINO · ${quiz.feitas} FEITA${quiz.feitas === 1 ? '' : 'S'} · ${quiz.acertos} ACERTO${quiz.acertos === 1 ? '' : 'S'}`;
    const elogio = ['Mandou bem!', 'Isso aí!', 'Na mosca!', 'É isso!'][quiz.feitas % 4];
    motor.falar(certo
      ? `${elogio} ${Q.certas.length > 1 ? 'Aqui ganham da concorrência ' + lista + '.' : 'É o ' + lista + '.'} Diga próxima.`
      : `Quase. Aqui quem ganha da concorrência é ${Q.certas.length > 1 ? lista : 'o ' + lista}. Olha os números na tela e diga próxima.`);
    motor.formar([...$$('.pb-op.certa .pb-placa', palco), $('.pb-pergunta', palco)].filter(Boolean));
  }

  // ------------------------------------------------------------------------------------------
  // ENTENDER A FRASE
  // ------------------------------------------------------------------------------------------
  const PALAVRAS = [
    [/vinte e sete zero um|27 zero um/, '2701'], [/vinte e sete zero dois|27 zero dois/, '2702'], [/vinte e sete zero tres|27 zero tres/, '2703'],
    [/vinte e oito quinze|28 quinze/, '2815'], [/vinte e oito oitenta e quatro|28 oitenta e quatro/, '2884'], [/vinte e nove zero zero|vinte e nove mil|29 zero zero/, '2900'],
  ];
  function limpar(t) {
    let s = norm(motor.semChamada(t)).replace(/^(brevant|brevante|brevan|oscar|jarvis)\b ?/, '');
    for (const [re, d] of PALAVRAS) s = s.replace(re, d);
    s = s.replace(/(\d)\s+(?=\d)/g, '$1');              // "27 01" → "2701"
    s = s.replace(/\b([a-z])\s(?=[a-z]\s?\d)/g, '$1');   // "a s 1868" → "as 1868"
    s = s.replace(/\b([a-z]{1,4})\s(?=\d{2,5}\b)/g, '$1'); // "dkb 360" → "dkb360", "b 2701" → "b2701"
    return s;
  }
  function acharHibridos(s) {
    const achados = [];
    const re = /(?:^|[^0-9])(2701|2702|2703|2815|2884|2900)(?![0-9])/g; let m;
    while ((m = re.exec(s))) { const h = HIB.find((x) => x.codigo === 'B' + m[1]); if (h && !achados.includes(h)) achados.push(h); }
    return achados;
  }
  let CONC = null;
  function concorrentes() {
    if (CONC) return CONC;
    const todos = new Map();
    for (const r of PB.inimigos) todos.set(r.codigo, r.marca);
    for (const h of HIB) for (const c of h.confrontos || []) todos.set(c.concorrente, c.marca);
    CONC = [];
    for (const [cod, marca] of todos) {
      const chave = cod.replace(/(PRO\d|VIP\d|PWU|VYHR|R)$/, '');
      const m = /^([A-Z]+)(\d+)/.exec(chave); if (!m) continue;
      const letras = m[1].toLowerCase(), dig = m[2];
      if (/^(2701|2702|2703|2815|2884|2900)$/.test(dig)) continue;
      const re = dig.length >= 3 ? new RegExp(`(?:^|[^0-9a-z])(?:${letras})?${dig}(?![0-9])`) : new RegExp(`(?:^|[^0-9a-z])${letras}${dig}(?![0-9])`);
      CONC.push({ cod, marca, re, principal: PB.inimigos.some((r) => r.codigo === cod) });
    }
    // o principal ganha quando duas variantes têm o mesmo número (ex.: AS1868PRO4)
    CONC.sort((a, b) => (b.principal ? 1 : 0) - (a.principal ? 1 : 0));
    return CONC;
  }
  // 08/out/2026: /agro ?este/ (sem a palavra inteira) — o deploy poda o tema privado da marca procurando o id dela em todo ao-vivo/
  const MARCAS = [[/agro ?este/, 'AS1868PRO4'], [/limagrain/, 'LG36750PRO4'], [/pioneer/, 'P3845VYHR'], [/morgan/, 'MG540PWU'], [/forseed/, 'FS695PWU'], [/nidera/, 'NS99VIP3']];
  function acharConcorrentes(s) {
    const achados = [];
    for (const c of concorrentes()) if (c.re.test(s) && !achados.includes(c.cod)) achados.push(c.cod);
    if (!achados.length) for (const [re, cod] of MARCAS) if (re.test(s)) achados.push(cod);
    return achados;
  }
  function acharEpoca(s) {
    const m = /\b(\d{1,2}) (?:de )?(dez|jan|fev|mar)/.exec(s);
    // 05/out/2026: "depois de 20 de fevereiro" é a E4 (o dia 20 fecha a E3) — igual ao epocaDe do servidor
    const ajuste = m ? (new RegExp('(depois|apos|a partir)( do dia| de| do)? ' + m[0]).test(s) ? 1 : new RegExp('antes( do dia| de| do)? ' + m[0]).test(s) ? -1 : 0) : 0;
    if (m) { const d = +m[1] + ajuste, mes = m[2]; if (mes === 'dez' || (mes === 'jan' && d <= 20)) return 'E1'; if (mes === 'jan' || (mes === 'fev' && d <= 5)) return 'E2'; if (mes === 'fev' && d <= 20) return 'E3'; return 'E4'; }
    if (/tardi|atrasad|fim de fev|final de fev|depois de 20|apos 20|apos o dia 20|marco|safrinha de risco|ultima hora/.test(s)) return 'E4';
    if (/meados de fev|meio de fev|segunda semana de fev|metade de fev/.test(s)) return 'E3';
    if (/comeco de fev|inicio de fev|fim de jan|final de jan/.test(s)) return 'E2';
    if (/\bcedo\b|precoce|comeco de jan|inicio de jan|janeiro/.test(s)) return 'E2';
    return null;
  }
  function acharAmbiente(s) {
    if (/fraco|baixo potencial|ambiente baixo|pobre|menor potencial|arenos|baixo teto|menor teto|ruim|dificil|desafiador/.test(s)) return 'Baixo';
    if (/alto investimento|alto potencial|ambiente alto|ambiente forte|alta tecnologia|tecnificad|ambiente bom|bom ambiente|teto alto/.test(s)) return 'Alto';
    if (/medio potencial|ambiente medio|potencial medio/.test(s)) return 'Médio';
    return null;
  }
  function acharSituacao(s) {
    const S = PB.mapa.situacoes;
    const por = (rot) => S.find((x) => x.situacao === rot);
    if (/baixada|abaixo de 350|baixa altitude|area baixa|terra baixa/.test(s)) return por('Área baixa (< 350 m)');
    if (/acima de 500|altitude alta|chapada/.test(s)) return por('Acima de 500 m');
    if (/rondonia|cone sul/.test(s)) return por('Rondônia');
    if (/parecis/.test(s)) return por('Parecis (MT3)');
    if (/medio norte|br 163|sorriso|sinop|lucas/.test(s)) return por('Médio-Norte (MT2)');
    if (/leste|araguaia|mt1/.test(s)) return por('Leste (MT1)');
    if (/sul de mt|sul do mt|mato grosso do sul|\bms\b|goias/.test(s)) return por('Sul de MT / MS / RO / GO');
    return null;
  }
  const falaDe = (cod) => { const h = HIB.find((x) => x.completo === cod || x.codigo === sem(cod)); return h ? h.fala_codigo : cod; };

  function falarHibrido(h) { motor.falar(h.pitch); }

  /** Devolve true quando a frase foi resolvida pelo playbook. */
  // O QUE A TELA RESOLVE SOZINHA (03/out/2026, teste do João): só COMANDO curto de navegação. Pergunta
  // de verdade ("como o B2701 vai em ano seco contra o AS1868?") vai para o AGENTE — com o contexto da
  // tela — e a resposta dele abre a vista certa (AO_VIVO_TELA_TEMA). Antes a tela pegava o código e
  // repetia o discurso do híbrido.
  const NAVEGA = [
    /^(me )?(fala|mostra|abre|apresenta|traz|traga)( (do|da|de|o|a|me))* ?(b ?\d{4}|portfolio|mapa|plano)/, /^(o )?(b ?)?(2701|2702|2703|2815|2884|2900)$/,
    /^(me )?apresenta o portfolio$|^portfolio$|^o portfolio$/, /^(mostra |abre )?(o )?mapa( de posicionamento)?$|^posicionamento$/,
    /^(modo )?treino$|^me (testa|treina)$|^quiz$/, /^(o )?(proximo|seguinte|proxima)( hibrido| pergunta)?$/,
    /^(fecha|fechar|sair|sai|para|parar|chega)\b/, /^(compara|versus)\b/, /^estrategia contra \w+$|^carta (do|da) \w+$/,
    /apresent\w* o estudo|modo apresentacao/, /^(monta|montar|faz|faca|faça)\b.*\b(portfolio|plano)\b/,
    /^(as )?(defesas?|objecoes|estrategia|tecnica|nota tecnica)$/,
  ];
  function ehComandoLocal(texto, s) {
    if (quiz && estado.vista === 'treino') return true;                         // resposta do treino
    if (/^(monta|montar|faz|faca)\b.*\b(portfolio|plano)\b/.test(s)) return true;   // o plano na janela é da tela
    if (/\?/.test(texto)) return false;
    if (/\b(como|qual|quais|quanto|quantos|quantas|por que|porque|onde|quando|se|comparad\w*|em ano|no ano|vai bem|se comporta)\b/.test(s)) return false;
    if (/\b(clima|chuva|seca|seco|calor|quente|veranico|ambiente|epoca|janela|tardio|cedo)\b/.test(s) && acharHibridos(s).length) return false;
    if (s.split(' ').length > 8) return false;
    return NAVEGA.some((re) => re.test(s));
  }
  function tratar(texto, opc = {}) {
    if (!PB || !texto) return false;
    const s = limpar(texto);
    if (!s) return false;
    if (!opc.clique && !ehComandoLocal(texto, s)) return false;
    const aberto = !!estado.vista;
    const hibs = acharHibridos(s), comps = acharConcorrentes(s);
    // a mesma vista de novo, por voz: não repete o discurso — o agente diz algo novo
    if (!opc.clique && hibs.length === 1 && !comps.length && estado.vista === 'hibrido' && estado.cod === hibs[0].completo && !/defes|objec|estrateg|tecnic/.test(s)) return false;
    if (!opc.clique) motor.legenda(`<span class="voce">${esc(texto)}</span>`);
    motor.conversa();

    // modo treino em andamento: a resposta é um código
    if (quiz && estado.vista === 'treino') {
      if (/\b(sair|parar|encerrar|chega)\b.*(treino|quiz)?|^(sair|chega|parar)$/.test(s) && !hibs.length) { const a = quiz.acertos, f = quiz.feitas; quiz = null; vistaPortfolio(); motor.falar(`Treino encerrado: ${a} acerto${a === 1 ? '' : 's'} em ${f}. Cada resposta é argumento na mão. Bora vender!`); return true; }
      if (/proxim|outra|pula|seguinte|mais uma|next/.test(s)) { if (!quiz.respondida) quiz.feitas++; quiz.i++; vistaTreino(); return true; }
      if (hibs.length === 1 && !quiz.respondida) { responder(hibs[0].completo); return true; }
    }
    if (apresentacao && /^(para|parar|pare|chega|fecha|fechar|sair)\b/.test(s)) { pararApresentacao(); return true; }
    if (/apresent\w* o estudo|modo apresenta|apresentacao do estudo|apresenta tudo/.test(s)) { apresentar(); return true; }
    if (/^(fecha|fechar|sair|sai|fechar tudo|fecha tudo|fecha o playbook|fechar o playbook|sair do playbook)$/.test(s) && aberto) { fechar(); return true; }
    if (/modo treino|\btreino\b|\bquiz\b|me testa|me treina|treinar/.test(s)) { quiz = null; vistaTreino(); return true; }
    if (/\bmont|\bplano\b|combina|encaix|divid|para (um|o|esse|este) cliente|pro cliente|cobrir a janela|janela inteira|janela do cliente/.test(s) && !comps.length) {
      const datas = lerDatas(texto), J = PB.plano.janela;
      let ini = datas[0] ?? diaMd(J.inicio), fim = datas[1] ?? (datas.length === 1 ? Math.min(diaMd(J.fim), datas[0] + 30) : diaMd(J.fim));
      if (fim < ini) [ini, fim] = [fim, ini];
      ini = Math.max(ini, diaMd(J.inicio)); fim = Math.min(fim, diaMd(J.fim));
      const amb = acharAmbiente(s) || 'todos';
      const cl = acharClima(s);
      const r = vistaPlano({ ini, fim, fil: lerFiltro(s), amb, area: lerArea(texto), clima: cl });
      const lista = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1] : xs[0]);
      const nomes = r.porHib.map((x) => falaDe(x.hib));
      const noClima = cl ? r.porHib.filter((x) => (climaDe(x.hib, cl) || {}).brilha).map((x) => falaDe(x.hib)) : [];
      motor.falar(nomes.length
        ? `Cabem ${nomes.length} Brevant na janela desse cliente: ${lista(nomes)}. Cada um entra na época em que ganha da concorrência; os placares e a divisão da área estão na tela.` +
          (cl ? (noClima.length ? ` Em ano de ${rotuloClima(cl)}, seguem à frente da concorrência: ${lista(noClima)}.` : ` Para ${rotuloClima(cl)}, a análise de clima não mostrou vantagem: fale de manejo.`) : '')
        : 'Nessa janela não achei Brevant com vantagem comprovada sobre a concorrência. Tente abrir a região ou o ambiente.');
      return true;
    }
    const climaSolto = acharClima(s);
    if (climaSolto && estado.vista === 'plano' && !hibs.length && !comps.length) {
      const p = Object.assign({}, estado.plano, { clima: climaSolto });
      const r = vistaPlano(p);
      const bons = r.porHib.filter((x) => (climaDe(x.hib, climaSolto) || {}).brilha).map((x) => falaDe(x.hib));
      motor.falar(bons.length ? `Em ano de ${rotuloClima(climaSolto)}, seguem à frente da concorrência: ${bons.join(', ')}. Os placares desse clima estão em cada encaixe.` : `Em ${rotuloClima(climaSolto)}, nenhum Brevant desse plano mostrou vantagem na análise de clima.`);
      return true;
    }
    if (climaSolto && hibs.length === 1 && PB.clima) {
      const h = hibs[0], k = climaDe(h.completo, climaSolto);
      vistaHibrido(h, PB.clima.hibridos[h.completo] ? 'clima' : 'defesas');
      motor.falar(k ? (k.brilha ? `Em ano de ${k.rotulo}, o ${h.fala_codigo} ficou ${br(k.delta, 1, false)} sacas acima da média dos concorrentes${k.vence.length ? ', e ganha do ' + k.vence.slice(0, 2).map((v) => v.concorrente).join(' e do ') : ''}.` : `Em ${k.rotulo}, o ${h.fala_codigo} não mostrou vantagem: posicione pela janela.`) : `Não há dado de clima para o ${h.fala_codigo}.`);
      return true;
    }
    if (/portfolio|me apresenta|apresenta(r)? (os|a|o) (hibridos|brevant|familia)|todos os hibridos|quais (sao )?os hibridos/.test(s) && !hibs.length && !comps.length) {
      vistaPortfolio(); motor.falar(PB.abertura.fala); return true;
    }
    if (/posicionamento|mapa (do|dos|de) (portfolio|hibridos|brevant)|onde posicionar|^mapa$|o mapa/.test(s) && !hibs.length && !comps.length && (aberto || /posicion|hibrid|brevant|portfolio/.test(s))) {
      vistaMapa(); motor.falar('Este é o mapa de posicionamento: cada Brevant tem a época e o ambiente em que ganha da concorrência. Pergunte, por exemplo: qual híbrido para plantio tardio em ambiente fraco?'); return true;
    }
    if (/(proximo|seguinte|outro) (hibrido|brevant)|^(o )?(proximo|seguinte)$|^proxima$/.test(s) && (aberto || /hibrido/.test(s))) {
      const i = HIB.findIndex((h) => h.completo === estado.cod);
      const h = HIB[(i + 1) % HIB.length]; vistaHibrido(h); falarHibrido(h); return true;
    }
    if (hibs.length >= 2) {
      motor.falar('Aqui a gente não compara Brevant com Brevant: cada um tem a sua janela e o seu nicho, e a estratégia é vender todos. Me peça um contra um concorrente, por exemplo: compara B vinte e sete zero um com o MG540.');
      return true;
    }
    if (hibs.length === 1 && comps.length) {
      const h = hibs[0], c = (h.confrontos || []).find((x) => x.concorrente === comps[0]);
      if (!c) { vistaHibrido(h); motor.falar(`Não há lavouras suficientes com o ${h.fala_codigo} lado a lado com o ${comps[0]}. Olha aqui onde ele ganha da concorrência.`); return true; }
      vistaVersus(h, c);
      motor.falar(`${h.fala_codigo} contra o ${c.concorrente}: ${c.vitorias} vitórias em ${c.n} lavouras lado a lado, ${br(Math.abs(c.dif), 1, false)} sacas ${c.dif >= 0 ? 'a mais' : 'a menos'} em média. ` +
        (c.pct >= 0.5 && c.dif > 0 ? 'Coloque lado a lado e mostre o placar.' : 'Aqui não vire duelo: leve a conversa para a janela em que ele ganha da concorrência.'));
      return true;
    }
    if (!hibs.length && comps.length && (/estrateg|contra|ganhar|bater|vencer|enfrentar|rival|concorrente|me fala|fala do|fala da|quem leva|como vender|o que fazer/.test(s) || aberto || s.split(' ').length <= 3)) {
      const r = rivalDe(comps[0]);
      if (r) {
        vistaRival(r);
        const nomes = r.levar.map((c) => falaDe(c.brevant));
        motor.falar(nomes.length ? `Contra o ${r.codigo}: leve ${nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : 'o ' + nomes[0]}. ${String(r.conversa).split(/(?<=[.!?])\s/)[0]}`
          : `Contra o ${r.codigo}, a conversa é de janela, não de duelo. ${r.conversa}`);
        return true;
      }
    }
    if (hibs.length === 1) {
      const h = hibs[0];
      const aba = /defes|objec/.test(s) ? 'defesas' : /estrateg/.test(s) ? 'estrategia' : /tecnic/.test(s) ? 'tecnica' : 'defesas';
      if (estado.vista === 'hibrido' && estado.cod === h.completo && estado.trocarAba) { estado.trocarAba(aba); motor.falar(aba === 'defesas' ? h.defesas[0].resposta : aba === 'estrategia' ? h.estrategia.passos.join(' ') : h.fortaleza); return true; }
      vistaHibrido(h, aba); falarHibrido(h); return true;
    }
    // pergunta de situação: "qual híbrido pro plantio tardio em ambiente fraco?"
    const ep = acharEpoca(s), amb = acharAmbiente(s), sit = acharSituacao(s);
    if ((ep || amb || sit) && (/hibrid|brevant|plant|semente|posicion|recomend|indica|qual|o que|serve|vai bem|levo|levar/.test(s))) {
      const E = PB.epocas.find((x) => x.id === ep);
      if (ep && amb) {
        const g = PB.mapa.grade.find((x) => x.epoca === ep && x.ambiente === amb);
        vistaRecomendacao(`PLANTIO ${E.rotulo.toUpperCase()} · AMBIENTE ${amb.toUpperCase()}`, g.quem, g.fonte);
        motor.falar(`Plantio ${E.rotulo.replace('/', ' de ').replace('–', ' a ')} em ambiente ${amb.toLowerCase()}: ganham da concorrência ${g.quem.map((c) => falaDe(c.hib)).join(', ')}. Toque numa placa para ver o playbook.`);
        return true;
      }
      const S = sit || (ep ? PB.mapa.situacoes.find((x) => x.estrato === 'epoca' && x.nivel === PB.epocas.find((e) => e.id === ep).nome) : null);
      if (S && S.quem.length) {
        vistaRecomendacao(S.situacao.toUpperCase(), S.quem, 'estrato');
        motor.falar(`${S.situacao}: ganham da concorrência ${S.quem.map((c) => falaDe(c.hib)).join(', ')}. Toque numa placa para ver o playbook de cada um.`);
        return true;
      }
      if (amb) {
        vistaMapa({ ambiente: amb });
        motor.falar(`Ambiente ${amb.toLowerCase()}: no mapa, a linha acesa mostra quem ganha da concorrência em cada época.`);
        $$('.pb-g-cel', palco).forEach((c, i) => c.classList.toggle('foco', Math.floor(i / 4) === PB.ambientes.findIndex((a) => a.id === amb)));
        return true;
      }
    }
    // com o playbook aberto: nomes das abas
    if (estado.vista === 'hibrido' && /^(as )?(defesas?|objecoes|estrategia|tecnica|nota tecnica)$/.test(s)) {
      const aba = /defes|objec/.test(s) ? 'defesas' : /estrateg/.test(s) ? 'estrategia' : 'tecnica';
      estado.trocarAba && estado.trocarAba(aba); return true;
    }
    return false;
  }

  // ------------------------------------------------------------------------------------------
  // MODO APRESENTAÇÃO (03/out/2026) — João: "o Jarvis da Brevant apresentando exatamente tudo que
  // achou da planilha, como se falasse sozinho, gravando a tela". O roteiro (PB.apresentacao, gerado
  // com os números da análise) abre cada vista calada e narra por cima. Com `duracoes` (gravação: o
  // áudio é gerado fora, na mesma voz), cada passo dura o tempo do áudio dele e a página não fala.
  // ------------------------------------------------------------------------------------------
  let apresentacao = null;
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const narra = document.createElement('div');
  narra.id = 'pb-narra';
  document.body.appendChild(narra);
  function legendaNarracao(fala, ms) {
    const frases = String(fala).split(/(?<=[.!?])\s+/).filter(Boolean);
    const total = frases.reduce((a, f) => a + f.length, 0) || 1;
    const dur = ms || Math.max(2500, (total / 14) * 1000);
    let t = 0;
    const tela = (f) => HIB.reduce((x, h) => x.split(h.fala_codigo).join(h.codigo), f);
    for (const f of frases) {
      const quando = t; t += (f.length / total) * dur;
      setTimeout(() => { if (apresentacao) { narra.textContent = tela(f); narra.classList.add('on'); } }, quando);
    }
  }
  async function esperarFala(fala) {
    const teto = Date.now() + 6000 + String(fala).length * 110;
    await espera(800);
    while (Date.now() < teto && apresentacao && usar((a) => a.falando())) await espera(250);
  }
  // A CÂMERA (v2, 03/out/2026 — João: "puxe" a janela de cada assunto, "como alguém trabalhando com
  // telas flutuando no ar"): a janela da frase voa para a frente (zoom e deslize suaves), o resto
  // apaga, o número dela acende e conta de novo, as bolinhas correm a borda dela. Ao fim da frase
  // (ou do assunto) ela volta para o lugar.
  let alvoCamera = null;
  function puxar(foco) {
    soltar(true);
    if (!foco || !foco.sel) return;
    if (foco.aba && estado.trocarAba) estado.trocarAba(foco.aba);
    const todos = $$(foco.sel, palco);
    const el = foco.texto ? todos.find((x) => (x.textContent || '').includes(foco.texto)) : todos[0];
    if (!el) return;
    // a posição SEM a câmera (a camada pode estar no meio de outra transição): desfaz a matriz atual
    const W = innerWidth, H = innerHeight, rv = el.getBoundingClientRect();
    let r = rv;
    try {
      const inv = new DOMMatrix(getComputedStyle(raiz).transform === 'none' ? undefined : getComputedStyle(raiz).transform).inverse();
      const p1 = inv.transformPoint(new DOMPoint(rv.left, rv.top)), p2 = inv.transformPoint(new DOMPoint(rv.right, rv.bottom));
      r = { left: p1.x, top: p1.y, width: p2.x - p1.x, height: p2.y - p1.y };
    } catch (e) {}
    if (!r.width || !r.height) return;
    const esc = Math.max(1.04, Math.min(1.9, (W * 0.62) / r.width, (H * 0.56) / r.height));
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const tx = W / 2 - cx * esc, ty = H * 0.46 - cy * esc;
    raiz.style.transformOrigin = '0 0';
    raiz.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${esc.toFixed(3)})`;
    raiz.classList.add('pb-holofote');
    el.classList.add('pb-alvo');
    alvoCamera = el;
    // o número da frase conta de novo e brilha
    for (const n of $$('[data-n], .pb-kpi b, .pb-forte > b, .pb-ep b, .pb-vs-barra span, .pb-plano-total b', el.matches('.pb-kpi, .pb-forte, .pb-ep') ? el.parentElement : el).filter((x) => el.contains(x) || x === el)) n.classList.add('pb-acende');
    contarNumeros(el);
    motor.formar([el]);
  }
  function soltar(semFormar) {
    if (alvoCamera) { alvoCamera.classList.remove('pb-alvo'); $$('.pb-acende', alvoCamera).forEach((n) => n.classList.remove('pb-acende')); }
    alvoCamera = null;
    raiz.classList.remove('pb-holofote');
    raiz.style.transform = '';
    if (!semFormar) motor.formar([...$$('.pb-placa', palco).slice(0, 4), ...$$('.pb-p', palco).slice(0, 8)]);
  }
  async function apresentar(opc = {}) {
    const passos = (PB && PB.apresentacao) || [];
    if (!passos.length) return false;
    const sessao = { ativo: true };
    apresentacao = sessao;
    document.body.classList.add('pb-apresentando');
    for (let i = 0; i < passos.length && apresentacao === sessao; i++) {
      const p = passos[i];
      soltar(true);
      mudo = true;
      try { if (p.comando) tratar(p.comando, { clique: true }); } catch (e) { console.log('[playbook] roteiro', e); } finally { mudo = false; }
      const frases = p.frases || [{ texto: p.fala }];
      for (let j = 0; j < frases.length && apresentacao === sessao; j++) {
        const f = frases[j];
        // a primeira frase do assunto espera a vista montar (a placa sobe, as janelas se formam)
        const montagem = j === 0 && p.comando ? 900 : 0;
        if (montagem) await espera(montagem);
        if (f.foco) puxar(f.foco); else soltar();
        const dur = opc.duracoes ? Math.max(400, opc.duracoes[i][j] - montagem) : null;
        legendaNarracao(f.texto, dur);
        if (dur) await espera(dur);
        else { motor.falar(f.texto); await esperarFala(f.texto); await espera(350); }
      }
      soltar();
      if (opc.duracoes && opc.pausaEntre) await espera(opc.pausaEntre);
    }
    if (apresentacao === sessao) pararApresentacao();
    return true;
  }
  function pararApresentacao() {
    if (!apresentacao) return;
    apresentacao = null;
    narra.classList.remove('on'); narra.textContent = '';
    soltar(true);
    document.body.classList.remove('pb-apresentando');
    usar((a) => a.pararVoz());
  }
  addEventListener('keydown', (e) => { if (e.key === 'Escape') pararApresentacao(); });
  // ?apresentar no endereço: começa sozinha depois do INICIAR (o toque libera o som)
  if (new URLSearchParams(location.search).has('apresentar') && botaoIniciarApresentacao()) { /* ligado */ }
  function botaoIniciarApresentacao() {
    const b = $('#comecar'); if (!b) return false;
    b.addEventListener('click', () => setTimeout(() => { if (PB) apresentar(); }, 2500));
    return true;
  }

  // ------------------------------------------------------------------------------------------
  // A FRASE PASSA PRIMEIRO POR AQUI (o perguntar() do motor chama window.AO_VIVO_FRASE)
  // ------------------------------------------------------------------------------------------
  // O QUE ESTÁ NA TELA, para o agente (vai junto de toda pergunta: "(Na minha tela está aberto: …)")
  function contextoDaTela() {
    if (ctxArg && camadaArg.classList.contains('on')) return ctxArg;
    // 05/out/2026: o mapa dos resultados de GD aberto (mapa-gd.js) também é "o que está na minha tela"
    const mg = window.MapaGDJarvis ? window.MapaGDJarvis.contexto() : '';
    if (mg) return mg;
    // 05/out/2026: a apresentação da revenda aberta (carteira.js) também é "o que está na minha tela"
    const cv = window.CarteiraBrevant ? window.CarteiraBrevant.contexto() : '';
    if (cv) return cv;
    if (!PB || !estado.vista) return '';
    const h = HIB.find((x) => x.completo === estado.cod);
    switch (estado.vista) {
      case 'hibrido': return h ? `playbook do híbrido ${h.completo}${h.slogan ? ' ("' + h.slogan.texto.replace(/[.!]$/, '') + '")' : ''}` : '';
      case 'versus': return h ? `${h.completo} contra o concorrente ${estado.rival} (placar lado a lado)` : '';
      case 'rival': return `carta do concorrente ${estado.rival}: como os Brevant ganham dele`;
      case 'plano': { const p = estado.plano || {}; const F = PB.plano.filtros.find((x) => x.id === p.fil); return `plano de portfólio na janela de plantio ${dataDe(p.ini)} a ${dataDe(p.fim)}, ${F ? F.rotulo : 'todas as regiões'}, ambiente ${p.amb || 'todos'}${p.clima ? ', cenário de clima ' + rotuloClima(p.clima) : ''}`; }
      case 'mapa': return 'mapa de posicionamento dos Brevant (época × ambiente, contra a concorrência)';
      case 'recomendacao': return `recomendação: ${estado.titulo || ''}`;
      case 'portfolio': return 'portfólio Brevant (B2701PWU, B2702VYHR, B2703PWU, B2815PWU, B2884PWU, B2900PWU)';
      case 'treino': return 'modo treino do playbook';
      default: return '';
    }
  }
  // A RESPOSTA DO AGENTE ABRE A VISTA: a consulta playbook_brevant vira placa/versus/carta/plano/mapa
  // COMANDO DE TELA (05/out/2026, 18:17: "volte à página inicial" — o Jarvis disse "voltando" e não voltou). Uma regra só
  // (MapaGD.comandoDeTela, o núcleo): a página resolve na hora; o servidor manda o mesmo comando (comando_de_tela).
  function comandoDeTela(acao, falarJunto) {
    if (acao === 'fechar_mapa') { if (window.MapaGDJarvis) window.MapaGDJarvis.fechar(true); if (falarJunto) motor.falar('Mapa fechado.'); return true; }
    if (acao === 'fechar_ficha') { const c = window.MapaGDJarvis && window.MapaGDJarvis.controle; if (c) c.fecharFicha(); if (falarJunto) motor.falar('Ficha fechada.'); return true; }
    if (acao !== 'inicio') return false;
    fecharArgumento();
    try { if (window.MapaGDJarvis) window.MapaGDJarvis.fechar(true); } catch (e) { /* */ }
    try { if (window.CarteiraBrevant) window.CarteiraBrevant.fechar(true); } catch (e) { /* */ }
    fechar(true);
    motor.fecharJanelas();
    if (falarJunto) motor.falar('Pronto, voltei à tela inicial.');
    return true;
  }
  function telaDoAgente(t) {
    if (!t) return false;
    if (t.ferramenta === 'comando_de_tela') return comandoDeTela(t.resultado && t.resultado.acao, false);
    // 05/out/2026: o mapa de GD guarda o ASSUNTO (híbrido e recorte) da resposta — "quantas áreas ele ganhou?" usa
    try { if (window.MapaGDJarvis && window.MapaGDJarvis.lembrar) window.MapaGDJarvis.lembrar(t); } catch (e) { /* conveniência */ }
    // 05/out/2026: o agente mandou ABRIR o mapa clicável (mapa_resultados_brevant) — a página abre pelo intérprete do mapa
    // 05/out/2026: o servidor manda o COMANDO (resultado.mapa: abrir, lugares, top, area, placar, próxima…) e quem fala é o
    // agente (a fala pronta) — a página executa calada, sem falar de novo
    if (t.ferramenta === 'mapa_resultados_brevant' && window.MapaGDJarvis) {
      fecharArgumento();
      const c = t.resultado && t.resultado.mapa;
      if (c && window.MapaGDJarvis.executar) { try { window.MapaGDJarvis.executar(c); return true; } catch (e) { /* cai no abrir simples */ } }
      try { window.MapaGDJarvis.abrir(null, true); return true; } catch (e) { return false; }
    }
    // 05/out/2026: o argumento da frase oficial / o gráfico de estabilidade abrem as lâminas voadoras
    if (t.ferramenta === 'ensaios_brevant' && t.resultado && t.resultado.argumento) { if (abrirArgumento(t.resultado)) return true; }
    fecharArgumento();
    if (!PB) return false;
    // 05/out/2026 — resposta do agente com outra vista: o mapa dos resultados de GD sai da frente
    if (window.MapaGDJarvis && t.ferramenta !== 'historico_ao_vivo') window.MapaGDJarvis.fechar(true);
    // 05/out/2026 — os dados de venda da revenda abrem a APRESENTAÇÃO dela (carteira.js), não janelas soltas
    if (t.ferramenta === 'dados_carteira' && window.CarteiraBrevant) { if (estado.vista) fechar(true); return window.CarteiraBrevant.abrir(t); }
    if (t.ferramenta !== 'playbook_brevant' && window.CarteiraBrevant) window.CarteiraBrevant.fechar(true);
    if (t.ferramenta !== 'playbook_brevant') { if (estado.vista) fechar(true); return false; }   // painel do motor: o playbook sai da frente
    const a = t.argumentos || {};
    const h = a.hibrido ? acharHibridos(limpar(String(a.hibrido)))[0] : null;
    const c = a.concorrente ? acharConcorrentes(limpar(String(a.concorrente)))[0] : null;
    mudo = true;
    try {
      if (h && c) { const x = (h.confrontos || []).find((y) => y.concorrente === c); if (x) vistaVersus(h, x); else vistaHibrido(h); }
      else if (h) vistaHibrido(h, a.clima && PB.clima && PB.clima.hibridos[h.completo] ? 'clima' : 'defesas');
      else if (c) { const r = rivalDe(c); if (r) vistaRival(r); }
      else if (a.epoca || a.ambiente || a.regiao || a.situacao) {
        const s = limpar([a.epoca, a.ambiente, a.regiao, a.situacao].filter(Boolean).join(' '));
        const ep = acharEpoca(s), amb = acharAmbiente(s);
        const g = ep && amb ? PB.mapa.grade.find((x) => x.epoca === ep && x.ambiente === amb) : null;
        if (g) vistaRecomendacao(`PLANTIO ${PB.epocas.find((e) => e.id === ep).rotulo.toUpperCase()} · AMBIENTE ${amb.toUpperCase()}`, g.quem, g.fonte);
        else vistaMapa();
      } else vistaPortfolio();
    } finally { mudo = false; }
    return true;
  }
  // ------------------------------------------------------------------------------------------
  // ENSAIOS DA REDE NO RECORTE (ensaios_brevant, 05/out/2026) — antes a resposta só era falada e a tela
  // ficava vazia ("como foi o B2815 no MT2?"). As janelas de vidro são as do motor (window.AO_VIVO_DESENHOS,
  // js/telas.js); o conteúdo é o que a voz diz: o "X de Y" POR LAVOURA (à frente da média dos concorrentes
  // da mesma lavoura), as sc/ha sobre os concorrentes e sobre a média do ensaio, de quem são as áreas, o
  // recorte; com híbrido, a estabilidade, os ambientes (alto/médio/baixo, com a distância ao MELHOR
  // concorrente — nunca a outro Brevant), as épocas e os climas, todas as fatias com lavoura, em ordem fixa
  // (nada garimpado). A lista de concorrentes lado a lado só aparece quando a pessoa pede um concorrente.
  // Portão: scripts/conferir-ensaios-rede.ts.
  // ------------------------------------------------------------------------------------------
  const sc1 = (v) => (v == null || !isFinite(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Number(v)).toFixed(1).replace('.', ',')}`);
  const lst = (v) => (Array.isArray(v) ? v : []);
  const kp = (itens) => ({ tipo: 'kpis', itens });
  const tb = (cab, linhas, numericas) => ({ tipo: 'tabela', cab, linhas, numericas: numericas || [] });
  const nt = (texto, cor) => ({ tipo: 'nota', texto, cor });
  function barraEns(v, teto) {
    if (v == null || !isFinite(v)) return '';
    const p = Math.max(3, Math.round((Math.abs(v) / Math.max(1, teto)) * 100));
    return `<span style="display:inline-block;vertical-align:middle;height:.7em;width:${p}%;max-width:100%;border-radius:3px;background:${v >= 0 ? '#F47C06' : 'rgba(255,255,255,.35)'};box-shadow:0 0 10px ${v >= 0 ? 'rgba(244,124,6,.45)' : 'transparent'}"></span>`;
  }
  function fatiasEns(lista, chave) {
    const linhas = lst(lista).filter((x) => x && x.lavouras);
    if (!linhas.length) return null;
    const teto = Math.max(1, ...linhas.map((x) => Math.abs(Number(x.sobre_media_dos_concorrentes_sc_ha) || 0)));
    return tb(['', 'À frente', 'sc/ha', ''], linhas.map((x) => [esc(x[chave] || ''),
      `${esc(x.lavouras_acima_da_media_dos_concorrentes || '')}${x.poucas_lavouras ? ' <small>(poucas)</small>' : ''}`,
      sc1(x.sobre_media_dos_concorrentes_sc_ha), barraEns(x.sobre_media_dos_concorrentes_sc_ha, teto)]), [1, 2]);
  }
  // 05/out/2026: o MEU × o DELA ("por que o meu 2701 foi pior que o da Thammy?") — resumo lado a lado + área por área
  function desenhoComparacao(c, r) {
    // 05/out/2026 (teste headless da demo): a lista área por área (21 + 31 linhas) virava 4 janelas cortadas na TV.
    // Na tela vai o que decide a conversa — o resumo, o porquê provável e o lado a lado POR AMBIENTE e POR ÉPOCA;
    // a lista inteira segue com o agente (ele fala dela) e cada área está no mapa clicável.
    const nomes = c.autores || {}, ks = Object.keys(nomes);
    const curto = (k, alt) => String(nomes[k] || alt).split(' ')[0];
    const eu = curto(ks[0], 'Você'), ela = curto(ks[1], 'Outra');
    const h = HIB.find((x) => x.completo === c.hibrido);
    const titulo = h ? `<span style="display:inline-flex;align-items:center;gap:.5em">${placa(h, 'p', 'style="--w:clamp(120px,9vw,220px)"')}</span>` : null;
    const dec = (v) => v == null ? '—' : String(v).replace('.', ',');
    const kpis = [];
    if (c.resumo_seu) kpis.push([dec(c.resumo_seu.sc_ha_media), `${eu} · sc/ha (${c.resumo_seu.areas} áreas)`], [sc1(c.resumo_seu.vs_concorrentes_sc_ha), `${eu} · sobre conc.`]);
    if (c.resumo_dela) kpis.push([dec(c.resumo_dela.sc_ha_media), `${ela} · sc/ha (${c.resumo_dela.areas} áreas)`], [sc1(c.resumo_dela.vs_concorrentes_sc_ha), `${ela} · sobre conc.`]);
    // lado a lado por um campo (ambiente / época): áreas e sc/ha médio de cada um
    const amb = (x) => /sem classe/.test(String(x.ambiente || '')) ? 'sem classe' : String(x.ambiente || '—').replace(' potencial', '');
    const grupo = (xs, f) => { const m = {}; for (const x of lst(xs)) { const k = f(x); (m[k] = m[k] || []).push(Number(x.sc_ha)); } return m; };
    const lado = (f, ordem) => {
      const a = grupo(c.suas_areas, f), b = grupo(c.areas_dela, f);
      const chaves = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort((x, y) => (ordem ? ordem.indexOf(x) - ordem.indexOf(y) : 0));
      const cel = (v) => v && v.length ? `${dec(Math.round(v.reduce((s, n) => s + n, 0) / v.length * 10) / 10)} <small>(${v.length})</small>` : '—';
      return chaves.map((k) => [esc(k), cel(a[k]), cel(b[k])]);
    };
    const epocas = [...new Set([...lst(c.suas_areas), ...lst(c.areas_dela)].map((x) => x.epoca))];
    return [
      { rotulo: `Ensaios 26S · ${esc(eu)} × ${esc(ela)}`, titulo: c.hibrido, tituloHtml: titulo, sub: `${nomes[ks[1]] || ''}: ${c.recorte_dela} · ${nomes[ks[0]] || ''}: ${c.recorte_seu}`, largo: true,
        blocos: [kp(kpis), ...lst(c.porque_provavel).map((t) => nt('Provavelmente: ' + t, 'ouro')), ...(r.ressalva ? [nt(r.ressalva)] : [])] },
      { rotulo: 'Lado a lado · sc/ha (áreas)', titulo: c.hibrido, tituloHtml: titulo,
        blocos: [tb(['Ambiente', eu, ela], lado(amb, ['alto', 'médio', 'baixo', 'sem classe']), [1, 2]), tb(['Época', eu, ela], lado((x) => x.epoca || '—', epocas), [1, 2]),
          nt('Cada área está no mapa clicável ("mostra o mapa").')] },
    ];
  }
  function desenhoEnsaios(r, a) {
    r = r || {};
    if (r.comparacao_de_areas && !r.comparacao_de_areas.erro) return desenhoComparacao(r.comparacao_de_areas, r);
    const rot = `Ensaios 26S · ${(r.autoria && r.autoria.rotulo) || 'rede'}`;
    if (r.erro) return { rotulo: rot, titulo: r.recorte || 'Ensaios da rede', blocos: [nt(r.detalhe || r.instrucao || 'Sem resultado para esse recorte.')] };
    if (!lst(r.brevant).length) return { rotulo: rot, titulo: r.recorte || 'Ensaios da rede', blocos: [nt(r.aviso || r.hibrido_sem_dado || 'Nenhuma lavoura com Brevant e concorrente neste recorte.')] };
    const foco = r.hibrido_em_foco, ressalva = r.ressalva ? [nt(r.ressalva)] : [];
    if (!foco || !foco.hibrido) {
      const t = r.time_brevant_contra_concorrentes || {};
      return [{ rotulo: rot, titulo: r.recorte || 'Ensaios da rede', largo: true, blocos: [
        kp([[String(r.lavouras_com_brevant_e_concorrente ?? '—'), 'lavouras com Brevant e concorrente'], [String(r.cidades ?? '—'), 'cidades'], [t.vitorias_pct != null ? `${t.vitorias_pct}%` : null, 'dos confrontos com o Brevant à frente']]),
        tb(['Híbrido', 'À frente', 'sc/ha', 'Lavouras'], lst(r.brevant).map((x) => [esc(x.hibrido), esc(x.lavouras_acima_da_media_dos_concorrentes || ''), sc1(x.sobre_media_dos_concorrentes_sc_ha), String(x.lavouras)]), [1, 2, 3]),
        ...ressalva] }];
    }
    const b = lst(r.brevant).find((x) => x.hibrido === foco.hibrido) || {};
    const conc = (a && a.concorrente && lst(foco.lado_a_lado_com)[0]) || null;
    // 05/out/2026 (João: "use a placa dele ao invés de digitar o número dele"): o título da janela é a PLACA oficial
    const h = HIB.find((x) => x.completo === foco.hibrido);   // a placa só recebe híbrido Brevant (portão)
    const tituloPlaca = h ? `<span style="display:inline-flex;align-items:center;gap:.5em">${placa(h, 'p', 'style="--w:clamp(120px,9vw,220px)"')}${conc ? `<span>× ${esc(conc.concorrente)}</span>` : ''}</span>` : null;
    const jan = [{ rotulo: rot, titulo: conc ? `${foco.hibrido} × ${conc.concorrente}` : foco.hibrido, tituloHtml: tituloPlaca, sub: r.recorte, largo: true, blocos: [
      kp([[b.lavouras_acima_da_media_dos_concorrentes, conc ? `lavouras à frente do ${conc.concorrente}` : 'lavouras à frente da média dos concorrentes'],
        [sc1(b.sobre_media_dos_concorrentes_sc_ha), conc ? `sc/ha sobre o ${conc.concorrente}, na média` : 'sc/ha sobre a média dos concorrentes'],
        [sc1(b.vantagem_sobre_media_do_ensaio_sc_ha), 'sc/ha sobre a média do ensaio']]),
      ...(b.poucas_lavouras ? [nt('Poucas lavouras neste recorte: é indicação, não padrão.', 'ouro')] : []), ...ressalva] }];
    // pergunta de CLIMA: a janela do clima vem logo depois da principal e as outras ficam de fora (no máximo 4 janelas)
    const cl = fatiasEns(foco.por_clima, 'cenario');
    if (a && a.clima) {
      if (cl) jan.push({ rotulo: 'Por clima da lavoura', titulo: '', blocos: [cl, nt('sc/ha sobre a média dos concorrentes da mesma lavoura')] });
      return jan;
    }
    const es = foco.estabilidade;
    const npos = es && es.no_posicionamento && es.no_posicionamento.mais_estavel;
    if (npos) {
      jan.push({ rotulo: 'Estabilidade', titulo: '', blocos: [
        kp([['1º', 'mais estável do posicionamento'], [String(es.desvio_da_regressao_sc_ha).replace('.', ','), 'sc/ha de desvio'], [String(es.b).replace('.', ','), 'b (1 = acompanha)']]),
        nt(`concorrentes do segmento médio/alto investimento, sem nome · ${es.lavouras} lavouras dele com 3+ híbridos`)] });
    } else if (es && es.desvio_da_regressao_sc_ha != null) {
      jan.push({ rotulo: 'Estabilidade', titulo: '', blocos: [
        kp([[String(es.desvio_da_regressao_sc_ha).replace('.', ','), 'sc/ha de desvio'], [es.desvio_mediano_dos_concorrentes_sc_ha != null ? String(es.desvio_mediano_dos_concorrentes_sc_ha).replace('.', ',') : null, 'desvio dos concorrentes'],
          [String(es.b).replace('.', ','), 'b (1 = acompanha)']]),
        nt('desvio da regressão: menor = mais previsível'),
        nt(`${es.posicao_no_desvio} · ${es.lavouras} lavouras com 3+ híbridos`)] });
    }
    const am = lst(foco.por_ambiente).filter((x) => x && x.lavouras);
    if (am.length) {
      // na tela, 3 colunas (a janela tem 1/3 da TV); "até o melhor" e "a até 5 %" seguem com o agente
      jan.push({ rotulo: 'Por ambiente', titulo: '', blocos: [
        tb(['', 'À frente', 'sc/ha'], am.map((x) => [esc(String(x.ambiente || '').replace(' potencial', '')), esc(x.lavouras_acima_da_media_dos_concorrentes || ''), sc1(x.sobre_media_dos_concorrentes_sc_ha)]), [1, 2]),
        nt('À frente = acima da média dos concorrentes da mesma lavoura · ambiente = terço da média do ensaio')] });
    }
    const ep = fatiasEns(foco.por_epoca, 'epoca');
    if (ep) jan.push({ rotulo: 'Por época de plantio', titulo: '', blocos: [ep, nt('sc/ha sobre a média dos concorrentes da mesma lavoura')] });
    // a PLACA só na primeira janela (05/out/2026, ensaio da demo: repetida nas 4, comia o espaço e cortava as tabelas)
    return jan;
  }

  // ------------------------------------------------------------------------------------------
  // O ARGUMENTO DA FRASE OFICIAL E O GRÁFICO DE ESTABILIDADE (05/out/2026, vídeo do B2815) — a consulta
  // ensaios_brevant com pedido=argumento/grafico. Cada ponto do argumento é uma LÂMINA DE VIDRO que voa para
  // o lugar quando a voz chega nele (inicio_s, contado a partir do momento em que a voz começa); a 1ª traz o
  // gráfico X-Y (x = média do ensaio da lavoura, y = produtividade): uma reta por híbrido, o Brevant em
  // laranja com os pontos dele, os concorrentes em linhas finas e esmaecidas, SEM NOME. Nada de "desvie de".
  // ------------------------------------------------------------------------------------------
  // 05/out/2026, à tarde (João, na TV LG 4K em tela cheia: "ficou muito ruim … use a placa dele"; o print dele: as 6
  // lâminas num mosaico espremido, texto cortado, a dica por cima, letra pequena). Desenho NOVO, uma lâmina por vez:
  //   • no topo, a PLACA oficial do híbrido (o vetor da placa — nunca o código digitado) + a frase oficial;
  //   • à esquerda, o gráfico de estabilidade (fica); à direita, o PALCO: UMA lâmina grande, que voa no trecho da
  //     fala e dá lugar à próxima; embaixo dele, a trilha dos pontos (o atual aceso);
  //   • letra nunca abaixo de 14 px (o mínimo da auditoria), tamanhos pela altura da tela (TV), nada de blur pesado;
  //   • enquanto as lâminas estão abertas, a dica, os botões, a legenda e o "OUVINDO" saem da frente.
  // A ficha: o topo com a placa e 4 placas de vidro em 2 × 2 que se montam em sequência.
  const estiloArg = document.createElement('style');
  estiloArg.textContent = `
  #pb-arg{position:fixed;inset:0;z-index:4;display:none;pointer-events:none;font-family:"Outfit",system-ui,sans-serif;color:#fbfbfc;
    --lado:clamp(16px,2.4vw,56px);--topo:calc(env(safe-area-inset-top) + clamp(78px,9vh,120px));--base:calc(env(safe-area-inset-bottom) + clamp(96px,11vh,150px));
    --txt:clamp(15px,1.05vw + .5vh,26px);--th:clamp(92px,15vh,230px);--txt2:clamp(14px,.8vw + .45vh,21px);--num:clamp(54px,6vw + 3vh,170px)}
  #pb-arg.on{display:block}
  body.pb-arg-aberto #pb-dica,body.pb-arg-aberto #legenda,body.pb-arg-aberto #estado{opacity:0!important;pointer-events:none!important;transition:opacity .4s}
  #pb-arg .vidro{pointer-events:auto;border-radius:18px;background:linear-gradient(140deg,rgba(78,10,32,.88),rgba(40,4,16,.9));border:1px solid rgba(255,190,140,.32);
    box-shadow:0 22px 60px rgba(10,0,4,.55),inset 0 1px 0 rgba(255,255,255,.14)}
  #pb-arg .arg-topo{position:absolute;left:var(--lado);right:calc(var(--lado) + 110px);top:var(--topo);height:var(--th);display:flex;align-items:center;gap:clamp(14px,1.6vw,36px);
    opacity:0;transform:translateY(-16px);transition:opacity .7s ease,transform .8s ease}
  #pb-arg .arg-topo.voou{opacity:1;transform:none}
  #pb-arg .arg-topo .pb-placa{--w:calc(var(--th) * 1.25);flex:none}
  #pb-arg .arg-topo .pb-placa .pb-chapa{margin:0}
  #pb-arg .arg-topo .pb-placa .pb-haste{display:none}
  #pb-arg .arg-frase{font:700 clamp(18px,1.3vw + .9vh,38px)/1.15 "Outfit",sans-serif;color:#fff;text-wrap:balance}
  #pb-arg .arg-frase small{display:block;margin-top:.35em;font:600 var(--txt2)/1.2 "Outfit",sans-serif;letter-spacing:.06em;color:#ffcfa6;text-transform:uppercase}
  #pb-arg .arg-corpo{position:absolute;left:var(--lado);right:var(--lado);top:calc(var(--topo) + var(--th) + 14px);bottom:var(--base);display:grid;grid-template-columns:1.12fr 1fr;gap:clamp(12px,1.2vw,28px)}
  #pb-arg.so-grafico .arg-corpo{grid-template-columns:1fr}
  #pb-arg .arg-graf{display:flex;flex-direction:column;min-height:0;padding:clamp(12px,1.2vh,22px) clamp(14px,1.2vw,26px);opacity:0;transform:translateX(-40px) scale(.97);transition:opacity .8s ease,transform 1s cubic-bezier(.2,.9,.2,1)}
  #pb-arg .arg-graf.voou{opacity:1;transform:none}
  #pb-arg .arg-tit{font:800 var(--txt2)/1 "Outfit",sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#F7953A}
  #pb-arg .arg-svg{flex:1;min-height:0;width:100%;margin-top:.4em}
  #pb-arg .arg-svg .reta{fill:none;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1.6s ease}
  #pb-arg .arg-svg.desenha .reta{stroke-dashoffset:0}
  #pb-arg .arg-svg .pt{opacity:0;transition:opacity .5s ease}
  #pb-arg .arg-svg.desenha .pt{opacity:1}
  #pb-arg .arg-leg{display:flex;flex-wrap:wrap;gap:.4em 1.4em;font:500 var(--txt2)/1.3 "Outfit",sans-serif;color:#f1dfe3;margin-top:.4em}
  #pb-arg .arg-leg i{display:inline-block;width:1.6em;height:.32em;border-radius:3px;vertical-align:middle;margin-right:.45em}
  #pb-arg .arg-lado{display:flex;flex-direction:column;min-height:0;gap:clamp(10px,1.2vh,18px)}
  #pb-arg .arg-palco{position:relative;flex:1;min-height:0}
  #pb-arg .arg-l{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:clamp(16px,2.2vh,40px) clamp(18px,1.8vw,44px);overflow:hidden;
    opacity:0;transform:translate3d(70px,30px,0) rotateY(-12deg) scale(.94);transition:opacity .8s ease,transform 1s cubic-bezier(.2,.9,.2,1);pointer-events:none}
  #pb-arg .arg-l.agora{opacity:1;transform:none;pointer-events:auto}
  #pb-arg .arg-l.passou{opacity:0;transform:translate3d(-60px,-20px,0) scale(.92)}
  #pb-arg .arg-num{font:400 var(--num)/.95 "Anton","Outfit",sans-serif;color:#fff;margin:.12em 0 .1em;text-shadow:0 0 30px rgba(244,124,6,.5)}
  #pb-arg .arg-rot{font:700 var(--txt)/1.25 "Outfit",sans-serif;color:#fff}
  #pb-arg .arg-det{font:400 var(--txt2)/1.4 "Outfit",sans-serif;color:#f1dfe3;margin-top:.55em}
  #pb-arg .arg-trilha{display:flex;flex-wrap:wrap;gap:8px}
  #pb-arg .arg-trilha span{font:700 var(--txt2)/1 "Outfit",sans-serif;padding:.55em .9em;border-radius:999px;border:1px solid rgba(255,190,140,.3);color:#e8d2d7;background:rgba(40,4,16,.7);transition:all .5s}
  #pb-arg .arg-trilha span.agora{background:#F47C06;color:#2a0410;border-color:#F47C06;box-shadow:0 0 22px rgba(244,124,6,.55)}
  #pb-arg .arg-trilha span.passou{color:#ffcfa6;border-color:rgba(244,124,6,.6)}
  #pb-arg .arg-eps{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:clamp(10px,1vw,22px);margin-top:.8em;align-items:end}
  #pb-arg .arg-ep{display:flex;flex-direction:column;align-items:stretch;text-align:center;gap:.35em}
  #pb-arg .arg-ep b{font:400 clamp(30px,2vw + 1.6vh,72px)/1 "Anton",sans-serif;color:#fff}
  #pb-arg .arg-ep i{display:block;height:clamp(18px,2.6vh,40px);border-radius:8px;background:linear-gradient(90deg,#F47C06,#ffb15c);box-shadow:0 0 16px rgba(244,124,6,.45);transform-origin:left;transform:scaleX(0);transition:transform 1.1s ease .3s}
  #pb-arg .agora .arg-ep i{transform:scaleX(var(--f,1))}
  #pb-arg .arg-ep span{font:700 var(--txt2)/1.2 "Outfit",sans-serif;color:#fff}
  #pb-arg .arg-ep small{font:500 var(--txt2)/1.2 "Outfit",sans-serif;color:#ffcfa6}
  #pb-arg .arg-chips{display:grid;grid-template-columns:1fr 1fr;gap:clamp(8px,1vh,16px);margin-top:.8em}
  #pb-arg .arg-chip{display:flex;gap:.6em;align-items:flex-start;padding:.7em .9em;border-radius:14px;background:rgba(244,124,6,.13);border:1px solid rgba(244,124,6,.5);font:700 var(--txt2)/1.2 "Outfit",sans-serif;color:#fff}
  #pb-arg .arg-chip svg{flex:none;width:1.4em;height:1.4em}
  #pb-arg .arg-chip small{display:block;font-weight:400;color:#f1dfe3;margin-top:.2em}
  #pb-arg .arg-fonte{font:400 var(--txt2)/1.3 "Outfit",sans-serif;color:#d7c0c6;margin-top:.7em}
  #pb-arg .arg-fechar{position:absolute;right:var(--lado);top:calc(var(--topo) + 4px);pointer-events:auto;background:rgba(34,3,12,.75);border:1px solid rgba(245,136,7,.45);color:#f3e6ea;font:800 var(--txt2) "Outfit",sans-serif;letter-spacing:.12em;padding:.6em 1.1em;border-radius:999px;cursor:pointer}
  /* a FICHA: 4 placas 2 × 2, todas à vista */
  #pb-arg.ficha{--txt:clamp(14px,.62vw + .5vh,22px);--txt2:clamp(14px,.5vw + .45vh,19px);--th:clamp(80px,12vh,190px)}
  #pb-arg.ficha .arg-corpo{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:clamp(10px,1vw,22px)}
  #pb-arg.ficha .arg-l{position:relative;inset:auto;justify-content:flex-start;padding:clamp(10px,1.4vh,26px) clamp(14px,1.2vw,30px)}
  #pb-arg.ficha .arg-comp{grid-template-columns:1.4fr 1fr;flex:1;min-height:0;height:auto}
  #pb-arg.ficha .arg-comp > div{min-height:0;height:100%;display:flex;align-items:center}
  #pb-arg.ficha .arg-comp > div:first-child{display:grid;grid-template-columns:1fr;align-content:center;gap:.1em}
  #pb-arg.ficha .arg-comp .n{font-size:clamp(26px,1.6vw + 1.6vh,70px)}
  #pb-arg.ficha .arg-comp .r{margin:0 0 .35em}
  #pb-arg.ficha .arg-comp svg{max-height:100%;height:100%;width:100%}
  @media (max-height:780px){#pb-arg.ficha{--th:76px;--base:calc(env(safe-area-inset-bottom) + 86px)}#pb-arg.ficha .arg-tab td{padding:.3em .2em}#pb-arg.ficha .arg-tab{border-spacing:3px}
    #pb-arg.ficha .arg-doe{gap:.3em;margin-top:.4em}#pb-arg.ficha .arg-pares{gap:.25em .8em}#pb-arg.ficha .arg-det{margin-top:.3em;line-height:1.25}#pb-arg.ficha .arg-doe i{padding:.3em .6em}}
  #pb-arg .arg-tab{width:100%;border-collapse:separate;border-spacing:5px;margin-top:.5em;font:600 var(--txt)/1.2 "Outfit",sans-serif}
  #pb-arg .arg-tab th{font:700 var(--txt2)/1.2 "Outfit",sans-serif;color:#f1dfe3;text-align:center;padding:4px}
  #pb-arg .arg-tab td{text-align:center;padding:.5em .3em;border-radius:9px;background:rgba(255,255,255,.08);color:#fff}
  #pb-arg .arg-tab td:first-child{text-align:left;background:none;color:#f3e6ea}
  #pb-arg .arg-tab td.forte{background:rgba(244,124,6,.38);box-shadow:inset 0 0 0 1px rgba(244,124,6,.75)}
  #pb-arg .arg-pares{display:grid;grid-template-columns:auto 1fr;gap:.45em 1em;margin-top:.6em;font:400 var(--txt)/1.3 "Outfit",sans-serif}
  #pb-arg .arg-pares b{color:#F7953A;font:800 var(--txt2)/1.3 "Outfit",sans-serif;text-transform:uppercase;letter-spacing:.08em}
  #pb-arg .arg-doe{display:flex;flex-direction:column;gap:.55em;margin-top:.6em}
  #pb-arg .arg-doe div{display:flex;gap:.8em;align-items:baseline;font:400 var(--txt)/1.3 "Outfit",sans-serif;color:#fff}
  #pb-arg .arg-doe i{font-style:normal;flex:none;font:800 var(--txt2)/1 "Outfit",sans-serif;text-transform:uppercase;padding:.45em .7em;border-radius:999px;background:rgba(244,124,6,.2);border:1px solid rgba(244,124,6,.6);color:#ffd9b8}
  #pb-arg .arg-doe i.fraco{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.3);color:#e2cdd2}
  #pb-arg .arg-comp{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;align-items:center}
  #pb-arg .arg-comp .n{font:400 clamp(34px,2.6vw + 1.6vh,84px)/1 "Anton","Outfit",sans-serif;color:#fff;text-shadow:0 0 20px rgba(244,124,6,.5)}
  #pb-arg .arg-comp .r{font:500 var(--txt2)/1.25 "Outfit",sans-serif;color:#f3e6ea;margin:.2em 0 .6em}
  #pb-arg .arg-comp svg{width:100%;max-height:26vh}
  #pb-arg .arg-comp .uf{fill:rgba(255,255,255,.08);stroke:rgba(255,255,255,.45);stroke-width:2}
  #pb-arg .arg-comp .reg{fill:rgba(244,124,6,.8);stroke:#ffd9b8;stroke-width:2}
  #pb-arg .arg-selo{font:800 var(--txt2)/1 "Outfit",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#2a0410;background:#F47C06;padding:.6em 1em;border-radius:999px;white-space:nowrap}
  #pb-arg .arg-rodape{position:absolute;left:var(--lado);bottom:calc(var(--base) - 2.2em);font:400 var(--txt2)/1.2 "Outfit",sans-serif;color:#d7c0c6}
  @media (max-aspect-ratio:4/3){#pb-arg .arg-corpo{grid-template-columns:1fr;grid-template-rows:1fr 1fr}#pb-arg.ficha .arg-corpo{grid-template-columns:1fr;overflow:auto}}`;
  document.head.appendChild(estiloArg);
  const camadaArg = document.createElement('div');
  camadaArg.id = 'pb-arg';
  let relogiosArg = [], ctxArg = '';
  function fecharArgumento() { relogiosArg.forEach(clearTimeout); relogiosArg = []; ctxArg = ''; camadaArg.classList.remove('on', 'so-grafico', 'ficha'); camadaArg.innerHTML = ''; document.body.classList.remove('pb-arg-aberto'); }
  function svgEstabilidade(g) {
    const todos = [g.hibrido, ...(g.concorrentes || [])].flatMap((h) => h.pontos);
    if (!todos.length) return '';
    const W = 640, H = 400, e = 50, d = 12, t = 10, bse = 352;
    const xs = todos.map((p) => p[0]), ys = todos.map((p) => p[1]);
    const x0 = Math.floor(Math.min(...xs) / 10) * 10, x1 = Math.ceil(Math.max(...xs) / 10) * 10;
    const y0 = Math.floor(Math.min(...ys) / 10) * 10, y1 = Math.ceil(Math.max(...ys) / 10) * 10;
    const X = (v) => e + ((v - x0) / Math.max(1, x1 - x0)) * (W - e - d), Y = (v) => bse - ((v - y0) / Math.max(1, y1 - y0)) * (bse - t);
    let s = `<svg class="arg-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
    for (let v = y0; v <= y1; v += 20) s += `<line x1="${e}" x2="${W - d}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,.08)"/><text x="${e - 7}" y="${Y(v) + 5}" fill="#e9d9dd" font-size="15" text-anchor="end">${v}</text>`;
    for (let v = x0; v <= x1; v += 20) s += `<text x="${X(v)}" y="${bse + 20}" fill="#e9d9dd" font-size="15" text-anchor="middle">${v}</text>`;
    s += `<text x="${(e + W - d) / 2}" y="${bse + 44}" fill="#fff" font-size="16" font-weight="600" text-anchor="middle">média do ensaio da lavoura (sc/ha) — o ambiente</text>`;
    s += `<text transform="translate(14 ${(t + bse) / 2}) rotate(-90)" fill="#fff" font-size="16" font-weight="600" text-anchor="middle">produtividade (sc/ha)</text>`;
    const reta = (h, cor, w, op, atraso) => {
      const px = h.pontos.map((p) => p[0]); const a0 = Math.min(...px), a1 = Math.max(...px);
      return `<line class="reta" pathLength="1" x1="${X(a0)}" y1="${Y(h.a + h.b * a0)}" x2="${X(a1)}" y2="${Y(h.a + h.b * a1)}" stroke="${cor}" stroke-width="${w}" opacity="${op}" style="transition-delay:${atraso}s"/>`;
    };
    (g.concorrentes || []).forEach((c, i) => {
      s += c.pontos.map((p) => `<circle class="pt" cx="${X(p[0])}" cy="${Y(p[1])}" r="2.4" fill="#ffffff" opacity=".22" style="transition-delay:${1.6 + i * 0.05}s"/>`).join('');
      s += reta(c, 'rgba(255,255,255,.7)', 1.4, 0.5, 0.2 + i * 0.08);
    });
    const hb = g.hibrido;
    s += hb.pontos.map((p, i) => `<circle class="pt" cx="${X(p[0])}" cy="${Y(p[1])}" r="4" fill="#F47C06" stroke="#fff3e6" stroke-width=".7" style="transition-delay:${2.2 + i * 0.012}s"/>`).join('');
    s += reta(hb, '#F47C06', 5, 1, 1.4);
    return s + '</svg>';
  }
  function cartaoArg(l, i) {
    const det = l.detalhe ? `<div class="arg-det">${esc(l.detalhe)}</div>` : '';
    let corpo;
    if (l.epocas) {
      const teto = Math.max(1, ...l.epocas.map((x) => Math.abs(x.sc_ha || 0)));
      corpo = `<div class="arg-rot">${esc(l.numero)} ${esc(l.rotulo)}</div>
        <div class="arg-eps">${l.epocas.map((x) => `<div class="arg-ep"><b>${sc1(x.sc_ha)}</b><i style="--f:${Math.max(0.12, Math.abs(x.sc_ha || 0) / teto).toFixed(2)}"></i><span>${esc(x.epoca)}</span><small>${esc(x.x_de_y)} lavouras${x.poucas ? ' (poucas)' : ''}</small></div>`).join('')}</div>
        <div class="arg-det">sc/ha sobre a média dos concorrentes da mesma lavoura</div>`;
    } else if (l.atributos) {
      const ICONE = { 'Integridade de planta': '<path d="M9 2v20M15 2v20M9 7h6M9 13h6M9 18h6"/>', 'Sanidade foliar e de colmo': '<path d="M5 19C5 9 12 4 20 4c0 9-6 15-15 15zM5 19l8-8"/>',
        'Planta': '<path d="M12 22V4M12 9c-3-3-6-3-8-2M12 9c3-3 6-3 8-2M12 14c-3-2-6-2-8-1M12 14c3-2 6-2 8-1"/>', 'Nematoides': '<path d="M4 14c2-4 4 4 6 0s4 4 6 0 3-2 4-1"/>' };
      corpo = `<div class="arg-rot">${esc(l.rotulo || '')} · <span style="color:#F7953A">${esc(l.pilares || '')}</span></div>
        <div class="arg-chips">${l.atributos.map((x) => `<span class="arg-chip"><svg viewBox="0 0 24 24" fill="none" stroke="#F7953A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONE[x.nome] || '<circle cx="12" cy="12" r="5"/>'}</svg><span>${esc(x.nome)}<small>${esc(x.texto)}</small></span></span>`).join('')}</div>
        <div class="arg-det" style="color:#fff;font-weight:600">É esse conjunto que sustenta a estabilidade que o produtor precisa.</div><div class="arg-fonte">${esc(l.fonte || '')}</div>`;
    } else {
      corpo = `<div class="arg-num">${esc(l.numero || '')}</div><div class="arg-rot">${esc(l.rotulo || '')}</div>${det}`;
    }
    return `<section class="arg-l vidro" data-id="${esc(l.id)}" data-i="${i}"><div class="arg-tit">${esc(l.titulo)}</div>${corpo}</section>`;
  }
  // a ficha (4 placas 2 × 2)
  function placaFicha(l) {
    if (l.densidade) {
      const D = l.densidade;
      return `<section class="arg-l vidro" data-id="${esc(l.id)}"><div class="arg-tit">${esc(l.titulo)} · ${esc(D.unidade)}</div>
        <table class="arg-tab"><tr>${D.cab.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${D.linhas.map((r) => `<tr>${r.map((c, i) => `<td class="${i === 2 ? 'forte' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table><div class="arg-det">${esc(l.detalhe || '')}</div></section>`;
    }
    if (l.pares) return `<section class="arg-l vidro" data-id="${esc(l.id)}"><div class="arg-tit">${esc(l.titulo)}</div><div class="arg-pares">${l.pares.map(([k, v]) => `<b>${esc(k)}</b><span>${esc(v)}</span>`).join('')}</div></section>`;
    if (l.doencas) return `<section class="arg-l vidro" data-id="${esc(l.id)}"><div class="arg-tit">${esc(l.titulo)}</div><div class="arg-doe">${l.doencas.map((d) => `<div><i class="${/suscet|sem info/i.test(d.nivel) ? 'fraco' : ''}">${esc(d.nivel)}</i><span>${esc(d.quais)}</span></div>`).join('')}</div></section>`;
    let mapa = '';
    const mt = PB && PB.mapa && PB.mapa.ufs && PB.mapa.ufs.MT, reg = l.mapa && PB && PB.mapa.regioes && PB.mapa.regioes[l.mapa];
    if (mt) {
      const pts = mt.flat(); let x0 = 999, x1 = -999, y0 = 999, y1 = -999;
      pts.forEach(([lo, la]) => { x0 = Math.min(x0, lo); x1 = Math.max(x1, lo); y0 = Math.min(y0, la); y1 = Math.max(y1, la); });
      const k = Math.cos(((y0 + y1) / 2) * Math.PI / 180), W = 400, H = Math.round(((y1 - y0) / ((x1 - x0) * k)) * W);
      const P = ([lo, la]) => `${(((lo - x0) / (x1 - x0)) * W).toFixed(1)},${(((y1 - la) / (y1 - y0)) * H).toFixed(1)}`;
      const caminho = (aneis, cls) => aneis.map((a) => `<path class="${cls}" d="M${a.map(P).join('L')}Z"/>`).join('');
      mapa = `<svg viewBox="-6 -6 ${W + 12} ${H + 12}" preserveAspectRatio="xMidYMid meet">${caminho(mt, 'uf')}${reg ? caminho(reg, 'reg') : ''}${reg ? `<text x="${W * 0.55}" y="${H * 0.36}" fill="#fff" font-size="30" font-weight="800" text-anchor="middle" style="paint-order:stroke;stroke:#3c0616;stroke-width:5px">MT2</text>` : ''}</svg>`;
    }
    return `<section class="arg-l vidro" data-id="${esc(l.id)}"><div class="arg-tit">${esc(l.titulo)}</div><div class="arg-comp"><div>${(l.nossos || []).map((x) => `<div class="n">${esc(x.numero)}</div><div class="r">${esc(x.rotulo)}</div>`).join('')}</div><div>${mapa}</div></div></section>`;
  }
  function abrirArgumento(r) {
    fecharArgumento();
    const arg = r.argumento || {}; const g = arg.grafico; const ls = (arg.laminas || []).slice();
    if (!ls.length && g) ls.push({ id: 'grafico', titulo: 'Estabilidade', grafico: true, inicio_s: 0 });
    if (!ls.length) return false;
    if (!camadaArg.isConnected) document.body.appendChild(camadaArg);
    if (estado.vista) fechar(true);
    motor.fecharJanelas();
    const fi = arg.ficha || null;
    const hibArg = (fi && fi.hibrido) || (g && g.hibrido && g.hibrido.nome) || ((r.hibrido_em_foco || {}).hibrido) || '';
    ctxArg = `${fi ? 'ficha' : ls.length === 1 && g ? 'gráfico de estabilidade' : 'argumento da frase oficial'} do híbrido ${hibArg}, ensaios da rede Brevant (comercial), recorte ${r.recorte || ''} — a próxima pergunta é sobre este híbrido e este recorte`;
    const h = HIB.find((x) => x.completo === hibArg || x.codigo === String(hibArg).replace(/(PWU|VYHR)$/, ''));
    const so = !fi && ls.length === 1;
    camadaArg.classList.toggle('so-grafico', so);
    camadaArg.classList.toggle('ficha', !!fi);
    const recorte = String(r.recorte || '').replace(/^MT2 \(Médio-Norte\)$/, 'Médio-Norte (MT2)');
    const linha2 = fi ? `${esc(fi.titulo)} · ficha técnica Brevant + ensaios 26S` : `Ensaios 26S · rede Brevant (comercial) · ${esc(recorte)}`;
    const frase = fi ? 'Ficha técnica' : so ? 'Estabilidade: uma reta por híbrido, um ponto por lavoura' : (h && h.slogan ? h.slogan.texto : '');
    const topo = `<div class="arg-topo">${h ? placa(h, 'p') : ''}<div class="arg-frase">${esc(frase)}<small>${linha2}</small></div>${fi && ls.some((l) => l.pilares) ? `<i class="arg-selo" style="margin-left:auto">${esc(ls.find((l) => l.pilares).pilares)}</i>` : ''}</div>`;
    const graf = g ? `<div class="arg-graf vidro"><div class="arg-tit">Estabilidade · ${esc(recorte)}</div>${svgEstabilidade(g)}
      <div class="arg-leg"><span><i style="background:#F47C06"></i>${h ? esc(h.codigo) : 'o híbrido'} e as lavouras dele</span><span><i style="background:rgba(255,255,255,.7)"></i>${(g.concorrentes || []).length} concorrentes (sem nome)</span></div></div>` : '';
    let corpo;
    if (fi) corpo = ls.map(placaFicha).join('');
    else {
      const pontos = ls.filter((l) => !(l.grafico && so));
      corpo = graf + (pontos.length ? `<div class="arg-lado"><div class="arg-palco">${pontos.map(cartaoArg).join('')}</div><div class="arg-trilha">${pontos.map((l) => `<span>${esc(l.titulo.replace(/^Ficha \S+ · por que ele é estável$/, 'Por que é estável'))}</span>`).join('')}</div></div>` : '');
    }
    camadaArg.innerHTML = `${topo}<button type="button" class="arg-fechar">FECHAR</button><div class="arg-corpo">${corpo}</div>${fi ? `<div class="arg-rodape">${esc(fi.fonte)}</div>` : ''}`;
    camadaArg.querySelector('.arg-fechar').onclick = fecharArgumento;
    camadaArg.classList.add('on');
    document.body.classList.add('pb-arg-aberto');
    requestAnimationFrame(() => { const tp = camadaArg.querySelector('.arg-topo'); if (tp) tp.classList.add('voou'); });
    const grafEl = camadaArg.querySelector('.arg-graf');
    const cartoes = [...camadaArg.querySelectorAll(fi ? '.arg-l' : '.arg-palco .arg-l')];
    const chips = [...camadaArg.querySelectorAll('.arg-trilha span')];
    const mostrarGraf = () => { if (!grafEl || grafEl.classList.contains('voou')) return; grafEl.classList.add('voou'); const sv = grafEl.querySelector('.arg-svg'); if (sv) requestAnimationFrame(() => sv.classList.add('desenha')); motor.formar([grafEl]); };
    const passo = (i) => {
      if (fi) { cartoes[i].classList.add('agora'); motor.formar([cartoes[i]]); return; }
      cartoes.forEach((c, k) => { c.classList.toggle('agora', k === i); c.classList.toggle('passou', k < i); });
      chips.forEach((c, k) => { c.classList.toggle('agora', k === i); c.classList.toggle('passou', k < i); });
      if (cartoes[i]) motor.formar([cartoes[i]]);
    };
    const t0 = Date.now();
    const ritmo = window.__argRapido ? 0.03 : 1;   // só o teste local acelera (scripts/brevant/medir-laminas.mjs)
    const pontosLs = fi ? ls : ls.filter((l) => !(l.grafico && so));
    const comecar = () => {
      mostrarGraf();
      pontosLs.forEach((l, i) => relogiosArg.push(setTimeout(() => passo(i), Math.max(0, (l.inicio_s || 0) * 1000 * ritmo))));
      // AUDITORIA VISUAL: quando a última lâmina assentou, a página mede o que está À VISTA (topo, gráfico, a lâmina atual)
      const ultima = Math.max(0, ...pontosLs.map((l) => l.inicio_s || 0)) * 1000 * ritmo + 1800;
      relogiosArg.push(setTimeout(() => {
        try {
          const vista = [camadaArg.querySelector('.arg-topo'), grafEl, ...(fi ? cartoes : cartoes.filter((c) => c.classList.contains('agora'))), camadaArg.querySelector('.arg-trilha')].filter(Boolean);
          window.AO_VIVO_AUDITAR && window.AO_VIVO_AUDITAR(vista, fi ? 'ficha' : so ? 'gráfico de estabilidade' : 'lâminas do argumento');
        } catch (e) {}
      }, ultima));
    };
    if (so) { mostrarGraf(); relogiosArg.push(setTimeout(() => { try { window.AO_VIVO_AUDITAR && window.AO_VIVO_AUDITAR([camadaArg.querySelector('.arg-topo'), grafEl].filter(Boolean), 'gráfico de estabilidade'); } catch (e) {} }, 2600 * ritmo + 400)); return true; }
    const esperar = () => { const falando = usar((a) => a.falando()); if (falando || Date.now() - t0 > 2500) comecar(); else relogiosArg.push(setTimeout(esperar, 120)); };
    esperar();
    return true;
  }
  window.AO_VIVO_ARGUMENTO_TESTE = abrirArgumento;   // só para o teste local (scripts/brevant/testar-tela-argumento.mjs)

  function registrar() {
    window.AO_VIVO_FRASE = (texto) => {
      try { const ct = window.MapaGD && window.MapaGD.comandoDeTela ? window.MapaGD.comandoDeTela(texto) : null; if (ct && comandoDeTela(ct, true)) return true; } catch (e) { console.log('[tela] erro', e); }
      // 05/out/2026: as lâminas do argumento fecham por voz
      if (camadaArg.classList.contains('on') && /^(fecha|fechar|sair|sai|limpa)\b/.test(norm(motor.semChamada(texto)).replace(/^(brevant tech|brevant|jarvis)\s+/, ''))) { fecharArgumento(); return true; }
      // 05/out/2026: o mapa dos resultados de GD ("mostra o mapa dos resultados", "filtra Nova Ubiratã"…) — mapa-gd.js
      try { if (window.MapaGDJarvis && window.MapaGDJarvis.frase(texto)) { fecharArgumento(); return true; } } catch (e) { console.log('[mapa-gd] erro', e); }
      // 05/out/2026: com a apresentação da revenda carregada, "e a recompra?", "próximo"… são dela (carteira.js)
      try { if (window.CarteiraBrevant && window.CarteiraBrevant.frase(texto)) return true; } catch (e) { console.log('[carteira] erro', e); }
      try { if (tratar(texto)) return true; } catch (e) { console.log('[playbook] erro', e); }
      return false;                                // vai para o agente COM a vista aberta (contexto da tela)
    };
    window.AO_VIVO_CONTEXTO_TELA = contextoDaTela;
    window.AO_VIVO_TELA_TEMA = telaDoAgente;
    window.AO_VIVO_DESENHOS = Object.assign({}, window.AO_VIVO_DESENHOS || {}, { ensaios_brevant: desenhoEnsaios });
    return !!A();
  }

  // ------------------------------------------------------------------------------------------
  // OS DADOS (03/out/2026): o playbook é confidencial da Brevant — NÃO mora no site. Vem da rota
  // /voz?tema=brevant&dados=1, que só entrega a quem entrou com login E é membro da org (org_membros).
  // Tema com "login": a abertura pede e-mail e senha e só libera o INICIAR com os dados na mão.
  // Na máquina (servindo a raiz do repositório, página em /public/ao-vivo/): lê a cópia local
  // supabase/temas-privados/<tema>/playbook.json — sem login, para desenvolver e gravar.
  // ------------------------------------------------------------------------------------------
  function ligar(j) {
    PB = j; HIB = j.hibridos.slice();
    const ok = registrar();
    document.documentElement.classList.add('pb-pronto');
    window.PlaybookBrevant = { tratar, fechar, apresentar, camera: { puxar, soltar }, get estado() { return estado; }, get dados() { return PB; }, ligado: ok };
    liberarAbertura();
    console.log('[playbook] pronto —', HIB.length, 'híbridos, ponte', ok ? 'ok' : 'ausente');
  }
  const LOCAL = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && location.pathname.startsWith('/public/');
  const botaoIniciar = $('#comecar');
  const caixaLogin = document.createElement('form');
  caixaLogin.className = 'pb-login';
  caixaLogin.setAttribute('autocomplete', 'on');
  function travarAbertura(html) {
    if (botaoIniciar) botaoIniciar.style.display = 'none';
    caixaLogin.innerHTML = html;
    if (caixaAbertura && !caixaLogin.isConnected) caixaAbertura.insertBefore(caixaLogin, botaoIniciar || null);
  }
  function liberarAbertura() { caixaLogin.remove(); if (botaoIniciar) botaoIniciar.style.display = ''; }
  function mostrarLogin(msg = '') {
    travarAbertura(`<p class="pb-login-tit">Entre com o e-mail liberado para o Brevant Tech</p>
      <input name="email" type="email" autocomplete="username" placeholder="e-mail" required>
      <input name="senha" type="password" autocomplete="current-password" placeholder="senha" required>
      <button type="submit">ENTRAR</button><small class="pb-login-msg">${esc(msg)}</small>`);
    caixaLogin.onsubmit = async (e) => {
      e.preventDefault();
      const s = A() && A().sessao; if (!s) return;
      const b = $('button', caixaLogin); b.disabled = true; b.textContent = 'ENTRANDO…';
      const r = await s.entrar(caixaLogin.email.value, caixaLogin.senha.value);
      if (r.erro) { mostrarLogin(r.erro); return; }
      carregar();
    };
  }
  function mostrarNegado() {
    travarAbertura(`<p class="pb-login-tit">Acesso não liberado para esta conta.</p><small class="pb-login-msg">Peça a liberação a quem te convidou para o Brevant Tech.</small><button type="button" class="pb-login-sair">ENTRAR COM OUTRA CONTA</button>`);
    $('.pb-login-sair', caixaLogin).onclick = () => { const s = A() && A().sessao; if (s) s.sair(); mostrarLogin(); };
  }
  async function carregar() {
    if (LOCAL) {
      try { const r = await fetch('/supabase/temas-privados/' + TEMA.id + '/playbook.json', { cache: 'no-cache' }); if (r.ok) { ligar(await r.json()); return; } } catch (e) {}
    }
    const s = A() && A().sessao;
    if (!s) { travarAbertura('<p class="pb-login-tit">Não consegui abrir agora. Recarregue a página.</p>'); return; }
    travarAbertura('<p class="pb-login-tit">Conferindo o acesso…</p>');
    const r = await s.dadosDoTema();
    if (r.status === 200 && r.dados && r.dados.hibridos) { ligar(r.dados); return; }
    if (r.status === 401) { mostrarLogin(); return; }
    if (r.status === 403) { mostrarNegado(); return; }
    travarAbertura('<p class="pb-login-tit">Não consegui carregar os dados agora.</p><button type="button" class="pb-login-sair">TENTAR DE NOVO</button>');
    $('.pb-login-sair', caixaLogin).onclick = () => carregar();
  }
  if (TEMA.login || LOCAL) carregar();
  else travarAbertura('<p class="pb-login-tit">Este tema precisa de login.</p>');
})();
