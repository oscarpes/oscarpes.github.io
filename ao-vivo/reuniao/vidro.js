// OSCARPES AO VIVO — reuniao/vidro.js
// FUNDO DE VIDRO (06/out/2026, João: "como a reunião holográfica dos Vingadores"): cada pessoa aparece SEM o fundo,
// flutuando num painel de vidro das nossas telas.
//
// COMO (e por quê assim):
//  • O RECORTE é feito no aparelho de QUEM MANDA a câmera (MediaPipe Image Segmenter, modelo selfie_segmenter —
//    Apache-2.0 —, WASM com GPU), só quando a câmera liga numa reunião: quem não usa reunião não baixa nada disto.
//  • Vídeo de WebRTC não leva transparência. Então quem manda PINTA O FUNDO DE VERDE-CHAVE (#00ff00) e quem recebe
//    tira o verde num canvas, por cima do vidro do ladrilho ("chroma key"). Escolhido em vez de mandar a máscara numa
//    2ª faixa porque não muda nada na ligação (os 3 lugares reservados de cada convidado ficam iguais) e não tem como
//    a máscara chegar fora de compasso com a imagem.
//  • Quem recebe só tira o verde de quem AVISOU que está com o fundo de vidro (o aviso vai pelo canal de dados, ver
//    sala.js): uma camisa verde de quem está sem vidro não some.
//  • APARELHO LENTO: se o recorte passar de LIMITE_MS por quadro em média, desliga sozinho e manda o vídeo normal
//    (estado "lento"). Navegador sem MediaStreamTrackProcessor (Safari/Firefox): vídeo normal ("indisponivel").
//  • O verde só existe no fio: na tela de todo mundo (inclusive a própria) o fundo é o vidro.
// Sem DOM do painel aqui: reuniao.js põe o canvas (telaRecortada) no ladrilho.

const PARAMS = new URLSearchParams(location.search);
const VERSAO_MP = '1.1.0';
const BASE_MP = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSAO_MP}`;
const MODELO = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
const CHAVE = '#00ff00';
const SAIDA_L = 640, SAIDA_A = 360;     // o que vai no fio
const MASCARA_L = 256, MASCARA_A = 144; // o que o modelo olha (pequeno = rápido; as bordas saem suaves ao esticar)
// média acima disto (depois de 40 quadros) = aparelho lento → vídeo normal (?vidroLimiteMs= só para o ensaio provar o caminho)
const LIMITE_MS = Number(PARAMS.get('vidroLimiteMs')) || 45;

// as medidas ficam à vista do ensaio (window.REUNIAO.vidro)
const medidas = { recorteMs: 0, quadros: 0, chaveMs: 0, chaveTelas: 0, chaveTiques: 0 };

let segmentador = null, carregando = null;
async function carregarSegmentador() {
  if (segmentador) return segmentador;
  if (!carregando) carregando = (async () => {
    // a biblioteca vem do jsDelivr (pacote oficial do Google, Apache-2.0); o modelo, do armazenamento do MediaPipe
    const v = await import(/* @vite-ignore */ `${BASE_MP}/vision_bundle.mjs`);
    const arquivos = await v.FilesetResolver.forVisionTasks(`${BASE_MP}/wasm`);
    const criar = (delegate) => v.ImageSegmenter.createFromOptions(arquivos, { baseOptions: { modelAssetPath: MODELO, delegate }, runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true });
    try { segmentador = await criar(PARAMS.get('vidroCpu') === '1' ? 'CPU' : 'GPU'); } catch (e) { console.log('[Vidro] sem GPU, vai na CPU', e && e.message); segmentador = await criar('CPU'); }
    return segmentador;
  })().catch((e) => { carregando = null; throw e; });
  return carregando;
}

// O CAMINHO RÁPIDO (Chrome no computador e no Android): MediaStreamTrackProcessor/Generator, quadro a quadro.
const temTrilha = () => typeof window.MediaStreamTrackProcessor === 'function' && typeof window.MediaStreamTrackGenerator === 'function' && typeof OffscreenCanvas === 'function';
// O CAMINHO DO IPHONE (07/out/2026, 1ª reunião com Tainá e Emiliano de longe: "era para vocês aparecerem sem o fundo… eu tinha
// botado um filtro automático" — não apareceu). O Safari (iPhone/iPad/Mac) e o Firefox não têm MediaStreamTrackProcessor na
// página, então o vidro caía em "indisponível" e ia o vídeo normal, com o fundo. Agora, sem ele, o recorte é feito num <canvas>
// (o vídeo da câmera desenhado nele, o MediaPipe — que roda no Safari — recorta, e canvas.captureStream() vira a faixa que vai
// no fio). Um pouco mais pesado, mas o limite de 45 ms/quadro continua valendo (aparelho lento → vídeo normal).
const temCanvas = () => typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
/** Dá para recortar neste navegador? */
export const vidroPossivel = () => !PARAMS.has('vidroSemCanvas') ? (temTrilha() || temCanvas()) : temTrilha();
/** qual caminho o recorte usa aqui ('trilha' | 'canvas' | '') — vai no aviso ao anfitrião e no ensaio */
export const caminhoDoVidro = () => (PARAMS.get('vidroCaminho') === 'canvas' && temCanvas() ? 'canvas' : temTrilha() ? 'trilha' : vidroPossivel() ? 'canvas' : '');
// tamanho do fio na proporção da câmera (celular em pé manda 360×640: antes saía esticado em 640×360)
function medidasDoFio(l, a) { if (!l || !a) return [SAIDA_L, SAIDA_A]; const k = Math.min(1, 640 / Math.max(l, a)); return [Math.round(l * k / 2) * 2, Math.round(a * k / 2) * 2]; }

/**
 * A câmera com o fundo de vidro. Devolve { stream, ligado, estado, alternar(v), parar() }.
 * stream = o que vai no fio e na própria tela (vídeo processado + o áudio original, se houver).
 * estado: 'carregando' | 'ligado' | 'desligado' | 'lento' | 'indisponivel'.
 */
export function camadaDeVidro(entrada, { ligado = true, aoMudar } = {}) {
  const camera = entrada && entrada.getVideoTracks()[0];
  const audio = entrada ? entrada.getAudioTracks() : [];
  let querLigado = !!ligado, estado = 'desligado', parado = false;
  const muda = (e) => { if (estado !== e) { estado = e; aoMudar && aoMudar(e); } };
  if (!camera || !vidroPossivel()) {
    muda(camera ? 'indisponivel' : 'desligado');
    return { stream: entrada, caminho: '', get ligado() { return false; }, get estado() { return estado; }, alternar() { return false; }, parar() { /* nada */ } };
  }
  if (caminhoDoVidro() === 'canvas') return camadaPorCanvas(camera, audio, { ligado, aoMudar });
  const proc = new window.MediaStreamTrackProcessor({ track: camera, maxBufferSize: 1 });
  const gerador = new window.MediaStreamTrackGenerator({ kind: 'video' });
  const leitor = proc.readable.getReader(), escritor = gerador.writable.getWriter();
  const pequeno = new OffscreenCanvas(MASCARA_L, MASCARA_A), cp = pequeno.getContext('2d', { willReadFrequently: false });
  const mascara = new OffscreenCanvas(MASCARA_L, MASCARA_A), cm = mascara.getContext('2d');
  const pessoa = new OffscreenCanvas(SAIDA_L, SAIDA_A), cpe = pessoa.getContext('2d');
  const saida = new OffscreenCanvas(SAIDA_L, SAIDA_A), cs = saida.getContext('2d');
  let medido = false;
  const alfa = new ImageData(MASCARA_L, MASCARA_A);
  let somaMs = 0, n = 0;
  if (querLigado) { muda('carregando'); carregarSegmentador().then(() => { if (querLigado && estado === 'carregando') muda('ligado'); }).catch((e) => { console.error('[Vidro] não carregou o recorte', e); muda('indisponivel'); }); }
  (async () => {
    for (;;) {
      let r; try { r = await leitor.read(); } catch (e) { break; }
      if (r.done || parado) { try { r.value && r.value.close(); } catch (e) { /* nada */ } break; }
      const quadro = r.value;
      if (!(querLigado && estado === 'ligado' && segmentador)) { try { await escritor.write(quadro); } catch (e) { quadro.close(); break; } continue; }
      const t0 = performance.now();
      let novo = null;
      try {
        if (!medido && quadro.displayWidth) { medido = true; const [l, a] = medidasDoFio(quadro.displayWidth, quadro.displayHeight); pessoa.width = saida.width = l; pessoa.height = saida.height = a; }
        cp.drawImage(quadro, 0, 0, MASCARA_L, MASCARA_A);
        const res = segmentador.segmentForVideo(pequeno, t0);
        const m = res.confidenceMasks && res.confidenceMasks[0];
        if (m) {
          const c = m.getAsFloat32Array(), d = alfa.data;
          // confiança → transparência, com uma rampa curta (borda suave, sem serrilhado)
          for (let i = 0, j = 3; i < c.length; i++, j += 4) { const a = (c[i] - 0.35) / 0.3; d[j] = a <= 0 ? 0 : a >= 1 ? 255 : a * 255; }
          cm.putImageData(alfa, 0, 0);
        }
        try { res.close && res.close(); } catch (e) { /* nada */ }
        const L = saida.width, A = saida.height;
        cpe.globalCompositeOperation = 'copy'; cpe.drawImage(quadro, 0, 0, L, A);
        cpe.globalCompositeOperation = 'destination-in'; cpe.drawImage(mascara, 0, 0, L, A);
        cs.fillStyle = CHAVE; cs.fillRect(0, 0, L, A); cs.drawImage(pessoa, 0, 0);
        novo = new VideoFrame(saida, { timestamp: quadro.timestamp });
      } catch (e) { console.error('[Vidro] quadro', e); }
      quadro.close();
      const ms = performance.now() - t0; somaMs += ms; n++; medidas.recorteMs = somaMs / n; medidas.quadros = n;
      if (n === 40 && somaMs / n > LIMITE_MS && !PARAMS.has('vidroSempre')) { console.log('[Vidro] aparelho lento (' + Math.round(somaMs / n) + ' ms/quadro): vídeo normal'); muda('lento'); }
      if (novo) { try { await escritor.write(novo); } catch (e) { novo.close(); break; } }
    }
  })();
  const stream = new MediaStream([gerador, ...audio]);
  return {
    stream, caminho: 'trilha',
    get ligado() { return estado === 'ligado'; },
    get estado() { return estado; },
    /** liga/desliga; devolve se ficou ligado */
    alternar(v) {
      querLigado = v === undefined ? !querLigado : !!v;
      if (!querLigado) { muda('desligado'); return false; }
      if (estado === 'lento') { somaMs = 0; n = 0; }
      muda('carregando');
      carregarSegmentador().then(() => { if (querLigado) muda('ligado'); }).catch(() => muda('indisponivel'));
      return true;
    },
    parar() { parado = true; try { camera.stop(); } catch (e) { /* nada */ } try { gerador.stop(); } catch (e) { /* nada */ } },
  };
}

/** O caminho do iPhone/Safari: <video> → <canvas> (recorte com o mesmo verde-chave) → canvas.captureStream(). */
function camadaPorCanvas(camera, audio, { ligado = true, aoMudar } = {}) {
  let querLigado = !!ligado, estado = 'desligado', parado = false;
  const muda = (e) => { if (estado !== e) { estado = e; aoMudar && aoMudar(e); } };
  const video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, autoplay: true });
  video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
  video.srcObject = new MediaStream([camera]);
  // o iPhone só entrega quadro de <video> que está na página: fica num canto, invisível (1 px)
  Object.assign(video.style, { position: 'fixed', left: '0', top: '0', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' });
  try { document.body.appendChild(video); } catch (e) { /* sem body ainda */ }
  video.play().catch(() => { /* toca no primeiro toque */ });
  const saida = document.createElement('canvas'); saida.width = SAIDA_L; saida.height = SAIDA_A;
  const cs = saida.getContext('2d');
  const pequeno = document.createElement('canvas'); pequeno.width = MASCARA_L; pequeno.height = MASCARA_A;
  const cp = pequeno.getContext('2d', { willReadFrequently: false });
  const mascara = document.createElement('canvas'); mascara.width = MASCARA_L; mascara.height = MASCARA_A;
  const cm = mascara.getContext('2d');
  const pessoa = document.createElement('canvas'); pessoa.width = SAIDA_L; pessoa.height = SAIDA_A;
  const cpe = pessoa.getContext('2d');
  const alfa = cm.createImageData(MASCARA_L, MASCARA_A);
  let somaMs = 0, n = 0, medido = false;
  const carregar = () => { muda('carregando'); carregarSegmentador().then(() => { if (querLigado && estado === 'carregando') muda('ligado'); }).catch((e) => { console.error('[Vidro] não carregou o recorte (canvas)', e); muda('indisponivel'); }); };
  if (querLigado) carregar();
  function quadro() {
    if (parado) return;
    if (video.readyState >= 2 && video.videoWidth) {
      if (!medido) { medido = true; const [l, a] = medidasDoFio(video.videoWidth, video.videoHeight); saida.width = pessoa.width = l; saida.height = pessoa.height = a; }
      const L = saida.width, A = saida.height;
      if (querLigado && estado === 'ligado' && segmentador) {
        const t0 = performance.now();
        try {
          cp.drawImage(video, 0, 0, MASCARA_L, MASCARA_A);
          const res = segmentador.segmentForVideo(pequeno, t0);
          const m = res.confidenceMasks && res.confidenceMasks[0];
          if (m) { const c = m.getAsFloat32Array(), d = alfa.data; for (let i = 0, j = 3; i < c.length; i++, j += 4) { const a = (c[i] - 0.35) / 0.3; d[j] = a <= 0 ? 0 : a >= 1 ? 255 : a * 255; } cm.putImageData(alfa, 0, 0); }
          try { res.close && res.close(); } catch (e) { /* nada */ }
          cpe.globalCompositeOperation = 'copy'; cpe.drawImage(video, 0, 0, L, A);
          cpe.globalCompositeOperation = 'destination-in'; cpe.drawImage(mascara, 0, 0, L, A);
          cs.fillStyle = CHAVE; cs.fillRect(0, 0, L, A); cs.drawImage(pessoa, 0, 0);
        } catch (e) { console.error('[Vidro] quadro (canvas)', e); cs.drawImage(video, 0, 0, L, A); }
        const ms = performance.now() - t0; somaMs += ms; n++; medidas.recorteMs = somaMs / n; medidas.quadros = n;
        if (n === 40 && somaMs / n > LIMITE_MS && !PARAMS.has('vidroSempre')) { console.log('[Vidro] aparelho lento (' + Math.round(somaMs / n) + ' ms/quadro, canvas): vídeo normal'); muda('lento'); }
      } else cs.drawImage(video, 0, 0, L, A);
    }
    // o relógio do próprio vídeo quando existe (Safari 15.4+, Chrome); senão ~20 quadros por segundo
    if (typeof video.requestVideoFrameCallback === 'function' && !video.paused) video.requestVideoFrameCallback(quadro); else setTimeout(quadro, 50);
  }
  quadro();
  const faixa = saida.captureStream(20).getVideoTracks()[0];
  const stream = new MediaStream([faixa, ...audio]);
  return {
    stream, caminho: 'canvas',
    get ligado() { return estado === 'ligado'; },
    get estado() { return estado; },
    alternar(v) {
      querLigado = v === undefined ? !querLigado : !!v;
      if (!querLigado) { muda('desligado'); return false; }
      if (estado === 'lento') { somaMs = 0; n = 0; }
      carregar();
      return true;
    },
    parar() { parado = true; try { camera.stop(); } catch (e) { /* nada */ } try { faixa.stop(); } catch (e) { /* nada */ } try { video.srcObject = null; video.remove(); } catch (e) { /* nada */ } },
  };
}

// ---------------------------------------------------------------------------
// QUEM RECEBE: tira o verde-chave num canvas (um relógio só para todos os ladrilhos, 20 quadros por segundo)
// ---------------------------------------------------------------------------
const recortes = new Set();
let relogio = null;
const RECORTE_L = 320, RECORTE_A = 180;
function tique() {
  if (!recortes.size) { clearInterval(relogio); relogio = null; return; }
  const t0 = performance.now();
  for (const r of recortes) {
    if (!r.canvas.isConnected) continue;          // fora da tela agora (a faixa redesenha): não gasta nada
    const v = r.video;
    if (v.readyState < 2 || !v.videoWidth) continue;
    // a proporção de quem manda (celular em pé = retrato): o canvas acompanha, o CSS (object-fit: contain) encaixa
    const k = Math.min(RECORTE_L / v.videoWidth, RECORTE_L / v.videoHeight), CL = Math.max(2, Math.round(v.videoWidth * k)), CA = Math.max(2, Math.round(v.videoHeight * k));
    if (r.canvas.width !== CL || r.canvas.height !== CA) { r.canvas.width = CL; r.canvas.height = CA; }
    r.ctx.drawImage(v, 0, 0, CL, CA);
    const img = r.ctx.getImageData(0, 0, CL, CA), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2], mx = R > B ? R : B, verde = G - mx;
      if (verde > 70 && G > 120) d[i + 3] = 0;                                   // fundo
      else if (verde > 25) { d[i + 3] = 255 * (70 - verde) / 45; d[i + 1] = mx; } // borda: meio transparente, sem o verde
    }
    r.ctx.putImageData(img, 0, 0);
  }
  const ms = performance.now() - t0;
  medidas.chaveTiques++; medidas.chaveMs += (ms - medidas.chaveMs) / Math.min(medidas.chaveTiques, 50); medidas.chaveTelas = recortes.size;
}
/** O canvas que mostra a pessoa sem o verde (vai dentro do ladrilho de vidro). */
export function telaRecortada(stream) {
  const canvas = document.createElement('canvas'); canvas.width = RECORTE_L; canvas.height = RECORTE_A; canvas.className = 'recorte';
  const video = Object.assign(document.createElement('video'), { autoplay: true, muted: true, playsInline: true });
  video.srcObject = stream; video.play().catch(() => { /* toca quando der */ });
  const r = { canvas, video, ctx: canvas.getContext('2d', { willReadFrequently: true }), criado: Date.now(), parar() { recortes.delete(r); try { video.srcObject = null; } catch (e) { /* nada */ } } };
  recortes.add(r);
  if (!relogio) relogio = setInterval(tique, 50);
  canvas._recorte = r;
  return canvas;
}
export { medidas };
