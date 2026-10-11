// OSCARPES AO VIVO — porta-reuniao.js
// A PORTA DA REUNIÃO (06/out/2026, João: "a reunião vira um MODO do Jarvis"). Este módulo é PEQUENO de propósito: só
// reconhece o pedido ("Oscar, chama o Ararê e a Tainá para uma reunião", "abre uma reunião"), o link de convidado
// (?entrar=<código>) e o ?reuniao=1 (o endereço antigo /ao-vivo/reuniao/ no Mac) e, SÓ ENTÃO, carrega a reunião
// inteira com import() de ../reuniao/modo.js. Quem usa o Jarvis sem reunião não baixa nada da reunião (a prova é o
// ensaio scripts/reuniao/ensaiar-sala.mjs, que olha a rede antes e depois do pedido).
// A reunião assume o microfone e a voz enquanto dura (o ouvido do Jarvis pausa) e devolve tudo no fim; os comandos
// locais do Jarvis (música, apresentação, janelas) seguem valendo dentro dela pela PONTE (ver ponteDoJarvis).
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import './apresentacao.js?v=20261010213811';
import { $, diag } from './base.js?v=20261010213811';
import { Voz } from './voz.js?v=20261010213811';
import { Escuta, abrirConversa, atualizarMic, falarEmTurno, legenda, legendaSome } from './ouvido.js?v=20261010213811';
import { mudarFase } from './cena.js?v=20261010213811';
import { comandoDaMusica } from './musica.js?v=20261010213811';
import { comandoDeControle } from './controle.js?v=20261010213811';
import { comandoDaTela } from './comandos.js?v=20261010213811';
import { fecharTudo, mostrarTelas, paineisVivos } from './telas.js?v=20261010213811';

// <pedidoDeReuniao> (função pura — o portão conferir-ao-vivo-voz roda ela)
// "chama o Ararê e a Tainá para uma reunião" → { convidar: ['Ararê', 'Tainá'] } · "abre uma reunião" → { convidar: [] }
// Fica de fora o que é AGENDA ou pergunta ("marca uma reunião amanhã às 10", "como foi a reunião de ontem") — isso é do
// agente. Os nomes saem do jeito que foram ditos (com acento); quem não está no app vira "sem telefone" no convite.
function pedidoDeReuniao(frase) {
  const bruto = String(frase || '').replace(/^\s*((o|ô|ei|hey|ok)[\s,]+)?([oó]scar(pes)?|jarvis)\b[\s,.!?:;-]*/i, '').trim();
  const n = bruto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/\breuni(ao|oes)\b/.test(n)) return null;
  // agenda, passado e pergunta: não é para abrir agora
  if (/\b(amanha|depois de amanha|semana que vem|proxima semana|segunda|terca|quarta|quinta|sexta|sabado|domingo|as \d|\d+ ?h\b|horas?\b|dia \d|agenda|agendar|marca|marcar|marque|lembra|lembrete|ontem|ultima|passada|como foi|ata da|resumo da|quando)\b/.test(n)) return null;
  const verbo = /\b(chama|chame|chamar|convida|convide|convidar|abre|abra|abrir|comeca|comece|comecar|inicia|inicie|iniciar|liga|ligue|faz|faca|fazer|bora|vamos|cria|crie|criar|nova|quero)\b/;
  if (!verbo.test(n)) return null;
  // os nomes: entre o verbo de chamar e "para/pra/numa reunião", ou depois de "reunião com"
  let trecho = '';
  const m1 = bruto.match(/\b(?:chama|chame|chamar|convida|convide|convidar|traz|traga|puxa)\s+(.+?)\s+(?:para|pra|pr[aá]|numa|na|em uma|uma)\s+(?:uma\s+)?reuni[aã]o/i);
  const m2 = bruto.match(/reuni[aã]o\s+(?:agora\s+)?com\s+(.+)$/i);
  if (m1) trecho = m1[1]; else if (m2) trecho = m2[1];
  const convidar = [];
  for (let p of trecho.split(/\s*,\s*|\s+e\s+/i)) {
    p = p.replace(/^(o|a|os|as|do|da|meu|minha|nosso|nossa|seu|sua)\s+/i, '').replace(/[.!?;:]+$/, '').trim();
    if (!p || /^(gente|pessoal|todo mundo|todos|equipe|time|irmaos|socios)$/i.test(p) || p.split(/\s+/).length > 3) continue;
    const nome = p.split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    if (!convidar.includes(nome)) convidar.push(nome);
  }
  return { convidar };
}
// </pedidoDeReuniao>

// o módulo da reunião, carregado na 1ª vez que alguém pede (e nunca antes)
let reuniaoCarregada = null;      // a promessa do import()
let reuniaoAtiva = false;
function carregarReuniao() {
  if (!reuniaoCarregada) {
    diag('reuniao: carregando');
    reuniaoCarregada = import('../reuniao/modo.js?v=20261010213811').catch((e) => { reuniaoCarregada = null; throw e; });
  }
  return reuniaoCarregada;
}

// PONTE — o que a reunião pode usar do Jarvis (e nada mais): a voz e o ouvido dele são pausados e devolvidos, os
// comandos locais (música, apresentação, janelas) continuam valendo, e as telas ricas (mapa, dossiê) abrem no Jarvis.
function ponteDoJarvis() {
  return Object.freeze({
    tema: TEMA,
    /** a reunião começou: o ouvido do Jarvis larga o microfone, a voz cala e a música baixa */
    assumir() {
      reuniaoAtiva = true;
      try { Voz.parar(); } catch (e) { /* nada */ }
      try { Escuta.desligar(); atualizarMic(); } catch (e) { /* nada */ }
      const m = $('trilha-som'); if (m) { try { m.pause(); } catch (e) { /* nada */ } }
      document.documentElement.classList.add('em-reuniao');
      mudarFase('espera'); legendaSome(0);
    },
    /** a reunião acabou: o Jarvis volta a ouvir */
    devolver() {
      reuniaoAtiva = false;
      document.documentElement.classList.remove('em-reuniao');
      Escuta.ligar().then((ok) => { if (ok) mudarFase('ouvindo'); atualizarMic(); }).catch(() => {});
      abrirConversa();
    },
    /** comando local do Jarvis (música, apresentação, janelas): feito aqui, sem servidor. true = era comando */
    comandoLocal(frase) {
      const f = String(frase || '');
      try { return !!(comandoDaMusica(f) || comandoDeControle(f) || (paineisVivos.length && comandoDaTela(f))); } catch (e) { return false; }
    },
    /** as telas ricas da resposta do agente (mapa, dossiê) abrem também no Jarvis do anfitrião */
    mostrarTelas(telas) { try { if (Array.isArray(telas) && telas.length) mostrarTelas(telas); } catch (e) { /* nada */ } },
    fecharTelas() { try { if (paineisVivos.length) fecharTudo(); } catch (e) { /* nada */ } },
  });
}

/** Abre a reunião (anfitrião). convidar: nomes ditos. Devolve a promessa do módulo. */
async function abrirReuniaoPeloJarvis(convidar, comoFoi) {
  if (reuniaoAtiva) { legenda('<span class="voce">A reunião já está aberta.</span>'); return null; }
  const quem = convidar.length ? ' com ' + juntarNomes(convidar) : '';
  legenda(`<span class="voce">Abrindo a reunião${quem}…</span>`);
  try {
    const m = await carregarReuniao();
    return m.abrirReuniao({ papel: 'anfitriao', convidar, ponte: ponteDoJarvis(), comoFoi });
  } catch (e) {
    console.error('[Reuniao] não carregou', e);
    falarEmTurno('Não consegui abrir a reunião agora. Confira a internet e peça de novo.');
    return null;
  }
}
function juntarNomes(l) { return l.length < 2 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]; }

/** perguntar() (ouvido.js) pergunta aqui primeiro: é pedido de reunião? true = a porta cuidou */
function comandoDeReuniao(frase, opcoes = {}) {
  // dentro da reunião a sala é ouvida pela própria reunião: o que chega pelo Jarvis (ouvido do Mac, caixa) não repete
  if (reuniaoAtiva) return !!opcoes.doMac;
  const p = pedidoDeReuniao(frase);
  if (!p) return false;
  diag('pedido de reuniao');
  abrirReuniaoPeloJarvis(p.convidar, 'voz');
  return true;
}

// CONVIDADO (?entrar=<código>) e o endereço antigo (?reuniao=1): a página abre direto na reunião, sem o INICIAR do Jarvis
const BUSCA = new URLSearchParams(location.search);
const CODIGO = /^[a-z2-9]{10}$/.test(BUSCA.get('entrar') || '') ? BUSCA.get('entrar') : '';
const ABRIR_DIRETO = BUSCA.get('reuniao') === '1';
if (CODIGO || ABRIR_DIRETO) {
  const ab = $('abertura'); if (ab) ab.style.display = 'none';
  document.documentElement.classList.add('em-reuniao');
  carregarReuniao().then((m) => m.abrirReuniao(CODIGO ? { papel: 'convidado', codigo: CODIGO, ponte: ponteDoJarvis() } : { papel: 'anfitriao', convidar: [], ponte: ponteDoJarvis(), comoFoi: 'endereco' }))
    .catch((e) => { console.error('[Reuniao] não carregou', e); if (ab) ab.style.display = ''; document.documentElement.classList.remove('em-reuniao'); });
}
// UM OSCAR SÓ (06/out/2026): servida pelo balcão do Mac (127.0.0.1:47815), esta página ouve a sala pelo próprio microfone e o
// ouvido do Mac não consegue entregar chamado a ela — ele abria o app do site e DOIS Oscar respondiam. Enquanto a página está
// ouvindo (ou com a reunião aberta), avisa o balcão a cada 8 s e ele cala o ouvido (ver Silencio em mesa-reuniao.js).
if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(location.origin)) {
  const avisarBalcao = () => { if (Escuta.ligado || reuniaoAtiva) fetch('/api/silenciar-ouvido?tema=' + encodeURIComponent(TEMA.id), { method: 'POST' }).catch(() => {}); };
  setInterval(avisarBalcao, 8000); setTimeout(avisarBalcao, 1500);
}
// para o ensaio invisível: dá para "dizer" a frase sem microfone (headless)
window.AO_VIVO_REUNIAO = Object.freeze({ pedidoDeReuniao, get ativa() { return reuniaoAtiva; }, get carregada() { return !!reuniaoCarregada; } });

export {
  pedidoDeReuniao, comandoDeReuniao, abrirReuniaoPeloJarvis,
};
