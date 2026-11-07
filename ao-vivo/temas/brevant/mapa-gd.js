/* ---------------------------------------------------------------------------------------------
   MAPA DOS RESULTADOS DE GD NA TELA AO VIVO — tema Brevant (05/out/2026).

   João, 05/out/2026: "coloque esse mapa no jarvis também … quando clica abre o resultado inteiro".
   E: "se filtrar algum filtro, dá um zoom no mapa relativo ao filtro e continua as bolinhas clicáveis".

   O desenho é o NÚCLEO (mapa-gd-nucleo.js, cópia byte a byte de lib/mapa-gd-nucleo.js); aqui só:
     - os DADOS: a tabela org_ensaios_mapa, lida com o login de quem abriu a tela (a RLS do banco só
       entrega a membro ativo da org Brevant e ao super admin). Nada disto mora no site. Na máquina
       (servindo a raiz do repositório) lê a cópia local supabase/temas-privados/brevant/mapa-resultados.json;
     - "MEUS ENSAIOS": o `dono` da carteira deste login (org_carteira_dados, a mesma regra do
       ensaios_brevant em whatsapp/consultas-ensaios-rede.ts) — sem dono, nenhuma área é "minha"
       (falha fechada) e as áreas de outro técnico SAEM do mapa;
     - a VOZ, resolvida aqui (sem servidor): "mostra o mapa dos resultados", "filtra Nova Ubiratã",
       "só os ensaios da Thamilly", "meus ensaios", "região de Sorriso", "MT3", "o B2701", "abre essa
       área", "abre a área de Nova Ubiratã", "próxima", "tira o filtro", "fecha o mapa". O Jarvis diz
       sempre de quem são as áreas: sem filtro, "rede Brevant (comercial)".
   A ponte com o motor passa pelo playbook.js (window.AO_VIVO_FRASE / CONTEXTO / TELA_TEMA chamam
   window.MapaGDJarvis primeiro). Portão: scripts/conferir-mapa-resultados.ts.
   --------------------------------------------------------------------------------------------- */
(function () {
  'use strict';
  const A = () => window.AO_VIVO || null;
  const N = () => window.MapaGD || null;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LOCAL = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && location.pathname.startsWith('/public/');
  // 05/out/2026, 20:36–20:45: a mesma fala longa de novo em menos de 5 min vira o resumo (o João ouviu a lista de regiões repetida)
  const faladasHaPouco = new Map();
  const falar = (t) => {
    const a = A(); if (!a || !t) return;
    const k = String(t).toLowerCase(), antes = faladasHaPouco.get(k);
    faladasHaPouco.set(k, Date.now());
    if (antes && Date.now() - antes < 5 * 60000 && String(t).length > 120 && N() && N().resumoDeRepeticao) t = N().resumoDeRepeticao(t);
    try { a.falar(t); } catch (e) { /* sem voz */ }
    try { window.dispatchEvent(new CustomEvent('aovivo-resposta-da-pagina', { detail: { resposta: String(t) } })); } catch (e) { /* registro é conforto */ }
  };
  const dec1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
  const mil = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const estilo = document.createElement('style');
  estilo.textContent = `
  #mgdj{position:fixed;inset:0;z-index:3;display:none;pointer-events:none;font-family:"Outfit",system-ui,sans-serif;color:#fbfbfc;
    --j-top:calc(14px + env(safe-area-inset-top) + 124px);--j-base:calc(150px + env(safe-area-inset-bottom));--j-lado:clamp(12px,2.4vw,52px)}
  #mgdj.on{display:block;pointer-events:auto}
  #mgdj::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 45%,rgba(60,6,22,.35),rgba(30,2,10,.82));pointer-events:none}
  #mgdj .j-cab{position:absolute;left:var(--j-lado);right:var(--j-lado);top:calc(var(--j-top) - 40px);display:flex;align-items:center;gap:12px;z-index:2}
  #mgdj .j-tag{font:900 13px/1 "Amboy","Anton","Outfit",sans-serif;letter-spacing:.06em;background:#f47c06;color:#3c0616;padding:.5em .7em .4em;border-radius:3px;white-space:nowrap}
  #mgdj .j-tit{font:400 clamp(18px,1.6vw,30px)/1 "Amboy","Anton","Outfit",sans-serif;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #mgdj .j-fechar{margin-left:auto;background:rgba(34,3,12,.55);border:1px solid rgba(245,136,7,.35);color:#f3e6ea;font:700 11px "Outfit",sans-serif;letter-spacing:.12em;padding:6px 12px;border-radius:999px;cursor:pointer}
  #mgdj .j-corpo{position:absolute;left:var(--j-lado);right:var(--j-lado);top:var(--j-top);bottom:var(--j-base);--mgd-k:1.06}
  #mgdj .j-msg{position:absolute;inset:0;display:grid;place-items:center;font:400 clamp(15px,1.2vw,22px)/1.4 "Outfit",sans-serif;color:#f3e6ea;text-align:center;padding:0 10%}
  /* 05/out/2026, noite — a CAIXA DO MOMENTO (João: "deve aparecer e sumir uma caixa grande, falando o número de vitórias e a
     diferença de sacos"): sobe com o trecho da fala que cita a cidade/área e sai quando ele passa para a próxima */
  #mgdj .j-caixa{position:absolute;right:calc(var(--j-lado) + 1.5vw);top:calc(var(--j-top) + 5vh);transform:translate(0,-14px) scale(.97);opacity:0;z-index:4;pointer-events:none;
    min-width:min(36vw,640px);max-width:min(44vw,820px);padding:clamp(16px,1.6vw,34px) clamp(22px,2.2vw,46px);border-radius:clamp(14px,1.2vw,26px);
    background:rgba(20,2,8,.86);border:2px solid rgba(245,136,7,.75);box-shadow:0 18px 60px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.06) inset;
    backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);text-align:center;transition:opacity .35s ease,transform .35s ease}
  #mgdj .j-caixa.on{opacity:1;transform:none}
  /* área com ficha aberta: a caixa vai para o canto de cima à esquerda, compacta (a ficha está à direita, a bolinha no meio) */
  #mgdj .j-caixa.area{right:auto;left:calc(var(--j-lado) + 1vw);transform:translate(0,-14px) scale(.97);min-width:0;max-width:min(32vw,560px);padding:clamp(12px,1.2vw,26px) clamp(16px,1.6vw,34px)}
  #mgdj .j-caixa.area.on{transform:none}
  #mgdj .j-caixa.area .c-num{font-size:min(4.4vw,8vh)}
  #mgdj .j-caixa .c-ord{font-family:"Outfit",sans-serif;font-weight:800;font-size:.5em;vertical-align:.8em;margin-left:.04em}
  #mgdj .j-caixa .c-tit{font:400 clamp(26px,2.6vw,58px)/1.05 "Amboy","Anton","Outfit",sans-serif;text-transform:uppercase;letter-spacing:.02em;color:#fff}
  #mgdj .j-caixa .c-sub0{margin-top:.3em;font:600 clamp(16px,1.25vw,28px)/1.2 "Outfit",sans-serif;color:#f3d9c4}
  #mgdj .j-caixa .c-num{margin-top:.12em;font:400 max(48px,min(7vw,12vh))/1 "Amboy","Anton","Outfit",sans-serif;color:#F58807;text-shadow:0 0 30px rgba(245,136,7,.35)}
  #mgdj .j-caixa .c-def{font:600 clamp(16px,1.2vw,26px)/1.2 "Outfit",sans-serif;color:#f3e6ea;opacity:.9}
  #mgdj .j-caixa .c-dif{margin-top:.25em;font:700 clamp(30px,3vw,66px)/1 "Outfit",sans-serif;color:#fff}
  @media (max-width:759px){#mgdj{--j-top:calc(10px + env(safe-area-inset-top) + 96px);--j-base:calc(120px + env(safe-area-inset-bottom))}#mgdj .j-corpo{--mgd-k:.9}}`;
  document.head.appendChild(estilo);
  const camada = document.createElement('div');
  camada.id = 'mgdj';
  camada.innerHTML = '<div class="j-cab"><span class="j-tag">ENSAIOS 26S</span><span class="j-tit">Mapa dos resultados de GD</span><button type="button" class="j-fechar">FECHAR</button></div><div class="j-corpo"></div><div class="j-caixa" aria-live="polite"></div>';
  const montarCamada = () => { if (!camada.isConnected) document.body.appendChild(camada); };
  $('.j-fechar', camada).onclick = () => fechar();
  addEventListener('keydown', (e) => { if (aberto && e.key === 'Escape') { if (ctl && ctl.aberta()) ctl.fecharFicha(); else fechar(); } });

  let dados = null, carregando = null, meuAutor = null, ctl = null, aberto = false;
  const nomeDono = () => (meuAutor && dados && dados.autores && dados.tecnicos ? dados.tecnicos[dados.autores[meuAutor]] || null : null);

  // ------------------------------------------------------------------------------------------ os dados (login + RLS)
  async function carregar() {
    if (dados) return dados;
    if (carregando) return carregando;
    carregando = (async () => {
      if (LOCAL) {
        try {
          const r = await fetch('/supabase/temas-privados/brevant/mapa-resultados.json', { cache: 'no-cache' });
          if (r.ok) {
            dados = await r.json();
            // só na máquina: ?autor=<dono> simula o login de quem tem carteira (para conferir "meus ensaios")
            const q = new URLSearchParams(location.search).get('autor');
            meuAutor = q && dados.autores && dados.autores[q] ? q : null;
            return dados;
          }
        } catch (e) { /* cai para o banco */ }
      }
      const s = A() && A().sessao;
      if (!s || !s.rest || /^__/.test(s.rest.anon)) return null;
      const t = await s.token();
      if (!t) return null;
      const h = { apikey: s.rest.anon, authorization: 'Bearer ' + t };
      try {
        const r = await fetch(s.rest.url + '/rest/v1/org_ensaios_mapa?select=dados&order=safra.desc&limit=1', { headers: h, cache: 'no-store' });
        if (!r.ok) return null;
        const l = await r.json();
        dados = (l && l[0] && l[0].dados && Array.isArray(l[0].dados.areas)) ? l[0].dados : null;
      } catch (e) { return null; }
      if (!dados) return null;
      // "meus ensaios": a carteira DESTE login (o super admin enxerga todas — por isso o filtro pelo próprio id)
      try {
        const uid = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub;
        if (/^[0-9a-f-]{36}$/.test(uid)) {
          const rc = await fetch(s.rest.url + '/rest/v1/org_carteira_dados?select=dono&dono_user_ids=cs.%7B' + uid + '%7D&limit=5', { headers: h, cache: 'no-store' });
          if (rc.ok) { const ds = [...new Set((await rc.json()).map((x) => x.dono).filter(Boolean))]; meuAutor = ds.length === 1 ? ds[0] : null; }
        }
      } catch (e) { meuAutor = null; }
      return dados;
    })();
    try { return await carregando; } finally { carregando = null; }
  }

  // ------------------------------------------------------------------------------------------ abrir / fechar
  function fecharVizinhos() {
    const pb = window.PlaybookBrevant; if (pb && pb.estado && pb.estado.vista) try { pb.fechar(true); } catch (e) { /* */ }
    const cv = window.CarteiraBrevant; if (cv) try { cv.fechar(true); } catch (e) { /* */ }
    const a = A(); if (a) try { a.fecharJanelas(); } catch (e) { /* */ }
  }
  async function abrir(filtro, geo, frase, calado) {
    montarCamada(); fecharVizinhos();
    camada.classList.add('on'); aberto = true;
    // a esfera encolhe no canto (como no playbook) e as bolinhas dela correm para o mapa
    document.body.classList.add('pb-aberto', 'mgd-aberto');
    const corpo = $('.j-corpo', camada);
    if (!ctl) corpo.innerHTML = '<div class="j-msg">Carregando o mapa…</div>';
    const d = await carregar();
    if (!aberto) return;
    if (!d || !N()) {
      corpo.innerHTML = '<div class="j-msg">O mapa dos resultados não está disponível para esta conta.</div>';
      falar('O mapa dos resultados não está disponível para esta conta.');
      return;
    }
    if (frase && !filtro) { const de = N().interpretarFala(d, frase, { aberto: false, meuAutor }); if (de && de.acao === 'abrir' && de.filtro) { filtro = de.filtro; geo = de.geo; } }
    if (!ctl) {
      ctl = N().montar(corpo, d, { meuAutor, nomeDono: nomeDono(), representante: true, aoAbrir: formarParticulas });
      setTimeout(() => formarParticulas(null), 900);
    }
    if (calado) return;
    if (filtro) { const n = ctl.filtrar(filtro, geo); falar(fraseDoFiltro(n)); }
    else falar(`Mapa dos resultados de GD, ${N().ROTULO_REDE}: ${mil(d.areas.length)} lavouras no mapa. Toque numa bolinha para abrir o resultado, ou peça uma cidade, uma região ou um representante.`);
  }
  function formarParticulas(area) {
    const a = A(); if (!a || !aberto) return;
    const alvos = [$('.mgd-palco', camada), area ? $('.mgd-ficha', camada) : null].filter(Boolean);
    try { a.formar(alvos); } catch (e) { /* sem esfera */ }
  }
  function fechar(calado) {
    if (!aberto) return false;
    planoCaixa = []; caixaAtual = null; esconderCaixa();
    aberto = false; camada.classList.remove('on');
    document.body.classList.remove('mgd-aberto');
    const pb = window.PlaybookBrevant;
    if (!(pb && pb.estado && pb.estado.vista) && !document.body.classList.contains('cv-aberto')) document.body.classList.remove('pb-aberto');
    { const a = A(); if (a) try { a.formar([]); } catch (e) { /* */ } }
    if (ctl) { ctl.destruir(); ctl = null; }
    if (!calado) { const a = A(); if (a) try { a.legendaSome(); } catch (e) { /* */ } }
    return true;
  }
  function descricaoDoFiltro(f) {
    const d = dados || {}, p = [];
    if (f.cid) { const a = (d.areas || []).find((x) => N().norm(x.mun) + '|' + x.uf === f.cid); if (a) p.push(a.mun); }
    if (f.cids && f.cids.length) p.push(N().ondeFalado(d, { cids: f.cids }).replace(/^em /, ''));
    if (f.mic) p.push('microrregião ' + String(f.mic).replace(/\s*\([A-Z]{2}\)$/, ''));
    if (f.reg && d.regioes) p.push(d.regioes[f.reg]);
    if (f.hib) p.push(f.hib);
    if (f.con) p.push('× ' + f.con);
    if (f.ep && d.epocas) p.push('plantio ' + d.epocas[f.ep]);
    return p.join(', ');
  }
  function fraseDoFiltro(n) {
    const e = ctl.estado();
    const onde = descricaoDoFiltro(e.filtro);
    if (!n) return `Nenhuma área com esse filtro${onde ? ' (' + onde + ')' : ''}.`;
    return `${onde ? onde + ': ' : ''}${mil(n)} ${n === 1 ? 'área' : 'áreas'}, ${e.rotulo}. Toque numa bolinha ou diga "abre essa área".`;
  }
  function fraseDaArea(a) {
    if (!a) return 'Nenhuma área para abrir aqui.';
    const m = N().mediaDoEnsaio(a);
    const n = (a.h || []).length;
    const est = ctl.estado();
    const mais = est.areasNoFiltro > 1 && Object.keys(est.filtro).some((k) => est.filtro[k]) ? ` São ${mil(est.areasNoFiltro)} áreas no filtro: diga "próxima" para a seguinte.` : '';
    return `${a.mun}, plantio ${a.pl.replace('/', ' de ').replace(/ de (\w+)$/, (x, mes) => ' de ' + ({ jan: 'janeiro', fev: 'fevereiro', mar: 'março', abr: 'abril', dez: 'dezembro', nov: 'novembro' }[mes] || mes))}: ${n} híbridos, média do ensaio ${dec1(m)} sacas por hectare.${mais}`;
  }

  // ------------------------------------------------------------------------------------------ a CAIXA DO MOMENTO
  // O plano (montado com os MESMOS números da fala pronta, do núcleo) diz qual caixa sobe quando a voz chega em cada
  // cidade/área: a cada 150 ms lemos a frase que está tocando (AO_VIVO.pedacoFalado) e casamos pelo nome.
  let planoCaixa = [], caixaAtual = null, caladoDesde = 0;
  const nCx = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const nomeCurto = (nome) => String(nome || '').replace(/^demais cidades da microrregi[aã]o de /i, '').replace(/^microrregi[aã]o de /i, '');
  function planejarCaixas(itens) { planoCaixa = (itens || []).filter((x) => x && x.chave); caixaAtual = null; esconderCaixa(); }
  function mostrarCaixa(it) {
    const el = $('.j-caixa', camada); if (!el) return;
    el.classList.toggle('area', !!it.area);
    el.innerHTML = `<div class="c-tit">${esc(it.titulo)}</div>${it.sub0 ? `<div class="c-sub0">${esc(it.sub0)}</div>` : ''}` +
      `<div class="c-num">${esc(it.numero).replace(/º/g, '<span class="c-ord">º</span>')}</div>${it.def ? `<div class="c-def">${esc(it.def)}</div>` : ''}${it.dif ? `<div class="c-dif">${esc(it.dif)}</div>` : ''}`;
    el.classList.add('on');
    if (it.ids && it.ids.length && ctl && ctl.focar) try { ctl.focar(it.ids); } catch (e) { /* */ }
  }
  function esconderCaixa() { const el = $('.j-caixa', camada); if (el) el.classList.remove('on'); }
  setInterval(() => {
    if (!aberto || !planoCaixa.length) return;
    const a = A(); const p = nCx(typeof window.__pedacoTeste === 'string' ? window.__pedacoTeste : (a && a.pedacoFalado ? a.pedacoFalado() : ''));   // __pedacoTeste: só o teste sem som
    if (!p) { if (caixaAtual && Date.now() - caladoDesde > 1200) { caixaAtual = null; esconderCaixa(); } if (!caladoDesde) caladoDesde = Date.now(); return; }
    caladoDesde = 0;
    const it = planoCaixa.find((x) => p.includes(x.chave));
    if (it && it !== caixaAtual) { caixaAtual = it; mostrarCaixa(it); }
  }, 150);
  const scTxt = (v) => `${v >= 0 ? '+' : '−'}${dec1(Math.abs(v))} sc/ha`;
  const caixasDosLugares = (gs) => gs.slice(0, 6).map((g) => ({ chave: nCx(nomeCurto(g.nome)), titulo: nomeCurto(g.nome), sub0: g.nivel === 'município' ? '' : (/^demais/.test(g.nome) ? 'demais cidades da microrregião' : 'microrregião'),
    numero: `${g.frente} de ${g.lavouras}`, def: 'lavouras à frente da média dos concorrentes', dif: scTxt(g.vantagem_sc_ha), ids: g.ids }));
  const caixaDaArea = (a, extra) => {
    const pos = N().ranking(a.a || a).find((x) => x.hib === extra.hib);
    const area = a.a || a;
    return { area: true, chave: nCx(area.mun), titulo: area.mun, sub0: `plantio ${String(area.pl || '').replace('/', ' de ')}`, numero: pos ? `${pos.pos}º de ${area.h.length}` : '—',
      def: extra.vant > 0 ? `${dec1(extra.sc)} sc/ha · à frente da média dos concorrentes por` : `${dec1(extra.sc)} sc/ha`, dif: extra.vant > 0 ? scTxt(extra.vant) : '', ids: [area.id] };
  };

  // ------------------------------------------------------------------------------------------ a fala
  // ------------------------------------------------------------------------------------------ o HÍBRIDO no mapa
  // (vídeo do B2815, 05/out/2026): "quantas áreas o B2815 ganhou?", "me mostra os resultados mais interessantes
  // sobre ele", "onde ele realmente se destacou?" / "quais as melhores regiões dele?", "mostra no mapa". As contas
  // e as réguas (escritas antes de olhar) são do núcleo — placarDoHibrido, topDoHibrido, melhoresLugares —, as
  // mesmas do ensaios_brevant; o Jarvis diz a frase pronta, sempre com a definição de "à frente".
  // O assunto da conversa (o híbrido e o recorte) vem da última resposta do agente (lembrar) ou do playbook aberto.
  const PORTFOLIO = ['B2701PWU', 'B2702VYHR', 'B2703PWU', 'B2815PWU', 'B2884PWU', 'B2900PWU'];
  let assunto = { hib: null, geo: null, t: 0 };
  const codigoDe = (v) => { const m = /(\d{4})/.exec(String(v || '')); return m ? PORTFOLIO.find((h) => h.startsWith('B' + m[1])) || null : null; };
  function lembrar(t) {
    try {
      if (!t || !t.ferramenta) return;
      const a = t.argumentos || {}, r = t.resultado || {};
      if (t.ferramenta === 'ensaios_brevant') {
        const h = codigoDe(a.hibrido) || codigoDe(r.hibrido_em_foco && r.hibrido_em_foco.hibrido) || codigoDe(r.argumento && r.argumento.hibrido);
        const geo = N() && dados ? N().recorteDoTexto(dados, r.recorte || [a.cidade, a.regiao_de && 'região de ' + a.regiao_de, a.micro_regiao, a.recorte].filter(Boolean).join(' ')) : null;
        assunto = { hib: h || assunto.hib, geo: geo || null, recorteTexto: r.recorte || '', t: Date.now() };
      } else if (t.ferramenta === 'playbook_brevant') {
        const h = codigoDe(a.hibrido); if (h) assunto = { hib: h, geo: assunto.geo, t: Date.now() };
      }
    } catch (e) { /* o assunto é só conveniência */ }
  }
  function hibDoAssunto() {
    const pb = window.PlaybookBrevant;
    return assunto.hib || (pb && pb.estado && pb.estado.cod ? codigoDe(pb.estado.cod) : null);
  }
  const ONDE = { MT1: 'no leste de Mato Grosso (MT1)', MT2: 'no Médio-Norte', MT3: 'no Parecis', SUL: 'no sul (MS, RO e GO)' };
  function ondeFalado(geo) {
    if (!geo) return 'em toda a rede';
    if (geo.cids && N()) return N().ondeFalado(dados, geo);
    if (geo.reg) return ONDE[geo.reg] || geo.reg;
    if (geo.mic) return 'na microrregião ' + String(geo.mic).replace(/\s*\([A-Z]{2}\)$/, '');
    if (geo.cid) { const a = (dados.areas || []).find((x) => N().norm(x.mun) + '|' + x.uf === geo.cid); return 'em ' + (a ? a.mun : 'na cidade'); }
    return '';
  }
  const curto = (h) => h.replace(/(PWU|VYHR|PRO\d|VIP\d)$/, '');
  const scFalado = (v) => `${dec1(Math.abs(v))} ${Math.abs(v) >= 1.95 ? 'sacas' : 'saca'}`;
  const MESES = { jan: 'janeiro', fev: 'fevereiro', mar: 'março', abr: 'abril', mai: 'maio', jun: 'junho', jul: 'julho', ago: 'agosto', set: 'setembro', out: 'outubro', nov: 'novembro', dez: 'dezembro' };
  const dataFalada = (pl) => { const [d, m] = String(pl || '').split('/'); return d ? `${+d} de ${MESES[m] || m}` : ''; };
  function seloPlacar(p, geo) {
    return `<span class="mgd-tag">${esc(p.hibrido)} · ${esc(ondeFalado(geo).replace(/^(no|na|em) /, ''))}</span>` +
      `<div class="mgd-big"><b>${p.frente}</b> de ${p.lavouras} lavouras</div><div class="mgd-def">à frente da média dos concorrentes da mesma lavoura</div>` +
      `<div class="mgd-big"><b class="cinza">${p.primeiro}</b> de ${p.lavouras}</div><div class="mgd-def">em 1º lugar na lavoura (maior sc/ha entre todos os híbridos)</div>` +
      `<div class="mgd-legenda"><span><i style="background:#F58807"></i>à frente da média</span><span><i style="background:rgba(230,232,234,.55)"></i>as outras lavouras dele</span></div>`;
  }
  function mostrarPlacar(hib, geo, falarJunto) {
    const nuc = N(), p = nuc.placarDoHibrido(dados, hib, geo || {});
    if (!p.lavouras) { falar(`Não há lavoura do ${curto(hib)} com concorrente ao lado ${ondeFalado(geo)}.`); return; }
    ctl.destacar({ filtro: Object.assign({}, geo || {}, { hib }), frente: p.ids_frente, outras: p.ids_outras, selo: seloPlacar(p, geo), zoom: p.ids_frente.concat(p.ids_outras) });
    // várias cidades: uma caixa do momento por cidade (os mesmos números da fala, do núcleo)
    const cs = nuc.porCidade ? nuc.porCidade(dados, hib, geo) : null;
    if (cs) planejarCaixas(cs.filter((c) => c.lavouras).map((c) => ({ chave: nCx(c.mun), titulo: c.mun, numero: `${c.frente} de ${c.lavouras}`, def: 'lavouras à frente da média dos concorrentes', dif: c.vantagem_sc_ha > 0 ? scTxt(c.vantagem_sc_ha) : '', ids: c.ids })));
    if (falarJunto !== false) falar(nuc.fraseDoPlacar ? nuc.fraseDoPlacar(dados, hib, geo) : `${ondeFalado(geo).replace(/^./, (c) => c.toUpperCase())}, o ${curto(hib)} ficou à frente da média dos concorrentes em ${p.frente} de ${p.lavouras} lavouras.`);
  }
  // 05/out/2026: as frases saem do NÚCLEO (fraseDosLugares, fraseDoDestaque, fraseDaAreaDoHibrido) — a página e o servidor
  // (mapa_resultados_brevant, atalho e6) dizem a MESMA coisa. `calado` = quem fala é o agente (comando que veio do servidor).
  function mostrarLugares(hib, geo, calado) {
    const nuc = N(), gs = nuc.melhoresLugares(dados, hib, geo || {}), p = nuc.placarDoHibrido(dados, hib, geo || {});
    if (!gs.length) { mostrarPlacar(hib, geo, false); if (!calado) falar(nuc.fraseDosLugares(dados, hib, geo, gs)); return; }
    const ids = {}; gs.forEach((g) => g.ids.forEach((i) => { ids[i] = 1; }));
    const muns = [].concat(...gs.map((g) => g.cidades));
    const chips = gs.map((g) => `<div class="mgd-chip">${esc(g.nome.replace(/^microrregião de /, 'micro. ').replace(/^demais cidades da microrregião de /, 'demais de '))}<span>${g.frente} de ${g.lavouras} · +${dec1(g.vantagem_sc_ha)} sc/ha</span></div>`).join('');
    const selo = `<span class="mgd-tag">${esc(hib)} · onde se destacou</span><h4>${esc(ondeFalado(geo).replace(/^(no|na|em) /, ''))}</h4>` +
      `<div class="mgd-def">X de Y = lavouras à frente da média dos concorrentes · sc/ha = vantagem média sobre eles · régua: 5+ lavouras e 75 %+ à frente</div><div class="mgd-chips">${chips}</div>`;
    ctl.destacar({ filtro: Object.assign({}, geo || {}, { hib }), frente: Object.keys(ids), outras: p.ids_frente.concat(p.ids_outras).filter((i) => !ids[i]), muns, selo, zoom: p.ids_frente.concat(p.ids_outras) });
    planejarCaixas(caixasDosLugares(gs));
    // 3 a 6 lugares, cada um com o X de Y E as sacas a mais (João: "todo lugar citado precisa ter o sc/ha")
    if (!calado) falar(nuc.fraseDosLugares(dados, hib, geo, gs));
  }
  function mostrarTop(hib, geo, calado) {
    const nuc = N(), top = nuc.topDoHibrido(dados, hib, geo || {}, 3), p = nuc.placarDoHibrido(dados, hib, geo || {});
    if (!top.length) { mostrarPlacar(hib, geo, false); if (!calado) falar(`${ondeFalado(geo).replace(/^./, (c) => c.toUpperCase())}, nenhuma lavoura do ${curto(hib)} passa na régua dos destaques: quatro concorrentes ou mais, sem faixa fora da faixa, à frente da média deles.`); return; }
    ctl.destacar({ filtro: Object.assign({}, geo || {}, { hib }), frente: top.map((x) => x.id), outras: p.ids_frente.concat(p.ids_outras).filter((i) => !top.some((x) => x.id === i)), selo: '', zoom: top.map((x) => x.id) });
    { const porId = {}; (dados.areas || []).forEach((x) => { porId[x.id] = x; }); planejarCaixas(top.map((t) => porId[t.id] && caixaDaArea(porId[t.id], { hib, sc: t.sc, vant: t.vant }))); }
    ctl.passear(top.map((x) => x.id), {
      ms: 7000, ocupado: () => { const a = A(); return !!(a && a.falando && a.falando()); },
      aoPasso: (i, a, n) => { if (!calado) falar(nuc.fraseDoDestaque(dados, hib, top[i], a, i, n, geo)); },
    });
  }
  /** O híbrido CONTRA um concorrente (05/out/2026, 18:55): as lavouras em que os dois estiveram — à frente em laranja. */
  function mostrarVersus(hib, con, geo, calado) {
    const nuc = N(), v = nuc.versusDoHibrido(dados, hib, con, geo || {});
    const selo = v.lavouras ? `<span class="mgd-tag">${esc(hib)} × ${esc(con)}</span>` +
      `<div class="mgd-big"><b>${v.frente}</b> de ${v.lavouras} lavouras</div><div class="mgd-def">à frente do ${esc(con)} na mesma lavoura · ${v.dif_media_sc_ha >= 0 ? '+' : ''}${dec1(v.dif_media_sc_ha)} sc/ha na média</div>` +
      `<div class="mgd-legenda"><span><i style="background:#F58807"></i>à frente do ${esc(con)}</span><span><i style="background:rgba(230,232,234,.55)"></i>atrás dele</span></div>` : '';
    ctl.destacar({ filtro: Object.assign({}, geo || {}, { hib, con }), frente: v.ids_frente, outras: v.ids_outras, selo, zoom: v.ids_frente.concat(v.ids_outras) });
    // o código do concorrente é falado por extenso (pronúncia do tema): a caixa entra no "lado a lado" da fala
    planejarCaixas(v.lavouras ? [{ chave: 'lado a lado', titulo: `${curto(hib)} × ${con}`, numero: `${v.frente} de ${v.lavouras}`, def: `lavouras à frente do ${con}`, dif: v.dif_media_sc_ha > 0 ? scTxt(v.dif_media_sc_ha) : '', ids: v.ids_frente }] : []);
    if (!calado) falar(nuc.fraseDoVersus(dados, hib, geo, v));
  }
  /** UMA área (por critério/ordem — areaPor do núcleo): voa até ela, realça e abre a ficha. */
  function mostrarArea(hib, geo, id) {
    const nuc = N(), p = nuc.placarDoHibrido(dados, hib, geo || {});
    if (!id) { mostrarPlacar(hib, geo, false); return; }
    { const area = (dados.areas || []).find((x) => x.id === id); const eu = area && area.h.find((x) => x[0] === hib);
      if (area && eu) { const conc = area.h.filter((x) => !x[1]).map((x) => x[2]); const mc = conc.length ? conc.reduce((s, v) => s + v, 0) / conc.length : eu[2];
        const it = caixaDaArea(area, { hib, sc: eu[2], vant: Math.round((eu[2] - mc) * 10) / 10 }); planejarCaixas([it]); } }
    ctl.destacar({ filtro: Object.assign({}, geo || {}, { hib }), frente: [id], outras: p.ids_frente.concat(p.ids_outras).filter((i) => i !== id), selo: '', zoom: [id] });
    ctl.passear([id], { ms: 600000 });                 // um passo só: a ficha fica aberta até a próxima ordem
  }
  async function hibridoNoMapa(ac, texto) {
    if (!aberto || !ctl) await abrir(null, false, null, true);
    if (!ctl || !dados) return;
    // a fala de novo, agora com a base inteira (cidade e microrregião só se resolvem com ela)
    const geoAssunto = assunto.geo || (assunto.recorteTexto ? N().recorteDoTexto(dados, assunto.recorteTexto) : null);
    const fA = ctl ? (ctl.estado().filtro || {}) : {};
    const de = N().interpretarFala(dados, texto, { aberto: true, meuAutor, hibContexto: fA.hib || hibDoAssunto(), recorteContexto: geoDoFiltro() || geoAssunto });
    const hib = (de && de.hib) || ac.hib, geo = (de && de.geo) || ac.geo || null;
    if (!hib) { abrir(geo, true); return; }
    if (ac.acao === 'lugares') mostrarLugares(hib, geo);
    else if (ac.acao === 'top') mostrarTop(hib, geo);
    else if (ac.acao === 'versus') mostrarVersus(hib, (de && de.con) || ac.con, geo);
    else if (ac.acao === 'area_por') {
      const r = N().areaPor(dados, hib, geo || {}, (de && de.criterio) || ac.criterio, (de && de.ordem) || ac.ordem);
      mostrarArea(hib, geo, r.area && r.area.id);
      falar(N().fraseDaAreaDoHibrido(dados, hib, r, geo));
    } else mostrarPlacar(hib, geo);
  }
  /** O filtro geográfico da tela (cidade, micro ou região) — "dessas áreas" é ele. */
  function geoDoFiltro() {
    if (!ctl) return null;
    const f = ctl.estado().filtro || {};
    return f.cid ? { cid: f.cid } : (f.cids && f.cids.length) ? { cids: f.cids } : f.mic ? { mic: f.mic } : f.reg ? { reg: f.reg } : null;
  }
  /** O COMANDO que veio do servidor (mapa_resultados_brevant: atalho e6 ou o agente). Quem fala é o agente (calado),
   *  menos a próxima/anterior — só a página sabe qual ficha está aberta. */
  async function executar(c) {
    if (!c || !c.acao) return false;
    if (!aberto || !ctl) await abrir(null, false, null, true);
    if (!ctl || !dados) return false;
    switch (c.acao) {
      case 'lugares': if (c.hib) mostrarLugares(c.hib, c.geo || null, true); break;
      case 'top': if (c.hib) mostrarTop(c.hib, c.geo || null, true); break;
      case 'placar': case 'no_mapa': if (c.hib) mostrarPlacar(c.hib, c.geo || null, false); break;
      case 'versus': if (c.hib && c.con) mostrarVersus(c.hib, c.con, c.geo || null, true); break;
      case 'area': if (c.hib) mostrarArea(c.hib, c.geo || null, c.id); break;
      case 'proxima': if (ctl.emPasseio()) ctl.proxima(); else falar(fraseDaArea(ctl.proxima())); break;
      case 'anterior': if (ctl.emPasseio()) ctl.anterior(); else falar(fraseDaArea(ctl.anterior())); break;
      case 'limpar': ctl.limpar(); break;
      case 'fechar': fechar(true); break;
      case 'fechar_ficha': ctl.fecharFicha(); break;
      default: if (c.filtro) ctl.filtrar(c.filtro, !!c.geo); break;
    }
    return true;
  }

  // 05/out/2026, 22:30: "me traga ESSES resultados no mapa" — a cidade (e o híbrido) da fala anterior que tinha lugar
  let lugarFalado = null;
  function frase(texto) {
    const nucleo = N(); if (!nucleo) return false;
    if (dados) { try { const tN = nucleo.norm(texto); const g = nucleo.recorteDoTexto(dados, tN.replace(/\b(b ?\d{4}\w*)\b/g, ' ')); const h = nucleo.hibridoDoTexto(dados, tN.replace(/\b(b ?\d{4})[a-z0-9]*/g, '$1'));
      if (g || h) lugarFalado = { geo: g || (lugarFalado && lugarFalado.geo) || null, hib: h || (lugarFalado && lugarFalado.hib) || null, t: Date.now() }; } catch (e) { /* conveniência */ } }
    const lugarRecente = lugarFalado && Date.now() - lugarFalado.t < 15 * 60000 ? lugarFalado : null;
    // 05/out/2026: com o mapa aberto, "dessas áreas" é o filtro da tela e "ele" é o híbrido do filtro
    const filtroAberto = aberto && ctl ? (ctl.estado().filtro || {}) : {};
    const ac = nucleo.interpretarFala(dados || { areas: [], portfolio: PORTFOLIO }, texto, { aberto: aberto && !!ctl, ficha: !!(ctl && ctl.aberta()), meuAutor,
      hibContexto: filtroAberto.hib || hibDoAssunto() || (lugarRecente && lugarRecente.hib), recorteContexto: (aberto && geoDoFiltro()) || assunto.geo || (lugarRecente && lugarRecente.geo), passeio: !!(ctl && ctl.emPasseio()) });
    if (!ac) return false;
    switch (ac.acao) {
      case 'placar': case 'top': case 'lugares': case 'no_mapa': case 'area_por': case 'versus': hibridoNoMapa(ac, texto); return true;
      case 'qual_hibrido': falar('De qual híbrido? Por exemplo: quantas áreas o B2815 ganhou no Médio-Norte?'); return true;
      case 'pausa': ctl.segurar(); return true;
      case 'abrir': abrir(ac.filtro, ac.geo, texto); return true;
      case 'fechar': fechar(); return true;
      case 'fechar_ficha': ctl.fecharFicha(); return true;
      case 'limpar': ctl.limpar(); falar(`Mapa do estado inteiro, ${nucleo.ROTULO_REDE}.`); return true;
      case 'sem_meus': falar('Não há áreas de ensaio lançadas em seu nome nesta conta. Posso mostrar a rede Brevant (comercial).'); return true;
      case 'ambiguo': falar('Tem mais de um técnico com esse nome. Diga o nome e o sobrenome.'); return true;
      case 'filtro': { const n = ctl.filtrar(ac.filtro, ac.geo); falar(fraseDoFiltro(n)); return true; }
      case 'area': {
        if (ctl.emPasseio()) { ctl.segurar(); return true; }      // "abre essa" no passeio: a ficha fica aberta, o passeio para
        let a = null;
        if (ac.filtro) { ctl.filtrar(ac.filtro, ac.geo); a = ctl.abrirPrimeira(); }
        else a = ctl.aberta() || ctl.abrirPrimeira();
        falar(fraseDaArea(a)); return true;
      }
      // no passeio dos destaques quem fala é o próprio passo (a frase do destaque); fora dele, a ficha
      case 'proxima': if (ctl.emPasseio()) ctl.proxima(); else falar(fraseDaArea(ctl.proxima())); return true;
      case 'anterior': if (ctl.emPasseio()) ctl.anterior(); else falar(fraseDaArea(ctl.anterior())); return true;
      default: return false;
    }
  }
  function contexto() {
    if (!aberto || !ctl) return '';
    const e = ctl.estado(), onde = descricaoDoFiltro(e.filtro);
    return `mapa dos resultados de GD (${e.rotulo}${onde ? '; filtro: ' + onde : ''}${e.aberta ? '; aberta a ficha de uma área' : ''})`;
  }

  window.MapaGDJarvis = { frase, contexto, fechar, lembrar, executar, abrir: (f, calado) => abrir(f || null, !!f, null, !!calado), get aberto() { return aberto; }, get controle() { return ctl; } };
  // a camada nasce já no DOM (escondida): o portão de voz e a auditoria enxergam
  if (document.body) montarCamada(); else document.addEventListener('DOMContentLoaded', montarCamada);
})();
