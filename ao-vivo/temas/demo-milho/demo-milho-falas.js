/* =============================================================================================
   DEMONSTRAÇÃO DO JARVIS PARA REPRESENTANTES — AS FALAS (06/out/2026). Função PURA: sem DOM, sem rede.

   João, 05/out/2026, meia-noite (rodada de negociação com representantes): "monte uma apresentação pro Jarvis
   fictícia como se fosse MILHO: análise de carteira, resultados no mapa igual já temos … o que dá pra fazer que
   fique robusto e sem erros? … usar o que já tem".

   Aqui só se decide, a partir da FALA, o que a tela faz e o que o Jarvis diz — sempre a MESMA resposta para a
   mesma fala e o mesmo estado (o portão scripts/conferir-demo-milho.ts roda o roteiro inteiro e compara com
   roteiro-demo.json, palavra por palavra). Os números do mapa saem do NÚCLEO do mapa de GD (mapa-gd-nucleo.js,
   cópia byte a byte de lib/) — as mesmas réguas e frases do Jarvis de verdade; os da carteira saem da carga
   fictícia (dados-demo.json, gerada por scripts/demo-milho/gerar-demo-milho.py). Tudo FICTÍCIO.

   Pergunta de verdade ("por que…", "compara…", "explica…") NÃO é daqui: devolve null e vai ao agente (servidor,
   persona demo-milho, presa à ficha da demonstração).
   ============================================================================================= */
(function (raiz, fabrica) {
  var M = fabrica();
  if (typeof module === 'object' && module && module.exports) module.exports = M;
  if (raiz) raiz.DemoMilhoFalas = M;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  var norm = function (s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]+/g, ' ').trim(); };
  var mil = function (n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var pct = function (v) { return String(Math.round(Math.abs(v) * 100)) + '%'; };

  // ------------------------------------------------------------------------------------------ o HÍBRIDO da fala
  // O reconhecimento de voz entrega "OSC 2815", "osc 28 15", "o s c 2815", "2815" ou por extenso. Só os 4 do
  // portfólio fictício; nenhum outro código vira híbrido.
  var POR_EXTENSO = {
    2815: ['vinte e oito quinze', 'dois mil oitocentos e quinze', 'vinte oito quinze'],
    2701: ['vinte e sete zero um', 'dois mil setecentos e um', 'vinte e sete um'],
    2640: ['vinte e seis quarenta', 'dois mil seiscentos e quarenta', 'vinte e meia quarenta'],
    2990: ['vinte e nove noventa', 'dois mil novecentos e noventa'],
  };
  function hibridoDaFala(portfolio, texto) {
    var t = ' ' + norm(texto).replace(/\b(\d{2}) (\d{2})\b/g, '$1$2') + ' ';
    var achado = null;
    (portfolio || []).forEach(function (h) {
      if (achado) return;
      var dig = String(h).replace(/\D/g, '');
      if (t.indexOf(' ' + dig + ' ') >= 0) { achado = h; return; }
      if ((POR_EXTENSO[dig] || []).some(function (x) { return t.indexOf(' ' + x + ' ') >= 0; })) achado = h;
    });
    return achado;
  }
  var semHibrido = function (t) { return norm(t).replace(/\b(o ?s ?c ?)?\d{2} ?\d{2}\b/g, ' ').replace(/\s+/g, ' ').trim(); };

  // ------------------------------------------------------------------------------------------ a CARTEIRA (fictícia)
  function totais(C) {
    var r = C.revendas || [];
    var soma = function (k) { return r.reduce(function (s, x) { return s + (+x[k] || 0); }, 0); };
    var cancel = (C.cancelamentos || []).reduce(function (s, x) { return s + (+x.sc || 0); }, 0);
    var t = { sc26: soma('sc26'), sc27: soma('sc27'), prospeccao: soma('prospeccao'), pedido: soma('pedido_sistema'), faturado: soma('faturado'), cancelado: cancel };
    t.a_faturar = t.pedido - t.faturado; t.vendido = t.sc27; t.saldo = t.pedido - t.vendido; t.potencial = t.sc27 + t.prospeccao;
    return t;
  }
  function motivos(C) {
    var m = {};
    (C.cancelamentos || []).forEach(function (x) { m[x.motivo] = (m[x.motivo] || 0) + (+x.sc || 0); });
    return Object.keys(m).map(function (k) { return { motivo: k, sc: m[k] }; }).sort(function (a, b) { return b.sc - a.sc || (a.motivo < b.motivo ? -1 : 1); });
  }
  var porRevenda = function (C, f) { return (C.revendas || []).slice().sort(function (a, b) { return f(b) - f(a) || (a.nome < b.nome ? -1 : 1); }); };
  /** As 4 telas da carteira (os números e a frase que o Jarvis diz em cada uma). Pura. */
  function telasDaCarteira(C) {
    var T = totais(C), cres = T.sc27 / T.sc26 - 1;
    var cresceu = porRevenda(C, function (x) { return x.sc27 - x.sc26; });
    var top = cresceu[0], caiu = cresceu.filter(function (x) { return x.sc27 < x.sc26; });
    var mot = motivos(C), negociado = T.sc27 + T.cancelado;
    var prosp = porRevenda(C, function (x) { return x.prospeccao; })[0];
    var cresPot = T.potencial / T.sc26 - 1;
    return [
      // 06/out/2026 (madrugada, bateria de conversa — João: "conversar como se tivesse falando com minha esposa"): as falas
      // das 4 telas no jeito de quem conversa ("pra 27 você já fechou…"), com os MESMOS números da tela.
      { id: 'carteira', nav: 'CARTEIRA', tag: 'Carteira de milho · 26 × 27', titulo: 'Como está a sua carteira',
        fala: 'Na safra 26 você vendeu ' + mil(T.sc26) + ' sacos, e pra 27 já fechou ' + mil(T.sc27) + ' — ' + pct(cres) + (cres >= 0 ? ' a mais' : ' a menos') + '. ' +
          'Quem mais puxou foi a ' + top.nome + ', com ' + mil(top.sc27 - top.sc26) + ' sacos a mais' +
          (caiu.length ? '; ' + (caiu.length === 1 ? 'só a ' + caiu[0].nome + ' caiu, ' + mil(caiu[0].sc26 - caiu[0].sc27) + ' sacos' : caiu.length + ' revendas caíram') : '') + '.',
        numeros: { sc26: T.sc26, sc27: T.sc27, crescimento: cres } },
      { id: 'cancelamento', nav: 'FECHADO × CANCELADO', tag: 'Safra 27 · fechado e cancelado', titulo: 'Quanto fechou e quanto caiu',
        fala: 'Pra 27 você fechou ' + mil(T.sc27) + ' sacos e perdeu ' + mil(T.cancelado) + ' em cancelamento, uns ' + pct(T.cancelado / negociado) + ' do que foi negociado. ' +
          'O que mais pesou foi ' + mot[0].motivo + ': ' + mil(mot[0].sc) + ' sacos.',
        numeros: { fechado: T.sc27, cancelado: T.cancelado, negociado: negociado, motivos: mot } },
      { id: 'prospeccao', nav: 'PROSPECÇÃO', tag: 'Safra 27 · prospecção (BEST)', titulo: 'A oportunidade se a prospecção se confirmar',
        fala: 'Se a prospecção se confirmar, entram mais ' + mil(T.prospeccao) + ' sacos e a carteira vai a ' + mil(T.potencial) + ' — ' + pct(cresPot) + (cresPot >= 0 ? ' acima' : ' abaixo') + ' da safra 26. ' +
          'A maior oportunidade está na ' + prosp.nome + ', com ' + mil(prosp.prospeccao) + ' sacos.',
        numeros: { fechado: T.sc27, prospeccao: T.prospeccao, potencial: T.potencial, crescimento: cresPot } },
      { id: 'faturamento', nav: 'FATURAMENTO', tag: 'Safra 27 · faturamento', titulo: 'Pedido, faturado e saldo',
        fala: 'Da 27, você tem ' + mil(T.pedido) + ' sacos em pedido no sistema: ' + mil(T.faturado) + ' já faturados e ' + mil(T.a_faturar) + ' a faturar. ' +
          (T.saldo >= 0 ? 'Como vendeu ' + mil(T.vendido) + ', sobram ' + mil(T.saldo) + ' sacos ainda sem cliente.' : 'Você vendeu ' + mil(T.vendido) + ' — faltam ' + mil(-T.saldo) + ' sacos de semente pro que já foi vendido.'),
        numeros: { pedido: T.pedido, faturado: T.faturado, a_faturar: T.a_faturar, vendido: T.vendido, saldo: T.saldo } },
    ];
  }

  // ------------------------------------------------------------------------------------------ a FALA → a ação
  // pergunta de verdade é do agente (servidor), nunca resposta pronta
  var PERGUNTA = /\b(por que|porque|pq|por qual motivo|explica\w*|justifi\w*|compar\w*|diferenca entre|o que (e|significa|voce acha)|qual seria|recomend\w*|posicion\w*|indic\w*|se (voce|vc) fosse|simula\w*|calcul\w*|quanto (custa|vale|cobra)|preco)\b/;
  // 06/out/2026 (bateria de conversa, ao vivo): "e quem cancelou mais" repetia a tela inteira dos cancelamentos; "qual revenda tem o
  // maior saldo sem cliente" abria o faturamento; "a Oscarpes consegue ver minha carteira" (pergunta de SEGURANÇA) abria a carteira.
  // Pergunta de detalhe — quem, qual revenda/cliente, maior/menor, quem pode ver — é do agente, que responde do número.
  var DETALHE = /\b(quem|qual (revenda|cliente|delas|deles)|quais (revendas|clientes)|que revenda|(maior|menor|mais|menos) (saldo|cancel\w*|prospec\w*|faturad\w*|cresc\w*)|(consegue|pode|podem|vai|vao|conseguem) (ver|enxergar|acessar|mexer)|acess\w*|segur\w*|isso e (bom|ruim)|e bom ou ruim|quanto (que )?era|era quanto|lembra|de novo quanto)\b|\bmesmo$/;
  // "e o saldo dela?" (dela = a revenda de que se falava): pergunta de UMA revenda — o agente (só na carteira; "os destaques dele" é do mapa)
  var DE_UMA_REVENDA = /\b(dela|delas|essa revenda|dessa revenda|nessa revenda)\b/;
  var CARTEIRA_PARTE = [
    ['cancelamento', /\bcancel\w*\b|\bquanto (que )?(eu )?(ja )?(fechei|fechou|fechamos)\b|\b(o que|quanto) (que )?(ja )?(foi )?fechad\w*\b/],
    ['prospeccao', /\bprospec\w*\b|\bbest\b|\boportunidade\w*\b/],
    ['faturamento', /\bfatur\w*\b|\ba faturar\b|\bpedido (em|no) sistema\b|\bsaldo\b/],
    ['carteira', /\bcarteira\b|\bminhas? vendas?\b|\b26 (x|contra|versus|e) 27\b|\bvolume de vendas?\b/],
  ];
  var NAV_PROX = /^(e )?(proxim[ao]|seguinte|avanca|pode avancar|vai|passa)( (tela|slide|pagina))?$/;
  var NAV_ANT = /^(e )?(volta|anterior|voltar)( (uma|a anterior|tela|slide))?$/;
  var NAV_FECHA = /^(fecha|fechar|sai|sair)( (a|essa|esta))?( (carteira|apresentacao|tela))?$/;
  var RESULTADOS = /\b(resultados?|desempenho|placar|como (foi|ficou|se saiu|esta)|quanto(s|as)? (areas?|lavouras?) (ele )?(ganhou|venceu))\b/;
  // o nome com que a pessoa chama (Oscar / Jarvis / OSC no começo) sai antes de ler o pedido
  var CHAMADA = /^(ok |ei |oi )?(oscar|jarvis|oscarpes)\b ?/;
  var FALA_ABRI_NO_MAPA = 'Pronto, está aí no mapa.';

  /**
   * A fala vira uma ação da demonstração, ou null (vai ao agente).
   * D = { mapa, carteira } (dados-demo.json) · N = o núcleo do mapa (MapaGD) · ctx = estado da tela:
   *   { mapaAberto, fichaAberta, passeio, filtro (o do mapa), hibAssunto, geoAssunto, carteiraAberta, telaCarteira (índice) }
   * Ações: { tipo:'tela', acao:'inicio'|'fechar_mapa'|'fechar_ficha' }
   *        { tipo:'carteira', tela: índice, fala } · { tipo:'carteira', acao:'fechar' }
   *        { tipo:'mapa', acao:'placar'|'lugares'|'top'|'area_por'|… (a do núcleo), hib, geo, fala? }
   */
  function interpretar(D, N, texto, ctx) {
    ctx = ctx || {};
    // o jeito falado: "aonde", "onde que", "o que que" → a forma que as regras leem
    var t = norm(texto).replace(CHAMADA, '').replace(/\baonde\b/g, 'onde').replace(/\bonde que\b/g, 'onde').replace(/\bque que\b/g, 'que');
    if (!t) return null;
    // 1) comando de tela (o MESMO do Jarvis: MapaGD.comandoDeTela)
    var ct = N.comandoDeTela(t);
    if (ct) return { tipo: 'tela', acao: ct };
    if (PERGUNTA.test(t) || DETALHE.test(t)) return null;
    // 2) com a carteira aberta: passar, voltar, fechar
    if (ctx.carteiraAberta) {
      var nT = telasDaCarteira(D.carteira).length, i = ctx.telaCarteira || 0;
      if (NAV_PROX.test(t)) return { tipo: 'carteira', tela: Math.min(nT - 1, i + 1) };
      if (NAV_ANT.test(t)) return { tipo: 'carteira', tela: Math.max(0, i - 1) };
      if (NAV_FECHA.test(t)) return { tipo: 'carteira', acao: 'fechar' };
    }
    var hib = hibridoDaFala(D.mapa.portfolio, t);
    // uma revenda citada pelo nome ("quanto a Revenda Beta tem a faturar?") é pergunta de detalhe: o agente responde dela
    var nomes = (D.carteira.revendas || []).map(function (x) { return norm(x.nome).replace(/^(revenda|grupo de compra) /, ''); });
    if (!hib && nomes.some(function (n) { return (' ' + t + ' ').indexOf(' ' + n + ' ') >= 0; })) return null;
    // 3) a carteira (sem híbrido na fala: "como foi o OSC 2815" é do mapa)
    if (!hib) {
      for (var k = 0; k < CARTEIRA_PARTE.length; k++) {
        if (CARTEIRA_PARTE[k][1].test(t)) {
          if (DE_UMA_REVENDA.test(t)) return null;
          var telas = telasDaCarteira(D.carteira);
          var j = telas.map(function (x) { return x.id; }).indexOf(CARTEIRA_PARTE[k][0]);
          // 06/out/2026: com ESSA tela já aberta, "e faturado?", "falta quanto pra faturar?" é pergunta de um pedaço dela —
          // o agente responde curto (antes a página repetia a fala inteira da tela três vezes seguidas)
          if (ctx.carteiraAberta && ctx.telaCarteira === j && !/^(me )?(mostra|mostre|abre|abra|volta|volte)\b/.test(t)) return null;
          return { tipo: 'carteira', tela: j, fala: telas[j].fala };
        }
      }
    }
    // 4) "os resultados do OSC 2815 no Médio-Norte" / "como foi o OSC 2701 no Parecis" → o placar do híbrido no recorte
    var semH = semHibrido(t);
    // 06/out/2026 (bateria de conversa): "mostra o OSC 28 15 em Sorriso" ia ao agente, que mandava a pessoa repetir com outras
    // palavras ("peça: me mostra os resultados…"). Híbrido + mostrar/abrir/ver = o placar dele na tela.
    var MOSTRAR = /^(e )?(me )?(mostra|mostre|mostrar|abre|abra|abrir|traz|traga|ver|quero ver|deixa eu ver|bota|coloca)\b/;
    if (hib && MOSTRAR.test(t) && !/\b(onde|melhor|destaque\w*|mais (ganhou|produziu)|top|area|lavoura)\b/.test(t)) {
      var geoM = N.recorteDoTexto(D.mapa, semH) || ctx.geoAssunto || null;
      return { tipo: 'mapa', acao: 'placar', hib: hib, geo: geoM, fala: N.fraseDoPlacar(D.mapa, hib, geoM) };
    }
    // "sim", "pode abrir", "abre aí" depois que o agente OFERECEU o mapa ("quer que eu abra no mapa?"), ou "abre no mapa" com o
    // híbrido do assunto: o placar do assunto da conversa (o que o agente acabou de falar — depoisDoAgente)
    var assuntoHib = ctx.hibAssunto || null;
    if (!hib && assuntoHib && ((ctx.ofereceuMapa && /^(sim|pode|isso|quero|claro|abre|abra|mostra|mostre|bora|vai|beleza|ok)( (sim|pode|por favor|ai|la|pra mim|no mapa|abrir|mostrar|ver|abre|isso|claro))*$/.test(t)) ||
        /^(abre|abra|mostra|mostre|bota|coloca|joga)( (isso|ele|esse|ai|la))? (no|pro|na) (mapa|tela)( (pra mim|por favor|ai))?$/.test(t))) {
      var geoS = ctx.geoAssunto || null;
      // o agente acabou de dizer os números: a página só abre e confirma (sem repetir o placar inteiro)
      return { tipo: 'mapa', acao: 'placar', hib: assuntoHib, geo: geoS, fala: FALA_ABRI_NO_MAPA };
    }
    // com o mapa aberto, "e lá em Vera?", "e no Parecis?" = o mesmo híbrido em outro lugar
    if (ctx.mapaAberto && assuntoHib && !hib && /^e (la |ai )?(em|no|na|nos|nas|pra|para) /.test(t) && t.split(' ').length <= 7) {
      var geoE = N.recorteDoTexto(D.mapa, t);
      if (geoE) return { tipo: 'mapa', acao: 'placar', hib: assuntoHib, geo: geoE, fala: N.fraseDoPlacar(D.mapa, assuntoHib, geoE) };
    }
    if (hib && RESULTADOS.test(t) && !/\b(onde|melhor|destaque\w*|mais (ganhou|produziu))\b/.test(t)) {
      var geo = N.recorteDoTexto(D.mapa, semH) || null;
      return { tipo: 'mapa', acao: 'placar', hib: hib, geo: geo, fala: N.fraseDoPlacar(D.mapa, hib, geo) };
    }
    // 5) o resto do mapa: as MESMAS regras do Jarvis (núcleo), com o híbrido e o recorte do assunto
    var f = ctx.filtro || {};
    var geoTela = f.cid ? { cid: f.cid } : (f.cids && f.cids.length) ? { cids: f.cids } : f.mic ? { mic: f.mic } : f.reg ? { reg: f.reg } : null;
    var ac = N.interpretarFala(D.mapa, semH, { aberto: !!ctx.mapaAberto, ficha: !!ctx.fichaAberta, passeio: !!ctx.passeio,
      hibContexto: hib || f.hib || ctx.hibAssunto || null, recorteContexto: geoTela || ctx.geoAssunto || null });
    if (!ac) return null;
    if (ac.acao === 'qual_hibrido') return { tipo: 'mapa', acao: 'qual_hibrido', fala: 'De qual híbrido? Por exemplo: os resultados do OSC 2815 no Médio-Norte.' };
    var r = { tipo: 'mapa', acao: ac.acao, hib: ac.hib || null, geo: ac.geo || null, filtro: ac.filtro || null, geoTroca: ac.geo === true, criterio: ac.criterio || null, ordem: ac.ordem || null };
    // 06/out/2026 (madrugada): a tela mostra todos os lugares; a VOZ fala os 3 primeiros (6 cidades com número davam ~400 letras)
    if (ac.acao === 'lugares') { r.lugares = N.melhoresLugares(D.mapa, ac.hib, ac.geo || {}); r.fala = N.fraseDosLugares(D.mapa, ac.hib, ac.geo, r.lugares.slice(0, 3)); }
    else if (ac.acao === 'placar' || ac.acao === 'no_mapa') { if (ac.hib) r.fala = N.fraseDoPlacar(D.mapa, ac.hib, ac.geo); }
    else if (ac.acao === 'area_por') { r.area = N.areaPor(D.mapa, ac.hib, ac.geo || {}, ac.criterio, ac.ordem); r.fala = N.fraseDaAreaDoHibrido(D.mapa, ac.hib, r.area, ac.geo); }
    else if (ac.acao === 'top') { r.top = N.topDoHibrido(D.mapa, ac.hib, ac.geo || {}, 3); }
    return r;
  }

  /** O que está na tela, para o agente (a pergunta livre vai com isto). Puro. */
  // 06/out/2026 (madrugada — João: "uma apresentação comigo de duas horas"): o que a PÁGINA já mostrou e falou nesta conversa
  // (as falas dela não entram no fio do agente) — "volta naquele número do início", "como a gente viu na carteira"
  function contexto(ctx) {
    ctx = ctx || {};
    var antes = (ctx.mostrados || []).slice(-4);
    var hist = antes.length ? '; antes, a tela já mostrou e falou: ' + antes.map(function (x) { return '"' + String(x).slice(0, 150) + '"'; }).join(' / ') : '';
    if (ctx.carteiraAberta) return 'carteira de demonstração (dados fictícios), tela "' + (ctx.tituloCarteira || '') + '"' + hist;
    if (ctx.mapaAberto) return 'mapa dos resultados da demonstração (dados fictícios)' + (ctx.hibAssunto ? ', híbrido ' + ctx.hibAssunto : '') + (ctx.ondeAssunto ? ', ' + ctx.ondeAssunto : '') + hist;
    return antes.length ? 'a tela inicial' + hist : '';
  }
  /** Guarda o que a página falou (as últimas 6), para o contexto do agente. Puro: devolve a lista nova. */
  function lembrarMostrado(lista, fala) {
    var f = String(fala || '').trim();
    if (!f || /^(pronto|mapa fechado|ficha fechada|ta bom)/i.test(f)) return (lista || []).slice(-6);
    return (lista || []).concat([f]).slice(-6);
  }

  /**
   * Depois que o AGENTE respondeu (pergunta livre): o assunto da conversa passa a ser o híbrido e o lugar que a fala ou a
   * resposta citaram — é por ele que "abre no mapa", "sim, pode abrir" e "e quantas ele ficou em primeiro?" seguem o fio
   * (06/out/2026, bateria de conversa: depois de três respostas do agente sobre o 2815, a página perguntava "De qual híbrido?").
   * Não abre nada na tela. Devolve o estado novo (puro).
   */
  function depoisDoAgente(D, N, ctx, fala, resposta) {
    var c = Object.assign({}, ctx || {});
    var hib = hibridoDaFala(D.mapa.portfolio, fala) || hibridoDaFala(D.mapa.portfolio, resposta);
    var t = norm(String(fala || '')).replace(CHAMADA, '');
    var geo = null;
    try { geo = N.recorteDoTexto(D.mapa, semHibrido(t)) || (hib ? N.recorteDoTexto(D.mapa, semHibrido(norm(resposta))) : null); } catch (e) { geo = null; }
    if (hib) { c.hibAssunto = hib; c.geoAssunto = geo || (c.hibAssunto === ctx.hibAssunto ? ctx.geoAssunto : null) || null; }
    else if (geo && c.hibAssunto) c.geoAssunto = geo;
    var rs = String(resposta || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    c.ofereceuMapa = /\b(quer|querem|posso|gostaria)\b[^.?!]{0,40}\b(mapa|tela)\b[^.!]*\?/.test(rs);
    return c;
  }

  return { versao: 2, norm: norm, mil: mil, hibridoDaFala: hibridoDaFala, totais: totais, motivos: motivos, telasDaCarteira: telasDaCarteira, interpretar: interpretar, contexto: contexto, depoisDoAgente: depoisDoAgente, lembrarMostrado: lembrarMostrado };
});
