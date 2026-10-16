// OSCARPES AO VIVO — reuniao/extrair.js
// JARVIS REUNIÃO (06/out/2026, MVP para o João testar com os irmãos): a fala da sala vira PAINEL.
// Regras locais, sem IA e sem servidor — rodam a cada frase, na hora e de graça. O agente só entra
// quando alguém chama "Oscar" (ou quando um assunto pede cartão de dados, ver reuniao.js).
// Puro: nada de DOM aqui (o portão scripts/reuniao/conferir-reuniao.mjs roda estas funções no Node).

/** minúsculas, sem acento, sem pontuação — o mesmo jeito de comparar do ouvido.js */
export function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ASSUNTOS — palavra que aparece na fala → assunto do painel. `pergunta` é o que se pede ao agente
// quando o assunto aparece de verdade na conversa (cartão de dados); sem pergunta, só vira etiqueta.
export const ASSUNTOS = [
  { id: 'financeiro', nome: 'Financeiro', palavras: ['financeiro', 'dinheiro', 'caixa', 'faturamento', 'faturou', 'custo', 'despesa', 'receita', 'boleto', 'pagar', 'receber', 'omie', 'banco', 'extrato', 'lucro', 'margem'],
    pergunta: 'Resumo financeiro do mês para a reunião: caixa, contas a pagar e a receber dos próximos 15 dias e o faturamento do mês. Curto.' },
  { id: 'laboratorio', nome: 'Laboratório', palavras: ['laboratorio', 'lab', 'amostra', 'amostras', 'laudo', 'laudos', 'analise', 'analises', 'lims', 'pedido de analise'],
    pergunta: 'Situação do laboratório para a reunião: amostras em aberto, laudos atrasados e o volume do mês. Curto.' },
  { id: 'clima', nome: 'Clima', palavras: ['chuva', 'chover', 'chovendo', 'choveu', 'previsao', 'previsao do tempo', 'tempo seco', 'seca', 'clima', 'vento', 'geada', 'milimetros', 'pluviometro'], gatilho: 1,
    pergunta: 'Previsão do tempo dos próximos dias (chuva em mm, temperatura) para a fazenda ou cidade citada na conversa; se nenhuma, Sorriso/MT. Curto.' },
  { id: 'estoque', nome: 'Estoque', palavras: ['estoque', 'almoxarifado', 'insumo', 'insumos', 'defensivo', 'defensivos', 'adubo', 'fertilizante', 'semente', 'sementes'],
    pergunta: 'Situação do estoque de insumos para a reunião: o que está acabando e o que chegou. Curto.' },
  { id: 'monitoramento', nome: 'Monitoramento', palavras: ['praga', 'pragas', 'monitoramento', 'lagarta', 'percevejo', 'ferrugem', 'doenca', 'doencas', 'visita', 'visitas'],
    pergunta: 'Últimos monitoramentos e visitas de campo: pragas e níveis encontrados nas fazendas citadas na conversa (ou as mais recentes). Curto.' },
  { id: 'app', nome: 'App Oscarpes', palavras: ['app', 'aplicativo', 'tela', 'botao', 'sistema', 'versao', 'atualizacao', 'bug', 'travou', 'trava', 'login'] },
  { id: 'agente', nome: 'Agente do zap', palavras: ['zap', 'whatsapp', 'agente', 'mensagem', 'audio', 'robo'] },
  { id: 'clientes', nome: 'Clientes e vendas', palavras: ['cliente', 'clientes', 'produtor', 'venda', 'vendas', 'proposta', 'contrato', 'revenda', 'representante', 'carteira'],
    pergunta: 'Resumo comercial para a reunião: clientes ativos, propostas e vendas recentes. Curto.' },
  { id: 'campo', nome: 'Campo e coleta', palavras: ['coleta', 'coletor', 'talhao', 'talhoes', 'fazenda', 'grid', 'mapa', 'mapas'] },
  { id: 'fiscal', nome: 'Fiscal', palavras: ['nota fiscal', 'imposto', 'sefaz', 'receita federal', 'tributo', 'contador', 'contadora', 'nfse', 'nfe'] },
  { id: 'marketing', nome: 'Marketing', palavras: ['marketing', 'instagram', 'post', 'video', 'campanha', 'reel', 'site'] },
  { id: 'equipe', nome: 'Equipe', palavras: ['funcionario', 'funcionarios', 'contratar', 'salario', 'equipe', 'ferias'] },
];

// DADO SENSÍVEL (06/out/2026, João): financeiro, custos, margem, comissão, salário, fiscal, carteira de cliente — só
// aparece com todo mundo da reunião sendo admin, ou com a permissão de um sócio/admin presente (voz ou clique).
export const ASSUNTOS_SENSIVEIS = ['financeiro', 'fiscal', 'equipe', 'clientes'];
const SENSIVEL_RE = /\b(financeir\w*|dinheiro|caixa|faturamento|faturou|custos?|despesas?|receitas?|margem|margens|lucro|comiss\w*|salari\w*|folha de pagamento|boletos?|contas a pagar|contas a receber|extrato|banco|fiscal|impostos?|tributo\w*|nota fiscal|notas fiscais|sefaz|carteira|precos?|tabela de preco|omie)\b/;
export function sensivel(texto) { return SENSIVEL_RE.test(norm(texto)); }
// "pode mostrar", "autorizo", "pode sim", "libera" → sim; "não mostra", "agora não" → não
const SIM_RE = /\b(pode mostrar|pode sim|pode|autorizo|autorizado|libera|liberado|mostra sim|sim pode|pode abrir|tudo bem|ok pode)\b/;
const NAO_RE = /\b(nao (mostra|pode|libera|autorizo)|agora nao|melhor nao|depois|nao precisa)\b/;
export function respostaDePermissao(texto) { const f = norm(texto); if (NAO_RE.test(f)) return 'nao'; if (SIM_RE.test(f)) return 'sim'; return ''; }

/** Os assuntos que a frase toca (ids). */
export function assuntosDe(frase) {
  const f = ' ' + norm(frase) + ' ';
  return ASSUNTOS.filter((a) => a.palavras.some((p) => f.includes(' ' + p + ' '))).map((a) => a.id);
}

// CHAMADA — igual ao modo palco do ouvido.js: "Oscar"/"Jarvis" em qualquer lugar; "Oscarpes" nunca chama
// (na reunião dos irmãos o nome da empresa sai a toda hora).
const CHAMADA_RE = /\b(oscar|jarvis)\b/;
// TEMA de empresa (?tema=brevant): o nome do Jarvis dela também chama, mas só no COMEÇO da frase (igual ao ouvido.js)
let EXTRA_RE = null, EXTRA_INTEIRO_RE = null;
export function definirNomesExtra(nomes) {
  const l = (nomes || []).map((n) => norm(n)).filter(Boolean);
  EXTRA_RE = l.length ? new RegExp('^((o|ei|hey|ok|oi|ola|bom dia|boa tarde|boa noite) )?(' + l.join('|') + ')\\b') : null;
  EXTRA_INTEIRO_RE = l.length ? new RegExp('^((o|ei|hey|ok|oi|ola|bom dia|boa tarde|boa noite) )?(' + l.join('|') + ')$') : null;
}
export function chamou(frase) { const f = norm(frase); return CHAMADA_RE.test(f) || !!(EXTRA_RE && EXTRA_RE.test(f)); }
/** Tudo depois do nome: "ô Oscar, mostra o caixa" → "mostra o caixa". */
export function depoisDoNome(frase) {
  const t = String(frase || '');
  const m = t.match(/\b([oó]scar|jarvis)\b[\s,.!?:;-]*/i);
  if (m) return t.slice(m.index + m[0].length).trim();
  // nome do tema no começo: corta as palavras do começo que formam o nome
  if (EXTRA_INTEIRO_RE) { const p = t.trim().split(/\s+/); for (let i = Math.min(6, p.length); i >= 1; i--) if (EXTRA_INTEIRO_RE.test(norm(p.slice(0, i).join(' ')))) return p.slice(i).join(' ').replace(/^[\s,.!?:;-]+/, '').trim(); }
  return t.trim();
}

// PRAZO — "até sexta", "até amanhã", "até dia 15", "semana que vem", "fim do mês"
const DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
export function prazoDe(frase) {
  const f = norm(frase);
  let m = f.match(/\bate (o )?dia (\d{1,2})( de [a-z]+)?\b/); if (m) return 'dia ' + m[2] + (m[3] || '');
  m = f.match(/\bate (a |o )?(proxima |essa |esta )?(segunda|terca|quarta|quinta|sexta|sabado|domingo)( feira)?\b/); if (m) return m[3] + (m[3] === 'sabado' || m[3] === 'domingo' ? '' : '-feira');
  m = f.match(/\b(ate )?(amanha|hoje|depois de amanha)\b/); if (m && (m[1] || /\b(fica|vai|vou|faz|manda|entrega|liga)\b/.test(f))) return m[2];
  m = f.match(/\b(semana que vem|proxima semana|fim do mes|final do mes|fim da semana|mes que vem|fim de semana)\b/); if (m) return m[1];
  m = f.match(/\bate (\d{1,2}) ?\/ ?(\d{1,2})\b/); if (m) return m[1] + '/' + m[2];
  m = f.match(/\bem (\d+) dias\b/); if (m) return 'em ' + m[1] + ' dias';
  return '';
}
void DIAS;

// DONO — o primeiro participante citado como sujeito ("o Ararê vai…", "Tainá fica de…"); "eu vou" = quem está falando
export function donoDe(frase, participantes, quemFala) {
  const f = norm(frase);
  for (const p of participantes || []) {
    const n = norm(p);
    if (!n) continue;
    if (new RegExp('\\b' + n + '\\b').test(f) || new RegExp('\\b' + n.split(' ')[0] + '\\b').test(f)) return p;
  }
  if (/\b(eu vou|eu fico|eu faco|eu mando|eu resolvo|deixa comigo|eu vejo|eu ligo|fico de|vou ver)\b/.test(f) && quemFala && quemFala !== 'sala') return quemFala;
  if (/\b(a gente|nos vamos|vamos)\b/.test(f)) return 'todos';
  return '';
}

// O QUE É CADA FRASE
const DECISAO_RE = /\b(decidido|decidimos|fica decidido|ficou decidido|esta decidido|ta decidido|definido|ficou definido|fica definido|fechado entao|ta fechado|esta fechado|bateu o martelo|batemos o martelo|aprovado|aprovamos)\b/;
const PENDENCIA_RE = /\b(pendencia|pendente|fica de|ficou de|(vai|vou) (ver|verificar|mandar|ligar|fazer|resolver|providenciar|levantar|conversar|falar|cobrar|conferir)|precisa (ver|mandar|ligar|fazer|resolver)|tem que (ver|mandar|ligar|fazer|resolver|levantar)|falta (ver|resolver|definir)|anota (ai )?(uma )?pendencia)\b/;
// pedido de mudança no APP (o que vai para o Claude Code depois de DEFINIDO)
const APP_RE = /\b(app|aplicativo|tela|botao|campo|aba|menu|relatorio|laudo|painel|agente|zap|sistema|jarvis|grafico|filtro|cadastro|mapa|notificacao|aviso|pdf)\b/;
const MUDANCA_RE = /\b(mudar|muda|trocar|troca|colocar|coloca|por|botar|tirar|tira|remover|criar|cria|adicionar|acrescentar|corrigir|arrumar|consertar|melhorar|mostrar|aparecer|esconder|separar|juntar|devia|deveria|tinha que ter|precisa ter|falta|nao funciona|nao esta funcionando|nao aparece|travando|trava|erro|bug|lento|demora)\b/;
const SUGESTAO_RE = /\b(devia|deveria|tinha que ter|precisa ter|seria bom|seria legal|que tal|podia|poderia|nao funciona|nao esta funcionando|nao aparece|travando|bug|erro|lento|demora)\b/;
const PEDIDO_CLAUDE_RE = /\b(anota pro claude|manda pro claude|pro claude code|para o claude code|fila do claude|pedido pro app|pedido para o app)\b/;
const ENCERRAR_RE = /\b(encerra|encerrar|finaliza|finalizar|fecha|fechar|termina|terminar) (a )?(reuniao|ata)\b/;

/** Que tela/recurso a frase cita (para o Claude Code saber onde mexer). */
const TELAS = [
  ['caderno', 'Caderno de aplicações'], ['estoque', 'Estoque'], ['silo', 'Silos'], ['nota', 'Notas fiscais'], ['laudo', 'Laudos'],
  ['relatorio', 'Relatórios'], ['grid', 'Grid de coleta'], ['coleta', 'Coleta'], ['mapa', 'Mapas'], ['calendario', 'Calendário'],
  ['aviso', 'Avisos'], ['cadastro', 'Cadastro'], ['financeiro', 'Financeiro'], ['dashboard', 'Dashboard'], ['zap', 'Agente do zap'],
  ['agente', 'Agente do zap'], ['jarvis', 'Jarvis ao vivo'], ['laboratorio', 'Laboratório'], ['lab', 'Laboratório'], ['praga', 'Pragas'],
  ['monitoramento', 'Monitoramento'], ['venda', 'Venda de grão'], ['boletim', 'Boletim diário'], ['login', 'Login'], ['clima', 'Clima'], ['chuva', 'Clima'],
];
export function telaDe(frase) {
  const f = ' ' + norm(frase) + ' ';
  for (const [p, nome] of TELAS) if (f.includes(' ' + p) ) return nome;
  return '';
}

/**
 * Classifica uma frase da sala. Devolve uma lista de itens (uma frase pode virar decisão E pedido do app):
 *   { tipo: 'encerrar' } · { tipo: 'chamado', pergunta } · { tipo: 'decisao', texto } ·
 *   { tipo: 'pendencia', texto, dono, prazo } · { tipo: 'pedido', texto, tela, definido } · { tipo: 'assunto', ids }
 * `definido` = o pedido do app foi DECIDIDO na reunião (vai para a fila do Claude Code); sem isso é só sugestão.
 */
export function classificar(frase, ctx = {}) {
  const f = norm(frase);
  const itens = [];
  if (!f) return itens;
  const participantes = ctx.participantes || [];
  const quemFala = ctx.quemFala || 'sala';
  if (chamou(frase)) {
    const resto = depoisDoNome(frase);
    if (ENCERRAR_RE.test(norm(resto))) return [{ tipo: 'encerrar' }];
    // "Oscar, anota pro Claude Code: …" / "Oscar, decidido: …" / "Oscar, anota pendência: …" — vira item, sem perguntar ao agente
    if (PEDIDO_CLAUDE_RE.test(norm(resto))) {
      const t = resto.replace(/^.*?(claude code|claude|pedido (pro|para o) app)[\s,.:;-]*/i, '').trim() || resto;
      return [{ tipo: 'pedido', texto: t, tela: telaDe(t), definido: true }];
    }
    if (!DECISAO_RE.test(norm(resto)) && !/\banota\b/.test(norm(resto))) return [{ tipo: 'chamado', pergunta: resto }];
    frase = resto;
  }
  const g = norm(frase);
  const ehDecisao = DECISAO_RE.test(g);
  const ehApp = APP_RE.test(g) && MUDANCA_RE.test(g);
  const textoLimpo = String(frase).replace(/^\s*(ent[aã]o,?\s*)?(fica |ficou |est[aá] |t[aá] )?(decidido|definido|fechado|aprovado)( ent[aã]o)?[\s,.:;-]*(que\s+)?/i, '').trim() || String(frase).trim();
  if (ehDecisao) itens.push({ tipo: 'decisao', texto: textoLimpo });
  if (ehApp && (ehDecisao || SUGESTAO_RE.test(g))) itens.push({ tipo: 'pedido', texto: textoLimpo, tela: telaDe(frase), definido: ehDecisao });
  // PENDÊNCIA só com COMPROMISSO CLARO (06/out, 1ª reunião real: "minha irmã não vê ela mesmo… vai ver se…" virou tarefa):
  // "anota pendência: …" OU quem (participante / eu / ele / ela / a gente) + "fica de / vai / vou / tem que" + verbo de ação,
  // numa frase curta (≤ 25 palavras) e com prazo ou dono. Conversa comprida fica fora.
  const pend = pendenciaDe(frase, participantes, quemFala);
  if (!ehDecisao && pend) itens.push(pend);
  const ids = assuntosDe(frase);
  if (ids.length) itens.push({ tipo: 'assunto', ids });
  return itens;
}

const VERBOS_ACAO = 'ver|verificar|mandar|enviar|ligar|fazer|resolver|providenciar|levantar|conversar|falar|cobrar|conferir|preparar|marcar|agendar|pagar|comprar|organizar|montar|revisar|passar|buscar|trazer|fechar|emitir|corrigir|testar|atualizar|olhar|checar';
export function pendenciaDe(frase, participantes = [], quemFala = 'sala') {
  const g = norm(frase);
  const explicita = /\banota (ai )?(uma )?pendencia\b/.test(g);
  const nomes = (participantes || []).map((p) => norm(p).split(' ')[0]).filter(Boolean);
  const sujeito = '(' + [...nomes, 'eu', 'ele', 'ela', 'a gente', 'voce'].join('|') + ')';
  const m = g.match(new RegExp('\\b' + sujeito + '\\s+(fica de|ficou de|vai|vou|precisa|tem que|vai ter que)\\s+(' + VERBOS_ACAO + ')\\b'));
  const palavras = g.split(' ').length;
  if (!explicita && !(m && palavras <= 25)) return null;
  const dono = donoDe(frase, participantes, quemFala);
  const prazo = prazoDe(frase);
  if (!explicita && !prazo && !dono) return null;
  let texto = String(frase).replace(/^\s*(anota (a[ií] )?(uma )?pend[eê]ncia)[\s,.:;-]*/i, '').trim();
  if (texto.length > 180) texto = texto.slice(0, 177) + '…';
  return { tipo: 'pendencia', texto, dono, prazo };
}

/** "aqui é o Ararê" / "Ararê falando" / "fala Tainá" → muda quem está falando (sem separação de voz no navegador). */
export function trocaDeQuemFala(frase, participantes) {
  const f = norm(frase);
  for (const p of participantes || []) {
    const n = norm(p);
    if (!n) continue;
    if (new RegExp('^(aqui (e|eh) (o |a )?' + n + '|' + n + ' falando|e o ' + n + ' falando|agora (e|eh) (o |a )?' + n + ')\\b').test(f)) return p;
  }
  return '';
}

// CONVITE DENTRO DA REUNIÃO (06/out/2026, 1ª reunião no Jarvis: "Oscar, você já chamou pra reunião o Emiliano, a Tainá e o
// Araré?" e "gere um link pra eu passar pra eles" foram ao agente, que respondeu "isso eu não faço"). Agora a reunião entende:
//   chamar/convidar (também "já chamou?", "chamou?") + nomes  → { nomes }
//   gerar/mandar/passar link (ou código) da reunião            → { link: true } (e os nomes, se vierem)
// Os NOMES saem de quem está no app (pessoas: [{nome}]) — o primeiro nome dito, sem acento ("Araré" = "Ararê") — e, se ninguém
// do app casar, das palavras depois do verbo. "eu" (quem está logado) nunca é convidado.
const CONVITE_VERBO_RE = /\b(chama|chame|chamar|chamou|convida|convide|convidar|convidou|traz|traga|puxa|adiciona|adicione|coloca|coloque|bota|bote)\b/;
const LINK_RE = /\b(gera|gere|gerar|manda|mande|mandar|passa|passe|passar|me da|me de|cria|crie|criar|qual|quero|preciso|envia|envie|copia|copie)\b.{0,30}\b(link|codigo|convite|endereco)\b/;
export function pedidoDeConviteNaReuniao(frase, pessoas = [], eu = '') {
  const f = norm(frase);
  if (!f) return null;
  const temVerbo = CONVITE_VERBO_RE.test(f), temLink = LINK_RE.test(f);
  if (!temVerbo && !temLink) return null;
  // "chama" tem que ser de gente: reunião, nome do app ou um nome depois do verbo; "chama a atenção", "traz o financeiro" não
  if (temVerbo && /\b(claude|ata|tela|dados?|mapa|grafico|relatorio|painel|atencao|financeiro|chuva|estoque|laudo|pedido|pedidos)\b/.test(f) && !/\breuniao\b/.test(f)) return null;
  const euN = norm(eu).split(' ')[0];
  const palavras = new Set(f.split(' '));
  const nomes = [];
  for (const p of pessoas || []) {
    const primeiro = norm(p.nome).split(' ')[0];
    if (!primeiro || primeiro === euN || !palavras.has(primeiro)) continue;
    if (!nomes.some((n) => norm(n).split(' ')[0] === primeiro)) nomes.push(p.nome);
  }
  if (!nomes.length && temVerbo) {
    const m = String(frase).match(/\b(?:chama|chame|chamar|chamou|convida|convide|convidar|convidou|traz|traga|puxa|adiciona|adicione|coloca|coloque|bota|bote)\s+(.+?)(?:\s+(?:para|pra|pr[aá]|na|numa|nessa|nesta|em)\s+(?:a\s+|uma\s+|essa\s+|esta\s+)?reuni[aã]o\b.*)?[?.!]*$/i);
    if (m) for (let x of m[1].split(/\s*,\s*|\s+e\s+/i)) {
      x = x.replace(/^(o|a|os|as|pro|pra|para)\s+/i, '').trim();
      if (!x || x.split(/\s+/).length > 3 || /^(gente|pessoal|todo mundo|todos|ele|ela|eles|elas|voce|você)$/i.test(x) || norm(x).split(' ')[0] === euN) continue;
      nomes.push(x.split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' '));
    }
  }
  if (temVerbo && !nomes.length && !temLink) return null;
  return { nomes, link: temLink };
}

// ---------------------------------------------------------------------------
// 07/out/2026 — CORREÇÕES DA REUNIÃO REAL DAS 10:00 (João no Mac, Tainá e Emiliano de longe)
// ---------------------------------------------------------------------------

// FALA DEGENERADA (a faixa da Tainá virou "Oi, oi, oi, oi…" ×200 e "Um, um, um…" ×200 — o Whisper em áudio ruim de celular
// entra em laço). Uma frase assim não é fala: não vai para a legenda, o painel nem a ata. Regras (sem IA):
//   • a mesma palavra (ou par/trio de palavras) seguida ≥ 6 vezes;  • 12+ palavras com menos de 25 % de palavras diferentes;
//   • as frases-fantasma do Whisper (vídeos do YouTube no treino dele) sozinhas: "Muito obrigado.", "Thank you again.",
//     "Tchau, tchau.", "Aproveite.", "Fiquem com você." — todas apareceram do nada na faixa de quem estava calado.
const FANTASMAS_RE = /^(e a[ií]|pum|tchau( tchau| time| gente)?|at[eé] a pr[oó]xima|at[eé] mais|(muito )?obrigad[oa]( por assistir| a todos| gente)?|valeu|beijos?|aproveite|fiquem com (voce|deus)|thank you( again| very much)?|thanks|bye|you|legendas? .*|inscreva se.*|se inscreva.*|musica|aplausos|risos|hum+|ah+|oh+)$/;
export function falaDegenerada(texto) {
  const f = norm(texto);
  if (!f) return true;
  if (FANTASMAS_RE.test(f)) return true;
  const p = f.split(' ');
  for (const n of [1, 2, 3]) {
    let seguidas = 1;
    for (let i = n; i + n <= p.length; i += n) {
      if (p.slice(i, i + n).join(' ') === p.slice(i - n, i).join(' ')) { if (++seguidas >= 6) return true; } else seguidas = 1;
    }
  }
  if (p.length >= 12 && new Set(p).size / p.length < 0.25) return true;
  return false;
}

// "PENDÊNCIAS"/"DECISÕES" DA REUNIÃO × pergunta sobre outra coisa (07/out: a Tainá perguntou "Oscar, a contadora Ciça já apresentou
// as pendências dela para a correção do nosso sistema?" e o painel respondeu "Nenhuma pendência anotada" — a palavra "pendências"
// caía no atalho local da reunião). O atalho só vale quando a pergunta é sobre o PAINEL desta reunião: curta, ou dizendo
// "da reunião", "anotadas", "de hoje", "até agora". Pendência de pessoa/sistema/contadora vai para o agente.
export function perguntaDoPainel(pergunta, qual) {
  const f = norm(pergunta);
  const alvo = qual === 'decisoes' ? /\bdecis(ao|oes)\b/ : /\bpendencias?\b/;
  if (!alvo.test(f)) return false;
  if (/\b(da reuniao|desta reuniao|dessa reuniao|anotad[ao]s?|registrad[ao]s?|de hoje|ate agora|que (a gente|nos) (tem|temos|tomou|tomamos))\b/.test(f)) return true;
  const resto = f.replace(/\b(oscar|jarvis|quais|qual|quantas|quantos|sao|as|os|a|o|e|le|ler|mostra|mostrar|resume|resumo|lista|listar|repete|me|da|de|temos|tem|ai|entao|agora|pendencias?|decis(ao|oes))\b/g, ' ').trim();
  return resto.split(' ').filter(Boolean).length === 0;
}

// ADMITIR PELA VOZ (07/out: "Admitir a Tainá" ×2 e "Oscar, admitir a Tainá" não fizeram nada — só existia o botão).
//   "admite a Tainá", "admitir o Emiliano", "deixa a Tainá entrar", "pode entrar", "libera a entrada", "aceita todo mundo"
// pedidos = [{ id, nome }] (a sala de espera). Devolve os ids a admitir (vazio = não é pedido de admitir ou ninguém casou).
// Sem nome e com UMA pessoa esperando: é ela. "todos/todo mundo": todos.
const ADMITIR_RE = /\b(admit\w*|deixa (\w+ ){0,3}entrar|pode entrar|podem entrar|libera (a )?entrada|aceit\w*|bota (\w+ ){0,3}pra dentro|manda entrar)\b/;
export function pedidoDeAdmitir(frase, pedidos = []) {
  const f = norm(frase);
  if (!f || !ADMITIR_RE.test(f) || !pedidos.length) return [];
  if (/\b(todos|todo mundo|geral|os dois|as duas|todas)\b/.test(f)) return pedidos.map((p) => p.id);
  const palavras = new Set(f.split(' '));
  const casados = pedidos.filter((p) => norm(p.nome).split(' ').some((w) => w.length > 2 && palavras.has(w)));
  if (casados.length) return casados.map((p) => p.id);
  // nenhum nome casou: com uma pessoa só esperando e sem outro nome na frase, é ela
  return pedidos.length === 1 ? [pedidos[0].id] : [];
}

// NÍVEL DE ACESSO pelo nome do app (07/out: "Emiliano Carpes" não casava com "Emiliano Antonio Carpes Filho" — ficou "não
// cadastrado" e o Oscar disse que a sala tinha gente sem acesso). Casa quando o primeiro nome é igual e TODAS as outras palavras
// ditas estão no nome completo ("Tainá Carpes" × "Tainá Carpes Ely", "Emiliano Carpes" × "Emiliano Antonio Carpes Filho").
export function mesmoNome(dito, completo) {
  const a = norm(dito).split(' ').filter(Boolean), b = norm(completo).split(' ').filter(Boolean);
  if (!a.length || !b.length || a[0] !== b[0]) return false;
  return a.slice(1).every((w) => b.includes(w));
}

// MANDAR O LINK PARA QUEM JÁ TEM CONVITE PRONTO (07/out: "Oscar, mande o link pro Emiliano" — o convite dele já estava pronto
// e o Oscar só repetiu "o convite está pronto, diga pode mandar"). Verbo de mandar + nome de um convite pronto = abrir aquele.
const MANDAR_RE = /\b(manda|mande|mandar|envia|envie|enviar|passa|passe|dispara|abre|abra)\b/;
export function convitesParaMandar(frase, convites = []) {
  const f = norm(frase);
  if (!MANDAR_RE.test(f)) return [];
  const palavras = new Set(f.split(' '));
  return convites.filter((c) => c.tel && norm(c.nome).split(' ').concat(norm(c.dito).split(' ')).some((w) => w.length > 2 && palavras.has(w)));
}

// ---------------------------------------------------------------------------
// 07/out/2026 (tarde) — O OSCAR QUE ESCUTA A REUNIÃO (João: "ele tem que responder as solicitações, trazendo os assuntos que
// estamos falando… ele não escuta tudo e traz as soluções")
// ---------------------------------------------------------------------------

// NOMES DA CASA que o reconhecimento erra (medido na reunião de 07/out: "Sidara", "Cisa/Cissa/Sista", "tainar/Atainá",
// "Arari/Araré", "O Sky" = "Oscar"). Só gente da casa e o nome do Oscar — nome de fazenda/cliente fica com o agente (o
// servidor já acha a fazenda pelo nome parecido) e nunca mora no site público.
const NOMES_ERRADOS = [
  [/\b(o sky|oski|osca|oscah|óscar)\b/gi, 'Oscar'],
  [/\b(cissa|cisa|sista|sisa|cica)\b/gi, 'Ciça'],
  [/\b(atain[aá]|tainar|tainara|tainah|thain[aá]|taïna)\b/gi, 'Tainá'],
  [/\b(arar[eé]|arari|arare)\b/gi, 'Ararê'],
  [/\b(emiliano|emiliana)\b/gi, 'Emiliano'],
];
export function corrigirNomes(frase) {
  let t = String(frase || '');
  // (\b do JavaScript não vê letra acentuada como letra: "Atainá" não fecha a palavra — por isso as bordas à mão)
  for (const [re, certo] of NOMES_ERRADOS) t = t.replace(new RegExp('(^|[^\\wÀ-ú])(' + re.source.replace(/^\\b\(|\)\\b$/g, '') + ')(?![\\wÀ-ú])', 'gi'), (_, a) => a + certo);
  return t;
}

// PROBLEMA RELATADO (exemplo do João: "teve uma hora que a Tainá falou que o financeiro não estava legal, ele já poderia ter
// trazido as soluções"). Assunto do app + sinal de problema = o Oscar investiga e traz o diagnóstico num cartão.
const SINAL_PROBLEMA_RE = /\b(nao (esta|ta|tá|ficou|deu|bate|bateu|funciona|funcionou|aparece|apareceu|da pra usar|dá pra usar|esta legal|ta legal|esta certo|ta certo|esta batendo|ta batendo|deu certo)|esta errad\w*|ta errad\w*|errad[oa]s?|tudo errado|nao confere|negativ\w*|nao fecha|furad\w*|travad\w*|atrasad\w*|parece que ate agora nao|ajustar as planilhas|resultados? certos?)\b/;
const ASSUNTO_DO_PROBLEMA = [
  ['financeiro', /\b(financeir\w*|saldos?|planilhas?|extrato|caixa|conciliac\w*|banco|divida|contas?|lancament\w*|negativ\w*)\b/],
  ['fiscal', /\b(nota fiscal|notas fiscais|notas tiscais|nfe|nfse|sefaz|imposto|contador\w*|fisco)\b/],
  ['laboratorio', /\b(analise|analises|laudo|laudos|amostra|amostras|laboratorio)\b/],
  ['mapa', /\b(mapa|mapas|fertilidade)\b/],
  ['sincronizacao', /\b(sincroniz\w*|sync|nao subiu|coletor)\b/],
];
export function problemaRelatado(frase) {
  const f = norm(frase);
  if (!f || f.split(' ').length < 4 || !SINAL_PROBLEMA_RE.test(f)) return null;
  for (const [assunto, re] of ASSUNTO_DO_PROBLEMA) if (re.test(f)) return { assunto, frase: String(frase).trim() };
  return null;
}
export const PERGUNTA_DE_DIAGNOSTICO = {
  financeiro: 'confira a conciliação (extratos × notas × planilha), lançamentos sem conta, saldos e o que falta importar',
  fiscal: 'confira as pendências do fisco (SEFAZ/DT-e), as notas fiscais com erro ou pendentes e o que a contadora pediu',
  laboratorio: 'confira as análises de solo e os laudos (todos os anos), pedidos em aberto e atrasados',
  mapa: 'confira os mapas de fertilidade e as análises que existem (ano mais recente)',
  sincronizacao: 'confira a saúde da sincronização dos coletores e o que está pendente',
};
/** O pedido de diagnóstico que vai ao agente (nunca inventar; sem dado, dizer o que falta) */
export function perguntaDeDiagnostico(p, quem) {
  return `DIAGNÓSTICO PEDIDO PELA REUNIÃO — ${quem || 'alguém'} relatou um problema: "${p.frase}". Investigue com as ferramentas: ${PERGUNTA_DE_DIAGNOSTICO[p.assunto] || 'confira o que der com as ferramentas'}. Responda em até 4 linhas: o que pode estar errado (SÓ o que a ferramenta devolveu, com os números dela) e 1 ou 2 soluções, terminando com uma pergunta de ação ("quer que eu abra…?"). Se não houver dado para conferir, diga exatamente o que falta. Nunca invente.`;
}

// PEDIDO SEM "OSCAR" (João: "traz os mapas da Cidara", "qual o saldo da Patrícia" — ele quer que o Oscar responda sem ser
// chamado, sem atrapalhar a conversa entre as pessoas). Conservador:
//   'claro'  = verbo de pedido NO COMEÇO + coisa que mora no app → vai ao agente marcado "sem nome" (o servidor ainda pode
//              responder [[SILENCIO]] se não era com ele);
//   'talvez' = pergunta sobre coisa do app sem verbo de pedido → só um cartão discreto "Posso trazer…?" (um clique);
//   null     = conversa.
const COISA_DO_APP_RE = /\b(mapas?|fertilidade|analises?|laudos?|amostras?|saldo|financeiro|extrato|conciliacao|planilha|notas? fisca\w*|fazenda|talh(ao|oes)|cliente|pedidos?|estoque|chuva|previsao|monitoramento|pragas?|visitas?|aplicac\w*|pendencias? fisca\w*|sefaz|boletos?|contas a (pagar|receber)|faturamento|colheita|produtividade|safra)\b/;
const PEDIDO_CLARO_RE = /^(e |entao |agora |ai |ja )?(me |nos |pra mim |para mim )?(traz|traga|trazer|mostra|mostre|abre|abra|puxa|puxe|bota|coloca|coloque|me da|me de|manda|mande|exibe|exiba)\b/;
const PERGUNTA_RE = /^(e )?(qual|quais|quanto|quantos|quantas|como (esta|ta)|cade|onde (esta|ta)|tem (alguma|algum)|ja (foi|tem|chegou))\b/;
export function pedidoSemNome(frase) {
  const f = norm(frase);
  if (!f || f.split(' ').length < 3 || !COISA_DO_APP_RE.test(f)) return null;
  if (PEDIDO_CLARO_RE.test(f)) return 'claro';
  if (PERGUNTA_RE.test(f)) return 'talvez';
  // a pergunta no FIM de uma fala comprida ("acabei de registrar uma aplicação de fósforo na área, qual foi a média aplicada?")
  if (/[?]\s*$/.test(String(frase)) && /\b(qual|quais|quanto|quantos|quantas|cade|como esta|como ta)\b/.test(f)) return 'talvez';
  return null;
}

// FAZENDA CITADA NA CONVERSA → cartão proativo calado com o resumo dela (uma vez por fazenda na reunião)
export function fazendaCitada(frase) {
  const m = String(frase || '').match(/\b[Ff]azenda\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]+){0,2})/);
  return m ? m[1].trim() : '';
}

// CONTEXTO DA CONVERSA para cada pergunta ao Oscar ("isso", "essa fazenda", "o que a Tainá falou"): as falas dos
// últimos `minutos` (limpas, com quem falou) + decisões e pendências já anotadas. Corta pelo começo até caber.
export function contextoDaReuniao(falas = [], { agora = Date.now(), minutos = 8, decisoes = [], pendencias = [], teto = 3000 } = {}) {
  const desde = agora - minutos * 60000;
  const linhas = falas.filter((l) => l && l.texto && (!l.t || l.t >= desde) && !falaDegenerada(l.texto)).map((l) => `${l.quem || '?'}: ${corrigirNomes(l.texto)}`);
  const extra = [
    ...(decisoes.length ? ['Decisões já anotadas: ' + decisoes.map((d) => d.texto).join('; ')] : []),
    ...(pendencias.length ? ['Pendências já anotadas: ' + pendencias.map((p) => p.texto + (p.dono ? ` (${p.dono})` : '')).join('; ')] : []),
  ];
  let corpo = linhas;
  const tam = () => [...corpo, ...extra].join('\n').length;
  while (corpo.length > 1 && tam() > teto) corpo = corpo.slice(1);
  return [...corpo, ...extra].join('\n').slice(-teto);
}
