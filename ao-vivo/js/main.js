// OSCARPES AO VIVO — main.js
// LIGAR TUDO: INICIAR (saudação), os chamados do ouvido do Mac (?chamado=1…, BroadcastChannel,
// launchQueue), a voz natural preparada sozinha, os botões do microfone e da folha e a caixa de
// texto. É o ÚNICO <script type="module"> do index.html.
//
// A CORRENTE DE CARGA (03/out/2026, quando o arquivo único virou módulos sem mudar nada na tela):
// os módulos rodam na MESMA ordem em que o código estava no index.html antigo, porque cada módulo
// importa PRIMEIRO o anterior desta corrente:
//   base → cena → raizes → voz → ouvido → servidor → arranjo → telas → comandos → desenhos → mapas
//   → visor → fazenda → secoes → evolucao → navegacao → musica → controle → demo → apresentacao → porta-reuniao → regravar → main
// O navegador desce a corrente inteira (main → demo → … → base) antes de rodar qualquer módulo e
// roda de base até main; uma importação "para a frente" (telas usa fazenda, fazenda usa telas…)
// cai num módulo que já está na pilha e não muda a ordem. Função existe desde o começo (é içada);
// const/let só depois que o módulo dele rodou — igual ao arquivo único.
// Módulo novo: entra num ponto da corrente (importa o anterior primeiro; o seguinte passa a
// importar ele primeiro). Todo import leva ?v=20261010213811 (a publicação troca pela hora, e o
// navegador não mistura versão velha com nova). O portão scripts/conferir-ao-vivo-voz.ts confere a
// corrente, o ?v= e que o código junto, na ordem da corrente, compila como um script só.
// Um `let` exportado só muda dentro do módulo dele (import é só leitura): por isso o modo fazenda
// mora em telas.js (mudarEstado) e a conversa corrida em ouvido.js.
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import './regravar.js?v=20261010213811';
import { $, ANON, AVISOS_DE_ESPERA, SUPABASE_URL, TEMA_BUSCA, aviso, diag, esc } from './base.js?v=20261010213811';
import { Esfera, fase, mudarFase } from './cena.js?v=20261010213811';
import { Voz, VozNatural } from './voz.js?v=20261010213811';
import { dadosDoTema, entrarComSenha, sairDaSessao, token } from './servidor.js?v=20261010213811';
import {
  Escuta, IOS, MODO_GRAVADOR, Ouvido, abrirConversa, atualizarMic, ecoDaVoz, falarEmTurno, legenda, legendaSome, ocupado, perguntar, tirarChamada,
} from './ouvido.js?v=20261010213811';
import { fecharTudo, paineisVivos } from './telas.js?v=20261010213811';
import { Musica, esperarChamadosDoMac } from './musica.js?v=20261010213811';
import { temaEstaCalado } from './controle.js?v=20261010213811';
import { ligarRegravacao } from './regravar.js?v=20261010213811';

// ---------------------------------------------------------------------------
// Ligar tudo
// ---------------------------------------------------------------------------
let iniciado = false;
// iniciar(pergunta): sem pergunta é o INICIAR de sempre (saudação). Com
// pergunta (string, mesmo vazia) é o OUVIDO DO MAC que chamou: sem saudação,
// já pergunta o que o João disse depois do "Oscar".
function iniciar(pergunta) {
  const chamado = typeof pergunta === 'string';
  iniciado = true;
  $('abertura').style.display = 'none';
  Voz.destravar();
  prepararVozNatural();
  Musica.comecar();                       // só depois do toque (regra do navegador)
  if (MODO_GRAVADOR || Ouvido.disponivel) { Escuta.ligar().then((ok) => { if (ok && fase !== 'falando' && fase !== 'pensando') mudarFase('ouvindo'); atualizarMic(); }); }
  else { aviso('Este navegador não deixa usar o microfone. Dá para escrever na caixa embaixo.'); mudarFase('espera'); }
  atualizarMic();
  esperarChamadosDoMac((ch) => atenderChamado(ch, true));   // o ouvido do Mac entrega direto a esta janela
  if (chamado) { receberChamado(pergunta); return; }
  const saudacao = IOS ? TEMA.saudacao.ios : TEMA.saudacao.outros;
  legenda(esc(saudacao));
  // João, 02/out/2026: "no início ele falou com a voz do Mac, depois voltou com
  // a outra" — a saudação saía antes de a voz natural terminar de carregar.
  // Espera a natural até 5 s; não ficou pronta, a saudação fica só escrita.
  if (!IOS) {
    const t0 = Date.now();
    const esperar = () => {
      if (VozNatural.pronta) { if (fase !== 'falando' && fase !== 'pensando') falarEmTurno(saudacao); }
      else if (Date.now() - t0 < 5000) setTimeout(esperar, 200);
    };
    esperar();
  }
}
$('comecar').onclick = () => iniciar(chamadoEsperando ?? undefined);

// ---------------------------------------------------------------------------
// OUVIDO DO MAC (02/out/2026) — João: "quando eu disser Oscar, a janela do
// Oscarpes ao vivo aparece e responde", mesmo com nada aberto. Um programinha
// no Mac (ouvido-mac/) ouve o "Oscar" DENTRO do Mac e abre esta página com
//   ?chamado=1&id=<hora>&pergunta=<o que veio depois do "Oscar">
// Três caminhos, conforme o que já está aberto:
//  1. App instalado ("Instalar Oscarpes") e já aberto: o manifesto tem
//     launch_handler "focus-existing" — o Chrome traz a janela para a frente e
//     entrega o endereço pelo launchQueue, SEM abrir outra janela.
//  2. Outra aba/janela desta página já iniciada: a nova pergunta "tem alguém
//     aí?" no BroadcastChannel, entrega a pergunta para a que responder e se fecha.
//  3. Nada aberto: esta mesma página inicia sozinha e pergunta. O Chrome só
//     deixa tocar som sem um clique quando o site é app instalado (ou muito
//     usado); se não deixar, a tela de abertura mostra a pergunta e o botão
//     RESPONDER — um clique e segue.
// O id evita responder duas vezes ao mesmo chamado (o launchQueue também
// entrega o endereço da primeira abertura, que o caminho 3 já tratou).
// ---------------------------------------------------------------------------
/** Lê o chamado do endereço: { id, pergunta } ou null. */
function lerChamado(busca) { const p = new URLSearchParams(busca || ''); if (!p.has('chamado')) return null; return { id: p.get('id') || String(p.get('pergunta') || ''), pergunta: String(p.get('pergunta') || '').trim().slice(0, 500) }; }
const chamadosAtendidos = new Set();
let chamadoEsperando = null;            // pergunta esperando o clique em RESPONDER
let podeFalarEm = 0;                    // o "Pode falar." do chamado vazio sai uma vez só
const PODE_FALAR_UMA_VEZ_MS = 20000;
/** Página já iniciada recebe um chamado do ouvido do Mac (direto = pela espera, sem o `open`). */
function receberChamado(pergunta, direto) {
  diag('chamado do mac' + (direto ? ' direto' : ''));
  abrirConversa();                       // conversa corrida: a resposta não precisa de outro "Oscar"
  try { window.focus(); } catch (e) {}
  // 04/out/2026 (noite): a pergunta vai para perguntar() SEMPRE — comando local é feito na hora (sem
  // calar a voz), pergunta com outra no agente entra na fila (ver filaDoMac, ouvido.js). Antes, com uma
  // pergunta pensando, o "if (ocupado) return" jogava fora até o "próxima música".
  if (pergunta) {
    if (ecoDaVoz(pergunta, Voz.falando, Voz.texto)) { diag('chamado era a própria voz'); return; }
    perguntar(pergunta, undefined, { doMac: true, direto }); return;
  }
  if (ocupado) return;                   // já pensando numa pergunta: a resposta vem
  Voz.parar();
  // "OSCAR" SOZINHO (04/out/2026, Mac Studio): o ouvido do Mac já esperou ~8 s a pergunta começar e
  // nada veio. Antes a página dizia "Pode falar." e ninguém escutava — o diagnóstico daquela abertura
  // não tinha "start"/"ouvindo" e o Chrome nunca pegou o microfone; a pergunta seguinte se perdia.
  // Agora: a página LIGA o próprio ouvido se ele não estiver ligado (o "Pode falar." pausa e o
  // retoma no fim da fala), a conversa corrida fica aberta (sem outro "Oscar"), e o "Pode falar."
  // sai UMA vez — um segundo vazio logo em seguida só mostra a legenda (o ouvido do Mac também
  // escuta a frase seguinte e manda ela como pergunta: a primeira que chegar vale).
  if (!Escuta.ligado && (MODO_GRAVADOR || Ouvido.disponivel)) {
    diag('chamado vazio liga o ouvido');
    Escuta.ligar().then((ok) => { if (ok && fase !== 'falando' && fase !== 'pensando') mudarFase('ouvindo'); atualizarMic(); });
  }
  legenda(esc('Pode falar.'));
  if (Date.now() - podeFalarEm < PODE_FALAR_UMA_VEZ_MS) return;
  podeFalarEm = Date.now();
  falarEmTurno('Pode falar.');
}
/** O Chrome deixa tocar som sem clique aqui? (app instalado / site muito usado) */
function somLiberado() {
  try { if (navigator.getAutoplayPolicy) return navigator.getAutoplayPolicy('audiocontext') === 'allowed'; } catch (e) {}
  try { const c = new (window.AudioContext || window.webkitAudioContext)(); const ok = c.state === 'running'; c.close(); return ok; } catch (e) { return false; }
}
function atenderChamado(ch, direto) {
  if (!ch || chamadosAtendidos.has(ch.id)) return;
  chamadosAtendidos.add(ch.id);
  if (iniciado) { receberChamado(ch.pergunta, direto); return; }
  if (somLiberado()) { iniciar(ch.pergunta); return; }
  // sem som liberado: um clique em RESPONDER e já pergunta
  chamadoEsperando = ch.pergunta;
  $('comecar').textContent = 'RESPONDER';
  const p = $('abertura').querySelector('p');
  if (p) p.textContent = ch.pergunta ? `Você disse: “${ch.pergunta}”. Clique para eu responder.` : 'Você me chamou. Clique para eu ouvir.';
}
const canal = ('BroadcastChannel' in window) ? new BroadcastChannel('oscarpes-ao-vivo' + (TEMA_BUSCA ? '-' + TEMA.id : '')) : null;
const EU = Math.random().toString(36).slice(2);
if (canal) canal.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.tipo === 'quem-esta-aberto' && iniciado) canal.postMessage({ tipo: 'estou', para: m.de, de: EU });
  if (m.tipo === 'chamado' && m.para === EU) atenderChamado(m.chamado);
};
(async () => {
  const ch = lerChamado(location.search);
  if (!ch) return;
  // o endereço volta a ser o simples: recarregar não repete a pergunta
  try { history.replaceState(null, '', location.pathname + (TEMA_BUSCA ? '?' + TEMA_BUSCA : '')); } catch (e) {}
  if (canal) {
    const outra = await new Promise((ok) => {
      const t = setTimeout(() => ok(null), 400);
      const ouvir = (ev) => { if (ev.data && ev.data.tipo === 'estou' && ev.data.para === EU) { clearTimeout(t); canal.removeEventListener('message', ouvir); ok(ev.data.de); } };
      canal.addEventListener('message', ouvir);
      canal.postMessage({ tipo: 'quem-esta-aberto', de: EU });
    });
    if (outra) {
      chamadosAtendidos.add(ch.id);
      canal.postMessage({ tipo: 'chamado', para: outra, chamado: ch });
      window.close();                    // o Chrome deixa fechar uma aba que só tem esta página no histórico
      $('comecar').style.display = 'none';
      const p = $('abertura').querySelector('p'); if (p) p.textContent = `Mandei a pergunta para a janela do ${TEMA.nome} que já estava aberta. Pode fechar esta.`;
      return;
    }
  }
  atenderChamado(ch);
})();
// app instalado já aberto: o Chrome entrega aqui o endereço do chamado
if ('launchQueue' in window) window.launchQueue.setConsumer((lp) => { try { if (lp && lp.targetURL) atenderChamado(lerChamado(new URL(lp.targetURL).search)); } catch (e) {} });
// VOZ NATURAL: prepara sozinha (o toque em INICIAR é o pedido; o João, 02/out:
// "a voz ainda tá a do iPhone") e mostra no topo qual voz está falando.
function seloVoz(t) { $('vozChip').textContent = t; }
// uma preparação só por vez (04/out/2026): a carga da página e a regravação podem pedir juntas, e
// o motor da voz não pode ser montado duas vezes ao mesmo tempo
let preparoDaVoz = null;
function prepararVozNatural() { if (!preparoDaVoz) preparoDaVoz = prepararVozNaturalJa().finally(() => { preparoDaVoz = null; }); return preparoDaVoz; }
async function prepararVozNaturalJa() {
  if (!VozNatural.possivel) { seloVoz('VOZ: APARELHO'); return; }
  if (VozNatural.pronta) { seloVoz('VOZ: NATURAL'); return; }
  try {
    seloVoz('VOZ: PREPARANDO');
    await VozNatural.preparar((f) => seloVoz(f < 1 ? `VOZ: BAIXANDO ${Math.round(f * 100)}%` : 'VOZ: PREPARANDO'));
    seloVoz('VOZ: NATURAL');
    // aquece o motor e deixa os avisos de espera prontos (saem sem esperar geração)
    setTimeout(() => VozNatural.aquecer(AVISOS_DE_ESPERA), 400);
  } catch (e) {
    console.log('[ao-vivo] voz natural não preparou', e);
    seloVoz('VOZ: APARELHO');
  }
}
(async () => { if (VozNatural.possivel && await VozNatural.jaBaixada()) prepararVozNatural(); else seloVoz(VozNatural.possivel ? '' : 'VOZ: APARELHO'); })();
// MICROFONE (02/out/2026, "pausar o microfone não volta mais"): antes o botão só
// pausava se estivesse em "ouvindo" E o reconhecimento estivesse de pé naquele
// instante — no Chrome, entre uma religada e outra (ou enquanto falava), o toque
// caía no "ligar" e a pausa não pausava; e pausar durante a fala não existia.
// Agora: falando → interrompe e volta a ouvir; ligado → pausa; desligado → liga.
$('mic').onclick = async () => {
  // (o destravar fala um " " mudo — por isso a pergunta "está falando?" vem ANTES dele)
  const falandoAgora = Voz.falando || fase === 'falando';
  Voz.destravar();
  if (falandoAgora) {
    Voz.parar();
    if (Escuta.ligado) { mudarFase('ouvindo'); Escuta.retomar(); }
    else if (await Escuta.ligar()) mudarFase('ouvindo');
  } else if (Escuta.ligado && fase !== 'toque') { Escuta.desligar(); mudarFase('espera'); }
  else if (await Escuta.ligar()) mudarFase('ouvindo');
  atualizarMic();
};
$('esfera').onclick = () => {        // tocar na folha: volta a ouvir (o iPhone exige um toque)
  Voz.destravar();
  if (Voz.falando) { Voz.parar(); }
  if (ocupado) return;                 // pensando: a resposta já vem
  Escuta.ligar().then((ok) => { if (ok) mudarFase('ouvindo'); atualizarMic(); });
};
$('caixa').onsubmit = (e) => { e.preventDefault(); const t = $('digitado').value.trim(); $('digitado').value = ''; if (t) { Voz.parar(); perguntar(t); } };
document.addEventListener('visibilitychange', () => { if (document.hidden) Voz.parar(); });
mudarFase('espera');
// REGRAVAÇÃO (04/out/2026, js/regravar.js): só com ?regravar=<id> no endereço — a abertura vira a
// da regravação e nada começa sem o clique em GRAVAR REGRAVAÇÃO (e só para admin)
ligarRegravacao({ prepararVoz: prepararVozNatural });

// PONTE PARA O MÓDULO DE TEMA (03/out/2026) — docs/ao-vivo/TEMAS.md ("modulos"). Só existe quando o
// tema declara módulos (ex.: um playbook de vendas); a página da Oscarpes não ganha
// nada disto. O módulo usa a voz, a legenda e as bolinhas do motor e devolve as frases que são
// dele por window.AO_VIVO_FRASE (perguntar, em ouvido.js, pergunta a ele primeiro).
if ((TEMA.modulos || []).length) {
  window.AO_VIVO = Object.freeze({
    // reaberta pelo histórico ("volta aquela"), a vista do tema abre calada — não repete o discurso
    falar: (t) => { if (!temaEstaCalado()) falarEmTurno(t); }, legenda, legendaSome, abrirConversa, semChamada: tirarChamada, pararVoz: () => Voz.parar(),
    formar: (els) => Esfera.formar(els), fecharJanelas: () => { if (paineisVivos.length) fecharTudo(); },
    falando: () => Voz.falando,
    // 05/out/2026: a frase que está sendo falada AGORA (a "caixa do momento" do tema acompanha a voz)
    pedacoFalado: () => Voz.pedacoAtual,
    // tema com "login": entrar, sair e os dados do tema (só membro da org — o servidor confere)
    sessao: Object.freeze({ token, entrar: entrarComSenha, sair: sairDaSessao, dadosDoTema,
      // 05/out/2026: o módulo de tema que lê uma tabela da org (ex.: um mapa de resultados) lê pelo login de
      // quem abre — a RLS do banco decide (só membro). Endereço e chave PÚBLICA, nunca segredo.
      rest: Object.freeze({ url: SUPABASE_URL, anon: ANON }) }),
  });
}
