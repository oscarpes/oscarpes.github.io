// OSCARPES AO VIVO — arranjo.js
// A conta do ARRANJO (funções puras, sem estado — o portão scripts/conferir-ao-vivo-voz.ts roda
// elas): como n janelas ocupam a tela, como uma resposta grande se reparte em janelas, e o encaixe
// dos ladrilhos do mosaico do resumo da fazenda.
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import './servidor.js?v=20261010213811';

// ---------------------------------------------------------------------------
// PAINÉIS — as janelas de vidro
// ---------------------------------------------------------------------------
// 02/out/2026, João na TV: "conforme ele for trazendo as informações
// solicitadas, ele deve trazer as páginas naquele estilo transparência" e
// "quando a mensagem traz várias informações vai adequando na tela, pq na
// versão celular a tela é menor, mas na versão mac aqui temos espaço".
// - Cada resposta com consultas TROCA o conjunto de janelas (as velhas se
//   dissolvem em bolinhas, as novas se formam). Resposta sem consulta mantém
//   as janelas da pergunta anterior (a conversa continua no mesmo assunto).
// - Tela larga (TV/Mac): várias janelas lado a lado, a principal maior
//   (arranjo); resposta com muita coisa é DISTRIBUÍDA em várias janelas
//   (números numa, lista na outra, lista longa partida) em vez de uma janela
//   comprida (distribuir).
// - Celular: uma janela por vez, de lado a lado, arrastando para o lado.
// Cada desenho devolve { rotulo, titulo, sub, blocos: [...] } com blocos de
// tipos fixos: kpis (números), tabela (lista), grafico, imagem, texto, nota.

// <arranjo> (função pura — o portão scripts/conferir-ao-vivo-voz.ts roda ela)
/** Como n janelas ocupam uma tela desta largura (px). tipos = o tipo de cada
 *  janela (tipoDoPainel): quando a 1ª é só de números (uma resposta repartida),
 *  ela vira uma FAIXA no alto e as listas dividem o resto, lado a lado. */
function arranjo(n, largura, tipos = []) {
  if (largura < 760) return { modo: 'carrossel' };
  const u = (colunas, areas, maximo = '100%', faixa = false) => ({ modo: 'grade', colunas, areas, linhas: areas.length, maximo, faixa });
  if (n <= 1) return u('minmax(0,1fr)', ['a'], tipos[0] === 'largo' ? '100%' : 'min(1240px,100%)');
  // 02/out/2026, noite — João: "abriu dois retângulos que caberiam em quadrados". Com DUAS
  // janelas (números + lista) a faixa no alto virava duas tiras finas: agora ficam lado a lado.
  if (tipos[0] === 'numeros' && n === 2) return u('minmax(0,.8fr) minmax(0,1.5fr)', ['a b'], 'min(1700px,100%)');
  if (tipos[0] === 'numeros' && n <= 4) {
    const cols = Array(n - 1).fill('minmax(0,1fr)').join(' ');
    return u(cols, [Array(n - 1).fill('a').join(' '), 'bcd'.slice(0, n - 1).split('').join(' ')], n === 2 ? 'min(1500px,100%)' : '100%', true);
  }
  if (largura < 1200) {
    if (n === 2) return u('minmax(0,1fr) minmax(0,1fr)', ['a b']);
    if (n === 3) return u('minmax(0,1.2fr) minmax(0,1fr)', ['a b', 'a c']);
    if (n === 4) return u('minmax(0,1fr) minmax(0,1fr)', ['a b', 'c d']);
    return u('minmax(0,1fr) minmax(0,1fr)', n === 5 ? ['a b', 'c d', 'e e'] : ['a b', 'c d', 'e f']);
  }
  if (n === 2) return u('minmax(0,1.35fr) minmax(0,1fr)', ['a b'], 'min(1800px,100%)');
  if (n === 3) return u('minmax(0,1.3fr) minmax(0,1fr)', ['a b', 'a c']);
  if (n === 4) return u('minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)', ['a b c', 'a d d']);
  if (n === 5) return u('minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)', ['a b c', 'a d e']);
  return u('minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', ['a b c', 'd e f']);
}
// </arranjo>

// <distribuir> (função pura — o portão roda ela)
const TETO_PAINEIS = 6;
/** Reparte as respostas em janelas: na tela larga, números e lista em janelas
 *  separadas e lista longa em pedaços (até TETO_PAINEIS); no celular, uma por resposta. */
function distribuir(corpos, largo) {
  const lista = corpos.filter((c) => c && Array.isArray(c.blocos) && c.blocos.length).slice(0, TETO_PAINEIS);
  if (!largo) return lista;
  const LINHAS = 8;
  // resposta que já traz muitas consultas não é partida (cada uma na sua janela);
  // a partição é para quando vem POUCA coisa com muito dentro
  const limite = lista.length >= 4 ? lista.length : lista.length === 3 ? 4 : TETO_PAINEIS;
  let sobra = limite - lista.length;
  const out = [];
  for (const c of lista) {
    const tab = c.blocos.find((b) => b.tipo === 'tabela');
    const visuais = c.blocos.filter((b) => b !== tab && b.tipo !== 'nota');
    if (!tab || !tab.linhas.length || c.largo) { out.push(c); continue; }
    // lista curta (até 6 linhas) fica junto dos números: uma janela cheia, não duas pela metade
    if (tab.linhas.length <= 6) { out.push(c); continue; }
    let resto = tab.linhas, primeiro = c;
    if (visuais.length && sobra > 0) {           // números/gráfico numa janela, a lista em outra
      out.push({ ...c, origem: c, blocos: c.blocos.filter((b) => b !== tab) });
      sobra--;
      primeiro = { rotulo: c.rotulo, titulo: c.tituloLista || c.titulo, sub: '', blocos: [], origem: c };
    } else primeiro = { ...c, origem: c, blocos: c.blocos.filter((b) => b !== tab) };
    const total = resto.length;
    const pedacos = [];
    while (resto.length > LINHAS + 3 && sobra > 0) { pedacos.push(resto.slice(0, LINHAS)); resto = resto.slice(LINHAS); sobra--; }
    pedacos.push(resto);
    let ini = 0;
    pedacos.forEach((linhas, p) => {
      const faixa = pedacos.length > 1 ? `itens ${ini + 1}–${ini + linhas.length} de ${total}` : '';
      ini += linhas.length;
      const blocoTab = { ...tab, linhas };
      if (p === 0) out.push({ ...primeiro, sub: [primeiro.sub, faixa].filter(Boolean).join(' · '), blocos: [...primeiro.blocos.filter((b) => b.tipo !== 'nota'), blocoTab, ...primeiro.blocos.filter((b) => b.tipo === 'nota')] });
      else out.push({ rotulo: c.rotulo, titulo: (c.tituloLista || c.titulo) + ' (cont.)', sub: faixa, blocos: [blocoTab], origem: c });
    });
  }
  return out;
}
// </distribuir>

/** Com 4 janelas na tela larga a 4ª vaga é a comprida (embaixo, 2 colunas):
 *  gráfico ou lista vão para ela, onde cabem sem rolar. */
function ordenarParaArranjo(ps) {
  if (ps.length !== 4) return ps;
  const k = [1, 2].find((j) => tipoDoPainel(ps[j]) === 'grafico') ?? [1, 2].find((j) => tipoDoPainel(ps[j]) === 'lista');
  if (k == null || ['grafico', 'lista'].includes(tipoDoPainel(ps[3]))) return ps;
  const out = ps.slice(); [out[k], out[3]] = [out[3], out[k]]; return out;
}
/** O tipo da janela (muda o arranjo por dentro: número centralizado, imagem enche). */
function tipoDoPainel(p) {
  const ts = p.blocos.map((b) => b.tipo);
  if (ts.includes('imagem') || ts.includes('camadas') || ts.includes('mapas-anos')) return 'imagem';
  if (ts.includes('tabela')) return 'lista';
  if (ts.includes('grafico')) return 'grafico';
  if (ts.every((t) => t === 'kpis' || t === 'nota')) return 'numeros';
  return 'texto';
}

// <encaixar> (função pura — o portão scripts/conferir-ao-vivo-voz.ts roda ela)
/** Encaixa os ladrilhos (formas {w,h,alt}) numa grade C×R, na ordem de prioridade:
 *  a forma preferida; sem lugar, as menores (alt); o que não couber fica null (vai
 *  pela navegação). Depois quem tem vizinho vazio CRESCE para ele (sem buraco). */
function encaixar(formas, C, R) {
  const ocup = Array.from({ length: R }, () => Array(C).fill(-1));
  const livre = (c, r, w, h) => { if (c + w > C || r + h > R) return false; for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (ocup[y][x] >= 0) return false; return true; };
  const out = formas.map(() => null);
  formas.forEach((f, i) => {
    const opcoes = [[f.w, f.h], ...(f.alt || []), [1, 1]].map(([w, h]) => [Math.min(w, C), Math.min(h, R)]);
    for (const [w, h] of opcoes) {
      let achou = null;
      for (let r = 0; r <= R - h && !achou; r++) for (let c = 0; c <= C - w && !achou; c++) if (livre(c, r, w, h)) achou = [c, r];
      if (achou) { out[i] = { col: achou[0], row: achou[1], w, h }; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) ocup[achou[1] + y][achou[0] + x] = i; return; }
    }
  });
  for (let volta = 0; volta < 3; volta++) out.forEach((p, i) => {
    if (!p) return;
    while (p.col + p.w < C && Array.from({ length: p.h }, (_, k) => ocup[p.row + k][p.col + p.w]).every((v) => v < 0)) { for (let k = 0; k < p.h; k++) ocup[p.row + k][p.col + p.w] = i; p.w++; }
    while (p.row + p.h < R && Array.from({ length: p.w }, (_, k) => ocup[p.row + p.h][p.col + k]).every((v) => v < 0)) { for (let k = 0; k < p.w; k++) ocup[p.row + p.h][p.col + k] = i; p.h++; }
    while (p.col > 0 && Array.from({ length: p.h }, (_, k) => ocup[p.row + k][p.col - 1]).every((v) => v < 0)) { p.col--; p.w++; for (let k = 0; k < p.h; k++) ocup[p.row + k][p.col] = i; }
  });
  return out;
}
/** Quantas colunas × linhas de ladrilho cabem LEGÍVEIS nesta área (px). */
function gradeDoMosaico(largura, altura) {
  // ladrilho de no mínimo ~220 × 165 px: na tela de 1280×720 cabem 4 × 3; na TV de 1920×1080, 5 × 4
  return { C: Math.max(2, Math.min(5, Math.floor(largura / 220))), R: Math.max(2, Math.min(4, Math.floor(altura / 165))) };
}
// </encaixar>

export {
  arranjo, distribuir, ordenarParaArranjo, tipoDoPainel, encaixar, gradeDoMosaico,
};
