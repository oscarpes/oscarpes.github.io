// OSCARPES AO VIVO — controle.js
// COMANDOS DE APRESENTAÇÃO (04/out/2026), todos resolvidos AQUI, sem servidor. João: "quero poder
// dizer pra ele: Jarvis, aumente a música; toca mais um pouco; volte aquele slide… slide que na
// verdade não vai ser slide, vai ser a transparência que ele criou voando ali" — ele vai fazer as
// apresentações para os clientes pela tela.
//  - PALMAS: "palmas", "aplausos de pé", "comemora" (som da página + a folha pulsando; a música abaixa);
//  - A VOZ: "repete", "para"/"silêncio", "continua", "mais devagar"/"mais rápido" (fica guardado);
//  - O HISTÓRICO DAS TELAS: toda tela criada fica guardada (conteúdo, fazenda/seção e o foco):
//    "volta aquela", "a anterior", "próxima", "volta a do mapa", "mostra de novo a da chuva",
//    "aquela da logo", "mostra as últimas" (as 4 mais novas lado a lado). Vale para as janelas do
//    motor E para as vistas do tema (o playbook de um tema, o pitch de outro) — window.AO_VIVO_HISTORICO;
//  - O MODO APRESENTAÇÃO: menos legenda, janelas maiores, comando curto vale sem o "Oscar", e o
//    roteiro do tema (window.AO_VIVO_APRESENTACAO) anda por "próximo assunto" / "volta ao início".
// A música ("aumenta a música", "toca mais um pouco", "próxima música") mora em musica.js e as
// janelas ("deixa só essa", "organiza as telas", "traz pra frente") em comandos.js.
// PERGUNTA NUNCA VIRA COMANDO: "?" no fim, "como/qual/quanto…" no começo ou frase longa vão ao agente
// (já deu errado num tema: um comando local engolia pergunta de verdade).
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import { entenderMusica, musicaAbaixaAte } from './musica.js?v=20261010213811';
import { diag, esc } from './base.js?v=20261010213811';
import { Esfera, mudarFase } from './cena.js?v=20261010213811';
import { Voz, mudarRitmo } from './voz.js?v=20261010213811';
import {
  Escuta, abrirConversa, aoAcabarDeFalar, falarEmTurno, legenda, legendaSome, semNomeNoComeco,
} from './ouvido.js?v=20261010213811';
import {
  dossie, dossieFazenda, dossieSecao, fecharTudo, focado, focar, mudarEstado, paineisVivos, trocarPaineis, ultimosCorpos,
} from './telas.js?v=20261010213811';
import { abrirDossie, abrirTalhao, dossieTalhao, mostrarSecao } from './fazenda.js?v=20261010213811';
import { entenderComando, janelasParaComando, normTela } from './comandos.js?v=20261010213811';

// ---------------------------------------------------------------------------
// O QUE A FRASE PEDE — função pura (o portão roda ela com frases certas e com perguntas de verdade)
// ---------------------------------------------------------------------------
// <entenderControle> (função pura — o portão roda ela)
/** frase (com ou sem "Oscar/Jarvis" no começo) → { acao, … } ou null (vai ao agente) */
function entenderControle(frase) {
  const bruto = String(frase || '');
  if (/\?\s*$/.test(bruto)) return null;
  const f = bruto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(oscar|oscarpes|jarvis) /, '').replace(/^(por favor|pode|ok|ta|beleza|agora|e|entao) /, '').replace(/ (por favor|oscar|jarvis|agora)$/, '');
  if (!f || f.split(' ').length > 8) return null;
  if (/^(como|qual|quais|quanto|quantos|quantas|quando|onde|por que|porque|o que|quem|sera|e se|me explica|explica|voce sabe|sabe)\b/.test(f)) return null;
  // PALMAS — "palmas", "uma salva de palmas pra ele", "aplausos de pé", "comemora"
  const PARA = '( (pra|para|pro|pros|pras) [a-z]+( [a-z]+)?)?';
  // 04/out/2026: o João disse "Eu quero palmas" e foi ao agente, que respondeu a previsão da CIDADE de Palmas.
  // Aceita o pedido na frente ("eu quero", "manda", "solta", "toca"…); "chuva/tempo/previsão em Palmas" segue ao agente.
  const fp = f.replace(/^(eu )?(quero|queria|manda|mande|solta|solte|toca|toque|bota|me da|da|de) (umas |uma |as |os )?/, '');
  if (new RegExp(`^(uma )?(grande )?(salva de |rodada de )?(palmas|aplausos?)( fortes?| de pe| bem fortes?)?${PARA}( fortes?| de pe)?$`).test(fp)
    || new RegExp(`^(aplaude|aplaudam|aplaudir|bate palmas?|batam palmas|bater palmas)${PARA}$`).test(fp)) return { acao: 'palmas', forma: /forte|de pe/.test(fp) ? 'fortes' : 'normal' };
  if (new RegExp(`^(comemora|comemore|comemorar|vamos comemorar|bora comemorar|festa|faz festa|faca festa|faz uma festa|hora da festa)${PARA}$`).test(f)) return { acao: 'palmas', forma: 'festa' };
  // A VOZ
  if (/^(repete|repita|repetir|repete isso|repete ai|repete por favor|repete a ultima|fala de novo|fala novamente|diz de novo|fala outra vez|repete o que (voce )?(disse|falou)|nao (entendi|ouvi)|de novo)$/.test(f)) return { acao: 'repetir' };
  if (/^(fala |falar |fale )?(mais devagar|bem devagar|devagar|mais lento|mais calmo|mais pausado)( ai)?$/.test(f)) return { acao: 'ritmo', passo: 1 };
  if (/^(fala |falar |fale )?(mais rapido|mais depressa|mais ligeiro|rapido|acelera|acelere)( ai)?$/.test(f)) return { acao: 'ritmo', passo: -1 };
  if (/^(para|pare|parar|chega|silencio|cala|cale|cala a boca|cale se|quieto|fica quieto|psiu|shh+|para de falar|pare de falar|para ai|pode parar|espera|espere|perai|pera)$/.test(f)) return { acao: 'calar' };
  if (/^(continua|continue|continuar|pode continuar|continua ai|segue|siga|prossegue|prossiga|termina|termine|termina de falar|vai em frente|continua falando)$/.test(f)) return { acao: 'continuar' };
  // O MODO APRESENTAÇÃO
  if (/^(liga |entra no |ativa |abre )?(o )?(modo (de )?apresentacao|modo palestra|modo apresentador)$|^(vamos apresentar|comeca a apresentacao|comecar a apresentacao|inicia a apresentacao|iniciar a apresentacao)$/.test(f)) return { acao: 'apresentacao', ligar: true };
  if (/^(sai|sair|saia|desliga|encerra|encerrar|termina|terminar|fecha|acaba)( do| da| o| a)? ?(modo )?(de )?(apresentacao|palestra)$|^(acabou|fim) (a |da )?apresentacao$/.test(f)) return { acao: 'apresentacao', ligar: false };
  if (/^((vamos |passa |passe |vai )?(para o |pro |pra o |ao )?)?(o )?(proximo|seguinte|outro) (assunto|topico|tema|ponto|bloco|capitulo)$|^(a )?(proxima|seguinte) (parte|etapa)$|^(avanca|avance) (o )?(assunto|topico)$/.test(f)) return { acao: 'assunto', passo: 1 };
  if (/^((volta|voltar|volte) (pro |para o |ao |pra o |o |a |pra |para a |a )?)?(assunto|topico|tema|ponto|bloco|parte|etapa) anterior$/.test(f)) return { acao: 'assunto', passo: -1 };
  if (/^(volta|voltar|volte|vai|ir|vamos) (ao|pro|para o|pra o|pra|para) (inicio|comeco|primeiro assunto|primeira parte)$|^(do|desde o) (inicio|comeco)$|^(recomeca|recomece|comeca|comece) (do|desde o) (inicio|comeco)$|^(recomeca|recomece|comeca) de novo$/.test(f)) return { acao: 'inicio' };
  // O HISTÓRICO DAS TELAS
  const NUM = { duas: 2, dois: 2, tres: 3, quatro: 4, '2': 2, '3': 3, '4': 4 };
  const mu = /^((mostra|mostre|mostrar|traz|traga|ver|veja|abre|abra|bota|coloca|poe) )?((as|todas as|os) )?(ultimas|ultimos)( (duas|dois|tres|quatro|[234]))?( telas| janelas| paineis| transparencias| respostas)?( lado a lado| juntas| juntos)?$/.exec(f);
  if (mu && (mu[1] || mu[7] || mu[8])) return { acao: 'ultimas', n: mu[6] ? NUM[mu[6].trim()] : 4 };
  if (/^(a |o )?(proxima|proximo|seguinte)( tela| janela| transparencia| painel)?$|^(avanca|avance)( uma| a tela)?$/.test(f)) return { acao: 'avancar' };
  if (/^((volta|voltar|volte|mostra|mostre|traz|traga|abre|abra) )?(a |o |pra |para a )?(anterior|de antes|que estava antes)( tela| janela| transparencia)?$|^(volta|volte|voltar) (aquela|aquele|essa|ela)( tela| janela| transparencia)?$|^(volta|voltar|volte) (uma|um)( tela| janela| transparencia)?$|^(a )?(tela|janela|transparencia) anterior$/.test(f)) return { acao: 'anterior' };
  if (/^(volta|voltar|volte|volta ai)$/.test(f)) return { acao: 'volta' };      // com janelas na tela, é o "volta" de sempre
  // "volta a do mapa", "mostra de novo a da chuva", "aquela da logo": precisa da MARCA DE MEMÓRIA
  // (de novo / outra vez / de antes / aquela / "volta a do…") — "mostra o mapa" sozinho NÃO é histórico
  if (/\b(de novo|outra vez|novamente|de antes|aquela|aquele|aquelas|aqueles)\b|^(volta|voltar|volte) (a|o) (do|da|de|dos|das|com) /.test(f)) {
    const VAZIAS = new Set(['volta', 'voltar', 'volte', 'mostra', 'mostre', 'mostrar', 'traz', 'traga', 'abre', 'abra', 'bota', 'poe', 'coloca', 'ver', 'veja', 'quero', 'me',
      'a', 'o', 'as', 'os', 'do', 'da', 'de', 'dos', 'das', 'um', 'uma', 'com', 'sobre', 'no', 'na', 'aquela', 'aquele', 'aquelas', 'aqueles', 'tela', 'telas', 'janela',
      'transparencia', 'painel', 'quadro', 'que', 'voce', 'mostrou', 'abriu', 'fez', 'trouxe', 'isso', 'ai', 'la', 'aqui', 'pra', 'para']);
    const termos = f.replace(/\b(de novo|outra vez|novamente|de antes)\b/g, ' ').split(' ').filter((p) => p && !VAZIAS.has(p));
    if (!termos.length) return { acao: 'anterior' };
    if (termos.length <= 4) return { acao: 'buscar', termos, certeza: /^(volta|voltar|volte|aquela|aquele)\b/.test(f) };
  }
  return null;
}
// </entenderControle>

// <acharNoHistorico> (função pura — o portão roda ela)
/** termos ["mapa"] + entradas [{assunto, tipo}] (a mais velha primeiro) + a atual → índice da mais nova que serve, ou -1 */
function acharNoHistorico(termos, entradas, atual = -1) {
  const SINONIMOS = [
    [/^(mapa|mapas|imagem)$/, /\b(mapa|mapas|imagem|fertilidade|fosforo|potassio|talhoes)\b/],
    [/^(chuva|chuvas|clima|tempo|pluviometro|satelite)$/, /\b(chuva|clima|tempo|pluviometro|satelite|precipitacao)\b/],
    [/^(logo|logotipo|marca|placa)$/, /\b(logo|logotipo|marca|placa|portfolio)\b/],
    [/^(grafico|graficos)$/, /\b(grafico|evolucao)\b/],
    [/^(lista|tabela)$/, /\b(lista|tabela)\b/],
    [/^(conta|contas|financeiro|boleto|boletos)$/, /\b(conta|contas|financeiro|pagar|receber|dre)\b/],
    [/^(solo|analise|analises|nutrientes|fertilidade)$/, /\b(fertilidade|solo|analise|nutriente|nutrientes)\b/],
  ];
  const serve = (e) => termos.every((t) => {
    const sin = SINONIMOS.find(([re]) => re.test(t));
    if (sin && (sin[1].test(e.assunto) || (/^(mapa|mapas|imagem)$/.test(t) && e.tipo === 'imagem'))) return true;
    const raiz = t.length > 5 ? t.slice(0, t.length - 1) : t;
    return t.length >= 2 && e.assunto.split(' ').some((p) => p === t || (raiz.length >= 4 && p.startsWith(raiz)));
  });
  let achou = -1;
  for (let i = entradas.length - 1; i >= 0; i--) {
    if (!serve(entradas[i])) continue;
    if (i !== atual) return i;
    if (achou < 0) achou = i;
  }
  return achou;
}
// </acharNoHistorico>

// ---------------------------------------------------------------------------
// O SINAL — confirmação leve ("feito", sem discurso): um selo que aparece no alto e some
// ---------------------------------------------------------------------------
let elSinal = null, relogioSinal = null;
function sinal(icone, texto) {
  if (!elSinal) { elSinal = document.createElement('div'); elSinal.id = 'sinal'; elSinal.setAttribute('aria-live', 'polite'); document.body.appendChild(elSinal); }
  elSinal.innerHTML = `<i>${esc(icone)}</i><span>${esc(texto || '')}</span>`;
  elSinal.classList.remove('on'); void elSinal.offsetWidth; elSinal.classList.add('on');
  clearTimeout(relogioSinal); relogioSinal = setTimeout(() => elSinal.classList.remove('on'), 1700);
  diag('sinal ' + (texto || icone));
}

// ---------------------------------------------------------------------------
// O HISTÓRICO DAS TELAS
// ---------------------------------------------------------------------------
// Cada tela criada vira uma entrada: as janelas do motor guardam as partes desenhadas, a fazenda /
// seção / talhão do modo fazenda e qual janela estava em foco; as vistas do tema guardam o reabrir()
// do próprio tema. "volta" anda para trás, "próxima" para a frente; reabrir não cria entrada nova.
// histFora = a tela mostra algo que não é a entrada atual (tudo fechado, ou "as últimas").
const HIST_MAX = 40;
let hist = [], histPos = -1, histFora = true, histNavegando = false, histSeq = 0, registrosDoTema = 0, temaCalado = false;
const tituloDasPartes = (ps) => String((ps[0] || {}).titulo || (ps[0] || {}).rotulo || 'tela');
function assuntoDasPartes(ps) {
  const ehImagem = ps.some((p) => (p.blocos || []).some((b) => /imagem|camadas|mapas-anos/.test(b.tipo)));
  return normTela([...ps.flatMap((p) => [p.rotulo, p.titulo, p.sub, p.ferramenta, (p.origem || {}).ferramenta]),
    ehImagem ? 'mapa imagem' : '', dossie ? (dossieFazenda || dossie.fazenda || dossie.cliente) : '', dossieSecao || ''].join(' '));
}
/** A tela que sai guarda qual janela estava em foco (chamado por trocarPaineis/fecharTudo). */
function historicoAntesDeTrocar() {
  if (histNavegando || histFora) return;
  const e = hist[histPos];
  if (e && e.motor && e.els && e.els.some((el) => paineisVivos.includes(el))) e.foco = focado ? e.els.indexOf(focado) : -1;
}
/** Janelas novas na tela (trocarPaineis): entra no histórico — ou só atualiza, se é a mesma tela refeita. */
function historicoAoTrocar(paineis, opcoes = {}) {
  if (opcoes.semHistorico) { histFora = true; return; }
  if (histNavegando) { const e = hist[histPos]; if (e && e.motor) e.els = paineisVivos; histFora = false; return; }
  const chave = paineis.map((p) => `${p.rotulo}|${p.titulo}`).join('§') + '§' + (dossie ? `${dossieFazenda || ''}/${dossieSecao || ''}` : '');
  const e = {
    id: ++histSeq, motor: true, chave, titulo: tituloDasPartes(paineis), assunto: assuntoDasPartes(paineis),
    tipo: paineis.some((p) => (p.blocos || []).some((b) => b.tipo === 'imagem')) ? 'imagem' : '',
    paineis, corpos: ultimosCorpos, dossie, fazenda: dossieFazenda, secao: dossieSecao,
    talhao: dossieSecao === 'talhao' && dossieTalhao ? { ...dossieTalhao } : null, foco: -1, els: paineisVivos,
  };
  const atual = hist[histPos];
  // a mesma tela refeita (a largura mudou, a parte "carregando" chegou): troca no lugar
  if (atual && !histFora && atual.chave === chave) { e.id = atual.id; hist[histPos] = e; return; }
  registrarEntrada(e);
}
// quando a TELA mudou por último (tela nova ou "volta aquela"): o "volta aquela" logo depois de trocar a
// música é da música; logo depois de trocar a tela, é da tela (musica.js, 04/out/2026)
let ultimaTelaEm = 0;
function telaMudouEm() { return ultimaTelaEm; }
function registrarEntrada(e) {
  ultimaTelaEm = Date.now();
  hist.push(e);
  if (hist.length > HIST_MAX) hist.shift();
  histPos = hist.length - 1; histFora = false;
  diag('historico +' + hist.length);
}
/** Fechou tudo (fecharTudo): a entrada continua guardada; o "volta" traz ela de novo. */
function historicoAoFechar() {
  historicoAntesDeTrocar();
  const e = hist[histPos];
  if (!histNavegando && e && e.motor) histFora = true;
}
/** Vista do TEMA (window.AO_VIVO_HISTORICO.registrar): { titulo, assunto?, tipo?, reabrir(), sair? } */
function registrarDoTema(o) {
  if (!o || typeof o.reabrir !== 'function') return null;
  registrosDoTema++;
  if (histNavegando) { histFora = false; return null; }
  const titulo = String(o.titulo || 'vista');
  const e = { id: ++histSeq, motor: false, chave: 'tema:' + (o.chave || titulo), titulo, assunto: normTela([titulo, o.assunto, o.tipo].join(' ')), tipo: String(o.tipo || ''), reabrir: o.reabrir, sair: typeof o.sair === 'function' ? o.sair : null };
  const atual = hist[histPos];
  if (atual && !histFora && atual.chave === e.chave) { e.id = atual.id; hist[histPos] = e; return e.id; }
  registrarEntrada(e);
  return e.id;
}
/** O tema resolveu algo por conta própria (AO_VIVO_FRASE / AO_VIVO_TELA_TEMA) sem registrar: a vista
 *  entra sozinha, descrita pelo AO_VIVO_CONTEXTO_TELA dele e reaberta repetindo o mesmo pedido (calado). */
function historicoDoTema(refazer, frase) {
  const antes = registrosDoTema;
  return () => {
    if (registrosDoTema !== antes || histNavegando) return;       // o tema já registrou (ou estamos reabrindo)
    if (frase && /apresent|treino|quiz|\bmodo\b/.test(normTela(frase))) return;   // modos (roteiro falado) não se repetem
    const ctx = typeof window.AO_VIVO_CONTEXTO_TELA === 'function' ? String(window.AO_VIVO_CONTEXTO_TELA() || '') : '';
    if (!ctx) { if (!paineisVivos.length && hist[histPos] && !hist[histPos].motor) histFora = true; return; }
    const atual = hist[histPos];
    if (atual && !atual.motor && !histFora && atual.assunto === normTela(ctx)) return;
    registrarEntrada({ id: ++histSeq, motor: false, chave: 'tema:' + normTela(ctx), titulo: ctx.slice(0, 80), assunto: normTela(ctx), tipo: '', reabrir: refazer, sair: null, automatica: true });
  };
}
/** Reabre uma entrada do motor como estava (fazenda, seção, foco), voando de um lado. */
function reabrirDoMotor(e, voo) {
  if (e.dossie) {
    if (dossie !== e.dossie) abrirDossie(e.dossie);
    mudarEstado({ dossieFazenda: e.fazenda });
    if (e.secao === 'talhao' && e.talhao) abrirTalhao(e.talhao.fazenda, e.talhao.talhao);
    else mostrarSecao(e.secao || 'resumo');
  } else {
    if (dossie) { mudarEstado({ dossie: null, dossieFazenda: null, dossieSecao: null }); document.body.classList.remove('modo-fazenda'); }
    mudarEstado({ ultimosCorpos: e.corpos });
    trocarPaineis(e.paineis, { semFoco: true });
  }
  paineisVivos.forEach((el) => el.classList.add('do-historico', voo === 'direita' ? 'da-direita' : 'da-esquerda'));
  if (e.foco >= 0 && paineisVivos[e.foco]) setTimeout(() => focar(paineisVivos[e.foco]), 380);
}
function irPara(i, voo) {
  if (i < 0 || i >= hist.length) return false;
  historicoAntesDeTrocar();
  const atual = histFora ? null : hist[histPos], e = hist[i];
  if (atual && !atual.motor && atual !== e && atual.sair) { try { atual.sair(); } catch (err) {} }
  // a vista do tema sai da frente quando volta uma tela do motor (o mesmo aviso de "painel do motor")
  if (e.motor && typeof window.AO_VIVO_TELA_TEMA === 'function') { try { window.AO_VIVO_TELA_TEMA({ ferramenta: 'historico_ao_vivo' }); } catch (err) {} }
  histPos = i; histNavegando = true; ultimaTelaEm = Date.now();
  try {
    if (e.motor) reabrirDoMotor(e, voo);
    else { if (paineisVivos.length) fecharTudo(); temaCalado = !!e.automatica; e.reabrir(); }
  } catch (err) { console.log('[ao-vivo] histórico', err); }
  finally { histNavegando = false; setTimeout(() => { temaCalado = false; }, 60); }
  histFora = false;
  diag(`historico ${i + 1}/${hist.length}`);
  return true;
}
const Historico = {
  get tamanho() { return hist.length; },
  /** A tela de antes ("volta aquela"); com tudo fechado, a última que esteve aberta. */
  voltar() { return histFora ? irPara(histPos, 'esquerda') : irPara(histPos - 1, 'esquerda'); },
  avancar() { return irPara(histPos + 1, 'direita'); },
  buscar(termos) {
    const i = acharNoHistorico(termos, hist, histFora ? -1 : histPos);
    return i >= 0 && irPara(i, i > histPos ? 'direita' : 'esquerda');
  },
  /** "Mostra as últimas": a janela principal das n telas mais novas, lado a lado (não vira entrada). */
  ultimas(n = 4) {
    const vistas = new Set(), partes = [];
    for (let i = hist.length - 1; i >= 0 && partes.length < n; i--) {
      const e = hist[i]; if (!e.motor || vistas.has(e.chave) || !e.paineis[0]) continue;
      vistas.add(e.chave); partes.push({ ...e.paineis[0], forma: undefined, compacto: false });
    }
    if (partes.length < 2) return false;
    partes.reverse();
    historicoAntesDeTrocar();
    if (typeof window.AO_VIVO_TELA_TEMA === 'function') { try { window.AO_VIVO_TELA_TEMA({ ferramenta: 'historico_ao_vivo' }); } catch (err) {} }
    if (dossie) { mudarEstado({ dossie: null, dossieFazenda: null, dossieSecao: null }); document.body.classList.remove('modo-fazenda'); }
    mudarEstado({ ultimosCorpos: partes });
    trocarPaineis(partes, { semFoco: true, semHistorico: true });
    paineisVivos.forEach((el) => el.classList.add('do-historico', 'da-esquerda'));
    return true;
  },
  /** O começo da apresentação (a 1ª tela criada depois de ligar o modo). */
  irPara(i) { return irPara(i, i > histPos ? 'direita' : 'esquerda'); },
  lista() { return hist.map((e, i) => ({ indice: i, titulo: e.titulo, tema: !e.motor, atual: i === histPos && !histFora })); },
};

// ---------------------------------------------------------------------------
// O MODO APRESENTAÇÃO — menos legenda, janelas maiores, comando curto sem o "Oscar"; o roteiro do
// tema (se houver) anda por "próximo assunto" e ESPERA o João entre uma parte e outra.
// ---------------------------------------------------------------------------
const Apresentacao = (() => {
  let ativa = false, roteiro = null, parte = -1, inicioHist = 0;
  function irParte(i) {
    if (!roteiro || i < 0 || i >= roteiro.partes.length) return false;
    parte = i;
    const p = roteiro.partes[i];
    try { p.abrir(i); } catch (e) { console.log('[ao-vivo] roteiro', e); }
    sinal('▸', `${i + 1}/${roteiro.partes.length} ${p.titulo || ''}`.trim());
    return true;
  }
  return {
    get ativa() { return ativa; },
    get parte() { return parte; },
    get temRoteiro() { return !!roteiro; },
    /** O tema registra o roteiro: { titulo, partes: [{ titulo, abrir(i) }], sair?() }. null tira. */
    roteiro(r) {
      if (!r) { roteiro = null; parte = -1; return true; }
      const partes = (r.partes || []).filter((p) => p && typeof p.abrir === 'function');
      if (!partes.length) return false;
      roteiro = { titulo: String(r.titulo || ''), partes, sair: typeof r.sair === 'function' ? r.sair : null }; parte = -1;
      return true;
    },
    ligar() {
      ativa = true; inicioHist = hist.length;
      document.body.classList.add('modo-apresentacao');
      abrirConversa();
      diag('apresentacao liga');
      if (roteiro) irParte(0);
    },
    desligar() {
      ativa = false; parte = -1;
      document.body.classList.remove('modo-apresentacao');
      if (roteiro && roteiro.sair) { try { roteiro.sair(); } catch (e) {} }
      diag('apresentacao desliga');
    },
    proximo() { return roteiro ? irParte(parte + 1) : Historico.avancar(); },
    anterior() { return roteiro ? irParte(parte - 1) : Historico.voltar(); },
    /** "Volta ao início": a 1ª parte do roteiro; sem roteiro, a 1ª tela desde que o modo ligou. */
    inicio() { if (roteiro) return irParte(0); return inicioHist < hist.length && Historico.irPara(inicioHist); },
  };
})();

// ---------------------------------------------------------------------------
// PALMAS — som da própria página (funciona sem o ouvido do Mac), a folha pulsando e a música do
// Mac abaixada enquanto tocam. "Para" corta. Sons livres (Pixabay): sons/LICENCAS.txt.
// ---------------------------------------------------------------------------
const PALMAS = { normal: ['sons/palmas.mp3', 8.1], fortes: ['sons/palmas-fortes.mp3', 10.6], festa: ['sons/palmas-festa.mp3', 12.2] };
let somPalmas = null, relogioPalmas = null;
function tocarPalmas(forma) {
  pararPalmas();
  const [arquivo, dur] = PALMAS[forma] || PALMAS.normal;
  Voz.parar();
  const a = new Audio(arquivo); a.volume = 0.9; somPalmas = a;
  a.onended = pararPalmas;
  musicaAbaixaAte(Date.now() + dur * 1000);
  a.play().catch(() => { diag('palmas sem som'); pararPalmas(); sinal('✦', 'som bloqueado'); });
  document.body.classList.add('palmas');
  clearInterval(relogioPalmas);
  relogioPalmas = setInterval(() => Esfera.pulso(0.3 + Math.random() * 0.55), 130);
  setTimeout(() => { if (somPalmas === a) pararPalmas(); }, dur * 1000 + 800);    // rede de segurança
  sinal('✦', forma === 'festa' ? 'festa' : 'palmas');
}
function pararPalmas() {
  clearInterval(relogioPalmas); relogioPalmas = null;
  document.body.classList.remove('palmas');
  if (!somPalmas) return false;
  const a = somPalmas; somPalmas = null;
  try { a.pause(); } catch (e) {}
  musicaAbaixaAte(0);
  return true;
}

// ---------------------------------------------------------------------------
// EXECUTAR
// ---------------------------------------------------------------------------
/** Depois de calar no meio: o microfone volta e a conversa corrida segue aberta (dá para "continua"). */
function voltarAOuvir() { abrirConversa(); mudarFase(Escuta.ligado ? 'ouvindo' : 'espera'); Escuta.retomar(); legendaSome(900); }
/** A frase é comando de apresentação? Executa e devolve true; senão false (segue para os outros e o agente). */
function comandoDeControle(frase) {
  const c = entenderControle(frase);
  if (!c) return false;
  const eco = () => { legenda(`<span class="voce">${esc(frase)}</span>`); legendaSome(2200); };
  switch (c.acao) {
    case 'palmas': eco(); abrirConversa(); tocarPalmas(c.forma); break;
    case 'calar': {
      if (pararPalmas()) { sinal('■', 'parado'); voltarAOuvir(); break; }
      if (Voz.falando) { Voz.parar(); sinal('■', 'parado'); voltarAOuvir(); break; }
      // a fala já foi cortada pelo toque / pelo ouvido do Mac (que chama a página calando a voz)
      const i = Voz.interrompida;
      if (i && Date.now() - i.em < 5000) { sinal('■', 'parado'); voltarAOuvir(); break; }
      return false;                                   // nada falando: "silêncio" segue como sempre (dispensar)
    }
    case 'continuar': {
      const i = Voz.interrompida;
      if (!i || Date.now() - i.em > 600000 || i.de >= i.pecas.length) return false;
      const resto = i.pecas.slice(i.de);
      Voz.esquecerInterrompida(); eco();
      Escuta.pausar(); mudarFase('falando'); legenda(esc(resto.join(' ')));
      Voz.falarPedacos(resto, aoAcabarDeFalar);
      break;
    }
    case 'repetir': {
      const t = Voz.ultimaFala;
      if (!t) return false;
      legenda(esc(t)); falarEmTurno(t);
      break;
    }
    case 'ritmo': {
      eco();
      const r = mudarRitmo(c.passo);
      sinal('◷', r == null ? (c.passo > 0 ? 'já no mais devagar' : 'já no mais rápido') : (c.passo > 0 ? 'mais devagar' : 'mais rápido'));
      abrirConversa();
      if (r != null) Voz.avisar('Assim está bom?');
      break;
    }
    case 'apresentacao':
      eco();
      if (c.ligar) { Apresentacao.ligar(); sinal('▶', 'modo apresentação'); }
      else { Apresentacao.desligar(); sinal('■', 'fim da apresentação'); }
      break;
    case 'assunto': {
      eco(); abrirConversa();
      const ok = c.passo > 0 ? Apresentacao.proximo() : Apresentacao.anterior();
      if (!ok) sinal('·', c.passo > 0 ? 'não há próximo' : 'não há anterior');
      break;
    }
    case 'inicio':
      eco(); abrirConversa();
      if (!Apresentacao.ativa || !Apresentacao.inicio()) { if (paineisVivos.length) fecharTudo(); sinal('⌂', 'início'); }
      break;
    case 'ultimas': eco(); abrirConversa(); if (!Historico.ultimas(c.n)) sinal('·', 'ainda não há telas'); break;
    case 'avancar': eco(); abrirConversa(); if (!Historico.avancar()) sinal('·', 'é a última'); break;
    case 'anterior': eco(); abrirConversa(); if (!Historico.voltar()) sinal('·', 'é a primeira'); break;
    case 'volta':
      if (paineisVivos.length || !hist.length) return false;    // com janelas: o "volta" de sempre (comandos.js)
      eco(); abrirConversa(); Historico.voltar();
      break;
    case 'buscar':
      if (!Historico.buscar(c.termos)) {
        if (!c.certeza) return false;                   // não era bem pedido de tela: vai ao agente
        eco(); sinal('?', 'não achei essa tela');
      } else { eco(); abrirConversa(); }
      break;
    default: return false;
  }
  diag('controle ' + c.acao);
  return true;
}
/** Modo apresentação, frase SEM "Oscar": só passa se for comando local curto (nunca pergunta). */
function comandoSemNome(frase) {
  const f = semNomeNoComeco(frase);
  if (entenderMusica(f) || entenderControle(f)) return true;
  return paineisVivos.length > 0 && !!entenderComando(f, janelasParaComando());
}

// ---------------------------------------------------------------------------
// A PONTE PARA OS TEMAS (docs/ao-vivo/TEMAS.md)
//   AO_VIVO_HISTORICO.registrar({ titulo, assunto, tipo, reabrir, sair })  — a vista entra no histórico
//   AO_VIVO_APRESENTACAO.roteiro({ titulo, partes: [{ titulo, abrir }], sair }) — "próximo assunto"
// ---------------------------------------------------------------------------
window.AO_VIVO_HISTORICO = Object.freeze({
  registrar: registrarDoTema,
  voltar: () => Historico.voltar(), avancar: () => Historico.avancar(), lista: () => Historico.lista(),
});
window.AO_VIVO_APRESENTACAO = Object.freeze({
  roteiro: (r) => Apresentacao.roteiro(r),
  ligar: () => Apresentacao.ligar(), desligar: () => Apresentacao.desligar(),
  proximo: () => Apresentacao.proximo(), anterior: () => Apresentacao.anterior(), inicio: () => Apresentacao.inicio(),
  get ativa() { return Apresentacao.ativa; }, get parte() { return Apresentacao.parte; },
});
/** Reabrindo uma vista do tema que entrou sozinha no histórico: ela abre calada (o tema não repete o discurso). */
function temaEstaCalado() { return temaCalado; }

export {
  entenderControle, acharNoHistorico, sinal, Historico, Apresentacao, comandoDeControle, comandoSemNome,
  historicoAntesDeTrocar, historicoAoTrocar, historicoAoFechar, historicoDoTema, temaEstaCalado, pararPalmas, telaMudouEm,
};
