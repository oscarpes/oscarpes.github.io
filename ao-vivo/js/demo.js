// OSCARPES AO VIVO — demo.js
// DEMO (?demo): respostas e mapas INVENTADOS para conferir o desenho sem servidor (a página é
// pública: nada de cliente de verdade aqui).
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import './controle.js?v=20261010213811';
import { dataBR } from './base.js?v=20261010213811';
import { norm } from './ouvido.js?v=20261010213811';
import { somaDias } from './fazenda.js?v=20261010213811';

// ---------------------------------------------------------------------------
// DEMO (?demo) — só para conferir o desenho, sem servidor. DADOS INVENTADOS
// (a página é pública: nada de cliente de verdade aqui). Perguntas que abrem
// várias janelas: "resumo do dia" (4), "mapa de fósforo" (mapa + fertilidade),
// "chuva" (2), "estoque" (lista longa repartida), "contas".
// ---------------------------------------------------------------------------
const DEMO_TELAS = {
  monit: () => ({ ferramenta: 'painel_do_monitoramento', resultado: { fazenda: 'Fazenda Exemplo', data: '2026-10-02', painel: { fazenda: 'Fazenda Exemplo', titulo: 'Avaliação de plantio — soja', autor: 'Monitor Exemplo', data: '02/10/2026', pontos: 17, fotos: 17,
    mediasGerais: [{ rotulo: 'plantas/m', unidade: 'plantas/m', texto: '9,8', talhoes: 10 }, { rotulo: 'CV', unidade: '%', texto: '44,7', talhoes: 9 }],
    talhoes: [['Talhão 1', 'semeadura', '10,1', '39,0'], ['Talhão 2', 'semeadura', '9,5', '58,1'], ['Talhão 3', 'semeadura', '11,2', '43,2'], ['Talhão 4', 'emergência', '8,7', '41,5'], ['Talhão 5', 'emergência', '10,4', '36,8'], ['Talhão 6', 'semeadura', '9,9', '47,0'], ['Talhão 7', 'emergência', '9,1', '52,3'], ['Talhão 8', 'semeadura', '10,6', '38,9'], ['Talhão 9', 'emergência', '9,2', '46,1'], ['Talhão 10', 'semeadura', '9,6', '44,2']]
      .map(([nome, fase, pm, cv]) => ({ nome, fase, medidas: [{ rotulo: 'plantas/m', unidade: 'plantas/m', texto: pm }, { rotulo: 'CV', unidade: '%', texto: cv }], ocorrencias: [] })),
    alvos: [{ nome: 'Milho voluntário (tiguera)', pontos: 1 }], correcoes: ['Desfolha causada por vento — não foi encontrada lagarta.'] } } }),
  clima: () => ({ ferramenta: 'clima_da_fazenda', resultado: { periodo: 'últimos 7 dias', de: '26/09', ate: '02/10', fazendas: [{ fazenda: 'Fazenda Exemplo', balanco_acumulado_mm: 9, resumo: { chuvaTotal: 38.4, diasComChuva: 3, tmax: 33.1, ventoMed: 7 }, dias: ['26/09', '27/09', '28/09', '29/09', '30/09', '01/10', '02/10'].map((dia, i) => ({ dia, chuva_mm: [0, 4.2, 0, 21.3, 12.9, 0, 0][i] })) }] } }),
  satelite: () => ({ ferramenta: 'chuva_satelite', resultado: { periodo: 'últimos 7 dias', fazendas: [{ fazenda: 'Fazenda Exemplo', satelite_total_mm: 38.4, lancado_total_mm: 41, dias_lancados: 3, dias: ['26/09', '27/09', '28/09', '29/09', '30/09', '01/10', '02/10'].map((dia, i) => ({ dia, satelite_mm: [0, 4.2, 0, 21.3, 12.9, 0, 0][i], lancado_mm: [null, 5, null, 22, 14, null, null][i] })) }] } }),
  contas: () => ({ ferramenta: 'contas_a_pagar_erp', resultado: { total_em_aberto_rs: 89120, titulos_em_aberto: 7, total_vencido_rs: 3200, titulos_vencidos: 1, total_da_janela_rs: 85920, contas_vencidas: [{ fornecedor: 'Fornecedor C', vencimento: '2026-09-30', valor_rs: 3200, vencida: true }], contas_da_janela: [{ fornecedor: 'Fornecedor A', vencimento: '2026-10-03', valor_rs: 29000 }, { fornecedor: 'Fornecedor B', vencimento: '2026-10-05', valor_rs: 42000 }, { fornecedor: 'Fornecedor D', vencimento: '2026-10-06', valor_rs: 8720 }, { fornecedor: 'Fornecedor E', vencimento: '2026-10-08', valor_rs: 6200 }] } }),
  agenda: () => ({ ferramenta: 'minha_agenda', resultado: { dias: 3, resumo_contado: { lembretes_em_aberto: 4, contas_e_boletos: 7, esperando_o_sim: 1, obrigacoes_fiscais_atrasadas: 0 }, agenda: 'Hoje 14h — visita na Fazenda Exemplo (talhões 2 e 9)\nAmanhã 8h — coleta de solo, grade de 5 ha\nSábado — fechar o pedido de sementes' } }),
  fert: () => ({ ferramenta: 'fertilidade_fazenda', resultado: { fazenda: 'Fazenda Exemplo', cliente: 'Produtor Exemplo', amostras: 64, talhoes_do_mapa_fixo: 10, analises_importadas: 2,
    principais: [['P (mg/dm³)', 6, 41, 18.2], ['K (mg/dm³)', 38, 160, 82], ['Ca (cmolc)', 1.2, 4.8, 2.9], ['Mg (cmolc)', 0.4, 1.6, 0.9], ['V%', 31, 72, 54], ['MO (g/dm³)', 18, 39, 27]].map(([nutriente, minimo, maximo, media]) => ({ nutriente, minimo, maximo, media })) } }),
  estoque: () => ({ ferramenta: 'estoque_fazenda', resultado: { valor_total_em_estoque_rs: 412300, abaixo_do_minimo: 3, produtos: ['Herbicida A', 'Herbicida B', 'Fungicida A', 'Fungicida B', 'Inseticida A', 'Inseticida B', 'Adjuvante', 'Semente soja A', 'Semente soja B', 'Ureia', 'KCl', 'MAP', 'Calcário', 'Gesso', 'Óleo mineral', 'Micronutriente'].map((produto, i) => ({ produto, saldo: 40 + i * 13, unidade: i > 8 ? 't' : 'L', valor_em_estoque_rs: 9000 + i * 3100, abaixo_do_minimo: [2, 7, 12].includes(i) })) } }),
};
/** Mapa de fertilidade INVENTADO (fundo branco, como o do servidor) — para ver o vidro na imagem. */
function mapaDemo() {
  const c = document.createElement('canvas'); c.width = 900; c.height = 620; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 900, 620);
  const contorno = [[120, 120], [520, 80], [700, 160], [740, 420], [560, 540], [200, 520], [90, 330]];
  x.save(); x.beginPath(); contorno.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.clip();
  const cor = (v) => { const p = [[0, [215, 48, 39]], [0.35, [252, 141, 89]], [0.55, [254, 224, 139]], [0.75, [145, 207, 96]], [1, [26, 152, 80]]];
    for (let i = 1; i < p.length; i++) if (v <= p[i][0]) { const [a, ca] = p[i - 1], [b, cb] = p[i], f = (v - a) / (b - a); return `rgb(${ca.map((q, k) => Math.round(q + (cb[k] - q) * f)).join(',')})`; } return 'rgb(26,152,80)'; };
  for (let yy = 60; yy < 560; yy += 8) for (let xx = 80; xx < 760; xx += 8) {
    const v = 0.5 + 0.28 * Math.sin(xx / 95) * Math.cos(yy / 70) + 0.2 * Math.sin((xx + yy) / 160);
    x.fillStyle = cor(Math.max(0, Math.min(1, v))); x.fillRect(xx, yy, 8, 8);
  }
  x.restore();
  x.strokeStyle = '#222'; x.lineWidth = 2.5; x.beginPath(); contorno.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.stroke();
  x.fillStyle = '#111'; x.font = 'bold 26px Arial'; x.fillText('Fósforo (P) — Fazenda Exemplo', 40, 44);
  x.font = '16px Arial'; ['> 30', '20–30', '12–20', '6–12', '< 6'].forEach((t, i) => { x.fillStyle = cor(1 - i * 0.25); x.fillRect(780, 200 + i * 34, 26, 22); x.fillStyle = '#111'; x.fillText(t, 814, 217 + i * 34); });
  x.fillText('mg/dm³', 780, 186);
  return c.toDataURL('image/png').split(',')[1];
}
/** Mapa de fertilidade INVENTADO no formato do servidor (1080×1080, fundo verde da marca) —
 *  o mesmo tamanho que cortava na janela pequena; serve para conferir que agora aparece INTEIRO. */
// tema (03/out/2026): o mapa inventado do demo usa as cores do tema (no padrão, as mesmas de sempre)
const cDemo = (c) => (window.TEMA_TROCA ? window.TEMA_TROCA(c) : c);
function mapaDemoQuadrado(nome, semente) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1080; const x = c.getContext('2d');
  x.fillStyle = cDemo('#26350a'); x.fillRect(0, 0, 1080, 1080); x.fillStyle = cDemo('#1b2704'); x.fillRect(0, 0, 1080, 104);
  x.fillStyle = cDemo('#f1e9c4'); x.font = 'bold 34px Arial'; x.fillText(`${nome} — Fazenda Exemplo`, 60, 52);
  x.fillStyle = cDemo('#f9a322'); x.font = '22px Arial'; x.fillText('10 talhões · 160 pontos', 60, 88);
  const contorno = [[150, 170], [640, 130], [930, 260], [960, 700], [700, 880], [260, 860], [110, 520]];
  x.save(); x.beginPath(); contorno.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.clip();
  const PAL = ['#001b86', '#0029c4', '#0079c6', '#03fd4f', '#04cb4e', '#fdfc51', '#ffd244', '#fd9e39', '#ff8532', '#ff041f'];
  for (let yy = 120; yy < 900; yy += 10) for (let xx = 100; xx < 980; xx += 10) {
    const v = 0.5 + 0.3 * Math.sin(xx / (80 + semente * 9) + semente) * Math.cos(yy / 75) + 0.18 * Math.sin((xx + yy) / 150 + semente);
    x.fillStyle = PAL[Math.max(0, Math.min(9, Math.floor(v * 10)))]; x.fillRect(xx, yy, 10, 10);
  }
  x.restore(); x.strokeStyle = cDemo('#f1e9c4'); x.lineWidth = 3; x.beginPath(); contorno.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.stroke();
  PAL.forEach((cor, i) => { x.fillStyle = cor; x.fillRect(60 + i * 96, 944, 97, 26); });
  x.fillStyle = cDemo('#f1e9c4'); x.font = '20px Arial'; x.fillText('média 18,2 · mín 6 · máx 41', 400, 1000);
  return c.toDataURL('image/png').split(',')[1];
}
/** O DOSSIÊ INVENTADO (página pública: nenhum cliente de verdade). Grupo com 3 fazendas. */
function dossieDemo(escopo, secao) {
  const hoje = new Date().toISOString().slice(0, 10), d = (n) => somaDias(hoje, n);
  let sem = 7; const rnd = () => ((sem = (sem * 9301 + 49297) % 233280) / 233280);
  const FAZ = [['Fazenda Exemplo', -13.2, -56.1, 4, 3], ['Fazenda Modelo II', -13.05, -55.8, 3, 3], ['Sítio Ilustrativo', -12.9, -56.3, 3, 2]];
  const talhoes = [];
  FAZ.forEach(([faz, lat, lon, cols, linhas], fi) => {
    let n = 1;
    for (let r = 0; r < linhas; r++) for (let c = 0; c < cols; c++) {
      const a = lat - r * 0.012, b = lon + c * 0.014, j = () => (rnd() - 0.5) * 0.002;
      talhoes.push({ fazenda: faz, talhao: String(n).padStart(2, '0'), area_ha: Math.round(110 + rnd() * 140), cultura: fi === 1 && n > 5 ? 'Milho' : 'Soja', safra: '2026-2027',
        plantio: fi === 0 && n <= 6 ? d(-34 - n) : fi === 1 && n <= 2 ? d(-12) : null, tem_analise: rnd() > 0.2,
        contorno: [[a + j(), b + j()], [a + j(), b + 0.0125 + j()], [a - 0.0105 + j(), b + 0.0128 + j()], [a - 0.011 + j(), b + j()]] });
      n++;
    }
  });
  const fazendas = FAZ.map(([faz, lat, lon]) => { const ts = talhoes.filter((t) => t.fazenda === faz); return { fazenda: faz, talhoes: ts.length, area_ha: ts.reduce((s, t) => s + t.area_ha, 0), com_analise: ts.filter((t) => t.tem_analise).length, com_plantio: ts.filter((t) => t.plantio).length, centro: [lat, lon] }; });
  const fertilidade = talhoes.filter((t) => t.tem_analise).map((t) => ({ fazenda: t.fazenda, talhao: t.talhao, ano: Number(hoje.slice(0, 4)) - 1, dia: d(-200), profundidade: '0-20 cm', amostras: 8, ph: +(4.7 + rnd() * 1.2).toFixed(2), v: Math.round(35 + rnd() * 35), p: +(6 + rnd() * 30).toFixed(1), k: +(0.08 + rnd() * 0.3).toFixed(2), mo: +(18 + rnd() * 18).toFixed(1), origem: 'app' }));
  const PRODS = [['Glifosato 480', 2, 'L/ha'], ['Fungicida A', 0.5, 'L/ha'], ['Inseticida B', 0.2, 'L/ha'], ['Adjuvante', 30, 'mL/ha'], ['Cloreto de potássio', 150, 'kg/ha'], ['Herbicida pré', 1.5, 'L/ha']];
  const aplicacoes = [];
  for (const t of talhoes.filter((x) => x.plantio || rnd() > 0.6)) {
    const base = t.plantio || d(-20);
    [[-8, 0, 3], [-1, 5, 4], [18, 1, 3], [32, 2, 3], [48, 1, 3], [65, 2, 3]].forEach(([dd, a, b]) => {
      const dia = somaDias(base, dd), ex = dia <= hoje;
      aplicacoes.push({ fazenda: t.fazenda, talhao: t.talhao, dia, situacao: ex ? 'executada' : 'planejada', tipo: dd < 0 ? 'dessecante' : 'outro', etapa: null, area_ha: t.area_ha, safra: '2026-2027',
        produtos: [PRODS[a], PRODS[b]].map(([produto, dose, unidade]) => ({ produto, dose, unidade })) });
    });
  }
  const dias30 = Array.from({ length: 31 }, (_, i) => { const iso = d(i - 31); return { dia: dataBR(iso), mm: rnd() < 0.7 ? 0 : Math.round(rnd() * 32 * 10) / 10 }; });
  const clima = FAZ.map(([faz]) => { const dias = dias30.map((x) => ({ ...x, mm: x.mm == null ? null : Math.round(x.mm * (0.7 + rnd() * 0.6) * 10) / 10 })); const s = (n) => Math.round(dias.slice(-n).reduce((a, b) => a + (b.mm || 0), 0) * 10) / 10; return { fazenda: faz, dias, chuva_7d_mm: s(7), chuva_30d_mm: s(31), balanco_mm: -18, dias_com_dado: 31 }; });
  const estoque = ['Glifosato 480', 'Fungicida A', 'Inseticida B', 'Adjuvante', 'Óleo mineral', 'Semente soja A', 'Cloreto de potássio', 'Ureia', 'Herbicida pré'].flatMap((produto, i) => FAZ.slice(0, 2).map(([faz], k) => ({ fazenda: faz, produto, unidade: i > 5 ? 'kg' : 'L', saldo: (i + k) % 4 === 0 ? 0 : Math.round(rnd() * 900), minimo: 100, entradas: 1000, saidas: 600, ultimo: d(-3 - i) })));
  const D = {
    versao: 1, escopo: escopo === 'fazenda' ? 'fazenda' : 'cliente', cliente: 'Grupo Exemplo', fazenda: escopo === 'fazenda' ? 'Fazenda Exemplo' : null, hoje, secao_inicial: secao || 'resumo',
    secoes: ['resumo', 'talhoes', 'fertilidade', 'fertilidade_anos', 'monitoramento', 'aplicacoes', 'evolucao', 'clima', 'estoque', 'laboratorio', 'financeiro'],
    frase: 'Soja plantada em 6 talhões da Fazenda Exemplo; 2 visitas abertas e 5 produtos zerados pedem atenção.',
    fazendas, talhoes, fertilidade, anos_de_analise: { 'Fazenda Exemplo': [2023, 2024, 2025], 'Fazenda Modelo II': [2024, 2025], 'Sítio Ilustrativo': [2025] },
    monitoramento: { visitas: 14, abertas: 2, ultima_visita: d(-1),
      alvos: [['Lagarta (exemplo)', 'praga', 5, 12], ['Buva', 'daninha', 4, 9], ['Percevejo (exemplo)', 'praga', 3, 6], ['Ferrugem (exemplo)', 'doenca', 1, 2]].map(([nome, categoria, visitas, pontos]) => ({ nome, categoria, visitas, pontos })),
      talhoes: [],
      paineis: [{ fazenda: 'Fazenda Exemplo', data: d(-1), titulo: 'Avaliação de plantio — soja', autor: 'Monitor Exemplo',
        medias: [{ rotulo: 'plantas/m', unidade: 'plantas/m', texto: '9,8', talhoes: 6 }, { rotulo: 'CV', unidade: '%', texto: '41,2', talhoes: 6 }],
        talhoes: ['01', '02', '03', '04', '05', '06'].map((nome, i) => ({ nome: 'Talhão ' + nome, fase: i < 3 ? 'V2' : 'V1', medidas: [{ rotulo: 'plantas/m', unidade: 'plantas/m', texto: String(9 + i * 0.3).replace('.', ',') }, { rotulo: 'CV', unidade: '%', texto: String(38 + i * 2) }] })),
        alvos: [{ nome: 'Buva', pontos: 3 }] }],
      abertas_lista: [{ fazenda: 'Fazenda Exemplo', talhao: '03', desde: d(-1) }, { fazenda: 'Fazenda Modelo II', talhao: null, desde: d(-9) }],
      ultimas: [[-1, 'Fazenda Exemplo', '03', true], [-2, 'Fazenda Exemplo', null, false], [-9, 'Fazenda Modelo II', null, true], [-15, 'Sítio Ilustrativo', '02', false]].map(([n, fazenda, talhao, aberta]) => ({ dia: d(n), fazenda, talhao, aberta })) },
    aplicacoes: aplicacoes.sort((a, b) => b.dia.localeCompare(a.dia)),
    clima: { fazendas: clima, de: dias30[0].dia, ate: dias30[30].dia, regra: 'janela de aplicação: vento 3–10 km/h, T ≤ 30 °C, UR ≥ 55 %, chance de chuva ≤ 60 %',
      previsao: { fazenda: 'Fazenda Exemplo', dias: [0, 1, 2, 3, 4].map((n) => { const chance = [20, 75, 40, 10, 65][n], vento = [6, 12, 8, 5, 9][n]; return { data: d(n), chuva_mm: [0, 18, 2, 0, 9][n], chance_pct: chance, tmax: 33, tmin: 21, vento_kmh: vento, chance_de_janela: chance <= 60 && vento <= 10 }; }) } },
    chuva_lancada: [['2026-08', 'Fazenda Exemplo', 0, 0], ['2026-09', 'Fazenda Exemplo', 64, 5], ['2026-09', 'Fazenda Modelo II', 51, 4]].map(([mes, fazenda, mm, dias]) => ({ mes, fazenda, mm, dias })),
    estoque,
    laboratorio: { analises_de_solo: fertilidade.length, outras: [{ matriz: 'Foliar', laudos: 4, amostras: 12, ultimo: d(-40) }], pedidos_encontrados: 6,
      pedidos: [['PED-0101', 'Pronto', 24], ['PED-0098', 'Em análise', 18], ['PED-0090', 'Finalizado', 40]].map(([numero, situacao, amostras], i) => ({ numero, situacao, amostras, entrada: dataBR(d(-10 - i * 12)), material: 'Solo' })) },
    financeiro: { total: 186400, meses: [['2026-07', 'fazenda', 42000], ['2026-08', 'fazenda', 61500], ['2026-09', 'fazenda', 70300], ['2026-09', 'pessoal', 12600]].map(([mes, ambito, total]) => ({ mes, ambito, total, lancamentos: 9 })),
      ultimas: [['Combustível', 'Diesel da semana', 8200], ['Manutenção', 'Peça do pulverizador', 3100], ['Mão de obra', 'Diárias', 5400]].map(([categoria, descricao, valor], i) => ({ data: d(-i * 3), ambito: 'fazenda', categoria, descricao, valor, pago: true })) },
    pede_atencao: ['5 produtos zerados no estoque da Fazenda Exemplo', 'Nota para conferir: Ureia (entrada repetida?)'],
    indisponivel: [],
  };
  if (D.escopo === 'fazenda') {
    const so = (l) => l.filter((x) => x.fazenda === 'Fazenda Exemplo');
    Object.assign(D, { fazendas: so(D.fazendas), talhoes: so(D.talhoes), fertilidade: so(D.fertilidade), aplicacoes: so(D.aplicacoes), estoque: so(D.estoque) });
    D.clima.fazendas = so(D.clima.fazendas);
  }
  return D;
}
/** A evolução INVENTADA (Fazenda Exemplo, 3 anos × 3 camadas) no formato de evolucao_fertilidade. */
function evolFertDemo() {
  const anos = [2023, 2024, 2025], est = (m, n = 80) => ({ n, media: m, mediana: +(m * 0.94).toFixed(1), min: +(m * 0.35).toFixed(1), max: +(m * 2.3).toFixed(1), p10: +(m * 0.55).toFixed(1), p90: +(m * 1.6).toFixed(1), dp: +(m * 0.4).toFixed(1) });
  const P = { '0-20': [31.2, 44.8, 38.6], '0-10': [44.0, 61.5, 52.3], '20-40': [19.5, 27.1, 22.4] }, K = { '0-20': [2.6, 2.9, 3.4], '0-10': [3.5, 3.9, 4.6], '20-40': [1.6, 1.8, 2.0] };
  const nutr = (parametro, base, faixas, unidade) => ({ parametro, unidade, faixas, profundidades: Object.entries(base).map(([prof, ms]) => {
    const serie = anos.map((ano, i) => ({ ano, profundidade: prof, fonte: 'talhões', talhoes: 10, ...est(ms[i]) }));
    const pct = +(((ms[2] - ms[0]) / ms[0]) * 100).toFixed(1);
    return { parametro, profundidade: prof, serie,
      fazenda: { de_ano: 2023, ate_ano: 2025, de: ms[0], ate: ms[2], delta: +(ms[2] - ms[0]).toFixed(2), pct, tendencia: Math.abs(pct) > 10 ? (pct > 0 ? 'subindo' : 'caindo') : 'estavel', acimaDoRuido: true, oscilou: true, maior: 2024, menor: 2023, mudou_de_faixa: null },
      talhoes: Array.from({ length: 10 }, (_, k) => { const a = ms[0] * (0.7 + (k % 5) * 0.12), b = a * (0.82 + ((k * 7) % 9) * 0.06), p2 = +(((b - a) / a) * 100).toFixed(1);
        return { talhao: String(k + 1).padStart(2, '0'), fazenda: 'Fazenda Exemplo', anos: [], de_ano: 2023, ate_ano: 2025, de: +a.toFixed(1), ate: +b.toFixed(1), delta: +(b - a).toFixed(1), pct: p2, tendencia: Math.abs(p2) > 10 ? (p2 > 0 ? 'subindo' : 'caindo') : 'estavel', acimaDoRuido: true,
          mudou_de_faixa: k === 2 ? { de: '27 a 30 mg/dm³', para: '33 a 36 mg/dm³' } : null }; }),
      resumo_talhoes: { subindo: 4, caindo: 3, estaveis: 3, so_um_ano: 0 } };
  }) });
  return { versao: 1, tipo: 'anos', cliente: 'Grupo Exemplo', fazenda: 'Fazenda Exemplo', anos, profundidades: ['0-20', '0-10', '20-40'],
    nutrientes: [nutr('P res', P, [15, 18, 21, 24, 27, 30, 33, 36, 39, 42], 'mg/dm³'), nutr('K', K, [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5], 'mmolc/dm³')] };
}
/** "É adequado?" INVENTADO (Fazenda Exemplo, último ano, 3 camadas) no formato de evolucao_fertilidade › ultimo_ano.
 *  A classe só na 0-20 (a escala da casa não vale para 0-10 e 20-40) — o mesmo formato que o servidor manda. */
function ultimoAnoDemo() {
  const sem = (prof) => ({ escala: false, motivo: 'camada', frase: `${prof} cm · 2025: sem escala da casa para esta camada` });
  const com = (classe, ns, baixo, alto, unidade) => { const t = ns.reduce((a, b) => a + b, 0), pct = ns.map((n) => Math.round((n / t) * 100));
    return { escala: true, unidade, baixo_ate: baixo, alto_a_partir: alto, classe_media: classe, distribuicao: ['baixo', 'adequado', 'alto'].map((c, i) => ({ classe: c, n: ns[i], pct: pct[i] })), frase: '' }; };
  const linha = (nutriente, prof, media, min, max, n, interpretacao) => ({ nutriente, ano: 2025, profundidade: prof, n, media, mediana: media, min, max, p10: min, p90: max, dp: 1, interpretacao });
  return { versao: 1, tipo: 'ultimo_ano', cliente: 'Grupo Exemplo', fazenda: 'Fazenda Exemplo', talhao: null, titulo: 'Fazenda Exemplo · fazenda inteira',
    resumo: { ano: 2025, fonte: 'talhões', profundidade_principal: '0-20', por_profundidade: [
      { ano: 2025, profundidade: '0-20', amostras: 120, talhoes: 10, nutrientes: [linha('P res', '0-20', 27.4, 8.1, 71.0, 120, com('adequado', [22, 61, 37], 19.5, 34.5, 'mg/dm³')), linha('K', '0-20', 1.9, 0.6, 4.4, 120, com('adequado', [18, 96, 6], 1.25, 3.75, 'mmolc/dm³'))] },
      { ano: 2025, profundidade: '0-10', amostras: 40, talhoes: 10, nutrientes: [linha('P res', '0-10', 38.2, 12.0, 90.3, 40, sem('0-10')), linha('K', '0-10', 2.4, 0.9, 5.1, 40, sem('0-10'))] },
      { ano: 2025, profundidade: '20-40', amostras: 40, talhoes: 10, nutrientes: [linha('P res', '20-40', 14.9, 4.2, 33.0, 40, sem('20-40')), linha('K', '20-40', 1.2, 0.4, 2.8, 40, sem('20-40'))] }] } };
}
/** A previsão INVENTADA com o histórico da fazenda (14 dias). */
function previsaoDemo() {
  const hoje = new Date().toISOString().slice(0, 10), d = (n) => somaDias(hoje, n);
  const prev = Array.from({ length: 14 }, (_, i) => { const chance = [10, 20, 70, 85, 40, 15, 10, 30, 60, 75, 50, 20, 15, 35][i], vento = [6, 8, 12, 9, 7, 5, 6, 8, 11, 9, 7, 6, 5, 8][i];
    return { data: d(i + 1), chuva_mm: [0, 0, 8.4, 21.0, 3.2, 0, 0, 1.1, 6.5, 14.2, 4.0, 0, 0, 2.0][i], chance_de_chuva_pct: chance, t_max_c: 33, t_min_c: 21, vento_max_kmh: vento, chance_de_janela: chance <= 60 && vento <= 10 }; });
  const hist = prev.map((x) => ({ data: x.data, media_mm: 4.6, p20_mm: 1.5, p80_mm: 7.9 }));
  const soma = (a, b, k) => +prev.slice(a, b).reduce((s, x) => s + (k === 'p' ? x.chuva_mm : 0), 0).toFixed(1);
  return { lugares: [{ pedido: 'Fazenda Exemplo', lugar: 'Fazenda Exemplo', origem: 'fazenda_do_cadastro', chuva_somada_mm: soma(0, 14, 'p'), previsao: prev,
    historico: { anos: '1981–2025', dias: hist, semanas: [
      { de: prev[0].data, ate: prev[6].data, dias: 7, previsto_mm: soma(0, 7, 'p'), media_historica_mm: 32.2, faixa_tipica_mm: [10.5, 55.3], leitura: 'perto da média' },
      { de: prev[7].data, ate: prev[13].data, dias: 7, previsto_mm: soma(7, 14, 'p'), media_historica_mm: 32.2, faixa_tipica_mm: [10.5, 55.3], leitura: 'abaixo' }] } }],
    regra_janela: 'chance de janela no dia = chance de chuva ≤ 60% e vento máximo ≤ 10 km/h (a hora certa sai no boletim das 6 h)' };
}
async function respostaDemo(t) {
  await new Promise((ok) => setTimeout(ok, 900));
  const n = norm(t);
  if (/(compar|anos|subindo|caindo|diminuindo|aumentando).*(fosforo|fertilidade|potassio)|(fosforo|fertilidade|potassio).*(anos|subindo|caindo|diminuindo|aumentando)/.test(n)) return { texto: 'Na camada de 0 a 20, o fósforo da Fazenda Exemplo foi de 31 em 2023 para 39 em 2025, uma alta de 24%, com pico em 2024. Está na sua tela.',
    telas: [{ ferramenta: 'evolucao_fertilidade', argumentos: {}, resultado: evolFertDemo() }, ...[[2023, 1], [2024, 2], [2025, 3]].map(([ano, k]) => ({ ferramenta: 'imagem', argumentos: {}, resultado: { legenda: `Mapa de P res 0-20 · Fazenda Exemplo · ${ano}`, mime: 'image/png', base64: mapaDemoQuadrado(`P res 0-20 · ${ano}`, k) } }))] };
  if (/adequad|esta bom|ta bom|esta baixo/.test(n)) return { texto: 'Na camada de 0 a 20, em 2025, o fósforo da Fazenda Exemplo tem média 27, adequado; 82% dos pontos estão adequado ou alto. Está na sua tela.',
    telas: [{ ferramenta: 'evolucao_fertilidade', argumentos: {}, resultado: ultimoAnoDemo() }] };
  // o DOSSIÊ (modo fazenda/grupo) e a evolução da lavoura — dados inventados
  if (/tudo sobre|grupo|dossie|fazenda inteira|resumo da fazenda|resumo de tudo/.test(n)) {
    const soFazenda = /fazenda exemplo|resumo da fazenda|fazenda inteira/.test(n) && !/grupo/.test(n);
    return { texto: soFazenda ? 'A Fazenda Exemplo inteira está na sua tela. Duas visitas abertas pedem atenção.' : 'O Grupo Exemplo tem três fazendas, uns 4 mil hectares. O dossiê completo está na sua tela.',
      telas: [{ ferramenta: 'resumo_completo', argumentos: {}, resultado: dossieDemo(soFazenda ? 'fazenda' : 'cliente') }] };
  }
  if (/previs|proxima semana|historic/.test(n)) return { texto: 'Na próxima semana a previsão é de uns 28 milímetros na Fazenda Exemplo; a média dos anos para esses dias é 32. Tende a ficar perto da média.', telas: [{ ferramenta: 'previsao_do_tempo', argumentos: {}, resultado: previsaoDemo() }] };
  if (/aplica|plantio|lavoura|evolu|caderno|plantinha/.test(n)) return { texto: 'A soja do talhão 01 está com uns 35 dias. As aplicações do plano estão na linha da lavoura, na sua tela.', telas: [{ ferramenta: 'resumo_completo', argumentos: {}, resultado: dossieDemo('fazenda', 'evolucao') }] };
  if (/mapas/.test(n)) return { texto: 'Os mapas de fósforo, potássio, pH e matéria orgânica da Fazenda Exemplo estão na sua tela.',
    telas: [['P res 0-20', 1], ['K 0-20', 2], ['pH CaCl2 0-20', 3], ['MOS 0-20', 4]].map(([nome, k]) => ({ ferramenta: 'imagem', argumentos: {}, resultado: { legenda: `Mapa de ${nome} · Fazenda Exemplo · 2025`, mime: 'image/png', base64: mapaDemoQuadrado(nome, k),
      mapa: { fazenda: 'Fazenda Exemplo', talhao: null, ano: 2025, fonte: 'talhões', disponiveis: { parametros: ['P res', 'K', 'Ca', 'Mg', 'S', 'pH CaCl2', 'Al', 'H/Al', 'm%', 'V%', 'CTC', 'SB', 'MOS', 'B', 'Cu', 'Fe', 'Mn', 'Zn', 'Ca/Mg', 'Ca/K', 'Mg/K', 'Argila'], profundidades: ['0-20', '0-10', '20-40'], anos: [{ ano: 2024, fonte: 'talhões' }, { ano: 2025, fonte: 'talhões' }, { ano: 2026, fonte: 'amostragem em grade' }] } } } })) };
  if (/resumo|tudo|geral|bom dia/.test(n)) return { texto: 'Resumo do dia: plantio, chuva, contas e agenda estão na tela.', telas: [DEMO_TELAS.monit(), DEMO_TELAS.clima(), DEMO_TELAS.contas(), DEMO_TELAS.agenda()] };
  if (/mapa|fertilidade|fosforo|potassio/.test(n)) return { texto: 'O mapa de fósforo da Fazenda Exemplo está na tela. A média ficou em 18 miligramas.', telas: [DEMO_TELAS.fert(), { ferramenta: 'imagem', argumentos: {}, resultado: { legenda: 'Fósforo (P) — Fazenda Exemplo', mime: 'image/png', base64: mapaDemo() } }] };
  if (/chuv|clima/.test(n)) return { texto: 'Choveu uns 38 milímetros nos últimos sete dias na Fazenda Exemplo. A maior chuva foi de 21 milímetros, no dia 29.', telas: [DEMO_TELAS.clima(), DEMO_TELAS.satelite()] };
  if (/estoque/.test(n)) return { texto: 'O estoque da Fazenda Exemplo soma uns 412 mil reais. Três produtos estão abaixo do mínimo.', telas: [DEMO_TELAS.estoque()] };
  if (/conta/.test(n)) return { texto: 'Há 7 contas na semana, somando uns 89 mil reais. A maior é a do Fornecedor B, de 42 mil, na segunda.', telas: [DEMO_TELAS.contas()] };
  return { texto: 'Na Fazenda Exemplo a média ficou em 9,8 plantas por metro, com coeficiente de variação médio de 44,7 por cento.', telas: [DEMO_TELAS.monit()] };
}

export {
  mapaDemoQuadrado, evolFertDemo, ultimoAnoDemo, respostaDemo,
};
