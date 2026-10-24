// OSCARPES AO VIVO — reuniao/sala.js
// JARVIS REUNIÃO — QUEM ESTÁ LONGE (06/out/2026): áudio, vídeo e tela entre o Mac (ANFITRIÃO, o centro) e cada
// convidado, por WebRTC. Desenho em estrela: cada convidado liga só com o Mac; o Mac repassa para cada um as faixas dos
// outros (câmera, áudio, tela), o áudio da sala com a voz do Oscar, e o PAINEL pelo canal de dados (só para quem foi
// admitido — o painel nunca passa pelo canal de sinal).
// SINAL: Supabase Realtime (broadcast) no canal "reuniao-<código>" — só a combinação da ligação (SDP/ICE) e o pedido de
// entrada passam por lá. STUN público do Google; TURN fica para depois (redes muito fechadas podem não conectar).
// SALA DE ESPERA: ninguém entra sem o anfitrião admitir (clique). O nome que o convidado diz é o que aparece; o nível
// de acesso dele começa "restrito" e só o anfitrião muda (o servidor ainda não confere a conta de quem chega).
// Sem DOM aqui: reuniao.js desenha. O ensaio scripts/reuniao/ensaiar-sala.mjs roda dois Chrome headless.

const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const PROJETO_WS = 'wss://sjtfwipgqeryeukreyst.supabase.co/realtime/v1/websocket';

/** Código da reunião: 10 letras/números sem os que confundem (0/O, 1/I/L). */
export function novoCodigo() {
  const A = 'abcdefghjkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint8Array(10));
  return [...r].map((b) => A[b % A.length]).join('');
}
export const codigoValido = (c) => /^[a-z2-9]{10}$/.test(String(c || ''));
export function novoId() { return [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join(''); }

/** Canal de sinal (Phoenix do Supabase Realtime, sem biblioteca). */
export function criarSinal(codigo, anon) {
  const topico = 'realtime:reuniao-' + codigo;
  let ws = null, ref = 0, pronto = false, fila = [], ouvintes = [], vivo = true, batida = null;
  function abrir() {
    ws = new WebSocket(`${PROJETO_WS}?apikey=${encodeURIComponent(anon)}&vsn=1.0.0`);
    ws.onopen = () => { ws.send(JSON.stringify({ topic: topico, event: 'phx_join', payload: { config: { broadcast: { self: false }, presence: { key: '' }, private: false } }, ref: String(++ref) })); };
    ws.onmessage = (m) => {
      let d; try { d = JSON.parse(m.data); } catch (e) { return; }
      if (d.event === 'phx_reply' && d.topic === topico && !pronto) { pronto = d.payload && d.payload.status === 'ok'; if (pronto) { fila.forEach((x) => ws.send(x)); fila = []; } return; }
      if (d.event === 'broadcast' && d.payload) for (const f of ouvintes) { try { f(d.payload.event, d.payload.payload || {}); } catch (e) { console.error('[Sala] ouvinte', e); } }
    };
    ws.onclose = () => { pronto = false; clearInterval(batida); if (vivo) setTimeout(abrir, 1500); };
    clearInterval(batida);
    batida = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) })); }, 25000);
  }
  abrir();
  return {
    enviar(evento, dados) {
      const msg = JSON.stringify({ topic: topico, event: 'broadcast', payload: { type: 'broadcast', event: evento, payload: dados }, ref: String(++ref) });
      if (pronto && ws.readyState === 1) ws.send(msg); else fila.push(msg);
    },
    aoReceber(f) { ouvintes.push(f); },
    fechar() { vivo = false; clearInterval(batida); try { ws.close(); } catch (e) { /* nada */ } },
    get pronto() { return pronto; },
  };
}

// TETO DO VÍDEO (07/out): sem teto, cada câmera ia a ~2,5 Mbit/s e o Mac repassa todas para todos — no 4G do celular
// a imagem trava. 600 kbit/s e 20 quadros por segundo bastam para um ladrilho.
export async function limitarVideo(pc, maxBitrate = 600000, maxFramerate = 20) {
  for (const snd of pc.getSenders()) {
    if (!snd.track || snd.track.kind !== 'video') continue;
    try {
      const p = snd.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}];
      if (p.encodings[0].maxBitrate === maxBitrate) continue;
      p.encodings[0].maxBitrate = maxBitrate; p.encodings[0].maxFramerate = maxFramerate;
      await snd.setParameters(p);
    } catch (e) { /* setParameters antes de negociar: tenta de novo no próximo 'connected' */ }
  }
}
/** Como está a imagem que chega deste convidado (para a ata): quadros por segundo, travadas e perdas. */
export async function medirLigacao(pc) {
  const r = { fps: 0, travadas: 0, perdidos: 0, rttMs: null };
  try {
    (await pc.getStats()).forEach((x) => {
      if (x.type === 'inbound-rtp' && x.kind === 'video') { r.fps = Math.max(r.fps, Math.round(x.framesPerSecond || 0)); r.travadas += x.freezeCount || 0; r.perdidos += x.packetsLost || 0; }
      if (x.type === 'candidate-pair' && x.state === 'succeeded' && x.currentRoundTripTime != null) r.rttMs = Math.round(x.currentRoundTripTime * 1000);
    });
  } catch (e) { /* sem estatística */ }
  return r;
}

/** Uma ligação com "negociação educada" (o convidado cede quando os dois oferecem ao mesmo tempo). */
// UM SÓ OFERECE (06/out): com os dois lados oferecendo, o Chrome às vezes recusava ("a ordem das m-lines não bate"). Agora
// só o ANFITRIÃO oferece; o convidado só responde e manda as faixas dele nos lugares que o anfitrião reservou
// (antesDeResponder liga microfone/câmera/tela nesses lugares antes da 1ª resposta).
function criarLigacao({ educado, enviarSinal, aoFaixa, aoDados, aoEstado, antesDeResponder }) {
  const pc = new RTCPeerConnection({ iceServers: STUN });
  // canal de dados (o painel e o mapa de quem é cada faixa): o anfitrião cria, o convidado recebe pelo ondatachannel
  // (o "negotiated id 0" dos dois lados derrubava o SCTP: "Failed to start SCTP transport")
  const ouvintesAbre = [];
  let dc = null;
  const ligarCanal = (c) => { dc = c; c.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } aoDados && aoDados(m); }; c.addEventListener('open', () => ouvintesAbre.forEach((f) => f())); };
  if (!educado) ligarCanal(pc.createDataChannel('painel'));
  else pc.ondatachannel = (ev) => ligarCanal(ev.channel);
  let fazendo = false, ignorar = false;
  const guardados = [];
  pc.onnegotiationneeded = async () => {
    if (educado) return;                // o convidado nunca oferece
    try { fazendo = true; await pc.setLocalDescription(); enviarSinal({ tipo: 'sdp', sdp: pc.localDescription }); }
    catch (e) { console.error('[Sala] negociar', e); } finally { fazendo = false; }
  };
  pc.onicecandidate = (ev) => { if (ev.candidate) enviarSinal({ tipo: 'ice', ice: ev.candidate }); };
  pc.ontrack = (ev) => aoFaixa && aoFaixa(ev.track, ev.streams[0], ev.transceiver);
  // QUEDA E VOLTA (07/out/2026, 10:14: "minha câmera travou" — Tainá e Emiliano no fim da reunião). Antes, ligação 'failed'
  // tirava o convidado da sala para sempre (a imagem dele congelava na última foto e ninguém percebia) e 'disconnected' não
  // fazia nada. Agora quem oferece (o Mac) refaz o caminho (ICE restart) depois de 4 s caído ou na hora do 'failed'; o
  // convidado só sai depois de 45 s sem voltar. Quedas e reinícios ficam contados (vão para a ata).
  const saude = { quedas: 0, reinicios: 0, desde: 0 };
  let tReinicio = null;
  const reiniciar = () => { if (educado || pc.connectionState === 'closed') return; try { pc.restartIce(); saude.reinicios++; } catch (e) { /* navegador antigo */ } };
  pc.onconnectionstatechange = () => {
    const e = pc.connectionState;
    if (e === 'disconnected' || e === 'failed') { if (!saude.desde) { saude.desde = Date.now(); saude.quedas++; } clearTimeout(tReinicio); if (e === 'failed') reiniciar(); else tReinicio = setTimeout(() => { if (pc.connectionState === 'disconnected') reiniciar(); }, 4000); }
    if (e === 'connected') { saude.desde = 0; clearTimeout(tReinicio); limitarVideo(pc); }
    aoEstado && aoEstado(e);
  };
  return {
    pc, saude,
    get dc() { return dc || { readyState: 'connecting' }; },
    aoAbrir(f) { if (dc && dc.readyState === 'open') f(); ouvintesAbre.push(f); },
    async receberSinal(m) {
      try {
        if (m.tipo === 'sdp') {
          const colisao = m.sdp.type === 'offer' && (fazendo || pc.signalingState !== 'stable');
          ignorar = !educado && colisao;
          if (ignorar) return;
          await pc.setRemoteDescription(m.sdp);
          if (m.sdp.type === 'offer' && antesDeResponder) { try { await antesDeResponder(pc); } catch (e) { console.error('[Sala] faixas', e); } }
          // candidato que chegou ANTES da descrição (o canal de sinal não garante a ordem): entra agora
          for (const c of guardados.splice(0)) { try { await pc.addIceCandidate(c); } catch (e) { /* velho */ } }
          if (m.sdp.type === 'offer') { await pc.setLocalDescription(); enviarSinal({ tipo: 'sdp', sdp: pc.localDescription }); }
        } else if (m.tipo === 'ice') {
          if (!pc.remoteDescription) { guardados.push(m.ice); return; }
          try { await pc.addIceCandidate(m.ice); } catch (e) { if (!ignorar) throw e; }
        }
      } catch (e) { console.error('[Sala] sinal', e); }
    },
    mandar(obj) { if (dc && dc.readyState === 'open') { try { dc.send(JSON.stringify(obj)); } catch (e) { /* grande demais */ } } },
    fechar() { try { pc.close(); } catch (e) { /* nada */ } },
  };
}

/**
 * ANFITRIÃO (a página do Mac). Recebe pedidos de entrada, admite, liga com cada convidado e repassa as faixas.
 *   saida: { audio: MediaStreamTrack|null (sala + voz do Oscar), camera: MediaStream|null, vidro: bool (a câmera vai com o verde-chave) }
 *   aoPedido({id,nome,email,conta}) · aoFaixa(id, track, stream, tipo) · aoSaiu(id) · aoDados(id, msg)
 */
export function criarAnfitriao({ sinal, saida, aoPedido, aoFaixa, aoSaiu, aoDados, aoEstado, aoAbriu }) {
  const eu = 'anfitriao';
  const pedidos = new Map();      // id → {id,nome,email,conta,em}
  const convidados = new Map();   // id → {lig, nome, streams: Map(streamId → {stream, tipo}), enviadas: Set(trackId)}
  sinal.aoReceber((evento, d) => {
    if (evento === 'quero-entrar' && d.id && !convidados.has(d.id)) {
      if (!pedidos.has(d.id)) { pedidos.set(d.id, { id: d.id, nome: String(d.nome || 'Convidado').slice(0, 40), email: String(d.email || '').slice(0, 80), conta: !!d.conta, em: Date.now() }); aoPedido && aoPedido(pedidos.get(d.id)); }
    } else if (evento === 'sinal' && d.para === eu && convidados.has(d.de)) {
      convidados.get(d.de).lig.receberSinal(d);
    } else if (evento === 'sai' && d.id) {
      pedidos.delete(d.id); if (convidados.has(d.id)) sair(d.id);
    }
  });
  function tipoDe(c, stream) { const s = c.streams.get(stream.id); return s ? s.tipo : 'camera'; }
  function mapaDeFaixas() {
    const mapa = { sala: { nome: 'Sala', tipo: 'camera' } };
    // FUNDO DE VIDRO (06/out): cada câmera diz se vem com o verde-chave — quem recebe só tira o verde de quem avisou
    if (saida.camera) mapa[saida.camera.id] = { nome: 'Sala', tipo: 'camera', vidro: !!saida.vidro };
    if (saida.audioStream) mapa[saida.audioStream.id] = { nome: 'Sala', tipo: 'audio' };
    for (const [, c] of convidados) for (const [sid, s] of c.streams) mapa[sid] = { nome: c.nome, tipo: s.tipo, ...(s.tipo === 'tela' ? { ativa: !!c.telaAtiva } : { vidro: !!c.vidro }) };
    return mapa;
  }
  function repassar() {
    // cada convidado recebe: áudio da sala (+Oscar), câmera da sala e as faixas dos OUTROS convidados
    for (const [id, c] of convidados) {
      const quer = [];
      if (saida.audio) quer.push([saida.audio, saida.audioStream]);
      if (saida.camera) for (const t of saida.camera.getVideoTracks()) quer.push([t, saida.camera]);
      for (const [oid, o] of convidados) if (oid !== id) for (const [, s] of o.streams) for (const t of s.stream.getTracks()) if (t.readyState === 'live') quer.push([t, s.stream]);
      // addTransceiver (e não addTrack): o addTrack reaproveitava os lugares reservados para o convidado e a câmera da sala
      // caía no lugar da tela dele
      for (const [t, st] of quer) if (!c.enviadas.has(t.id)) { try { c.lig.pc.addTransceiver(t, { direction: 'sendonly', streams: [st] }); c.enviadas.add(t.id); } catch (e) { /* já está */ } }
      // faixa que acabou (tela parada, convidado saiu): tira
      for (const tr of c.lig.pc.getTransceivers()) { const snd = tr.sender; if (snd.track && !c.reservas.includes(tr) && !quer.some(([t]) => t === snd.track)) { c.enviadas.delete(snd.track.id); try { c.lig.pc.removeTrack(snd); } catch (e) { /* nada */ } } }
      c.lig.mandar({ tipo: 'faixas', mapa: mapaDeFaixas() });
    }
  }
  function admitir(id, extra = {}) {
    const p = pedidos.get(id); if (!p) return;
    pedidos.delete(id);
    const c = { nome: extra.nome || p.nome, streams: new Map(), enviadas: new Set(), lig: null };
    c.lig = criarLigacao({
      educado: false,
      enviarSinal: (m) => sinal.enviar('sinal', { ...m, de: eu, para: id }),
      aoFaixa: (track, _stream, tr) => {
        // o que chega nos lugares reservados é DESTE convidado: microfone+câmera num stream, tela em outro (o Mac monta)
        const st = tr === c.reservas[2] ? c.tela : c.cam;
        if (!st.getTracks().includes(track)) st.addTrack(track);
        aoFaixa && aoFaixa(id, track, st, st === c.tela ? 'tela' : 'camera');
        track.addEventListener('ended', () => setTimeout(repassar, 100));
        setTimeout(repassar, 300);
      },
      aoDados: (m) => {
        if (m.tipo === 'minhas-faixas') { c.telaAtiva = !!m.telaAtiva; c.vidro = !!m.vidro; c.vidroInfo = m.vidroInfo && typeof m.vidroInfo === 'object' ? { estado: String(m.vidroInfo.estado || '').slice(0, 20), caminho: String(m.vidroInfo.caminho || '').slice(0, 10), aparelho: String(m.vidroInfo.aparelho || '').slice(0, 20) } : c.vidroInfo; setTimeout(repassar, 100); }
        aoDados && aoDados(id, m);
      },
      aoEstado: (e) => {
        aoEstado && aoEstado(id, e);
        if (e === 'closed') sair(id);
        // caiu: o criarLigacao já pediu o caminho novo; só desiste depois de 45 s sem voltar
        if (e === 'failed' || e === 'disconnected') setTimeout(() => { const cc = convidados.get(id); if (cc && ['failed', 'disconnected'].includes(cc.lig.pc.connectionState) && cc.lig.saude.desde && Date.now() - cc.lig.saude.desde > 44000) sair(id); }, 45000);
      },
    });
    // os 3 lugares do convidado (microfone, câmera, tela) vão na 1ª oferta, antes de qualquer faixa do Mac
    c.cam = new MediaStream(); c.tela = new MediaStream();
    c.reservas = [c.lig.pc.addTransceiver('audio', { direction: 'recvonly' }), c.lig.pc.addTransceiver('video', { direction: 'recvonly' }), c.lig.pc.addTransceiver('video', { direction: 'recvonly' })];
    c.streams.set(c.cam.id, { stream: c.cam, tipo: 'camera' }); c.streams.set(c.tela.id, { stream: c.tela, tipo: 'tela' });
    convidados.set(id, c);
    sinal.enviar('admitido', { para: id, nome: c.nome });
    repassar();
    c.lig.aoAbrir(() => { repassar(); aoAbriu && aoAbriu(id); });
  }
  function recusar(id) { pedidos.delete(id); sinal.enviar('recusado', { para: id }); }
  function sair(id) { const c = convidados.get(id); if (!c) return; convidados.delete(id); c.lig.fechar(); aoSaiu && aoSaiu(id); repassar(); }
  return {
    admitir, recusar, sair, repassar,
    get pedidos() { return [...pedidos.values()]; },
    async medir() { const out = {}; for (const [, c] of convidados) out[c.nome] = { estado: c.lig.pc.connectionState, quedas: c.lig.saude.quedas, reinicios: c.lig.saude.reinicios, ...(await medirLigacao(c.lig.pc)) }; return out; },
    legenda(html) { const txt = JSON.stringify({ tipo: 'legenda', html }); for (const [, c] of convidados) if (c.lig.dc.readyState === 'open') { try { c.lig.dc.send(txt); } catch (e) { /* nada */ } } },
    get convidados() { return [...convidados.entries()].map(([id, c]) => ({ id, nome: c.nome, telaAtiva: !!c.telaAtiva, vidro: !!c.vidro, vidroInfo: c.vidroInfo || null, estado: c.lig.pc.connectionState, sinal: c.lig.pc.signalingState, ice: c.lig.pc.iceConnectionState, streams: [...c.streams.values()].filter((s) => s.stream.getTracks().length) })); },
    renomear(id, nome) { const c = convidados.get(id); if (c) { c.nome = nome; repassar(); } },
    painel(obj) { const txt = JSON.stringify({ tipo: 'painel', estado: obj }); for (const [, c] of convidados) if (c.lig.dc.readyState === 'open') { try { c.lig.dc.send(txt); } catch (e) { /* grande */ } } },
    mandarTodos(obj) { for (const [, c] of convidados) c.lig.mandar(obj); },
    fechar() { for (const id of [...convidados.keys()]) sair(id); sinal.fechar(); },
  };
}

/**
 * CONVIDADO (quem entra pelo link). Pede para entrar a cada 3 s até ser admitido; liga com o Mac.
 *   midia: MediaStream (câmera + microfone) · aoAdmitido() · aoRecusado() · aoFaixa(track, stream) · aoDados(msg)
 */
export function criarConvidado({ sinal, eu, midia, aoAdmitido, aoRecusado, aoFaixa, aoDados, aoEstado }) {
  // TELA sem renegociar (06/out: "a ordem das m-lines não bate" quando os dois lados ofereciam ao mesmo tempo): o lugar da tela
  // é reservado na entrada (um transceptor de vídeo vazio) e compartilhar só troca a faixa dele (replaceTrack)
  let lig = null, admitido = false, telaAtiva = false, trTela = null, vidro = false, vidroInfo = null;
  const telaStream = { id: 'tela' };
  const pedir = () => { if (!admitido) sinal.enviar('quero-entrar', eu); };
  pedir(); const t = setInterval(pedir, 3000);
  function mapa() { const m = {}; if (midia) m[midia.id] = 'camera'; m[telaStream.id] = 'tela'; return m; }
  const avisarFaixas = () => lig && lig.mandar({ tipo: 'minhas-faixas', mapa: mapa(), telaAtiva, vidro, vidroInfo });
  sinal.aoReceber((evento, d) => {
    if (evento === 'admitido' && d.para === eu.id && !admitido) {
      admitido = true; clearInterval(t);
      let ligado = false;
      lig = criarLigacao({
        educado: true, enviarSinal: (m) => sinal.enviar('sinal', { ...m, de: eu.id, para: 'anfitriao' }), aoFaixa, aoDados, aoEstado,
        antesDeResponder: async (pc) => {
          if (ligado) return; ligado = true;
          // os 3 primeiros lugares da oferta são os reservados: áudio, vídeo (câmera), vídeo (tela)
          const trs = pc.getTransceivers();
          const a = trs.find((t) => t.receiver.track.kind === 'audio');
          const vs = trs.filter((t) => t.receiver.track.kind === 'video');
          if (a) { a.direction = 'sendonly'; await a.sender.replaceTrack(midia ? midia.getAudioTracks()[0] || null : null); }
          if (vs[0]) { vs[0].direction = 'sendonly'; await vs[0].sender.replaceTrack(midia ? midia.getVideoTracks()[0] || null : null); }
          if (vs[1]) { vs[1].direction = 'sendonly'; trTela = vs[1]; }
        },
      });
      lig.aoAbrir(avisarFaixas);
      aoAdmitido && aoAdmitido(d);
    } else if (evento === 'recusado' && d.para === eu.id) { clearInterval(t); aoRecusado && aoRecusado(); }
    else if (evento === 'sinal' && d.para === eu.id && lig) lig.receberSinal(d);
  });
  return {
    get admitido() { return admitido; },
    get ligacao() { return lig; },
    async compartilharTela(stream) {
      if (!lig || !trTela) return;
      await trTela.sender.replaceTrack(stream ? stream.getVideoTracks()[0] : null);
      telaAtiva = !!stream; avisarFaixas();
    },
    mandar(obj) { lig && lig.mandar(obj); },
    /** a câmera passou a ir com (ou sem) o verde-chave do fundo de vidro */
    // info = { estado, caminho } do recorte NESTE aparelho (07/out: o anfitrião não tinha como saber por que o fundo não saiu)
    definirVidro(v, info) { vidro = !!v; if (info) vidroInfo = info; avisarFaixas(); },
    sair() { clearInterval(t); sinal.enviar('sai', { id: eu.id }); lig && lig.fechar(); sinal.fechar(); },
  };
}
