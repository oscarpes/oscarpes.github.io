/* =============================================================================================
   MAPA DOS RESULTADOS DE GD — O NÚCLEO (05/out/2026)
   =============================================================================================
   João, 05/out/2026: "crie um mapa clicável de todos os resultados de GD … do estado inteiro, porém
   que ele possa ser segregado por representante, região, cidade, micro região … quando clica abre
   o resultado inteiro, e todos os dados do resultado em uma tabela de vidro transparente no mesmo
   conceito, resumida, sem informações desnecessárias como [a coordenada] esse tipo de coisa,
   nome de representante também não precisa". E, no mesmo dia: "monte o mapa de todos os resultados;
   depois, se o cara quiser ver o resultado, sai clicando neles … mas se filtrar algum filtro, dá um
   zoom no mapa relativo ao filtro e continua as bolinhas clicáveis".

   UM desenho para os três lugares (cópia BYTE A BYTE — o portão conferir-mapa-resultados.ts compara):
     lib/mapa-gd-nucleo.js                                          o app (app/empresa-mapa-gd.tsx, web)
     public/ao-vivo/temas/brevant/mapa-gd-nucleo.js                 o Jarvis (mapa-gd.js monta)
     supabase/functions/_compartilhado/apresentacao/pagina/mapa-gd-nucleo.js   a tela "mapa" do motor
     public/ao-vivo/temas/demo-milho/mapa-gd-nucleo.js              a demonstração com dados fictícios (06/out/2026)
   Mudou aqui? copie para os outros três (o portão reprova se divergir).

   O QUE O MAPA FAZ
     • abre com TODAS as áreas, uma bolinha clicável por área; clicar abre a FICHA de vidro da área;
     • filtro (representante, região, microrregião, cidade, híbrido, época) NÃO abre lista nem resumo:
       só dá ZOOM enquadrando as áreas que batem; as outras ficam esmaecidas, visíveis e clicáveis.
       Exceção: "meus ensaios" (autoria, regra do ensaios_brevant) — aí as áreas de outro técnico SAEM;
     • a posição é a do dado (x, y = centro da célula de ~5 km, já projetado em km pelo gerador
       scripts/brevant/gerar-mapa-resultados.py). Áreas da mesma célula se abrem num girassol em
       volta do centro, com espaço fixo NA TELA (o centro não muda, a ordem é a do id);
     • a ficha: cidade, plantio e época, ambiente e clima, microrregião e região, o ranking inteiro
       (posição, híbrido, sc/ha), a média do ensaio. Os Brevant destacados de leve. NUNCA: coordenada,
       técnico/representante, produtor, fazenda, o código do ensaio na planilha, marca de concorrente.
   Sem rede, sem biblioteca: SVG puro (abre na apresentação offline).
   ============================================================================================= */
(function (raiz, fabrica) {
  var M = fabrica();
  if (typeof module === 'object' && module && module.exports) module.exports = M;
  if (raiz) raiz.MapaGD = M;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  // --------------------------------------------------------------------------------- utilidades puras
  var norm = function (s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var dec1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1).replace('.', ','); };
  var AMB = { A: 'alto', M: 'médio', B: 'baixo' };
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var ROTULO_REDE = 'rede Brevant (comercial)';
  var RESSALVA = 'Ensaio lado a lado de geração de demanda (sem repetição nem sorteio): é indicação de campo, não prova estatística. Posição no mapa arredondada para ~5 km.';
  // 06/out/2026 (demonstração com marca fictícia, tema demo-milho): o selo da marca vem do dado (dados.marca); sem ele, Brevant
  var marcaDe = function (d) { return (d && d.marca) || 'Brevant'; };
  var chaveCidade = function (a) { return norm(a.mun) + '|' + a.uf; };
  var ordemPlantio = function (a) { var p = String(a.pl || '').split('/'); return (MESES.indexOf(p[1]) + 1) * 40 + (+p[0] || 0); };

  /** Uma área bate com o filtro? f = { reg, mic, cid ('chave|UF'), tec, aut, hib, ep } — cada campo é opcional. */
  function bate(a, f) {
    if (!f) return true;
    if (f.reg && a.reg !== f.reg) return false;
    if (f.mic && a.mic !== f.mic) return false;
    if (f.cid && chaveCidade(a) !== f.cid) return false;
    // 05/out/2026, 22:30 ("os resultados de B2815 de Vera e de outra cidade"): VÁRIAS cidades juntas
    if (f.cids && f.cids.length && f.cids.indexOf(chaveCidade(a)) < 0) return false;
    if (f.tec && a.tec !== f.tec) return false;
    if (f.aut && a.aut !== f.aut) return false;
    if (f.ep && a.ep !== f.ep) return false;
    if (f.hib && !(a.h || []).some(function (x) { return x[0] === f.hib; })) return false;
    // 05/out/2026 (18:55: "as áreas de GD do B2815 contra o MG 540"): o CONCORRENTE — f.con é o prefixo do código (MG540, AS1868)
    if (f.con && !(a.h || []).some(function (x) { return !x[1] && ehDoConcorrente(x[0], f.con); })) return false;
    return true;
  }
  function ehDoConcorrente(codigo, con) { var c = String(codigo || ''); return c.indexOf(con) === 0 && !/\d/.test(c.charAt(con.length)); }
  function filtrar(dados, f) { return (dados.areas || []).filter(function (a) { return bate(a, f); }); }
  var temFiltro = function (f) { return !!f && Object.keys(f).some(function (k) { return !!f[k]; }); };

  /** O ranking da área: posição (empate divide a posição), híbrido, Brevant?, sc/ha — do maior para o menor. */
  function ranking(a) {
    var h = (a.h || []).slice().sort(function (p, q) { return q[2] - p[2]; });
    var out = [], pos = 0, ant = null;
    h.forEach(function (x, i) { if (x[2] !== ant) { pos = i + 1; ant = x[2]; } out.push({ pos: pos, hib: x[0], brevant: !!x[1], sc: x[2] }); });
    return out;
  }
  function mediaDoEnsaio(a) { var h = a.h || []; return h.length ? h.reduce(function (s, x) { return s + x[2]; }, 0) / h.length : null; }

  /** De quem são as áreas na tela (a regra do ensaios_brevant: sempre dizer). */
  function rotuloAutoria(dados, f, op) {
    op = op || {};
    if (f && f.aut) return 'ensaios ' + (op.nomeDono ? 'de ' + op.nomeDono : 'desta conta') + ' (só as áreas desta conta)';
    if (f && f.tec && dados.tecnicos && dados.tecnicos[f.tec]) return 'ensaios de ' + dados.tecnicos[f.tec];
    return dados.rotulo || op.rotulo || ROTULO_REDE;
  }

  /** Quantas colunas a tabela da ficha usa (o ranking inteiro sempre aparece). */
  function colunasDaFicha(n) { return n <= 11 ? 1 : n <= 24 ? 2 : n <= 42 ? 3 : 4; }

  /** A FICHA de vidro (HTML) de UMA área. Pura: o portão confere que não sai coordenada nem nome de pessoa. */
  function fichaHTML(dados, a, op) {
    op = op || {};
    var r = ranking(a), m = mediaDoEnsaio(a);
    var ep = (dados.epocas || {})[a.ep], cli = (dados.climas || {})[a.cli], reg = (dados.regioes || {})[a.reg];
    var linhas = [];
    linhas.push('Plantio ' + esc(a.pl || '—') + (ep ? ' · época ' + esc(ep) : ''));
    var amb = a.amb ? 'ambiente de ' + AMB[a.amb] + ' potencial' : '';
    if (amb || cli) linhas.push([amb, cli ? 'clima: ' + esc(cli) : ''].filter(Boolean).join(' · ').replace(/^./, function (c) { return c.toUpperCase(); }));
    linhas.push([a.mic ? 'Microrregião ' + esc(String(a.mic).replace(/\s*\([A-Z]{2}\)$/, '')) : '', reg ? esc(reg) : ''].filter(Boolean).join(' · '));
    var linha = function (x) {
      return '<tr class="' + (x.brevant ? 'mgd-brv' : '') + '"><td class="mgd-pos">' + x.pos + 'º</td><td class="mgd-hib">' + esc(x.hib) +
        (x.brevant ? ' <span class="mgd-selo">' + esc(marcaDe(dados)) + '</span>' : '') + '</td><td class="mgd-sc">' + dec1(x.sc) + '</td></tr>';
    };
    // ensaio grande (até 54 híbridos) vira 2 a 4 colunas, na ordem do ranking (de cima para baixo, coluna a coluna)
    var nc = colunasDaFicha(r.length), porCol = Math.ceil(r.length / nc), tabs = [];
    for (var c = 0; c < nc; c++) tabs.push('<table><thead><tr><th>Posição</th><th>Híbrido</th><th>sc/ha</th></tr></thead><tbody>' + r.slice(c * porCol, (c + 1) * porCol).map(linha).join('') + '</tbody></table>');
    var nav = op.nav ? '<div class="mgd-nav"><button type="button" class="mgd-ant" aria-label="área anterior">‹</button><span>' + esc(op.nav) + '</span><button type="button" class="mgd-prox" aria-label="próxima área">›</button></div>' : '';
    return '<button type="button" class="mgd-x" aria-label="fechar">×</button>' +
      '<div class="mgd-ficha-cab"><span class="mgd-tag">Ensaio lado a lado · milho ' + esc(dados.safra || '') + '</span>' +
      '<h3>' + esc(a.mun) + ' <small>' + esc(a.uf) + '</small></h3>' + linhas.filter(Boolean).map(function (l) { return '<p>' + l + '</p>'; }).join('') + '</div>' +
      '<div class="mgd-ficha-tab"><div class="mgd-cols" style="grid-template-columns:repeat(' + nc + ',1fr)">' + tabs.join('') + '</div></div>' +
      '<div class="mgd-media"><span>Média do ensaio <small>(' + r.length + (r.length === 1 ? ' híbrido' : ' híbridos') + ')</small></span><b>' + (m == null ? '—' : dec1(m)) + ' <small>sc/ha</small></b></div>' +
      '<p class="mgd-ressalva">' + esc(RESSALVA) + '</p>' + nav;
  }

  // --------------------------------------------------------------------------------- o HÍBRIDO no mapa (05/out/2026, vídeo do B2815)
  // João: "quando eu pedir sobre resultados específicos, ou quantas áreas ganhou, seria interessante mostrar o mapa
  // com os pontos clicáveis … me mostra os resultados mais interessantes sobre ele, aí você vai abrindo no mapa uns 3
  // resultados top"; e "onde ele realmente se destacou?" (os melhores municípios do recorte).
  // TODAS AS RÉGUAS FORAM ESCRITAS ANTES DE OLHAR O RESULTADO e são as mesmas do ensaios_brevant:
  //   • concorrente = híbrido de OUTRA marca (Brevant pré-comercial nunca é concorrente; nunca Brevant × Brevant);
  //   • "à frente" = sc/ha do híbrido ACIMA da média dos concorrentes da MESMA lavoura (nunca contra o último);
  //   • "1º lugar na lavoura" = a maior sc/ha de TODOS os híbridos da lavoura (empate no topo conta);
  //   • lavoura do recorte = tem o híbrido E pelo menos um concorrente; cada lavoura conta uma vez; todas entram.
  var concDe = function (a) { return (a.h || []).filter(function (x) { return !x[1]; }); };
  var euEm = function (a, hib) { return (a.h || []).filter(function (x) { return x[0] === hib; })[0] || null; };
  var med = function (v) { return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : null; };
  var r1 = function (x) { return x == null ? null : Math.round(x * 10) / 10; };
  /** As lavouras do híbrido no recorte (com concorrente ao lado), com a vantagem sobre a média dos concorrentes. */
  function lavourasDoHibrido(dados, hib, f) {
    var g = {}; Object.keys(f || {}).forEach(function (k) { if (k !== 'hib' && f[k]) g[k] = f[k]; });
    return filtrar(dados, g).map(function (a) {
      var eu = euEm(a, hib), cs = concDe(a);
      if (!eu || !cs.length) return null;
      var mc = med(cs.map(function (x) { return x[2]; }));
      var topo = Math.max.apply(null, a.h.map(function (x) { return x[2]; }));
      return { a: a, sc: eu[2], vant: eu[2] - mc, frente: eu[2] > mc, primeiro: eu[2] >= topo, ncon: cs.length,
        limpa: !eu[3] && !cs.some(function (x) { return x[3]; }) };
    }).filter(Boolean);
  }
  /** "Quantas áreas ele ganhou": os DOIS critérios, sempre com a definição. */
  function placarDoHibrido(dados, hib, f) {
    var l = lavourasDoHibrido(dados, hib, f);
    return { hibrido: hib, lavouras: l.length, frente: l.filter(function (x) { return x.frente; }).length, primeiro: l.filter(function (x) { return x.primeiro; }).length,
      vantagem_media_sc_ha: r1(med(l.map(function (x) { return x.vant; }))),
      ids_frente: l.filter(function (x) { return x.frente; }).map(function (x) { return x.a.id; }), ids_outras: l.filter(function (x) { return !x.frente; }).map(function (x) { return x.a.id; }),
      criterio_frente: 'à frente = sc/ha do ' + hib + ' acima da média dos concorrentes da mesma lavoura',
      criterio_primeiro: '1º lugar = a maior sc/ha entre todos os híbridos da lavoura' };
  }
  var CRITERIO_TOP = 'lavouras com 4+ concorrentes, sem faixa fora da faixa (< 55 % ou > 145 % da mediana) do híbrido nem dos concorrentes, ' +
    'híbrido à frente da média dos concorrentes; ordem: 1º lugar na lavoura primeiro, depois a maior vantagem sobre a MÉDIA dos concorrentes (sc/ha); ' +
    'até 3, em municípios diferentes quando dá';
  /** Os 3 resultados "top" do híbrido no recorte (CRITERIO_TOP, escrito antes de olhar). */
  function topDoHibrido(dados, hib, f, n) {
    n = n || 3;
    var l = lavourasDoHibrido(dados, hib, f).filter(function (x) { return x.ncon >= 4 && x.limpa && x.vant > 0; })
      .sort(function (p, q) { return (q.primeiro - p.primeiro) || (q.vant - p.vant) || (p.a.id < q.a.id ? -1 : 1); });
    var out = [], vistos = {};
    l.forEach(function (x) { if (out.length < n && !vistos[chaveCidade(x.a)]) { out.push(x); vistos[chaveCidade(x.a)] = 1; } });
    l.forEach(function (x) { if (out.length < n && out.indexOf(x) < 0) out.push(x); });
    return out.map(function (x) { return { id: x.a.id, mun: x.a.mun, uf: x.a.uf, pl: x.a.pl, sc: x.sc, vant: r1(x.vant), primeiro: x.primeiro, concorrentes: x.ncon, hibridos: x.a.h.length }; });
  }
  // 05/out/2026: o João mandou incluir um município que ficou em 78,6 % — a régua desceu de 80 % para 75 % PARA TODOS
  // (nunca exceção para um lugar só); quem entrou com isso está no PLANO.md
  var LUGAR_PISO = 0.75;
  var CRITERIO_LUGARES = 'município com 5+ lavouras do híbrido com concorrente (todas as lavouras do recorte); as lavouras de municípios com menos de 5 ' +
    'juntam-se pela microrregião (5+); entra quem ficou à frente da média dos concorrentes em 75 %+ das lavouras com vantagem média positiva; ordem: a vantagem (sc/ha)';
  /** "Onde ele se destacou": os municípios (ou o resto da microrregião) que passam em CRITERIO_LUGARES. */
  function melhoresLugares(dados, hib, f) {
    var l = lavourasDoHibrido(dados, hib, f), porMun = {}, out = [];
    l.forEach(function (x) { var k = chaveCidade(x.a); (porMun[k] = porMun[k] || []).push(x); });
    var resto = {};
    var grupo = function (nome, nivel, xs) {
      var fr = xs.filter(function (x) { return x.frente; }).length, v = med(xs.map(function (x) { return x.vant; }));
      return { nome: nome, nivel: nivel, lavouras: xs.length, frente: fr, vantagem_sc_ha: r1(v), passa: xs.length >= 5 && fr / xs.length >= LUGAR_PISO && v > 0,
        cidades: Object.keys(xs.reduce(function (m, x) { m[chaveCidade(x.a)] = 1; return m; }, {})), ids: xs.map(function (x) { return x.a.id; }) };
    };
    Object.keys(porMun).forEach(function (k) {
      var xs = porMun[k];
      if (xs.length >= 5) out.push(grupo(xs[0].a.mun, 'município', xs));
      else xs.forEach(function (x) { var m = x.a.mic || '?'; (resto[m] = resto[m] || []).push(x); });
    });
    Object.keys(resto).forEach(function (m) {
      var xs = resto[m], inteira = !Object.keys(porMun).some(function (k) { return porMun[k].length >= 5 && porMun[k][0].a.mic === m; });
      var nm = String(m).replace(/\s*\([A-Z]{2}\)$/, '');
      if (xs.length >= 5) out.push(grupo(inteira ? 'microrregião de ' + nm : 'demais cidades da microrregião de ' + nm, 'microrregião', xs));
    });
    return out.filter(function (g) { return g.passa; }).sort(function (p, q) { return q.vantagem_sc_ha - p.vantagem_sc_ha || (p.nome < q.nome ? -1 : 1); });
  }

  // ------------------------------------------------------------- O HÍBRIDO CONTRA UM CONCORRENTE (05/out/2026, 18:55)
  /** O concorrente citado ("MG 540", "mg540", "AS1868") → o prefixo do código na base ("MG540"); null se nenhum. Pura. */
  function concorrenteDoTexto(dados, t) {
    var cods = dados._codigosConc || (dados._codigosConc = (function () { var s = {}; (dados.areas || []).forEach(function (a) { (a.h || []).forEach(function (x) { if (!x[1]) s[x[0]] = 1; }); }); return Object.keys(s); })());
    var re = /\b([a-z]{1,5}) ?(\d{2,5})(?=[a-z]|\b)/g, m;
    while ((m = re.exec(norm(t)))) {
      var k = (m[1] + m[2]).toUpperCase();
      if (/^B\d{4}$/.test(k)) continue;                         // é Brevant
      if (cods.some(function (c) { return ehDoConcorrente(c, k); })) return k;
    }
    return null;
  }
  /** Lado a lado: as lavouras em que os dois estiveram; à frente = sc/ha do híbrido acima do concorrente na lavoura. Pura. */
  function versusDoHibrido(dados, hib, con, f) {
    var g = {}; Object.keys(f || {}).forEach(function (k) { if (f[k]) g[k] = f[k]; }); g.hib = hib; g.con = con;
    var frente = [], outras = [], difs = [];
    filtrar(dados, g).forEach(function (a) {
      var eu = euEm(a, hib), ele = (a.h || []).filter(function (x) { return !x[1] && ehDoConcorrente(x[0], con); })
        .sort(function (p, q) { return q[2] - p[2]; })[0];
      if (!eu || !ele) return;
      difs.push(eu[2] - ele[2]); (eu[2] > ele[2] ? frente : outras).push(a.id);
    });
    return { hibrido: hib, concorrente: con, lavouras: frente.length + outras.length, frente: frente.length, dif_media_sc_ha: r1(med(difs)), ids_frente: frente, ids_outras: outras,
      criterio: 'lavouras em que os dois estiveram lado a lado; à frente = sc/ha do ' + hib + ' acima do ' + con + ' na mesma lavoura' };
  }

  // ------------------------------------------------------------- UMA ÁREA POR CRITÉRIO (05/out/2026, teste do João 15:15–15:17)
  // "abra a segunda área que foi a maior produtividade", "qual dessas áreas o B2815 produziu mais perante aos concorrentes",
  // "a melhor área", "a área onde ele mais ganhou do concorrente", "a de maior diferença". Critérios escritos antes de olhar:
  //   produtividade = a sc/ha do híbrido na lavoura (maior primeiro);
  //   vantagem      = sc/ha do híbrido menos a MÉDIA dos concorrentes da mesma lavoura (maior primeiro);
  //   destaque      = a régua dos destaques (CRITERIO_TOP: 4+ concorrentes, sem faixa fora, à frente; 1º lugar e depois a vantagem);
  //                   sem lavoura na régua, vale a vantagem;
  //   pior          = a menor vantagem (só quando a pessoa pede).
  // Dentro do recorte f (o filtro da tela, quando a pessoa diz "dessas"). ordem 1 = a primeira da lista.
  var CRITERIOS_AREA = { produtividade: 'maior sc/ha do híbrido na lavoura', vantagem: 'maior vantagem sobre a média dos concorrentes da mesma lavoura',
    destaque: CRITERIO_TOP, pior: 'menor vantagem sobre a média dos concorrentes da mesma lavoura' };
  function areaPor(dados, hib, f, criterio, ordem) {
    ordem = Math.max(1, Math.round(+ordem || 1));
    var l = lavourasDoHibrido(dados, hib, f || {});
    var porId = function (p, q) { return p.a.id < q.a.id ? -1 : 1; };
    var ord;
    // 05/out/2026, 20:38: "onde mais produziu" = a maior sc/ha ENTRE AS LAVOURAS EM QUE ELE FICOU À FRENTE da média dos concorrentes
    // (a absoluta da rede caiu em Sapezal, numa área em que ele perdeu — não serve de argumento); a de todas só se pedida
    if (criterio === 'produtividade') ord = l.filter(function (x) { return x.vant > 0; }).sort(function (p, q) { return (q.sc - p.sc) || porId(p, q); });
    else if (criterio === 'produtividade_total') ord = l.slice().sort(function (p, q) { return (q.sc - p.sc) || porId(p, q); });
    else if (criterio === 'pior') ord = l.slice().sort(function (p, q) { return (p.vant - q.vant) || porId(p, q); });
    else if (criterio === 'destaque') {
      ord = l.filter(function (x) { return x.ncon >= 4 && x.limpa && x.vant > 0; }).sort(function (p, q) { return (q.primeiro - p.primeiro) || (q.vant - p.vant) || porId(p, q); });
      if (!ord.length) { criterio = 'vantagem'; ord = null; }
    }
    if (!ord) ord = l.filter(function (x) { return x.vant > 0; }).sort(function (p, q) { return (q.vant - p.vant) || porId(p, q); });
    var x = ord[ordem - 1];
    if (!x) return { total: ord.length, criterio: criterio, ordem: ordem, area: null };
    var pos = ranking(x.a).filter(function (r) { return r.hib === hib; })[0];
    return { total: ord.length, criterio: criterio, ordem: ordem, area: { id: x.a.id, mun: x.a.mun, uf: x.a.uf, pl: x.a.pl, sc: x.sc, vant: r1(x.vant),
      posicao: pos ? pos.pos : null, hibridos: x.a.h.length, concorrentes: x.ncon, media_concorrentes: r1(x.sc - x.vant) } };
  }

  // ------------------------------------------------------------- AS FRASES FALADAS (página e servidor dizem a MESMA coisa)
  var MESES_FALA = { jan: 'janeiro', fev: 'fevereiro', mar: 'março', abr: 'abril', mai: 'maio', jun: 'junho', jul: 'julho', ago: 'agosto', set: 'setembro', out: 'outubro', nov: 'novembro', dez: 'dezembro' };
  var ONDE_REG = { MT1: 'no leste de Mato Grosso (MT1)', MT2: 'no Médio-Norte', MT3: 'no Parecis', SUL: 'no sul (MS, RO e GO)' };
  var ORDINAL = ['', 'primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta', 'sétima', 'oitava', 'nona', 'décima'];
  function curtoHib(h) { return String(h || '').replace(/(PWU|VYHR|PRO\d|VIP\d)$/, ''); }
  function dataFalada(pl) { var p = String(pl || '').split('/'); return p[0] ? (+p[0]) + ' de ' + (MESES_FALA[p[1]] || p[1]) : ''; }
  function scFalado(v) { return dec1(Math.abs(v)) + ' ' + (Math.abs(v) >= 1.95 ? 'sacas' : 'saca'); }
  function ondeFalado(dados, geo) {
    if (!geo) return 'em toda a rede';
    if (geo.reg) return ONDE_REG[geo.reg] || geo.reg;
    if (geo.mic) return 'na microrregião ' + String(geo.mic).replace(/\s*\([A-Z]{2}\)$/, '');
    if (geo.cid) { var a = (dados.areas || []).filter(function (x) { return chaveCidade(x) === geo.cid; })[0]; return 'em ' + (a ? a.mun : 'na cidade'); }
    if (geo.cids && geo.cids.length) {
      var nomes = geo.cids.map(function (k) { var b = (dados.areas || []).filter(function (x) { return chaveCidade(x) === k; })[0]; return b ? b.mun : k.split('|')[0]; });
      return 'em ' + (nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0]);
    }
    return 'em toda a rede';
  }
  var maiuscula = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
  /** "Em Itanhangá, plantio 11 de fevereiro, o B2815 foi o 1º entre 6 híbridos: 147,3 sacas, 35,8 sacas acima da média dos concorrentes." */
  function fraseDaAreaDoHibrido(dados, hib, r, geo) {
    if (!r || !r.area) return r && r.criterio !== 'pior' && r.criterio !== 'produtividade_total' ? 'Não há lavoura em que o ' + curtoHib(hib) + ' tenha ficado à frente da média dos concorrentes ' + ondeFalado(dados, geo) + '.' : 'Não achei lavoura do ' + curtoHib(hib) + ' com concorrente ao lado ' + ondeFalado(dados, geo) + '.';
    var a = r.area, h = curtoHib(hib);
    var cab = r.criterio === 'produtividade' ? (r.ordem === 1 ? 'Onde o ' + h + ' mais produziu à frente dos concorrentes' : 'A ' + (ORDINAL[r.ordem] || r.ordem + 'ª') + ' maior produtividade do ' + h + ' à frente dos concorrentes')
      : r.criterio === 'produtividade_total' ? (r.ordem === 1 ? 'A maior produtividade do ' + h + ' entre todas as lavouras' : 'A ' + (ORDINAL[r.ordem] || r.ordem + 'ª') + ' maior produtividade do ' + h + ' entre todas as lavouras')
      : r.criterio === 'pior' ? (r.ordem === 1 ? 'A área mais difícil do ' + h : 'A ' + (ORDINAL[r.ordem] || r.ordem + 'ª') + ' área mais difícil do ' + h)
      : r.criterio === 'destaque' ? (r.ordem === 1 ? 'O melhor resultado do ' + h : 'O ' + (ORDINAL[r.ordem] || r.ordem + 'º').replace(/a$/, 'o') + ' melhor resultado do ' + h)
      : (r.ordem === 1 ? 'A área em que o ' + h + ' mais ganhou da média dos concorrentes' : 'A ' + (ORDINAL[r.ordem] || r.ordem + 'ª') + ' maior vantagem do ' + h + ' sobre os concorrentes');
    var pos = a.posicao === 1 ? 'em primeiro lugar' : a.posicao ? 'em ' + a.posicao + 'º lugar' : '';
    // "abaixo" SÓ quando a pessoa pediu a pior; na absoluta (pedida) o tom é neutro: a média dos concorrentes ali, sem "abaixo"
    var dif = a.vant > 0 ? ', ' + scFalado(a.vant) + ' acima da média dos concorrentes'
      : r.criterio === 'pior' ? ', ' + scFalado(a.vant) + ' abaixo da média dos concorrentes'
      : '; a média dos concorrentes ali foi ' + dec1(a.media_concorrentes) + ' sacas';
    return cab + ' ' + ondeFalado(dados, geo) + ': ' + (geo && geo.cid ? '' : a.mun + ', ') + 'plantio ' + dataFalada(a.pl) + '. Ficou ' + pos + ' entre ' + a.hibridos + ' híbridos, com ' +
      dec1(a.sc) + ' sacas por hectare' + dif + '.';
  }
  /** A mesma fala longa pedida de novo em menos de 5 min: o resumo (o 1º item) e a oferta de outro recorte. Pura. */
  function resumoDeRepeticao(texto) {
    var s = String(texto || ''), corte = s.search(/;|\.\s/);
    var primeiro = (corte > 20 ? s.slice(0, corte) : s.slice(0, 160)).trim();
    return 'Como eu disse há pouco: ' + primeiro.charAt(0).toLowerCase() + primeiro.slice(1) + '. Quer outro recorte, uma cidade ou uma área?';
  }
  /** O placar do híbrido — com VÁRIAS cidades, uma a uma ("em Vera, X de Y; em <outra cidade>, X de Y"). Pura. */
  function porCidade(dados, hib, geo) {
    if (!geo || !geo.cids || geo.cids.length < 2) return null;
    return geo.cids.map(function (k) { var p = placarDoHibrido(dados, hib, { cid: k }); var a = (dados.areas || []).filter(function (x) { return chaveCidade(x) === k; })[0];
      return { cid: k, mun: a ? a.mun : k.split('|')[0], lavouras: p.lavouras, frente: p.frente, primeiro: p.primeiro, vantagem_sc_ha: p.vantagem_media_sc_ha, ids: p.ids_frente.concat(p.ids_outras) }; });
  }
  function fraseDoPlacar(dados, hib, geo) {
    var h = curtoHib(hib), cs = porCidade(dados, hib, geo);
    if (cs) {
      var partes = cs.map(function (c) { return c.lavouras ? 'em ' + c.mun + ', à frente da média dos concorrentes em ' + c.frente + ' de ' + c.lavouras + ' lavouras' + (c.vantagem_sc_ha > 0 ? ', ' + scFalado(c.vantagem_sc_ha) + ' a mais' : '') : 'em ' + c.mun + ', nenhuma lavoura do ' + h + ' com concorrente'; });
      return 'O ' + h + ' ' + partes.join('; ') + '. As lavouras estão no mapa.';
    }
    var p = placarDoHibrido(dados, hib, geo || {});
    if (!p.lavouras) return 'Não há lavoura do ' + h + ' com concorrente ao lado ' + ondeFalado(dados, geo) + '.';
    return maiuscula(ondeFalado(dados, geo)) + ', o ' + h + ' ficou à frente da média dos concorrentes em ' + p.frente + ' de ' + p.lavouras + ' lavouras, e em primeiro lugar na lavoura em ' + p.primeiro + ' de ' + p.lavouras + '.';
  }
  function fraseDoVersus(dados, hib, geo, v) {
    var h = curtoHib(hib), onde = maiuscula(ondeFalado(dados, geo));
    if (!v.lavouras) return onde + ', o ' + h + ' e o ' + v.concorrente + ' não estiveram lado a lado em nenhuma lavoura.';
    return onde + ', o ' + h + ' e o ' + v.concorrente + ' estiveram lado a lado em ' + v.lavouras + (v.lavouras === 1 ? ' lavoura' : ' lavouras') +
      ': o ' + h + ' ficou à frente em ' + v.frente + ' de ' + v.lavouras + (v.dif_media_sc_ha > 0 ? ', com ' + scFalado(v.dif_media_sc_ha) + ' a mais na média' : '') + '. As lavouras estão no mapa.';
  }
  function fraseDosLugares(dados, hib, geo, gs) {
    var h = curtoHib(hib), onde = maiuscula(ondeFalado(dados, geo));
    if (!gs.length) return onde + ', nenhum município do ' + h + ' passa na régua: cinco lavouras ou mais, à frente da média dos concorrentes em setenta e cinco por cento delas.';
    var n = Math.min(gs.length, 6);
    var ditos = gs.slice(0, n).map(function (g, k) {
      return (k && k === n - 1 ? 'e ' : '') + (g.nivel === 'município' ? 'em ' : /^demais/.test(g.nome) ? 'nas ' : 'na ') + g.nome + ', ' + g.frente + ' de ' + g.lavouras + (k ? '' : ' lavouras') + ', ' + scFalado(g.vantagem_sc_ha) + ' a mais';
    });
    return onde + ', os melhores resultados do ' + h + ' foram ' + ditos.join('; ') + ': à frente da média dos concorrentes.';
  }
  function fraseDoDestaque(dados, hib, t, a, i, n, geo) {
    var pos = ranking(a).filter(function (x) { return x.hib === hib; })[0];
    var intro = i === 0 ? 'Os ' + (n === 3 ? 'três' : n) + ' resultados de destaque do ' + curtoHib(hib) + ' ' + ondeFalado(dados, geo) + ', contra a média dos concorrentes. ' : '';
    return intro + (i + 1 === n && n > 1 ? 'E o terceiro: ' : '') + a.mun + ', plantio ' + dataFalada(a.pl) + ': ' + (pos && pos.pos === 1 ? 'primeiro lugar' : (pos ? pos.pos : '—') + 'º lugar') +
      ' entre ' + a.h.length + ' híbridos, ' + scFalado(t.vant) + ' acima da média dos concorrentes.';
  }

  // --------------------------------------------------------------------------------- a fala (Jarvis)
  var PEDE_MEUS = /\b(meu trabalho|meus trabalhos|minhas? (areas?|lavouras?|vitrines?|parcelas?|plots?)|meus (ensaios?|resultados?|lado a lado|plots?|testes?|campos?)|meu (ensaio|resultado|campo)|que eu (plantei|conduzi|acompanhei|lancei|implantei))\b/;
  // 05/out/2026 (João mostrando ao chefe: "me traga o mapa com todos os resultados" e "eu quero o mapa clicável com todos os
  // resultados" não abriram): "traga", "quero", "exibe", "me dá" e "mapa clicável / com (todos) os resultados" também abrem
  var ABRE_MAPA = /\b(mapa (dos|de) (resultados?|ensaios?|gd|lado a lado)|(mostr\w*|abr\w*|traz\w*|trag\w*|quer\w*|exib\w*|ve[rj]\w*|me da|me de) (o |um |aquele |esse )?mapa|mapa (clicavel|interativo|com (todos )?(os )?resultados|de todos os resultados|com todas as areas)|mapa da rede|mapa do estado|mapa dos gd)\b/;
  // 05/out/2026, 22:31: "em/de/da/do" faziam QUALQUER pergunta com cidade virar filtro mudo do mapa ("se você fosse posicionar o milho
  // em <cidade>…" virou "<cidade>: 45 áreas") — só verbo de filtro de verdade
  var VERBO_FILTRO = /^(e )?(filtr\w*|so|somente|apenas|mostr\w*|zoom|aproxim\w*|foc\w*|enquadr\w*|vai (pra|para)|leva (pra|para)|abr\w*|traz\w*|trag\w*)\b/;
  function cidadesDoTexto(dados, t) {
    var vistas = {}, achadas = [];
    (dados.areas || []).forEach(function (a) { var k = norm(a.mun); if (k.length >= 4 && !vistas[k]) { vistas[k] = 1; if ((' ' + t + ' ').indexOf(' ' + k + ' ') >= 0) achadas.push({ k: k, uf: a.uf, mun: a.mun }); } });
    achadas.sort(function (p, q) { return q.k.length - p.k.length; });
    return achadas.filter(function (x) { return !achadas.some(function (y) { return y.k !== x.k && y.k.indexOf(x.k) >= 0; }); });
  }
  function microDoTexto(dados, t) {
    var ms = {}; (dados.areas || []).forEach(function (a) { if (a.mic) ms[a.mic] = 1; });
    var achou = Object.keys(ms).map(function (m) { return { m: m, k: norm(m.replace(/\s*\([A-Z]{2}\)$/, '')) }; })
      .filter(function (x) { return x.k.length >= 4 && (' ' + t + ' ').indexOf(' ' + x.k + ' ') >= 0; }).sort(function (p, q) { return q.k.length - p.k.length; });
    return achou.length ? achou[0].m : null;
  }
  function regiaoDoTexto(t) {
    if (/\bmt ?1\b|\bleste\b|\baraguaia\b/.test(t)) return 'MT1';
    if (/\bmt ?2\b|medio norte/.test(t)) return 'MT2';
    if (/\bmt ?3\b|\bparecis\b/.test(t)) return 'MT3';
    if (/\b(sul de mato grosso|mato grosso do sul|rondonia|goias|regiao sul)\b/.test(t)) return 'SUL';
    return null;
  }
  function tecnicoDoTexto(dados, t) {
    var tec = dados.tecnicos || {}, melhor = null;
    Object.keys(tec).forEach(function (c) {
      var partes = norm(tec[c]).split(' ').filter(function (p) { return p.length >= 4; });
      var acertos = partes.filter(function (p) { return (' ' + t + ' ').indexOf(' ' + p + ' ') >= 0; }).length;
      if (acertos && (!melhor || acertos > melhor.n)) melhor = { c: c, n: acertos };
    });
    // nome que bate com dois técnicos do mesmo jeito (ex.: dois "Lucas") não escolhe sozinho
    if (melhor && Object.keys(tec).filter(function (c) { var ps = norm(tec[c]).split(' ').filter(function (p) { return p.length >= 4; }); return ps.filter(function (p) { return (' ' + t + ' ').indexOf(' ' + p + ' ') >= 0; }).length === melhor.n; }).length > 1) return { ambiguo: true };
    return melhor ? { c: melhor.c } : null;
  }
  function hibridoDoTexto(dados, t) {
    var m = /\bb ?(\d{4})\b|\b(\d{4})\b/.exec(t); if (!m) return null;
    var n = m[1] || m[2];
    return (dados.portfolio || []).filter(function (h) { return h.indexOf('B' + n) === 0; })[0] || null;
  }
  function epocaDoTexto(t) {
    if (/\b(epoca|janela) (1|um|primeira)\b|ate 20 (de )?jan|\bcedo\b/.test(t)) return 'E1';
    if (/\b(epoca|janela) (2|dois|segunda)\b|21 (de )?jan|05 (de )?fev|\bcinco de fevereiro\b/.test(t)) return 'E2';
    if (/\b(epoca|janela) (3|tres|terceira)\b|06 (a|ate) 20 (de )?fev|\b6 a 20\b/.test(t)) return 'E3';
    if (/\b(epoca|janela) (4|quatro|quarta)\b|apos 20 (de )?fev|\btardio\b|depois de 20 de fevereiro/.test(t)) return 'E4';
    return null;
  }
  /** A GEOGRAFIA de um texto (a fala ou o "recorte" que o servidor devolveu): { reg } | { mic } | { cid } | null. */
  function recorteDoTexto(dados, texto) {
    var t = norm(texto);
    if (!t) return null;
    var rd = /\b(regiao|redor|entorno|em volta) (de|da|do) (.+)$/.exec(t);
    if (rd) {
      var c0 = cidadesDoTexto(dados, rd[3])[0];
      var a0 = c0 && (dados.areas || []).filter(function (a) { return norm(a.mun) === c0.k && a.uf === c0.uf; })[0];
      if (a0 && a0.mic) return { mic: a0.mic };
    }
    if (/campo novo do parecis/.test(t)) { var cp = cidadesDoTexto(dados, t)[0]; if (cp) return { cid: cp.k + '|' + cp.uf }; }
    if (/micro ?r?regi/.test(t)) { var mm = microDoTexto(dados, t.replace(/^.*micro ?r?regi\w*\s*(de|da|do)?\s*/, '')); if (mm) return { mic: mm }; }
    var rg = regiaoDoTexto(t); if (rg) return { reg: rg };
    var cs = cidadesDoTexto(dados, t);
    if (cs.length > 1) return { cids: cs.map(function (c) { return c.k + '|' + c.uf; }) };
    if (cs.length) return { cid: cs[0].k + '|' + cs[0].uf };
    var mi = microDoTexto(dados, t); if (mi) return { mic: mi };
    return null;
  }
  var PEDE_PLACAR = /\bquant[ao]s (areas|lavouras|ensaios|vezes|locais)\b.*\b(ganh\w*|venc\w*|bat\w*|frente|primeiro|1o|liderou|lider\w*)\b|\b(ganhou|venceu) (em )?quant[ao]s\b|\bem quant[ao]s (areas|lavouras)\b/;
  var PEDE_LUGARES = /\bonde (o |ele |esse |esse hibrido )?(\w+ )?(realmente |mais |de fato )?(foi (o )?(melhor|muito bem|bem demais|bem)|se destacou|destacou|brilhou|se saiu (melhor|bem))\b|\bmelhores (regioes|cidades|municipios|lugares|pracas|microrregioes|micro regioes)\b|\b(micro ?r?regi\w*|regi(ao|oes)|cidades?|municipios?|lugares|pracas)\b.{0,40}\b(mais )?(se )?(destac\w*|sobressai\w*|foi (melhor|bem)|se saiu (melhor|bem)|ganhou mais|mais ganhou)\b|\bonde (o |ele |esse )?(\w+ )?(mais )?(ganhou|venceu)\b/;
  var PEDE_TOP = /\b(resultados?|areas?|lavouras?|ensaios?) (mais )?(interessantes?|top|de destaque)\b|\b(melhores|top|tres melhores|3 melhores) (resultados?|areas?|lavouras?|ensaios?)\b|\b(resultados?|areas?|lavouras?) (mais )?(expressiv\w*|impressionant\w*|marcantes?|fortes?|chamativ\w*|bonitos?)\b|\b(alguns|uns) (bons |grandes )?(resultados|destaques)\b|\bos destaques\b/;
  // UMA área por critério/ordem ("a segunda maior produtividade", "qual dessas mais perante os concorrentes", "a melhor área")
  var PEDE_AREA_POR = /\b(area|lavoura|resultado|ensaio|dessas|delas|desses|qual|abr\w*|mostr\w*)\b/;
  function criterioDoTexto(t) {
    // "o meu 2701 foi PIOR do que o da Thammy" é comparação (do agente), não "a pior área": só com área/lavoura/resultado junto
    if (/\b(a |o )?(pior|mais fraca) (area|lavoura|resultado|ensaio)\b|\b(area|lavoura) (onde|em que) (ele )?(mais perdeu|perdeu mais|foi pior)\b/.test(t)) return 'pior';
    if (/\b(perante|contra|sobre|frente|em relacao|do que|que) (a |ao |aos |os |as )?(concorr\w*|media)\b|\bmais ganhou\b|\bganhou mais\b|\b(maior|mais) (diferenca|vantagem)\b|\bmais (a frente|acima)\b/.test(t)) return 'vantagem';
    // 05/out/2026, 20:38 ("agora me traga o resultado aonde o B2815 mais produziu"): "mais produziu" também; e a maior de TODAS
    // (mesmo onde perdeu) só quando a pessoa diz isso com todas as letras
    var prod = /\b(maior|mais alta|melhor) produtividade\b|\bproduziu mais\b|\bmais produziu\b|\bmais (sacas|produtiv\w*)\b|\brendeu mais\b|\bmais rendeu\b|\bmaior (sc|saca)/.test(t);
    if (prod && /\b(de todas|mesmo onde (perdeu|ficou atras)|absolut\w*|em qualquer (area|lavoura)|mesmo perdendo)\b/.test(t)) return 'produtividade_total';
    if (prod) return 'produtividade';
    if (/\bmelhor (area|lavoura|resultado|ensaio)\b|\b(area|lavoura|resultado) (de )?(maior )?destaque\b/.test(t)) return 'destaque';
    return null;
  }
  function ordemDoTexto(t) {
    var m = /\b(primeir|segund|terceir|quart|quint)\w*\b|\b([1-5]) ?(a|o|ª|º)\b/.exec(t);
    if (!m) return 1;
    return m[1] ? ({ primeir: 1, segund: 2, terceir: 3, quart: 4, quint: 5 })[m[1]] : +m[2];
  }
  var PEDE_NO_MAPA = /\b(mostr\w*|abr\w*|coloc\w*|ve|ver|jog\w*|poe|bota|traz\w*|trag\w*|lev\w*)( (isso|ele|esses?|essas?|os|as|o))?( (resultados?|areas?|lavouras?|pontos?|numeros?))? (no|pro|para o|pra o) mapa\b/;

  /**
   * A frase vira uma ação do mapa (ou null = não é do mapa). ctx = { aberto, meuAutor }.
   * Ações: { acao: 'abrir' } · { acao: 'fechar' } · { acao: 'fechar_ficha' } · { acao: 'limpar' } ·
   *        { acao: 'filtro', filtro: {...}, geo: bool } · { acao: 'area', cidade?: 'chave|UF' } · { acao: 'proxima' | 'anterior' } ·
   *        { acao: 'sem_meus' } (pediu "meus" sem autoria na conta — falha fechada) · { acao: 'ambiguo' }
   */
  // 05/out/2026, 18:09 e 18:17 (João: "brevetec boa noite", "relevante Tech volte à página inicial"): o nome da marca do
  // jeito que o reconhecimento entrega, no COMEÇO da frase, sai antes de ler o pedido
  var NOME_DA_MARCA = /^(ok |ei |oi )?((brevant|blevante|blevant|bravante|brahma ?anti ?te(?:ch|c|k)|brevante|brevente|brevanti|brevantec|brevetec|brevetech|brevetek|brevitec|brevtec|breve tech|breve tec|breve tek|bervant|bravant|prevante|prevant|pre vant|prevent|levante|relevante|jarvis|oscar) ?)?(tech|tec|tek|teck|tequi)?\b ?/;
  function semNomeDaMarca(t) { return String(t || '').replace(NOME_DA_MARCA, '').trim(); }
  /**
   * COMANDO DE TELA (05/out/2026, 18:17–18:18: "volte à página inicial" respondeu "voltando" e não voltou; "feche todas as
   * telas" respondeu que não podia). Pura: 'inicio' (fecha tudo e volta à esfera) | 'fechar_mapa' | 'fechar_ficha' | null.
   * A página resolve na hora; o servidor (atalho) manda o mesmo comando quando a frase chega lá.
   */
  function comandoDeTela(texto) {
    var t = semNomeDaMarca(norm(texto));
    if (!t || t.split(' ').length > 9 || /^(como|por que|porque|o que|qual|quais|quanto|quando|onde)\b/.test(t)) return null;
    if (/\b(volt\w*|vai|va|ir|leva\w*|me leva)\b.{0,14}\b(pagina|tela) (inicial|principal|do comeco)\b|\b(volt\w*|vai|va)\b.{0,8}\b(ao|pro|para o|pra o) (inicio|comeco)\b/.test(t)) return 'inicio';
    if (/^(fech\w*|limp\w*|tir\w*)\b.{0,14}\b(todas|tudo)\b|^(fech\w*|limp\w*)( (a|as))? (tela|telas|janelas)( (entao|agora|por favor))?$|\b(fecha|feche|limpa|limpe) tudo\b/.test(t)) return 'inicio';
    if (/^(fech\w*|tir\w*|sai\w*)\b.{0,10}\bmapa\b/.test(t)) return 'fechar_mapa';
    if (/^(fech\w*)\b.{0,10}\b(ficha|tabela)\b/.test(t)) return 'fechar_ficha';
    return null;
  }
  // 05/out/2026, 20:36–20:45 (o João perguntou e a página "repetiu as regiões em que ele mais produziu"): a página (e o atalho do
  // servidor) só respondem sozinhos a comando de mapa INEQUÍVOCO — pergunta de "por quê", comparação, média e detalhe da área
  // aberta vão ao agente
  var NAO_E_COMANDO = /\b(por que|porque|por qual motivo|explica\w*|justifi\w*|compara\w*|comparad\w*|diferenca entre|media dessa|media da area|media do ensaio|dessa area|desta area|nessa area|ali|aquela area|mais (sobre|detalhe\w*)|detalh\w*|o que (houve|aconteceu)|posicion\w*|recomend\w*|indic\w*|qual seria|qual (hibrido|material|milho|semente)|o que plantar|se (voce|vc) fosse|resumo|apresent\w*|como (foi|ficou|se saiu)|me fala|quanto\w*)\b/;
  function interpretarFala(dados, texto, ctx) {
    ctx = ctx || {};
    var t = semNomeDaMarca(norm(texto));
    if (!t) return null;
    if (NAO_E_COMANDO.test(t) && !ABRE_MAPA.test(t)) return null;
    // o HÍBRIDO no mapa (vídeo do B2815): placar, os 3 top, onde se destacou, "mostra no mapa" — com o mapa aberto ou não.
    // O híbrido vem da fala ou do assunto da conversa (ctx.hibContexto); a geografia, da fala ou do recorte da conversa.
    // o híbrido CONTRA um concorrente ("as áreas de GD do B2815 contra o MG 540", "B2815 x AS1868 no Médio-Norte")
    if (/\b(contra|versus|vs|x|frente a frente com|lado a lado com|comparad\w* (com|ao|a)|perante)\b/.test(t)) {
      var cV = concorrenteDoTexto(dados, t);
      if (cV) {
        var hV = hibridoDoTexto(dados, t) || ctx.hibContexto || null;
        if (!hV) return { acao: 'qual_hibrido' };
        return { acao: 'versus', hib: hV, con: cV, geo: recorteDoTexto(dados, t.replace(/\b(b ?\d{4}\w*)\b/g, ' ').replace(/\b[a-z]{1,5} ?\d{2,5}\w*\b/g, ' ')) || ctx.recorteContexto || null };
      }
    }
    var crit0 = criterioDoTexto(t);
    var crit = PEDE_AREA_POR.test(t) || (/\bonde\b/.test(t) && /^produtividade/.test(crit0 || '')) ? crit0 : null;
    if (crit) {
      var hbA = hibridoDoTexto(dados, t) || ctx.hibContexto || null;
      var geoA = recorteDoTexto(dados, t.replace(/\b(b ?\d{4}\w*)\b/g, ' ')) || ctx.recorteContexto || null;
      if (!hbA) return { acao: 'qual_hibrido' };
      return { acao: 'area_por', hib: hbA, geo: geoA, criterio: crit, ordem: ordemDoTexto(t) };
    }
    var pede = PEDE_LUGARES.test(t) ? 'lugares' : PEDE_PLACAR.test(t) ? 'placar' : PEDE_TOP.test(t) ? 'top' : PEDE_NO_MAPA.test(t) ? 'no_mapa' : null;
    if (pede) {
      var hb0 = hibridoDoTexto(dados, t) || ctx.hibContexto || null;
      var geo0 = recorteDoTexto(dados, t.replace(/\b(b ?\d{4}\w*)\b/g, ' ')) || ctx.recorteContexto || null;
      if (!hb0 && pede !== 'no_mapa') return { acao: 'qual_hibrido' };
      return { acao: pede, hib: hb0, geo: geo0 };
    }
    var abre = ABRE_MAPA.test(t);
    if (!ctx.aberto && !abre) return null;
    // pergunta de verdade ("como foi o B2701 em Sorriso?") é do agente, mesmo com o mapa aberto
    if (!abre && /^(como|por que|porque|qual|quais|quanto|quantos|quantas|o que|quem|onde|quando|me (fala|explica|diz|conta)|explica|compara)\b/.test(t)) return null;
    if (ctx.aberto && /^(fecha|fechar|sai|sair|tira)( (o|do|esse|este))? mapa\b/.test(t)) return { acao: 'fechar' };
    if (ctx.aberto && /^(fecha|fechar)( (a|essa|esta))?( (ficha|tabela|area|janela))?$/.test(t)) return { acao: ctx.ficha ? 'fechar_ficha' : 'fechar' };
    if (ctx.aberto && /\b(proxim[ao]|seguinte|outra area)\b/.test(t) && !/\bmapa\b/.test(t)) return { acao: 'proxima' };
    if (ctx.aberto && /^(volta|anterior)( (uma|a anterior|area anterior))?$|\barea anterior\b/.test(t)) return { acao: 'anterior' };
    if (ctx.aberto && ctx.passeio && /^(para|pausa|espera|segura)( (ai|aqui|o passeio))?$/.test(t)) return { acao: 'pausa' };
    if (ctx.aberto && /\b(tira|limpa|remove|apaga|sem)( (o|os|esse|esses))? filtros?\b|\b(estado (todo|inteiro)|todos os (ensaios|resultados|pontos)|mapa inteiro|volta (pro|para o) estado)\b/.test(t)) return { acao: 'limpar' };
    var f = {}, geo = false, achouAlgo = false;
    if (PEDE_MEUS.test(t)) {
      if (!ctx.meuAutor) return { acao: 'sem_meus' };
      f.aut = ctx.meuAutor; achouAlgo = true;
    } else {
      var tecn = /\b(ensaios?|areas?|lavouras?|resultados?|pontos?|tecnico|representante|rep)\b/.test(t) || /\bso (os |as )?(d[aoe]s?) /.test(t) ? tecnicoDoTexto(dados, t) : null;
      if (tecn && tecn.ambiguo) return { acao: 'ambiguo' };
      if (tecn) { f.tec = tecn.c; achouAlgo = true; }
    }
    var regiaoDe = /\b(regiao|redor|entorno|em volta) (de|da|do) (.+)$/.exec(t);
    var cs = cidadesDoTexto(dados, regiaoDe ? regiaoDe[3] : t);
    if (regiaoDe && cs.length) {
      var a0 = (dados.areas || []).filter(function (a) { return norm(a.mun) === cs[0].k && a.uf === cs[0].uf; })[0];
      if (a0 && a0.mic) { f.mic = a0.mic; geo = true; achouAlgo = true; }
    } else if (cs.length > 1) { f.cids = cs.map(function (c) { return c.k + '|' + c.uf; }); f.cid = null; geo = true; achouAlgo = true; }
    else if (cs.length) { f.cid = cs[0].k + '|' + cs[0].uf; geo = true; achouAlgo = true; }
    if (!geo) {
      var mi = /micro ?r?regi/.test(t) || !cs.length ? microDoTexto(dados, t) : null;
      if (mi) { f.mic = mi; geo = true; achouAlgo = true; }
      else { var rg = regiaoDoTexto(t); if (rg) { f.reg = rg; geo = true; achouAlgo = true; } }
    }
    var hb = hibridoDoTexto(dados, t); if (hb) { f.hib = hb; achouAlgo = true; }
    var ep = /\b(plant\w*|epoca|janela|tardio|cedo)\b/.test(t) ? epocaDoTexto(t) : null; if (ep) { f.ep = ep; achouAlgo = true; }
    var pedeArea = /\babr\w*( (essa|esta|a|aquela|uma))? (area|lavoura|ensaio|resultado|ficha)\b|\b(resultado|ficha) (dessa|desta|da) (area|lavoura)\b/.test(t);
    if (ctx.aberto && pedeArea) return { acao: 'area', filtro: achouAlgo ? f : null, geo: geo };
    if (abre && !ctx.aberto) return { acao: 'abrir', filtro: achouAlgo ? f : null, geo: geo };
    if (ctx.aberto && achouAlgo && (VERBO_FILTRO.test(t) || t.split(' ').length <= 4 || (t.split(' ').length <= 6 && /\b(areas?|lavouras?|pontos?|resultados?)\b/.test(t)))) return { acao: 'filtro', filtro: f, geo: geo };
    if (abre) return { acao: 'abrir', filtro: achouAlgo ? f : null, geo: geo };
    return null;
  }

  /** As opções de cada filtro (para os seletores). A cidade e a microrregião respeitam o que já foi escolhido acima delas. */
  function opcoesDosFiltros(dados, f, op) {
    f = f || {}; op = op || {};
    var A = dados.areas || [];
    var uniq = function (arr) { var v = {}; return arr.filter(function (x) { if (!x || v[x[0]]) return false; v[x[0]] = 1; return true; }); };
    var porNome = function (p, q) { return String(p[1]).localeCompare(String(q[1]), 'pt-BR'); };
    var acima = function (campos) { var g = {}; campos.forEach(function (c) { if (f[c]) g[c] = f[c]; }); return A.filter(function (a) { return bate(a, g); }); };
    var o = {};
    if (op.representante !== false && dados.tecnicos) {
      var tec = Object.keys(dados.tecnicos).map(function (c) { return [c, dados.tecnicos[c]]; }).sort(porNome);
      if (op.meuAutor) tec.unshift(['aut:' + op.meuAutor, 'Meus ensaios']);
      o.tec = tec;
    }
    o.reg = Object.keys(dados.regioes || {}).filter(function (r) { return A.some(function (a) { return a.reg === r; }); }).map(function (r) { return [r, dados.regioes[r]]; });
    o.mic = uniq(acima(['reg', 'tec', 'aut']).map(function (a) { return [a.mic, String(a.mic).replace(/\s*\(([A-Z]{2})\)$/, ' · $1')]; })).sort(porNome);
    var cid = uniq(acima(['reg', 'mic', 'tec', 'aut']).map(function (a) { return [chaveCidade(a), a.mun + ' · ' + a.uf]; })).sort(porNome);
    o.cid = cid;
    o.hib = (dados.portfolio || []).filter(function (h) { return A.some(function (a) { return a.h.some(function (x) { return x[0] === h; }); }); }).map(function (h) { return [h, h]; });
    o.ep = Object.keys(dados.epocas || {}).map(function (e) { return [e, 'Plantio ' + dados.epocas[e]]; });
    return o;
  }

  // --------------------------------------------------------------------------------- o desenho (DOM)
  var CSS = '' +
    '.mgd{position:relative;width:100%;height:100%;display:flex;flex-direction:column;gap:calc(10px*var(--mgd-k,1));font-family:var(--mgd-fonte,"Outfit","Inter",system-ui,sans-serif);color:var(--mgd-texto,#fbfbfc);--mgd-acento:#F47C06;--mgd-acento2:#F58807;--mgd-mudo:#d9c5cb;--mgd-ponto:#fff1e2;-webkit-user-select:none;user-select:none}' +
    '.mgd-barra{flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:calc(8px*var(--mgd-k,1))}' +
    '.mgd-barra select{appearance:none;-webkit-appearance:none;background:rgba(34,3,12,.55);border:1px solid rgba(245,136,7,.35);color:var(--mgd-texto,#fbfbfc);font:600 calc(13px*var(--mgd-k,1))/1.2 var(--mgd-fonte,"Outfit",sans-serif);padding:calc(7px*var(--mgd-k,1)) calc(26px*var(--mgd-k,1)) calc(7px*var(--mgd-k,1)) calc(12px*var(--mgd-k,1));border-radius:999px;max-width:calc(230px*var(--mgd-k,1));cursor:pointer;background-image:linear-gradient(45deg,transparent 50%,#F58807 50%),linear-gradient(135deg,#F58807 50%,transparent 50%);background-position:calc(100% - 14px) 52%,calc(100% - 9px) 52%;background-size:5px 5px;background-repeat:no-repeat}' +
    '.mgd-barra select.on{border-color:transparent;background-color:rgba(244,124,6,.9);color:#3c0616}' +
    '.mgd-barra select option{color:#111;background:#fff}' +
    '.mgd-limpar{background:transparent;border:1px solid rgba(230,232,234,.35);color:var(--mgd-mudo);font:700 calc(11px*var(--mgd-k,1)) var(--mgd-fonte,"Outfit",sans-serif);letter-spacing:.12em;padding:calc(7px*var(--mgd-k,1)) calc(12px*var(--mgd-k,1));border-radius:999px;cursor:pointer;text-transform:uppercase}' +
    '.mgd-autoria{margin-left:auto;font:600 calc(12px*var(--mgd-k,1))/1.2 var(--mgd-fonte,"Outfit",sans-serif);color:#f9c48a;letter-spacing:.02em}' +
    '.mgd-palco{position:relative;flex:1;min-height:0;border-radius:calc(18px*var(--mgd-k,1));overflow:hidden;background:radial-gradient(120% 100% at 50% 40%,rgba(129,13,47,.30),rgba(30,2,10,.55));border:1px solid rgba(230,232,234,.14);box-shadow:inset 0 0 60px rgba(0,0,0,.35);touch-action:none;cursor:grab}' +
    '.mgd-palco.arrasta{cursor:grabbing}' +
    '.mgd-palco canvas.mgd-part{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:.55}' +
    '.mgd-palco svg{position:absolute;inset:0;width:100%;height:100%;display:block}' +
    '.mgd-uf{fill:rgba(230,232,234,.035);stroke:rgba(230,232,234,.42);stroke-linejoin:round}' +
    '.mgd-uf.fora{fill:none;stroke:rgba(230,232,234,.18)}' +
    '.mgd-mun{fill:transparent;stroke:rgba(230,232,234,.13);stroke-linejoin:round}' +
    '.mgd-mun.on{fill:rgba(244,124,6,.13);stroke:rgba(245,136,7,.75)}' +
    '.mgd-rot{fill:rgba(251,251,252,.62);font-family:var(--mgd-fonte,"Outfit",sans-serif);font-weight:700;letter-spacing:.06em;text-transform:uppercase;paint-order:stroke;stroke:rgba(30,2,10,.75);pointer-events:none}' +
    '.mgd-fundo circle{fill:rgba(230,232,234,.30);pointer-events:none}' +
    '.mgd-pts circle{fill:var(--mgd-ponto);stroke:rgba(244,124,6,.85);cursor:pointer;transition:opacity .35s}' +
    '.mgd-pts circle.apaga{opacity:.22}' +
    '.mgd-pts circle.some{display:none}' +
    '.mgd-pts circle.sel{fill:var(--mgd-acento);stroke:#fff}' +
    '.mgd-pts circle.frente{fill:var(--mgd-acento2);stroke:#fff1e2}' +
    '.mgd-pts circle.meio{fill:rgba(230,232,234,.55);stroke:rgba(230,232,234,.4)}' +
    '.mgd-pts circle.pulsa{animation:mgd-pulsa 1s ease-in-out infinite;stroke:#fff;stroke-width:2.5px}' +
    '@keyframes mgd-pulsa{0%,100%{stroke-opacity:1;fill-opacity:1}50%{stroke-opacity:.2;fill-opacity:.55}}' +
    '.mgd-selo-vidro{position:absolute;left:calc(14px*var(--mgd-k,1));top:calc(14px*var(--mgd-k,1));z-index:2;max-width:min(calc(440px*var(--mgd-k,1)),46%);display:none;padding:calc(14px*var(--mgd-k,1)) calc(18px*var(--mgd-k,1));border-radius:calc(16px*var(--mgd-k,1));background:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.03) 45%,rgba(60,6,22,.35));border:1px solid rgba(245,136,7,.38);box-shadow:0 14px 40px rgba(0,0,0,.4);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);font:400 calc(13px*var(--mgd-k,1))/1.35 var(--mgd-fonte,"Outfit",sans-serif);color:#f3e6ea;pointer-events:none}' +
    '.mgd-selo-vidro.ve{display:block;animation:mgd-voa .55s cubic-bezier(.2,.8,.2,1) both}' +
    '.mgd-selo-vidro h4{margin:.35em 0 .3em;font:400 calc(22px*var(--mgd-k,1))/1.05 var(--mgd-titulo,"Anton","Outfit",sans-serif);text-transform:uppercase;color:#fff}' +
    '.mgd-selo-vidro .mgd-big{display:flex;align-items:baseline;gap:.4em;margin:.35em 0 .1em}.mgd-selo-vidro .mgd-big b{font:400 calc(34px*var(--mgd-k,1))/1 var(--mgd-titulo,"Anton",sans-serif);color:var(--mgd-acento2)}' +
    '.mgd-selo-vidro .mgd-big b.cinza{color:#fff}.mgd-selo-vidro .mgd-def{margin:.15em 0 .55em;font-size:.85em;color:var(--mgd-mudo)}' +
    '.mgd-chips{display:flex;flex-direction:column;gap:6px;margin-top:.5em}.mgd-chip{display:flex;justify-content:space-between;gap:12px;border:1px solid rgba(245,136,7,.5);background:rgba(244,124,6,.12);border-radius:999px;padding:.35em .9em;font-weight:700;white-space:nowrap}.mgd-chip span{font-weight:400;color:#fbfbfc}' +
    '.mgd-legenda{display:flex;gap:14px;margin-top:.4em;font-size:.85em;color:var(--mgd-mudo)}.mgd-legenda i{display:inline-block;width:.8em;height:.8em;border-radius:50%;margin-right:.35em;vertical-align:-.05em}' +
    '.mgd-pts circle:hover{fill:var(--mgd-acento2)}' +
    '.mgd-pts{filter:drop-shadow(0 0 3px rgba(244,124,6,.55))}' +
    '.mgd-zoom{position:absolute;right:calc(12px*var(--mgd-k,1));bottom:calc(12px*var(--mgd-k,1));display:flex;flex-direction:column;gap:6px;z-index:2}' +
    '.mgd-zoom button{width:calc(34px*var(--mgd-k,1));height:calc(34px*var(--mgd-k,1));border-radius:50%;border:1px solid rgba(245,136,7,.45);background:rgba(34,3,12,.6);color:#fbfbfc;font:700 calc(17px*var(--mgd-k,1))/1 var(--mgd-fonte,"Outfit",sans-serif);cursor:pointer}' +
    '.mgd-aviso{position:absolute;left:50%;top:calc(14px*var(--mgd-k,1));transform:translateX(-50%);background:rgba(34,3,12,.75);border:1px solid rgba(245,136,7,.4);padding:calc(6px*var(--mgd-k,1)) calc(14px*var(--mgd-k,1));border-radius:999px;font:600 calc(12px*var(--mgd-k,1)) var(--mgd-fonte,"Outfit",sans-serif);opacity:0;transition:opacity .3s;pointer-events:none;z-index:2}' +
    '.mgd-aviso.ve{opacity:1}' +
    '.mgd-ficha{position:absolute;right:calc(14px*var(--mgd-k,1));top:calc(14px*var(--mgd-k,1));max-height:calc(100% - 28px*var(--mgd-k,1));box-sizing:border-box;width:min(calc(440px*var(--mgd-k,1)),62%);z-index:3;display:none;flex-direction:column;gap:calc(10px*var(--mgd-k,1));padding:calc(18px*var(--mgd-k,1)) calc(20px*var(--mgd-k,1));border-radius:calc(18px*var(--mgd-k,1));background:linear-gradient(160deg,rgba(255,255,255,.10),rgba(255,255,255,.03) 40%,rgba(60,6,22,.30));border:1px solid rgba(245,136,7,.38);box-shadow:0 18px 50px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.12);-webkit-backdrop-filter:blur(16px) saturate(1.2);backdrop-filter:blur(16px) saturate(1.2);overflow:hidden;cursor:default}' +
    '.mgd-ficha.ve{display:flex;animation:mgd-voa .55s cubic-bezier(.2,.8,.2,1) both}' +
    '@keyframes mgd-voa{from{opacity:0;transform:translate(40px,18px) scale(.94);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}' +
    '.mgd-x{position:absolute;right:calc(10px*var(--mgd-k,1));top:calc(8px*var(--mgd-k,1));background:none;border:0;color:var(--mgd-mudo);font:400 calc(26px*var(--mgd-k,1))/1 var(--mgd-fonte,"Outfit",sans-serif);cursor:pointer}' +
    '.mgd-tag{display:inline-block;background:var(--mgd-acento);color:#3c0616;font:800 calc(10px*var(--mgd-k,1))/1.2 var(--mgd-fonte,"Outfit",sans-serif);letter-spacing:.16em;text-transform:uppercase;padding:.4em .7em .32em;border-radius:3px}' +
    '.mgd-ficha h3{margin:.3em 0 .15em;font:400 calc(30px*var(--mgd-k,1))/1.05 var(--mgd-titulo,"Anton","Outfit",sans-serif);text-transform:uppercase;color:#fff}' +
    '.mgd-ficha h3 small{font-size:.5em;color:var(--mgd-mudo);margin-left:.2em}' +
    '.mgd-ficha-cab p{margin:.18em 0 0;font:400 calc(13px*var(--mgd-k,1))/1.35 var(--mgd-fonte,"Outfit",sans-serif);color:#f3e6ea}' +
    '.mgd-ficha-tab{flex:1;min-height:0;overflow:auto}' +
    '.mgd-ficha table{width:100%;border-collapse:collapse;font:400 1em/1.25 var(--mgd-fonte,"Outfit",sans-serif);font-variant-numeric:tabular-nums}' +
    '.mgd-ficha-tab{font-size:calc(15px*var(--mgd-k,1))}' +
    '.mgd-ficha th{color:var(--mgd-acento2);font:800 .66em/1.2 var(--mgd-fonte,"Outfit",sans-serif);letter-spacing:.14em;text-transform:uppercase;text-align:left;padding:0 .5em .5em}' +
    '.mgd-ficha th:last-child,.mgd-ficha td.mgd-sc{text-align:right}' +
    '.mgd-ficha td{padding:.38em .5em;border-top:1px solid rgba(230,232,234,.10)}' +
    '.mgd-ficha td.mgd-pos{color:var(--mgd-mudo);width:4.2em}' +
    '.mgd-ficha tr.mgd-brv td{background:rgba(244,124,6,.10)}' +
    '.mgd-ficha tr.mgd-brv td.mgd-hib{font-weight:700}' +
    '.mgd-selo{display:inline-block;margin-left:.4em;font:700 .66em/1 var(--mgd-fonte,"Outfit",sans-serif);color:#3c0616;background:rgba(245,136,7,.85);padding:.28em .5em .22em;border-radius:999px;vertical-align:.12em}' +
    '.mgd-ficha.mgd-c2{width:min(calc(700px*var(--mgd-k,1)),86%)}.mgd-ficha.mgd-c3{width:min(calc(940px*var(--mgd-k,1)),92%)}.mgd-ficha.mgd-c4{width:min(calc(1120px*var(--mgd-k,1)),96%)}' +
    '.mgd-cols{display:grid;gap:0 calc(18px*var(--mgd-k,1));align-items:start}' +
    '.mgd-media{flex:0 0 auto;display:flex;justify-content:space-between;align-items:baseline;gap:12px;border-top:2px solid rgba(245,136,7,.5);padding:.45em .5em 0;font:700 calc(16px*var(--mgd-k,1))/1.2 var(--mgd-fonte,"Outfit",sans-serif)}' +
    '.mgd-media small{font-weight:400;color:var(--mgd-mudo)}' +
    '.mgd-ressalva{margin:0;font:400 calc(11px*var(--mgd-k,1))/1.35 var(--mgd-fonte,"Outfit",sans-serif);color:var(--mgd-mudo)}' +
    '.mgd-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;font:600 calc(12px*var(--mgd-k,1)) var(--mgd-fonte,"Outfit",sans-serif);color:var(--mgd-mudo)}' +
    '.mgd-nav button{width:calc(32px*var(--mgd-k,1));height:calc(32px*var(--mgd-k,1));border-radius:50%;border:1px solid rgba(245,136,7,.45);background:rgba(34,3,12,.5);color:#fff;font:400 calc(20px*var(--mgd-k,1))/1 var(--mgd-fonte,"Outfit",sans-serif);cursor:pointer}' +
    '@media (prefers-reduced-motion: reduce){.mgd-ficha.ve{animation:none}.mgd-pts circle{transition:none}}';

  function instalarCss(doc) {
    if (doc.getElementById('mgd-estilo')) return;
    var s = doc.createElement('style'); s.id = 'mgd-estilo'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  var suave = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

  /**
   * Monta o mapa dentro de `el`. op = {
   *   representante: mostra o filtro de técnico (só app/Jarvis, membro da org) — padrão: se houver dados.tecnicos;
   *   meuAutor, nomeDono: "meus ensaios" (a autoria do login); filtros: false esconde a barra (apresentação);
   *   particulas: true desenha o pó de luz no fundo (o app; Jarvis e apresentação já têm o deles);
   *   zoomInicial: 'foco' = abre no estado inteiro e dá zoom nas áreas (a tela da Mocellin);
   *   aoMudar(estado), aoAbrir(area|null) }
   */
  function montar(el, dados, op) {
    op = op || {};
    var doc = el.ownerDocument || document, win = doc.defaultView || window;
    instalarCss(doc);
    var VB0 = (dados.desenho && dados.desenho.vb) || [0, 0, 1000, 1000];
    var areas = dados.areas || [];
    var porId = {}; areas.forEach(function (a) { porId[a.id] = a; });
    var filtro = op.filtroInicial || {}, aberta = null, vb = VB0.slice(), anim = 0, vivo = true;
    var mostraRep = op.representante !== false && !!dados.tecnicos;
    var CALMO = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);

    el.innerHTML = '';
    var raizEl = doc.createElement('div'); raizEl.className = 'mgd'; el.appendChild(raizEl);
    var barra = doc.createElement('div'); barra.className = 'mgd-barra'; if (op.filtros === false) barra.style.display = 'none'; raizEl.appendChild(barra);
    var palco = doc.createElement('div'); palco.className = 'mgd-palco'; raizEl.appendChild(palco);
    var part = null; if (op.particulas) { part = doc.createElement('canvas'); part.className = 'mgd-part'; palco.appendChild(part); }
    var svg = doc.createElementNS(SVGNS, 'svg'); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); palco.appendChild(svg);
    var gUf = doc.createElementNS(SVGNS, 'g'), gMun = doc.createElementNS(SVGNS, 'g'), gFundo = doc.createElementNS(SVGNS, 'g'), gRot = doc.createElementNS(SVGNS, 'g'), gPts = doc.createElementNS(SVGNS, 'g');
    gFundo.setAttribute('class', 'mgd-fundo'); gPts.setAttribute('class', 'mgd-pts');
    [gUf, gMun, gFundo, gRot, gPts].forEach(function (g) { svg.appendChild(g); });
    var zoomEl = doc.createElement('div'); zoomEl.className = 'mgd-zoom';
    zoomEl.innerHTML = '<button type="button" data-z="1" aria-label="aproximar">+</button><button type="button" data-z="-1" aria-label="afastar">−</button><button type="button" data-z="0" aria-label="estado inteiro">⤢</button>';
    palco.appendChild(zoomEl);
    var aviso = doc.createElement('div'); aviso.className = 'mgd-aviso'; palco.appendChild(aviso);
    var ficha = doc.createElement('div'); ficha.className = 'mgd-ficha'; palco.appendChild(ficha);
    var seloEl = doc.createElement('div'); seloEl.className = 'mgd-selo-vidro'; palco.appendChild(seloEl);
    var destaque = null, tour = null;

    // o contorno
    var pathsMun = [];
    ((dados.desenho || {}).ufs || []).forEach(function (u) { var p = doc.createElementNS(SVGNS, 'path'); p.setAttribute('d', u.d); p.setAttribute('class', 'mgd-uf' + (u.uf === 'MT' ? '' : ' fora')); p.setAttribute('vector-effect', 'non-scaling-stroke'); p.setAttribute('stroke-width', u.uf === 'MT' ? '1.6' : '1'); gUf.appendChild(p); });
    ((dados.desenho || {}).mun || []).forEach(function (m) { var p = doc.createElementNS(SVGNS, 'path'); p.setAttribute('d', m.d); p.setAttribute('class', 'mgd-mun'); p.setAttribute('vector-effect', 'non-scaling-stroke'); p.setAttribute('stroke-width', '0.8'); p._k = m.k + '|' + m.uf; gMun.appendChild(p); pathsMun.push(p); });
    var rotulos = ((dados.desenho || {}).rotulos || []).map(function (r) { var t = doc.createElementNS(SVGNS, 'text'); t.setAttribute('class', 'mgd-rot'); t.setAttribute('text-anchor', 'middle'); t.textContent = r.t; gRot.appendChild(t); return { el: t, r: r }; });
    var fundo = (dados.fundo || []).map(function (c) { var k = doc.createElementNS(SVGNS, 'circle'); gFundo.appendChild(k); return { el: k, x: c[0], y: c[1] }; });
    // uma bolinha por área; as da mesma célula viram um girassol (ordem do id: nada de dado no arranjo)
    var celulas = {};
    areas.slice().sort(function (p, q) { return p.id < q.id ? -1 : 1; }).forEach(function (a) { var k = a.x + ',' + a.y; (celulas[k] = celulas[k] || []).push(a); });
    var pts = [];
    Object.keys(celulas).forEach(function (k) {
      celulas[k].forEach(function (a, i) {
        var c = doc.createElementNS(SVGNS, 'circle'); c.setAttribute('data-id', a.id); c.setAttribute('vector-effect', 'non-scaling-stroke');
        gPts.appendChild(c); pts.push({ el: c, a: a, i: i, n: celulas[k].length });
      });
    });

    function tamanho() { return { w: palco.clientWidth || 800, h: palco.clientHeight || 600 }; }
    function escala() { var s = tamanho(); return Math.min(s.w / vb[2], s.h / vb[3]); }
    function desenhar() {
      svg.setAttribute('viewBox', vb.map(function (v) { return Math.round(v * 100) / 100; }).join(' '));
      var k = escala(), K = +(win.getComputedStyle ? (parseFloat(win.getComputedStyle(raizEl).getPropertyValue('--mgd-k')) || 1) : 1);
      var r = Math.max(3.2, Math.min(7.5, 4.2 * K * Math.sqrt(Math.max(1, k / 1.2)))) / k, passo = r * 2.5;
      pts.forEach(function (p) {
        var ang = p.i * 2.39996, rr = p.i ? passo * Math.sqrt(p.i) * 0.62 : 0;
        p.el.setAttribute('cx', (p.a.x + rr * Math.cos(ang)).toFixed(2)); p.el.setAttribute('cy', (p.a.y + rr * Math.sin(ang)).toFixed(2));
        p.el.setAttribute('r', (p.el.classList.contains('sel') ? r * 1.5 : r).toFixed(3)); p.el.setAttribute('stroke-width', '1');
      });
      fundo.forEach(function (f) { f.el.setAttribute('cx', f.x); f.el.setAttribute('cy', f.y); f.el.setAttribute('r', (2.2 / k).toFixed(3)); });
      // o nome das cidades só aparece de perto (no estado inteiro vira borrão)
      var perto = vb[2] < 430;
      rotulos.forEach(function (o) {
        // inteiro dentro do quadro visível (nome cortado na borda não sai)
        var s0 = tamanho(), vx = vb[0] + (vb[2] - s0.w / k) / 2, vy = vb[1] + (vb[3] - s0.h / k) / 2, vw = s0.w / k, vh = s0.h / k;
        var meia = o.r.t.length * 0.36 * 11.5 * K / k, alto = 14 * K / k;
        var dentro = perto && o.r.x - meia > vx + 4 / k && o.r.x + meia < vx + vw - 4 / k && o.r.y - alto > vy && o.r.y + alto / 3 < vy + vh;
        o.el.style.display = dentro ? '' : 'none';
        if (!dentro) return;
        o.el.setAttribute('x', o.r.x); o.el.setAttribute('y', o.r.y); o.el.setAttribute('font-size', (11.5 * K / k).toFixed(3)); o.el.setAttribute('stroke-width', (3 / k).toFixed(3));
      });
    }
    function ajustar(caixa) {
      var s = tamanho(), w = caixa[2], h = caixa[3], cx = caixa[0] + w / 2, cy = caixa[1] + h / 2;
      if (w / h < s.w / s.h) w = h * s.w / s.h; else h = w * s.h / s.w;
      return [cx - w / 2, cy - h / 2, w, h];
    }
    function irPara(alvo, ms) {
      alvo = ajustar(alvo);
      cancelAnimationFrame(anim);
      if (CALMO || !ms) { vb = alvo; desenhar(); return; }
      var de = vb.slice(), t0 = 0;
      var passo = function (t) { if (!vivo) return; if (!t0) t0 = t; var x = Math.min(1, (t - t0) / ms), e = suave(x); vb = de.map(function (v, i) { return v + (alvo[i] - v) * e; }); desenhar(); if (x < 1) anim = requestAnimationFrame(passo); };
      anim = requestAnimationFrame(passo);
    }
    function caixaDe(lista) {
      if (!lista.length) return VB0;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      lista.forEach(function (a) { x0 = Math.min(x0, a.x); y0 = Math.min(y0, a.y); x1 = Math.max(x1, a.x); y1 = Math.max(y1, a.y); });
      var w = Math.max(x1 - x0, 70), h = Math.max(y1 - y0, 70), pad = Math.max(18, 0.16 * Math.max(w, h));
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      return [cx - w / 2 - pad, cy - h / 2 - pad, w + 2 * pad, h + 2 * pad];
    }
    function avisar(txt) { aviso.textContent = txt; aviso.classList.add('ve'); clearTimeout(avisar._t); avisar._t = setTimeout(function () { aviso.classList.remove('ve'); }, 2600); }

    // ------------------------------------------------------------------ os filtros
    function lista() { return filtrar(dados, filtro); }
    function aplicar(zoom) {
      var tf = temFiltro(filtro);
      pts.forEach(function (p) {
        var ok = bate(p.a, filtro);
        // "meus ensaios": área de outro técnico SAI (autoria); o resto do filtro só esmaece
        p.el.classList.toggle('some', !!filtro.aut && p.a.aut !== filtro.aut);
        // DESTAQUE do híbrido (placar / melhores lugares): duas cores; o resto esmaece e segue clicável
        var fr = !!(destaque && destaque.frente[p.a.id]), me = !!(destaque && destaque.outras[p.a.id]);
        p.el.classList.toggle('frente', fr); p.el.classList.toggle('meio', me);
        p.el.classList.toggle('apaga', destaque ? (!fr && !me) : (tf && !ok));
      });
      pathsMun.forEach(function (p) { p.classList.toggle('on', destaque && destaque.muns ? !!destaque.muns[p._k] : (!!filtro.cid && p._k === filtro.cid)); });
      seloEl.innerHTML = destaque && destaque.selo ? destaque.selo : ''; seloEl.classList.toggle('ve', !!(destaque && destaque.selo));
      // a ficha aberta de área que saiu do mapa ("meus ensaios" tira as de outro técnico) fecha junto
      if (aberta && filtro.aut && aberta.aut !== filtro.aut) fecharFicha();
      montarBarra();
      if (zoom !== false) {
        var l = lista();
        if (tf && !l.length) avisar('Nenhuma área com esse filtro');
        irPara(tf && l.length ? caixaDe(l) : (dados.foco === 'areas' ? caixaDe(areas) : VB0), 750);
      }
      if (op.aoMudar) try { op.aoMudar(estado()); } catch (e) { /* o anfitrião cuida */ }
    }
    var NOMES = { tec: 'Representante', reg: 'Região', mic: 'Microrregião', cid: 'Cidade', hib: 'Híbrido ' + marcaDe(dados), ep: 'Época' };
    function montarBarra() {
      if (op.filtros === false) return;
      var o = opcoesDosFiltros(dados, filtro, { representante: mostraRep, meuAutor: op.meuAutor });
      var campos = (mostraRep ? ['tec'] : []).concat(['reg', 'mic', 'cid', 'hib', 'ep']);
      var html = campos.map(function (c) {
        var atual = c === 'tec' ? (filtro.aut ? 'aut:' + filtro.aut : filtro.tec || '') : (filtro[c] || '');
        return '<select data-c="' + c + '" class="' + (atual ? 'on' : '') + '" aria-label="' + NOMES[c] + '"><option value="">' + NOMES[c] + ': todas</option>' +
          (o[c] || []).map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === atual ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select>';
      }).join('');
      barra.innerHTML = html + (temFiltro(filtro) ? '<button type="button" class="mgd-limpar">Limpar</button>' : '') + '<span class="mgd-autoria">' + esc(rotuloAutoria(dados, filtro, op)) + '</span>';
    }
    barra.addEventListener('change', function (e) {
      var s = e.target; if (!s || !s.getAttribute) return;
      var c = s.getAttribute('data-c'), v = s.value || null;
      var f = {}; Object.keys(filtro).forEach(function (k) { f[k] = filtro[k]; });
      if (c === 'tec') { f.tec = null; f.aut = null; if (v && v.indexOf('aut:') === 0) f.aut = v.slice(4); else f.tec = v; }
      else f[c] = v;
      // a geografia é uma escada: escolher acima limpa o que ficou de fora embaixo
      if (c === 'reg') { if (f.mic && !areas.some(function (a) { return a.mic === f.mic && a.reg === v; })) f.mic = null; if (f.cid && !areas.some(function (a) { return chaveCidade(a) === f.cid && a.reg === v; })) f.cid = null; }
      if (c === 'mic' && f.cid && v && !areas.some(function (a) { return chaveCidade(a) === f.cid && a.mic === v; })) f.cid = null;
      filtro = f; destaque = null; pararTour(); aplicar(true);
    });
    barra.addEventListener('click', function (e) { if (e.target && e.target.classList && e.target.classList.contains('mgd-limpar')) { filtro = {}; destaque = null; pararTour(); aplicar(true); } });

    // ------------------------------------------------------------------ a ficha
    function navDe(a) {
      var l = temFiltro(filtro) ? lista() : (celulas[a.x + ',' + a.y] || [a]);
      if (l.length < 2) return null;
      l = l.slice().sort(function (p, q) { return p.mun.localeCompare(q.mun, 'pt-BR') || ordemPlantio(p) - ordemPlantio(q) || (p.id < q.id ? -1 : 1); });
      return l;
    }
    function abrir(id) {
      var a = porId[id]; if (!a) return null;
      if (filtro.aut && a.aut !== filtro.aut) return null;          // "meus ensaios": a de outro técnico não abre
      aberta = a;
      pts.forEach(function (p) { p.el.classList.toggle('sel', p.a === a); });
      var nl = navDe(a), i = nl ? nl.indexOf(a) : -1, ti = tour ? tour.ids.indexOf(a.id) : -1;
      ficha.className = 'mgd-ficha mgd-c' + colunasDaFicha((a.h || []).length);
      ficha.innerHTML = fichaHTML(dados, a, { nav: ti >= 0 && tour.ids.length > 1 ? (ti + 1) + ' de ' + tour.ids.length + ' destaques' : nl ? (i + 1) + ' de ' + nl.length + (temFiltro(filtro) ? ' no filtro' : ' neste ponto') : null });
      ficha.classList.remove('ve'); void ficha.offsetWidth; ficha.classList.add('ve');
      // o ranking inteiro cabe na ficha (na apresentação não há rolagem): a letra da tabela encolhe até 55 %
      var caixa = ficha.querySelector('.mgd-ficha-tab');
      var cols = caixa && caixa.querySelector('.mgd-cols');
      for (var z = 1, g = 0; cols && g < 7 && caixa.scrollHeight > caixa.clientHeight + 1; g++) { z *= 0.92; cols.style.fontSize = (z * 100).toFixed(1) + '%'; }
      desenhar();
      if (op.aoAbrir) try { op.aoAbrir(a); } catch (e) { /* idem */ }
      return a;
    }
    function fecharFicha() { aberta = null; ficha.classList.remove('ve'); pts.forEach(function (p) { p.el.classList.remove('sel'); }); desenhar(); if (op.aoAbrir) try { op.aoAbrir(null); } catch (e) { /* idem */ } }
    function andar(d) {
      if (tour) return tour.ir(Math.max(0, tour.i + d));
      if (!aberta) { var l0 = lista().length ? lista() : areas; return l0.length ? abrir(l0.slice().sort(function (p, q) { return ordemPlantio(p) - ordemPlantio(q); })[0].id) : null; }
      var nl = navDe(aberta); if (!nl) return aberta;
      var i = nl.indexOf(aberta); return abrir(nl[(i + d + nl.length) % nl.length].id);
    }
    ficha.addEventListener('click', function (e) {
      e.stopPropagation();
      var c = e.target && e.target.classList;
      if (!c) return;
      if (c.contains('mgd-x')) fecharFicha(); else if (c.contains('mgd-prox')) andar(1); else if (c.contains('mgd-ant')) andar(-1);
    });

    // ------------------------------------------------------------------ mouse/toque: clique abre; arrastar move; roda aproxima
    var arr = null, moveu = false;
    palco.addEventListener('pointerdown', function (e) {
      if (ficha.contains(e.target) || zoomEl.contains(e.target)) return;
      arr = { x: e.clientX, y: e.clientY, vb: vb.slice(), k: escala() * (palco.getBoundingClientRect().width / (palco.clientWidth || 1)) }; moveu = false;
    });
    win.addEventListener('pointermove', function (e) {
      if (!arr) return;
      var dx = e.clientX - arr.x, dy = e.clientY - arr.y;
      if (!moveu && Math.hypot(dx, dy) < 5) return;
      moveu = true; palco.classList.add('arrasta'); cancelAnimationFrame(anim);
      vb = [arr.vb[0] - dx / arr.k, arr.vb[1] - dy / arr.k, arr.vb[2], arr.vb[3]]; desenhar();
    });
    win.addEventListener('pointerup', function () { if (arr) { palco.classList.remove('arrasta'); setTimeout(function () { arr = null; }, 0); } });
    // o clique é do mapa: não passa para quem está em volta (na apresentação o clique solto avança a tela)
    ['click', 'mousedown', 'pointerdown', 'contextmenu', 'wheel'].forEach(function (ev) { raizEl.addEventListener(ev, function (e) { e.stopPropagation(); }, ev === 'wheel' ? { passive: false } : false); });
    palco.addEventListener('click', function (e) {
      if (moveu) { moveu = false; return; }
      var id = e.target && e.target.getAttribute && e.target.getAttribute('data-id');
      if (id) abrir(id); else if (!ficha.contains(e.target) && !zoomEl.contains(e.target) && aberta) fecharFicha();
    });
    function zoomEm(fator, px, py) {
      var s = tamanho(), k = escala(), ox = vb[0] + (vb[2] - s.w / k) / 2, oy = vb[1] + (vb[3] - s.h / k) / 2;
      var mx = ox + (px == null ? s.w / 2 : px) / k, my = oy + (py == null ? s.h / 2 : py) / k;
      var w = Math.max(25, Math.min(VB0[2] * 1.6, vb[2] / fator)), h = vb[3] * w / vb[2];
      cancelAnimationFrame(anim);
      vb = [mx - (mx - vb[0]) * w / vb[2], my - (my - vb[1]) * h / vb[3], w, h]; desenhar();
    }
    palco.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = palco.getBoundingClientRect(), esc2 = r.width / (palco.clientWidth || 1);
      zoomEm(e.deltaY < 0 ? 1.18 : 1 / 1.18, (e.clientX - r.left) / esc2, (e.clientY - r.top) / esc2);
    }, { passive: false });
    zoomEl.addEventListener('click', function (e) {
      e.stopPropagation();
      var z = e.target && e.target.getAttribute && e.target.getAttribute('data-z'); if (z == null) return;
      if (z === '0') irPara(VB0, 650); else zoomEm(z === '1' ? 1.5 : 1 / 1.5);
    });

    // ------------------------------------------------------------------ pó de luz (só onde o anfitrião não tem partículas)
    if (part) {
      var ctx = part.getContext('2d'), grao = [];
      for (var g = 0; g < 70; g++) grao.push({ x: Math.random(), y: Math.random(), v: 0.00008 + Math.random() * 0.00022, r: 0.6 + Math.random() * 1.6, f: Math.random() * 6.28 });
      var girar = function (t) {
        if (!vivo) return;
        var w = part.width = palco.clientWidth, h = part.height = palco.clientHeight;
        ctx.clearRect(0, 0, w, h);
        grao.forEach(function (q) { q.y -= q.v * (CALMO ? 0 : 16); if (q.y < -0.02) q.y = 1.02; var a = 0.25 + 0.35 * Math.sin(t / 900 + q.f); ctx.fillStyle = 'rgba(245,136,7,' + a.toFixed(3) + ')'; ctx.beginPath(); ctx.arc(q.x * w, q.y * h, q.r, 0, 6.283); ctx.fill(); });
        if (!CALMO) requestAnimationFrame(girar);
      };
      requestAnimationFrame(girar);
    }

    // ------------------------------------------------------------------ começo
    var aoRedimensionar = function () { if (vivo) desenhar(); };
    win.addEventListener('resize', aoRedimensionar);
    vb = ajustar(VB0); desenhar();
    if (temFiltro(filtro)) aplicar(true);
    else { montarBarra(); if (op.zoomInicial === 'foco' || dados.foco === 'areas') setTimeout(function () { if (vivo) irPara(caixaDe(areas), 1400); }, op.atrasoZoom == null ? 900 : op.atrasoZoom); }

    // ------------------------------------------------------------------ DESTAQUE e PASSEIO (o híbrido no mapa)
    /** d = { filtro (a geografia + hib), frente: [ids], outras: [ids], muns: [chave|UF], selo: html, zoom: [ids] } */
    function destacar(d) {
      pararTour();
      var idx = function (l) { var o = {}; (l || []).forEach(function (k) { o[k] = 1; }); return o; };
      filtro = d.filtro || {};
      destaque = { frente: idx(d.frente), outras: idx(d.outras), muns: d.muns ? idx(d.muns) : null, selo: d.selo || '' };
      aplicar(false);
      var alvo = (d.zoom || []).map(function (i) { return porId[i]; }).filter(Boolean);
      irPara(alvo.length ? caixaDe(alvo) : (lista().length ? caixaDe(lista()) : VB0), 900);
    }
    function pulsar(id) { pts.forEach(function (p) { p.el.classList.toggle('pulsa', p.a.id === id); }); }
    function pararTour() { if (tour) { clearTimeout(tour.t); tour = null; pts.forEach(function (p) { p.el.classList.remove('pulsa'); }); } }
    /** O passeio: voa até cada área, pulsa a bolinha, abre a ficha; aoPasso(i, area) fala; espera(i) diz quando seguir. */
    function passear(ids, o) {
      pararTour(); o = o || {};
      var t = { ids: ids.filter(function (i) { return porId[i]; }), i: -1, t: 0, o: o };
      tour = t;
      var ir = function (i, auto) {
        if (tour !== t || i < 0 || i >= t.ids.length) { if (tour === t && i >= t.ids.length && o.aoFim) o.aoFim(); return null; }
        clearTimeout(t.t); t.i = i;
        var a = porId[t.ids[i]];
        // a câmera põe a bolinha no terço da esquerda: a ficha abre à direita e não cobre o ponto
        var cx = caixaDe([a]); cx[0] += cx[2] * 0.26;
        fecharFicha(); irPara(cx, CALMO ? 0 : 1100); pulsar(a.id);
        setTimeout(function () { if (tour !== t || t.i !== i) return; abrir(a.id); pulsar(a.id); if (o.aoPasso) o.aoPasso(i, a, t.ids.length); }, CALMO ? 0 : 1150);
        if (auto !== false) t.t = setTimeout(function seguir() { if (tour !== t) return; if (o.ocupado && o.ocupado()) { t.t = setTimeout(seguir, 500); return; } ir(i + 1); }, (o.ms || 7000) + 1150);
        return a;
      };
      t.ir = ir; ir(0);
      return t.ids.length;
    }

    function estado() {
      return { filtro: JSON.parse(JSON.stringify(filtro)), aberta: aberta ? aberta.id : null, areasNoFiltro: lista().length, rotulo: rotuloAutoria(dados, filtro, op) };
    }
    return {
      estado: estado,
      /** Junta ao filtro atual (geo=true troca a geografia inteira: cidade, micro e região). null num campo tira o campo. */
      filtrar: function (f, geo) {
        var n = {}; Object.keys(filtro).forEach(function (k) { n[k] = filtro[k]; });
        if (geo) { n.cid = null; n.cids = null; n.mic = null; n.reg = null; }
        if (f && (f.tec || f.aut)) { n.tec = null; n.aut = null; }
        Object.keys(f || {}).forEach(function (k) { n[k] = f[k]; });
        filtro = n; destaque = null; pararTour(); aplicar(true); return lista().length;
      },
      limpar: function () { filtro = {}; destaque = null; pararTour(); aplicar(true); },
      abrir: abrir,
      /** Abre a 1ª área (por plantio) do que bate com f — ou do filtro atual. */
      abrirPrimeira: function (f) { var l = f ? filtrar(dados, f) : lista(); if (filtro.aut) l = l.filter(function (a) { return a.aut === filtro.aut; }); if (!l.length) return null; return abrir(l.slice().sort(function (p, q) { return ordemPlantio(p) - ordemPlantio(q) || (p.id < q.id ? -1 : 1); })[0].id); },
      proxima: function () { return tour ? tour.ir(tour.i + 1) : andar(1); }, anterior: function () { return tour ? tour.ir(Math.max(0, tour.i - 1)) : andar(-1); },
      destacar: destacar, passear: passear, pararTour: pararTour, emPasseio: function () { return !!tour; },
      /** 05/out/2026 (a "caixa do momento"): centraliza nas áreas citadas agora e pulsa as bolinhas delas (sem abrir ficha) */
      focar: function (ids) {
        var alvo = (ids || []).map(function (i) { return porId[i]; }).filter(Boolean);
        if (!alvo.length || tour) return;
        irPara(caixaDe(alvo), CALMO ? 0 : 800);
        var k = {}; alvo.forEach(function (a) { k[a.id] = 1; });
        pts.forEach(function (p) { p.el.classList.toggle('pulsa', !!k[p.a.id]); });
      },
      segurar: function () { if (tour) clearTimeout(tour.t); },
      fecharFicha: fecharFicha,
      aberta: function () { return aberta; },
      destruir: function () { vivo = false; cancelAnimationFrame(anim); win.removeEventListener('resize', aoRedimensionar); el.innerHTML = ''; },
      redesenhar: desenhar,
    };
  }

  return {
    versao: 1, ROTULO_REDE: ROTULO_REDE,
    norm: norm, bate: bate, filtrar: filtrar, ranking: ranking, mediaDoEnsaio: mediaDoEnsaio, rotuloAutoria: rotuloAutoria,
    fichaHTML: fichaHTML, colunasDaFicha: colunasDaFicha, interpretarFala: interpretarFala, opcoesDosFiltros: opcoesDosFiltros, montar: montar,
    lavourasDoHibrido: lavourasDoHibrido, placarDoHibrido: placarDoHibrido, topDoHibrido: topDoHibrido, melhoresLugares: melhoresLugares,
    comandoDeTela: comandoDeTela, semNomeDaMarca: semNomeDaMarca, porCidade: porCidade, fraseDoPlacar: fraseDoPlacar, resumoDeRepeticao: resumoDeRepeticao,
    concorrenteDoTexto: concorrenteDoTexto, versusDoHibrido: versusDoHibrido, fraseDoVersus: fraseDoVersus,
    areaPor: areaPor, CRITERIOS_AREA: CRITERIOS_AREA, hibridoDoTexto: hibridoDoTexto, criterioDoTexto: criterioDoTexto, ordemDoTexto: ordemDoTexto,
    fraseDaAreaDoHibrido: fraseDaAreaDoHibrido, fraseDosLugares: fraseDosLugares, fraseDoDestaque: fraseDoDestaque, ondeFalado: ondeFalado, curtoHib: curtoHib, dataFalada: dataFalada,
    CRITERIO_TOP: CRITERIO_TOP, CRITERIO_LUGARES: CRITERIO_LUGARES, recorteDoTexto: recorteDoTexto,
  };
});
