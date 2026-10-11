// OSCARPES AO VIVO — ouvido.js
// OUVIR E CONVERSAR: a chamada pelo nome ("Oscar"), a conversa corrida (JANELA_CONVERSA_MS), o
// reconhecimento contínuo (Ouvido), o gravador do iPhone (Gravador), a Escuta que escolhe entre os
// dois, a legenda curta, os tempos da conversa, dispensar ("obrigado"), maximizar a janela e a
// PERGUNTA (perguntar: comandos locais → servidor em fluxo → fala e janelas; [[SILENCIO]]).
// O estado da conversa corrida (conversaAte, ultimaDeVozSemNome, trechoComNome) mora aqui porque o
// ouvido e a pergunta mudam ele — um `let` importado é só leitura.
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import { Voz } from './voz.js?v=20261010213811';
import {
  $, AVISOS_DE_ESPERA, DEMO, DIAG, ESPERA_AVISO_MS, SILENCIO_FINAL_MS, SILENCIO_MS, avisarFalha, aviso, diag,
  esc, linkEntrar,
} from './base.js?v=20261010213811';
import { Esfera, fase, mudarFase } from './cena.js?v=20261010213811';
import { aquecerServidor, chamar, registrarRespostaDaPagina } from './servidor.js?v=20261010213811';
import { mostrarTelas, paineisVivos } from './telas.js?v=20261010213811';
import { comandoDaTela, normTela } from './comandos.js?v=20261010213811';
import { comandoDaMusica, musicaTocandoNoMac, pedirFrenteAoMac } from './musica.js?v=20261010213811';
import { Apresentacao, comandoDeControle, comandoSemNome, historicoDoTema } from './controle.js?v=20261010213811';
import { respostaDemo } from './demo.js?v=20261010213811';
import { comandoDeReuniao } from './porta-reuniao.js?v=20261010213811';

// ---------------------------------------------------------------------------
// OUVIDO — reconhecimento contínuo, que se religa sozinho
// ---------------------------------------------------------------------------
// iPhone/iPad: o Safari não deixa o microfone e a fala andarem juntos (a fala
// sai baixa e o reconhecimento morre calado depois). Lá a conversa é em turnos:
// pausa o ouvido enquanto fala, retoma depois; se o iPhone não deixar retomar
// sem um toque, a folha pede "toque para falar". (João, 02/out: "tem hora que
// ele me escutou e agora não escuta mais".)
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
DIAG.ios = IOS; DIAG.versao = VERSAO;
// CHAMADA PELO NOME — João, 02/out/2026, com microfone de lapela no computador:
// "ele abre só eu chamando?". No computador o ouvido fica ligado o tempo todo;
// sem isto, qualquer conversa da sala virava pergunta. Agora ele só responde
// quando a frase traz "Oscar" (ou "Oscarpes"/"Jarvis"); depois de responder,
// fica JANELA_CONVERSA_MS escutando sem precisar chamar de novo (conversa
// corrida). iPhone fica fora: lá se fala tocando na folha (já é um chamado).
const JANELA_CONVERSA_MS = 30000;   // 03/out: 20 → 30 s (João: "preciso falar Oscar toda hora")
// TEMA: "Oscar" segue valendo em todo tema; o tema SOMA o nome dele (ex.: o da empresa)
const NOMES_EXTRA = (TEMA.chamada.extras || []).map((n) => String(n).toLowerCase().replace(/[^a-z0-9 ]/g, '')).filter(Boolean);
// 06/out/2026 (palestra, risco R5: no palco o João fala "Oscarpes" — a empresa — a toda hora): "Oscar" e "Jarvis" chamam em
// qualquer lugar; "Oscarpes" só no COMEÇO da frase, e com ?palco=1 no endereço nunca (o mesmo do ouvido do Mac, OUVIDO_PALCO=1).
const PALCO = typeof location !== 'undefined' && /[?&]palco=1\b/.test(location.search);
const CHAMADA_RE = new RegExp('\\b(oscar|jarvis)\\b');
const OSCARPES_NO_COMECO_RE = PALCO ? null : /^\s*((o|ei|hey|ok|oi|ola|bom dia|boa tarde|boa noite)[\s,]+)?oscarpes\b/;
// 04/out/2026 — o NOME DO TEMA (ex.: o da empresa) só chama no COMEÇO da frase (ou depois de um
// cumprimento: "bom dia, <nome>"), nunca no meio: o nome da empresa aparece na conversa da sala
// ("a semente da <empresa> é boa") e não pode virar pergunta. Oscar/Jarvis seguem valendo em
// qualquer lugar, como sempre. Sem nome de tema (a Oscarpes), EXTRA_NO_COMECO_RE é null.
const SAUDACAO_ANTES = '((o|ei|hey|ok|oi|ola|bom dia|boa tarde|boa noite)[\\s,]+)?';
const EXTRA_NO_COMECO_RE = NOMES_EXTRA.length ? new RegExp('^\\s*' + SAUDACAO_ANTES + '(' + NOMES_EXTRA.join('|') + ')\\b') : null;
/** A frase (já normalizada) chamou pelo nome? */
function chamou(fraseNorm) { return CHAMADA_RE.test(fraseNorm) || !!(OSCARPES_NO_COMECO_RE && OSCARPES_NO_COMECO_RE.test(fraseNorm)) || !!(EXTRA_NO_COMECO_RE && EXTRA_NO_COMECO_RE.test(fraseNorm)); }
const DIZER = TEMA.chamada.dizer;          // o nome que a tela ensina a chamar ("Oscar" no padrão)
let conversaAte = 0;
function abrirConversa(ms = JANELA_CONVERSA_MS) { conversaAte = Date.now() + ms; }
/** Fecha a conversa corrida na hora ("toca mais um pouco": o Jarvis fica calado até outro "Oscar"). */
function encerrarConversa() { conversaAte = 0; ultimaDeVozSemNome = false; trechoComNome = false; }
// 03/out/2026: às 13:07 a conversa da sala ("tinha alugado ali por 5.000…") virou 6 perguntas
// seguidas — cada resposta reabria os 20 s sem "Oscar". Agora só uma resposta a uma fala COM
// "Oscar" (ou tocada/digitada) reabre a conversa corrida; fala da sala ganha no máximo uma resposta.
let ultimaDeVozSemNome = false;   // a pergunta que está sendo respondida veio da voz SEM "Oscar"
let trechoComNome = false;         // o trecho que o ouvido está juntando tem "Oscar"
// 06/out/2026 (palestra): no modo palco (?palco=1) a conversa corrida não existe — o João fala com a plateia o tempo todo; o Oscar
// só responde quando é chamado pelo nome (ou pelo botão do passador). Fora do palco, como sempre.
function exigeChamada() { return !IOS && !MODO_GRAVADOR && (PALCO || Date.now() > conversaAte); }
/** Corta tudo até o nome ("ô Oscar, vai chover?" → "vai chover?"). */
const TIRAR_RE = new RegExp('^.*?\\b([oó]scar(pes)?|jarvis)\\b[\\s,.!?:;-]*', 'i');
// 05/out/2026: o reconhecimento escreve o nome da empresa torto ("levante", "pré vant"): os apelidos do tema (tema.json) valem
// com ou sem acento e com espaço solto — o corte usa o MESMO apelido, tolerante a acento
const TIRAR_EXTRA_RE = NOMES_EXTRA.length ? new RegExp('^\\s*((o|ô|ei|hey|ok|oi|olá|ola|bom dia|boa tarde|boa noite)[\\s,]+)?(' + NOMES_EXTRA.map((n) => n.replace(/a/g, '[aáâã]').replace(/e/g, '[eéê]').replace(/ /g, '\\s*')).join('|') + ')\\b[\\s,.!?:;-]*', 'i') : null;
function tirarChamada(s) {
  const t = String(s || '');
  // 05/out/2026: o reconhecimento ouve "auto potencial" no lugar de "alto potencial"
  const r = (CHAMADA_RE.test(norm(t)) || (OSCARPES_NO_COMECO_RE && OSCARPES_NO_COMECO_RE.test(norm(t))) ? t.replace(TIRAR_RE, '') : (TIRAR_EXTRA_RE ? t.replace(TIRAR_EXTRA_RE, '') : t)).replace(/\bauto (potencial|investimento)\b/gi, 'alto $1');
  if (r.trim()) return r;
  // "bom dia, Oscar" / "bom dia, <nome do tema>": a pergunta É o cumprimento (o servidor responde o bom dia)
  const g = norm(t).match(/^(bom dia|boa tarde|boa noite)\b/);
  return g ? g[1] : r;
}
/** Só o nome do COMEÇO ("Jarvis, aumenta a música" → "aumenta a música"; "obrigado Oscar" fica). */
const NOME_NO_COMECO_RE = new RegExp('^\\s*((o|ô|ei|hey|ok)[\\s,]+)?([oó]scar(pes)?|jarvis' + NOMES_EXTRA.map((n) => '|' + n).join('') + ')\\b[\\s,.!?:;-]*', 'i');
function semNomeNoComeco(s) { return String(s || '').replace(NOME_NO_COMECO_RE, ''); }
let ultimaFalaOuvida = 0;             // a pessoa está falando a pergunta (marcado pelo ouvido; a música ambiente lê)
const Ouvido = (() => {
  const C = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, ligado = false, pausado = false, ativo = false, buffer = '', timer = null, aoFrase = null, falhas = 0, ultimoInicio = 0;
  function novo() {
    // iPhone: uma frase por vez (o modo contínuo do Safari morre calado); no resto, contínuo
    const r = new C(); r.lang = 'pt-BR'; r.continuous = !IOS; r.interimResults = true;
    r.onstart = () => { ativo = true; falhas = 0; diag('ouvindo'); if (fase === 'toque' || fase === 'espera') mudarFase('ouvindo'); };
    r.onaudiostart = () => diag('audio');
    r.onresult = (ev) => {
      // desligado/pausado: o stop() ainda entrega o último pedaço — não vira pergunta
      if (!ligado || pausado) return;
      let interino = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const txt = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) buffer = (buffer + ' ' + txt).trim(); else interino += txt;
      }
      let ouvido = (buffer + ' ' + interino).trim();
      if (!ouvido) return;
      // ouviu o nome (ou a conversa corrida está aberta): a pergunta vem aí — aquece o servidor já
      if (!Voz.falando && (!exigeChamada() || chamou(norm(ouvido)))) aquecerServidor('ouviu');
      // sem chamar pelo nome (e fora da conversa corrida): é conversa da sala — ignora
      if (!Voz.falando && exigeChamada()) {
        if (!chamou(norm(ouvido))) {
          // MODO APRESENTAÇÃO (04/out/2026): comando CURTO da tela vale sem o nome ("próximo assunto",
          // "aumenta a música", "volta aquela"); pergunta e conversa da sala seguem ignoradas
          if (!interino && Apresentacao.ativa && comandoSemNome(ouvido)) { buffer = ''; diag('comando sem nome'); perguntar(ouvido); return; }
          // João, 02/out/2026: "o jarvis ainda não me ouve" — ouvia, mas ignorava
          // calado (faltou o "Oscar"). Mostra o que ouviu e o porquê de não responder.
          if (!interino) { buffer = ''; legenda(`<span class="voce">${esc(finalDe(ouvido, 70))}</span><br><small style="opacity:.7">Para eu responder, comece com “${DIZER}…”</small>`); }
          return;
        }
        abrirConversa();
        diag('chamado');
      }
      if (!Voz.falando && chamou(norm(ouvido))) trechoComNome = true;
      if (!Voz.falando && chamou(norm(buffer))) buffer = tirarChamada(buffer).trim();
      if (!Voz.falando) { ouvido = tirarChamada(ouvido).trim() || 'Pode falar.'; }
      // fala por cima da resposta (fora do iPhone): se não é o eco do que estou falando, paro e escuto
      if (Voz.falando && !ehEco(ouvido)) { Voz.parar(); mudarFase('ouvindo'); }
      if (Voz.falando) return;
      Esfera.pulso(0.25);
      ultimaFalaOuvida = Date.now();          // a música abaixa enquanto a pessoa fala a pergunta
      legenda(`<span class="voce">${esc(finalDe(ouvido))}</span>`);
      clearTimeout(timer);
      // 02/out/2026: quando o próprio reconhecedor já FECHOU a frase (final, sem
      // nada pendente), não precisa esperar o silêncio inteiro — ganha ~0,7 s.
      const espera = interino ? SILENCIO_MS : SILENCIO_FINAL_MS;
      timer = setTimeout(() => { const f = buffer.trim(); buffer = ''; if (f && aoFrase) { ultimaDeVozSemNome = !trechoComNome && !IOS; trechoComNome = false; marcarFimDaFala(espera); aoFrase(f); } }, espera);
    };
    r.onend = () => {
      ativo = false; diag('fim');
      // iPhone: a frase acabou → manda já o que ouviu (não espera o silêncio)
      if (IOS && buffer.trim() && !pausado) { clearTimeout(timer); const f = buffer.trim(); buffer = ''; if (aoFrase) { marcarFimDaFala(0); aoFrase(f); } return; }
      if (ligado && !pausado) setTimeout(tentar, 250);
    };
    r.onerror = (e) => {
      if (e.error === 'aborted' || e.error === 'no-speech') diag('erro ' + e.error);
      else avisarFalha('ouvido erro ' + e.error);
      if (e.error === 'service-not-allowed' && Gravador.possivel && !MODO_GRAVADOR) { MODO_GRAVADOR = true; ligado = false; diag('passou ao gravador'); mudarFase('toque'); return; }
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        // no iPhone isto é o "precisa de um toque": não desliga, pede o toque
        if (Date.now() - ultimoInicio < 1500 && !IOS) { ligado = false; aviso('O navegador não deixou usar o microfone. Libere o microfone para este site e toque no botão de novo.'); atualizarMic(); if (fase === 'ouvindo') mudarFase('espera'); }
        else pedirToque();
      }
    };
    return r;
  }
  function pedirToque() { ativo = false; if (fase !== 'falando' && fase !== 'pensando') mudarFase('toque'); }
  function tentar() {
    if (!ligado || pausado || ativo) return;
    rec = rec || novo(); ultimoInicio = Date.now();
    try { rec.start(); diag('start'); } catch (e) { falhas++; diag('start recusado'); if (falhas > 2) { avisarFalha('ouvido nao religa'); pedirToque(); } }
  }
  // vigia: se o reconhecimento morreu calado, tenta religar; não conseguindo, pede o toque
  setInterval(() => {
    if (!ligado || pausado || ativo || fase === 'falando' || fase === 'pensando') return;
    if (Date.now() - ultimoInicio > 2500) { if (falhas > 2) pedirToque(); else tentar(); }
  }, 1500);
  function ehEco(ouvido) {
    const a = norm(ouvido), b = norm(Voz.texto);
    if (!b || a.length < 4) return true;
    const palavras = a.split(' ').filter((p) => p.length > 2);
    const iguais = palavras.filter((p) => b.includes(p)).length;
    return palavras.length < 3 || iguais / palavras.length > 0.6;
  }
  return {
    disponivel: !!C,
    get ligado() { return ligado; },
    get ativo() { return ativo; },
    ligar(cb) { if (!C) return false; aoFrase = cb || aoFrase; ligado = true; pausado = false; buffer = ''; falhas = 0; tentar(); return true; },
    desligar() { ligado = false; pausado = false; clearTimeout(timer); buffer = ''; try { rec && rec.abort(); } catch (e) {} },
    pausar() { pausado = true; clearTimeout(timer); buffer = ''; try { rec && rec.abort(); } catch (e) {} ativo = false; },
    retomar() { pausado = false; falhas = 0; setTimeout(tentar, 300); },
  };
})();
// ---------------------------------------------------------------------------
// GRAVADOR — a fala vira áudio e o SERVIDOR transcreve (Whisper, o mesmo dos
// áudios do zap). 02/out/2026: o diagnóstico do João mostrou que ele usa o
// CHROME do iPhone ("CriOS"), e lá todo reconhecimento de voz do navegador
// volta "service-not-allowed". Gravar funciona em qualquer navegador. Usado
// sempre no iPhone e quando o navegador não tem reconhecimento.
// Percebe sozinho quando a pessoa começa e para de falar (volume acima do
// ruído de fundo; 1,2 s de silêncio fecha a frase).
// ---------------------------------------------------------------------------
const Gravador = (() => {
  let stream = null, ctxG = null, an = null, rec = null, partes = [], ligado = false, pausado = false, gravando = false;
  let falou = false, inicioFala = 0, ultimaVoz = 0, t0 = 0, piso = 0.01, aoAudio = null, buf = null;
  const possivel = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  function tipo() {
    for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (e) {} }
    return '';
  }
  function comecar() {
    if (!ligado || pausado || !stream) return;
    if (gravando) { setTimeout(comecar, 200); return; }   // o stop anterior ainda não terminou
    const mime = tipo();
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {}); } catch (e) { diag('gravador falhou'); return; }
    partes = []; falou = false; t0 = performance.now();
    rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
    rec.onstop = async () => {
      gravando = false;
      const durou = falou ? ultimaVoz - inicioFala : 0;
      if (falou && durou > 350 && partes.length && aoAudio) {
        const blob = new Blob(partes, { type: rec.mimeType || mime || 'audio/webm' });
        const b64 = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(blob); });
        diag(`audio ${Math.round(blob.size / 1024)}kb`); marcarFimDaFala(1200);
        aoAudio(b64, blob.type);
      } else if (ligado && !pausado) comecar();
    };
    rec.start(250); gravando = true;
    if (fase !== 'falando' && fase !== 'pensando') mudarFase('ouvindo');
  }
  function nivel() {
    if (!an || !buf) return 0;
    an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }
  setInterval(() => {
    if (!gravando) return;
    const n = nivel(), agora = performance.now();
    if (!falou) piso = piso * 0.95 + Math.min(n, 0.05) * 0.05;          // ruído de fundo
    const limiar = Math.max(0.015, piso * 3.2);
    if (n > limiar) { if (!falou) { falou = true; inicioFala = agora; } ultimaVoz = agora; Esfera.pulso(Math.min(0.5, n * 4)); }
    if (falou && agora - ultimaVoz > 1200) { try { rec.stop(); } catch (e) {} }
    else if (!falou && agora - t0 > 20000) { try { rec.stop(); } catch (e) {} }            // ninguém falou: recomeça
    else if (agora - t0 > 45000) { try { rec.stop(); } catch (e) {} }                       // teto de uma fala
  }, 60);
  const api = {
    possivel,
    get ligado() { return ligado; },
    async ligar(cb) {
      const jaGravando = ligado && !pausado && gravando;
      aoAudio = cb || aoAudio; ligado = true; pausado = false;
      await abrirMicrofone();
      if (jaGravando) return;          // tocar de novo na folha não abre um 2º gravador
      // NUNCA esperar o resume (02/out/2026, João: "se eu pauso o microfone ele não
      // volta mais"): no iPhone a promessa do resume às vezes não termina e a
      // gravação nunca recomeçava. A gravação não depende dele (só o medidor de volume).
      try { ctxG && ctxG.resume().catch(() => {}); } catch (e) {}
      diag('religou');
      comecar();
    },
    // FALANDO = MICROFONE FECHADO (02/out/2026, "no Safari também o áudio tá
    // falhando"; o diagnóstico mostrou a voz gerada em 0,4 s — não era a geração).
    // Com o microfone aberto o iPhone toca no modo "ligação" (som baixo e picotado).
    // Enquanto o Oscarpes fala, o microfone é LARGADO; depois, pego de novo.
    pausar() { pausado = true; if (gravando) { falou = false; try { rec.stop(); } catch (e) {} } fecharMicrofone(); },
    async retomar() {
      if (!ligado) return;            // a pessoa desligou o microfone: não reabre sozinho
      pausado = false;
      try { await abrirMicrofone(); } catch (e) { avisarFalha('reabrir microfone falhou ' + String(e && e.name || e).slice(0, 30)); mudarFase('toque'); return; }
      setTimeout(comecar, 300);
    },
    desligar() { ligado = false; this.pausar(); },
  };
  async function abrirMicrofone() {
    if (stream) return;
    {
        diag('abre microfone');
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        ctxG = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctxG.createMediaStreamSource(stream); an = ctxG.createAnalyser(); an.fftSize = 1024; src.connect(an);
        buf = new Float32Array(an.fftSize); diag('microfone ok');
    }
  }
  function fecharMicrofone() {
    if (!IOS) return;          // fora do iPhone o som não degrada: o microfone fica
    try { stream && stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
    try { ctxG && ctxG.close(); } catch (e) {}
    stream = null; ctxG = null; an = null;
  }
  return api;
})();
// iPhone (Chrome e Safari) e navegador sem reconhecimento: grava e o servidor transcreve
let MODO_GRAVADOR = Gravador.possivel && (IOS || !(window.SpeechRecognition || window.webkitSpeechRecognition));
const Escuta = {
  get ligado() { return MODO_GRAVADOR ? Gravador.ligado : Ouvido.ligado; },
  async ligar() {
    if (MODO_GRAVADOR) {
      try { await Gravador.ligar(perguntarAudio); return true; }
      catch (e) { avisarFalha('microfone negado ' + String(e && e.name || e).slice(0, 30)); aviso('O celular não deixou usar o microfone. Libere o microfone para este site nos ajustes do navegador e toque no microfone de novo.'); return false; }
    }
    return Ouvido.ligar(perguntar);
  },
  // CONVERSA EM TURNOS EM TODO NAVEGADOR (02/out/2026, "no Safari roda bem mas
  // no Chrome continua com problema"). Só o iPhone pausava o ouvido enquanto o
  // Oscarpes falava; no Chrome o reconhecimento seguia ligado, ouvia a PRÓPRIA
  // voz saindo da caixa de som, e quando a transcrição do eco não batia com o
  // texto (ehEco) achava que era a pessoa falando por cima: cortava a fala no
  // meio ("a voz tá falhando") e mandava o eco como pergunta. No Android, cada
  // religada do reconhecimento ainda toma o som (bipe) no meio da fala.
  // Agora é como no Safari, que "roda bem": fala → ouvido pausado → volta.
  // Interromper continua: tocar na folha ou no microfone.
  pausar() { MODO_GRAVADOR ? Gravador.pausar() : Ouvido.pausar(); },
  retomar() { MODO_GRAVADOR ? Gravador.retomar() : (Ouvido.ligado && Ouvido.retomar()); },
  desligar() { MODO_GRAVADOR ? Gravador.desligar() : Ouvido.desligar(); },
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// LEGENDA CURTA QUE SOME (02/out/2026, João na TV: "a legenda ocupou quase a
// tela toda"): faixa baixa de no máximo 2 linhas (CSS). Enquanto a voz fala ela
// fica; acabou a fala, some em LEGENDA_SOME_MS; o que a pessoa disse some sozinho
// em LEGENDA_OUVIDO_MS se nada novo chegar.
let relogioLegenda = null;           // a legenda some sozinha (ver legenda())
const LEGENDA_SOME_MS = 3500, LEGENDA_OUVIDO_MS = 9000;
function legenda(html) {
  const l = $('legenda'); l.innerHTML = html ? `<span class="txt">${html}</span>` : ''; l.classList.toggle('on', !!html);
  clearTimeout(relogioLegenda);
  if (html && fase !== 'falando') relogioLegenda = setTimeout(() => l.classList.remove('on'), LEGENDA_OUVIDO_MS);
}
/** Fala comprida da pessoa: a legenda (2 linhas) mostra o FIM, as palavras mais novas. */
function finalDe(s, n = 110) { s = String(s || ''); return s.length > n ? '…' + s.slice(-n) : s; }
function legendaSome(ms = LEGENDA_SOME_MS) { clearTimeout(relogioLegenda); relogioLegenda = setTimeout(() => $('legenda').classList.remove('on'), ms); }
function atualizarMic() { $('mic').classList.toggle('ativo', Escuta.ligado); }

// ---------------------------------------------------------------------------
// PERGUNTAR
// ---------------------------------------------------------------------------
// TEMPOS DA CONVERSA (02/out/2026): medidos aqui e mandados no diagnóstico da
// pergunta seguinte — fim da fala → envio, servidor, e quando a voz começou.
let fimFalaPendente = 0;                       // quando a pessoa parou de falar (a pergunta ainda vai sair)
let tempo = { fimFala: 0, envio: 0, resposta: 0, voz: 0, aviso: false };   // a pergunta em curso
function marcarFimDaFala(atrasoMs) { fimFalaPendente = performance.now() - (atrasoMs || 0); }
function marcarVozComecou() { if (!tempo.voz && tempo.envio) tempo.voz = performance.now(); }
function fecharTempos(t) {
  if (!t.envio) return;
  const ms = (a, b) => (a && b ? Math.round(b - a) : null);
  DIAG.tempos = { fala_ate_envio: ms(t.fimFala, t.envio), servidor: ms(t.envio, t.resposta), ate_voz: ms(t.fimFala, t.voz), aviso: t.aviso };
  diag(`tempos ${JSON.stringify(DIAG.tempos).replace(/"/g, '')}`);
}
let ixAviso = 0;

let ocupado = false;
async function perguntarAudio(b64, mime) {
  if (ocupado || !b64) { Escuta.retomar(); return; }
  Escuta.pausar();
  return perguntar('', { audio: b64, mime });
}
// DISPENSAR (03/out/2026, João): "tem que ter algo que eu fale que ele desligue, e só volte
// quando eu chamar de novo — às vezes fico conversando com alguém do lado e ele fica tentando
// me atender". "Obrigado / pode descansar / só isso / silêncio…" fecha a conversa corrida na hora.
const DISPENSA_RE = /^(oscar )?(ok |ta |tá |beleza |certo )?(obrigad[oa]|valeu|pode descansar|descansa|dispensado|so isso|só isso|era so isso|era isso|ate logo|até logo|ate mais|até mais|silencio|silêncio|fica quieto|para de ouvir|pode parar|desliga|chega por agora|depois te chamo|tchau)( oscar)?( obrigad[oa])?$/;
function dispensar(frase) {
  const f = normTela(frase);
  if (!f || f.split(' ').length > 6 || !DISPENSA_RE.test(f)) return false;
  conversaAte = 0; ultimaDeVozSemNome = false; trechoComNome = false;
  diag('dispensado');
  legenda(`<span class="voce">Em espera.</span><br><small style="opacity:.7">Diga “${DIZER}…” quando precisar.</small>`);
  // 06/out/2026 (João: "conversar como se tivesse falando com minha esposa"): sem o "senhor" do mordomo; o tema pode dizer do
  // jeito dele (tema.json falas.dispensa)
  Voz.avisar((TEMA.falas && typeof TEMA.falas.dispensa === 'string' && TEMA.falas.dispensa) || 'Tá bom. Qualquer coisa, me chama.');
  legendaSome(4000);
  return true;
}
// MAXIMIZAR (03/out/2026, João): "o app estava fechado, quando falei Oscar ele abriu, porém com a
// tela que não estava maximizada; pedi pra maximizar e ele não conseguiu — ou atende esse comando,
// ou já abre maximizado". No app instalado (janela própria) o Chrome deixa a página mover e
// redimensionar a janela; numa aba comum não deixa (aí só a tela cheia, que pede um clique).
const APP_INSTALADO = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches;
function maximizarJanela() {
  try {
    const l = screen.availLeft || 0, tp = screen.availTop || 0;
    window.moveTo(l, tp); window.resizeTo(screen.availWidth, screen.availHeight);
  } catch (e) {}
  diag('maximiza ' + window.outerWidth + 'x' + window.outerHeight);
  return window.outerWidth >= screen.availWidth * 0.9 && window.outerHeight >= screen.availHeight * 0.85;
}
if (APP_INSTALADO && !IOS && !/Android/i.test(navigator.userAgent) && (window.outerWidth < screen.availWidth * 0.9 || window.outerHeight < screen.availHeight * 0.85)) {
  setTimeout(maximizarJanela, 150);
}
const MAXIMIZA_RE = /\b(maximiz\w*|tela inteira|janela (inteira|grande|maior|cheia)|aumenta(r)? a (janela|tela)|ocupa(r)? a tela toda|tela toda)\b/;
function comandoDeJanela(frase) {
  const f = normTela(frase);
  if (f.split(' ').length > 8) return false;
  // "tela cheia" com um mapa aberto é o visor do mapa; sem mapa, é a janela
  const temMapa = paineisVivos.some((el) => el.dataset.tipo === 'imagem');
  if (!(MAXIMIZA_RE.test(f) || (/\btela cheia\b/.test(f) && !temMapa))) return false;
  const ok = maximizarJanela();
  if (!ok) { try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {} }
  legenda('<span class="voce">' + esc(frase) + '</span>'); legendaSome(1500);
  if (!ok && !document.fullscreenElement) aviso(`Para maximizar sozinho, abra pelo ícone do ${TEMA.titulo} (app instalado). Aqui, clique no ⤢ do navegador.`);
  return true;
}
// ORDENS DO MAC EM SEQUÊNCIA (04/out/2026, noite — "principalmente se eu peço uma em cima da outra").
// O comando local (música, palmas, "volta aquela", janelas…) é feito NA HORA, antes de tudo, sem calar a
// voz e sem esperar a pergunta anterior. Pergunta nova enquanto a anterior ainda está no agente: entra
// na fila (a mais nova vale) e sai quando a resposta de agora terminar de ser falada — antes ela era
// jogada fora (receberChamado tinha "if (ocupado) return" ANTES de olhar se era comando).
let filaDoMac = '', relogioFila = null;
function soltarFilaDoMac() {
  if (!filaDoMac) return;
  clearInterval(relogioFila);
  relogioFila = setInterval(() => {
    if (!filaDoMac) { clearInterval(relogioFila); return; }
    if (ocupado || Voz.falando) return;
    const p = filaDoMac; filaDoMac = ''; clearInterval(relogioFila);
    diag('chamado da fila');
    perguntar(p, undefined, { doMac: true });
  }, 150);
}
// <falaParaAPlateia> (função pura — o portão e a bateria de conversa rodam ela)
// 06/out/2026 (dueto de palco — João: "uma apresentação comigo de duas horas, apresentando comigo muito naturalmente"): na
// conversa corrida (fala SEM "Oscar" logo depois de uma resposta), o João falando com a PLATEIA não vai ao servidor — medido na
// bateria: o modelo calava em metade das vezes e completava o comentário dele na outra metade (falando por cima). Só fala que
// é claramente para a sala: chama a plateia ("gente", "pessoal"), aponta ("repara", "olha", "vejam"), tira lição ("isso é o tipo
// de coisa…"), "alguém tem pergunta?", ou termina em "né?"/"viu?" — e não pede nada ao Oscar.
function falaParaAPlateia(frase) {
  const t = String(frase || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  const pedeAoOscar = /^(e )?(me |nos )?(mostra|mostre|abre|abra|fala|diz|conta|explica|traz|traga|volta|fecha|quanto|quantos|quantas|qual|quais|como|onde|quando|por que|porque|o que|quem|e o|e a|e no|e na|e em|e se)\b|\b(voce|oscar)\b/.test(t);
  if (pedeAoOscar) return false;
  return /\b(gente|pessoal|turma|galera|senhores|senhoras)\b/.test(t) || /^(repara|reparem|olha|olhem|vejam|veja so|percebe|percebam|notem)\b/.test(t) ||
    /^isso (e|aqui e) (o tipo de|importante|o que|muito|fundamental|exatamente)\b/.test(t) || /\balguem (tem|quer|ai)\b/.test(t) || /\b(ne|viu)$/.test(t);
}
// </falaParaAPlateia>
// <ecoDaVoz> (função pura — o portão roda ela)
/** O ouvido do Mac ouviu a PRÓPRIA voz do Oscar (a resposta saindo na caixa com "Oscarpes" no meio): não é ordem. */
function ecoDaVoz(frase, falando, textoFalado) {
  if (!falando) return false;
  const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const a = n(frase).split(' ').filter((p) => p.length > 2), b = n(textoFalado);
  if (a.length < 3 || !b) return false;                 // "para", "próxima música": curtas demais para serem eco
  return a.filter((p) => b.includes(p)).length / a.length >= 0.6;
}
// </ecoDaVoz>
async function perguntar(texto, audio, opcoes = {}) {
  // os comandos locais leem a frase sem o nome do começo ("Jarvis, volta aquela"); o agente recebe ela inteira
  const pedido = semNomeNoComeco(texto);
  if (!audio && comandoDaMusica(pedido)) return;
  // MÓDULO DE TEMA (03/out/2026): um tema com "modulos" (ver main.js, window.AO_VIVO) pode resolver
  // a frase antes do resto do motor — ex.: um playbook de vendas. Sem módulo de tema, isto não existe.
  // a vista que o tema abriu entra no histórico das telas ("volta aquela" traz ela de novo)
  // 05/out/2026: o que a página responde SOZINHA também vai ao log (registrarRespostaDaPagina) — 1,5 s depois, com o que ela falou
  // a resposta que a página falou: a que o tema avisou (evento) ou a última fala da voz — e NUNCA vazio sem dizer o porquê
  const registrar = (acao) => { const t0 = Voz.ultimaFala, ev0 = window.__ultimaRespostaDaPagina; setTimeout(() => { const r = window.__ultimaRespostaDaPagina !== ev0 ? window.__ultimaRespostaDaPagina : Voz.ultimaFala !== t0 ? Voz.ultimaFala : '(a página agiu na tela sem falar)'; registrarRespostaDaPagina(texto, acao, r); }, 1500); };
  const depoisDoTema = historicoDoTema(() => window.AO_VIVO_FRASE(String(texto || '')), texto);
  if (!audio && !opcoes.semComando && typeof window.AO_VIVO_FRASE === 'function' && window.AO_VIVO_FRASE(String(texto || ''))) { depoisDoTema(); registrar('tema'); return; }
  // REUNIÃO (06/out/2026): "Oscar, chama o Ararê e a Tainá para uma reunião" — a porta (porta-reuniao.js) carrega a reunião só agora
  if (!audio && !opcoes.semComando && comandoDeReuniao(pedido, opcoes)) { registrar('reuniao'); return; }
  // COMANDOS DE APRESENTAÇÃO (04/out/2026): palmas, repete/para/continua, ritmo da voz, histórico das
  // telas ("volta aquela", "a do mapa", "mostra as últimas") e o modo apresentação — sem servidor
  if (!audio && !opcoes.semComando && comandoDeControle(pedido)) { registrar('controle'); return; }
  if (!audio && dispensar(pedido)) return;
  if (!audio && comandoDeJanela(pedido)) { abrirConversa(); return; }
  // comando da tela ("amplia o mapa", "volta", "mostra a segunda janela"…): resolve aqui, sem servidor
  if (!audio && !opcoes.semComando && comandoDaTela(pedido)) { registrar('tela'); return; }
  // 06/out/2026: na conversa corrida, a fala do João para a plateia fica na sala (falaParaAPlateia) — o Oscar não fala por cima
  if (!audio && ultimaDeVozSemNome && falaParaAPlateia(pedido)) { diag('fala para a plateia: fico quieto'); ultimaDeVozSemNome = false; return; }
  if (opcoes.doMac && String(texto || '').trim()) {
    if (ocupado) { filaDoMac = texto; diag('chamado na fila'); return; }
    Voz.parar();                                // pergunta nova por cima da resposta falada: a nova vale
    if (opcoes.direto) pedirFrenteAoMac();     // veio direto (sem o `open`): a janela vem para a frente
  }
  if (ocupado || (!audio && !String(texto).trim())) return;
  ocupado = true; mudarFase('pensando');
  // ouvido fechado enquanto pensa e fala (turnos): o aviso de espera não pode
  // voltar como pergunta
  if (!audio) Escuta.pausar();
  legenda(audio ? '<span class="voce">…</span>' : `<span class="voce">${esc(texto)}</span>`);
  const agora = performance.now();
  tempo = { fimFala: fimFalaPendente || agora, envio: agora, resposta: 0, voz: 0, aviso: false };
  fimFalaPendente = 0;
  const tq = tempo;
  let fimDoAviso = null;
  const semNome = ultimaDeVozSemNome;
  const relogioAviso = AVISOS_DE_ESPERA.length && !semNome && !musicaTocandoNoMac() ? setTimeout(() => {
    if (!ocupado || fase !== 'pensando') return;
    tq.aviso = true; marcarVozComecou();
    fimDoAviso = Voz.avisar(AVISOS_DE_ESPERA[ixAviso++ % AVISOS_DE_ESPERA.length]);
  }, ESPERA_AVISO_MS) : null;
  // RESPOSTA EM FLUXO (03/out/2026, rapidez — João: "como está seu trabalho para diminuir o tempo
  // de resposta do ao vivo?"): o servidor manda a resposta AOS PEDAÇOS. Os painéis abrem assim que
  // as consultas acabam; cada frase pronta já começa a ser falada (a 1ª costuma ser "Abrindo o
  // dossiê…", escrita ANTES da consulta). No "fim" vem o que falta falar. Eventos tratados em fila.
  let vozFluxo = null, legendaFluxo = '';
  let cadeia = Promise.resolve();
  const tratarEvento = async (ev) => {
    if (ev.tipo === 'ouvido' && ev.texto) { legenda(`<span class="voce">${esc(ev.texto)}</span>`); return; }
    if (ev.tipo === 'telas' && (ev.telas || []).length) { mostrarTelas(ev.telas); diag('telas antes da resposta'); return; }
    if (ev.tipo === 'fala' && ev.texto) {
      const frase = String(ev.texto).replace(/[*_~`#]/g, '').trim();
      if (!frase) return;
      if (!vozFluxo) {
        clearTimeout(relogioAviso);
        if (!tq.resposta) tq.resposta = performance.now();
        if (fimDoAviso) await fimDoAviso;      // a 1ª frase espera o "um instante" acabar
        Escuta.pausar(); mudarFase('falando'); aviso('');
        vozFluxo = Voz.fluxo(aoAcabarDeFalar);
      }
      legendaFluxo = (legendaFluxo + ' ' + frase).trim(); legenda(esc(legendaFluxo));
      vozFluxo.mais(frase);
    }
  };
  const aoEvento = (ev) => { cadeia = cadeia.then(() => tratarEvento(ev)).catch((e) => console.log('[ao-vivo] evento', e)); };
  try {
    const r = DEMO ? await respostaDemo(texto || 'chuva') : await chamar(texto, audio, aoEvento);
    await cadeia;                              // os pedaços que chegaram antes do fim já foram tratados
    clearTimeout(relogioAviso); if (!tq.resposta) tq.resposta = performance.now();
    if (fimDoAviso) await fimDoAviso;          // a resposta espera o "um instante" acabar
    if (r.ouvido) legenda(`<span class="voce">${esc(r.ouvido)}</span>`);
    if (audio && r.erro && /entendi|ouvi/.test(r.erro)) { legenda('<span class="voce">Não entendi — pode repetir.</span>'); mudarFase('ouvindo'); Escuta.retomar(); return; }
    if (r.erro) { if (vozFluxo) Voz.parar(); aviso(esc(r.erro) + (r.login ? ' <a href="' + linkEntrar() + '">Entrar no app</a>' : '')); mudarFase(Escuta.ligado ? 'ouvindo' : 'espera'); Escuta.retomar(); return; }
    aviso('');
    // conversa de lado (o agente respondeu [[SILENCIO]]): nada de fala nem janela, e a conversa corrida fecha
    if (r.silencio || /^\[\[SILENCIO\]\]$/.test(String(r.texto || '').trim())) {
      if (vozFluxo) Voz.parar();
      // 05/out/2026: silêncio COM tela ("a próxima" no mapa, resolvido no servidor) — a PÁGINA anda e fala a ficha; a conversa segue
      if ((r.telas || []).length) { diag('silencio com tela: a tela fala'); mostrarTelas(r.telas); Escuta.retomar(); return; }
      conversaAte = 0; ultimaDeVozSemNome = false; diag('silencio: não era comigo');
      legenda(`<small style="opacity:.7">Parece que não era comigo. Diga “${DIZER}…” quando precisar.</small>`); legendaSome(3000);
      mudarFase(Escuta.ligado ? 'ouvindo' : 'espera'); Escuta.retomar(); return;
    }
    // 04/out/2026 — o ESCOPO da conversa (ex.: a revenda ativa da carteira) vai para o módulo do tema,
    // que mostra o selo/a logo; sem módulo de tema, ninguém escuta e nada muda
    if ('escopo' in r) { try { window.dispatchEvent(new CustomEvent('aovivo-escopo', { detail: r.escopo })); } catch (e) { /* conforto */ } }
    // as janelas trocam junto com a pergunta (as velhas viram bolinhas, as novas se formam)
    if ((r.telas || []).length) mostrarTelas(r.telas);
    const fala = String(r.texto || '').replace(/[*_~`#]/g, '').trim();
    // 06/out/2026 (madrugada): a resposta do AGENTE vai ao módulo do tema — o assunto da conversa (ex.: o híbrido e a cidade
    // que ele acabou de falar) é o que o "abre no mapa" / "sim, pode abrir" seguinte usa. Sem módulo de tema, ninguém escuta.
    try { window.dispatchEvent(new CustomEvent('aovivo-resposta-do-agente', { detail: { pergunta: String(texto || ''), resposta: fala } })); } catch (e) { /* conforto */ }
    if (vozFluxo) {
      // já está falando: só o que falta; se o texto final mudou (guarda/conserto), recomeça com ele
      if (r.corrigir) { diag('fluxo corrigido'); Voz.parar(); legenda(esc(fala)); if (fala) falarEmTurno(fala); else aoAcabarDeFalar(); }
      else {
        const resto = String(r.restante || '').replace(/[*_~`#]/g, '').trim();
        if (resto) { legendaFluxo = (legendaFluxo + ' ' + resto).trim(); legenda(esc(legendaFluxo)); vozFluxo.mais(resto); }
        vozFluxo.fim();
      }
      return;
    }
    legenda(esc(fala));
    if (fala) { falarEmTurno(fala); }
    else { mudarFase(Escuta.ligado ? 'ouvindo' : 'espera'); Escuta.retomar(); }
  } finally { clearTimeout(relogioAviso); ocupado = false; soltarFilaDoMac(); setTimeout(() => fecharTempos(tq), 5000); }
}
/** Quando a voz acaba (inteira ou em fluxo): a conversa corrida reabre e o microfone volta. */
function aoAcabarDeFalar() { abrirConversa(); ultimaDeVozSemNome = false; legendaSome(); mudarFase(Escuta.ligado ? 'ouvindo' : 'espera'); Escuta.retomar(); }
addEventListener('aovivo-resposta-da-pagina', (e) => { window.__ultimaRespostaDaPagina = String((e.detail && e.detail.resposta) || ''); });
function falarEmTurno(fala) {
  Escuta.pausar();
  mudarFase('falando');
  // 03/out/2026 (João): "funcionou, mas por um lado ficou pior, agora preciso falar Oscar toda hora".
  // Com o filtro [[SILENCIO]] no servidor (conversa de lado não ganha resposta), toda resposta DE
  // VERDADE reabre a conversa corrida — o papo segue sem repetir o nome; a conversa da sala recebe
  // silêncio e fecha a janela; "obrigado / pode descansar" fecha na hora.
  Voz.falar(fala, () => { abrirConversa(); ultimaDeVozSemNome = false; legendaSome(); mudarFase(Escuta.ligado ? 'ouvindo' : 'espera'); Escuta.retomar(); });
}

export {
  IOS, conversaAte, abrirConversa, encerrarConversa, semNomeNoComeco, ultimaDeVozSemNome, ultimaFalaOuvida, Ouvido, MODO_GRAVADOR, Escuta, norm,
  relogioLegenda, legenda, legendaSome, atualizarMic, marcarVozComecou, ocupado, perguntar, falarEmTurno, tirarChamada, aoAcabarDeFalar,
  ecoDaVoz,
};
