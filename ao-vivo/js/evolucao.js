// OSCARPES AO VIVO — evolucao.js
// A EVOLUÇÃO: da lavoura (as plantinhas crescendo com as aplicações do plano) e da FERTILIDADE entre
// os anos (evolucao_fertilidade, um ano separado do outro, uma profundidade por vez).
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import './secoes.js?v=20261010213811';
import { dataBR, esc, num } from './base.js?v=20261010213811';
import { NT, T, X, dossie, dossieFazenda, focado, htmlDoBloco } from './telas.js?v=20261010213811';
import { normTela } from './comandos.js?v=20261010213811';
import { DESENHOS } from './desenhos.js?v=20261010213811';
import {
  contasDoEscopo, diasEntre, evolTalhao, isoDoDia, mesmaFazenda, romanoNorm, somaDias,
} from './fazenda.js?v=20261010213811';

// ---- A EVOLUÇÃO DA LAVOURA ---------------------------------------------------
// João: "eu acharia bacana trazer em algum momento, pode ser quando for falar de
// aplicação, ou falar do plantio, aquela evolução das plantinhas com as
// aplicações do plano". Estádios de REFERÊNCIA (ciclo médio no MT, dias após o
// plantio) — desenho para situar as aplicações, não leitura de campo. Sem data
// de plantio cadastrada no talhão, a linha é do calendário e a tela DIZ isso
// (nada de data inventada).
// 06/out/2026: a régua mostra os ESTÁDIOS-CHAVE de cada escala (soja Fehr & Caviness, milho Ritchie,
// algodão Marur & Ruano), cada um com o SEU desenho — public/ao-vivo/plantas/<cultura>/<ID>.png, cópia
// byte a byte de assets/images/<cultura>/estadios/ (scripts/gerar-plantinhas.ts; o portão
// conferir-plano-sanitario-telas.js confere as duas cópias). Os dias são de ciclo médio, da tabela
// da casa (lib/cultura-cadastros.ts) onde ela tem o estádio.
const ESTADIOS = {
  soja: { ciclo: 122, e: [['VE', 6], ['VC', 10], ['V2', 17], ['V4', 26], ['Vn', 36], ['R1', 46], ['R2', 54], ['R3', 63], ['R4', 72], ['R5', 82], ['R6', 96], ['R7', 108], ['R8', 116]] },
  milho: { ciclo: 130, e: [['VE', 6], ['V2', 12], ['V4', 20], ['V6', 29], ['V8', 37], ['V10', 45], ['V12', 51], ['VT', 57], ['R1', 62], ['R2', 74], ['R3', 84], ['R4', 94], ['R5', 104], ['R6', 122]] },
  algodao: { ciclo: 160, e: [['VE', 7], ['V1', 14], ['V3', 22], ['V5', 30], ['B1', 35], ['B5', 50], ['F1', 60], ['F5', 72], ['C1', 110], ['C5', 145]] },
};
const culturaDe = (c) => /milho/i.test(c || '') ? 'milho' : /algod/i.test(c || '') ? 'algodao' : /soja/i.test(c || '') ? 'soja' : null;
/** O estádio de referência aos `dap` dias do plantio. */
function estadioNoDia(cultura, dap) {
  const t = ESTADIOS[cultura] || ESTADIOS.soja; let r = dap < t.e[0][1] ? 'semeado' : t.e[0][0];
  for (const [n, d] of t.e) if (dap >= d) r = n;
  return r;
}
/**
 * Uma plantinha: i = índice do estádio na régua da cultura (0 = VE). É o desenho do próprio estádio
 * (soja: trifólios, flores, vagens; milho: folhas, pendão, espiga; algodão: botão, flor, capulho),
 * com o montinho de terra do desenho assentado na linha do solo (`base`).
 */
function plantinha(x, base, i, total, cultura, escala = 1) {
  const tab = (ESTADIOS[cultura] || ESTADIOS.soja).e, c = ESTADIOS[cultura] ? cultura : 'soja';
  const id = tab[Math.max(0, Math.min(tab.length - 1, i))][0];
  const h = 112 * escala, w = h * 0.8;
  return `<image href="plantas/${c}/${id}.png" x="${(x - w / 2).toFixed(1)}" y="${(base - h * (111 / 120)).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" style="image-rendering:pixelated"/>`;
}
/** O painel da evolução: estádios com as plantinhas, aplicações do caderno, hoje e a chuva embaixo. */
function svgEvolucao({ cultura, plantio, aps, chuva, hoje }) {
  const W = 1200, H = 450, esq = 60, dir = 30, base = 200, eixo = 238, chuvaBase = 432;
  const tab = ESTADIOS[cultura] || ESTADIOS.soja;
  let ini, fim;
  const datas = aps.map((a) => a.dia).filter(Boolean);
  if (plantio) {
    ini = somaDias(plantio, -20); fim = somaDias(plantio, tab.ciclo + 6);
    for (const d of datas) { if (d < ini && diasEntre(d, plantio) <= 60) ini = somaDias(d, -4); if (d > fim && diasEntre(plantio, d) <= tab.ciclo + 40) fim = somaDias(d, 4); }
  } else {
    ini = somaDias(hoje, -45); fim = somaDias(hoje, 45);
    for (const d of datas) { if (d < ini && diasEntre(d, hoje) <= 200) ini = somaDias(d, -5); if (d > fim && diasEntre(hoje, d) <= 120) fim = somaDias(d, 5); }
  }
  const total = Math.max(10, diasEntre(ini, fim)), X = (iso) => esq + (diasEntre(ini, iso) / total) * (W - esq - dir);
  let s = `<svg class="evol" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="solo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(125,76,1,.28)"/><stop offset="1" stop-color="rgba(125,76,1,0)"/></linearGradient></defs>`;
  s += `<rect x="${esq}" y="${base}" width="${W - esq - dir}" height="18" fill="url(#solo)"/>`;
  if (plantio) {
    // faixas dos estádios + plantinhas
    tab.e.forEach(([n, d], i) => {
      const a = somaDias(plantio, d), b = somaDias(plantio, (tab.e[i + 1] || [0, tab.ciclo])[1]);
      const xa = X(a), xb = X(b); if (xb < esq || xa > W - dir) return;
      const meio = (Math.max(esq, xa) + Math.min(W - dir, xb)) / 2;
      s += `<rect x="${xa.toFixed(1)}" y="20" width="${Math.max(0, xb - xa).toFixed(1)}" height="${base - 20}" fill="${n.startsWith('R') ? 'rgba(249,163,34,.05)' : 'rgba(196,202,60,.04)'}" stroke="rgba(196,202,60,.08)"/>` +
        plantinha(meio, base, i, tab.e.length, cultura, Math.min(1, (xb - xa) / 60 + 0.35)) +
        `<text x="${meio.toFixed(1)}" y="${base + 30}" fill="${n.startsWith('R') ? '#f9a322' : '#c4ca3c'}" font-size="15" font-weight="700" text-anchor="middle" font-family="Menlo,monospace">${n}</text>`;
    });
    s += `<line x1="${X(plantio)}" x2="${X(plantio)}" y1="16" y2="${eixo}" stroke="#c4ca3c" stroke-width="1.5"/><text x="${X(plantio) + 6}" y="30" fill="#c4ca3c" font-size="14" font-family="Menlo,monospace">PLANTIO ${dataBR(plantio)}</text>`;
  } else {
    s += `<text x="${W / 2}" y="92" fill="#f1e9c4" font-size="22" font-weight="700" text-anchor="middle">Data de plantio não cadastrada neste talhão</text>` +
      `<text x="${W / 2}" y="124" fill="#b3a97a" font-size="16" text-anchor="middle">Com o plantio lançado (app › cadastro do talhão), a linha mostra os estádios VE…R e a idade da lavoura em cada aplicação.</text>` +
      [0.2, 0.4, 0.6, 0.8].map((f) => { const n = (ESTADIOS[cultura] || ESTADIOS.soja).e.length; return `<g opacity=".18">${plantinha(esq + f * (W - esq - dir), base, Math.round(f * (n - 1)), n, cultura || 'soja', 0.8)}</g>`; }).join('');
  }
  // eixo do tempo
  s += `<line x1="${esq}" x2="${W - dir}" y1="${eixo}" y2="${eixo}" stroke="rgba(196,202,60,.4)"/>`;
  const passo = total > 150 ? 30 : total > 80 ? 15 : 10;
  for (let d = 0; d <= total; d += passo) {
    const iso = somaDias(ini, d), x = X(iso);
    s += `<line x1="${x}" x2="${x}" y1="${eixo}" y2="${eixo + 5}" stroke="rgba(196,202,60,.4)"/><text x="${x}" y="${eixo + 19}" fill="#b3a97a" font-size="13" text-anchor="middle" font-family="Menlo,monospace">${dataBR(iso)}${plantio ? ` · ${diasEntre(plantio, iso)}d` : ''}</text>`;
  }
  // as aplicações: cheia = executada, vazada = planejada; o rótulo alterna de altura para não encavalar
  const ordenadas = aps.filter((a) => a.dia && a.dia >= ini && a.dia <= fim).sort((a, b) => a.dia.localeCompare(b.dia));
  // cada rótulo vai para a primeira "faixa" livre (4 faixas): nada encavala
  const fimDaFaixa = [-1e9, -1e9, -1e9, -1e9];
  ordenadas.forEach((a) => {
    const x = X(a.dia), ex = a.situacao === 'executada';
    const rot = (a.produtos || []).slice(0, 2).map((p) => p.produto.split(' ')[0] + (p.dose != null ? ` ${num(p.dose, 2)}${p.unidade ? ' ' + p.unidade.replace('/ha', '') : ''}` : '')).join(' + ') || a.tipo || 'aplicação';
    const idade = plantio ? `${diasEntre(plantio, a.dia)} DAP · ${estadioNoDia(cultura || 'soja', diasEntre(plantio, a.dia))}` : '';
    const larg = 24 + Math.min(34, rot.length) * 7.6 + (idade ? idade.length * 6.4 + 8 : 0);
    let nivel = fimDaFaixa.findIndex((f) => f < x - 4);
    if (nivel < 0) nivel = fimDaFaixa.indexOf(Math.min(...fimDaFaixa));
    fimDaFaixa[nivel] = x + larg;
    const y = eixo + 42 + nivel * 30;
    s += `<line x1="${x}" x2="${x}" y1="${eixo}" y2="${y - 8}" stroke="${ex ? '#f9a322' : '#c4ca3c'}" stroke-width="1" opacity=".5"/>` +
      `<g><title>${esc(dataBR(a.dia))}${idade ? ' (' + idade + ')' : ''} · ${esc(a.talhao || '')} · ${esc((a.produtos || []).map((p) => `${p.produto}${p.dose != null ? ` ${num(p.dose, 2)} ${p.unidade}` : ''}`).join(', ') || a.tipo)} · ${a.situacao}</title>` +
      `<circle cx="${x}" cy="${y}" r="8" fill="${ex ? '#f9a322' : 'rgba(11,17,2,.6)'}" stroke="${ex ? '#f9a322' : '#c4ca3c'}" stroke-width="2.2" ${ex ? '' : 'stroke-dasharray="3 2"'}/>` +
      `<text x="${x + 12}" y="${y + 5}" fill="${ex ? '#f1e9c4' : '#d8dc6a'}" font-size="14">${esc(rot.slice(0, 34))}${idade ? `<tspan fill="#b3a97a" font-size="12"> · ${esc(idade)}</tspan>` : ''}</text></g>`;
  });
  // chuva embaixo
  const chuvaNoPeriodo = (chuva || []).map((d) => ({ iso: isoDoDia(d.dia, hoje), mm: d.mm })).filter((d) => d.iso && d.iso >= ini && d.iso <= fim);
  if (chuvaNoPeriodo.length) {
    const max = Math.max(10, ...chuvaNoPeriodo.map((d) => d.mm || 0)), bw = Math.max(2, (W - esq - dir) / total * 0.7);
    s += chuvaNoPeriodo.map((d) => { const h = ((d.mm || 0) / max) * 52; return `<rect x="${(X(d.iso) - bw / 2).toFixed(1)}" y="${(chuvaBase - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="#7fb6d6" opacity=".7"><title>${dataBR(d.iso)}: ${num(d.mm)} mm</title></rect>`; }).join('') +
      `<text x="${esq - 8}" y="${chuvaBase - 4}" fill="#7fb6d6" font-size="12" text-anchor="end" font-family="Menlo,monospace">mm</text>`;
  }
  // hoje
  if (hoje >= ini && hoje <= fim) s += `<line x1="${X(hoje)}" x2="${X(hoje)}" y1="14" y2="${chuvaBase}" stroke="#f9a322" stroke-width="2" stroke-dasharray="6 5"/><text x="${X(hoje)}" y="13" fill="#f9a322" font-size="14" font-weight="700" text-anchor="middle" font-family="Menlo,monospace">HOJE${plantio ? ' · ' + diasEntre(plantio, hoje) + 'd · ' + estadioNoDia(cultura || 'soja', diasEntre(plantio, hoje)) : ''}</text>`;
  return s + '</svg>';
}
/** Os talhões que têm o que mostrar na evolução (plantio ou aplicação), o mais completo primeiro. */
function talhoesDaEvolucao() {
  const c = contasDoEscopo();
  const chave = (f, t) => romanoNorm(f) + '|' + normTela(t);
  const nAps = new Map(); for (const a of c.aps) if (a.talhao) nAps.set(chave(a.fazenda, a.talhao), (nAps.get(chave(a.fazenda, a.talhao)) || 0) + 1);
  return c.ts.map((t) => ({ t, k: chave(t.fazenda, t.talhao), n: nAps.get(chave(t.fazenda, t.talhao)) || 0 }))
    .filter((x) => x.n || x.t.plantio).sort((a, b) => (b.t.plantio ? 1 : 0) - (a.t.plantio ? 1 : 0) || b.n - a.n).map((x) => ({ ...x.t, chave: x.k, n: x.n }));
}
function blocosDaEvolucao(compacto) {
  const c = contasDoEscopo(), lista = talhoesDaEvolucao();
  const chave = (f, t) => romanoNorm(f) + '|' + normTela(t);
  let alvo = lista.find((t) => t.chave === evolTalhao) || null;
  if (!alvo && evolTalhao !== '*') alvo = lista[0] || null;
  const aps = alvo ? c.aps.filter((a) => chave(a.fazenda, a.talhao) === alvo.chave) : c.aps;
  const chuva = ((c.clima.find((x) => alvo && mesmaFazenda(x.fazenda, alvo.fazenda)) || c.clima[0] || {}).dias) || [];
  const cultura = culturaDe(alvo && alvo.cultura) || culturaDe((c.ts.find((t) => t.cultura) || {}).cultura);
  const svg = svgEvolucao({ cultura: cultura || 'soja', plantio: alvo ? alvo.plantio : null, aps, chuva, hoje: dossie.hoje });
  const chips = compacto ? '' : `<div class="chips-talhao">${lista.slice(0, 14).map((t) => `<button data-acao="evol" data-valor="${esc(t.chave)}" class="${alvo && t.chave === alvo.chave ? 'on' : ''}">${esc(t.talhao)}${t.plantio ? ' <b style="color:#8fc04a">●</b>' : ''}${t.n ? ` · ${t.n}` : ''}</button>`).join('')}<button data-acao="evol" data-valor="*" class="${!alvo ? 'on' : ''}">todas as aplicações</button></div>`;
  const leg = `<div class="legenda-cor"><span><b style="background:#f9a322"></b>executada</span><span><b style="border:2px dashed #c4ca3c;background:none"></b>planejada</span><span><b style="background:#7fb6d6"></b>chuva (satélite)</span>${cultura ? `<span>estádios de referência · ${cultura === 'algodao' ? 'algodão' : cultura}, ciclo médio</span>` : '<span>cultura não cadastrada: régua da soja</span>'}</div>`;
  return { titulo: alvo ? `${alvo.talhao}${!dossieFazenda && alvo.fazenda ? ' · ' + alvo.fazenda : ''}` : (dossieFazenda || dossie.cliente), sub: alvo ? [alvo.cultura, alvo.plantio ? 'plantio ' + dataBR(alvo.plantio) : 'sem data de plantio', `${aps.length} aplicações no caderno`].filter(Boolean).join(' · ') : `${aps.length} aplicações`,
    blocos: [X(chips + `<div class="rolagem">${svg}</div>` + leg)], vazio: !lista.length };
}

// ---------------------------------------------------------------------------
// FERTILIDADE ENTRE OS ANOS (evolucao_fertilidade) — sempre um ano separado do
// outro e uma profundidade de cada vez (0-20 primeiro).
// ---------------------------------------------------------------------------
let evolFertSel = { n: 0, prof: null };
function svgSerieFert(serie, faixas, unidade) {
  const W = 1000, H = 330, esq = 56, dir = 90, topo = 24, base = 280;
  const lo = Math.min(...serie.map((s) => s.min)), hi = Math.max(...serie.map((s) => s.max));
  const pad = (hi - lo) * 0.08 || 1, y0 = Math.max(0, lo - pad), y1 = hi + pad;
  const X = (i) => esq + (serie.length === 1 ? (W - esq - dir) / 2 : (i / (serie.length - 1)) * (W - esq - dir));
  const Y = (v) => base - ((v - y0) / (y1 - y0)) * (base - topo);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  // as faixas da escala da casa (limites oficiais), bem apagadas
  for (const f of faixas || []) if (f > y0 && f < y1) s += `<line x1="${esq}" x2="${W - dir}" y1="${Y(f).toFixed(1)}" y2="${Y(f).toFixed(1)}" stroke="rgba(249,163,34,.16)" stroke-dasharray="2 6"/><text x="${W - dir + 6}" y="${(Y(f) + 4).toFixed(1)}" fill="rgba(249,163,34,.6)" font-size="11" font-family="Menlo,monospace">${num(f, 1)}</text>`;
  const caminho = (k) => serie.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p[k]).toFixed(1)}`).join(' ');
  const faixa = (a, b) => serie.length > 1 ? `${caminho(a)} ${serie.slice().reverse().map((p, i) => `L${X(serie.length - 1 - i).toFixed(1)},${Y(p[b]).toFixed(1)}`).join(' ')} Z` : '';
  s += `<path d="${faixa('p90', 'p10')}" fill="rgba(196,202,60,.14)"/>`;
  s += `<path d="${caminho('mediana')}" fill="none" stroke="#e1d49b" stroke-width="1.5" stroke-dasharray="5 4" opacity=".8"/><path d="${caminho('media')}" fill="none" stroke="#f9a322" stroke-width="3"/>`;
  serie.forEach((p, i) => {
    s += `<g><title>${p.ano} · ${p.profundidade} cm · média ${num(p.media, 2)} · mediana ${num(p.mediana, 2)} · mín ${num(p.min, 1)} · máx ${num(p.max, 1)} · n=${p.n}${p.fonte === 'grade' ? ' (grade de amostragem)' : ''}</title>` +
      `<line x1="${X(i)}" x2="${X(i)}" y1="${Y(p.max)}" y2="${Y(p.min)}" stroke="rgba(196,202,60,.35)"/><circle cx="${X(i)}" cy="${Y(p.media)}" r="7" fill="#f9a322"/>` +
      `<text x="${X(i)}" y="${Y(p.media) - 14}" fill="#f1e9c4" font-size="17" font-weight="700" text-anchor="middle">${num(p.media, 1)}</text>` +
      `<text x="${X(i)}" y="${base + 26}" fill="#c4ca3c" font-size="16" font-weight="700" text-anchor="middle" font-family="Menlo,monospace">${p.ano}${p.fonte === 'grade' ? '*' : ''}</text></g>`;
  });
  s += `<line x1="${esq}" x2="${W - dir}" y1="${base}" y2="${base}" stroke="rgba(196,202,60,.35)"/><text x="${esq - 8}" y="${topo + 4}" fill="#b3a97a" font-size="11" text-anchor="end" font-family="Menlo,monospace">${esc(unidade || '')}</text>`;
  return s + '</svg>';
}
const SETA = { subindo: '<b style="color:#8fc04a">↑ subiu</b>', caindo: '<b style="color:#ff8a6b">↓ caiu</b>', estavel: '<span style="color:var(--mudo)">→ estável</span>', um_ano: '<span style="color:var(--mudo)">só 1 ano</span>' };
function blocosEvolFert(r) {
  const nut = r.nutrientes[Math.min(evolFertSel.n, r.nutrientes.length - 1)];
  const profs = nut.profundidades.map((p) => p.profundidade);
  const prof = profs.includes(evolFertSel.prof) ? evolFertSel.prof : profs[0];
  const s = nut.profundidades.find((p) => p.profundidade === prof);
  const chipsN = `<div class="chips-talhao">${r.nutrientes.map((n, i) => `<button data-acao="evf-n" data-valor="${i}" class="${n === nut ? 'on' : ''}">${esc(n.parametro)}</button>`).join('')}<span style="width:12px"></span>${profs.map((p) => `<button data-acao="evf-p" data-valor="${esc(p)}" class="${p === prof ? 'on' : ''}">${esc(p)} cm</button>`).join('')}</div>`;
  if (!s || !s.serie.length) return { titulo: nut.parametro, blocos: [X(chipsN), NT('Sem dado nesta profundidade.')] };
  const f = s.fazenda, rt = s.resumo_talhoes;
  // 03/out/2026 — João: "diminuir as escritas em cima, para caber o gráfico" — os fatos numa linha só
  const fatos = f ? `<div class="fatos"><b>${num(f.de, 1)} → ${num(f.ate, 1)}</b><span>${f.de_ano} → ${f.ate_ano}</span><span class="${f.tendencia === 'subindo' ? 'alta' : f.tendencia === 'caindo' ? 'baixa' : ''}">${f.pct == null ? '' : (f.pct > 0 ? '+' : '') + num(f.pct, 0) + '% · '}${f.tendencia === 'estavel' ? 'estável' : f.tendencia}${f.oscilou ? ' · oscilou' : ''}</span>${rt.subindo + rt.caindo + rt.estaveis ? `<span>talhões: ${rt.subindo}↑ ${rt.caindo}↓ ${rt.estaveis}→</span>` : ''}</div>`
    : `<div class="fatos"><b>${num(s.serie[0].media, 1)}</b><span>${s.serie[0].ano} · só um ano</span></div>`;
  const linhas = s.talhoes.map((t) => ({ alerta: t.tendencia === 'caindo', cel: [esc(t.talhao) + (r.fazenda ? '' : `<div class="nota" style="margin:0">${esc(t.fazenda)}</div>`),
    t.de != null ? `${num(t.de, 1)} <small>(${t.de_ano})</small>` : (t.anos[0] ? `${num(t.anos[0].media, 1)} <small>(${t.anos[0].ano})</small>` : '—'),
    t.ate != null ? `${num(t.ate, 1)} <small>(${t.ate_ano})</small>` : '—', t.pct != null ? `${t.pct > 0 ? '+' : ''}${num(t.pct, 0)}%` : '—', SETA[t.tendencia] || '', t.mudou_de_faixa ? `${esc(t.mudou_de_faixa.de)} → ${esc(t.mudou_de_faixa.para)}` : ''] }));
  return { titulo: `${nut.parametro} · ${prof} cm`, sub: `${s.serie.map((x) => x.ano).join(' · ')}${s.serie.some((x) => x.fonte === 'grade') ? ' · * só a grade de amostragem' : ''} · laranja: média · tracejado: mediana · faixa: 10–90% dos pontos · traço vertical: mín–máx`,
    blocos: [X(chipsN + fatos), X(svgSerieFert(s.serie, nut.faixas, nut.unidade)), ...(linhas.length ? [T(['Talhão', 'Primeiro', 'Último', 'Δ', 'Tendência', 'Faixa da escala'], linhas, [1, 2, 3])] : []),
      NT('Cada número é de UM ano e UMA profundidade. "Estável" = mudou menos de 10% ou dentro do ruído da amostragem.')] };
}
function acaoEvolFert(acao, valor, el) {
  if (acao === 'evf-n') evolFertSel = { n: +valor, prof: null }; else if (acao === 'evf-p') evolFertSel = { ...evolFertSel, prof: valor }; else return;
  const b = blocosEvolFert(el._corpo._r);
  el._parte.blocos = el._corpo.blocos = b.blocos; el._parte.titulo = b.titulo; el._parte.sub = b.sub;
  el.querySelector('.titulo').textContent = b.titulo; el.querySelector('.sub').textContent = b.sub || '';
  el.querySelector('.corpo').innerHTML = b.blocos.map((x) => htmlDoBloco(x, el === focado)).join('');
}
DESENHOS.evolucao_fertilidade = (r) => {
  const onde = r.fazenda || r.cliente;
  if (r.tipo === 'anos') {
    evolFertSel = { n: 0, prof: null };
    const b = blocosEvolFert(r);
    return { rotulo: `Fertilidade entre os anos · ${onde}${r.talhao ? ' · talhão ' + r.talhao : ''}`, titulo: b.titulo, sub: b.sub, blocos: b.blocos, acao: acaoEvolFert, largo: true, compacto: true, _r: r };
  }
  if (r.tipo === 'profundidades') return { rotulo: `Profundidades · ${onde}`, titulo: `Análise de ${(r.nutrientes[0] || {}).ano ?? ''}`, largo: true,
    blocos: r.nutrientes.map((n) => T([`${n.parametro} · ${n.ano}`, 'Média', 'Mediana', 'Mín', 'Máx', 'n'], n.profundidades.map((p) => [`${esc(p.profundidade)} cm`, num(p.media, 2), num(p.mediana, 2), num(p.min, 1), num(p.max, 1), p.n]), [1, 2, 3, 4, 5])) };
  if (r.tipo === 'talhoes') return { rotulo: `Talhões · ${onde}`, titulo: `${(r.nutrientes[0] || {}).parametro || ''} · ${(r.nutrientes[0] || {}).ano ?? ''}`, largo: true,
    blocos: r.nutrientes.flatMap((n) => n.por_profundidade.map((pp) => T([`${n.parametro} · ${pp.profundidade} cm · ${pp.ano}`, 'Média', 'Mín', 'Máx', 'n'], pp.talhoes.map((t) => [esc(t.talhao), num(t.media, 2), num(t.min, 1), num(t.max, 1), t.n]), [1, 2, 3, 4]))) };
  if (r.tipo === 'fazendas') return { rotulo: `Fazendas · ${onde}`, titulo: 'Cada fazenda no último ano dela', largo: true,
    blocos: r.nutrientes.flatMap((n) => n.por_profundidade.map((pp) => T([`${n.parametro} · ${pp.profundidade} cm`, 'Ano', 'Média', 'Mín', 'Máx'], pp.fazendas.map((f) => [esc(f.fazenda), f.ano, num(f.media, 2), num(f.min, 1), num(f.max, 1)]), [2, 3, 4]))) };
  return desenhoUltimoAno(r, onde);
};

// ---------------------------------------------------------------------------
// O ÚLTIMO ANO — "esse fósforo é adequado?" (04/out/2026)
// João, na Pato Branco I: a tela abriu "2026 · grade de amostragem" no título e uma tabela crua
// (média/mín/máx/n) — "retângulo esquisito", sem dizer se estava adequado. Agora: o título é o
// LUGAR (fazenda inteira ou talhão — nunca o nome do registro da grade), e cada camada traz a
// classe da média (baixo/adequado/alto na escala da casa) e a barra com a % dos pontos em cada
// classe. Camada sem escala (0-10, 20-40) diz isso e não classifica. A régua vem do servidor
// (fertilidade-anos.ts › interpretacaoDaCasa); aqui só se desenha.
// ---------------------------------------------------------------------------
const COR_CLASSE = { baixo: '#ff8a6b', adequado: '#8fc04a', alto: '#c4ca3c' };
/** O lugar sem nenhum rótulo de registro da grade (servidor antigo sem `titulo`). */
const semGrade = (s) => String(s || '').replace(/grade de amostragem/gi, '').replace(/\s*·\s*$/, '').trim();
function tituloUltimoAno(r) {
  const t = semGrade(r.titulo);
  if (t) return t;
  const faz = semGrade(r.fazenda), tal = semGrade(r.talhao);
  return faz ? `${faz} · ${tal ? 'talhão ' + tal : 'fazenda inteira'}` : `${semGrade(r.cliente) || 'Cliente'} · todas as fazendas`;
}
function linhaLeitura(x, camadaSemEscala = false) {
  const i = x.interpretacao;
  // camada inteira sem escala: o aviso vai UMA vez no cabeçalho; a linha fica só com os números
  if (camadaSemEscala) return `<div class="lt-linha"><span class="lt-nome">${esc(x.nutriente)}</span><b class="lt-media">${num(x.media, x.media < 10 ? 2 : 1)}</b><span class="lt-classe sem">sem classe</span><span class="lt-sem">mín ${num(x.min, 1)} · máx ${num(x.max, 1)} · ${x.n} pontos</span></div>`;
  const nome = `<span class="lt-nome">${esc(x.nutriente)}</span>`;
  const media = `<b class="lt-media">${num(x.media, x.media < 10 ? 2 : 1)}</b>`;
  const faixa = `<span class="lt-faixa">mín ${num(x.min, 1)} · máx ${num(x.max, 1)} · ${x.n} pontos</span>`;
  if (!i || !i.escala) return `<div class="lt-linha">${nome}${media}<span class="lt-classe sem">sem escala</span><span class="lt-sem">${esc(i && i.motivo === 'camada' ? 'sem escala da casa para esta camada' : (i ? i.frase.split(': ').slice(1).join(': ') : 'sem escala da casa'))}</span>${faixa}</div>`;
  const barra = i.distribuicao.map((d) => d.pct ? `<i style="flex:${d.pct};background:${COR_CLASSE[d.classe]}" title="${d.classe}: ${d.n} pontos (${d.pct}%)">${d.pct >= 20 ? `${d.pct}% ${d.classe}` : `${d.pct}%`}</i>` : '').join('');
  return `<div class="lt-linha">${nome}${media}<span class="lt-classe" style="color:${COR_CLASSE[i.classe_media]};border-color:${COR_CLASSE[i.classe_media]}">${esc(i.classe_media)}</span>` +
    `<span class="lt-barra">${barra}</span>` +
    `<span class="lt-faixa"><b>${i.distribuicao[1].pct + i.distribuicao[2].pct}% dos pontos adequado/alto</b> · mín ${num(x.min, 1)} · máx ${num(x.max, 1)} · ${x.n} pontos · baixo ≤ ${num(i.baixo_ate, 1)}, alto ≥ ${num(i.alto_a_partir, 1)}${i.unidade ? ' ' + esc(i.unidade) : ''}</span></div>`;
}
function desenhoUltimoAno(r, onde) {
  const u = r.resumo || {};
  const pps = u.por_profundidade || [];
  const temLeitura = pps.some((pp) => pp.nutrientes.some((x) => x.interpretacao));
  const daGrade = /grade/i.test(u.fonte || '');
  const rodape = `${u.ano ?? ''} · ${daGrade ? 'coleta em grade (a fazenda inteira, sem talhão)' : 'análise dos talhões'} · uma camada por linha, nada misturado`;
  if (!temLeitura) {
    // servidor antigo (sem a leitura): a tabela de sempre, com o título já sem a grade
    return { rotulo: `Análise de ${u.ano ?? ''} · ${onde}`, titulo: tituloUltimoAno(r), sub: rodape, largo: true,
      blocos: pps.map((pp) => T([`${pp.profundidade} cm · ${pp.ano}`, 'Média', 'Mín', 'Máx', 'n'], pp.nutrientes.filter((x) => !x.ausente).map((x) => [esc(x.nutriente), num(x.media, 2), num(x.min, 1), num(x.max, 1), x.n]), [1, 2, 3, 4])) };
  }
  const html = pps.map((pp) => {
    const nut = pp.nutrientes.filter((x) => !x.ausente);
    const semEscala = nut.length > 0 && nut.every((x) => x.interpretacao && x.interpretacao.motivo === 'camada');
    return `<div class="lt-camada${semEscala ? ' sem-escala' : ''}"><div class="lt-cab">${esc(pp.profundidade)} cm · ${pp.ano}${semEscala ? ' <span>— sem escala da casa para esta camada</span>' : ''}</div>` +
      nut.map((x) => linhaLeitura(x, semEscala)).join('') + '</div>';
  }).join('');
  const leg = `<div class="legenda-cor">${Object.entries(COR_CLASSE).map(([c, cor]) => `<span><b style="background:${cor}"></b>${c}</span>`).join('')}<span>escala da casa (limites InCeres, veredito da tela Fertilidade) · só na 0-20</span></div>`;
  return { rotulo: `Análise de ${u.ano ?? ''} · ${onde}`, titulo: tituloUltimoAno(r), sub: rodape, largo: true,
    blocos: [X(`<div class="leitura-solo">${html}</div>${leg}`)] };
}

export {
  ESTADIOS, culturaDe, estadioNoDia, plantinha, talhoesDaEvolucao, blocosDaEvolucao,
};
