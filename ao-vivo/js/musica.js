// OSCARPES AO VIVO — musica.js
// MÚSICA: a fase da conversa avisada ao OUVIDO DO MAC (127.0.0.1:47811, que abaixa/sobe o Spotify),
// "Oscar, desliga a música" resolvido aqui, e a MÚSICA AMBIENTE da própria página (hoje sem faixa).
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import './navegacao.js?v=20261010213811';
import { $, TEMA_BUSCA, diag, esc } from './base.js?v=20261010213811';
import { CELULAR, fase } from './cena.js?v=20261010213811';
import { Voz } from './voz.js?v=20261010213811';
import { IOS, abrirConversa, conversaAte, encerrarConversa, legenda, legendaSome, ultimaFalaOuvida } from './ouvido.js?v=20261010213811';
import { sinal, telaMudouEm } from './controle.js?v=20261010213811';

// FASE PARA O OUVIDO DO MAC (03/out/2026) — João: "o bom é a música AUMENTAR um
// pouco enquanto o Jarvis PENSA, só abaixa enquanto ele FALA". O programinha
// ouvido-mac/ (música no Spotify do João) só sabe a fase se a página contar:
// cada mudança de fase vai para http://127.0.0.1:47811 (o próprio Mac; nada sai
// para a internet), repetida a cada 30 s, e "fechada" ao fechar a janela. Sem o
// programa rodando, o pedido falha calado. Só no computador.
// O "Só um momento" só se cala quando o Mac CONFIRMA que a música está tocando
// (a resposta traz {"musica":true}; vale 60 s, renovada a cada aviso). João,
// 03/out: "mantenha o 'só um momento' para quando o cliente desligar a música".
// Sem ouvido, sem resposta ou música desligada: o aviso de espera toca como antes.
const NO_COMPUTADOR = !/iPad|iPhone|iPod|Android/.test(navigator.userAgent) && !(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const FASE_MAC = 'http://127.0.0.1:47811/fase?f=';
let faseAvisada = '';
let musicaNoMacAte = 0;                 // até quando vale o "a música está tocando" do Mac
const musicaTocandoNoMac = () => Date.now() < musicaNoMacAte;
// O VOLUME PELA FASE (04/out/2026, "Jarvis, aumenta a música" / "toca mais um pouco"): o ouvido
// instalado só conhece 3 volumes — 30 ouvindo, 45 pensando, 10 falando — e só sabe a fase. Sem
// recompilar (cada recompilação pede as permissões do macOS de novo), a página "empresta" a fase:
// música ALTA = avisa "pensando" enquanto espera; BAIXA = avisa "falando". Falando de verdade, a
// música sempre abaixa. Ouvido novo (que aceita /musica?acao=mais|menos), a fase volta a ser a real.
let nivelMusica = 0;                    // -1 baixa · 0 normal · 1 alta (só no ouvido antigo)
let deixarTocarAte = 0;                 // "toca mais um pouco": alta e o Jarvis calado até aqui
let ouvidoNovo = false;                 // o ouvido respondeu 200 a mais/menos/proxima
let palmasAte = 0;                      // palmas tocando: a música abaixa (controle.js marca)
// <faseParaOMac> (função pura — o portão roda ela)
/** fase da página + nível pedido → a fase que o ouvido do Mac recebe (o volume vem dela) */
function faseParaOMac(f, nivel, deixar, palmas) {
  if (f === 'fechada' || f === 'falando' || palmas) return f === 'fechada' ? f : 'falando';
  if (deixar) return 'pensando';
  if (f === 'pensando') return nivel < 0 ? 'ouvindo' : 'pensando';
  return nivel > 0 ? 'pensando' : nivel < 0 ? 'falando' : f;
}
// </faseParaOMac>
let faseReal = '';
function avisarFaseAoMac(f, repetir) {
  if (!NO_COMPUTADOR) return;
  faseReal = f;
  const agora = Date.now();
  f = faseParaOMac(f, ouvidoNovo ? 0 : nivelMusica, agora < deixarTocarAte, agora < palmasAte);
  if (f === faseAvisada && !repetir) return;
  faseAvisada = f;
  try {
    // 05/out/2026, 20h40 (João: "o Jarvis da empresa está saindo da página para ligar o Spotify"): o ouvido só toca música na
    // janela do tema Oscarpes e fora de apresentação — a página diz o tema e se está apresentando
    const tema = (TEMA_BUSCA.match(/tema=([^&]+)/) || [])[1] || 'oscarpes';
    const apres = document.body && (document.body.classList.contains('modo-apresentacao') || document.body.classList.contains('regravando')) ? 1 : 0;
    fetch(FASE_MAC + encodeURIComponent(f) + '&tema=' + encodeURIComponent(decodeURIComponent(tema)) + '&apres=' + apres, { method: 'POST', mode: 'cors', keepalive: true })
      .then((r) => r.json()).then((j) => { musicaNoMacAte = j && j.musica === true ? Date.now() + 60000 : 0; }).catch(() => {});
  } catch (e) {}
}
// "OSCAR, DESLIGA A MÚSICA" (03/out/2026, João: "ele não está desligando o
// Spotify quando eu desligo ele"): resolvido aqui, sem servidor. Manda
// /musica?acao=parar|ligar ao Mac, que guarda o liga/desliga.
// 04/out/2026 (João: "Jarvis, aumente a música; toca mais um pouco"): + mais | menos | deixar
// (toca mais um pouco: música alta e o Jarvis calado por uns segundos) | proxima (pula a faixa).
// Pergunta ("?", "quanto/qual/como…") nunca é comando.
// 04/out/2026 (noite, João: "ele não sabe voltar para a música anterior que estava tocando"): + anterior.
// Com "música/faixa" na frase é sempre a música ("volta a música anterior", "põe aquela música de novo").
// SEM a palavra ("volta aquela", "a de antes", "põe a outra de novo") a mesma frase também volta a TELA
// (controle.js) — vale a música só quando a última troca foi de MÚSICA, há menos de 10 min
// (ctx.musicaRecente); senão segue para o histórico das telas, como antes.
// <entenderMusica> (função pura — o portão roda ela)
function entenderMusica(frase, ctx = {}) {
  if (/\?\s*$/.test(String(frase || ''))) return null;
  const f = String(frase || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(oscar|oscarpes|jarvis) /, '').replace(/^(por favor|pode|ok|ta|beleza|agora) /, '').replace(/ (por favor|oscar|jarvis|agora)$/, '');
  if (/^(como|qual|quais|quanto|quantos|quantas|quando|onde|por que|porque|o que|quem|sera)\b/.test(f) || f.split(' ').length > 8) return null;
  const MUS = '(musica|musiquinha|som de fundo|spotify|som|volume|volume da musica|som da musica)';
  if (new RegExp(`^(para|pare|parar|desliga|desligue|desligar|pausa|pause|pausar|tira|tire|corta|corte|silencia)( a| essa| esta| o)? (musica|musiquinha|som de fundo|spotify)$`).test(f)) return 'parar';
  if (/^(liga|ligue|ligar|toca|toque|tocar|volta|voltar|bota|coloca|coloque|poe|retoma|retome|solta|solte)( a| uma| o)? (musica|musiquinha|som de fundo|spotify)( de novo)?$/.test(f)) return 'ligar';
  if (new RegExp(`^(aumenta|aumente|aumentar|sobe|suba|subir|levanta|levante)( mais)?( a| o)? ${MUS}( mais| um pouco| um pouquinho| um pouco mais)?$`).test(f)
    || /^((a )?musica |o som )?mais (alto|alta)( a musica| o som)?( por favor)?$|^mais (som|volume|musica)$/.test(f)) return 'mais';
  if (new RegExp(`^(abaixa|abaixe|abaixar|diminui|diminua|diminuir|baixa|baixe|reduz|reduza)( mais)?( a| o)? ${MUS}( mais| um pouco| um pouquinho| um pouco mais)?$`).test(f)
    || /^((a )?musica |o som )?mais (baixo|baixa)( a musica| o som)?( por favor)?$|^menos (som|volume|musica)$/.test(f)) return 'menos';
  if (/^(toca|toque|deixa|deixe)( mais)? (um pouco|um pouquinho|um minuto|um pouco mais|um pouquinho mais)( mais)?( a musica| de musica)?$|^(deixa|deixe)( a musica)? tocar( mais)?( um pouco| um pouquinho| um minuto)?( mais)?$|^(curte|curta|curtir) (a musica|um pouco)$/.test(f)) return 'deixar';
  if (/^(proxima|outra|troca|troque|trocar|muda|mude|mudar|pula|pule|pular|passa|passe|avanca|avance)( de| a| essa)? (musica|faixa|cancao)$|^(musica|faixa) (seguinte|proxima)$|^proxima (musica|faixa)$/.test(f)) return 'proxima';
  const VOLTAR = '(volta|voltar|volte|retorna|retorne|poe|bota|coloca|coloque|toca|toque)';
  if (new RegExp(`^${VOLTAR}( pra| para| pro)?( a| o)? (musica|faixa|cancao) (anterior|de antes|que estava (tocando|antes)|que tava tocando|que tocava antes)( de novo)?$`).test(f)
    || /^(a |o )?(musica|faixa|cancao) (anterior|de antes)$/.test(f)
    || new RegExp(`^${VOLTAR}( pra| para)? (aquela|a outra|aquela outra) (musica|faixa|cancao)( de novo| de antes)?$`).test(f)) return 'anterior';
  if (ctx.musicaRecente && (new RegExp(`^(${VOLTAR}( pra| para)? )?(a |o )?(aquela|anterior|de antes)( de novo)?$`).test(f)
    || new RegExp(`^(${VOLTAR} )?(a )?(outra|aquela outra) de novo$|^(volta|voltar|volte) (a |pra |para )?(outra|aquela outra)$`).test(f))) return 'anterior';
  return null;
}
// </entenderMusica>
const MUSICA_MAC = 'http://127.0.0.1:47811/musica?acao=';
const SEGUNDOS_DEIXAR = 30;              // "toca mais um pouco" ("um minuto": 60)
let relogioDeixar = null, avisouOuvidoVelho = false;
let musicaTrocadaEm = 0;                 // a última "próxima"/"anterior" que o Mac fez (decide o "volta aquela")
const MUSICA_RECENTE_MS = 10 * 60000;
/** "volta aquela" é da música? Só se a última troca foi de música (depois da última tela) e recente. */
function musicaFoiAUltimaTroca() { return musicaTrocadaEm > telaMudouEm() && Date.now() - musicaTrocadaEm < MUSICA_RECENTE_MS; }
function comandoDaMusica(frase) {
  const acao = entenderMusica(frase, { musicaRecente: musicaFoiAUltimaTroca() });
  if (!acao) return false;
  diag('musica ' + acao);
  legenda(`<span class="voce">${esc(frase)}</span>`);
  legendaSome(2500);
  // a música é a do Spotify do Mac (o ouvido-mac): no celular não há o que controlar
  if (!NO_COMPUTADOR) { abrirConversa(); Voz.avisar('A música é controlada pelo programa do Mac.'); return true; }
  const semOuvido = () => Voz.avisar('Não achei o programa da música neste computador.');
  if (acao === 'deixar') {
    // o Jarvis cala e a conversa corrida fecha: só volta a falar com outro "Oscar…"
    Voz.parar(); encerrarConversa();
    const s = /minuto/.test(String(frase).toLowerCase()) ? 60 : SEGUNDOS_DEIXAR;
    deixarTocarAte = Date.now() + s * 1000; avisarFaseAoMac(faseReal || fase, true);
    clearTimeout(relogioDeixar); relogioDeixar = setTimeout(() => { deixarTocarAte = 0; avisarFaseAoMac(faseReal || fase, true); }, s * 1000 + 50);
    sinal('♪', 'tocando');
    return true;
  }
  abrirConversa();
  if (acao === 'parar' || acao === 'ligar') {
    if (acao === 'parar') { deixarTocarAte = 0; clearTimeout(relogioDeixar); }
    fetch(MUSICA_MAC + acao, { method: 'POST', mode: 'cors' })
      .then((r) => r.json()).then((j) => { musicaNoMacAte = j && j.musica === true ? Date.now() + 60000 : 0; Voz.avisar(acao === 'parar' ? 'Pronto, desliguei a música.' : 'Música ligada.'); })
      .catch(semOuvido);
    return true;
  }
  // mais | menos | proxima | anterior: o ouvido novo faz de verdade; o antigo responde 400 (ação que não conhece)
  fetch(MUSICA_MAC + acao, { method: 'POST', mode: 'cors' }).then((r) => {
    if (r.ok) {
      ouvidoNovo = true;
      if (acao === 'proxima' || acao === 'anterior') musicaTrocadaEm = Date.now();
      sinal('♪', acao === 'mais' ? 'mais alto' : acao === 'menos' ? 'mais baixo' : acao === 'anterior' ? 'a de antes' : 'próxima'); return;
    }
    ouvidoNovo = false;
    if (acao === 'proxima') { Voz.avisar('Para trocar a música, falta atualizar o programa do Mac.'); return; }
    if (acao === 'anterior') { Voz.avisar('Para voltar a música, falta atualizar o programa do Mac.'); return; }
    // ouvido antigo: 3 degraus pela fase emprestada
    const antes = nivelMusica;
    nivelMusica = Math.max(-1, Math.min(1, nivelMusica + (acao === 'mais' ? 1 : -1)));
    avisarFaseAoMac(faseReal || fase, true);
    if (nivelMusica === antes) {
      sinal('♪', acao === 'mais' ? 'no máximo' : 'no mínimo');
      if (!avisouOuvidoVelho) { avisouOuvidoVelho = true; Voz.avisar(acao === 'mais' ? 'Esse é o máximo por enquanto.' : 'Esse é o mínimo. Para parar, diga: desliga a música.'); }
    } else sinal('♪', acao === 'mais' ? 'mais alto' : 'mais baixo');
  }).catch(semOuvido);
  return true;
}
// ENTREGA DIRETA DO OUVIDO DO MAC (04/out/2026, noite) — João: "o oscar ainda tá um pouco lento para
// responder as ordens, principalmente se eu peço uma em cima da outra". Medido: cada chamado subia um
// Chrome novo (`open -n`) só para entregar a frase a esta janela (1–2 s até a ação) e o ouvido ficava
// 15–17 s surdo depois. Agora, com a janela iniciada no computador, ela deixa um pedido ESPERANDO no
// ouvido (127.0.0.1:47811/espera-chamado, só o próprio Mac); o chamado chega na resposta (milésimos) e
// a página confirma no pedido seguinte (?recebido=id). Sem ouvido (ou ouvido antigo, que responde 404),
// tenta de novo mais tarde, calada — e o ouvido segue pelo caminho antigo, que continua valendo.
const CHAMADO_MAC = 'http://127.0.0.1:47811/espera-chamado';
let esperandoChamados = false;
function esperarChamadosDoMac(aoChamado) {
  if (!NO_COMPUTADOR || esperandoChamados) return;
  esperandoChamados = true;
  let recebido = '';
  const pausar = (ms) => new Promise((ok) => setTimeout(ok, ms));
  (async () => {
    for (;;) {
      let j = null, pausa = 0;
      try {
        // 05/out/2026: a janela diz o tema dela (tema=<id>) — o ouvido entrega o chamado do nome da empresa só à janela
        // daquele tema e "Oscar…" só à do Oscarpes (as duas podem estar abertas)
        const q = [recebido ? 'recebido=' + encodeURIComponent(recebido) : '', TEMA_BUSCA].filter(Boolean).join('&');
        const r = await fetch(CHAMADO_MAC + (q ? '?' + q : ''), { method: 'POST', mode: 'cors', cache: 'no-store' });
        recebido = '';
        if (r.ok) j = await r.json(); else pausa = 60000;            // ouvido antigo (404): de novo em 1 min
      } catch (e) { recebido = ''; pausa = 10000; }                 // sem ouvido rodando: de novo em 10 s
      const ch = j && j.chamado;
      // confirma JÁ (a próxima espera leva o id) e trata o chamado depois — a confirmação não espera a ação
      if (ch && ch.id) { recebido = String(ch.id); diag('chamado direto'); setTimeout(() => aoChamado({ id: String(ch.id), pergunta: String(ch.pergunta || '').trim().slice(0, 500) }), 0); }
      if (pausa) await pausar(pausa);
    }
  })();
}
/** A pergunta foi ao agente: o ouvido traz a janela para a frente (a música não rouba a frente). */
function pedirFrenteAoMac() { if (!NO_COMPUTADOR) return; try { fetch('http://127.0.0.1:47811/frente' + (TEMA_BUSCA ? '?' + TEMA_BUSCA : ''), { method: 'POST', mode: 'cors' }).catch(() => {}); } catch (e) {} }
/** As palmas tocando (controle.js): a música do Mac abaixa enquanto durarem. */
function musicaAbaixaAte(t) { palmasAte = t; avisarFaseAoMac(faseReal || fase, true); if (t) setTimeout(() => { if (Date.now() >= palmasAte) avisarFaseAoMac(faseReal || fase, true); }, Math.max(0, t - Date.now()) + 50); }
if (NO_COMPUTADOR) {
  // 15 s (antes 30): o Mac dá a janela por fechada sem aviso por 40 s E sem microfone
  setInterval(() => { if (faseReal && faseReal !== 'fechada') avisarFaseAoMac(faseReal, true); }, 15000);
  addEventListener('pagehide', () => avisarFaseAoMac('fechada'));
  addEventListener('pageshow', (e) => { if (e.persisted) avisarFaseAoMac(fase, true); });
}

// ---------------------------------------------------------------------------
// MÚSICA AMBIENTE (03/out/2026) — João: "fica muito ruim voltar com a música?
// porque está sem música". Depois (03/out): a trilha antiga NÃO — fica só a
// estrutura, à espera da música nova: basta pôr o endereço em MUSICA_URL
// (arquivo em public/ao-vivo/, loop, ≤ 1,5 MB). Com MUSICA_URL vazio o botão ♪
// nem aparece e nada toca. Tocada baixinho em loop. Ela só começa depois do INICIAR (regra do
// navegador) e ABAIXA ATÉ ZERO enquanto o Oscarpes fala, enquanto pensa e
// enquanto a pessoa está falando a pergunta (para não atrapalhar o
// reconhecimento). Botão ♪ no alto liga/desliga, lembrado no aparelho;
// padrão LIGADA no computador e DESLIGADA no celular.
// O PREÇO, escrito: no computador o ouvido fica ligado o tempo todo esperando
// o "Oscar", com a música tocando baixo. O reconhecimento do navegador usa o
// cancelamento de eco do microfone (a música sai do mesmo aparelho, ele a
// subtrai) e o volume de espera é baixo (MUSICA_ESPERA); quando o "Oscar"
// é ouvido a música cai a zero na hora e só volta 2,5 s depois da última
// palavra. Sala barulhenta ou caixa de som externa alta: desligue no ♪.
// Sem MUSICA_URL (ou arquivo que não carrega), o botão some e nada mais muda.
// ---------------------------------------------------------------------------
const MUSICA_URL = '';                // ex.: 'musica-ambiente.m4a' — vazio = sem música (decisão do João, 03/out)
const MUSICA_ESPERA = 0.07;           // ganho em espera (0–1)
const Musica = (() => {
  const el = $('trilha-som'), bt = $('musica');
  let ctx = null, ganho = null, falhou = !MUSICA_URL;
  if (el && MUSICA_URL) el.src = MUSICA_URL;
  let ligada = (() => { try { const v = localStorage.getItem('ao-vivo-musica'); if (v === '1' || v === '0') return v === '1'; } catch (e) {} return !CELULAR() && !IOS; })();
  function selo() { if (bt) { bt.classList.toggle('on', ligada && !falhou); bt.style.display = falhou ? 'none' : ''; bt.title = ligada ? 'Música ligada (toque para desligar)' : 'Música desligada (toque para ligar)'; } }
  if (el) el.addEventListener('error', () => { falhou = true; selo(); diag('musica sem arquivo'); });
  function montar() {
    if (ctx || !el) return;
    try { const C = window.AudioContext || window.webkitAudioContext; ctx = new C(); const src = ctx.createMediaElementSource(el); ganho = ctx.createGain(); ganho.gain.value = 0; src.connect(ganho).connect(ctx.destination); }
    catch (e) { ctx = null; }
  }
  /** O volume que a música deve ter agora (0 = calada). */
  function alvo() {
    if (!ligada || falhou) return 0;
    if (fase === 'falando' || fase === 'pensando' || (typeof Voz !== 'undefined' && Voz.falando)) return 0;
    if (Date.now() - ultimaFalaOuvida < 2500) return 0;           // a pessoa está falando a pergunta
    if (typeof conversaAte !== 'undefined' && Date.now() < conversaAte && fase === 'ouvindo') return MUSICA_ESPERA * 0.35;   // conversa corrida: bem mais baixo
    return MUSICA_ESPERA;
  }
  setInterval(() => {
    if (!ctx || !ganho) return;
    const a = alvo();
    ganho.gain.setTargetAtTime(a, ctx.currentTime, a < ganho.gain.value ? 0.08 : 0.9);   // cai rápido, volta devagar
  }, 200);
  selo();
  return {
    get ligada() { return ligada; },
    alvo,
    comecar() { if (!ligada || falhou || !el) return; montar(); try { ctx && ctx.resume(); } catch (e) {} el.play().then(() => diag('musica')).catch(() => diag('musica bloqueada')); },
    alternar() {
      ligada = !ligada; try { localStorage.setItem('ao-vivo-musica', ligada ? '1' : '0'); } catch (e) {}
      selo(); if (ligada) this.comecar(); diag('musica ' + (ligada ? 'liga' : 'desliga'));
    },
  };
})();
if ($('musica')) $('musica').onclick = (e) => { e.stopPropagation(); Musica.alternar(); };

export {
  NO_COMPUTADOR, esperarChamadosDoMac, pedirFrenteAoMac, musicaTocandoNoMac, avisarFaseAoMac, comandoDaMusica, Musica, entenderMusica, musicaAbaixaAte,
};
