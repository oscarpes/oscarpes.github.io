// OSCARPES AO VIVO — telas.js
// AS JANELAS DE VIDRO: os blocos (números, lista, gráfico, nota), mostrar/trocar/fechar as janelas,
// o arranjo na tela, o FOCO (uma janela grande, as outras na tira), as bolinhas que vão às janelas,
// Esc, rolagem do celular e mudança de tamanho da tela.
// O estado das janelas (paineisVivos, ultimosCorpos, focado) e do MODO FAZENDA (dossie,
// dossieFazenda, dossieSecao) mora aqui; outro módulo muda por mudarEstado({...}).
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import {
  arranjo, distribuir, encaixar, gradeDoMosaico, ordenarParaArranjo, tipoDoPainel,
} from './arranjo.js?v=20261010213811';
import { $, DEMO, auditarTela, diag, esc } from './base.js?v=20261010213811';
import { CALMO, CELULAR, Esfera, atrasoDoPainel } from './cena.js?v=20261010213811';
import { explorar, normTela, sugestoesDoPainel } from './comandos.js?v=20261010213811';
import { DESENHOS, desenhoGenerico, graficoBarras, vidroNaImagem } from './desenhos.js?v=20261010213811';
import { agruparMapas, htmlExplorador, religarMapas } from './mapas.js?v=20261010213811';
import { Visor, Zoom } from './visor.js?v=20261010213811';
import {
  abrirDossie, abrirTalhao, desenharNav, escolherFazenda, mesmaFazenda, mostrarSecao, romanoNorm,
} from './fazenda.js?v=20261010213811';
import { desenharTrilha, graficosAVista, voltarUmNivel } from './navegacao.js?v=20261010213811';
import { historicoAoFechar, historicoAoTrocar, historicoAntesDeTrocar, historicoDoTema } from './controle.js?v=20261010213811';

/** "38,4 mm" → número grande e unidade pequena ("R$" idem): cabe mais na mesma largura. */
function valorKpi(v) {
  const m = /^(R\$\s?)?(-?[\d.,]+)(.*)$/.exec(String(v));
  return m ? `${m[1] ? '<small>R$</small>' : ''}${esc(m[2])}${m[3] ? `<small>${esc(m[3])}</small>` : ''}` : esc(v);
}
const kpis = (lista) => `<div class="kpis">${lista.filter((k) => k && k[0] != null && k[0] !== '—' && !/^(R\$ )?—/.test(String(k[0]))).map(([v, r]) => `<div class="kpi"><b>${valorKpi(v)}</b><span>${esc(r)}</span></div>`).join('')}</div>`;
const tabela = (cab, linhas, numericas = []) => `<table><thead><tr>${cab.map((c, i) => `<th class="${numericas.includes(i) ? 'n' : ''}">${esc(c)}</th>`).join('')}</tr></thead><tbody>${linhas.map((l) => `<tr class="${l.alerta ? 'alerta' : ''}">${(l.cel || l).map((c, i) => `<td class="${numericas.includes(i) ? 'n' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
// blocos (o que cada desenho devolve)
const K = (itens) => ({ tipo: 'kpis', itens });
const T = (cab, linhas, numericas = []) => ({ tipo: 'tabela', cab, linhas, numericas });
const G = (html) => ({ tipo: 'grafico', html });
/** gráfico de barras: o normal e o COMPLETO (todos os valores e o eixo — o do foco) */
const GB = (dias, campo, rotulo, cor, extra) => ({ tipo: 'grafico', html: graficoBarras(dias, campo, rotulo, cor, extra, false), completo: graficoBarras(dias, campo, rotulo, cor, extra, true) });
const X = (html) => ({ tipo: 'html', html });
const NT = (texto, cor) => ({ tipo: 'nota', texto, cor });
const TX = (texto) => ({ tipo: 'texto', texto });
function htmlDoBloco(b, foco = false) {
  if (b.tipo === 'kpis') return kpis(b.itens);
  if (b.tipo === 'tabela') return tabela(b.cab, b.linhas, b.numericas);
  if (b.tipo === 'grafico' || b.tipo === 'html') return foco && b.completo ? b.completo : b.html;
  if (b.tipo === 'texto') return `<div class="texto-livre">${esc(b.texto)}</div>`;
  if (b.tipo === 'nota') return `<div class="nota"${b.cor ? ` style="color:${b.cor === 'ouro' ? 'var(--ouro)' : 'var(--mudo)'}"` : ''}>${esc(b.texto)}</div>`;
  if (b.tipo === 'imagem') return `<figure class="moldura"><div class="quadro"><img alt="${esc(b.legenda || '')}" src="${b.src}"></div>${b.legenda ? `<figcaption>${esc(b.legenda)}</figcaption>` : ''}<button class="tela-cheia" title="Abrir em tela cheia">⤢ TELA CHEIA</button></figure>`;
  // os mapas da mesma fazenda numa janela só: uma aba por nutriente; a 0-20 grande e as outras camadas pequenas ao lado
  // o explorador de camadas: todos os atributos, as profundidades (0-20 grande, as outras pequenas) e os anos
  if (b.tipo === 'camadas') return htmlExplorador(b);
  // o mesmo nutriente em vários anos, lado a lado, com a mesma escala (evolucao_fertilidade)
  // 05/out/2026: a galeria de fotos (miniaturas; a grande abre no visor — "a próxima" passa)
  if (b.tipo === 'fotos') return `<div class="mapas-anos fotos" style="grid-template-columns:repeat(${Math.min(5, b.itens.length)},minmax(0,1fr))">${b.itens.map((x, k) => `<button class="ano-mapa foto" data-ano="${k}" title="${esc(x.legenda)}"><img alt="${esc(x.legenda)}" src="${esc(x.src)}" loading="lazy"><span>${esc(x.legenda)}</span></button>`).join('')}</div><div class="nota">Diga "a próxima" ou "a anterior" para passar · "fecha as fotos" para sair.</div>`;
  if (b.tipo === 'mapas-anos') return `<div class="mapas-anos" style="grid-template-columns:repeat(${Math.min(4, b.itens.length)},minmax(0,1fr))">${b.itens.map((x, k) => `<button class="ano-mapa" data-ano="${k}" title="Abrir ${x.ano} em tela cheia"><img alt="${esc(String(x.ano))}" src="${x.src}"><span>${x.ano}</span></button>`).join('')}</div><div class="nota">Mesma escala de cor em todos os anos · clique num ano para a tela cheia (← → passa os anos).</div>`;
  return '';
}

let paineisVivos = [];          // as janelas na tela agora (elementos), na ordem
let ultimosCorpos = [];         // as respostas que estão na tela (para refazer se a tela mudar de largo↔celular)
// FOCO (02/out/2026, 21:4x) — João: "vc tá abrindo os assuntos em janelas, umas
// inclusive bem pequenas, e quando eu tento navegar nelas, tipo olhar o mapa
// todo, vc não me dá essa opção, só me dá a opção de fechá-las; deveria ser:
// quando eu clicar em alguma das telas, ela expandir para eu olhar o todo e
// conseguir navegar nela, ou clicar ou dar um comando de voz para explorarmos
// mais aquele assunto". Clicar numa janela (ou no ⤢) = FOCO: ela cresce para a
// tela quase inteira, as outras viram miniaturas na tira ao lado; dentro dela
// o mapa tem zoom e arrasto, a lista mostra tudo e rola, o gráfico mostra todos
// os valores; embaixo, "Explorar este assunto" e sugestões. Esc / "volta" /
// clique fora / botão: volta para a grade. Uma em foco por vez.
let focado = null;
// O MODO FAZENDA (o dossiê aberto, a fazenda escolhida no grupo, a seção à vista) mora AQUI, junto
// das janelas, porque mostrarTelas e fecharTudo também o mudam. Os outros módulos leem pelo import
// (que é só leitura) e mudam por mudarEstado({...}).
let dossie = null, dossieFazenda = null, dossieSecao = null;
/** Muda o estado das janelas / do modo fazenda a partir de outro módulo (na ordem abaixo). */
function mudarEstado(m) {
  if ('ultimosCorpos' in m) ultimosCorpos = m.ultimosCorpos;
  if ('focado' in m) focado = m.focado;
  if ('dossie' in m) dossie = m.dossie;
  if ('dossieFazenda' in m) dossieFazenda = m.dossieFazenda;
  if ('dossieSecao' in m) dossieSecao = m.dossieSecao;
}
/** Resposta nova com consultas: desenha, reparte e troca as janelas. */
/** As consultas novas são do mesmo cliente/fazenda do dossiê aberto? (sem nome nos argumentos = sim) */
function telasSaoDoDossie(telas, D) {
  const nomes = D.fazendas ? D.fazendas.map((f) => f.fazenda) : [];
  for (const tl of telas || []) {
    const a = tl.argumentos || {}, r = tl.resultado || {};
    const cli = a.cliente || r.cliente, faz = a.fazenda || r.fazenda;
    if (cli && D.cliente && normTela(cli) && !normTela(D.cliente).includes(normTela(cli)) && !normTela(cli).includes(normTela(D.cliente))) return false;
    if (faz && nomes.length && !nomes.some((n) => mesmaFazenda(n, faz) || romanoNorm(faz).startsWith(romanoNorm(n)) || romanoNorm(n).startsWith(romanoNorm(faz)))) return false;
  }
  return true;
}
function mostrarTelas(telas) {
  // 05/out/2026: COMANDO DE TELA do servidor ("volte à página inicial", "feche todas as telas"): o tema fecha o que é dele e
  // o motor fecha as janelas — nada é desenhado
  const cmd = (telas || []).find((t) => t && t.ferramenta === 'comando_de_tela');
  if (cmd) {
    try { if (typeof window.AO_VIVO_TELA_TEMA === 'function') window.AO_VIVO_TELA_TEMA(cmd); } catch (e) { /* o motor fecha mesmo assim */ }
    if (cmd.resultado && cmd.resultado.acao === 'inicio' && paineisVivos.length) fecharTudo();
    return;
  }
  // MÓDULO DE TEMA (03/out/2026): a consulta que é do módulo (ex.: o playbook de uma empresa) abre a
  // vista dele (a placa sobe, o versus, o plano…) em vez de um painel genérico
  if (typeof window.AO_VIVO_TELA_TEMA === 'function') {
    const antes = (telas || []).length;
    telas = (telas || []).filter((t) => {
      // a vista do tema entra no histórico das telas (reaberta pedindo a mesma consulta ao tema)
      const depois = historicoDoTema(() => window.AO_VIVO_TELA_TEMA(t));
      try { if (window.AO_VIVO_TELA_TEMA(t)) { depois(); return false; } return true; } catch (e) { return true; }
    });
    if (antes && !telas.length) return;
  }
  // o DOSSIÊ (resumo_completo) abre o modo fazenda/grupo: navegação à esquerda, seções à direita
  const dos = (telas || []).find((t) => t.ferramenta === 'resumo_completo' && t.resultado && t.resultado.versao);
  // 07/out/2026: o mapa que veio JUNTO do dossiê ("tudo da fazenda" desenha o fósforo do último ano) entra
  // nos mapas recebidos ANTES de abrir — a aba Fertilidade mostra o explorador; antes ele era jogado fora
  if (dos) { agruparMapas(telas || []); abrirDossie(dos.resultado); return; }
  const { corpos: mapas, outras } = agruparMapas(telas || []);
  const corpos = [...mapas];
  for (const tela of outras) {
    // 05/out/2026: o MÓDULO DE TEMA pode trazer o desenho de uma consulta que é só dele (window.AO_VIVO_DESENHOS:
    // { ferramenta: (resultado, argumentos) => { rotulo, titulo, sub, blocos } ou uma lista delas, com blocos simples
    // {tipo:'kpis'|'tabela'|'nota'|'texto'}) — as janelas de vidro são as do motor; o conteúdo, do tema.
    const doTema = window.AO_VIVO_DESENHOS && typeof window.AO_VIVO_DESENHOS[tela.ferramenta] === 'function' ? window.AO_VIVO_DESENHOS[tela.ferramenta] : null;
    const fazer = doTema || DESENHOS[tela.ferramenta] || desenhoGenerico;
    let c = null;
    try { c = fazer(tela.resultado || {}, tela.argumentos || {}, tela.ferramenta); }
    catch (e) { try { c = desenhoGenerico(tela.resultado || {}, {}, tela.ferramenta); } catch (e2) { c = null; } }
    // a consulta e os argumentos dela vão junto: "Explorar este assunto" manda isso ao agente
    // 04/out/2026: um desenho pode devolver VÁRIAS janelas (ex.: a carteira — números, híbridos, plano)
    for (const um of (Array.isArray(c) ? c : [c])) if (um) { um.ferramenta = tela.ferramenta; um.argumentos = tela.argumentos || {}; corpos.push(um); }
  }
  if (!corpos.length) return;
  // no modo fazenda, consulta avulsa entra à direita e a navegação fica (nenhuma seção acesa);
  // a evolução da fertilidade é a seção dela (e fica guardada: voltar a ela é local)
  const evf = (telas || []).find((t) => t.ferramenta === 'evolucao_fertilidade' && t.resultado && t.resultado.versao);
  // 03/out/2026 (João): "mudei o assunto, pedi sobre a fazenda Cidara, ele me trouxe, porém no lado
  // esquerdo manteve escrito fazenda Pato Branco". Consulta de OUTRO cliente/fazenda fecha o modo
  // fazenda — a navegação nunca pode mostrar um lugar diferente das janelas.
  if (dossie && !telasSaoDoDossie(telas, dossie)) {
    dossie = null; dossieSecao = null; dossieFazenda = null;
    document.body.classList.remove('modo-fazenda'); diag('sai da fazenda: assunto de outro lugar');
  }
  if (dossie) {
    if (evf) { dossie._evolFert = { ...(dossie._evolFert || {}), [normTela(evf.resultado.fazenda || '') || '*']: evf.resultado }; dossieSecao = 'fertilidade_anos'; }
    else dossieSecao = null;
    desenharNav();
  }
  // o mapa/imagem é o que a pessoa pediu para VER: vai para a janela principal
  // a imagem vai para a janela principal — menos quando veio a evolução da fertilidade (o gráfico é o principal, os mapas dos anos ao lado)
  const temImagem = (c) => c.ferramenta === 'evolucao_fertilidade' ? 2 : c.blocos.some((x) => x.tipo === 'imagem' || x.tipo === 'camadas' || x.tipo === 'mapas-anos') ? 1 : 0;
  corpos.sort((a, b) => temImagem(b) - temImagem(a));
  ultimosCorpos = corpos;
  trocarPaineis(ordenarParaArranjo(distribuir(corpos, !CELULAR())));
}
/** As janelas velhas saem do lugar (ficam onde estavam, se dissolvendo) e as novas entram. */
function dissolver(els) {
  for (const el of els) {
    const b = el.getBoundingClientRect();
    el.style.left = b.left + 'px'; el.style.top = b.top + 'px'; el.style.width = b.width + 'px'; el.style.height = b.height + 'px';
    el.classList.remove('focado', 'miniatura');
    el.classList.add('saindo');
    $('saindo').appendChild(el);
    setTimeout(() => el.remove(), 650);
  }
}
// <quantosCabem> (função pura — o portão roda ela)
/** Quantas janelas cabem LEGÍVEIS nesta área (João: "umas inclusive bem
 *  pequenas"). Mínimo: 22% da largura e 28% da altura da tela (e nunca menos
 *  de 320 × 220 px). As que não cabem vão para a tira de miniaturas. */
function quantosCabem(n, areaL, areaH, telaL, telaH, tiraL = 240) {
  const minL = Math.max(telaL * 0.22, 320), minA = Math.max(telaH * 0.28, 220);
  for (let k = Math.min(n, 6); k > 1; k--) {
    const a = arranjo(k, telaL);
    if (a.modo !== 'grade') return n;
    const cols = a.colunas.split(' minmax').length, linhas = a.areas.length;
    const larg = (areaL - (k < n ? tiraL : 0)) / cols, alt = areaH / linhas;
    // a principal (que ocupa 2 linhas) conta como a coluna mais larga; as outras dividem
    if (larg >= minL * 0.98 && alt >= minA * 0.98) return k;
  }
  return 1;
}
// </quantosCabem>
function aplicarArranjo() {
  const grade = $('grade'), tira = $('miniaturas'), cel = CELULAR();
  let naGrade, naTira;
  if (focado && !paineisVivos.includes(focado)) focado = null;
  // a área que sobra para as janelas (no modo fazenda, sem a navegação da esquerda)
  const area = $('paineis').getBoundingClientRect(), gap = Math.min(28, Math.max(12, innerWidth * 0.012));
  const navL = document.body.classList.contains('modo-fazenda') && !cel ? $('navFazenda').offsetWidth + gap : 0;
  const areaL = area.width - navL - 2 * Math.min(56, Math.max(16, innerWidth * 0.022));
  desenharTrilha();
  // MOSAICO (o resumo do dossiê): ladrilhos encaixados numa grade que enche a área
  const mosaico = !cel && !focado && paineisVivos.length > 0 && paineisVivos.every((el) => el._parte && el._parte.forma);
  if (focado) { naGrade = [focado]; naTira = cel ? [] : paineisVivos.filter((el) => el !== focado); }
  else if (cel) { naGrade = paineisVivos; naTira = []; }
  else if (mosaico) { naGrade = paineisVivos; naTira = []; }
  else {
    const k = quantosCabem(paineisVivos.length, areaL, area.height, innerWidth, innerHeight, tira.offsetWidth || Math.min(300, Math.max(200, innerWidth * 0.15)));
    naGrade = paineisVivos.slice(0, k); naTira = paineisVivos.slice(k);
  }
  // move só quem precisa (mover reinicia a animação de quem ainda está nascendo)
  naGrade.forEach((el, j) => { el.classList.remove('miniatura'); if (grade.children[j] !== el) grade.insertBefore(el, grade.children[j] || null); });
  naTira.forEach((el, j) => { el.classList.add('miniatura'); if (tira.children[j] !== el) tira.insertBefore(el, tira.children[j] || null); });
  paineisVivos.forEach((el) => el.classList.toggle('oculta', cel && !!focado && el !== focado));
  grade.classList.remove('mosaico');
  document.body.classList.toggle('com-tira', naTira.length > 0);
  document.body.classList.toggle('em-foco', !!focado);
  const n = naGrade.length;
  grade.classList.toggle('mosaico', mosaico);
  if (mosaico) {
    const { C, R } = gradeDoMosaico(areaL, area.height - (document.body.classList.contains('com-trilha') ? 46 : 0));
    const pos = encaixar(naGrade.map((el) => el._parte.forma), C, R);
    grade.classList.remove('uma-linha', 'faixa');
    grade.style.gridTemplateColumns = `repeat(${C}, minmax(0, 1fr))`; grade.style.gridTemplateRows = `repeat(${R}, minmax(0, 1fr))`;
    grade.style.gridTemplateAreas = ''; grade.style.maxWidth = '100%';
    naGrade.forEach((el, j) => { const q = pos[j]; el.classList.toggle('oculta', !q); el.style.gridArea = q ? `${q.row + 1} / ${q.col + 1} / span ${q.h} / span ${q.w}` : ''; });
    paineisVivos.forEach(caber);
    $('pontos').innerHTML = '';
    return;
  }
  const a = focado ? { modo: cel ? 'carrossel' : 'grade', colunas: 'minmax(0,1fr)', areas: ['a'], linhas: 1, maximo: '100%' } : arranjo(n, areaL + 2 * Math.min(56, Math.max(16, innerWidth * 0.022)), naGrade.map((el) => el.dataset.tipo));
  // uma janela só fica do tamanho do conteúdo; duas ou mais ficam da mesma altura (quadros, não tiras)
  grade.classList.toggle('uma-linha', a.modo === 'grade' && a.linhas === 1 && !focado && n === 1);
  grade.classList.toggle('faixa', !!a.faixa);
  if (a.modo === 'grade') {
    grade.style.gridTemplateColumns = a.colunas;
    grade.style.gridTemplateAreas = a.areas.map((l) => `"${l}"`).join(' ');
    grade.style.gridTemplateRows = a.faixa ? 'auto minmax(0, 1fr)' : `repeat(${a.linhas}, minmax(0, 1fr))`;
    grade.style.maxWidth = a.maximo;
    naGrade.forEach((el, j) => { el.style.gridArea = 'abcdef'[j]; });
  } else {
    grade.style.gridTemplateColumns = grade.style.gridTemplateAreas = grade.style.gridTemplateRows = grade.style.maxWidth = '';
    naGrade.forEach((el) => { el.style.gridArea = ''; });
  }
  naTira.forEach((el) => { el.style.gridArea = ''; });
  paineisVivos.forEach(caber);
  $('pontos').innerHTML = cel && !focado && n > 1 ? paineisVivos.map((_, j) => `<i class="${j === 0 ? 'on' : ''}"></i>`).join('') : '';
}
/** TV não tem rolagem: se o conteúdo não coube na janela, encolhe por igual
 *  (até ~80%) antes de sobrar barra de rolar. No celular, na miniatura e no
 *  FOCO não encolhe (no foco a pessoa rola e vê tudo). */
// <ladoDosMapas> (função pura — o portão roda ela)
/** n mapas QUADRADOS numa área L × A (px): quantas colunas deixam cada quadro do MAIOR tamanho
 *  possível (João, 03/out: "os quadros ficaram muito compridos; daria para eles serem mais quadrados,
 *  quase do tamanho dos talhões, e isso permitiria os talhões ficarem maiores"). */
function ladoDosMapas(n, L, A, gap = 10, rotulo = 26) {
  let melhor = { colunas: 1, lado: 0 };
  for (let c = 1; c <= Math.max(1, n); c++) {
    const linhas = Math.ceil(n / c);
    const lado = Math.floor(Math.min((L - gap * (c - 1)) / c, (A - gap * (linhas - 1)) / linhas - rotulo));
    if (lado > melhor.lado) melhor = { colunas: c, lado };
  }
  return melhor;
}
// </ladoDosMapas>
/** Os mapas dos anos (e as camadas pequenas) em quadros quadrados que abraçam o desenho. */
function ajustarMapasAnos(el) {
  const g = el.querySelector('.mapas-anos'); if (!g) return;
  const itens = g.querySelectorAll('.ano-mapa'); if (!itens.length) return;
  const c = el.querySelector('.corpo'), nota = el.querySelector('.mapas-anos + .nota');
  const L = g.clientWidth || c.clientWidth, A = c.clientHeight - (nota ? nota.offsetHeight + 8 : 0) - (g.offsetTop - c.offsetTop > 0 ? g.offsetTop - c.offsetTop : 0);
  const { colunas, lado } = ladoDosMapas(itens.length, L, Math.max(140, A));
  if (lado < 60) return;
  g.style.gridTemplateColumns = `repeat(${colunas}, ${lado}px)`;
  g.style.justifyContent = 'center'; g.style.alignContent = 'center';
  itens.forEach((b) => { const img = b.querySelector('img'); if (img) { img.style.width = img.style.height = lado - 12 + 'px'; } });
}
function caber(el) {
  const c = el.querySelector('.corpo'); if (!c) return;
  c.style.zoom = '';
  ajustarMapasAnos(el);
  if (CELULAR() || el === focado || el.classList.contains('miniatura')) return;
  let z = 1;
  while (c.scrollHeight - c.clientHeight > 2 && z > 0.82) { z = +(z - 0.06).toFixed(2); c.style.zoom = z; }
}
/** Quem recebe as bolinhas: a janela em foco; no celular só a que está à vista. */
function janelasAVista() {
  // no modo fazenda a navegação também é janela de bolinhas (sempre a primeira: as dela não voam na troca de seção)
  const nav = dossie && !CELULAR() ? [$('navFazenda')] : [];
  if (focado) return [...nav, focado];
  if (!CELULAR()) return [...nav, ...paineisVivos.filter((el) => !el.classList.contains('miniatura') && !el.classList.contains('oculta'))];
  const w = innerWidth;
  return paineisVivos.filter((el) => { const b = el.getBoundingClientRect(); return Math.min(b.right, w) - Math.max(b.left, 0) > b.width * 0.5; }).slice(0, 1);
}
/** A janela anda até o lugar novo (FLIP): mede antes, muda, mede depois e anima a diferença. */
function comFlip(mudar) {
  const antes = new Map(paineisVivos.map((el) => [el, el.getBoundingClientRect()]));
  mudar();
  if (CALMO) return;
  for (const [el, a] of antes) {
    const b = el.getBoundingClientRect();
    if (!a.width || !b.width || el.classList.contains('oculta')) continue;
    const dx = a.left - b.left, dy = a.top - b.top, sx = a.width / b.width, sy = a.height / b.height;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue;
    el.style.transition = 'none'; el.style.transformOrigin = '0 0';
    el.style.transform = `translate(${dx}px,${dy}px) scale(${sx},${sy})`;
    el.getBoundingClientRect();
    el.style.transition = 'transform .55s cubic-bezier(.2,.8,.2,1)'; el.style.transform = '';
    setTimeout(() => { el.style.transition = ''; el.style.transformOrigin = ''; }, 620);
  }
}
/** O que está dentro da janela: no foco a resposta INTEIRA (lista toda, gráfico com todos os valores). */
function renderizarCorpo(el, foco) {
  const p = foco ? el._corpo : el._parte;
  if (el.dataset.tipo === 'imagem') return;            // o mapa é o mesmo; no foco ganha zoom e arrasto
  el.querySelector('.titulo').textContent = p.titulo || '';
  const sub = el.querySelector('.sub'); if (sub) sub.textContent = p.sub || '';
  el.querySelector('.corpo').innerHTML = p.blocos.map((b) => htmlDoBloco(b, foco)).join('');
  el.querySelector('.corpo').scrollTop = 0;
}
function focar(el) {
  if (!el || !paineisVivos.includes(el) || focado === el) return;
  const anterior = focado;
  comFlip(() => {
    if (anterior) { anterior.classList.remove('focado'); renderizarCorpo(anterior, false); Zoom.zerar(anterior); }
    focado = el;
    el.classList.add('focado', 'pronto');
    renderizarCorpo(el, true);
    aplicarArranjo();
  });
  Esfera.formar([el]);                 // as bolinhas das outras janelas correm para a que cresceu
  diag('foco ' + (el.dataset.tipo || ''));
}
function desfocar() {
  if (!focado) return;
  const el = focado;
  comFlip(() => { focado = null; el.classList.remove('focado'); renderizarCorpo(el, false); Zoom.zerar(el); aplicarArranjo(); });
  Esfera.formar(janelasAVista());
}
let relogioAuditoria = null;
function trocarPaineis(paineis, opcoes = {}) {
  // auditoria visual: depois que as janelas assentam, mede. No celular a janela rola por dentro (o corte não conta);
  // na TV/computador não há quem role: o corpo que sobrou depois do caber() é conteúdo cortado (05/out/2026)
  clearTimeout(relogioAuditoria);
  relogioAuditoria = setTimeout(() => { try { auditarTela(paineisVivos, 'janelas', { rolaPorDentro: true, corpoSemRolagem: CELULAR() ? null : '.corpo' }); } catch (e) {} }, 2600);
  historicoAntesDeTrocar();          // a tela que sai guarda qual janela estava em foco (o "volta" traz igual)
  const manterFoco = !!focado && !opcoes.semFoco;       // estava explorando uma janela: a resposta nova já entra em foco
  dissolver(paineisVivos);
  focado = null;
  const grade = $('grade');
  grade.scrollLeft = 0;
  document.body.classList.add('com-paineis');
  paineisVivos = paineis.map((p, j) => {
    const el = document.createElement('section');
    el.className = 'painel' + (p.compacto ? ' compacto' : '');
    el.dataset.tipo = p.forma && !CELULAR() ? 'ladrilho' : p.largo ? 'largo' : tipoDoPainel(p);
    el._parte = p; el._corpo = p.origem || p;
    el.style.setProperty('--atraso', atrasoDoPainel(j) + 'ms');
    const indice = paineis.length > 1 ? `<span class="indice">${String(j + 1).padStart(2, '0')}/${String(paineis.length).padStart(2, '0')}</span>` : '';
    el.innerHTML = `<div class="cab"><div><div class="rotulo"><span>${esc(p.rotulo)}</span>${indice}</div><div class="titulo"${p.compacto && p.sub ? ` title="${esc(p.sub)}"` : ''}>${p.tituloHtml || esc(p.titulo)}${p.compacto && p.sub ? ' <small style="opacity:.55;font-size:.6em;cursor:help">ⓘ</small>' : ''}</div><div class="sub">${esc(p.sub || '')}</div></div>` +
      `<div class="botoes"><button class="expandir" aria-label="Expandir" title="Expandir (ou clique na janela)"><span class="abre">⤢</span><span class="volta">VOLTAR</span></button><button class="fechar" aria-label="Fechar" title="Fechar">✕</button></div></div>` +
      `<div class="corpo">${p.blocos.map((b) => htmlDoBloco(b, false)).join('')}</div>` +
      `<div class="explorar"><button class="explorar-tudo">EXPLORAR ESTE ASSUNTO</button>${sugestoesDoPainel(el._corpo).map((s) => `<button class="chip">${esc(s)}</button>`).join('')}</div>`;
    el.querySelector('.fechar').onclick = (e) => { e.stopPropagation(); fecharPainel(el); };
    el.querySelector('.expandir').onclick = (e) => { e.stopPropagation(); if (p.secaoAlvo && dossie) { mostrarSecao(p.secaoAlvo); return; } focado === el ? desfocar() : focar(el); };
    el.querySelector('.explorar-tudo').onclick = (e) => { e.stopPropagation(); explorar(el); };
    el.querySelectorAll('.chip').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); explorar(el, b.textContent); }; });
    // as abas dos nutrientes, as camadas pequenas (0-10, 20-40), os anos e o TELA CHEIA
    religarMapas(el);
    // botões de dentro (talhão da evolução) e a fazenda clicada no mapa do grupo
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-acao]'); if (b && p.acao) { e.stopPropagation(); p.acao(b.dataset.acao, b.dataset.valor, el); return; }
      // clicar num TALHÃO do desenho abre a vista do talhão (03/out/2026)
      const pg = e.target.closest('polygon[data-talhao]'); if (pg && dossie) { e.stopImmediatePropagation(); abrirTalhao(pg.dataset.fazenda, pg.dataset.talhao); return; }
      const g = e.target.closest('g.faz[data-fazenda]'); if (g && dossie) { e.stopPropagation(); escolherFazenda(g.dataset.fazenda); }
    });
    // clicar em qualquer lugar da janela (ou da miniatura) = foco; o ladrilho do resumo abre a seção dele
    el.addEventListener('click', (e) => {
      if (e.defaultPrevented || focado === el || e.target.closest('button, a, g.faz, polygon[data-talhao]')) return;
      if (p.secaoAlvo && dossie && !el.classList.contains('miniatura')) { mostrarSecao(p.secaoAlvo); return; }
      focar(el);
    });
    el.addEventListener('animationend', (e) => { if (e.target === el && /materializa|aparece/.test(e.animationName)) el.classList.add('pronto'); });
    el.querySelectorAll('.moldura img').forEach(vidroNaImagem);
    grade.appendChild(el);
    return el;
  });
  if (manterFoco && paineisVivos[0]) { focado = paineisVivos[0]; focado.classList.add('focado'); renderizarCorpo(focado, true); }
  // HISTÓRICO (04/out/2026): toda tela criada fica guardada (o conteúdo, a fazenda/seção e o foco)
  if (opcoes.voo) paineisVivos.forEach((el) => el.classList.add('do-historico', opcoes.voo === 'direita' ? 'da-direita' : 'da-esquerda'));
  historicoAoTrocar(paineis, opcoes);
  aplicarArranjo();
  if (DEMO) setTimeout(() => { for (const g of graficosAVista()) if (!g.ok) { diag('grafico fora de vista: ' + g.painel); console.warn('[ao-vivo] gráfico fora de vista:', g.painel); } }, 1600);
  // espera o navegador assentar as janelas (e a folha começar a encolher) para mirar as bolinhas
  requestAnimationFrame(() => requestAnimationFrame(() => Esfera.formar(janelasAVista())));
}
function fecharPainel(el) {
  if (focado === el) focado = null;
  paineisVivos = paineisVivos.filter((x) => x !== el);
  dissolver([el]);
  if (!paineisVivos.length) { fecharTudo(); return; }
  comFlip(aplicarArranjo);
  requestAnimationFrame(() => Esfera.formar(janelasAVista()));
}
function fecharTudo() {
  historicoAoFechar();
  dissolver(paineisVivos); paineisVivos = []; ultimosCorpos = []; focado = null;
  // fecha também a fazenda (a navegação some e a folha volta para o meio)
  if (dossie) { dossie = null; dossieSecao = null; dossieFazenda = null; diag('fecha fazenda'); }
  Visor.fechar();
  document.body.classList.remove('com-paineis', 'em-foco', 'com-tira', 'modo-fazenda');
  desenharTrilha();
  $('pontos').innerHTML = '';
  Esfera.formar([]);
}
/** "Deixa só essa": as outras saem, ela fica (e cresce para o espaço). */
function fecharOutras(el) {
  if (!el || !paineisVivos.includes(el)) return;
  const outras = paineisVivos.filter((x) => x !== el);
  if (!outras.length) return;
  paineisVivos = [el];
  dissolver(outras);
  comFlip(aplicarArranjo);
  requestAnimationFrame(() => Esfera.formar(janelasAVista()));
}
/** "Organiza as telas": sai do foco e da tela cheia, zera o zoom e refaz o arranjo. */
function organizarTelas() {
  Visor.fechar();
  paineisVivos.forEach((el) => Zoom.zerar(el));
  if (focado) desfocar(); else { comFlip(aplicarArranjo); Esfera.formar(janelasAVista()); }
}
$('limpar').onclick = fecharTudo;
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !paineisVivos.length || document.activeElement === $('digitado')) return;
  // 03/out/2026: Esc sobe UM nível (foco → janelas → resumo → grupo → início) — voltarUmNivel/trilhaDoEstado
  if (!voltarUmNivel()) { if (focado) desfocar(); else fecharTudo(); }
});
// clique fora da janela em foco (na área vazia ou na tira, fora de uma miniatura) = volta
$('paineis').addEventListener('click', (e) => { if (focado && !e.target.closest('.painel')) desfocar(); });

// celular: arrastou para outra janela → as bolinhas vão com ela; pontinhos acompanham
let relogioRolagem = null;
$('grade').addEventListener('scroll', () => {
  if (!CELULAR() || focado) return;
  clearTimeout(relogioRolagem);
  relogioRolagem = setTimeout(() => {
    const vis = janelasAVista(); Esfera.formar(vis);
    const j = paineisVivos.indexOf(vis[0]);
    [...$('pontos').children].forEach((p, k) => p.classList.toggle('on', k === j));
  }, 160);
}, { passive: true });
// a tela mudou de tamanho: refaz o arranjo; se passou de celular para tela larga (ou o contrário), refaz a divisão
let eraCelular = CELULAR();
addEventListener('resize', () => {
  if (!paineisVivos.length) { eraCelular = CELULAR(); return; }
  if (CELULAR() !== eraCelular && ultimosCorpos.length) { eraCelular = CELULAR(); trocarPaineis(ordenarParaArranjo(distribuir(ultimosCorpos, !eraCelular))); return; }
  aplicarArranjo(); Esfera.formar(janelasAVista());
});

export {
  K, T, GB, X, NT, TX, htmlDoBloco, paineisVivos, focado, dossie, dossieFazenda, dossieSecao, mudarEstado,
  mostrarTelas, ajustarMapasAnos, focar, desfocar, trocarPaineis, fecharPainel, fecharTudo, fecharOutras, organizarTelas,
  ultimosCorpos,
};
