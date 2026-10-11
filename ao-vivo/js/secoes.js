// OSCARPES AO VIVO — secoes.js
// O DESENHO DE CADA SEÇÃO do modo fazenda (resumo em mosaico, talhões, fertilidade, monitoramento,
// aplicações, clima, estoque, laboratório, financeiro e a VISTA DO TALHÃO) e os desenhos pequenos
// (mapa de calor, contornos dos talhões e das fazendas, chuva, linha das aplicações).
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import {
  acaoEvol, chaveTalhao, contasDoEscopo, diasEntre, doEscopo, dossieTalhao, mesmaFazenda, mostrarSecao,
  romanoNorm, somaDias, talhaoDoDossie,
} from './fazenda.js?v=20261010213811';
import { DEMO, ROTA_VOZ, dataBR, esc, num, reais } from './base.js?v=20261010213811';
import { CELULAR } from './cena.js?v=20261010213811';
import { perguntar } from './ouvido.js?v=20261010213811';
import { token } from './servidor.js?v=20261010213811';
import { GB, K, NT, T, X, dossie, dossieFazenda, dossieSecao } from './telas.js?v=20261010213811';
import { normTela } from './comandos.js?v=20261010213811';
import { DESENHOS } from './desenhos.js?v=20261010213811';
import { agruparMapas, corpoDeCamadas, mapasRecebidos } from './mapas.js?v=20261010213811';
import {
  ESTADIOS, blocosDaEvolucao, culturaDe, estadioNoDia, plantinha, talhoesDaEvolucao,
} from './evolucao.js?v=20261010213811';
import { evolFertDemo, mapaDemoQuadrado } from './demo.js?v=20261010213811';

// ---- cores e pequenos desenhos ----------------------------------------------
/** posição dentro do grupo (0 = o menor, 1 = o maior) → cor da escala da marca (vermelho-ouro-verde) */
function corDaPosicao(t) {
  if (t == null || !isFinite(t)) return 'rgba(196,202,60,.06)';
  const p = [[0, [214, 74, 52]], [0.5, [233, 190, 70]], [1, [120, 176, 60]]];
  for (let i = 1; i < p.length; i++) if (t <= p[i][0]) { const [a, ca] = p[i - 1], [b, cb] = p[i], f = (t - a) / (b - a); return `rgba(${ca.map((q, k) => Math.round(q + (cb[k] - q) * f)).join(',')},.78)`; }
  return 'rgba(120,176,60,.78)';
}
function posicoes(valores) {
  const v = valores.filter((x) => x != null && isFinite(x)).sort((a, b) => a - b);
  return (x) => { if (x == null || !isFinite(x) || v.length < 2) return null; let k = 0; while (k < v.length && v[k] < x) k++; return k / (v.length - 1); };
}
const NUTRIENTES = [['ph', 'pH', 2], ['v', 'V%', 0], ['p', 'P', 1], ['k', 'K', 2], ['mo', 'MO', 1]];
/** O "calor" da fertilidade: talhão × nutriente, cor = posição dentro do escopo (do menor ao maior). */
function htmlCalor(linhas, teto) {
  const ls = linhas.slice(0, teto);
  const pos = NUTRIENTES.map(([k]) => posicoes(linhas.map((l) => l[k])));
  const varias = new Set(linhas.map((l) => romanoNorm(l.fazenda))).size > 1;
  return `<div class="calor" style="grid-template-columns:minmax(0,1.6fr) repeat(${NUTRIENTES.length},minmax(0,1fr))"><div class="h"></div>${NUTRIENTES.map(([, r]) => `<div class="h">${r}</div>`).join('')}` +
    ls.map((l) => `<div class="t" title="${esc(l.fazenda + ' · ' + l.talhao + (l.ano ? ' · ' + l.ano : '') + (l.profundidade ? ' · ' + l.profundidade : ''))}">${esc((varias ? l.fazenda.replace(/^fazenda /i, '').slice(0, 10) + ' · ' : '') + l.talhao)}${l.ano ? ` <small style="color:var(--mudo)">${l.ano}</small>` : ''}</div>` +
      NUTRIENTES.map(([k, , c], j) => `<div style="background:${corDaPosicao(pos[j](l[k]))};text-align:center" title="${esc(l.talhao)}: ${k} ${num(l[k], c)}">${num(l[k], c)}</div>`).join('')).join('') + '</div>' +
    (linhas.length > ls.length ? `<div class="nota">+${linhas.length - ls.length} talhões — abra Fertilidade</div>` : '');
}
function htmlBarrinhas(itens, teto = 6) {
  const max = Math.max(1, ...itens.map((i) => i.n));
  return `<div class="barrinhas">${itens.slice(0, teto).map((i) => `<div class="nome" title="${esc(i.nome)}">${esc(i.nome)}</div><div class="b"><i style="width:${(i.n / max) * 100}%"></i></div><div class="n">${esc(i.rot ?? i.n)}</div>`).join('')}</div>`;
}
/** projeção local simples (lon·cos lat, lat) dos contornos [lat, lon] → caixa */
function projetar(talhoes) {
  const pts = talhoes.flatMap((t) => t.contorno || []);
  if (!pts.length) return null;
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length, kx = Math.cos(lat0 * Math.PI / 180);
  const xs = pts.map((p) => p[1] * kx), ys = pts.map((p) => -p[0]);
  return { kx, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
/** Talhões de UMA fazenda desenhados (a fazenda inteira); cor por função. */
function svgTalhoes(talhoes, cor, opcoes = {}) {
  const P = projetar(talhoes);
  if (!P) return `<div class="nota">Os talhões ${opcoes.nome ? 'da ' + esc(opcoes.nome) + ' ' : ''}ainda não têm contorno desenhado.</div>`;
  const W = 1000, H = Math.max(260, Math.min(1000, W * (P.y1 - P.y0) / Math.max(1e-9, P.x1 - P.x0)));
  const s = Math.min((W - 20) / Math.max(1e-9, P.x1 - P.x0), (H - 20) / Math.max(1e-9, P.y1 - P.y0));
  const ox = (W - (P.x1 - P.x0) * s) / 2, oy = (H - (P.y1 - P.y0) * s) / 2;
  const X = (p) => (ox + (p[1] * P.kx - P.x0) * s).toFixed(1), Y = (p) => (oy + (-p[0] - P.y0) * s).toFixed(1);
  const polis = talhoes.filter((t) => t.contorno).map((t) => {
    const c = t.contorno, cx = c.reduce((a, p) => a + +X(p), 0) / c.length, cy = c.reduce((a, p) => a + +Y(p), 0) / c.length;
    const k = cor(t);
    return `<polygon data-talhao="${esc(t.talhao)}" data-fazenda="${esc(t.fazenda || '')}" style="cursor:pointer" points="${c.map((p) => X(p) + ',' + Y(p)).join(' ')}" fill="${k.fill}" stroke="${k.stroke || 'rgba(241,233,196,.7)'}" stroke-width="${k.sw || 1.6}"><title>${esc(t.talhao)}${t.area_ha ? ' · ' + num(t.area_ha, 0) + ' ha' : ''}${k.tit ? ' · ' + esc(k.tit) : ''}</title></polygon>` +
      (opcoes.nomes ? `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" fill="#f1e9c4" font-size="${opcoes.fonte || 18}" font-weight="700" text-anchor="middle" dominant-baseline="middle" style="paint-order:stroke" stroke="rgba(11,17,2,.75)" stroke-width="4">${esc(t.talhao)}</text>` : '');
  }).join('');
  return `<svg class="mini" viewBox="0 0 ${W} ${Math.round(H)}" preserveAspectRatio="xMidYMid meet">${polis}</svg>`;
}
/** O grupo: uma miniatura por fazenda (cada uma na escala dela), com nome e área. */
function svgFazendas(fazendas, talhoes, cor) {
  const n = fazendas.length, cols = CELULAR() ? Math.min(n, 2) : Math.min(n, n <= 3 ? n : n <= 6 ? 3 : 4), linhas = Math.ceil(n / cols);
  const W = 1000, CW = W / cols, CH = 300, H = CH * linhas;
  const cel = fazendas.map((f, i) => {
    const ts = talhoes.filter((t) => mesmaFazenda(t.fazenda, f.fazenda) && t.contorno);
    const x0 = (i % cols) * CW, y0 = Math.floor(i / cols) * CH, P = projetar(ts);
    let corpo = `<text x="${x0 + CW / 2}" y="${y0 + CH / 2 - 10}" fill="#b3a97a" font-size="20" text-anchor="middle">sem contorno</text>`;
    if (P) {
      const s = Math.min((CW - 40) / Math.max(1e-9, P.x1 - P.x0), (CH - 90) / Math.max(1e-9, P.y1 - P.y0));
      const ox = x0 + (CW - (P.x1 - P.x0) * s) / 2, oy = y0 + 10 + (CH - 80 - (P.y1 - P.y0) * s) / 2;
      corpo = ts.map((t) => { const k = cor(t); return `<polygon data-talhao="${esc(t.talhao)}" data-fazenda="${esc(t.fazenda || '')}" points="${t.contorno.map((p) => (ox + (p[1] * P.kx - P.x0) * s).toFixed(1) + ',' + (oy + (-p[0] - P.y0) * s).toFixed(1)).join(' ')}" fill="${k.fill}" stroke="${k.stroke || 'rgba(241,233,196,.6)'}" stroke-width="1.2"><title>${esc(f.fazenda + ' · ' + t.talhao)}</title></polygon>`; }).join('');
    }
    return `<g class="faz" data-fazenda="${esc(f.fazenda)}" style="cursor:pointer">${corpo}<text x="${x0 + CW / 2}" y="${y0 + CH - 42}" fill="#f1e9c4" font-size="24" font-weight="700" text-anchor="middle">${esc(f.fazenda)}</text>` +
      `<text x="${x0 + CW / 2}" y="${y0 + CH - 16}" fill="#b3a97a" font-size="18" text-anchor="middle" font-family="Menlo,monospace">${num(f.area_ha, 0)} ha · ${f.talhoes} talhões</text></g>`;
  }).join('');
  return `<svg class="mini" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${cel}</svg>`;
}
/** A cor do talhão no mapa do resumo: aplicação nos últimos 30 dias (ouro), com análise (verde), sem (cinza). */
function corDoTalhaoResumo() {
  const hoje = dossie.hoje;
  const recentes = new Set(dossie.aplicacoes.filter((a) => a.situacao === 'executada' && a.dia && diasEntre(a.dia, hoje) <= 30 && diasEntre(a.dia, hoje) >= 0).map((a) => romanoNorm(a.fazenda) + '|' + normTela(a.talhao)));
  return (t) => recentes.has(romanoNorm(t.fazenda) + '|' + normTela(t.talhao))
    ? { fill: 'rgba(249,163,34,.42)', stroke: '#f9a322', sw: 2.4, tit: 'aplicação nos últimos 30 dias' }
    : t.tem_analise ? { fill: 'rgba(162,167,42,.38)', tit: 'com análise' } : { fill: 'rgba(179,169,122,.12)', tit: 'sem análise' };
}
const LEGENDA_MAPA = '<div class="legenda-cor"><span><b style="background:rgba(162,167,42,.6)"></b>com análise</span><span><b style="background:rgba(179,169,122,.25)"></b>sem análise</span><span><b style="background:rgba(249,163,34,.6)"></b>aplicação ≤ 30 dias</span></div>';

/** Barras pequenas de chuva (sparkline) — dias [{dia:'dd/mm', mm}] */
function svgChuva(dias, altura = 120) {
  const vs = dias.map((d) => d.mm || 0), max = Math.max(5, ...vs), W = 600, H = altura, bw = W / Math.max(1, dias.length);
  return `<svg class="mini" viewBox="0 0 ${W} ${H + 18}" preserveAspectRatio="none">` + dias.map((d, i) => { const h = (vs[i] / max) * (H - 14);
    return `<rect x="${(i * bw + bw * 0.15).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${Math.max(h, vs[i] > 0 ? 2 : 0).toFixed(1)}" rx="2" fill="${d.mm == null ? 'rgba(179,169,122,.2)' : '#c4ca3c'}" opacity=".85"><title>${esc(d.dia)}: ${d.mm == null ? 'sem dado' : num(d.mm) + ' mm'}</title></rect>`; }).join('') +
    `<line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="rgba(196,202,60,.35)"/><text x="0" y="${H + 15}" fill="#b3a97a" font-size="13" font-family="Menlo,monospace">${esc((dias[0] || {}).dia || '')}</text><text x="${W}" y="${H + 15}" fill="#b3a97a" font-size="13" text-anchor="end" font-family="Menlo,monospace">${esc((dias[dias.length - 1] || {}).dia || '')}</text></svg>`;
}
/** Linha do tempo das aplicações (−60 a +30 dias): executadas cheias, planejadas vazadas, hoje marcado. */
function svgLinhaAplicacoes(aps, hoje, largo = false) {
  const ini = somaDias(hoje, -60), fim = somaDias(hoje, 30), W = 1000, H = largo ? 380 : 130, total = diasEntre(ini, fim), k = largo ? 1.8 : 1;
  const yFeita = largo ? H * 0.62 : H - 62, yPlano = largo ? H * 0.3 : H - 92;
  const X = (iso) => 90 + (diasEntre(ini, iso) / total) * (W - 120);
  const dentro = aps.filter((a) => a.dia && a.dia >= ini && a.dia <= fim);
  // um marcador por dia e situação, com o número de talhões dentro (9 talhões no mesmo dia não viram uma torre)
  const grupos = new Map();
  for (const a of dentro) { const k = a.dia + '|' + (a.situacao === 'executada' ? 'e' : 'p'); const g = grupos.get(k) || { dia: a.dia, ex: a.situacao === 'executada', itens: [] }; g.itens.push(a); grupos.set(k, g); }
  const pts = [...grupos.values()].map((g) => { const y = g.ex ? yFeita : yPlano, r = k * Math.min(15, 6.5 + Math.sqrt(g.itens.length) * 2.4);
    const prods = [...new Set(g.itens.flatMap((a) => a.produtos.map((p) => p.produto)))].slice(0, 4).join(', ');
    return `<g><title>${esc(dataBR(g.dia))} · ${g.itens.length} talhão(ões) · ${esc(prods || g.itens[0].tipo)} (${g.ex ? 'feita' : 'planejada'})</title><circle cx="${X(g.dia).toFixed(1)}" cy="${y}" r="${r.toFixed(1)}" fill="${g.ex ? '#f9a322' : 'rgba(11,17,2,.6)'}" stroke="${g.ex ? '#f9a322' : '#c4ca3c'}" stroke-width="2" ${g.ex ? '' : 'stroke-dasharray="3 2"'}/>` +
      (g.itens.length > 1 ? `<text x="${X(g.dia).toFixed(1)}" y="${y + 4.5 * k}" fill="${g.ex ? '#1b2704' : '#f1e9c4'}" font-size="${13 * k}" font-weight="700" text-anchor="middle">${g.itens.length}</text>` : '') + '</g>'; }).join('');
  const marcas = [-60, -30, 0, 30].map((d) => { const iso = somaDias(hoje, d); return `<line x1="${X(iso)}" x2="${X(iso)}" y1="${H - 30}" y2="${H - 24}" stroke="rgba(196,202,60,.4)"/><text x="${X(iso)}" y="${H - 8}" fill="#b3a97a" font-size="${largo ? 15 : 17}" text-anchor="middle" font-family="Menlo,monospace">${d === 0 ? 'HOJE' : dataBR(iso)}</text>`; }).join('');
  return `<svg class="mini" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><text x="30" y="${yFeita + 4}" fill="#b3a97a" font-size="${12 * k}" font-family="Menlo,monospace">feitas</text><text x="30" y="${yPlano + 4}" fill="#b3a97a" font-size="${12 * k}" font-family="Menlo,monospace">plano</text><line x1="30" x2="${W - 30}" y1="${H - 30}" y2="${H - 30}" stroke="rgba(196,202,60,.35)"/>` +
    `<line x1="${X(hoje)}" x2="${X(hoje)}" y1="6" y2="${H - 30}" stroke="#f9a322" stroke-dasharray="4 4" opacity=".7"/>${marcas}${pts}</svg>`;
}
function produtosMaisUsados(aps) {
  const m = new Map();
  for (const a of aps) for (const p of a.produtos || []) { const k = p.produto; const g = m.get(k) || { nome: k, n: 0, ult: '' }; g.n++; if ((a.dia || '') > g.ult) g.ult = a.dia || ''; m.set(k, g); }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

// ---- AS SEÇÕES ---------------------------------------------------------------
// ladrilho: forma {w, h, alt:[[w,h]…]} (colunas × linhas do mosaico) — o encaixe
// tenta a forma preferida e, sem lugar, as menores; secaoAlvo = o clique abre a seção.
const ladrilho = (secaoAlvo, w, h, alt, c) => ({ ...c, forma: { w, h, alt }, secaoAlvo });
const DESENHOS_SECAO = {
  resumo() {
    const D = dossie, c = contasDoEscopo(), t = [];
    const varias = !dossieFazenda && D.fazendas.length > 1;
    t.push(ladrilho('talhoes', 2, 1, [[1, 1]], { rotulo: dossieFazenda ? 'Fazenda' : varias ? 'Grupo' : 'Fazenda', titulo: dossieFazenda || (varias ? D.cliente : D.fazenda || D.cliente),
      blocos: [K([varias ? [c.fazendas, 'fazendas'] : null, [num(c.area, 0) + ' ha', 'área'], [c.talhoes, 'talhões'], [`${c.comAnalise}`, 'com análise'],
        [c.executadas, 'aplicações feitas'], [c.planejadas, 'planejadas'], [c.chuva7 == null ? '—' : num(c.chuva7, 0) + ' mm', 'chuva 7 dias'], [c.zerados, 'estoque zerado']])] }));
    t.push(ladrilho('talhoes', 2, 2, [[2, 1], [1, 1]], { rotulo: varias ? 'As fazendas' : 'A fazenda inteira', titulo: varias ? `${c.fazendas} fazendas · ${num(c.area, 0)} ha` : `${c.talhoes} talhões · ${num(c.area, 0)} ha`,
      blocos: [X((varias ? svgFazendas(c.faz, c.ts, corDoTalhaoResumo()) : svgTalhoes(c.ts, corDoTalhaoResumo(), { nomes: c.ts.length <= 45, fonte: c.ts.length > 20 ? 14 : 20 })) + LEGENDA_MAPA)], mapaGrupo: varias }));
    const atencao = [...doEscopo(D.monitoramento.abertas_lista || []).map((v) => `Visita aberta na ${v.fazenda}${v.talhao ? ' · ' + v.talhao : ''} desde ${dataBR(v.desde)}`),
      ...(c.zerados ? [`${c.zerados} produto${c.zerados > 1 ? 's' : ''} zerado${c.zerados > 1 ? 's' : ''} no estoque`] : []),
      ...(D.pede_atencao || []).filter((x) => !dossieFazenda || normTela(x).includes(romanoNorm(dossieFazenda).split(' ')[0]) || !D.fazendas.some((f) => normTela(x).includes(normTela(f.fazenda)))),
      ...(!c.comPlantio && c.talhoes ? ['Plantio não cadastrado nos talhões'] : [])];
    t.push(ladrilho('monitoramento', 1, 1, [], { rotulo: 'Pede atenção', titulo: atencao.length ? `${atencao.length} ponto${atencao.length > 1 ? 's' : ''}` : 'Tudo em dia',
      blocos: [X((D.frase && !dossieFazenda ? `<div class="nota" style="margin:0 0 .4em">${esc(D.frase)}</div>` : '') + `<ul class="lista-curta">${(atencao.length ? atencao : ['Nada pendente no que foi lançado.']).slice(0, 6).map((a) => `<li class="${atencao.length ? '' : 'ok'}">${esc(a)}</li>`).join('')}</ul>`)] }));
    if (c.fert.length) t.push(ladrilho('fertilidade', 2, 1, [[1, 1]], { rotulo: 'Fertilidade · última análise de cada talhão (ano na linha, camada 0-20)', titulo: `${c.fert.length} talhões · ${c.comAnalise}/${c.talhoes} com análise`,
      blocos: [X(htmlCalor(c.fert, 9) + '<div class="legenda-cor"><span><b style="background:rgba(214,74,52,.78)"></b>menor do escopo</span><span><b style="background:rgba(120,176,60,.78)"></b>maior</span></div>')] }));
    t.push(ladrilho('aplicacoes', 2, 1, [[1, 1]], { rotulo: 'Aplicações · 60 dias para trás, 30 à frente', titulo: `${c.executadas} feitas · ${c.planejadas} planejadas`,
      blocos: [X(svgLinhaAplicacoes(c.aps, D.hoje) + htmlBarrinhas(produtosMaisUsados(c.aps).map((p) => ({ nome: p.nome, n: p.n, rot: `${p.n}× · ${dataBR(p.ult)}` })), 3))] }));
    const cl = c.clima[0], prev = D.clima && D.clima.previsao;
    t.push(ladrilho('clima', 1, 1, [], { rotulo: 'Chuva · satélite', titulo: c.chuva30 == null ? 'Sem dado' : `${num(c.chuva7, 0)} mm em 7 d · ${num(c.chuva30, 0)} em 30`, sub: c.clima.length > 1 ? `média de ${c.clima.length} fazendas` : (cl ? cl.fazenda : ''),
      blocos: [X((cl ? svgChuva(cl.dias.slice(-30), 90) : '') + (prev ? `<div class="janelas" title="Dia com chance de janela de aplicação (${esc(prev.fazenda)}): chance de chuva ≤ 60% e vento ≤ 10 km/h">${prev.dias.map((d) => `<span class="${d.chance_de_janela ? 'ok' : d.chance_de_janela === false ? 'nao' : ''}">${dataBR(d.data).slice(0, 2)}</span>`).join('')}<em>janela</em></div>` : ''))] }));
    const mon = D.monitoramento || {}, alvos = (mon.alvos || []);
    t.push(ladrilho('monitoramento', 1, 1, [], { rotulo: 'Monitoramento', titulo: c.ultimaVisita ? `última ${dataBR(c.ultimaVisita)}` : 'Sem visita', sub: `${mon.visitas || 0} visitas no ano${c.abertas ? ` · ${c.abertas} aberta(s)` : ''}`,
      blocos: [X(alvos.length ? htmlBarrinhas(alvos.map((a) => ({ nome: a.nome, n: a.pontos || a.visitas, rot: `${a.visitas} vis.` })), 4) : '<div class="nota">Nenhum alvo contado nas visitas.</div>')] }));
    const ev = talhoesDaEvolucao()[0];
    t.push(ladrilho('evolucao', 1, 1, [], { rotulo: 'Evolução da lavoura', titulo: ev && ev.plantio ? `${ev.talhao} · ${diasEntre(ev.plantio, D.hoje)} dias` : 'Plantio não cadastrado',
      sub: ev && ev.plantio ? `${culturaDe(ev.cultura) || 'soja'} · estádio de referência ${estadioNoDia(culturaDe(ev.cultura) || 'soja', diasEntre(ev.plantio, D.hoje))}` : `${c.planejadas} aplicação(ões) planejada(s)`,
      blocos: [X(`<svg class="mini" viewBox="0 0 300 130" preserveAspectRatio="xMidYMid meet"><rect x="0" y="112" width="300" height="10" fill="rgba(125,76,1,.25)"/>${(() => { const cv = culturaDe(ev && ev.cultura) || 'soja', tb = ESTADIOS[cv].e, n = tb.length, hojeK = ev && ev.plantio ? tb.findIndex((e) => e[0] === estadioNoDia(cv, diasEntre(ev.plantio, D.hoje))) : -1; return [0, 0.25, 0.5, 0.75, 1].map((f, i) => { const k = Math.round(f * (n - 1)); return `<g opacity="${hojeK >= k ? 1 : 0.22}">${plantinha(30 + i * 60, 112, k, n, cv, 0.85)}</g>`; }).join(''); })()}</svg>`)] }));
    if (c.produtos) t.push(ladrilho('estoque', 1, 1, [], { rotulo: 'Estoque', titulo: `${c.zerados} zerado${c.zerados === 1 ? '' : 's'} · ${c.abaixo} abaixo`, sub: `${c.produtos} produtos`,
      blocos: [X(`<ul class="lista-curta">${c.est.filter((e) => e.saldo <= 0).slice(0, 4).map((e) => `<li>${esc(e.produto)}${dossieFazenda ? '' : ' · ' + esc(e.fazenda)}</li>`).join('') || '<li class="ok">Nada zerado.</li>'}</ul>`)] }));
    if (D.laboratorio && (D.laboratorio.pedidos || c.analises)) t.push(ladrilho('laboratorio', 1, 1, [], { rotulo: 'Laboratório', titulo: `${c.analises} análises de solo`,
      sub: D.laboratorio.pedidos ? `${D.laboratorio.pedidos_encontrados ?? D.laboratorio.pedidos.length} pedidos no lab` : '',
      blocos: [X(`<ul class="lista-curta">${(D.laboratorio.pedidos || []).slice(0, 3).map((p) => `<li class="ok">${esc(p.numero)} · ${esc(p.situacao)} · ${p.amostras ?? '—'} am.</li>`).join('')}</ul>`)] }));
    if (D.financeiro) t.push(ladrilho('financeiro', 1, 1, [], { rotulo: 'Despesas lançadas', titulo: reais(D.financeiro.total), sub: `${D.financeiro.meses.length} meses`, blocos: [X(htmlBarrinhas(D.financeiro.meses.slice(-4).map((m) => ({ nome: `${m.mes} · ${m.ambito}`, n: m.total, rot: reais(m.total) })), 4))] }));
    return t;
  },
  talhoes() {
    const c = contasDoEscopo(), varias = !dossieFazenda && dossie.fazendas.length > 1;
    const cor = (t) => t.plantio ? { fill: 'rgba(143,192,74,.45)', tit: 'plantio ' + dataBR(t.plantio) } : t.tem_analise ? { fill: 'rgba(162,167,42,.32)', tit: 'com análise' } : { fill: 'rgba(179,169,122,.12)', tit: 'sem análise' };
    const linhas = c.ts.map((t) => [`<b>${esc(t.talhao)}</b>${varias ? `<div class="nota" style="margin:0">${esc(t.fazenda)}</div>` : ''}`, t.area_ha == null ? '—' : num(t.area_ha, 1), esc(t.cultura || '—'), t.plantio ? dataBR(t.plantio) : '—', t.tem_analise ? '✓' : '—']);
    return [
      { rotulo: varias ? 'As fazendas do grupo' : 'Mapa dos talhões', titulo: varias ? dossie.cliente : (dossieFazenda || dossie.fazenda), sub: `${c.talhoes} talhões · ${num(c.area, 0)} ha`,
        blocos: [X((varias ? svgFazendas(c.faz, c.ts, cor) : svgTalhoes(c.ts, cor, { nomes: true, fonte: c.ts.length > 25 ? 13 : 18 })) + '<div class="legenda-cor"><span><b style="background:rgba(143,192,74,.6)"></b>com plantio</span><span><b style="background:rgba(162,167,42,.5)"></b>com análise</span><span><b style="background:rgba(179,169,122,.25)"></b>sem análise</span></div>')], acaoFazenda: varias },
      { rotulo: 'Talhões', titulo: `${c.talhoes} talhões`, tituloLista: 'Talhões', blocos: [T(['Talhão', 'ha', 'Cultura', 'Plantio', 'Análise'], linhas, [1])] },
    ];
  },
  fertilidade() {
    const c = contasDoEscopo(), out = [];
    if (c.fert.length) {
      const medias = NUTRIENTES.map(([k, r, cs]) => { const v = c.fert.map((l) => l[k]).filter((x) => x != null && isFinite(x)); return v.length ? [num(v.reduce((a, b) => a + b, 0) / v.length, cs), `${r} médio`] : null; });
      const menores = NUTRIENTES.slice(1, 4).map(([k, r, cs]) => { const l = c.fert.filter((x) => x[k] != null).sort((a, b) => a[k] - b[k])[0]; return l ? `menor ${r}: ${l.talhao}${dossieFazenda ? '' : ' (' + l.fazenda + ')'} — ${num(l[k], cs)}` : null; }).filter(Boolean);
      out.push({ rotulo: 'Fertilidade · última análise de cada talhão', titulo: `${c.fert.length} talhões`, sub: 'ano na linha · camada 0-20 · cor = posição dentro do escopo (do menor ao maior) · comparar anos: "Evolução da fertilidade"', blocos: [X(htmlCalor(c.fert, 400))] });
      out.push({ rotulo: 'Médias da última análise de cada talhão', titulo: dossieFazenda || dossie.cliente, blocos: [K(medias), X(`<ul class="lista-curta">${menores.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`), NT('Médias dos laudos por talhão (painel do produtor). Para o mapa de um nutriente, diga "mapa de fósforo da …".')] });
    }
    const mapas = mapasRecebidos.filter((m) => !dossieFazenda || normTela(m.alvo).includes(romanoNorm(dossieFazenda)) || romanoNorm(m.alvo.replace(/^fazenda\s+/i, '')) === romanoNorm(dossieFazenda));
    if (mapas.length) out.unshift(corpoDeCamadas(mapas[0].alvo, mapas.filter((m) => m.alvo === mapas[0].alvo)));
    return out;
  },
  fertilidade_anos() {
    // já trazida nesta sessão (para esta fazenda): mostra na hora; senão pede ao servidor UMA vez
    const alvo = dossieFazenda || dossie.fazenda || '';
    const cache = (dossie._evolFert || {})[normTela(alvo) || '*'];
    if (cache) return [DESENHOS.evolucao_fertilidade(cache)];
    setTimeout(() => perguntar(`Compare a fertilidade entre os anos${alvo ? ' da ' + alvo : ''} do ${dossie.cliente}`, undefined, { semComando: true }), 50);
    return [{ rotulo: 'Evolução da fertilidade', titulo: 'Buscando os anos de análise…', blocos: [NT('Cada ano separado, cada profundidade separada — a 0-20 primeiro.')] }];
  },
  monitoramento() {
    const D = dossie, mon = D.monitoramento || {}, out = [];
    for (const p of doEscopo(mon.paineis || []).slice(0, 2)) {
      const c = DESENHOS.painel_do_monitoramento({ fazenda: p.fazenda, data: p.data, painel: { fazenda: p.fazenda, titulo: p.titulo, autor: p.autor, data: dataBR(p.data),
        mediasGerais: p.medias, talhoes: p.talhoes.map((t) => ({ nome: t.nome, fase: t.fase, medidas: t.medidas, ocorrencias: [] })), alvos: p.alvos, correcoes: [] } });
      out.push(c);
    }
    const alvos = mon.alvos || [];
    if (alvos.length) out.push({ rotulo: 'Alvos no ano', titulo: `${alvos.length} alvos vistos`, sub: `${mon.visitas || 0} visitas`, blocos: [X(htmlBarrinhas(alvos.map((a) => ({ nome: a.nome, n: a.pontos || a.visitas, rot: `${a.visitas} vis. · ${a.pontos} pts` })), 12))] });
    const vs = doEscopo(mon.ultimas || []);
    if (vs.length) out.push({ rotulo: 'Visitas', titulo: `${doEscopo(mon.abertas_lista || []).length} aberta(s)`, tituloLista: 'Visitas', blocos: [T(['Quando', 'Onde', 'Situação'], vs.map((v) => ({ alerta: v.aberta, cel: [dataBR(v.dia), esc(v.fazenda + (v.talhao ? ' · ' + v.talhao : '')), v.aberta ? 'aberta' : 'encerrada'] })))] });
    return out;
  },
  aplicacoes() {
    const c = contasDoEscopo(), varias = !dossieFazenda && dossie.fazendas.length > 1;
    const linhas = c.aps.map((a) => ({ alerta: a.situacao !== 'executada', cel: [a.dia ? dataBR(a.dia) : '—', esc((varias ? a.fazenda + ' · ' : '') + (a.talhao || '—')), a.situacao === 'executada' ? 'feita' : 'planejada',
      esc(a.produtos.map((p) => `${p.produto}${p.dose != null ? ` ${num(p.dose, 2)} ${p.unidade}` : ''}`).join(' + ') || a.tipo)] }));
    return [
      { rotulo: 'Aplicações no tempo', titulo: `${c.executadas} feitas · ${c.planejadas} planejadas`, sub: '60 dias para trás e 30 à frente · cheia = feita, vazada = planejada',
        blocos: [X(svgLinhaAplicacoes(c.aps, dossie.hoje, true) + htmlBarrinhas(produtosMaisUsados(c.aps).map((p) => ({ nome: p.nome, n: p.n, rot: `${p.n}× · última ${dataBR(p.ult)}` })), 6))] },
      { rotulo: 'Caderno de campo', titulo: `${c.aps.length} registros`, tituloLista: 'Caderno', blocos: [T(['Data', 'Talhão', 'Situação', 'Produtos e dose'], linhas)] },
    ];
  },
  evolucao() {
    const b = blocosDaEvolucao(false), c = contasDoEscopo();
    const prox = c.aps.filter((a) => a.situacao !== 'executada' && a.dia && a.dia >= dossie.hoje).sort((a, b2) => a.dia.localeCompare(b2.dia)).slice(0, 8);
    // UMA janela larga: a linha da lavoura precisa de largura (as próximas do plano vão embaixo, em uma linha cada)
    const proxHtml = prox.length ? `<div class="nota" style="margin-top:.2em">PRÓXIMAS DO PLANO: ${prox.slice(0, 5).map((a) => `${dataBR(a.dia)} ${esc(a.talhao || '')} — ${esc(a.produtos.map((p) => p.produto).join(' + ') || a.tipo)}`).join(' · ')}</div>` : '';
    return [{ rotulo: 'Evolução da lavoura × aplicações do plano', titulo: b.titulo, sub: b.sub, blocos: [...b.blocos, ...(proxHtml ? [X(proxHtml)] : [])], acao: acaoEvol, largo: true, compacto: true }];
  },
  clima() {
    const D = dossie, c = contasDoEscopo(), out = [];
    for (const f of c.clima.slice(0, 2)) out.push({ rotulo: 'Chuva por satélite · 30 dias', titulo: f.fazenda, sub: `${D.clima.de || ''} a ${D.clima.ate || ''}`,
      blocos: [K([[num(f.chuva_7d_mm) + ' mm', '7 dias'], [num(f.chuva_30d_mm) + ' mm', '30 dias'], [f.balanco_mm == null ? null : num(f.balanco_mm, 0) + ' mm', 'balanço hídrico']]), GB(f.dias.map((d) => ({ dia: d.dia, chuva_mm: d.mm })), 'chuva_mm', 'mm')] });
    const prev = D.clima && D.clima.previsao;
    if (prev) out.push({ rotulo: 'Previsão · 5 dias', titulo: prev.fazenda, sub: D.clima.regra,
      blocos: [T(['Dia', 'Chuva', 'Chance', 'Vento', 'Máx', 'Janela'], prev.dias.map((d) => ({ alerta: d.chance_de_janela === false, cel: [dataBR(d.data), d.chuva_mm == null ? '—' : num(d.chuva_mm) + ' mm', d.chance_pct == null ? '—' : d.chance_pct + '%', d.vento_kmh == null ? '—' : num(d.vento_kmh, 0) + ' km/h', d.tmax == null ? '—' : num(d.tmax, 0) + '°', d.chance_de_janela ? 'pode haver' : d.chance_de_janela === false ? 'difícil' : '—'] })), [1, 2, 3, 4]),
        NT('Janela pelo dia: chance de chuva ≤ 60% e vento máximo do dia ≤ 10 km/h. Temperatura e umidade são da hora — o horário certo sai no boletim das 6 h.')] });
    const cl = doEscopo(D.chuva_lancada || []);
    if (cl.length) out.push({ rotulo: 'Chuva lançada no pluviômetro', titulo: `${num(cl.reduce((s, x) => s + (x.mm || 0), 0), 0)} mm no ano`, tituloLista: 'Por mês', blocos: [T(['Mês', 'Fazenda', 'mm', 'Dias'], cl.slice(-12).map((x) => [esc(x.mes), esc(x.fazenda), num(x.mm), x.dias]), [2, 3])] });
    return out;
  },
  estoque() {
    const c = contasDoEscopo(), varias = !dossieFazenda && dossie.fazendas.length > 1;
    const ordem = c.est.slice().sort((a, b) => (a.saldo <= 0 ? 0 : a.minimo != null && a.saldo < a.minimo ? 1 : 2) - (b.saldo <= 0 ? 0 : b.minimo != null && b.saldo < b.minimo ? 1 : 2) || a.produto.localeCompare(b.produto));
    return [{ rotulo: 'Estoque', titulo: `${c.produtos} produtos`, tituloLista: 'Produtos', sub: `${c.zerados} zerados · ${c.abaixo} abaixo do mínimo`,
      blocos: [K([[c.produtos, 'produtos'], [c.zerados, 'zerados'], [c.abaixo, 'abaixo do mínimo']]), T(['Produto', 'Saldo', 'Mínimo'], ordem.map((e) => ({ alerta: e.saldo <= 0 || (e.minimo != null && e.saldo < e.minimo), cel: [esc(e.produto) + (varias ? `<div class="nota" style="margin:0">${esc(e.fazenda)}</div>` : ''), `${num(e.saldo, 1)} ${esc(e.unidade)}`, e.minimo == null ? '—' : num(e.minimo, 1)] })), [1, 2])] }];
  },
  laboratorio() {
    const L = dossie.laboratorio || {}, c = contasDoEscopo(), out = [];
    out.push({ rotulo: 'Laboratório', titulo: `${c.analises} análises de solo`, blocos: [K([[c.analises, 'análises de solo'], [L.pedidos_encontrados, 'pedidos no lab'], ...((L.outras || []).slice(0, 2).map((o) => [o.laudos, o.matriz]))])] });
    if (L.pedidos && L.pedidos.length) out.push({ rotulo: 'Pedidos do laboratório', titulo: `${L.pedidos.length} mais recentes`, tituloLista: 'Pedidos', blocos: [T(['Pedido', 'Entrada', 'Situação', 'Amostras'], L.pedidos.map((p) => [esc(p.numero), esc(p.entrada || '—'), esc(p.situacao), p.amostras ?? '—']), [3])] });
    return out;
  },
  financeiro() {
    const F = dossie.financeiro; if (!F) return [];
    return [{ rotulo: 'Despesas lançadas', titulo: reais(F.total), sub: 'o que foi lançado no app e no zap', blocos: [GB(F.meses.map((m) => ({ dia: `${m.mes} ${m.ambito.slice(0, 3)}`, valor: m.total })), 'valor', 'R$')] },
      { rotulo: 'Últimos lançamentos', titulo: `${F.ultimas.length}`, tituloLista: 'Lançamentos', blocos: [T(['Data', 'Categoria', 'Descrição', 'Valor'], F.ultimas.map((d) => [dataBR(d.data), esc(d.categoria), esc(d.descricao), reais(d.valor)]), [3])] }];
  },
};
/** A fertilidade do talhão (evolucao_fertilidade com o talhão) — pedida uma vez, guardada no dossiê. */
async function pedirFertilidadeDoTalhao(fazenda, talhao) {
  const k = chaveTalhao(fazenda, talhao);
  dossie._fertTalhao = dossie._fertTalhao || {};
  if (dossie._fertTalhao[k]) return dossie._fertTalhao[k];
  dossie._fertTalhao[k] = { carregando: true };
  let r = null;
  if (DEMO) {
    await new Promise((ok) => setTimeout(ok, 600)); r = { ...evolFertDemo(), fazenda, talhao };
    r._mapas = agruparMapas([2023, 2024, 2025].map((ano, i) => ({ ferramenta: 'imagem', resultado: { legenda: `Mapa de P res 0-20 · ${fazenda} · talhão ${talhao} · ${ano}`, mime: 'image/png', base64: mapaDemoQuadrado(`P res 0-20 · talhão ${talhao} · ${ano}`, i + 2) } }))).corpos[0] || null;
  }
  else {
    try {
      const tk = await token();
      const resp = await fetch(ROTA_VOZ, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk },
        body: JSON.stringify({ direto: { ferramenta: 'evolucao_fertilidade', argumentos: { fazenda, talhao, cliente: dossie.cliente, comparar: 'anos' } } }) });
      const c = await resp.json().catch(() => ({}));
      r = ((c.telas || []).find((x) => x.ferramenta === 'evolucao_fertilidade') || {}).resultado || (c.resultado && c.resultado.erro ? { erro: c.resultado.erro } : null);
      // os mapas de cada ano do talhão (mesma escala) que vieram junto viram a janela "anos lado a lado"
      if (r && r.versao) r._mapas = agruparMapas((c.telas || []).filter((x) => x.ferramenta === 'imagem')).corpos[0] || null;
    } catch (e) { r = { erro: 'Sem conexão.' }; }
  }
  dossie._fertTalhao[k] = r || { erro: 'Sem análise deste talhão.' };
  if (dossieTalhao && chaveTalhao(dossieTalhao.fazenda, dossieTalhao.talhao) === k && dossieSecao === 'talhao') mostrarSecao('talhao');
  return dossie._fertTalhao[k];
}
DESENHOS_SECAO.talhao = () => {
  if (!dossieTalhao) return DESENHOS_SECAO.talhoes();
  const D = dossie, t = talhaoDoDossie(dossieTalhao.fazenda, dossieTalhao.talhao); if (!t) return [];
  const k = chaveTalhao(t.fazenda, t.talhao), out = [];
  // 1) o talhão em destaque no desenho da fazenda (clique em outro troca)
  const daFazenda = D.talhoes.filter((x) => mesmaFazenda(x.fazenda, t.fazenda));
  const cor = (x) => chaveTalhao(x.fazenda, x.talhao) === k ? { fill: 'rgba(249,163,34,.5)', stroke: '#f9a322', sw: 3 } : { fill: 'rgba(196,202,60,.08)', stroke: 'rgba(241,233,196,.35)', sw: 1 };
  const ult = (D.fertilidade || []).find((f) => chaveTalhao(f.fazenda, f.talhao) === k);
  // o que o monitoramento anotou nele vai junto do quadro do talhão (uma janela a menos: os mapas ficam maiores)
  const mon = (D.monitoramento.talhoes || []).filter((x) => chaveTalhao(x.fazenda, x.talhao || '') === k);
  const medidas = (D.monitoramento.paineis || []).filter((p) => mesmaFazenda(p.fazenda, t.fazenda)).flatMap((p) => p.talhoes.filter((x) => chaveTalhao(t.fazenda, x.nome) === k).map((x) => ({ ...x, data: p.data })));
  const notasMon = [...mon.flatMap((x) => x.alvos.map((a) => `<li>${esc(a)}</li>`)), ...medidas.map((m) => `<li class="ok">${dataBR(m.data)}${m.fase ? ' · ' + esc(m.fase) : ''} · ${esc((m.medidas || []).map((q) => `${q.texto} ${q.unidade || q.rotulo}`).join(' · '))}</li>`)].join('');
  out.push({ rotulo: `Talhão · ${t.fazenda}`, titulo: `Talhão ${t.talhao}`, compacto: true,
    blocos: [X(`<div class="fatos"><b>${t.area_ha == null ? '—' : num(t.area_ha, 1) + ' ha'}</b><span>${esc(t.cultura || 'cultura não cadastrada')}</span><span>${esc(t.safra || '—')}</span><span>${t.plantio ? 'plantio ' + dataBR(t.plantio) : 'sem data de plantio'}</span><span>${t.tem_analise ? 'com análise' : 'sem análise'}</span></div>`),
      X(svgTalhoes(daFazenda, cor, { nomes: daFazenda.length <= 45, fonte: daFazenda.length > 20 ? 13 : 18 })),
      X(`<div class="nota" style="margin:.2em 0 0">MONITORAMENTO${mon.length ? ` · ${mon[0].visitas} visita(s), última ${dataBR(mon[0].ultima)}` : ' · sem visita registrada neste talhão'}</div><ul class="lista-curta">${notasMon || '<li class="ok">Nada anotado.</li>'}</ul>`)] });
  // 2) a fertilidade: a última análise POR profundidade e a evolução (pedida uma vez)
  const fert = (D._fertTalhao || {})[k];
  if (!fert) pedirFertilidadeDoTalhao(t.fazenda, t.talhao);
  if (fert && fert.versao) {
    const c = DESENHOS.evolucao_fertilidade(fert); out.push({ ...c, rotulo: `Fertilidade do talhão ${t.talhao}`, compacto: true });
    // os mapas de cada ano do talhão vão para a janela GRANDE (João: "os talhões abertos ao lado ficaram pequenos")
    if (fert._mapas) out.unshift({ ...fert._mapas, compacto: true });
  }
  else out.push({ rotulo: `Fertilidade do talhão ${t.talhao}`, titulo: fert && fert.erro ? fert.erro : 'Buscando as análises deste talhão…', compacto: true,
    blocos: [ult ? X(`<div class="fatos"><b>${ult.ano || ''}</b><span>${esc(ult.profundidade || '')}</span><span>pH ${num(ult.ph, 2)}</span><span>V% ${num(ult.v, 0)}</span><span>P ${num(ult.p, 1)}</span><span>K ${num(ult.k, 2)}</span><span>MO ${num(ult.mo, 1)}</span></div>`) : NT('Cada ano e cada profundidade separados — 0-20 primeiro.')] });
  // 3) os mapas do talhão (recortados nele), todas as camadas, desenhados na hora
  out.push({ rotulo: `Mapas do talhão ${t.talhao}`, titulo: `${t.fazenda} · talhão ${t.talhao}`, ferramenta: 'imagem', compacto: true,
    blocos: [{ tipo: 'camadas', ctx: { alvo: `${t.fazenda} · talhão ${t.talhao}`, fazenda: t.fazenda, talhao: t.talhao },
      disp: { parametros: ['P res', 'K', 'pH CaCl2', 'MOS', 'V%', 'Ca', 'Mg', 'CTC'], profundidades: ['0-20', '0-10', '20-40'], anos: [] }, sel: { param: 'P res', prof: '0-20', ano: null }, cache: {}, pend: {} }] });
  // 4) aplicações e a lavoura crescendo
  const ev = blocosDaEvolucao(true);
  out.push({ rotulo: `Aplicações e lavoura · talhão ${t.talhao}`, titulo: ev.titulo, sub: ev.sub, blocos: ev.blocos, largo: true, compacto: true });
  return out;
};

export {
  DESENHOS_SECAO,
};
