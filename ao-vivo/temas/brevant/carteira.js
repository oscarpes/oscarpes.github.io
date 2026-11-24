/* ---------------------------------------------------------------------------------------------
   APRESENTAÇÃO DA REVENDA NA TELA AO VIVO — tema Brevant (05/out/2026).

   João, 05/out/2026: a Thamilly Carpes pode apresentar para a Mocellin pelo Jarvis ao vivo em vez da
   apresentação HTML, e "se fosse apresentar por lá ia estar mais ou menos igual à apresentação que
   montou". Então, quando ela pede os dados de uma revenda ("vamos falar da Mocellin, me traga os
   dados"), a resposta da consulta dados_carteira abre a SEQUÊNCIA da HTML — uma tela por vez, com as
   janelas de vidro que entram voando (as mesmas do playbook) e a logo da revenda no canto (revendas.js).

   As telas são montadas por carteira-telas.js (funções puras, conferidas pelo portão); aqui só o desenho:
     - a camada #cv (fora da do playbook: as duas nunca ficam abertas juntas);
     - a navegação: chips no alto, ← → / PageUp PageDown (o passador de slides), clique, e a VOZ:
       "mostra o crescimento", "e a recompra?", "como foi o B2701 por época?", "o campo em Nova Ubiratã",
       "próximos passos", "a estratégia", "próximo", "volta", "fecha". A fala é resolvida AQUI (na hora,
       sem servidor) e o Jarvis diz a frase pronta da carga (`textos`) — nunca frase inventada;
     - pergunta de verdade ("por que a recompra caiu?") e outra revenda vão para o agente (a trava do
       servidor decide); com a revenda trocada no servidor (o selo muda), a apresentação fecha.
   O B2900 e os clientes para ligar só existem aqui quando o SERVIDOR mandou (ela citou / ela pediu).
   --------------------------------------------------------------------------------------------- */
(function () {
  'use strict';
  // os módulos do tema entram como <script> soltos (a ordem de chegada não é garantida): as telas são lidas na hora
  const CT = () => window.CarteiraTelas || null;
  const CALMO = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const celular = () => !!(window.matchMedia && matchMedia('(max-width: 759px)').matches);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const A = () => window.AO_VIVO || null;
  const usar = (f) => { const a = A(); if (!a) return undefined; try { return f(a); } catch (e) { console.log('[carteira] motor', e); return undefined; } };
  const pb = () => window.PlaybookBrevant || null;

  // ------------------------------------------------------------------------------------------
  // ESTILO (só deste módulo; vidro, rótulo e entrada voando vêm das .pb-p do tema)
  // ------------------------------------------------------------------------------------------
  const estilo = document.createElement('style');
  estilo.textContent = `
  html.tema-brevant #cv{position:fixed;inset:0;z-index:3;display:none;pointer-events:none;font-family:"Outfit",system-ui,sans-serif;color:#fbfbfc;
    --cv-top:calc(14px + env(safe-area-inset-top) + 124px);--cv-base:calc(150px + env(safe-area-inset-bottom));--cv-lado:clamp(16px,2.4vw,52px)}
  html.tema-brevant #cv.on{display:block;pointer-events:auto}
  html.tema-brevant #cv::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 45%,rgba(60,6,22,.35),rgba(30,2,10,.8));pointer-events:none;animation:pb-aparece .5s both}
  #cv .cv-hud{position:absolute;left:var(--cv-lado);right:var(--cv-lado);top:calc(var(--cv-top) - 38px);height:30px;display:flex;align-items:center;gap:10px;z-index:2}
  #cv .cv-hud-rot{font:900 13px/1 "Amboy","Anton","Outfit",sans-serif;letter-spacing:.06em;background:#f47c06;color:#3c0616;padding:.5em .7em .4em;border-radius:3px;white-space:nowrap}
  #cv .cv-nav{display:flex;gap:6px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none}
  #cv .cv-nav::-webkit-scrollbar{display:none}
  #cv .cv-hud button{background:rgba(34,3,12,.55);border:1px solid rgba(245,136,7,.35);color:#f3e6ea;font:700 11px "Outfit",sans-serif;letter-spacing:.12em;padding:6px 10px;border-radius:999px;cursor:pointer;white-space:nowrap}
  #cv .cv-hud button.on{background:linear-gradient(90deg,#f37207,#f58807);color:#3c0616;border-color:transparent}
  #cv .cv-fechar{margin-left:auto}
  #cv .cv-palco{position:absolute;left:var(--cv-lado);right:var(--cv-lado);top:var(--cv-top);bottom:var(--cv-base);display:flex;flex-direction:column;min-height:0}
  #cv .cv-cab{flex:0 0 auto;margin-bottom:clamp(10px,1.4vh,18px);animation:pb-entra .6s cubic-bezier(.2,.8,.2,1) both}
  #cv .cv-tag{display:inline-block;background:#f47c06;color:#3c0616;font:800 clamp(11px,.85vw,15px)/1.2 "Outfit",sans-serif;letter-spacing:.16em;text-transform:uppercase;padding:.36em .7em .3em;border-radius:3px}
  #cv h1{margin:.12em 0 0;font:400 clamp(30px,3.5vw,66px)/1.02 "Amboy","Anton","Outfit",sans-serif;text-transform:uppercase;letter-spacing:.005em;color:#fff;text-shadow:0 4px 24px rgba(0,0,0,.35)}
  #cv .cv-sub{margin:.35em 0 0;font:400 clamp(14px,1.12vw,21px)/1.35 "Outfit",sans-serif;color:#f3e6ea;max-width:1600px}
  #cv .cv-autoria{margin:.3em 0 0;font:400 clamp(12px,.85vw,16px)/1.3 "Outfit",sans-serif;color:#d9c5cb}
  #cv .cv-corpo{flex:1;min-height:0;display:flex;flex-direction:column}
  #cv .cv-pe{flex:0 0 auto;margin-top:10px;font:400 clamp(12px,.9vw,17px)/1.35 "Outfit",sans-serif;color:#d9c5cb}
  #cv .cv-rodape{position:absolute;left:var(--cv-lado);right:var(--cv-lado);bottom:calc(var(--cv-base) - 34px);display:flex;justify-content:space-between;font:400 13px "Outfit",sans-serif;color:#d9c5cb;pointer-events:none}
  #cv .cv-rodape b{color:#fbfbfc;font-weight:700}
  #cv .cv-rodape .n{font-weight:700;letter-spacing:.14em;color:#fbfbfc}
  #cv .cv-grade{flex:1;min-height:0;display:grid;gap:clamp(10px,1.1vw,22px)}
  #cv .cv-p{padding:clamp(14px,1.2vw,24px) clamp(16px,1.4vw,28px);display:flex;flex-direction:column;min-height:0;overflow:hidden}
  #cv .cv-rot{flex:0 0 auto;color:#f58807;font:800 clamp(11px,.8vw,15px)/1.25 "Outfit",sans-serif;letter-spacing:.16em;text-transform:uppercase;margin:0 0 .5em 6px}
  #cv .cv-pc{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center}
  #cv .cv-g{font:400 clamp(34px,3.3vw,64px)/1 "Amboy","Anton","Outfit",sans-serif;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap}
  #cv .cv-g small{font-size:.42em;margin-left:.12em;color:#e6e8ea;letter-spacing:.02em}
  #cv .cv-g.lar{color:#f58807;text-shadow:0 0 28px rgba(244,124,6,.35)}
  #cv .cv-g.cv-xg{font-size:clamp(60px,6.4vw,130px)}
  #cv .cv-mudo{margin:.5em 0 0;font:400 clamp(12px,.85vw,16px)/1.35 "Outfit",sans-serif;color:#d9c5cb}
  #cv .cv-autor{margin:.35em 0 0;font:600 clamp(11px,.78vw,14px)/1.3 "Outfit",sans-serif;color:#f9c48a;letter-spacing:.02em}
  #cv .cv-forte{margin:.3em 0 0;font:400 clamp(14px,1.05vw,20px)/1.3 "Outfit",sans-serif;color:#fbfbfc}
  #cv .cv-forte b,#cv .cv-kpi b{font-weight:700}
  #cv .cv-txt{margin:0;font:400 clamp(14px,1.08vw,21px)/1.42 "Outfit",sans-serif;color:#f3e6ea}
  #cv .cv-trilho{flex:1;height:clamp(18px,1.6vw,30px);border-radius:6px;background:rgba(230,232,234,.08);overflow:hidden}
  #cv .cv-trilho i{display:block;height:100%;width:var(--w);border-radius:6px;animation:pb-barra 1.1s cubic-bezier(.2,.8,.2,1) .7s both}
  #cv .cv-trilho i.b{background:linear-gradient(90deg,#c9b4ba,#e6e8ea)} #cv .cv-trilho i.v{background:linear-gradient(90deg,#810d2f,#b31a47)} #cv .cv-trilho i.l{background:linear-gradient(90deg,#f37207,#f58807);box-shadow:0 0 18px rgba(244,124,6,.45)}
  #cv .cv-barras{display:flex;flex-direction:column;gap:clamp(14px,2.2vh,34px)}
  #cv .cv-linha{display:grid;grid-template-columns:minmax(120px,.42fr) 1fr minmax(160px,.34fr);align-items:center;gap:clamp(12px,1.2vw,24px)}
  #cv .cv-linha > span{font:700 clamp(15px,1.15vw,22px)/1.2 "Outfit",sans-serif}
  #cv .cv-linha .cv-g{text-align:right}
  #cv .cv-linha-p > span{font-weight:400;font-size:clamp(13px,.95vw,18px)}
  #cv .cv-seta{display:flex;align-items:baseline;gap:.3em;flex-wrap:wrap} #cv .cv-seta em{font-style:normal;color:#f58807;font:400 clamp(26px,2.4vw,46px)/1 "Anton",sans-serif}
  #cv .cv-kpi{display:flex;align-items:center;gap:clamp(14px,1.4vw,28px)} #cv .cv-kpi p{margin:0;font:400 clamp(13px,1vw,19px)/1.32 "Outfit",sans-serif}
  #cv .cv-fila2,#cv .cv-fila3,#cv .cv-fila4{display:grid;gap:clamp(10px,1.1vw,22px);min-height:0}
  #cv .cv-fila2{grid-template-columns:1fr 1fr} #cv .cv-fila5{display:grid;gap:clamp(10px,1.1vw,22px);grid-template-columns:repeat(5,1fr)} #cv .cv-fila3{grid-template-columns:repeat(3,1fr)} #cv .cv-fila4{grid-template-columns:repeat(4,1fr)}
  #cv .cv-lista{list-style:none;margin:0;padding:0} #cv .cv-lista li{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:.42em 0;border-top:1px solid rgba(230,232,234,.10);font:400 clamp(14px,1.05vw,21px)/1.25 "Outfit",sans-serif}
  #cv .cv-lista li:first-child{border-top:0} #cv .cv-lista li b{font-weight:700} #cv .cv-lista li span{white-space:nowrap;font-weight:700;font-variant-numeric:tabular-nums}
  #cv .cv-lista li em{font-style:normal;font-weight:400;color:#d9c5cb;margin-left:.4em;font-size:.86em} #cv .cv-lista .cv-sc{font-style:normal;color:#f58807;margin:0 .25em}
  #cv .cv-lista-d li{padding:.3em 0;font-size:clamp(13px,.98vw,19px)}
  #cv .cv-etq{display:inline-block;background:#f47c06;color:#fff;font:700 .82em/1 "Outfit",sans-serif;padding:.32em .7em .28em;border-radius:999px;letter-spacing:.02em;white-space:nowrap}
  #cv .cv-etq-p{font-size:.7em;margin-left:.6em;vertical-align:.1em;color:#3c0616}
  #cv .cv-chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:clamp(10px,1.6vh,22px)}
  #cv .cv-chip{display:inline-block;border:1px solid rgba(245,136,7,.55);background:rgba(244,124,6,.12);border-radius:999px;padding:.4em .9em;font:700 clamp(12px,.92vw,18px)/1.2 "Outfit",sans-serif;white-space:nowrap}
  #cv .cv-tab{width:100%;border-collapse:collapse;font:400 clamp(13px,1.02vw,20px)/1.25 "Outfit",sans-serif;font-variant-numeric:tabular-nums}
  #cv .cv-tab th{color:#f58807;font:800 clamp(10px,.7vw,13px)/1.25 "Outfit",sans-serif;letter-spacing:.12em;text-transform:uppercase;text-align:right;padding:0 .7em .6em;vertical-align:bottom}
  #cv .cv-tab th:first-child,#cv .cv-tab td:first-child{text-align:left}
  #cv .cv-tab td{text-align:right;padding:.42em .7em;border-top:1px solid rgba(230,232,234,.10)}
  #cv .cv-tab td.pos{color:#f58807;font-weight:700} #cv .cv-tab td.peq{font-size:.78em;color:#d9c5cb}
  #cv .cv-tab tr.tot td{border-top:2px solid rgba(245,136,7,.5);font-weight:700}
  #cv .cv-tab-g{font-size:clamp(15px,1.25vw,24px)} #cv .cv-tab-g td{padding:.6em .7em}
  #cv .cv-tab-rc{font-size:clamp(11px,.82vw,16px)} #cv .cv-tab-rc td{padding:.26em .6em} #cv .cv-tab-rc tr.grp td{color:#f58807;font:800 .78em "Outfit",sans-serif;letter-spacing:.14em;text-transform:uppercase;border-top:0;padding-top:.7em}
  #cv .cv-tab-val .cv-nn{display:block;font-size:.7em;color:#d9c5cb;font-weight:400} #cv .cv-tab-val td em{font-style:normal;font-size:.72em;color:#d9c5cb}
  #cv .cv-tab-val td.cv-branco{border-bottom:1px dashed rgba(245,136,7,.55);min-width:12em}
  #cv .cv-sinal{border:1px solid rgba(230,232,234,.5);border-radius:999px;padding:.1em .6em;font-size:.78em;color:#e6e8ea}
  #cv .cv-tabp .cv-pc{justify-content:flex-start;overflow:auto}
  #cv .cv-dey{display:flex;align-items:baseline;gap:.25em;flex-wrap:wrap} #cv .cv-dey i{font-style:normal;font:400 clamp(16px,1.3vw,26px) "Anton",sans-serif;color:#e6e8ea}
  #cv .cv-campo{display:flex;align-items:center;gap:clamp(18px,2.2vw,44px)}
  #cv .cv-anel{width:clamp(180px,16vw,320px);height:auto;flex:none}
  #cv .cv-anel circle{fill:none;stroke-width:26} #cv .cv-anel .f{stroke:rgba(230,232,234,.10)} #cv .cv-anel .a{stroke:#f58807;stroke-linecap:round;stroke-dashoffset:var(--fim);animation:cv-anel 1.4s cubic-bezier(.2,.8,.2,1) .8s both;filter:drop-shadow(0 0 10px rgba(244,124,6,.5))}
  #cv .cv-anel text{fill:#fff;font:400 74px "Amboy","Anton",sans-serif}
  @keyframes cv-anel{from{stroke-dashoffset:var(--ini)}}
  #cv .cv-col{display:grid;gap:clamp(10px,1.1vw,22px);min-height:0}
  #cv .cv-alvo{box-shadow:0 0 0 2px #f58807,0 0 38px rgba(244,124,6,.55)!important}
  #cv .cv-card{display:flex;flex-direction:column;gap:.4em;height:100%;justify-content:flex-start} #cv .cv-card p{margin:0;font:400 clamp(13px,1.02vw,20px)/1.35 "Outfit",sans-serif}
  #cv .cv-n{font:400 clamp(34px,2.6vw,52px)/1 "Amboy","Anton",sans-serif;color:#f58807}
  #cv .cv-passo{display:flex;align-items:center;gap:clamp(14px,1.4vw,28px)} #cv .cv-passo > div{flex:1;min-width:0}
  #cv .cv-passo .t1{margin:0;font:700 clamp(15px,1.25vw,25px)/1.25 "Outfit",sans-serif} #cv .cv-passo .t2{margin:.2em 0 0;font:400 clamp(12px,.92vw,18px)/1.3 "Outfit",sans-serif;color:#d9c5cb}
  #cv .cv-bola{flex:none;width:clamp(36px,2.6vw,52px);height:clamp(36px,2.6vw,52px);border-radius:50%;border:2px solid #f58807;display:grid;place-items:center;font:400 clamp(18px,1.4vw,28px) "Anton",sans-serif;color:#f58807}
  #cv .cv-nome{flex:none;width:28%;font:700 clamp(15px,1.15vw,22px)/1.2 "Outfit",sans-serif}
  #cv .cv-pp{padding-top:clamp(8px,.8vw,14px);padding-bottom:clamp(8px,.8vw,14px)}
  /* os arranjos de cada tela (1920 × 1080 é o desenho da HTML) */
  #cv .cv-g-cres{grid-template-columns:1.9fr .55fr .55fr;grid-template-rows:1fr 1.05fr;grid-template-areas:"vol cres cres" "vol cli tk"}
  #cv .cv-a-vol{grid-area:vol} #cv .cv-a-cres{grid-area:cres} #cv .cv-a-cli{grid-area:cli} #cv .cv-a-tk{grid-area:tk}
  #cv .cv-g-rec{grid-template-rows:auto 1fr} #cv .cv-g-ped{grid-template-rows:auto 1fr}
  #cv .cv-g-plano{grid-template-columns:1.7fr 1fr;grid-template-rows:1fr 1fr;grid-template-areas:"tot quem" "barras quem"}
  #cv .cv-a-tot{grid-area:tot} #cv .cv-a-barras{grid-area:barras} #cv .cv-a-quem{grid-area:quem}
  #cv .cv-g-campo{grid-template-columns:1.62fr 1fr}
  #cv .cv-g-ep{grid-template-rows:1fr} #cv .cv-g-estr{grid-template-rows:auto 1fr} #cv .cv-g-b29{grid-template-rows:auto 1fr}
  #cv .cv-g-passos{grid-auto-rows:1fr}
  #cv .cv-k .cv-pc,#cv .cv-k4 .cv-pc{justify-content:center}
  #cv .cv-cards .cv-pc,#cv .cv-topo .cv-pc{justify-content:flex-start}
  @media (max-width:759px){
    html.tema-brevant #cv{--cv-top:calc(14px + env(safe-area-inset-top) + 96px);--cv-base:calc(132px + env(safe-area-inset-bottom))}
    #cv .cv-palco{overflow-y:auto} #cv .cv-corpo{flex:none}
    #cv .cv-grade,#cv .cv-fila2,#cv .cv-fila3,#cv .cv-fila4,#cv .cv-fila5{grid-template-columns:1fr!important;grid-template-areas:none!important;grid-template-rows:none!important}
    #cv .cv-grade > *{grid-area:auto!important} #cv .cv-campo{flex-direction:column} #cv .cv-rodape{display:none}
  }
  @media (prefers-reduced-motion: reduce){#cv *,#cv *::before,#cv *::after{animation:none!important;transition:none!important}}`;
  document.head.appendChild(estilo);

  const raiz = document.createElement('div');
  raiz.id = 'cv';
  raiz.setAttribute('aria-live', 'polite');
  raiz.innerHTML = '<div class="cv-hud"><span class="cv-hud-rot">APRESENTAÇÃO</span><span class="cv-nav"></span><button class="cv-fechar" type="button">FECHAR ✕</button></div><div class="cv-palco"></div><div class="cv-rodape"></div>';
  document.body.appendChild(raiz);
  const palco = $('.cv-palco', raiz);
  $('.cv-fechar', raiz).onclick = () => fechar();
  raiz.addEventListener('click', (e) => { const b = e.target.closest('[data-ir]'); if (b) { e.preventDefault(); ir(Number(b.dataset.ir)); } });

  let ap = null;        // { revenda, chave, representante, telas, r }
  let i = 0;            // a tela à vista
  let foco = null;      // a cidade do campo em destaque

  function desenhar() {
    if (!ap) return;
    const t = ap.telas[i];
    $('.cv-nav', raiz).innerHTML = ap.telas.map((x, k) => `<button data-ir="${k}" class="${k === i ? 'on' : ''}">${esc(x.nav)}</button>`).join('');
    palco.innerHTML = `<header class="cv-cab"><span class="cv-tag">${esc(t.tag)}</span><h1>${esc(t.titulo)}</h1>${t.sub ? `<p class="cv-sub">${esc(t.sub)}</p>` : ''}${t.autoria ? `<p class="cv-autoria">${esc(t.autoria)}</p>` : ''}</header>
      <div class="cv-corpo">${t.corpo}</div>${t.pe ? `<p class="cv-pe">${esc(t.pe)}</p>` : ''}`;
    $('.cv-rodape', raiz).innerHTML = `<span>${ap.representante ? `<b>${esc(ap.representante)}</b> · Representante Brevant · ` : ''}${esc(ap.revenda)}</span><span class="n">${String(i + 1).padStart(2, '0')} / ${String(ap.telas.length).padStart(2, '0')}</span>`;
    raiz.classList.remove('on'); void raiz.offsetWidth; raiz.classList.add('on');
    document.body.classList.add('pb-aberto', 'cv-aberto');
    // as bolinhas da logo correm para as janelas que acabaram de entrar (como no playbook)
    const janelas = $$('.cv-p', palco).slice(0, celular() ? 2 : 8);
    usar((a) => a.formar([]));
    if (!CALMO) setTimeout(() => { if (ap) usar((a) => a.formar(janelas)); }, 900);
    else usar((a) => a.formar(janelas));
    palco.scrollTop = 0;
  }

  /** Abre a apresentação com o resultado do servidor (ferramenta dados_carteira). */
  function abrir(t) {
    const r = (t && t.resultado) || {};
    const parte = String(r.parte || (t && t.argumentos && t.argumentos.parte) || '');
    if (!CT()) return false;
    // a parte → a tela e o destaque nela (a cidade do campo; o "ainda sem ninguém" da cascata)
    const al = CT().alvoDaParte(parte);
    const novo = CT().montarApresentacao(r, al ? al.foco : null);
    if (!novo) return false;
    const mesma = ap && ap.chave === novo.chave && ap.revenda === novo.revenda;
    const atual = mesma ? ap.telas[i] && ap.telas[i].id : null;
    ap = Object.assign(novo, { r });
    foco = al ? al.foco : null;
    const alvo = al ? al.tela : atual;
    const k = alvo ? ap.telas.findIndex((x) => x.id === alvo) : -1;
    i = k >= 0 ? k : 0;
    const p = pb(); if (p && p.estado && p.estado.vista) p.fechar(true);
    usar((a) => a.fecharJanelas());
    desenhar();
    return true;
  }
  function ir(k, falar) {
    if (!ap) return false;
    i = Math.max(0, Math.min(ap.telas.length - 1, k));
    desenhar();
    // o Jarvis diz a frase pronta da tela (a da carga) — e a legenda mostra o que ele diz
    const fala = ap.telas[i].fala;
    if (falar && fala) usar((a) => { a.pararVoz(); a.legenda(esc(fala)); a.falar(fala); });
    return true;
  }
  function fechar(calado) {
    if (!raiz.classList.contains('on')) return;
    raiz.classList.remove('on');
    document.body.classList.remove('cv-aberto');
    const p = pb(); if (!(p && p.estado && p.estado.vista)) document.body.classList.remove('pb-aberto');
    setTimeout(() => { if (!raiz.classList.contains('on')) palco.innerHTML = ''; }, 400);
    usar((a) => a.formar([]));
    if (!calado) usar((a) => a.legendaSome(800));
  }
  const aberta = () => raiz.classList.contains('on');

  // a revenda trocou no servidor (ou "bom dia" abriu conversa nova): a apresentação da outra fecha
  window.addEventListener('aovivo-escopo', (e) => {
    const esc0 = e.detail || null;
    if (!ap) return;
    if (!esc0 || (esc0.chave !== ap.chave && esc0.chave !== 'todas')) { fechar(true); ap = null; }
  });
  // o passador de slides (→ / PageDown avança, ← / PageUp volta, Esc fecha)
  addEventListener('keydown', (e) => {
    if (!aberta() || (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName))) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); ir(i + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); ir(i - 1); }
    else if (e.key === 'Escape') fechar();
  });

  // ------------------------------------------------------------------------------------------
  // A FALA: com a apresentação carregada, os pedidos curtos de uma parte são resolvidos aqui
  // ------------------------------------------------------------------------------------------
  // outra revenda, "todas", pergunta de verdade: vai para o agente (o servidor decide a trava)
  const OUTRAS = /\b(mocellin|defender|paiol|plantun|plantum|amaggi|crop|c vale|coacen|coanorte|novo agro|profarm|agro amazonia|amazonia|sorriso|todas|todos (os )?(meus )?dados|carteira (inteira|toda|completa)|outra revenda)\b/;
  const PERGUNTA = /\b(por que|porque|pq|explica|explique|compar\w*|diferenca|o que (e|significa)|quanto (falta|precisa)|calcula|simula)\b/;
  function frase(texto) {
    if (!ap || !CT()) return false;
    const s = norm(usar((a) => a.semChamada(texto)) ?? texto).replace(/^(brevant|brevante|brevan|oscar|jarvis)\b ?/, '');
    if (!s) return false;
    const nav = CT().navegacaoDaFala(s);
    if (nav && aberta()) {
      usar((a) => a.legenda(`<span class="voce">${esc(texto)}</span>`));
      if (nav === 'fechar') { fechar(); return true; }
      if (nav === 'comeco') return ir(0, true);
      return ir(i + (nav === 'proxima' ? 1 : -1), true);
    }
    // o nome da revenda aberta sai antes ("e a recompra da Mocellin Sorriso?" com ela aberta é dela)
    const semAtiva = norm(ap.revenda).split(' ').filter((w) => w.length > 3).reduce((x, w) => x.replace(new RegExp(`\\b${w}\\b`, 'g'), ' '), ` ${s} `);
    if (OUTRAS.test(semAtiva)) return false;
    if (PERGUNTA.test(s) || s.split(' ').length > 10) return false;
    const parte = CT().parteDaFala(s);
    if (!parte) return false;
    // com uma vista do playbook aberta, "a estratégia" e "o plano" são dela (as abas do híbrido, o plano na janela)
    const p = pb();
    if (!aberta() && p && p.estado && p.estado.vista && /^(estrategia|plano)$/.test(parte)) return false;
    const al = CT().alvoDaParte(parte);
    const k = ap.telas.findIndex((x) => x.id === al.tela);
    if (k < 0) return false;            // B2900 / clientes que o servidor ainda não mandou: o agente pede
    if (al.foco || foco) {
      // o destaque (a cidade do campo, o "ainda sem ninguém") muda o desenho: remonta com o foco novo
      foco = al.foco;
      const novo = CT().montarApresentacao(ap.r, foco);
      if (novo) ap = Object.assign(novo, { r: ap.r });
    }
    usar((a) => a.legenda(`<span class="voce">${esc(texto)}</span>`));
    if (p && p.estado && p.estado.vista) p.fechar(true);
    return ir(k, true);
  }
  function contexto() {
    if (!ap || !aberta()) return '';
    const t = ap.telas[i];
    return `apresentação de vendas da revenda ${ap.revenda}, tela "${t.titulo}" (${i + 1} de ${ap.telas.length})`;
  }

  window.CarteiraBrevant = { abrir, fechar, frase, contexto, ir, get aberta() { return aberta(); }, get estado() { return ap ? { revenda: ap.revenda, tela: ap.telas[i].id, telas: ap.telas.map((t) => t.id) } : null; } };
})();
