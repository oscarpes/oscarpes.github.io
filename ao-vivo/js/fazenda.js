// OSCARPES AO VIVO — fazenda.js
// O MODO FAZENDA / GRUPO (o dossiê, resumo_completo): a navegação à esquerda, escolher a fazenda do
// grupo, mostrar uma seção, buscar de novo a parte que veio "carregando", abrir/sair do TALHÃO,
// a trilha (executarTrilha) e a troca do talhão na evolução (acaoEvol). Quem muda o estado do talhão
// e da evolução mora aqui (evolTalhao, dossieTalhao); o dossiê em si mora em telas.js.
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import { Visor } from './visor.js?v=20261010213811';
import { $, DEMO, ROTA_VOZ, dataBR, diag, esc, num, reais } from './base.js?v=20261010213811';
import { CALMO, VOO_MS } from './cena.js?v=20261010213811';
import { token } from './servidor.js?v=20261010213811';
import { distribuir } from './arranjo.js?v=20261010213811';
import {
  NT, desfocar, dossie, dossieFazenda, dossieSecao, fecharTudo, htmlDoBloco, mudarEstado, trocarPaineis,
} from './telas.js?v=20261010213811';
import { normTela } from './comandos.js?v=20261010213811';
import { DESENHOS_SECAO } from './secoes.js?v=20261010213811';
import { blocosDaEvolucao } from './evolucao.js?v=20261010213811';
import { desenharTrilha } from './navegacao.js?v=20261010213811';

// ---------------------------------------------------------------------------
// MODO FAZENDA / GRUPO — o DOSSIÊ (resumo_completo)
// ---------------------------------------------------------------------------
// João (02/out/2026): "quando eu pergunto tudo sobre o grupo tem que trazer
// tudo mesmo que resumido", "quando a pessoa pedir um resumo da fazenda, ela
// tem que conseguir visualizar a fazenda inteira ali resumida — otimize
// espaços e mostre bastante coisa sem poluir demais" e, às 22:10, "trazer um
// quadrado para o lado esquerdo com toda a navegação de todas as opções e as
// janelas irem alterando no lado direito maior … depois de aberto; antes só a
// folhinha moderna no meio da tela".
// O servidor manda o dossiê inteiro numa resposta; a navegação (seção e
// fazenda do grupo) troca AQUI, sem ir ao servidor.
const ICONE = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const SECOES = {
  resumo: { titulo: 'Resumo', icone: ICONE('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>') },
  talhoes: { titulo: 'Talhões', icone: ICONE('<path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/>') },
  fertilidade: { titulo: 'Fertilidade e mapas', icone: ICONE('<path d="M12 21c-4-3-7-6-7-10a7 7 0 0 1 14 0c0 4-3 7-7 10z"/><circle cx="12" cy="11" r="2.5"/>') },
  talhao: { titulo: 'Talhão', icone: ICONE('<path d="M4 6l7-3 9 4-2 12-11 2z"/>') },
  fertilidade_anos: { titulo: 'Evolução da fertilidade', icone: ICONE('<path d="M3 20h18"/><path d="M5 16l4-5 4 3 6-8"/><circle cx="19" cy="6" r="1.4"/>') },
  monitoramento: { titulo: 'Monitoramento', icone: ICONE('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>') },
  aplicacoes: { titulo: 'Aplicações e caderno', icone: ICONE('<path d="M12 3c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10z"/>') },
  evolucao: { titulo: 'Evolução da lavoura', icone: ICONE('<path d="M12 21V9"/><path d="M12 13c-4 0-6-2-6-6 4 0 6 2 6 6zM12 10c0-4 2-6 6-6 0 4-2 6-6 6z"/>') },
  clima: { titulo: 'Chuva e clima', icone: ICONE('<path d="M7 16a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A4 4 0 1 1 17 16z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>') },
  estoque: { titulo: 'Estoque', icone: ICONE('<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>') },
  laboratorio: { titulo: 'Laboratório', icone: ICONE('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>') },
  financeiro: { titulo: 'Financeiro', icone: ICONE('<path d="M4 19V5M4 19h16"/><path d="M8 15v-4M12 15V8M16 15v-6"/>') },
};
let evolTalhao = null;              // o talhão escolhido na evolução da lavoura (dossie/dossieFazenda/dossieSecao: telas.js)
const romanoNorm = (s) => normTela(s).replace(/^fazenda /, '').replace(/\b([1-5])\b/g, (d) => ['', 'i', 'ii', 'iii', 'iv', 'v'][+d]);
const mesmaFazenda = (a, b) => !!a && !!b && romanoNorm(a) === romanoNorm(b);
/** A lista no escopo (a fazenda escolhida na navegação; sem fazenda = o grupo inteiro). */
function doEscopo(lista, campo = 'fazenda') { return !dossieFazenda ? (lista || []) : (lista || []).filter((x) => mesmaFazenda(x[campo], dossieFazenda) || (x[campo] && romanoNorm(x[campo]).startsWith(romanoNorm(dossieFazenda) + ' '))); }
const dataIso = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
const diasEntre = (a, b) => Math.round((dataIso(b) - dataIso(a)) / 864e5);
const somaDias = (iso, n) => { const d = dataIso(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** "29/09" ou "29/09/2026" (o satélite) → ISO, com o ano de hoje (ou o anterior, se cairia no futuro). */
function isoDoDia(dm, hoje) {
  const m = /^(\d{2})\/(\d{2})(?:\/(\d{4}))?/.exec(String(dm || '')); if (!m) return null;
  let ano = m[3] ? +m[3] : +hoje.slice(0, 4);
  let iso = `${ano}-${m[2]}-${m[1]}`;
  if (!m[3] && iso > somaDias(hoje, 31)) iso = `${ano - 1}-${m[2]}-${m[1]}`;
  return iso;
}

/** Os números do escopo (o que a navegação e o resumo mostram). */
function contasDoEscopo() {
  const D = dossie, ts = doEscopo(D.talhoes), aps = doEscopo(D.aplicacoes), est = doEscopo(D.estoque);
  const faz = doEscopo(D.fazendas);
  const fert = doEscopo(D.fertilidade);
  const mon = D.monitoramento || {};
  const clima = doEscopo((D.clima || {}).fazendas || []);
  const visitas = doEscopo(mon.ultimas || []);
  return {
    fazendas: faz.length, talhoes: ts.length, area: faz.reduce((s, f) => s + (f.area_ha || 0), 0),
    comAnalise: ts.filter((t) => t.tem_analise).length, comPlantio: ts.filter((t) => t.plantio).length,
    executadas: aps.filter((a) => a.situacao === 'executada').length, planejadas: aps.filter((a) => a.situacao !== 'executada').length,
    zerados: est.filter((e) => e.saldo <= 0).length, abaixo: est.filter((e) => e.saldo > 0 && e.minimo != null && e.saldo < e.minimo).length, produtos: est.length,
    chuva7: clima.length ? clima.reduce((s, c) => s + (c.chuva_7d_mm || 0), 0) / clima.length : null,
    chuva30: clima.length ? clima.reduce((s, c) => s + (c.chuva_30d_mm || 0), 0) / clima.length : null,
    abertas: doEscopo(mon.abertas_lista || []).length, ultimaVisita: visitas[0] ? visitas[0].dia : null,
    analises: fert.length, ts, aps, est, fert, clima, faz,
  };
}
function seloDaSecao(id, c) {
  const D = dossie;
  switch (id) {
    case 'resumo': return { t: `${dossieFazenda ? '' : c.fazendas + ' faz. · '}${num(c.area, 0)} ha` };
    case 'talhoes': return { t: String(c.talhoes) };
    case 'fertilidade': return { t: `${c.comAnalise}/${c.talhoes} c/ análise` };
    case 'fertilidade_anos': { const anos = [...new Set(Object.entries(D.anos_de_analise || {}).filter(([f]) => !dossieFazenda || mesmaFazenda(f, dossieFazenda)).flatMap(([, a]) => a))].sort(); return { t: anos.length ? `${anos[0]}–${anos[anos.length - 1]}` : '—' }; }
    case 'monitoramento': return { t: (c.ultimaVisita ? dataBR(c.ultimaVisita) : '—') + (c.abertas ? ` · ${c.abertas} aberta${c.abertas > 1 ? 's' : ''}` : ''), alerta: c.abertas > 0 };
    case 'aplicacoes': return { t: `${c.executadas} feitas · ${c.planejadas} plan.` };
    case 'evolucao': return { t: c.comPlantio ? `${c.comPlantio} c/ plantio` : 'sem plantio', alerta: !c.comPlantio };
    case 'clima': return { t: c.chuva7 == null ? '—' : `${num(c.chuva7, 0)} mm 7d` };
    case 'estoque': return c.zerados ? { t: `${c.zerados} zerado${c.zerados > 1 ? 's' : ''}`, alerta: true } : { t: `${c.produtos} itens` };
    case 'laboratorio': return { t: D.laboratorio && D.laboratorio.pedidos ? `${D.laboratorio.pedidos_encontrados ?? D.laboratorio.pedidos.length} pedidos` : `${c.analises} análises` };
    case 'financeiro': return { t: D.financeiro ? reais(D.financeiro.total) : '' };
  }
  return { t: '' };
}
function desenharNav() {
  const nav = $('navFazenda'), D = dossie; if (!D) return;
  const c = contasDoEscopo();
  const grupo = D.escopo === 'cliente' && D.fazendas.length > 1;
  const titulo = dossieFazenda || (grupo ? D.cliente : (D.fazenda || D.cliente));
  const sub = dossieFazenda ? `${D.cliente} · ${num(c.area, 0)} ha · ${c.talhoes} talhões` : grupo ? `${D.fazendas.length} fazendas · ${num(c.area, 0)} ha` : `${num(c.area, 0)} ha · ${c.talhoes} talhões`;
  nav.innerHTML = `<div class="cab"><div><div class="rotulo"><span>${grupo ? (dossieFazenda ? 'Fazenda do grupo' : 'Grupo') : 'Fazenda'}</span></div><div class="titulo">${esc(titulo)}</div><div class="sub">${esc(sub)}</div></div></div>` +
    (grupo ? `<div class="fazendas"><button data-fazenda="" class="${dossieFazenda ? '' : 'on'}">Todas</button>${D.fazendas.map((f) => `<button data-fazenda="${esc(f.fazenda)}" class="${mesmaFazenda(f.fazenda, dossieFazenda) ? 'on' : ''}">${esc(f.fazenda)}</button>`).join('')}</div>` : '') +
    `<div class="lista">${(D.secoes || []).filter((id) => SECOES[id]).map((id) => { const s = seloDaSecao(id, c); return `<button class="item${id === dossieSecao ? ' on' : ''}" data-secao="${id}"><i>${SECOES[id].icone}</i><span>${SECOES[id].titulo}</span><small class="${s.alerta ? 'alerta' : ''}">${esc(s.t)}</small></button>`; }).join('')}</div>` +
    `<div class="rodape"><span class="nota">${D.carregando && D.carregando.length ? 'carregando: ' + esc(D.carregando.join(', ')) + '…' : D.indisponivel && D.indisponivel.length ? 'sem: ' + esc(D.indisponivel.join(', ')) : 'diga "mostra as aplicações"'}</span><button data-fechar="1" title="Fechar a fazenda (Esc)">FECHAR ✕</button></div>`;
  nav.querySelectorAll('[data-secao]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); mostrarSecao(b.dataset.secao); }; });
  nav.querySelectorAll('[data-fazenda]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); escolherFazenda(b.dataset.fazenda || null); }; });
  nav.querySelector('[data-fechar]').onclick = (e) => { e.stopPropagation(); fecharTudo(); };
}
function abrirDossie(d) {
  mudarEstado({ dossie: d, dossieFazenda: d.escopo === 'fazenda' ? d.fazenda : null }); evolTalhao = null;
  const nav = $('navFazenda');
  const entrando = !document.body.classList.contains('modo-fazenda');
  document.body.classList.add('modo-fazenda');
  if (entrando && !CALMO) { nav.classList.remove('pronto'); nav.style.setProperty('--atraso', Math.round(VOO_MS * 0.5) + 'ms'); void nav.offsetWidth; nav.addEventListener('animationend', () => nav.classList.add('pronto'), { once: true }); }
  mostrarSecao(SECOES[d.secao_inicial] && (d.secoes || []).includes(d.secao_inicial) ? d.secao_inicial : 'resumo');
  diag('dossie ' + d.escopo + ' ' + (d.secao_inicial || ''));
  if ((d.carregando || []).length && !d._refeito) setTimeout(() => buscarDossieDeNovo(d), 4000);
}
// PARTE LENTA (03/out/2026, rapidez): o servidor não espera uma parte do dossiê que passa de 6 s —
// ela vem "carregando" e a tela busca o dossiê de novo uma vez (rota direta, sem o agente).
async function buscarDossieDeNovo(d) {
  if (DEMO || dossie !== d) return;
  const t = await token(); if (!t) return;
  try {
    const resp = await fetch(ROTA_VOZ, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
      body: JSON.stringify({ direto: { ferramenta: 'resumo_completo', argumentos: { cliente: d.cliente, ...(d.fazenda ? { fazenda: d.fazenda } : {}) } } }) });
    const r = await resp.json().catch(() => ({}));
    const novo = ((r.telas || []).find((x) => x.ferramenta === 'resumo_completo') || {}).resultado;
    if (!novo || !novo.versao || dossie !== d) return;
    novo._refeito = true; novo.secao_inicial = dossieSecao || d.secao_inicial;
    const fazendaVista = dossieFazenda;
    abrirDossie(novo);
    if (fazendaVista && novo.escopo === 'cliente') escolherFazenda(fazendaVista);
    diag('dossie completado');
  } catch (e) {}
}
// PRÉ-AQUECER (03/out/2026, rapidez): abrir uma fazenda do grupo já monta o dossiê DELA no servidor
// (guardado 10 min) — "me dá o resumo da Pato Branco" acha pronto. Uma vez a cada 8 min por fazenda.
const aquecidas = new Map();
async function aquecerDossie(cliente, fazenda) {
  if (DEMO || !cliente || !fazenda) return;
  const k = romanoNorm(cliente + ' ' + fazenda);
  if (Date.now() - (aquecidas.get(k) || 0) < 480000) return;
  aquecidas.set(k, Date.now());
  const t = await token(); if (!t) return;
  try { await fetch(ROTA_VOZ, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
    body: JSON.stringify({ direto: { ferramenta: 'resumo_completo', argumentos: { cliente, fazenda }, so_aquecer: true } }) }); diag('aquecida ' + fazenda); } catch (e) {}
}
function escolherFazenda(nome) {
  if (!dossie) return;
  mudarEstado({ dossieFazenda: nome ? (dossie.fazendas.find((f) => mesmaFazenda(f.fazenda, nome)) || {}).fazenda || null : null });
  evolTalhao = null;
  if (dossieFazenda && dossie.escopo === 'cliente') aquecerDossie(dossie.cliente, dossieFazenda);
  mostrarSecao(dossieSecao || 'resumo');
}
function mostrarSecao(id) {
  if (!dossie || !SECOES[id]) return;
  if (id !== 'talhao') dossieTalhao = null;
  mudarEstado({ dossieSecao: id }); desenharNav();
  let corpos = [];
  try { corpos = (DESENHOS_SECAO[id] || (() => []))(); } catch (e) { console.error(e); corpos = [{ rotulo: SECOES[id].titulo, titulo: 'Não consegui desenhar esta parte', blocos: [NT(String(e && e.message || e))] }]; }
  if (!corpos.length) corpos = [{ rotulo: SECOES[id].titulo, titulo: 'Nada lançado aqui ainda', blocos: [NT('Ainda não há registro desta parte para ' + (dossieFazenda || dossie.cliente) + '.')] }];
  for (const c of corpos) { c.ferramenta = 'resumo_completo'; c.argumentos = { cliente: dossie.cliente, fazenda: dossieFazenda || dossie.fazenda || '', secao: id }; }
  mudarEstado({ ultimosCorpos: corpos, focado: null });
  // o resumo são ladrilhos (mosaico na tela larga; no celular, um por vez — todos, sem o teto de 6)
  // nas outras seções a lista fica INTEIRA numa janela (rola por dentro) — partir 80 linhas do caderno em 5 janelas confundia
  trocarPaineis(id === 'resumo' ? corpos : distribuir(corpos, false));
  diag('secao ' + id);
}
function acaoEvol(acao, valor, el) {
  if (acao !== 'evol') return;
  evolTalhao = valor;
  const b = blocosDaEvolucao(false);
  const blocos = [b.blocos[0], ...(el._parte.blocos || []).slice(1)];      // as próximas do plano ficam
  el._parte.blocos = el._corpo.blocos = blocos; el._parte.titulo = b.titulo; el._parte.sub = b.sub;
  el.querySelector('.titulo').textContent = b.titulo; el.querySelector('.sub').textContent = b.sub;
  el.querySelector('.corpo').innerHTML = blocos.map((x) => htmlDoBloco(x, true)).join('');
  diag('evol ' + (valor === '*' ? 'todas' : 'talhao'));
}

// ---------------------------------------------------------------------------
// O TALHÃO (03/out/2026) — João: clicando num talhão do desenho da fazenda (o resumo, a aba
// Talhões, o mapa do grupo) abre a VISTA DO TALHÃO: o contorno grande, área, cultura, safra e
// plantio; a última análise POR PROFUNDIDADE (0-20 primeiro) e a evolução entre os anos; os mapas
// recortados no talhão com todas as camadas; as aplicações e a lavoura crescendo; o que o
// monitoramento anotou nele. Clicar em outro talhão troca; VOLTAR volta para a fazenda. Voz: "abre o
// talhão 7". O que está no dossiê aparece na hora; a fertilidade do talhão é pedida UMA vez (rota
// direta, sem o agente) e fica guardada.
// ---------------------------------------------------------------------------
let dossieTalhao = null, secaoAntesDoTalhao = 'resumo';
const chaveTalhao = (f, t) => romanoNorm(f) + '|' + normTela(t).replace(/^talhao /, '').replace(/^0+(\d)/, '$1');
function talhaoDoDossie(fazenda, talhao) {
  return (dossie.talhoes || []).find((t) => chaveTalhao(t.fazenda, t.talhao) === chaveTalhao(fazenda, talhao)) || null;
}
function abrirTalhao(fazenda, talhao) {
  if (!dossie) return;
  const t = talhaoDoDossie(fazenda, talhao); if (!t) return;
  if (dossieSecao !== 'talhao') secaoAntesDoTalhao = dossieSecao || 'resumo';
  if (dossie.escopo === 'cliente' && dossie.fazendas.length > 1) mudarEstado({ dossieFazenda: t.fazenda });
  dossieTalhao = { fazenda: t.fazenda, talhao: t.talhao };
  evolTalhao = romanoNorm(t.fazenda) + '|' + normTela(t.talhao);
  mostrarSecao('talhao');
  diag('talhao ' + t.talhao);
}
function sairDoTalhao() { dossieTalhao = null; evolTalhao = null; mostrarSecao(secaoAntesDoTalhao === 'talhao' ? 'resumo' : secaoAntesDoTalhao); }
function executarTrilha(acao) {
  diag('trilha ' + acao);
  if (acao === 'inicio') fecharTudo();
  else if (acao === 'fecharVisor') Visor.fechar();
  else if (acao === 'desfocar') desfocar();
  else if (acao === 'resumo') { dossieTalhao = null; mostrarSecao('resumo'); }
  else if (acao === 'sairTalhao') sairDoTalhao();
  else if (acao === 'grupo') { mudarEstado({ dossieFazenda: null }); evolTalhao = null; mostrarSecao('resumo'); }
  desenharTrilha();
}

export {
  SECOES, evolTalhao, romanoNorm, mesmaFazenda, doEscopo, diasEntre, somaDias, isoDoDia, contasDoEscopo,
  desenharNav, abrirDossie, escolherFazenda, mostrarSecao, acaoEvol, dossieTalhao, chaveTalhao,
  talhaoDoDossie, abrirTalhao, executarTrilha,
};
