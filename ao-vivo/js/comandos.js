// OSCARPES AO VIVO — comandos.js
// EXPLORAR e COMANDOS DA TELA resolvidos aqui, sem servidor: "amplia o mapa", "fecha a segunda",
// "volta", "mostra a profundidade 20-40", navegação do modo fazenda por voz; e o contexto da tela
// que vai junto da pergunta ao agente.
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import { dossie, dossieFazenda, dossieSecao, fecharOutras, fecharPainel, fecharTudo, focado, focar, organizarTelas, paineisVivos } from './telas.js?v=20261010213811';
import { diag, esc } from './base.js?v=20261010213811';
import { abrirConversa, legenda, legendaSome, perguntar } from './ouvido.js?v=20261010213811';
import { tipoDoPainel } from './arranjo.js?v=20261010213811';
import { trocarProfundidadePorVoz } from './mapas.js?v=20261010213811';
import { Visor, Zoom, abrirVisorDaJanela } from './visor.js?v=20261010213811';
import { abrirTalhao, doEscopo, escolherFazenda, mostrarSecao } from './fazenda.js?v=20261010213811';
import { acaoDoVoltar, entenderNavegacao, voltarUmNivel } from './navegacao.js?v=20261010213811';
import { Historico, sinal } from './controle.js?v=20261010213811';

// ---------------------------------------------------------------------------
// EXPLORAR — manda ao agente a pergunta COM o assunto da janela (título e os
// argumentos da consulta: fazenda, talhão, período…). A resposta substitui a
// janela em foco (trocarPaineis mantém o foco).
// ---------------------------------------------------------------------------
/** Sugestões de próxima pergunta, conforme o assunto da janela. */
function sugestoesDoPainel(c) {
  const f = String(c.ferramenta || ''), tipo = tipoDoPainel(c);
  if (f === 'imagem') return ['mapa de outro nutriente', 'talhão por talhão', 'recomendação de calagem'];
  if (f === 'resumo_completo') return ['o que pede atenção', 'próximas aplicações do plano', 'compare as fazendas'];
  if (/fertilidade/.test(f)) return ['outros nutrientes', 'talhão por talhão', 'comparar com a safra passada'];
  if (/chuva|clima/.test(f)) return ['últimos 30 dias', 'previsão para a semana', 'comparar com o pluviômetro'];
  if (/monitoramento|pragas|visitas/.test(f)) return ['talhão por talhão', 'fotos do monitoramento', 'comparar com a última visita'];
  if (/contas|financ|dre|quanto_devo|despesas/.test(f)) return ['só as vencidas', 'próximos 30 dias', 'por fornecedor'];
  if (/estoque/.test(f)) return ['abaixo do mínimo', 'o que mais saiu no mês'];
  if (/agenda|lembrete/.test(f)) return ['só hoje', 'próxima semana'];
  if (/vendas|pedidos/.test(f)) return ['por cliente', 'comparar com o mês passado'];
  return tipo === 'lista' ? ['mais detalhes', 'só os mais importantes'] : ['mais detalhes', 'o que mudou desde a última vez'];
}
/** O assunto da janela em uma linha (vai junto da pergunta para o agente). */
function contextoDoPainel(el) {
  const c = el._corpo || el._parte || {};
  const args = Object.entries(c.argumentos || {}).filter(([, v]) => v != null && v !== '' && typeof v !== 'object')
    .slice(0, 6).map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`).join('; ');
  return [`${c.rotulo || ''} — ${c.titulo || ''}`, c.sub, c.ferramenta && c.ferramenta !== 'imagem' ? `consulta ${c.ferramenta}` : '', args].filter(Boolean).join('; ').slice(0, 420);
}
/** Com uma janela em foco, a pergunta leva o assunto dela ("explora mais isso" funciona). */
function comContextoDaTela(texto) {
  // MÓDULO DE TEMA (03/out/2026): a vista aberta pelo módulo (ex.: o playbook de híbridos) também é
  // "o que está na minha tela" — senão o agente não sabe de quem é o "ele" da pergunta seguinte
  const doTema = typeof window.AO_VIVO_CONTEXTO_TELA === 'function' ? String(window.AO_VIVO_CONTEXTO_TELA() || '') : '';
  if (doTema) return `${texto}\n\n(Na minha tela está aberto: ${doTema}.)`;
  // 05/out/2026 (19:02: "eu quero ver as fotos…" com o dossiê da BF Agro aberto): o DOSSIÊ aberto também é contexto
  if ((!focado || !paineisVivos.includes(focado)) && dossie) {
    const quem = [dossie.cliente ? `do grupo ${dossie.cliente}` : '', dossieFazenda || dossie.fazenda ? `fazenda ${dossieFazenda || dossie.fazenda}` : '', dossieSecao ? `seção ${dossieSecao}` : ''].filter(Boolean).join(', ');
    if (quem) return `${texto}\n\n(Na minha tela está aberto: dossiê ${quem}.)`;
  }
  if (!focado || !paineisVivos.includes(focado)) return texto;
  return `${texto}\n\n(Na minha tela está aberto: ${contextoDoPainel(focado)}.)`;
}
function explorar(el, sugestao) {
  if (!el) return;
  if (focado !== el) focar(el);
  const c = el._corpo || {};
  perguntar(sugestao ? `${sugestao} — ${c.titulo || ''}`.trim() : `Explore mais este assunto: ${c.rotulo || ''} — ${c.titulo || ''}`, undefined, { semComando: true });
}

// ---------------------------------------------------------------------------
// COMANDOS DE VOZ DA TELA — resolvidos AQUI, sem ir ao servidor (instantâneo):
// "amplia o mapa", "abre o painel de chuva", "mostra a segunda janela",
// "volta", "fecha isso", "fecha tudo", "explora mais isso", "aproxima".
// Só vale com janela aberta e frase curta; o que não bate vai ao agente.
// ---------------------------------------------------------------------------
// <entenderComando> (função pura — o portão roda ela)
/** frase (já sem o "Oscar") + as janelas [{texto, tipo, ferramenta, focado}] → comando ou null */
function entenderComando(frase, janelas) {
  const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const f = n(frase);
  if (!f || !janelas.length) return null;
  const palavras = f.split(' ');
  if (palavras.length > 8) return null;
  const iFoco = janelas.findIndex((j) => j.focado);
  if (/^(fecha|fechar|feche|limpa|limpar|limpe)( a| as| todas as)? ?(tudo|tela|telas|janelas|todas)$/.test(f)) return { acao: 'fecharTudo' };
  // 04/out/2026 (João vai apresentar pela tela): "organiza as telas", "deixa só essa", "traz pra frente",
  // "aumenta essa". "essa" = a janela em foco; sem foco e com uma janela só, é ela.
  const ESSA = iFoco >= 0 ? iFoco : janelas.length === 1 ? 0 : -1;
  if (/^(organiza|organize|organizar|arruma|arrume|arrumar|ajeita|ajeite|alinha|alinhe|reorganiza|reorganize)( as| a| essas| todas as)? ?(telas|janelas|tela|paineis|isso|tudo|transparencias)?$/.test(f)) return { acao: 'organizar' };
  if (/^(deixa|deixe|fica|fique|mantem|mantenha|so) (so|somente|apenas|com)? ?(essa|esta|esse|este|ela|isso|ela aqui|essa aqui|essa janela|essa tela)( aqui| na tela)?$/.test(f)) return ESSA >= 0 ? { acao: 'soEssa', indice: ESSA } : null;
  if (/^(aumenta|aumente|amplia|amplie|expande|expanda|maximiza|maximize|cresce)( essa| esta| esse| este| ela| isso| essa tela| essa janela)$/.test(f)) {
    const i = ESSA >= 0 ? ESSA : 0;
    return iFoco === i && janelas[i].tipo === 'imagem' ? { acao: 'zoom', fator: 2, indice: i } : { acao: 'focar', indice: i };
  }
  if (/^(traz|traga|trazer|puxa|puxe|bota|coloca|poe)( essa| esta| esse| ela| isso)? (pra|para|pro) (frente|o centro|o meio)$/.test(f)) return { acao: 'focar', indice: ESSA >= 0 ? ESSA : 0 };
  if (/^(fecha|fechar|feche) (isso|essa|esta|este|essa janela|esta janela)$/.test(f)) return iFoco >= 0 ? { acao: 'fechar', indice: iFoco } : null;
  if (/\b(explor\w*|aprofund\w*|detalh\w*)\b/.test(f) && /\b(isso|esse|essa|este|esta|assunto|aqui|ai|janela|tela)\b/.test(f) && palavras.length <= 6) {
    const i = iFoco >= 0 ? iFoco : janelas.length === 1 ? 0 : -1;
    return i >= 0 ? { acao: 'explorar', indice: i } : null;
  }
  if (iFoco >= 0 && janelas[iFoco].tipo === 'imagem') {
    if (/^(aproxima|aproxime|mais zoom|zoom|amplia|amplie|aumenta|aumente)( mais| o mapa| a imagem| isso)?$/.test(f)) return { acao: 'zoom', fator: 2, indice: iFoco };
    if (/^(afasta|afaste|menos zoom|diminui|diminua)( mais| o mapa| a imagem| isso)?$/.test(f)) return { acao: 'zoom', fator: 0.5, indice: iFoco };
  }
  if (/^(volta|voltar|volte|sai|sair|saia|diminui|diminua|reduz|reduzir|ver todas|mostra todas|mostrar todas|todas as janelas)\b/.test(f) && palavras.length <= 5) return { acao: 'voltar' };
  const VERBO = /^(me )?(amplia|amplie|ampliar|aumenta|aumente|abre|abra|abrir|mostra|mostre|mostrar|expande|expanda|expandir|foca|foque|focar|olha|olhar|ver|veja|traz|traga)\b ?/;
  const ORD = { primeir: 0, segund: 1, terceir: 2, quart: 3, quint: 4, sext: 5 };
  const NUM = { um: 0, uma: 0, '1': 0, dois: 1, duas: 1, '2': 1, tres: 2, '3': 2, quatro: 3, '4': 3, cinco: 4, '5': 4, seis: 5, '6': 5 };
  const mo = /\b(primeir|segund|terceir|quart|quint|sext|ultim)[ao]s?\b/.exec(f);
  const mn = /\b(janela|tela|painel|quadro) (um|uma|dois|duas|tres|quatro|cinco|seis|[1-6])\b/.exec(f);
  if ((mo || mn) && (VERBO.test(f) || /\b(janela|tela|painel|quadro)\b/.test(f))) {
    const i = mo ? (mo[1] === 'ultim' ? janelas.length - 1 : ORD[mo[1]]) : NUM[mn[2]];
    return i < janelas.length ? { acao: 'focar', indice: i } : null;
  }
  // "deixa só a do mapa" / "traz a da chuva pra frente": o alvo é achado como no "abre o mapa"
  const so = /^(deixa|deixe|fica|mantem|mantenha) (so|somente|apenas) (.+)$/.exec(f);
  const frente = /^(traz|traga|puxa|puxe|bota|coloca|poe) (.+) (pra|para|pro) (frente|o centro|o meio)$/.exec(f);
  if (so || frente) {
    const alvo = entenderComando('mostra ' + (so ? so[3] : frente[2]), janelas.map((j) => ({ ...j, focado: false })));
    return alvo && alvo.acao === 'focar' ? { acao: so ? 'soEssa' : 'focar', indice: alvo.indice } : null;
  }
  if (!VERBO.test(f)) return null;
  const VAZIAS = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'me', 'um', 'uma', 'esse', 'essa', 'este', 'esta', 'isso', 'pra', 'para', 'por', 'favor', 'ai', 'la', 'agora', 'painel', 'janela', 'tela', 'quadro', 'aquele', 'aquela', 'e', 'mais', 'todo', 'toda', 'inteiro', 'inteira', 'grande', 'maior']);
  const resto = f.replace(VERBO, '').split(' ').filter((p) => p && !VAZIAS.has(p));
  if (!resto.length || resto.length > 4) return null;
  const GRUPOS = [
    [/^mapas?$/, (j) => j.tipo === 'imagem'],
    [/^(chuvas?|clima|tempo|pluviometro|satelite)$/, (j) => /chuva|clima/.test(j.ferramenta) || /chuva|clima/.test(j.texto)],
    [/^(fertilidade|nutrientes?|solo|analise|analises)$/, (j) => /fertilidade/.test(j.ferramenta) || /fertilidade/.test(j.texto)],
    [/^(contas?|pagar|receber|financeiro|boletos?|dre|fluxo)$/, (j) => /conta|financ|dre/.test(j.ferramenta) || /conta|financ/.test(j.texto)],
    [/^(agenda|lembretes?|compromissos?)$/, (j) => /agenda|lembrete/.test(j.ferramenta) || /agenda|lembrete/.test(j.texto)],
    [/^(estoque|produtos|insumos)$/, (j) => /estoque/.test(j.ferramenta) || /estoque|produtos/.test(j.texto)],
    [/^(monitoramento|plantio|talhao|talhoes|pragas?|visita)$/, (j) => /monitoramento|pragas|visita/.test(j.ferramenta) || /monitoramento|talh/.test(j.texto)],
    [/^(grafico|graficos)$/, (j) => j.tipo === 'grafico'],
    [/^(lista|tabela)$/, (j) => j.tipo === 'lista'],
  ];
  const serve = (j) => resto.every((p) => GRUPOS.some(([re, ok]) => re.test(p) && ok(j)) || (p.length >= 3 && j.texto.includes(p)));
  const i = janelas.findIndex(serve);
  if (i < 0) return null;
  if (i === iFoco && janelas[i].tipo === 'imagem' && /^(me )?(amplia|amplie|aumenta|aumente)/.test(f)) return { acao: 'zoom', fator: 2, indice: i };
  return { acao: 'focar', indice: i };
}
// </entenderComando>
const normTela = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
function janelasParaComando() {
  return paineisVivos.map((el) => { const c = el._parte || {}, o = el._corpo || {}; return { texto: normTela([c.rotulo, c.titulo, c.sub, o.titulo, o.legenda].join(' ')), tipo: el.dataset.tipo, ferramenta: String(o.ferramenta || ''), focado: el === focado }; });
}
/** Tenta resolver a frase na própria tela. true = resolveu (não vai ao servidor). */
function comandoDaTela(frase) {
  if (!paineisVivos.length) return false;
  // no modo fazenda, a navegação vem primeiro ("mostra as aplicações", "vai pra Pato Branco II", "fecha a fazenda")
  if (dossie) {
    const nv = entenderNavegacao(frase, { secoes: dossie.secoes || [], fazendas: dossie.escopo === 'cliente' ? dossie.fazendas.map((f) => f.fazenda) : [], talhoes: doEscopo(dossie.talhoes).map((t) => t.talhao) });
    if (nv) {
      diag('navega ' + nv.acao); abrirConversa(); legenda(`<span class="voce">${esc(frase)}</span>`);
      if (nv.acao === 'fecharFazenda') fecharTudo(); else if (nv.acao === 'secao') mostrarSecao(nv.id);
      else if (nv.acao === 'talhao') { const t = doEscopo(dossie.talhoes).find((x) => x.talhao === nv.nome); if (t) abrirTalhao(t.fazenda, t.talhao); }
      else escolherFazenda(nv.nome);
      legendaSome(2500); return true;
    }
  }
  // "abre em tela cheia" / "fecha a tela cheia"
  const ft = normTela(frase);
  // 05/out/2026: a galeria de fotos — "a próxima", "a anterior" passam; "fecha as fotos" fecha o visor E a janela das fotos
  if (Visor.aberto && /^(a |e a )?(proxima|seguinte|outra|mais uma)( foto)?$/.test(ft)) { Visor.passo(1); return true; }
  if (Visor.aberto && /^(a |e a )?(anterior|volta uma)( foto)?$/.test(ft)) { Visor.passo(-1); return true; }
  if (/^(fecha|fechar|feche|tira|sai)( as| a)? fotos?\b/.test(ft)) {
    if (Visor.aberto) Visor.fechar();
    const jf = paineisVivos.find((el) => el.querySelector && el.querySelector('.mapas-anos.fotos'));
    if (jf) fecharPainel(jf);
    return true;
  }
  if (Visor.aberto && /^(fecha|fechar|feche|sai|sair|volta|voltar)\b/.test(ft) && ft.split(' ').length <= 5) { Visor.fechar(); return true; }
  if (/\btela cheia\b/.test(ft) && ft.split(' ').length <= 7) {
    const alvo = (focado && focado.dataset.tipo === 'imagem' ? focado : paineisVivos.find((el) => el.dataset.tipo === 'imagem'));
    if (alvo && abrirVisorDaJanela(alvo)) { abrirConversa(); legendaSome(1500); return true; }
  }
  // "mostra a de 20 a 40" — a camada pequena vira a grande
  if (/\b(mostra|abre|troca|ver|veja|quero|coloca)\b/.test(normTela(frase)) && trocarProfundidadePorVoz(frase)) { abrirConversa(); legendaSome(1500); return true; }
  const cmd = entenderComando(frase, janelasParaComando());
  if (!cmd) return false;
  const el = paineisVivos[cmd.indice];
  diag('comando ' + cmd.acao);
  abrirConversa();
  legenda(`<span class="voce">${esc(frase)}</span>`);
  if (cmd.acao === 'fecharTudo') fecharTudo();
  else if (cmd.acao === 'fechar') fecharPainel(el);
  // "volta" no nível de cima (grade sem foco, fora da fazenda): em vez de fechar tudo, a tela de antes
  else if (cmd.acao === 'voltar') { if (!(acaoDoVoltar() === 'inicio' && Historico.voltar())) voltarUmNivel(); }
  else if (cmd.acao === 'soEssa') { fecharOutras(el); sinal('▣', 'só esta'); }
  else if (cmd.acao === 'organizar') { organizarTelas(); sinal('▦', 'organizado'); }
  else if (cmd.acao === 'focar') focar(el);
  else if (cmd.acao === 'zoom') { focar(el); Zoom.aproximar(el, cmd.fator); }
  else if (cmd.acao === 'explorar') { explorar(el); return true; }
  legendaSome(2500);
  return true;
}

export {
  sugestoesDoPainel, comContextoDaTela, explorar, normTela, comandoDaTela, janelasParaComando, entenderComando,
};
