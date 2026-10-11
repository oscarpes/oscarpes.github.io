// OSCARPES AO VIVO — navegacao.js
// NAVEGAR: entender a navegação falada no modo fazenda ("abre a fertilidade", "vai pra Pato Branco
// II"), a TRILHA no alto (← VOLTAR, Início, migalhas) e Backspace sobe um nível.
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import './evolucao.js?v=20261010213811';
import { $, esc } from './base.js?v=20261010213811';
import { CELULAR } from './cena.js?v=20261010213811';
import { dossie, dossieFazenda, dossieSecao, focado, paineisVivos } from './telas.js?v=20261010213811';
import { Visor } from './visor.js?v=20261010213811';
import { SECOES, dossieTalhao, executarTrilha } from './fazenda.js?v=20261010213811';

// <entenderNavegacao> (função pura — o portão roda ela)
/** No modo fazenda: "mostra as aplicações", "abre a fertilidade", "vai pra Pato Branco II",
 *  "fecha a fazenda" → { acao: 'secao', id } | { acao: 'fazenda', nome } | { acao: 'fecharFazenda' } | null */
function entenderNavegacao(frase, nav) {
  const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const rom = (s) => n(s).replace(/^fazenda /, '').replace(/\b([1-5])\b/g, (d) => ['', 'i', 'ii', 'iii', 'iv', 'v'][+d]);
  const f = n(frase); if (!f || !nav) return null;
  const palavras = f.split(' '); if (palavras.length > 7) return null;
  if (/^(fecha|fechar|feche|sai|sair|saia)( d?[aoe])? ?(a |o )?(fazenda|grupo|dossie|resumo completo|navegacao)$/.test(f)) return { acao: 'fecharFazenda' };
  const VERBO = /^(me )?(mostra|mostre|mostrar|abre|abra|abrir|vai|va|ir|volta|volte|voltar|ver|veja|traz|traga|passa|passe|troca|troque|entra|entre|quero ver)( (pra|para|pro|no|na|nos|nas|a|o|as|os|em))*\b ?/;
  const temVerbo = VERBO.test(f);
  const resto = f.replace(VERBO, '').replace(/^(a|o|as|os|da|do|de|pra|para|pro) /, '').trim();
  if (!temVerbo && palavras.length > 3 && !/^(o )?talhao /.test(f)) return null;
  // fazenda do grupo
  if (/^(todas as fazendas|o grupo( todo| inteiro)?|grupo( todo| inteiro)?|todas)$/.test(resto) && (nav.fazendas || []).length > 1) return { acao: 'fazenda', nome: null };
  // TALHÃO (03/out/2026 — João: "o talhão número um" não achava): a MESMA régua do servidor
  // (talhao-nome.ts): "número um" = "1" = "01"; o ano do fim sai; "1 C" é outro talhão.
  // Vale "abre o talhão 7", "o talhão número um", "talhão um" e, com a fazenda aberta, "abre o 1".
  const EXT = { um: 1, uma: 1, primeiro: 1, dois: 2, duas: 2, segundo: 2, tres: 3, terceiro: 3, quatro: 4, quarto: 4, cinco: 5, quinto: 5, seis: 6, sexto: 6, sete: 7, setimo: 7, oito: 8, oitavo: 8, nove: 9, nono: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20 };
  const chaveT = (x) => { const t = n(String(x).replace(/\s*[-–]\s*20\d\d.*$/, '')).replace(/(\d)([a-z])\b/g, '$1 $2').split(' ').filter(Boolean);
    while (t.length > 1 && /^(talhao|talhoes|numero|n|no|o|a|do|da|de)$/.test(t[0])) t.shift();
    return t.map((p) => (EXT[p] != null ? String(EXT[p]) : /^\d+$/.test(p) ? String(Number(p)) : p)).join(' '); };
  const mt = /^(?:o )?talhao (.+)$/.exec(resto) || (temVerbo && /^(\d{1,3}|um|dois|tres|quatro|cinco|seis|sete|oito|nove|dez)( [a-z])?$/.test(resto) ? [resto, resto] : null);
  if (mt && (temVerbo || /^(o )?talhao /.test(f))) {
    const alvo = chaveT(mt[1]);
    const t = (nav.talhoes || []).find((x) => chaveT(x) === alvo);
    return t ? { acao: 'talhao', nome: t } : null;
  }
  const alvoFaz = rom(resto.replace(/^(a |o )?fazenda /, ''));
  const faz = (nav.fazendas || []).find((x) => rom(x) === alvoFaz) || (alvoFaz.length >= 4 ? (nav.fazendas || []).find((x) => rom(x).startsWith(alvoFaz + ' ') || rom(x) === alvoFaz) : null);
  if (faz && (temVerbo || palavras.length <= 3)) return { acao: 'fazenda', nome: faz };
  const SEC = [
    ['resumo', /^(o )?(resumo|visao geral|inicio|painel geral|geral)$/],
    ['talhoes', /^(os )?(talhoes|talhao|mapa dos talhoes|talhoes da fazenda)$/],
    ['fertilidade', /^(a )?(fertilidade|analises?( de solo)?|nutrientes|solo|mapas? de fertilidade|mapas)$/],
    ['monitoramento', /^(o )?(monitoramento|visitas?|pragas|alvos)$/],
    ['aplicacoes', /^(as )?(aplicac[a-z]*|caderno( de campo)?|pulverizac[a-z]*)$/],
    ['evolucao', /^(a )?(evolucao( da lavoura)?|lavoura|plantio|plantinhas|estadios?|crescimento( da lavoura)?)$/],
    ['clima', /^(a )?(chuvas?|clima|tempo|previsao( do tempo)?)$/],
    ['estoque', /^(o )?(estoque|almoxarifado|produtos)$/],
    ['laboratorio', /^(o )?(laboratorio|lab|pedidos do laboratorio|laudos?)$/],
    ['financeiro', /^(o )?(financeiro|despesas|gastos)$/],
  ];
  for (const [id, re] of SEC) if (re.test(resto) && (nav.secoes || []).includes(id)) return { acao: 'secao', id };
  return null;
}
// </entenderNavegacao>

// ---------------------------------------------------------------------------
// A TRILHA (onde estou) E O VOLTAR — sempre à vista (03/out/2026)
// ---------------------------------------------------------------------------
// João: "fiquei um pouco confuso se consigo navegar por tudo ali, algumas
// vezes não achei o botão de voltar". Com qualquer janela aberta há, no alto
// da área da direita: "← VOLTAR" (um nível acima), a folha (Início: fecha
// tudo) e a trilha clicável (BF Agro › Pato Branco I › Fertilidade › …).
// Esc e Backspace sobem um nível; "volta" por voz também.
// <trilhaDoEstado> (função pura — o portão roda ela)
/** estado → { migalhas: [{rotulo, acao}], voltar: {rotulo, acao} | null } (acao null = onde estou) */
function trilhaDoEstado(e) {
  const m = [{ rotulo: 'Início', acao: 'inicio' }];
  if (e.dossie) {
    const d = e.dossie;
    m.push({ rotulo: d.cliente, acao: d.grupo ? 'grupo' : 'resumo' });
    if (d.grupo && d.escolhida) m.push({ rotulo: d.escolhida, acao: 'resumo' });
    if (d.talhao) m.push({ rotulo: `Talhão ${d.talhao}`, acao: e.focado ? 'desfocar' : null });
    else if (d.secao) m.push({ rotulo: d.secao, acao: e.focado ? 'desfocar' : null });
  } else if (e.paineis) m.push({ rotulo: 'Respostas', acao: e.focado ? 'desfocar' : null });
  if (e.focado) m.push({ rotulo: e.focado, acao: null });
  let voltar = null;
  if (e.visor) voltar = { rotulo: 'Fechar a tela cheia', acao: 'fecharVisor' };
  else if (e.focado) voltar = { rotulo: 'Voltar às janelas', acao: 'desfocar' };
  else if (e.dossie && e.dossie.talhao) voltar = { rotulo: 'Voltar à fazenda', acao: 'sairTalhao' };
  else if (e.dossie && e.dossie.secaoId !== 'resumo') voltar = { rotulo: 'Voltar ao resumo', acao: 'resumo' };
  else if (e.dossie && e.dossie.grupo && e.dossie.escolhida) voltar = { rotulo: 'Voltar ao grupo', acao: 'grupo' };
  else if (e.dossie || e.paineis) voltar = { rotulo: 'Voltar ao início', acao: 'inicio' };
  if (m.length) m[m.length - 1] = { ...m[m.length - 1], acao: null };
  return { migalhas: m, voltar };
}
// </trilhaDoEstado>
function estadoDaTela() {
  return {
    visor: Visor.aberto, paineis: paineisVivos.length,
    focado: focado ? String((focado._parte || {}).titulo || 'janela') : null,
    dossie: dossie ? { cliente: dossie.escopo === 'fazenda' ? (dossie.fazenda || dossie.cliente) : dossie.cliente, grupo: dossie.escopo === 'cliente' && dossie.fazendas.length > 1,
      escolhida: dossieFazenda, secaoId: dossieSecao || null, talhao: dossieSecao === 'talhao' && dossieTalhao ? dossieTalhao.talhao : null, secao: dossieSecao && SECOES[dossieSecao] ? SECOES[dossieSecao].titulo : (dossieSecao === null && paineisVivos.length ? 'Consulta' : null) } : null,
  };
}
/** O gráfico das janelas de evolução está à vista sem rolar? (João, 03/out: "estou tendo que rolar para achar
 *  ele"). Mede cada janela com gráfico: o topo do gráfico dentro do corpo e ao menos 120 px à vista. No ?demo
 *  a página confere sozinha a cada troca de janelas e anota no diagnóstico; o portão confere que ela existe. */
function graficosAVista() {
  return paineisVivos.filter((el) => !el.classList.contains('oculta') && !el.classList.contains('miniatura')).map((el) => {
    const c = el.querySelector('.corpo'), g = el.querySelector('svg.graf, svg.evol'); if (!c || !g) return null;
    const rc = c.getBoundingClientRect(), rg = g.getBoundingClientRect();
    return { painel: (el._parte || {}).rotulo, ok: rg.top >= rc.top - 1 && Math.min(rg.bottom, rc.bottom) - rg.top >= 120 };
  }).filter(Boolean);
}
/** O que o "voltar" faria agora ('desfocar', 'resumo', 'inicio'…; '' = nada) — o "volta" por voz no nível de cima vira o histórico. */
function acaoDoVoltar() { const t = trilhaDoEstado(estadoDaTela()); return t.voltar ? t.voltar.acao : ''; }
function voltarUmNivel() { const t = trilhaDoEstado(estadoDaTela()); if (t.voltar) executarTrilha(t.voltar.acao); return !!t.voltar; }
function desenharTrilha() {
  const el = $('trilha'); if (!el) return;
  const aberto = paineisVivos.length > 0 || !!dossie;
  document.body.classList.toggle('com-trilha', aberto);
  if (!aberto) { el.innerHTML = ''; return; }
  const t = trilhaDoEstado(estadoDaTela());
  el.innerHTML = `<button class="voltar" data-trilha="${t.voltar ? t.voltar.acao : ''}" title="${esc(t.voltar ? t.voltar.rotulo : '')} (Esc)">← VOLTAR</button>` +
    `<button class="inicio" data-trilha="inicio" title="Início (fecha tudo)">${TEMA.iconeInicio ? `<img src="${TEMA.iconeInicio}" alt="" width="14" height="17">` : '<span aria-hidden="true">⌂</span>'}</button>` +
    `<nav class="migalhas">${t.migalhas.map((m, i) => `${i ? '<i>›</i>' : ''}${m.acao ? `<button data-trilha="${m.acao}">${esc(m.rotulo)}</button>` : `<b>${esc(m.rotulo)}</b>`}`).join('')}</nav>`;
  el.querySelectorAll('[data-trilha]').forEach((b) => { b.onclick = (ev) => { ev.stopPropagation(); if (b.dataset.trilha) executarTrilha(b.dataset.trilha); }; });
  const nav = document.body.classList.contains('modo-fazenda') && !CELULAR() ? $('navFazenda').offsetWidth + Math.min(28, Math.max(12, innerWidth * 0.012)) : 0;
  el.style.left = CELULAR() ? '' : `calc(clamp(16px,2.2vw,56px) + ${nav}px)`;
}
addEventListener('keydown', (e) => {
  if (e.key !== 'Backspace' || Visor.aberto) return;
  const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
  if (paineisVivos.length || dossie) { e.preventDefault(); voltarUmNivel(); }
});

export {
  entenderNavegacao, graficosAVista, voltarUmNivel, desenharTrilha, acaoDoVoltar,
};
