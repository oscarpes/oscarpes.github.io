// OSCARPES AO VIVO — desenhos.js
// Os DESENHOS de cada consulta do agente (chuva, monitoramento, fertilidade, contas, agenda,
// estoque, previsão × histórico…) → { rotulo, titulo, sub, blocos }; o gráfico de barras; a imagem
// com fundo transparente (vidro); e o desenho genérico para consulta sem desenho próprio.
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import './comandos.js?v=20261010213811';
import { dataBR, esc, num, reais } from './base.js?v=20261010213811';
import { GB, K, NT, T, TX, X } from './telas.js?v=20261010213811';

// IMAGEM COM TRANSPARÊNCIA (02/out/2026) — João: "a imagem que vc trouxe não
// era moderna igual na versão azul, no modelo com transparência". O mapa de
// fertilidade vem do servidor como PNG de fundo BRANCO (é o mesmo do zap).
// Aqui, só na tela ao vivo: o branco vira transparente e o texto preto/cinza
// vira o creme da marca — o mapa colorido fica "flutuando" no vidro. Foto (sem
// fundo branco nos cantos) fica como veio.
function vidroNaImagem(img) {
  const fazer = () => {
    try {
      const w0 = img.naturalWidth, h0 = img.naturalHeight; if (!w0 || !h0) return;
      const f = Math.min(1, 1600 / Math.max(w0, h0)), w = Math.round(w0 * f), h = Math.round(h0 * f);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h), p = d.data;
      const claro = (i) => p[i] > 232 && p[i + 1] > 232 && p[i + 2] > 232;
      if ([0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4].filter(claro).length < 3) return;
      for (let i = 0; i < p.length; i += 4) {
        const r = p[i], gg = p[i + 1], b = p[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        const luz = (r + gg + b) / 765, sat = mx ? (mx - mn) / mx : 0;
        if (sat < 0.14) { p[i] = 241; p[i + 1] = 233; p[i + 2] = 196; p[i + 3] = Math.round(p[i + 3] * Math.min(1, (1 - luz) * 1.3)); }
        else if (luz > 0.8) p[i + 3] = Math.round(p[i + 3] * Math.min(1, (1 - luz) / 0.2 + sat));
      }
      x.putImageData(d, 0, 0);
      img.src = c.toDataURL('image/png');
    } catch (e) { /* imagem que o navegador não deixa ler: fica como veio */ }
  };
  if (img.complete && img.naturalWidth) fazer(); else img.addEventListener('load', fazer, { once: true });
}

let idGraf = 0;
function graficoBarras(dias, campo, rotulo, cor = '#c4ca3c', extra, todos = false) {
  const id = 'gb' + (++idGraf);
  const vs = dias.map((d) => Number(d[campo]) || 0); const max = Math.max(1, ...vs);
  const W = 640, H = 190, pad = 22, base = H - 28, alto = H - 58, bw = (W - pad * 2) / Math.max(1, dias.length);
  const grade = [0.25, 0.5, 0.75, 1].map((f) => `<line x1="${pad}" x2="${W - pad}" y1="${base - f * alto}" y2="${base - f * alto}" stroke="rgba(196,202,60,.10)" stroke-dasharray="3 5"/>` +
    (todos ? `<text x="${pad - 4}" y="${base - f * alto + 4}" fill="#b3a97a" font-size="10" text-anchor="end" font-family="Menlo,monospace">${num(max * f)}</text>` : '')).join('');
  const barras = dias.map((d, i) => { const v = vs[i], h = (v / max) * alto; const x = pad + i * bw;
    return `<rect x="${x + bw * 0.18}" y="${base - h}" width="${bw * 0.64}" height="${Math.max(h, v > 0 ? 2 : 0)}" rx="3" fill="url(#${id})" filter="url(#${id}b)"><title>${esc(d.dia)}: ${num(v)} ${rotulo}</title></rect>` +
      (v > 0 ? `<rect x="${x + bw * 0.18}" y="${base - h}" width="${bw * 0.64}" height="2" fill="#f1e9c4" opacity=".8"/>` : '') +
      ((todos || v >= max * 0.2) && v > 0 ? `<text x="${x + bw / 2}" y="${base - h - 7}" fill="#f1e9c4" font-size="13" font-weight="700" text-anchor="middle">${num(v)}</text>` : '') +
      ((todos || dias.length <= 16 || i % Math.ceil(dias.length / 12) === 0) ? `<text x="${x + bw / 2}" y="${H - 8}" fill="#b3a97a" font-size="11" text-anchor="middle" font-family="Menlo,monospace">${esc(String(d.dia).slice(0, 5))}</text>` : '');
  }).join('');
  let linha = '';
  if (extra) {
    const pts = dias.map((d, i) => { const v = Number(d[extra]); if (!isFinite(v) || d[extra] == null) return null; return [pad + i * bw + bw / 2, base - (v / max) * alto, v, d.dia]; }).filter(Boolean);
    linha = (pts.length > 1 ? `<polyline points="${pts.map((p) => p[0] + ',' + p[1]).join(' ')}" fill="none" stroke="#f9a322" stroke-width="1.5" opacity=".6"/>` : '') +
      pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#f9a322" filter="url(#${id}b)"><title>${esc(p[3])}: ${num(p[2])} lançado</title></circle>`).join('');
  }
  return `<svg class="graf" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${cor}" stop-opacity=".18"/><stop offset="1" stop-color="${cor}" stop-opacity=".95"/></linearGradient>` +
    `<filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
    `${grade}<line x1="${pad}" x2="${W - pad}" y1="${base}" y2="${base}" stroke="rgba(196,202,60,.35)"/>${barras}${linha}</svg>`;
}

const DESENHOS = {
  // 05/out/2026 (19:02, João: "eu quero ver as fotos que você tem arquivadas dos monitoramentos"): a galeria
  fotos_do_monitoramento(r) {
    const fotos = (r.fotos || []).filter((f) => f && /^https:\/\//.test(String(f.src || '')));
    if (!fotos.length) return { rotulo: 'Fotos', titulo: r.titulo || 'Fotos do monitoramento', blocos: [TX(r.aviso || 'Não há fotos guardadas para isso.')] };
    const quando = r.de && r.ate ? (r.de === r.ate ? r.de.split('-').reverse().join('/') : `${r.de.split('-').reverse().slice(0, 2).join('/')} a ${r.ate.split('-').reverse().slice(0, 2).join('/')}`) : '';
    return { rotulo: 'Fotos', titulo: r.titulo || 'Fotos do monitoramento', sub: `${r.total} foto${r.total === 1 ? '' : 's'}${r.total > fotos.length ? ` · as ${fotos.length} mais recentes` : ''}${quando ? ' · ' + quando : ''}`,
      blocos: [{ tipo: 'fotos', itens: fotos.map((f) => ({ src: f.src, legenda: String(f.legenda || '') })) }] };
  },
  imagem(r) {
    const b64 = String(r.base64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
    if (!b64) return null;
    const mime = /^image\/(png|jpeg|webp)$/.test(r.mime || '') ? r.mime : 'image/png';
    return { rotulo: 'Mapa', titulo: r.legenda || 'Mapa', blocos: [{ tipo: 'imagem', src: `data:${mime};base64,${b64}`, legenda: '' }] };
  },
  painel_do_monitoramento(r) {
    const p = r.painel;
    if (!p) return { rotulo: 'Monitoramento', titulo: r.fazenda || 'Monitoramento', sub: r.data, blocos: [TX(r.texto || 'Sem painel guardado.')] };
    const medias = (p.mediasGerais || []).map((m) => [m.unidade === '%' ? `${m.texto}%` : m.texto, `${m.unidade && m.unidade !== '%' ? m.unidade : m.rotulo} · média de ${m.talhoes}`]);
    const exib = (m) => { const v = m.lista && m.lista.length ? m.lista.join(', ') : m.texto; return m.unidade === '%' ? `${m.rotulo} ${v}%` : `${v} ${m.unidade || m.rotulo}`; };
    const linhas = (p.talhoes || []).map((t) => [`<b>${esc(t.nome)}</b>${t.fase ? `<span class="tag">${esc(t.fase)}</span>` : ''}`, esc((t.medidas || []).map(exib).join(' · ')) + (t.ocorrencias && t.ocorrencias.length ? `<div class="nota" style="margin-top:3px">${esc(t.ocorrencias.join(' · '))}</div>` : '')]);
    return { rotulo: 'Painel do monitoramento', titulo: p.fazenda || r.fazenda, tituloLista: 'Talhões', sub: [p.titulo, p.autor, p.data].filter(Boolean).join(' · '),
      blocos: [K(medias.length ? medias : [[p.pontos, 'pontos'], [p.fotos, 'fotos'], [(p.talhoes || []).length, 'talhões']]),
        ...(linhas.length ? [T(['Talhão', 'Medidas'], linhas)] : []),
        ...((p.alvos || []).length ? [NT(`Visto: ${p.alvos.map((a) => `${a.nome} (${a.pontos} ${a.pontos === 1 ? 'ponto' : 'pontos'})`).join(' · ')}`)] : []),
        ...((p.correcoes || []).length ? [NT(`Correção do monitor: ${p.correcoes[0]}`, 'ouro')] : [])] };
  },
  clima_da_fazenda(r) {
    const f = (r.fazendas || [])[0]; if (!f) return { rotulo: 'Clima', titulo: 'Sem dado de clima', blocos: [NT(r.instrucao || '')] };
    const s = f.resumo || {};
    return { rotulo: 'Clima da fazenda · ' + (r.periodo || ''), titulo: f.fazenda, sub: `${r.de || ''} a ${r.ate || ''}`,
      blocos: [K([[num(s.chuvaTotal) + ' mm', 'chuva'], [s.diasComChuva, 'dias com chuva'], [num(s.tmax, 0) + '°', 'máxima média'], [num(s.ventoMed, 0) + ' km/h', 'vento médio'], [num(f.balanco_acumulado_mm, 0) + ' mm', 'balanço hídrico']]),
        GB(f.dias || [], 'chuva_mm', 'mm'), NT('Chuva por dia (mm), satélite combinado e calibrado.')] };
  },
  chuva_satelite(r) {
    const f = (r.fazendas || [])[0]; if (!f) return null;
    return { rotulo: 'Chuva · satélite × pluviômetro', titulo: f.fazenda, sub: r.periodo,
      blocos: [K([[num(f.satelite_total_mm) + ' mm', 'satélite'], [num(f.lancado_total_mm) + ' mm', 'lançado'], [f.dias_lancados, 'dias lançados']]),
        GB(f.dias || [], 'satelite_mm', 'mm', '#c4ca3c', 'lancado_mm'), NT('Barras: satélite. Pontos laranja: o que foi lançado no pluviômetro.')] };
  },
  chuva_registrada(r) {
    const f = (r.fazendas || [])[0]; if (!f) return { rotulo: 'Chuva lançada', titulo: 'Nada anotado', blocos: [NT('Nenhuma chuva lançada no período.')] };
    return { rotulo: 'Chuva lançada · ' + (r.periodo || ''), titulo: f.fazenda, sub: `${r.de || ''} a ${r.ate || ''}`,
      blocos: [K([[num(f.total_mm) + ' mm', 'total'], [f.dias_com_chuva, 'dias com chuva'], [f.maior_chuva ? `${num(f.maior_chuva.mm)} mm` : '—', f.maior_chuva ? `maior (${f.maior_chuva.dia})` : 'maior']]),
        GB(f.dias || [], 'mm', 'mm', '#e1d49b')] };
  },
  fertilidade_fazenda(r) {
    const lista = (r.principais && r.principais.length ? r.principais : r.nutrientes || []).slice(0, 10);
    const linhas = lista.map((n) => { const lo = Number(n.minimo), hi = Number(n.maximo), me = Number(n.media); const esc0 = Math.max(hi, 0.0001) * 1.08;
      return `<div>${esc(n.nutriente)}</div><div class="trilho"><i style="left:${(lo / esc0) * 100}%;width:${((hi - lo) / esc0) * 100}%"></i><em style="left:${(me / esc0) * 100}%"></em></div><div class="n" style="text-align:right;font-variant-numeric:tabular-nums">${num(me, 2)}</div>`; }).join('');
    return { rotulo: 'Fertilidade do solo', titulo: r.fazenda, sub: `${r.cliente || ''} · ${r.amostras || 0} amostras`,
      blocos: [K([[r.amostras, 'amostras'], [r.talhoes_do_mapa_fixo, 'talhões'], [r.analises_importadas, 'análises']]), X(`<div class="barras-nut">${linhas}</div>`), NT('Faixa: mínimo a máximo da fazenda. Traço laranja: média.')] };
  },
  contas_a_pagar(r) {
    const cs = [...(r.contas_vencidas || []), ...(r.contas_da_janela || [])].slice(0, 60);
    return { rotulo: 'Contas a pagar', titulo: reais(r.total_a_pagar_rs) + ' pendentes', tituloLista: 'Contas', sub: `${r.total_pendentes || 0} contas`,
      blocos: [K([[reais(r.total_vencido_rs), `vencido (${r.vencidas || 0})`], [r.total_da_janela_rs != null ? reais(r.total_da_janela_rs) : null, 'na janela']]),
        T(['Conta', 'Vence', 'Valor'], cs.map((c) => ({ alerta: c.vencida, cel: [esc(c.fornecedor || c.titulo), dataBR(c.vencimento), reais(c.valor_rs)] })), [2])] };
  },
  contas_a_pagar_erp(r) {
    const cs = [...(r.contas_vencidas || []), ...(r.contas_da_janela || [])].slice(0, 60);
    return { rotulo: 'Contas a pagar · ERP', titulo: reais(r.total_em_aberto_rs) + ' em aberto', tituloLista: 'Títulos', sub: `${r.titulos_em_aberto || 0} títulos`,
      blocos: [K([[reais(r.total_vencido_rs), `vencido (${r.titulos_vencidos || 0})`], [r.total_da_janela_rs != null ? reais(r.total_da_janela_rs) : null, 'na janela']]),
        T(['Fornecedor', 'Vence', 'Valor'], (cs.length ? cs : r.maiores_em_aberto || []).map((c) => ({ alerta: c.vencida, cel: [esc(c.fornecedor), dataBR(c.vencimento), reais(c.valor_rs)] })), [2])] };
  },
  contas_a_receber(r) {
    return { rotulo: 'Contas a receber', titulo: reais(r.total_em_aberto_rs) + ' em aberto', tituloLista: 'Maiores títulos', sub: r.hoje ? 'até ' + dataBR(r.hoje) : '',
      blocos: [K([[reais(r.total_vencido_rs), `vencido (${r.titulos_vencidos || 0})`], [r.espelho_omie_em_aberto_rs != null ? reais(r.espelho_omie_em_aberto_rs) : null, 'no Omie']]),
        T(['Cliente', 'Vence', 'Valor'], (r.maiores || []).map((c) => ({ alerta: c.vencido, cel: [esc(c.cliente), dataBR(c.vencimento), reais(c.valor_rs)] })), [2])] };
  },
  minha_agenda(r) {
    const c = r.resumo_contado || {};
    return { rotulo: 'Agenda', titulo: r.dias ? `Próximos ${r.dias} dias` : 'Hoje',
      blocos: [K([[c.lembretes_em_aberto, 'lembretes'], [c.contas_e_boletos, 'contas'], [c.esperando_o_sim, 'esperam o seu sim'], [c.obrigacoes_fiscais_atrasadas, 'fiscal atrasado']]),
        TX(String(r.agenda || '').replace(/[*_]/g, ''))] };
  },
  meus_lembretes(r) {
    return { rotulo: 'Lembretes', titulo: `${(r.lembretes_em_aberto || []).length} em aberto`,
      blocos: [T(['Lembrete', 'Quando'], (r.lembretes_em_aberto || []).slice(0, 60).map((l) => ({ alerta: l.urgente, cel: [esc(l.texto), esc(l.quando)] })))] };
  },
  dre_gerencial(r) {
    const linhas = (r.linhas || []).filter((l) => l.subtotal).slice(0, 12);
    return { rotulo: 'DRE gerencial · ' + (r.unidade || ''), titulo: reais(r.resultado_liquido_no_periodo) + ' de resultado', sub: r.periodo,
      blocos: [T(['Linha', 'No período'], linhas.map((l) => [esc(l.linha), reais(l.total_no_periodo)]), [1])] };
  },
  vendas_do_mes(r) {
    return { rotulo: 'Vendas do mês', titulo: reais(r.receita_rs), sub: `${r.mes}/${r.ano}`,
      blocos: [K([[num(r.toneladas, 1) + ' t', 'toneladas'], [r.pedidos_finalizados, 'pedidos'], [r.lucro_liquido_rs != null ? reais(r.lucro_liquido_rs) : null, 'lucro líquido']])] };
  },
  pragas(r) {
    return { rotulo: 'Monitoramento de pragas', titulo: `${r.encontrados || 0} sessões`,
      blocos: [T(['Talhão', 'Quando', 'Alvos'], (r.sessoes || []).slice(0, 60).map((s) => [esc(`${s.fazenda} · ${s.talhao}`), dataBR(s.quando),
        esc((s.alvos_encontrados || []).map((a) => `${a.alvo} (${a.pontos_com_ocorrencia}/${a.pontos_medidos})`).join(', ') || 'nada contado')]))] };
  },
  fazendas_do_cliente(r) {
    return { rotulo: 'Fazendas', titulo: r.cliente, tituloLista: 'Fazendas', sub: `${r.fazendas_encontradas || 0} fazendas · ${num(r.area_total_dos_contornos_ha, 0)} ha`,
      blocos: [K([[r.fazendas_encontradas, 'fazendas'], [num(r.area_total_dos_contornos_ha, 0) + ' ha', 'área']]),
        T(['Fazenda', 'Talhões', 'Área (ha)'], (r.fazendas || []).map((f) => [esc(f.fazenda), f.talhoes, num(f.area_dos_contornos_ha, 0)]), [1, 2])] };
  },
  estoque_fazenda(r) {
    return { rotulo: 'Estoque da fazenda', titulo: reais(r.valor_total_em_estoque_rs) + ' em estoque', tituloLista: 'Produtos', sub: `${r.abaixo_do_minimo || 0} abaixo do mínimo`,
      blocos: [K([[(r.produtos || []).length, 'produtos'], [r.abaixo_do_minimo || 0, 'abaixo do mínimo']]),
        T(['Produto', 'Saldo', 'Valor'], (r.produtos || []).map((p) => ({ alerta: p.abaixo_do_minimo, cel: [esc(p.produto), `${num(p.saldo, 1)} ${esc(p.unidade)}`, reais(p.valor_em_estoque_rs)] })), [1, 2])] };
  },
  resumo_financeiro(r) {
    return { rotulo: 'Fluxo financeiro', titulo: reais(r.total_com_juro_rs ?? r.total_sem_juro_rs), sub: `${r.fazenda || ''} · ${r.periodo || ''}`,
      blocos: [T(['Mês', 'Sem juro', 'Com juro'], (r.meses || []).slice(-12).map((m) => [esc(m.mes), reais(m.sem_juro_rs), reais(m.com_juro_rs)]), [1, 2])] };
  },
};

// Qualquer outra consulta: números viram destaque, listas viram tabela.
const NOMES = { clientes: 'Clientes', pedidos: 'Pedidos', pedidos_em_aberto: 'Pedidos em aberto', estoque_produto: 'Estoque da fábrica', silos: 'Silos', cotacoes: 'Cotações', laboratorio: 'Laboratório', pedidos_lab: 'Pedidos do laboratório', pendencias_do_fisco: 'Pendências do fisco', boletim_diario: 'Boletim' };
function desenhoGenerico(r, _a, nome) {
  const rotuloCampo = (k) => k.replace(/_rs$/, '').replace(/_/g, ' ');
  const ehPista = (k) => /^(instrucao|aviso|dica|como_ler|como_usar|fonte|origem|contagem_origem)$/.test(k);
  const ks = []; let lista = null, listaNome = '';
  for (const [k, v] of Object.entries(r || {})) {
    if (ehPista(k)) continue;
    if (typeof v === 'number' && ks.length < 4) ks.push([/_rs$/.test(k) ? reais(v) : num(v, 2), rotuloCampo(k)]);
    if (Array.isArray(v) && v.length && typeof v[0] === 'object' && !lista) { lista = v; listaNome = k; }
  }
  const blocos = [];
  if (ks.length) blocos.push(K(ks));
  if (lista) {
    const cols = Object.keys(lista[0]).filter((k) => ['string', 'number'].includes(typeof lista[0][k])).slice(0, 4);
    blocos.push(T(cols.map(rotuloCampo), lista.slice(0, 60).map((l) => cols.map((c) => typeof l[c] === 'number' ? (/_rs$/.test(c) ? reais(l[c]) : num(l[c], 2)) : esc(l[c])))));
  }
  if (!blocos.length) return null;
  return { rotulo: NOMES[nome] || rotuloCampo(nome || 'consulta'), titulo: listaNome ? rotuloCampo(listaNome) : (NOMES[nome] || ''), tituloLista: listaNome ? rotuloCampo(listaNome) : '', blocos };
}

// ---------------------------------------------------------------------------
// PREVISÃO × HISTÓRICO DA FAZENDA (previsao_do_tempo) — barras da previsão de
// cada dia contra a faixa do que costuma chover nesses dias (P20–P80) e a
// média; embaixo, os dias com chance de janela de aplicação.
// ---------------------------------------------------------------------------
function svgPrevisaoHistorico(lugar) {
  const dias = lugar.previsao || [], hist = ((lugar.historico || {}).dias) || [];
  const W = 1000, H = 300, esq = 46, dir = 14, topo = 18, base = 230, n = Math.max(1, dias.length), bw = (W - esq - dir) / n;
  const vals = [...dias.map((d) => d.chuva_mm || 0), ...hist.map((h) => h.p80_mm || 0), 5];
  const max = Math.max(...vals) * 1.12, Y = (v) => base - (v / max) * (base - topo);
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  [0.25, 0.5, 0.75, 1].forEach((f) => { const v = max * f; s += `<line x1="${esq}" x2="${W - dir}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(196,202,60,.1)" stroke-dasharray="3 5"/><text x="${esq - 6}" y="${Y(v) + 4}" fill="#b3a97a" font-size="11" text-anchor="end" font-family="Menlo,monospace">${num(v, 0)}</text>`; });
  dias.forEach((d, i) => {
    const x = esq + i * bw, h = hist[i];
    if (h && h.p20_mm != null && h.p80_mm != null) s += `<rect x="${(x + bw * 0.08).toFixed(1)}" y="${Y(h.p80_mm).toFixed(1)}" width="${(bw * 0.84).toFixed(1)}" height="${Math.max(1, Y(h.p20_mm) - Y(h.p80_mm)).toFixed(1)}" fill="rgba(127,182,214,.16)" rx="3"><title>${dataBR(d.data)}: faixa típica ${num(h.p20_mm)}–${num(h.p80_mm)} mm</title></rect>`;
    const v = d.chuva_mm;
    if (v != null) s += `<rect x="${(x + bw * 0.28).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${(bw * 0.44).toFixed(1)}" height="${Math.max(v > 0 ? 2 : 0, base - Y(v)).toFixed(1)}" rx="3" fill="#c4ca3c"><title>${dataBR(d.data)}: previsão ${num(v)} mm (${d.chance_de_chuva_pct ?? '—'}%)</title></rect>` +
      (v > 0 ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(Y(v) - 6).toFixed(1)}" fill="#f1e9c4" font-size="12" font-weight="700" text-anchor="middle">${num(v)}</text>` : '');
    if (h && h.media_mm != null) s += `<line x1="${(x + bw * 0.14).toFixed(1)}" x2="${(x + bw * 0.86).toFixed(1)}" y1="${Y(h.media_mm).toFixed(1)}" y2="${Y(h.media_mm).toFixed(1)}" stroke="#7fb6d6" stroke-width="2.5"><title>média histórica ${num(h.media_mm)} mm</title></line>`;
    s += `<text x="${(x + bw / 2).toFixed(1)}" y="${base + 18}" fill="#b3a97a" font-size="12" text-anchor="middle" font-family="Menlo,monospace">${dataBR(d.data)}</text>`;
    const j = d.chance_de_janela;
    s += `<text x="${(x + bw / 2).toFixed(1)}" y="${base + 44}" fill="${j ? '#c4ca3c' : j === false ? '#ff6b6b' : '#b3a97a'}" font-size="15" font-weight="700" text-anchor="middle">${j ? '✓' : j === false ? '✕' : '·'}</text>`;
  });
  s += `<line x1="${esq}" x2="${W - dir}" y1="${base}" y2="${base}" stroke="rgba(196,202,60,.35)"/><text x="${esq}" y="${base + 64}" fill="#b3a97a" font-size="11" font-family="Menlo,monospace">✓ chance de janela de aplicação · ✕ difícil</text>`;
  return s + '</svg>';
}
DESENHOS.previsao_do_tempo = (r) => {
  const l = (r.lugares || []).find((x) => !x.erro) || (r.lugares || [])[0];
  if (!l || l.erro) return { rotulo: 'Previsão', titulo: (l && l.pedido) || 'Previsão', blocos: [NT(l && l.opcoes ? 'Há fazendas com esse nome em lugares diferentes — diga qual.' : 'Não consegui a previsão deste lugar.')] };
  const H = l.historico, s1 = H && H.semanas && H.semanas[0], s2 = H && H.semanas && H.semanas[1];
  const k = [[num(l.chuva_somada_mm) + ' mm', `previsão · ${(l.previsao || []).length} dias`]];
  for (const [i, w] of [s1, s2].entries()) if (w) k.push([num(w.previsto_mm, 0) + ' mm', `${dataBR(w.de)}–${dataBR(w.ate)}: ${w.leitura} (média ${num(w.media_historica_mm, 0)} mm)`]);
  return { rotulo: H ? `Chuva · previsão × histórico ${H.anos || ''}` : 'Previsão do tempo', titulo: l.lugar, sub: H ? 'barras: previsão · faixa azul: o que costuma chover (P20–P80, aprox.) · traço: média dos anos' : (l.origem === 'a_cidade_mesmo' ? 'ponto da cidade (sem fazenda cadastrada perto)' : ''),
    largo: true, blocos: [K(k), X(svgPrevisaoHistorico(l)), NT(r.regra_janela || '')] };
};

// ---------------------------------------------------------------------------
// CARTEIRA POR REVENDA (dados_carteira, 04/out/2026) — os dados de venda de quem
// apresenta, numa revenda (ou todas). Formato do `dados`: docs da empresa (CARTEIRA.md).
// Várias janelas: números (safra passada → atual), pedido × vendido por híbrido,
// plano, estratégia; no consolidado, uma linha por revenda; os clientes para
// ligar só vêm quando a pessoa pediu (o servidor tira antes). A marca da revenda
// (logo pequena ao lado do nome) é do módulo do tema: window.AO_VIVO_LOGO_REVENDA.
// ---------------------------------------------------------------------------
const listaDe = (v) => (Array.isArray(v) ? v : []);
const frasesDe = (v) => listaDe(v).map((x) => (typeof x === 'string' ? x : (x && (x.texto || x.frase)) || '')).filter(Boolean);
function logoMini(nome, chave) {
  try {
    const u = typeof window.AO_VIVO_LOGO_REVENDA === 'function' ? window.AO_VIVO_LOGO_REVENDA(chave, nome) : null;
    return u ? `<img class="logo-mini" src="${esc(u)}" alt="" style="height:1.1em;width:auto;vertical-align:-.15em;margin-right:.35em;border-radius:2px">` : '';
  } catch (e) { return ''; }
}
function setaDe(antes, depois) {
  const a = Number(antes), d = Number(depois);
  if (!isFinite(a) || !isFinite(d) || a === 0) return '';
  const p = Math.round(((d - a) / Math.abs(a)) * 100);
  return ` (${p > 0 ? '+' : ''}${p}%)`;
}
DESENHOS.dados_carteira = (r) => {
  const d = r.dados || {};
  const quem = r.revenda || d.revenda || 'Carteira';
  const s = d.safras || {};
  const ant = s.antes || '26S', dep = s.depois || '27S';
  const janelas = [];
  const nums = listaDe(d.numeros);
  if (nums.length) {
    janelas.push({ rotulo: `Carteira · ${ant} → ${dep}`, titulo: quem, largo: true,
      blocos: [K(nums.slice(0, 4).map((n) => [`${num(n.antes, 0)} → ${num(n.depois, 0)}${n.unidade ? ' ' + esc(n.unidade) : ''}`, `${esc(n.rotulo || '')}${setaDe(n.antes, n.depois)}`])),
        ...(nums.length > 4 ? [T(['Indicador', ant, dep], nums.slice(4).map((n) => [esc(n.rotulo || ''), num(n.antes, 0), num(n.depois, 0)]), [1, 2])] : [])] });
  }
  const hib = listaDe(d.hibridos);
  if (hib.length) {
    janelas.push({ rotulo: 'Pedido × vendido por híbrido', titulo: quem,
      blocos: [T(['Híbrido', 'Pedido', 'Vendido', '%'], hib.slice(0, 30).map((h) => {
        const p = Number(h.pedido), v = Number(h.vendido);
        return [esc(h.hibrido || ''), num(p, 0), num(v, 0), isFinite(p) && p ? `${Math.round((v / p) * 100)}%` : '—'];
      }), [1, 2, 3])] });
  }
  const revs = listaDe(d.revendas);
  if (revs.length) {
    janelas.push({ rotulo: `Revendas · ${ant} → ${dep}`, titulo: quem, largo: true,
      blocos: [T(['Revenda', ant, dep, 'Variação'], revs.slice(0, 30).map((x) => [logoMini(x.revenda, x.logo || x.chave) + esc(x.revenda || ''), num(x.antes, 0), num(x.depois, 0), setaDe(x.antes, x.depois).replace(/[()\s]/g, '') || '—']), [1, 2, 3])] });
  }
  const plano = frasesDe(d.plano);
  if (plano.length) janelas.push({ rotulo: 'Plano', titulo: quem, blocos: plano.slice(0, 8).map((f) => TX(f)) });
  const estr = frasesDe(d.estrategia);
  if (estr.length) janelas.push({ rotulo: 'Estratégia', titulo: quem, blocos: estr.slice(0, 8).map((f) => TX(f)) });
  // o resultado do híbrido de lançamento nos ensaios da região — o servidor só manda quando ELA pergunta dele
  const reg = d.b2900_regiao;
  if (reg && typeof reg === 'object') {
    const xdy = (o) => (o && typeof o === 'object' && o.n != null ? `${num(o.vitorias, 0)} de ${num(o.n, 0)}` : '');
    const extra = (o) => {
      if (!o || typeof o !== 'object') return '';
      const v = o.vantagem_sc_ha ?? o.dif_sc_ha ?? o.dif ?? o.vantagem;
      return v == null || !isFinite(Number(v)) ? '' : `${Number(v) > 0 ? '+' : ''}${num(Number(v), 1)} sc/ha`;
    };
    const g = reg.geral;
    const geralTexto = typeof g === 'string' ? g : (g && (g.texto || g.resumo)) || '';
    const blocos = [];
    if (g && typeof g === 'object' && g.n != null) blocos.push(K([[xdy(g), `geral${g.rotulo ? ' · ' + esc(g.rotulo) : ''}`], ...(extra(g) ? [[extra(g), 'diferença média']] : [])]));
    if (geralTexto) blocos.push(TX(geralTexto));
    const rec = listaDe(reg.recortes);
    if (rec.length) blocos.push(T(['Recorte', 'Vitórias', 'Diferença'], rec.slice(0, 30).map((r) => [esc(r.recorte || r.rotulo || r.nome || ''), xdy(r) || esc(r.texto || ''), extra(r) || '—']), [1, 2]));
    const conc = typeof reg.conclusao === 'string' ? reg.conclusao : (reg.conclusao && reg.conclusao.texto) || '';
    if (conc) blocos.push(NT(conc, 'ouro'));
    if (blocos.length) janelas.push({ rotulo: 'B2900 · ensaios da região', titulo: quem, largo: true, blocos });
  }
  const cli = listaDe(d.clientes_para_ligar);
  if (cli.length) {
    janelas.push({ rotulo: 'Clientes para ligar', titulo: quem,
      blocos: [T(['Cliente', 'Onde', 'Por quê'], cli.slice(0, 40).map((c) => [esc(c.cliente || c.nome || ''), esc(c.municipio || c.cidade || ''), esc(c.motivo || '')]))] });
  }
  return janelas.length ? janelas : desenhoGenerico(d, {}, 'dados_carteira');
};

export {
  vidroNaImagem, graficoBarras, DESENHOS, desenhoGenerico,
};
