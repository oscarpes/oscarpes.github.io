/* ---------------------------------------------------------------------------------------------
   DEMONSTRAÇÃO DO JARVIS PARA REPRESENTANTES — A TELA (06/out/2026). Tema `demo-milho`, marca Oscarpes.

   João, 05/out/2026 (meia-noite, rodada de negociação com representantes): "monte uma apresentação pro Jarvis
   fictícia como se fosse MILHO: análise de carteira, resultados no mapa igual já temos … robusto e sem erros …
   a minha vontade é usar o que já tem".

   O que é REUSO (nada reescrito):
     - o MOTOR da tela ao vivo (voz, legenda, bolinhas, ouvido, histórico, servidor) — window.AO_VIVO;
     - o NÚCLEO do mapa de GD (mapa-gd-nucleo.js, cópia byte a byte de lib/): desenho, ficha de vidro, réguas,
       placar, "onde se destacou", a melhor área, o passeio dos destaques e as FRASES faladas;
     - a CAIXA DO MOMENTO e os comandos de tela ("volta ao início", "fecha o mapa") — a mesma lógica do Jarvis das empresas;
     - pergunta livre → o agente de verdade (rota /voz?tema=demo-milho, persona demo-milho, com a autocorreção).
   O que é desta demonstração: a carga FICTÍCIA (dados-demo.json, pública: nada real), as 4 telas da carteira e a
   ligação fala → tela, que mora em demo-milho-falas.js (PURA — o portão roda o roteiro inteiro sem navegador).
   Tudo resolvido AQUI, na hora, sem servidor e sem modelo — a mesma fala dá sempre a mesma resposta.
   Portão: scripts/conferir-demo-milho.ts. Ensaio no Chrome sem janela: node scripts/demo-milho/ensaio-demo-milho.mjs
   --------------------------------------------------------------------------------------------- */
(function () {
  'use strict';
  const A = () => window.AO_VIVO || null;
  const N = () => window.MapaGD || null;
  const F = () => window.DemoMilhoFalas || null;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CALMO = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const mil = (n) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dec1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
  const usar = (f) => { const a = A(); if (!a) return undefined; try { return f(a); } catch (e) { console.log('[demo] motor', e); return undefined; } };
  // a resposta da página vai ao log (o motor registra) e à legenda
  let mostrados = [];   // o que a página já falou nesta conversa (vai no contexto do agente — demo-milho-falas.js contexto)
  const falar = (t) => {
    if (!t) return;
    try { if (F() && F().lembrarMostrado) mostrados = F().lembrarMostrado(mostrados, t); } catch (e) { /* conforto */ }
    usar((a) => { a.legenda(esc(t)); a.falar(t); });
    try { window.dispatchEvent(new CustomEvent('aovivo-resposta-da-pagina', { detail: { resposta: String(t) } })); } catch (e) { /* conforto */ }
  };

  // ------------------------------------------------------------------------------------------ ESTILO (paleta da Oscarpes)
  const estilo = document.createElement('style');
  estilo.textContent = `
  #dm-selo{position:fixed;left:16px;top:calc(44px + env(safe-area-inset-top));z-index:6;font:700 11px/1 Menlo,monospace;letter-spacing:.2em;color:#0b1102;background:#f9b84a;padding:6px 12px;border-radius:999px;pointer-events:none;opacity:.92}
  .dm-camada{position:fixed;inset:0;z-index:3;display:none;pointer-events:none;color:#f1e9c4;font-family:"Inter",system-ui,sans-serif;
    --j-top:calc(14px + env(safe-area-inset-top) + 118px);--j-base:calc(150px + env(safe-area-inset-bottom));--j-lado:clamp(12px,2.4vw,52px)}
  .dm-camada.on{display:block;pointer-events:auto}
  .dm-camada::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 45%,rgba(20,29,5,.35),rgba(6,9,1,.84));pointer-events:none}
  .dm-cab{position:absolute;left:var(--j-lado);right:var(--j-lado);top:calc(var(--j-top) - 40px);display:flex;align-items:center;gap:12px;z-index:2}
  .dm-tag{font:800 12px/1 Menlo,monospace;letter-spacing:.14em;background:#c4ca3c;color:#0b1102;padding:.55em .8em .5em;border-radius:3px;white-space:nowrap;text-transform:uppercase}
  .dm-tit{font:700 clamp(18px,1.6vw,30px)/1.1 "Inter",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dm-nav{display:flex;gap:6px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none;justify-content:flex-end}
  .dm-cab button{background:rgba(11,17,2,.6);border:1px solid rgba(196,202,60,.4);color:#f1e9c4;font:700 11px Menlo,monospace;letter-spacing:.12em;padding:7px 12px;border-radius:999px;cursor:pointer;white-space:nowrap}
  .dm-cab button.on{background:#c4ca3c;color:#0b1102;border-color:transparent}
  .dm-corpo{position:absolute;left:var(--j-lado);right:var(--j-lado);top:var(--j-top);bottom:var(--j-base);--mgd-k:1.06}
  .dm-msg{position:absolute;inset:0;display:grid;place-items:center;font:400 clamp(15px,1.2vw,22px)/1.4 "Inter",sans-serif;text-align:center;padding:0 10%}
  /* o NÚCLEO do mapa com a paleta da Oscarpes (as regras dele são as do Jarvis; aqui só a cor) */
  #dmm .mgd{--mgd-acento:#f9a322;--mgd-acento2:#f9b84a;--mgd-mudo:#b3a97a;--mgd-ponto:#f1e9c4;--mgd-texto:#f1e9c4;--mgd-fonte:"Inter",system-ui,sans-serif;--mgd-titulo:"Inter",system-ui,sans-serif}
  #dmm .mgd-palco{background:radial-gradient(120% 100% at 50% 40%,rgba(38,53,10,.40),rgba(6,9,1,.6));border-color:rgba(196,202,60,.18)}
  #dmm .mgd-uf{fill:rgba(241,233,196,.035);stroke:rgba(214,220,110,.45)} #dmm .mgd-uf.fora{stroke:rgba(214,220,110,.16)}
  #dmm .mgd-mun{stroke:rgba(214,220,110,.12)} #dmm .mgd-mun.on{fill:rgba(249,184,74,.14);stroke:rgba(249,184,74,.8)}
  #dmm .mgd-rot{fill:rgba(241,233,196,.7);stroke:rgba(6,9,1,.8)}
  #dmm .mgd-pts circle{stroke:rgba(249,163,34,.85)} #dmm .mgd-pts{filter:drop-shadow(0 0 3px rgba(249,184,74,.55))}
  #dmm .mgd-pts circle.meio{fill:rgba(241,233,196,.5);stroke:rgba(241,233,196,.35)}
  #dmm .mgd-barra select{background-color:rgba(11,17,2,.6);border-color:rgba(196,202,60,.4);background-image:linear-gradient(45deg,transparent 50%,#c4ca3c 50%),linear-gradient(135deg,#c4ca3c 50%,transparent 50%)}
  #dmm .mgd-barra select.on{background-color:#c4ca3c;color:#0b1102}
  #dmm .mgd-ficha,#dmm .mgd-selo-vidro{background:linear-gradient(160deg,rgba(255,255,255,.10),rgba(255,255,255,.03) 40%,rgba(20,29,5,.45));border-color:rgba(196,202,60,.4)}
  #dmm .mgd-ficha-cab p,#dmm .mgd-selo-vidro{color:#f1e9c4}
  #dmm .mgd-tag,#dmm .mgd-selo{background:#c4ca3c;color:#0b1102}
  #dmm .mgd-ficha tr.mgd-brv td{background:rgba(196,202,60,.12)} #dmm .mgd-media{border-top-color:rgba(196,202,60,.5)}
  #dmm .mgd-chip{border-color:rgba(196,202,60,.5);background:rgba(196,202,60,.12)}
  #dmm .mgd-zoom button,#dmm .mgd-nav button,#dmm .mgd-aviso{background:rgba(11,17,2,.65);border-color:rgba(196,202,60,.45)}
  /* a CAIXA DO MOMENTO (a mesma do Jarvis: sobe com o trecho da fala que cita a cidade/área) */
  #dmm .j-caixa{position:absolute;right:calc(var(--j-lado) + 1.5vw);top:calc(var(--j-top) + 5vh);transform:translate(0,-14px) scale(.97);opacity:0;z-index:4;pointer-events:none;
    min-width:min(36vw,640px);max-width:min(44vw,820px);padding:clamp(16px,1.6vw,34px) clamp(22px,2.2vw,46px);border-radius:clamp(14px,1.2vw,26px);
    background:rgba(6,9,1,.86);border:2px solid rgba(196,202,60,.75);box-shadow:0 18px 60px rgba(0,0,0,.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);text-align:center;transition:opacity .35s ease,transform .35s ease}
  #dmm .j-caixa.on{opacity:1;transform:none}
  #dmm .j-caixa.area{right:auto;left:calc(var(--j-lado) + 1vw);min-width:0;max-width:min(32vw,560px)}
  #dmm .j-caixa .c-tit{font:800 clamp(24px,2.4vw,54px)/1.05 "Inter",sans-serif;text-transform:uppercase;color:#fff}
  #dmm .j-caixa .c-sub0{margin-top:.3em;font:600 clamp(16px,1.25vw,28px)/1.2 "Inter",sans-serif;color:#e1d49b}
  #dmm .j-caixa .c-num{margin-top:.12em;font:800 max(48px,min(7vw,12vh))/1 "Inter",sans-serif;color:#f9b84a;text-shadow:0 0 30px rgba(249,184,74,.35)}
  #dmm .j-caixa .c-def{font:600 clamp(16px,1.2vw,26px)/1.2 "Inter",sans-serif;color:#f1e9c4;opacity:.9}
  #dmm .j-caixa .c-dif{margin-top:.25em;font:800 clamp(30px,3vw,66px)/1 "Inter",sans-serif;color:#fff}
  /* a CARTEIRA (vidro, número grande, barras) */
  #dmc .dm-grade{display:grid;gap:clamp(10px,1.1vw,22px);height:100%;min-height:0}
  #dmc .dm-p{border-radius:18px;padding:clamp(14px,1.3vw,26px) clamp(16px,1.5vw,30px);background:linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.025) 45%,rgba(20,29,5,.45));border:1px solid rgba(196,202,60,.32);
    box-shadow:0 18px 50px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.1);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);min-height:0;overflow:hidden;display:flex;flex-direction:column;animation:dm-voa .6s cubic-bezier(.2,.8,.2,1) both}
  #dmc .dm-p:nth-child(2){animation-delay:.08s} #dmc .dm-p:nth-child(3){animation-delay:.16s} #dmc .dm-p:nth-child(4){animation-delay:.24s} #dmc .dm-p:nth-child(5){animation-delay:.32s}
  @keyframes dm-voa{from{opacity:0;transform:translate(40px,18px) scale(.95);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
  #dmc .dm-rot{color:#c4ca3c;font:800 clamp(12px,.82vw,15px)/1.25 Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;margin:0 0 .6em}
  #dmc .dm-g{font:800 clamp(38px,3.6vw,72px)/1 "Inter",sans-serif;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap}
  #dmc .dm-g small{font-size:.38em;margin-left:.15em;color:#e1d49b;font-weight:600}
  #dmc .dm-g.ouro{color:#f9b84a;text-shadow:0 0 28px rgba(249,184,74,.35)} #dmc .dm-g.alerta{color:#ff8a6b}
  #dmc .dm-txt{margin:.5em 0 0;font:400 clamp(14px,1.05vw,20px)/1.38 "Inter",sans-serif;color:#f1e9c4}
  #dmc .dm-seta{display:flex;align-items:baseline;gap:.35em;flex-wrap:wrap} #dmc .dm-seta i{font-style:normal;color:#c4ca3c;font:700 clamp(26px,2.2vw,44px)/1 "Inter",sans-serif}
  #dmc table{width:100%;border-collapse:collapse;font:400 clamp(14px,1.02vw,20px)/1.25 "Inter",sans-serif;font-variant-numeric:tabular-nums}
  #dmc th{color:#c4ca3c;font:800 clamp(11px,.72vw,14px)/1.2 Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;text-align:right;padding:0 .6em .6em}
  #dmc th:first-child,#dmc td:first-child{text-align:left}
  #dmc td{text-align:right;padding:.45em .6em;border-top:1px solid rgba(241,233,196,.1)} #dmc td.pos{color:#c4ca3c;font-weight:700} #dmc td.neg{color:#ff8a6b;font-weight:700}
  #dmc tr.tot td{border-top:2px solid rgba(196,202,60,.5);font-weight:700}
  #dmc .dm-barras{display:flex;flex-direction:column;gap:clamp(8px,1.4vh,18px);flex:1;justify-content:center}
  #dmc .dm-linha{display:grid;grid-template-columns:minmax(140px,.5fr) 1fr minmax(110px,.25fr);align-items:center;gap:12px;font:600 clamp(14px,1vw,19px)/1.2 "Inter",sans-serif}
  #dmc .dm-trilho{height:clamp(14px,1.2vw,24px);border-radius:6px;background:rgba(241,233,196,.07);overflow:hidden;position:relative}
  #dmc .dm-trilho i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;width:var(--w);animation:dm-barra 1.1s cubic-bezier(.2,.8,.2,1) .5s both}
  #dmc .dm-trilho i.a{background:rgba(241,233,196,.35);height:45%} #dmc .dm-trilho i.b{background:linear-gradient(90deg,#a2a72a,#c4ca3c);top:auto;height:55%} #dmc .dm-trilho i.c{background:linear-gradient(90deg,#f9a322,#f9b84a);top:auto;height:55%;opacity:.85}
  @keyframes dm-barra{from{width:0}}
  #dmc .dm-leg{display:flex;gap:16px;font:400 13px "Inter",sans-serif;color:#b3a97a;margin-top:.6em} #dmc .dm-leg i{display:inline-block;width:.9em;height:.9em;border-radius:3px;margin-right:.35em;vertical-align:-.1em}
  @media (max-width:759px){.dm-camada{--j-top:calc(10px + env(safe-area-inset-top) + 96px);--j-base:calc(120px + env(safe-area-inset-bottom))}#dmc .dm-corpo{overflow-y:auto}#dmc .dm-grade{grid-template-columns:1fr!important;grid-template-areas:none!important;height:auto}#dmc .dm-grade>*{grid-area:auto!important}#dmm .j-caixa{display:none}}
  @media (prefers-reduced-motion: reduce){.dm-camada *{animation:none!important;transition:none!important}}`;
  document.head.appendChild(estilo);

  const selo = document.createElement('div');
  selo.id = 'dm-selo'; selo.textContent = 'DEMONSTRAÇÃO · DADOS FICTÍCIOS';
  const camadaMapa = document.createElement('div');
  camadaMapa.id = 'dmm'; camadaMapa.className = 'dm-camada';
  camadaMapa.innerHTML = '<div class="dm-cab"><span class="dm-tag">Ensaios · demonstração</span><span class="dm-tit">Resultados no mapa</span><span class="dm-nav"></span><button type="button" class="dm-fechar">FECHAR</button></div><div class="dm-corpo"></div><div class="j-caixa" aria-live="polite"></div>';
  const camadaCart = document.createElement('div');
  camadaCart.id = 'dmc'; camadaCart.className = 'dm-camada';
  camadaCart.innerHTML = '<div class="dm-cab"><span class="dm-tag">Carteira · demonstração</span><span class="dm-tit"></span><span class="dm-nav"></span><button type="button" class="dm-fechar">FECHAR</button></div><div class="dm-corpo"></div>';
  const montarCamadas = () => { [selo, camadaMapa, camadaCart].forEach((el) => { if (!el.isConnected) document.body.appendChild(el); }); };
  $('.dm-fechar', camadaMapa).onclick = () => fecharMapa();
  $('.dm-fechar', camadaCart).onclick = () => fecharCarteira();
  camadaCart.addEventListener('click', (e) => { const b = e.target.closest('[data-ir]'); if (b) { e.preventDefault(); irCarteira(Number(b.dataset.ir), true); } });

  // ------------------------------------------------------------------------------------------ OS DADOS (fictícios, do próprio tema)
  let D = null, carregando = null;
  async function carregar() {
    if (D) return D;
    if (!carregando) carregando = fetch((window.TEMA && TEMA.base ? TEMA.base : 'temas/demo-milho/') + 'dados-demo.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { D = j && j.mapa && j.carteira ? j : null; return D; }).catch(() => null).finally(() => { carregando = null; });
    return carregando;
  }
  carregar();

  // ------------------------------------------------------------------------------------------ O MAPA (o núcleo monta)
  let ctl = null, mapaAberto = false, assunto = { hib: null, geo: null }, ofereceuMapa = false;
  async function abrirMapa() {
    montarCamadas(); fecharCarteira(true);
    usar((a) => a.fecharJanelas());
    camadaMapa.classList.add('on'); mapaAberto = true;
    document.body.classList.add('pb-aberto');
    const corpo = $('.dm-corpo', camadaMapa);
    if (!ctl) corpo.innerHTML = '<div class="dm-msg">Carregando o mapa…</div>';
    const d = await carregar();
    if (!mapaAberto) return false;
    if (!d || !N()) { corpo.innerHTML = '<div class="dm-msg">O mapa da demonstração não carregou. Recarregue a página.</div>'; return false; }
    if (!ctl) {
      ctl = N().montar(corpo, d.mapa, { representante: false, aoAbrir: formarParticulas });
      setTimeout(() => formarParticulas(null), 900);
    }
    return true;
  }
  function formarParticulas(area) {
    if (!mapaAberto) return;
    const alvos = [$('.mgd-palco', camadaMapa), area ? $('.mgd-ficha', camadaMapa) : null].filter(Boolean);
    usar((a) => a.formar(alvos));
  }
  function fecharMapa() {
    if (!mapaAberto) return false;
    planoCaixa = []; caixaAtual = null; esconderCaixa();
    mapaAberto = false; camadaMapa.classList.remove('on');
    if (!camadaCart.classList.contains('on')) document.body.classList.remove('pb-aberto');
    usar((a) => a.formar([]));
    // o passeio dos destaques para JUNTO (senão o "e o terceiro…" sai falado por cima da carteira)
    if (ctl) { try { ctl.pararTour(); } catch (e) { /* */ } ctl.destruir(); ctl = null; }
    return true;
  }

  // a CAIXA DO MOMENTO: o plano (os MESMOS números da fala, do núcleo) diz qual caixa sobe quando a voz chega em cada
  // cidade/área — a cada 150 ms lemos o pedaço que está tocando (AO_VIVO.pedacoFalado) e casamos pelo nome
  let planoCaixa = [], caixaAtual = null, caladoDesde = 0;
  const nCx = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const nomeCurto = (nome) => String(nome || '').replace(/^demais cidades da microrregi[aã]o de /i, '').replace(/^microrregi[aã]o de /i, '');
  function planejarCaixas(itens) { planoCaixa = (itens || []).filter((x) => x && x.chave); caixaAtual = null; esconderCaixa(); }
  function mostrarCaixa(it) {
    const el = $('.j-caixa', camadaMapa); if (!el) return;
    el.classList.toggle('area', !!it.area);
    el.innerHTML = `<div class="c-tit">${esc(it.titulo)}</div>${it.sub0 ? `<div class="c-sub0">${esc(it.sub0)}</div>` : ''}<div class="c-num">${esc(it.numero)}</div>${it.def ? `<div class="c-def">${esc(it.def)}</div>` : ''}${it.dif ? `<div class="c-dif">${esc(it.dif)}</div>` : ''}`;
    el.classList.add('on');
    if (it.ids && it.ids.length && ctl && ctl.focar) try { ctl.focar(it.ids); } catch (e) { /* */ }
  }
  function esconderCaixa() { const el = $('.j-caixa', camadaMapa); if (el) el.classList.remove('on'); }
  setInterval(() => {
    if (!mapaAberto || !planoCaixa.length) return;
    const a = A(); const p = nCx(typeof window.__pedacoTeste === 'string' ? window.__pedacoTeste : (a && a.pedacoFalado ? a.pedacoFalado() : ''));
    if (!p) { if (caixaAtual && Date.now() - caladoDesde > 1200) { caixaAtual = null; esconderCaixa(); } if (!caladoDesde) caladoDesde = Date.now(); return; }
    caladoDesde = 0;
    const it = planoCaixa.find((x) => p.includes(x.chave));
    if (it && it !== caixaAtual) { caixaAtual = it; mostrarCaixa(it); }
  }, 150);
  const scTxt = (v) => `${v >= 0 ? '+' : '−'}${dec1(Math.abs(v))} sc/ha`;
  const caixaDaArea = (area, hib, sc, vant) => {
    const pos = N().ranking(area).find((x) => x.hib === hib);
    return { area: true, chave: nCx(area.mun), titulo: area.mun, sub0: `plantio ${String(area.pl || '').replace('/', ' de ')}`, numero: pos ? `${pos.pos}º de ${area.h.length}` : '—',
      def: vant > 0 ? `${dec1(sc)} sc/ha · à frente da média dos concorrentes por` : `${dec1(sc)} sc/ha`, dif: vant > 0 ? scTxt(vant) : '', ids: [area.id] };
  };
  const ondeCurto = (geo) => N().ondeFalado(D.mapa, geo).replace(/^(no|na|em) /, '');
  function seloPlacar(p, geo) {
    return `<span class="mgd-tag">${esc(p.hibrido)} · ${esc(ondeCurto(geo))}</span>` +
      `<div class="mgd-big"><b>${p.frente}</b> de ${p.lavouras} lavouras</div><div class="mgd-def">à frente da média dos concorrentes da mesma lavoura</div>` +
      `<div class="mgd-big"><b class="cinza">${p.primeiro}</b> de ${p.lavouras}</div><div class="mgd-def">em 1º lugar na lavoura (maior sc/ha entre todos os híbridos)</div>` +
      `<div class="mgd-legenda"><span><i style="background:#f9b84a"></i>à frente da média</span><span><i style="background:rgba(241,233,196,.5)"></i>as outras lavouras dele</span></div>`;
  }
  function mostrarPlacar(hib, geo) {
    const p = N().placarDoHibrido(D.mapa, hib, geo || {});
    ctl.destacar({ filtro: Object.assign({}, geo || {}, { hib }), frente: p.ids_frente, outras: p.ids_outras, selo: seloPlacar(p, geo), zoom: p.ids_frente.concat(p.ids_outras) });
    planejarCaixas([{ chave: nCx(N().ondeFalado(D.mapa, geo).replace(/^(no|na|em) /, '')), titulo: `${hib}`, sub0: ondeCurto(geo), numero: `${p.frente} de ${p.lavouras}`, def: 'lavouras à frente da média dos concorrentes', dif: p.vantagem_media_sc_ha > 0 ? scTxt(p.vantagem_media_sc_ha) + ' na média' : '', ids: p.ids_frente }]);
  }
  function mostrarLugares(hib, geo, gs) {
    const p = N().placarDoHibrido(D.mapa, hib, geo || {});
    if (!gs.length) { mostrarPlacar(hib, geo); return; }
    const ids = {}; gs.forEach((g) => g.ids.forEach((i) => { ids[i] = 1; }));
    const muns = [].concat(...gs.map((g) => g.cidades));
    const chips = gs.map((g) => `<div class="mgd-chip">${esc(g.nome.replace(/^microrregião de /, 'micro. ').replace(/^demais cidades da microrregião de /, 'demais de '))}<span>${g.frente} de ${g.lavouras} · +${dec1(g.vantagem_sc_ha)} sc/ha</span></div>`).join('');
    const s = `<span class="mgd-tag">${esc(hib)} · onde se destacou</span><h4>${esc(ondeCurto(geo))}</h4><div class="mgd-def">X de Y = lavouras à frente da média dos concorrentes · sc/ha = vantagem média sobre eles</div><div class="mgd-chips">${chips}</div>`;
    ctl.destacar({ filtro: Object.assign({}, geo || {}, { hib }), frente: Object.keys(ids), outras: p.ids_frente.concat(p.ids_outras).filter((i) => !ids[i]), muns, selo: s, zoom: p.ids_frente.concat(p.ids_outras) });
    planejarCaixas(gs.slice(0, 6).map((g) => ({ chave: nCx(nomeCurto(g.nome)), titulo: nomeCurto(g.nome), sub0: g.nivel === 'município' ? '' : (/^demais/.test(g.nome) ? 'demais cidades da microrregião' : 'microrregião'),
      numero: `${g.frente} de ${g.lavouras}`, def: 'lavouras à frente da média dos concorrentes', dif: scTxt(g.vantagem_sc_ha), ids: g.ids })));
  }
  function mostrarArea(hib, geo, r) {
    const p = N().placarDoHibrido(D.mapa, hib, geo || {});
    const id = r && r.area && r.area.id;
    if (!id) { mostrarPlacar(hib, geo); return; }
    const area = D.mapa.areas.find((x) => x.id === id);
    planejarCaixas([caixaDaArea(area, hib, r.area.sc, r.area.vant)]);
    ctl.destacar({ filtro: Object.assign({}, geo || {}, { hib }), frente: [id], outras: p.ids_frente.concat(p.ids_outras).filter((i) => i !== id), selo: '', zoom: [id] });
    ctl.passear([id], { ms: 600000 });
  }
  function mostrarTop(hib, geo, top) {
    const p = N().placarDoHibrido(D.mapa, hib, geo || {});
    if (!top.length) { mostrarPlacar(hib, geo); falar(`Nenhuma lavoura do ${hib} passa na régua dos destaques ${N().ondeFalado(D.mapa, geo)}.`); return; }
    ctl.destacar({ filtro: Object.assign({}, geo || {}, { hib }), frente: top.map((x) => x.id), outras: p.ids_frente.concat(p.ids_outras).filter((i) => !top.some((x) => x.id === i)), selo: '', zoom: top.map((x) => x.id) });
    const porId = {}; D.mapa.areas.forEach((x) => { porId[x.id] = x; });
    planejarCaixas(top.map((t) => caixaDaArea(porId[t.id], hib, t.sc, t.vant)));
    ctl.passear(top.map((x) => x.id), {
      ms: 7000, ocupado: () => !!usar((a) => a.falando()),
      aoPasso: (i, a, n) => { if (mapaAberto) falar(N().fraseDoDestaque(D.mapa, hib, top[i], a, i, n, geo)); },
    });
  }
  const fraseDaFicha = (a) => {
    if (!a) return 'Nenhuma área para abrir aqui.';
    const m = N().mediaDoEnsaio(a);
    return `${a.mun}, plantio ${N().dataFalada(a.pl)}: ${(a.h || []).length} híbridos, média do ensaio ${dec1(m)} sacas por hectare.`;
  };
  async function executarMapa(r) {
    if (!(await abrirMapa())) { falar('O mapa da demonstração não carregou. Recarregue a página.'); return; }
    if (r.hib) assunto = { hib: r.hib, geo: r.geo || assunto.geo };
    else if (r.geo) assunto.geo = r.geo;
    switch (r.acao) {
      case 'placar': case 'no_mapa': if (r.hib) mostrarPlacar(r.hib, r.geo); break;
      case 'lugares': mostrarLugares(r.hib, r.geo, r.lugares || []); break;
      case 'area_por': mostrarArea(r.hib, r.geo, r.area); break;
      case 'top': mostrarTop(r.hib, r.geo, r.top || []); return;          // o passeio fala sozinho, passo a passo
      case 'abrir': if (r.filtro) ctl.filtrar(r.filtro, r.geoTroca); falar(`Mapa dos resultados da demonstração: ${mil(D.mapa.areas.length)} lavouras fictícias. Peça um híbrido, uma cidade ou uma região.`); return;
      case 'filtro': { const n = ctl.filtrar(r.filtro, r.geoTroca); falar(n ? `${mil(n)} ${n === 1 ? 'área' : 'áreas'} no filtro. Diga "abre essa área" ou toque numa bolinha.` : 'Nenhuma área com esse filtro.'); return; }
      case 'limpar': ctl.limpar(); falar(`Mapa inteiro: ${mil(D.mapa.areas.length)} lavouras fictícias.`); return;
      case 'area': { let a = null; if (ctl.emPasseio()) { ctl.segurar(); return; } if (r.filtro) { ctl.filtrar(r.filtro, r.geoTroca); a = ctl.abrirPrimeira(); } else a = ctl.aberta() || ctl.abrirPrimeira(); falar(fraseDaFicha(a)); return; }
      case 'proxima': if (ctl.emPasseio()) ctl.proxima(); else falar(fraseDaFicha(ctl.proxima())); return;
      case 'anterior': if (ctl.emPasseio()) ctl.anterior(); else falar(fraseDaFicha(ctl.anterior())); return;
      case 'pausa': ctl.segurar(); return;
      case 'fechar': fecharMapa(); return;
      case 'fechar_ficha': ctl.fecharFicha(); return;
      default: break;
    }
    if (r.fala) falar(r.fala);
  }

  // ------------------------------------------------------------------------------------------ A CARTEIRA (4 telas)
  let iCart = 0, telas = null;
  const pctTxt = (v) => `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`;
  function corpoDaTela(t) {
    const C = D.carteira, R = C.revendas, T = F().totais(C);
    const max = Math.max(...R.map((x) => Math.max(x.sc26, x.sc27 + x.prospeccao)));
    const w = (v) => `${Math.max(1.5, (v / max) * 100).toFixed(1)}%`;
    if (t.id === 'carteira') {
      const linhas = R.slice().sort((a, b) => b.sc27 - a.sc27).map((x) => `<div class="dm-linha"><span>${esc(x.nome)}</span><span class="dm-trilho"><i class="a" style="--w:${w(x.sc26)}"></i><i class="b" style="--w:${w(x.sc27)}"></i></span><span style="text-align:right">${mil(x.sc27)} <small style="color:${x.sc27 >= x.sc26 ? '#c4ca3c' : '#ff8a6b'}">${pctTxt(x.sc27 / x.sc26 - 1)}</small></span></div>`).join('');
      return `<div class="dm-grade" style="grid-template-columns:.9fr 1.6fr"><div class="dm-p"><p class="dm-rot">Vendido 26 → fechado 27</p><div class="dm-seta"><span class="dm-g">${mil(T.sc26)}</span><i>→</i><span class="dm-g ouro">${mil(T.sc27)}<small>sacos</small></span></div>
        <p class="dm-txt"><b>${pctTxt(t.numeros.crescimento)}</b> sobre a safra 26</p><p class="dm-txt">${R.length} revendas na carteira</p></div>
        <div class="dm-p"><p class="dm-rot">Por revenda · 26 × 27</p><div class="dm-barras">${linhas}</div><div class="dm-leg"><span><i style="background:rgba(241,233,196,.35)"></i>safra 26</span><span><i style="background:#c4ca3c"></i>fechado 27</span></div></div></div>`;
    }
    if (t.id === 'cancelamento') {
      const mot = t.numeros.motivos.map((m) => `<tr><td>${esc(m.motivo)}</td><td>${mil(m.sc)}</td></tr>`).join('');
      const nome = (k) => (R.find((x) => x.chave === k) || {}).nome || k;
      const lista = C.cancelamentos.slice().sort((a, b) => b.sc - a.sc).map((c) => `<tr><td>${esc(c.cliente)} <small style="color:#b3a97a">· ${esc(nome(c.revenda))}</small></td><td>${mil(c.sc)}</td><td style="text-align:left">${esc(c.motivo)}</td></tr>`).join('');
      return `<div class="dm-grade" style="grid-template-columns:1fr 1fr 1.5fr;grid-template-rows:auto 1fr;grid-template-areas:'a b c' 'd d c'">
        <div class="dm-p" style="grid-area:a"><p class="dm-rot">Fechado 27</p><span class="dm-g ouro">${mil(t.numeros.fechado)}<small>sacos</small></span></div>
        <div class="dm-p" style="grid-area:b"><p class="dm-rot">Cancelado</p><span class="dm-g alerta">${mil(t.numeros.cancelado)}<small>sacos</small></span><p class="dm-txt">${Math.round((t.numeros.cancelado / t.numeros.negociado) * 100)}% do total negociado</p></div>
        <div class="dm-p" style="grid-area:c"><p class="dm-rot">Os cancelamentos, um a um</p><table><thead><tr><th>Cliente</th><th>sacos</th><th style="text-align:left">motivo</th></tr></thead><tbody>${lista}</tbody></table></div>
        <div class="dm-p" style="grid-area:d"><p class="dm-rot">Por motivo</p><table><thead><tr><th>Motivo</th><th>sacos</th></tr></thead><tbody>${mot}<tr class="tot"><td>Total</td><td>${mil(t.numeros.cancelado)}</td></tr></tbody></table></div></div>`;
    }
    if (t.id === 'prospeccao') {
      const linhas = R.slice().sort((a, b) => b.prospeccao - a.prospeccao).map((x) => `<div class="dm-linha"><span>${esc(x.nome)}</span><span class="dm-trilho"><i class="b" style="--w:${w(x.sc27)}"></i><i class="c" style="--w:${w(x.sc27 + x.prospeccao)};z-index:0"></i><i class="b" style="--w:${w(x.sc27)}"></i></span><span style="text-align:right">+${mil(x.prospeccao)}</span></div>`).join('');
      return `<div class="dm-grade" style="grid-template-columns:.9fr 1.6fr"><div class="dm-p"><p class="dm-rot">Fechado + prospecção (BEST)</p><div class="dm-seta"><span class="dm-g">${mil(t.numeros.fechado)}</span><i>+</i><span class="dm-g ouro">${mil(t.numeros.prospeccao)}</span></div>
        <p class="dm-rot" style="margin-top:1.2em">Se tudo se confirmar</p><span class="dm-g ouro">${mil(t.numeros.potencial)}<small>sacos</small></span><p class="dm-txt"><b>${pctTxt(t.numeros.crescimento)}</b> sobre a safra 26 (${mil(T.sc26)} sacos)</p><p class="dm-txt">Fechado hoje: <b>${pctTxt(T.sc27 / T.sc26 - 1)}</b></p></div>
        <div class="dm-p"><p class="dm-rot">Onde está a oportunidade</p><div class="dm-barras">${linhas}</div><div class="dm-leg"><span><i style="background:#c4ca3c"></i>fechado 27</span><span><i style="background:#f9b84a"></i>prospecção</span></div></div></div>`;
    }
    const n = t.numeros;
    const k = (rot, v, cls, txt) => `<div class="dm-p"><p class="dm-rot">${rot}</p><span class="dm-g ${cls || ''}">${mil(v)}<small>sacos</small></span>${txt ? `<p class="dm-txt">${txt}</p>` : ''}</div>`;
    const linhas = R.map((x) => `<tr><td>${esc(x.nome)}</td><td>${mil(x.pedido_sistema)}</td><td>${mil(x.faturado)}</td><td>${mil(x.pedido_sistema - x.faturado)}</td><td>${mil(x.sc27)}</td><td class="${x.pedido_sistema - x.sc27 < 0 ? 'neg' : ''}">${x.pedido_sistema - x.sc27 < 0 ? '−' : ''}${mil(x.pedido_sistema - x.sc27)}</td></tr>`).join('');
    return `<div class="dm-grade" style="grid-template-columns:repeat(5,1fr);grid-template-rows:auto 1fr">${k('Pedido em sistema', n.pedido)}${k('Faturado', n.faturado, 'ouro')}${k('A faturar', n.a_faturar)}${k('Vendido', n.vendido)}${k('Saldo', n.saldo, n.saldo < 0 ? 'alerta' : '', n.saldo >= 0 ? 'semente ainda sem cliente' : 'falta semente')}
      <div class="dm-p" style="grid-column:1 / -1"><p class="dm-rot">Por revenda</p><table><thead><tr><th>Revenda</th><th>Pedido em sistema</th><th>Faturado</th><th>A faturar</th><th>Vendido</th><th>Saldo</th></tr></thead><tbody>${linhas}
      <tr class="tot"><td>Total</td><td>${mil(n.pedido)}</td><td>${mil(n.faturado)}</td><td>${mil(n.a_faturar)}</td><td>${mil(n.vendido)}</td><td>${mil(n.saldo)}</td></tr></tbody></table></div></div>`;
  }
  function desenharCarteira() {
    const t = telas[iCart];
    $('.dm-tit', camadaCart).textContent = t.titulo;
    $('.dm-tag', camadaCart).textContent = t.tag;
    $('.dm-nav', camadaCart).innerHTML = telas.map((x, k) => `<button type="button" data-ir="${k}" class="${k === iCart ? 'on' : ''}">${esc(x.nav)}</button>`).join('');
    $('.dm-corpo', camadaCart).innerHTML = corpoDaTela(t);
    usar((a) => a.formar([]));
    const janelas = $$('.dm-p', camadaCart).slice(0, 6);
    if (!CALMO) setTimeout(() => { if (camadaCart.classList.contains('on')) usar((a) => a.formar(janelas)); }, 900); else usar((a) => a.formar(janelas));
  }
  async function irCarteira(k, falarJunto) {
    const d = await carregar();
    if (!d) { falar('A carteira da demonstração não carregou. Recarregue a página.'); return; }
    montarCamadas(); fecharMapa();
    usar((a) => a.fecharJanelas());
    telas = F().telasDaCarteira(d.carteira);
    iCart = Math.max(0, Math.min(telas.length - 1, k));
    camadaCart.classList.add('on'); document.body.classList.add('pb-aberto');
    desenharCarteira();
    if (falarJunto) falar(telas[iCart].fala);
  }
  function fecharCarteira(calado) {
    if (!camadaCart.classList.contains('on')) return false;
    camadaCart.classList.remove('on');
    if (!mapaAberto) document.body.classList.remove('pb-aberto');
    usar((a) => a.formar([]));
    if (!calado) usar((a) => a.legendaSome(800));
    return true;
  }
  addEventListener('keydown', (e) => {
    if (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    if (camadaCart.classList.contains('on')) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); irCarteira(iCart + 1, true); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); irCarteira(iCart - 1, true); }
      else if (e.key === 'Escape') fecharCarteira();
    } else if (mapaAberto && e.key === 'Escape') { if (ctl && ctl.aberta()) ctl.fecharFicha(); else fecharMapa(); }
  });

  // ------------------------------------------------------------------------------------------ COMANDO DE TELA
  function comandoDeTela(acao, falarJunto) {
    if (acao === 'fechar_mapa') { fecharMapa(); if (falarJunto) falar('Mapa fechado.'); return true; }
    if (acao === 'fechar_ficha') { if (ctl) ctl.fecharFicha(); if (falarJunto) falar('Ficha fechada.'); return true; }
    if (acao !== 'inicio') return false;
    fecharMapa(); fecharCarteira(true);
    usar((a) => a.fecharJanelas());
    if (falarJunto) falar('Pronto, voltei à tela inicial.');
    return true;
  }

  // ------------------------------------------------------------------------------------------ A PONTE COM O MOTOR
  function estadoDaTela() {
    const e = ctl ? ctl.estado() : null;
    return { mapaAberto, fichaAberta: !!(ctl && ctl.aberta()), passeio: !!(ctl && ctl.emPasseio()), filtro: e ? e.filtro : null,
      hibAssunto: assunto.hib, geoAssunto: assunto.geo, ofereceuMapa, mostrados, carteiraAberta: camadaCart.classList.contains('on'), telaCarteira: iCart,
      tituloCarteira: telas && telas[iCart] ? telas[iCart].titulo : '', ondeAssunto: D && assunto.geo && N() ? N().ondeFalado(D.mapa, assunto.geo) : '' };
  }
  function frase(texto) {
    if (!F() || !N() || !D) return false;                 // sem os dados ainda: vai ao agente (a página não fica muda)
    let r = null;
    try { r = F().interpretar(D, N(), usar((a) => a.semChamada(texto)) ?? texto, estadoDaTela()); } catch (e) { console.log('[demo] fala', e); return false; }
    ofereceuMapa = false;                                // a oferta do agente vale só para a fala logo depois dela
    if (!r) return false;
    usar((a) => a.legenda(`<span class="voce">${esc(texto)}</span>`));
    if (r.tipo === 'tela') return comandoDeTela(r.acao, true);
    if (r.tipo === 'carteira') { if (r.acao === 'fechar') { fecharCarteira(); return true; } irCarteira(r.tela, true); return true; }
    if (r.tipo === 'mapa') {
      if (r.acao === 'qual_hibrido') { falar(r.fala); return true; }
      if (r.acao === 'fechar') { fecharMapa(); return true; }
      executarMapa(r); return true;
    }
    return false;
  }
  function telaDoAgente(t) {
    if (t && t.ferramenta === 'comando_de_tela') return comandoDeTela(t.resultado && t.resultado.acao, false);
    // qualquer painel do agente: as camadas da demonstração saem da frente
    if (t && t.ferramenta !== 'historico_ao_vivo') { fecharMapa(); fecharCarteira(true); }
    return false;
  }
  // 06/out/2026 (madrugada): a resposta do AGENTE muda o assunto da conversa (o híbrido e o lugar que ele falou) e diz se ele
  // ofereceu o mapa — o "sim, pode abrir" / "abre no mapa" seguinte abre ESSE placar (demo-milho-falas.js depoisDoAgente)
  addEventListener('aovivo-resposta-do-agente', (e) => {
    if (!F() || !N() || !D || typeof F().depoisDoAgente !== 'function') return;
    try {
      const c = F().depoisDoAgente(D, N(), estadoDaTela(), e.detail && e.detail.pergunta, e.detail && e.detail.resposta);
      assunto = { hib: c.hibAssunto || null, geo: c.geoAssunto || null };
      ofereceuMapa = !!c.ofereceuMapa;
    } catch (er) { console.log('[demo] assunto', er); }
  });
  function registrar() {
    window.AO_VIVO_FRASE = (texto) => { try { return frase(texto); } catch (e) { console.log('[demo] erro', e); return false; } };
    window.AO_VIVO_CONTEXTO_TELA = () => (F() ? F().contexto(estadoDaTela()) : '');
    window.AO_VIVO_TELA_TEMA = telaDoAgente;
  }
  registrar();
  if (document.body) montarCamadas(); else document.addEventListener('DOMContentLoaded', montarCamadas);
  // só para o ensaio sem janela (scripts/demo-milho/ensaio-demo-milho.mjs)
  window.DemoMilho = { frase, carregar, estado: estadoDaTela, get mapaAberto() { return mapaAberto; }, get carteiraAberta() { return camadaCart.classList.contains('on'); }, get controle() { return ctl; } };
})();
