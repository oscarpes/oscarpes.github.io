// OSCARPES AO VIVO — voz.js
// A VOZ: a natural (Piper, no aparelho) e a do aparelho (speechSynthesis), com a folha pulsando no
// som. Módulo trocável: o resto da página só usa Voz.falar/fluxo/avisar/parar.
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import './raizes.js?v=20261010213811';
import { AVISOS_DE_ESPERA, diag } from './base.js?v=20261010213811';
import { Esfera, fase } from './cena.js?v=20261010213811';
import { marcarVozComecou } from './ouvido.js?v=20261010213811';

// ---------------------------------------------------------------------------
// VOZ — módulo trocável (o João vai escolher a definitiva depois).
// ---------------------------------------------------------------------------
// 1º) VOZ NATURAL (Piper "Faber", pt-BR): a MESMA do app (lib/voz-neural.ts),
//     rodando no aparelho, grátis. Motor e fonemizador vêm do nosso site
//     (/voz/, conferidos por SHA-256); só a voz (dados) vem do Hugging Face,
//     baixa UMA vez por botão (63 MB) e fica guardada no aparelho.
//     Com ela a folha pulsa com o SOM de verdade (AnalyserNode).
// 2º) Enquanto não baixou: a voz do aparelho — fugindo das vozes "de
//     brinquedo" do Mac (Eddy, Flo, Grandpa…), que o João ouviu "fanhas"
//     (02/out/2026), e preferindo Luciana/Felipe/Google.
// VOZ DO MAC (05/out/2026, João: "essa voz do Oscar de mesa tá melhor que a do Jarvis") — quando a página roda no
// Mac do João, a fala vem do OSCAR DE MESA (o programa do Mac, oscar-mesa/ no repositório SoloApp-b2815), que deixa
// a voz dele (Kokoro pm_alex + o efeito da voz C) carregada em http://127.0.0.1:47814/voz. Mesmo padrão do ouvido
// (127.0.0.1:47811): só o próprio Mac, e o Oscar só responde à origem do site. Sem o programa (outro computador, TV
// do cliente, celular), a sondagem falha em milésimos e a fala segue no Piper como sempre — nada trava. Falhou no
// meio: 60 s fora e tenta de novo. Fábrica pura (o portão scripts/conferir-voz-do-mac.mjs roda ela com fetch de mentira).
// <vozDoMac>
const VOZ_MAC = 'http://127.0.0.1:47814/voz';
function criarVozDoMac({ buscar, ehMac, agora, aoMudar }) {
  let estado = ehMac ? null : false;      // null = ainda não sei · true = respondeu · false = não tem
  let foraAte = 0;
  const muda = (v) => { const antes = estado === true; estado = v; if (antes !== (v === true)) aoMudar && aoMudar(v === true); };
  return {
    get ativa() { return estado === true && agora() >= foraAte; },
    async sondar() {
      if (!ehMac) return false;
      try { const r = await buscar(VOZ_MAC + '/saude', { method: 'GET' }, 600); muda(!!(r && r.ok)); }
      catch (e) { muda(false); }
      return estado === true;
    },
    /** o WAV da fala (ArrayBuffer) ou null (aí a página usa o Piper) */
    async gerar(texto, ritmo) {
      if (!(estado === true && agora() >= foraAte)) return null;
      try {
        const r = await buscar(VOZ_MAC, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ texto, ritmo }) }, 8000);
        if (!r || !r.ok) throw new Error('voz do mac ' + (r && r.status));
        return await r.arrayBuffer();
      } catch (e) { foraAte = agora() + 60000; return null; }
    },
  };
}
// </vozDoMac>
/** fetch com prazo (a sondagem não pode segurar a página) */
function buscarComPrazo(url, op, ms) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...op, signal: c.signal, cache: 'no-store' }).finally(() => clearTimeout(t));
}
const ehMacDeMesa = /Macintosh/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1);

// FONEMIZADOR QUE RENASCE (05/out/2026) — o piper-phonemize (wasm do espeak) VAZA memória a cada chamada e MORRE
// ("memory access out of bounds") com a memória fixa de 16 MB. Medido no Chrome headless: morre na chamada 155 com
// frases de 12 letras, na 129 com 42 e na 74 com 181 — uma conta de ~23 mil "pontos", cada chamada gastando 137 + nº
// de letras. Morto, TODA fala seguinte falhava calada até recarregar a página: numa apresentação longa o Jarvis
// emudecia. Agora, passada a metade (12 mil), o fonemizador é recriado (32 ms, os arquivos já estão no cache), e se
// mesmo assim uma chamada falhar, recria e tenta de novo uma vez. A mesma conta mora em lib/voz-neural.ts (o app);
// o portão scripts/conferir-fonemizador-renova.mjs roda este bloco e compara os números das duas.
// <fonemizadorRenova>
const FONEMIZADOR_TETO = 12000;
const custoFonemizador = (texto) => 137 + String(texto).length;
function criarFonemizadorRenovavel(criar) {
  let atual = null, gasto = 0, recriados = 0;
  const novo = async () => { atual = null; atual = await criar(); gasto = 0; recriados++; return atual; };
  return {
    get recriados() { return recriados; },
    async preparar() { if (!atual) await novo(); },
    /** roda(fz) com um fonemizador vivo; recria antes do teto e, se falhar, recria e tenta de novo uma vez */
    async usar(texto, roda) {
      const custo = custoFonemizador(texto);
      if (!atual || gasto + custo > FONEMIZADOR_TETO) await novo();
      gasto += custo;
      try { return roda(atual); }
      catch (e) { await novo(); gasto = custo; return roda(atual); }
    },
  };
}
// </fonemizadorRenova>

const VozNatural = (() => {
  const HF = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main';
  const URL_VOZ = HF + '/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx';
  const CAIXA = 'oscarpes-voz-neural-v1';            // a mesma caixa do app: baixou lá, serve aqui
  let base = null, sessao = null, cfg = null, ctx = null, analisador = null, geracao = 0, fim = 0;
  let inicios = [];                  // quando cada pedaço da fala atual começa no relógio do áudio ("continua" retoma dali)
  const fontes = new Set();          // pedaços já agendados no relógio do áudio (parar() corta todos)
  const prontas = new Map();         // frases curtas já geradas (o "um instante" sai na hora)
  const possivel = !!(window.AudioContext || window.webkitAudioContext) && 'caches' in window && typeof WebAssembly === 'object';
  // a voz do Oscar de mesa: quando liga, as frases de espera já geradas no Piper saem de novo na voz dele
  const vozDoMac = criarVozDoMac({ buscar: buscarComPrazo, ehMac: ehMacDeMesa, agora: () => Date.now(),
    aoMudar: (ativa) => { diag(ativa ? 'voz do mac ligada' : 'voz do mac fora'); prontas.clear(); if (ativa) setTimeout(() => VozNatural.aquecer(AVISOS_DE_ESPERA), 300); } });
  if (ehMacDeMesa) { vozDoMac.sondar(); setInterval(() => { if (!vozDoMac.ativa) vozDoMac.sondar(); }, 60000); }
  // A RESERVA NO MAC (06/out/2026, 00h15: o João fechou a bolinha às 21:17, o servidor do Mac caiu junto e o Jarvis
  // passou a falar com a voz feminina do aparelho, que ele já tinha descartado). No Mac a ordem é: o servidor do Mac →
  // o Piper → NUNCA a voz do aparelho. Por isso o Piper fica carregado de reserva no Mac (baixa UMA vez, 63 MB, e fica
  // no cache), mesmo com o servidor de pé — se ele cair no meio da fala, o Piper já está pronto.
  if (ehMacDeMesa && possivel) setTimeout(() => { preparar().catch((e) => diag('reserva piper falhou ' + String(e && e.message || e).slice(0, 40))); }, 3000);
  function garantirCtx() {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); analisador = ctx.createAnalyser(); analisador.fftSize = 256; analisador.connect(ctx.destination); }
  }
  async function guardado(url, prog) {
    const cx = await caches.open(CAIXA); const g = await cx.match(url);
    if (g) { prog && prog(1); return g.arrayBuffer(); }
    const r = await fetch(url); if (!r.ok || !r.body) throw new Error('download ' + r.status);
    const total = Number(r.headers.get('content-length') || 0), rd = r.body.getReader(), partes = []; let lido = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; partes.push(value); lido += value.length; if (total) prog && prog(Math.min(.99, lido / total)); }
    const tudo = new Uint8Array(lido); let p = 0; for (const x of partes) { tudo.set(x, p); p += x.length; }
    await cx.put(url, new Response(tudo, { headers: { 'content-type': 'application/octet-stream' } })); prog && prog(1);
    return tudo.buffer;
  }
  async function jaBaixada() { try { return !!(await (await caches.open(CAIXA)).match(URL_VOZ)); } catch (e) { return false; } }
  // uma preparação só (06/out/2026): main.js (selo) e a reserva do Mac (abaixo) podem pedir juntas
  let preparando = null;
  function preparar(prog) {
    if (sessao) return Promise.resolve();
    if (!preparando) preparando = prepararJa(prog).finally(() => { preparando = null; });
    return preparando;
  }
  async function prepararJa(prog) {
    if (sessao) return;
    if (!base) {
      const [fon, ortM] = await Promise.all([import('/voz/piper-fonemizador.mjs'), import('/voz/ort.wasm.min.mjs')]);
      const ort = ortM.default || ortM; ort.env.wasm.numThreads = 1; ort.env.wasm.wasmPaths = '/voz/';
      const fz = criarFonemizadorRenovavel(async () => {
        const saida = { atual: null };
        const f = await fon.createPiperPhonemize({ print: (d) => saida.atual && saida.atual(d), printErr: () => {},
          locateFile: (u) => u.endsWith('.wasm') ? '/voz/piper_phonemize.wasm' : u.endsWith('.data') ? '/voz/piper_phonemize.data' : u });
        f.__saida = saida; return f;
      });
      await fz.preparar(); base = { ort, fz };
    }
    cfg = await (await fetch(URL_VOZ + '.json')).json();
    const modelo = await guardado(URL_VOZ, prog);
    sessao = await base.ort.InferenceSession.create(modelo, { executionProviders: ['wasm'] });
  }
  function ids(texto) {
    return base.fz.usar(texto, (fz) => {
      let res = null; const saida = fz.__saida, mapa = cfg.phoneme_id_map;
      saida.atual = (d) => { try { const j = JSON.parse(d); if (Array.isArray(j.phonemes)) {
        const id = (f) => mapa[f] || [], pad = id('_'), out = [...id('^'), ...pad];
        j.phonemes.forEach((f, i) => { const v = mapa[f]; if (!v) return; out.push(...v, ...pad); if (/^[.!?]$/.test(f) && i < j.phonemes.length - 1) out.push(...id('$'), ...id('^'), ...pad); });
        out.push(...id('$')); res = out; } else res = j.phoneme_ids; } catch (e) {} };
      try { fz.callMain(['-l', cfg.espeak.voice, '--input', JSON.stringify([{ text: texto }]), '--espeak_data', '/espeak-ng-data']); } finally { saida.atual = null; }
      if (!res) throw new Error('fonemizador'); return res;
    });
  }
  // UMA geração por vez (02/out/2026): o aquecimento dos avisos e a fala podem
  // se cruzar, e a mesma sessão do motor não roda duas ao mesmo tempo.
  let filaGeracao = Promise.resolve();
  function sintetizar(texto) {
    const p = filaGeracao.then(() => sintetizarJa(texto));
    filaGeracao = p.catch(() => {});
    return p;
  }
  // João, 02/out/2026: "ficou bom, só me parece ele falando muito rápido".
  // length_scale maior = fala mais devagar (o tom não muda). 1,15 ≈ 13% mais lento.
  // 04/out/2026 ("Jarvis, mais devagar" / "mais rápido"): o ritmo virou ajustável por voz e fica
  // guardado no aparelho (ritmoDaFala, lido aqui a cada frase gerada).
  async function sintetizarJa(texto) {
    // 1º) a voz do Oscar de mesa (só no Mac do João, quando o programa está de pé)
    const wav = await vozDoMac.gerar(texto, ritmoDaFala);
    if (wav) { garantirCtx(); const b = await ctx.decodeAudioData(wav); return { pcm: b.getChannelData(0), taxa: b.sampleRate }; }
    // 2º) o Piper, como sempre (sem ele carregado, a fala vai para a voz do aparelho)
    // no Mac o servidor caiu no meio: espera o Piper (a reserva) em vez de calar ou cair na voz do aparelho
    if (!sessao && ehMacDeMesa && possivel) await preparar();
    if (!sessao) throw new Error('voz do mac falhou e o Piper não está carregado');
    const o = base.ort, v = await ids(texto);
    const feeds = { input: new o.Tensor('int64', BigInt64Array.from(v.map(BigInt)), [1, v.length]), input_lengths: new o.Tensor('int64', BigInt64Array.from([BigInt(v.length)])),
      scales: new o.Tensor('float32', Float32Array.from([cfg.inference.noise_scale, cfg.inference.length_scale * ritmoDaFala, cfg.inference.noise_w])) };
    const r = await sessao.run(feeds); return { pcm: r.output.data, taxa: cfg.audio.sample_rate };
  }
  function destravar() {
    try { if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); analisador = ctx.createAnalyser(); analisador.fftSize = 256; analisador.connect(ctx.destination); }
      ctx.resume(); const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
  }
  // AGENDAR (02/out/2026): cada pedaço entra no RELÓGIO DO ÁUDIO, emendado no
  // fim do anterior, assim que fica pronto — sem esperar o anterior acabar. Antes
  // o seguinte só era marcado no `onended` do anterior: quando a tela estava
  // ocupada (folha 3D + raízes + a própria geração da voz), o aviso de "acabou"
  // chegava atrasado e sobrava um buraco entre as frases.
  function agendar(pcm, taxa, g) {
    return new Promise((ok) => {
      if (g !== geracao) return ok();
      let pico = 0; for (let i = 0; i < pcm.length; i++) pico = Math.max(pico, Math.abs(pcm[i]));
      const ganho = pico > .95 ? .95 / pico : 1, borda = Math.min(Math.floor(taxa * .012), pcm.length >> 1), out = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) { let k = ganho; if (i < borda) k *= i / borda; else if (i >= pcm.length - borda) k *= (pcm.length - 1 - i) / borda; out[i] = pcm[i] * k; }
      const buf = ctx.createBuffer(1, out.length, taxa); buf.copyToChannel(out, 0);
      const f = ctx.createBufferSource(); f.buffer = buf; f.connect(analisador); f.onended = () => { fontes.delete(f); ok(); };
      fontes.add(f); const ini = Math.max(ctx.currentTime + .03, fim); fim = ini + buf.duration; f.start(ini); inicios.push(ini);
    });
  }
  return {
    possivel, jaBaixada, preparar, destravar,
    get pronta() { return !!sessao || vozDoMac.ativa; },
    get vozDoMac() { return vozDoMac.ativa; },
    /** espera a voz natural (servidor do Mac ou Piper) ficar pronta, até `ms`; true = ficou */
    async esperarPronta(ms) {
      const ate = Date.now() + ms;
      if (!sessao && possivel) preparar().catch(() => {});
      while (Date.now() < ate) { if (sessao || vozDoMac.ativa) return true; await new Promise((ok) => setTimeout(ok, 150)); }
      return !!sessao || vozDoMac.ativa;
    },
    get tocando() { return fontes.size > 0; },
    /** Qual pedaço da fala atual está tocando agora (0, 1, …; -1 = nenhum começou). */
    pedacoTocando() { if (!ctx) return -1; const t = ctx.currentTime; let i = -1; inicios.forEach((x, k) => { if (x <= t) i = k; }); return i; },
    /** O ritmo mudou: as frases de espera já geradas saem de novo no ritmo novo. */
    esquecerProntas() { prontas.clear(); if (sessao) setTimeout(() => this.aquecer(AVISOS_DE_ESPERA), 300); },
    nivel() { if (!analisador || !fontes.size) return 0; const d = new Uint8Array(analisador.fftSize); analisador.getByteTimeDomainData(d); let s = 0; for (const v of d) s += (v - 128) * (v - 128); return Math.min(1, Math.sqrt(s / d.length) / 40); },
    // AQUECER: a primeira geração depois de carregar é a mais lenta (o motor
    // compila na hora). Gera já as frases de espera — e elas ficam prontas.
    async aquecer(frases) { for (const f of frases) { if (prontas.has(f)) continue; try { prontas.set(f, await sintetizar(f)); } catch (e) { return; } } },
    // FALAR — o 1º pedaço toca assim que fica pronto; os outros são gerados
    // ENQUANTO ele toca e entram emendados. Medido no iPhone do João (02/out,
    // 22:50): 2 pedaços gerados em 1,5 s para 14 s de fala — o celular gera ~10×
    // mais rápido do que fala, então não sobra buraco. Antes o iPhone gerava a
    // fala inteira antes de tocar (1,5–2 s de silêncio a mais); os "buracos" que
    // motivaram aquilo eram o microfone aberto (modo ligação), já resolvido.
    async falar(pedacos, aoFim) {
      this.parar(); const g = geracao;
      try { if (ctx && ctx.state !== 'running') await ctx.resume(); } catch (e) {}
      try {
        const t0 = performance.now(); let primeiro = 0, dur = 0, ultimo = Promise.resolve();
        for (let i = 0; i < pedacos.length; i++) {
          const a = prontas.get(pedacos[i]) || await sintetizar(pedacos[i]);
          if (g !== geracao) return;
          if (i === 0) { primeiro = performance.now() - t0; marcarVozComecou(); }
          dur += a.pcm.length / a.taxa;
          ultimo = agendar(a.pcm, a.taxa, g);
          await new Promise((ok) => setTimeout(ok, 0));     // devolve a vez à tela entre um pedaço e outro
          if (g !== geracao) return;
        }
        diag(`tts ${pedacos.length}p 1o ${Math.round(primeiro)}ms tudo ${Math.round(performance.now() - t0)}ms p/ ${Math.round(dur * 1000)}ms`);
        // rede de segurança: se o áudio for suspenso no meio (aba escondida), o
        // "acabou" nunca viria e o microfone nunca seria religado
        const resta = Math.max(0, fim - ctx.currentTime) * 1000 + 4000;
        await Promise.race([ultimo, new Promise((ok) => setTimeout(ok, resta))]);
      } catch (e) { console.log('[ao-vivo] voz natural falhou', e); diag('tts falhou ' + String(e && e.message || e).slice(0, 40)); }
      if (g === geracao) aoFim && aoFim();
    },
    // FALA EM FLUXO (03/out/2026, rapidez): as frases chegam do servidor UMA A UMA enquanto o
    // agente ainda escreve/consulta. Cada uma é gerada e AGENDADA no relógio do áudio assim que
    // chega (emendada na anterior); `fim()` diz que não vem mais nada — aí, quando o último pedaço
    // acaba de tocar, chama aoFim (e o microfone volta).
    fluxo(aoFim) {
      this.parar(); const g = geracao;
      const fila = []; let acabou = false, rodando = false, terminou = false, primeiro = true, ultimo = Promise.resolve();
      const t0 = performance.now();
      const terminar = () => { if (terminou || g !== geracao) return; terminou = true; aoFim && aoFim(); };
      const bomba = async () => {
        if (rodando) return; rodando = true;
        try {
          try { if (ctx && ctx.state !== 'running') await ctx.resume(); } catch (e) {}
          while (fila.length) {
            const p = fila.shift();
            const a = prontas.get(p) || await sintetizar(p);
            if (g !== geracao) return;
            if (primeiro) { primeiro = false; marcarVozComecou(); diag(`tts fluxo 1o ${Math.round(performance.now() - t0)}ms`); }
            ultimo = agendar(a.pcm, a.taxa, g);
            await new Promise((ok) => setTimeout(ok, 0));
            if (g !== geracao) return;
          }
        } catch (e) { console.log('[ao-vivo] voz natural (fluxo) falhou', e); diag('tts fluxo falhou ' + String(e && e.message || e).slice(0, 40)); }
        finally { rodando = false; }
        if (fila.length) return bomba();
        if (acabou && g === geracao) {
          const resta = Math.max(0, fim - (ctx ? ctx.currentTime : 0)) * 1000 + 4000;
          await Promise.race([ultimo, new Promise((ok) => setTimeout(ok, resta))]);
          if (!fila.length) terminar();
        }
      };
      return { mais(p) { if (g !== geracao || !p) return; fila.push(p); bomba(); }, fim() { acabou = true; bomba(); } };
    },
    parar() { geracao++; fim = 0; inicios = []; for (const f of fontes) { try { f.stop(); } catch (e) {} } fontes.clear(); },
  };
})();
// RITMO DA FALA (04/out/2026): 1,15 era o fixo (João, 02/out: "muito rápido"). "Jarvis, mais devagar"
// sobe 12%, "mais rápido" desce 12%; fica entre 0,85 e 1,75 e guardado no aparelho.
const RITMO_PADRAO = 1.15, RITMO_MIN = 0.85, RITMO_MAX = 1.75;
let ritmoDaFala = (() => { try { const v = Number(localStorage.getItem('ao-vivo-ritmo')); if (v >= RITMO_MIN && v <= RITMO_MAX) return v; } catch (e) {} return RITMO_PADRAO; })();
/** passo > 0 = mais devagar; < 0 = mais rápido. Devolve o ritmo novo (ou null se já está no limite). */
function mudarRitmo(passo) {
  const novo = Math.min(RITMO_MAX, Math.max(RITMO_MIN, +(ritmoDaFala * (passo > 0 ? 1.12 : 1 / 1.12)).toFixed(3)));
  if (Math.abs(novo - ritmoDaFala) < 0.005) return null;
  ritmoDaFala = novo;
  try { localStorage.setItem('ao-vivo-ritmo', String(novo)); } catch (e) {}
  VozNatural.esquecerProntas();
  diag('ritmo ' + novo);
  return novo;
}
/** A voz do aparelho acompanha o ritmo (0,95 era o fixo, no ritmo 1,15). */
const taxaDoAparelho = () => +(0.95 * RITMO_PADRAO / ritmoDaFala).toFixed(3);

// PRONÚNCIA DO TEMA (03/out/2026) — só no texto que vai para a VOZ (nunca na legenda nem nas janelas).
// O tema traz, como DADO: "pronuncia" (palavra → como se fala; ex.: "Tech" → "Téqui") e
// "codigosFalados" (expressão regular dos códigos de produto que a voz fala do jeito do campo:
// letras soletradas, os DOIS primeiros dígitos como número, o resto dígito a dígito com o 6 como
// "meia", o sufixo soletrado — "PRO"/"VIP" ficam como palavra). Ex.: AS1868PRO4 → "á ésse dezoito
// meia oito, PRO quatro". Sem tema (Oscarpes), não muda nada.
const LETRA = { A: 'á', B: 'bê', C: 'cê', D: 'dê', E: 'é', F: 'éfe', G: 'gê', H: 'agá', I: 'í', J: 'jota', K: 'cá', L: 'éle', M: 'ême', N: 'êne', O: 'ó', P: 'pê', Q: 'quê', R: 'érre', S: 'ésse', T: 'tê', U: 'ú', V: 'vê', W: 'dáblio', X: 'xis', Y: 'ípsilon', Z: 'zê' };
const UNID = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const doisDigitos = (n) => (n < 20 ? UNID[n] : DEZ[Math.floor(n / 10)] + (n % 10 ? ' e ' + UNID[n % 10] : ''));
const soletrar = (l) => l.split('').map((c) => LETRA[c] || c).join(' ');
function codigoFalado(cod) {
  // fallback quando o código não está no mapa "pronuncia" do tema (o mapa vence): letras soletradas;
  // 2 dígitos = número ("noventa e nove"); 3 = dígito a dígito ("três cinco meia"); 4 = par + dígitos
  // ("dezoito meia oito"); 5 = par + centena ("trinta e seis setecentos e cinquenta"); 6 vira "meia"
  // quando dito sozinho. O sufixo de tecnologia (PWU, PRO4…) não é falado.
  const m = /^([A-Z]{1,4})(\d{2,6})([A-Z]*)(\d*)$/.exec(cod);
  if (!m) return cod;
  const [, letras, num] = m;
  const dig = (d) => (d === '6' ? 'meia' : UNID[+d]);
  const umAUm = (x) => x.split('').map(dig).join(' ');
  const CENT = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const centena = (n) => (n === 100 ? 'cem' : n < 100 ? doisDigitos(n) : CENT[Math.floor(n / 100)] + (n % 100 ? ' e ' + doisDigitos(n % 100) : ''));
  let falado;
  if (num.length === 2) falado = doisDigitos(+num);
  else if (num.length === 3) falado = umAUm(num);
  else if (num.length === 4) falado = doisDigitos(+num.slice(0, 2)) + ' ' + umAUm(num.slice(2));
  else if (num.length === 5) falado = doisDigitos(+num.slice(0, 2)) + ' ' + centena(+num.slice(2));
  else falado = umAUm(num);
  return soletrar(letras) + ' ' + falado;
}
// UNIDADES FALADAS (05/out/2026, João: "a chuva que ele lê, mm tem que ler milímetros") — só no texto da VOZ;
// a legenda e as janelas continuam com as siglas. Um lugar só, para TODOS os temas (o "pronuncia" do tema.json
// cuida de nomes e códigos). Função pura — o portão scripts/conferir-unidades-faladas.mjs roda ela.
// <unidadesFaladas>
// o número antes da unidade (16,4 · 1.200 · 3) — "1" (ou "um") pede o singular
const NUM = '(\\d[\\d.]*(?:,\\d+)?)';
const umSo = (n) => /^(1|1,0+|um|uma)$/i.test(String(n).trim());
// [expressão da unidade (depois do número), plural, singular] — as compostas antes das simples (kg/ha antes de ha)
const UNIDADES = [
  ['mmol(?:c|<sub>c</sub>)?\\s*/\\s*dm(?:³|3)', 'milimol carga por decímetro cúbico', 'milimol carga por decímetro cúbico'],
  ['cmol(?:c|<sub>c</sub>)?\\s*/\\s*dm(?:³|3)', 'centimol carga por decímetro cúbico', 'centimol carga por decímetro cúbico'],
  ['mg\\s*/\\s*dm(?:³|3)', 'miligramas por decímetro cúbico', 'miligrama por decímetro cúbico'],
  ['g\\s*/\\s*dm(?:³|3)', 'gramas por decímetro cúbico', 'grama por decímetro cúbico'],
  ['sc\\s*/\\s*ha', 'sacas por hectare', 'saca por hectare'],
  ['kg\\s*/\\s*ha', 'quilos por hectare', 'quilo por hectare'],
  ['t\\s*/\\s*ha', 'toneladas por hectare', 'tonelada por hectare'],
  ['km\\s*/\\s*h', 'quilômetros por hora', 'quilômetro por hora'],
  ['mm', 'milímetros', 'milímetro'],
  ['ha', 'hectares', 'hectare'],
  ['[°º]\\s*C', 'graus', 'grau'],
  ['%', 'por cento', 'por cento'],
];
const RE = UNIDADES.map(([u, pl, sg]) => [new RegExp(NUM + '\\s*' + u + '(?![\\p{L}\\p{N}])', 'gu'), pl, sg]);
// unidade solta, já depois de número por extenso ("dezesseis mm", "trinta por cento" já vem certo)
const SOLTAS = [
  [/(?<![\p{L}\p{N}])sc\s*\/\s*ha(?![\p{L}\p{N}])/gu, 'sacas por hectare'],
  [/(?<![\p{L}\p{N}])kg\s*\/\s*ha(?![\p{L}\p{N}])/gu, 'quilos por hectare'],
  [/(?<![\p{L}\p{N}])km\s*\/\s*h(?![\p{L}\p{N}])/gu, 'quilômetros por hora'],
  [/(?<![\p{L}\p{N}])mm(?![\p{L}\p{N}])/gu, 'milímetros'],
  [/(?<![\p{L}\p{N}])mg\s*\/\s*dm(?:³|3)(?![\p{L}\p{N}])/gu, 'miligramas por decímetro cúbico'],
  [/[°º]\s*C(?![\p{L}\p{N}])/gu, ' graus'],
];

/** "16,4 mm" → "16,4 milímetros"; "1 mm" → "1 milímetro"; "3,2 sc/ha" → "3,2 sacas por hectare"; "64%" → "64 por cento". */
function unidadesFaladas(texto) {
  let s = String(texto == null ? '' : texto);
  for (const [re, pl, sg] of RE) s = s.replace(re, (_, n) => `${n} ${umSo(n) ? sg : pl}`);
  for (const [re, f] of SOLTAS) s = s.replace(re, f);
  return s.replace(/ {2,}/g, ' ');
}
// </unidadesFaladas>
// NÚMEROS COMO SE FALA (06/out/2026, madrugada — João: "conversar como se tivesse falando com minha esposa"). Medido no
// fonemizador do Piper (o mesmo espeak da página): "6,0" virava "seis vírgula zero", "12/fev" virava "doze fev" e "26 × 27"
// "vinte e seis vezes vinte e sete". Só no texto da VOZ (a legenda segue igual). Função pura — conferir-conversa-natural.ts roda.
// <numerosFalados>
const MESES_FALADOS = { jan: 'janeiro', fev: 'fevereiro', mar: 'março', abr: 'abril', mai: 'maio', jun: 'junho', jul: 'julho', ago: 'agosto', set: 'setembro', out: 'outubro', nov: 'novembro', dez: 'dezembro' };
function numerosFalados(texto) {
  return String(texto == null ? '' : texto)
    .replace(/(\d),0(?![\d,])/g, '$1')
    .replace(/\b(\d{1,2})\/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b\.?/gi, (m, d, mes) => `${+d === 1 ? 'primeiro' : +d} de ${MESES_FALADOS[mes.toLowerCase()]}`)
    .replace(/(\d|\p{L})\s*[×x]\s*(?=\d)/gu, (m, a) => (/\d/.test(a) || /[×]/.test(m) ? `${a} contra ` : m))
    .replace(/(\d)\s*×\s*(?=\p{L})/gu, '$1 contra ')
    .replace(/([\p{L}\d]) [xX] (?=[A-Z]{1,4} ?\d|\d)/gu, '$1 contra ');
}
// </numerosFalados>
let RE_CODIGOS = null;
try { if (TEMA.codigosFalados) RE_CODIGOS = new RegExp(TEMA.codigosFalados, 'g'); } catch (e) {}
const PRONUNCIA = Object.entries(TEMA.pronuncia || {}).filter(([de, para]) => de && typeof para === 'string');
function pronunciar(t) {
  // 05/out/2026 (João: "mm tem que ler milímetros"): as unidades na forma falada, em TODO tema (unidades-faladas.js)
  let s = unidadesFaladas(numerosFalados(String(t || '')));
  for (const [de, para] of PRONUNCIA) s = s.replace(new RegExp('(?<![\\p{L}\\p{N}])' + de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'gu'), para);
  if (RE_CODIGOS) s = s.replace(RE_CODIGOS, (m) => codigoFalado(m));
  return s;
}
// NUNCA A VOZ DO APARELHO NO MAC (06/out/2026, João): no Mac de mesa, sem a voz natural pronta, a fala ESPERA o Piper
// (a legenda mostra o texto) — e se ele não ficar pronto em ESPERA_PIPER_MS, fica só a legenda. A voz do aparelho
// (speechSynthesis) é último recurso FORA do Mac, e mesmo lá preferindo uma voz MASCULINA pt-BR.
const SEM_VOZ_DO_APARELHO = ehMacDeMesa;
const ESPERA_PIPER_MS = 30000;
const Voz = (() => {
  const s = SEM_VOZ_DO_APARELHO ? null : window.speechSynthesis;
  let escolhida = null, falandoAgora = '', naturalTocando = false;
  // REPETE / PARA / CONTINUA (04/out/2026, João: "Jarvis, repete", "para", "continua"): a última
  // resposta inteira (o "repete" fala ela de novo), os pedaços da fala atual e de onde ela foi cortada.
  let ultimaFala = '', pecas = [], iAparelho = 0, interrompida = null;
  function escolher() {
    if (!s) return null;
    const vs = s.getVoices().filter((v) => /^pt(-|_)BR/i.test(v.lang) || /portugu.*brasil/i.test(v.name));
    const brinquedo = /eddy|flo|grandpa|grandma|reed|rocko|sandy|shelley|bad news|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|bahh|fred|junior|kathy|ralph/i;
    // <escolherVoz> masculina primeiro (06/out/2026): a feminina do aparelho o João descartou
    const nota = (v) => (brinquedo.test(v.name) ? -50 : 0) + (/premium|natural|enhanced|melhorad|neural|online/i.test(v.name) ? 6 : 0)
      + (/felipe|daniel|antonio|ricardo|bruno|paulo|male|masculin/i.test(v.name) && !/female|feminin/i.test(v.name) ? 20 : 0)
      + (/luciana|francisca|thalita|fernanda|joana|maria|helena|vitoria|female|feminin/i.test(v.name) ? -8 : 0)
      + (/google/i.test(v.name) ? 1 : 0) + (/pt-BR/i.test(v.lang) ? 2 : 0);
    // </escolherVoz>
    vs.sort((a, b) => nota(b) - nota(a));
    return vs[0] && nota(vs[0]) > -50 ? vs[0] : null;
  }
  if (s) { s.onvoiceschanged = () => { escolhida = escolher(); }; escolhida = escolher(); }
  // pedaços por frase (o iPhone corta fala longa). 02/out/2026: a 1ª frase vai
  // SOZINHA — é ela que a voz natural gera antes de começar a falar, e frase
  // curta fica pronta em ~0,3 s (as outras são geradas enquanto ela toca).
  function partes(t) {
    const frases = String(pronunciar(t)).split(/(?<=[.!?;:])\s+/).filter(Boolean);
    const out = []; let atual = '';
    if (frases.length > 1 && frases[0].length <= 190) out.push(frases.shift());
    for (const f of frases) { if ((atual + ' ' + f).length > 190 && atual) { out.push(atual); atual = f; } else atual = (atual + ' ' + f).trim(); }
    if (atual) out.push(atual); return out;
  }
  let vigiaAparelho = null;
  // Voz do aparelho com rede de segurança: o Chrome às vezes NÃO avisa o fim de
  // uma frase (onend some) — com a conversa em turnos, o microfone ficaria
  // esperando para sempre. Passado o tempo razoável da frase, segue.
  function falarAparelho(ps, aoFim) {
    escolhida = escolhida || escolher();
    let i = 0;
    const prox = () => {
      clearTimeout(vigiaAparelho);
      if (i >= ps.length) { falandoAgora = ''; aoFim && aoFim(); return; }
      iAparelho = i;
      const txt = ps[i++];
      const u = new SpeechSynthesisUtterance(txt); u.lang = 'pt-BR'; if (escolhida) u.voice = escolhida; u.rate = taxaDoAparelho();
      let foi = false; const seguir = () => { if (foi) return; foi = true; prox(); };
      u.onboundary = () => Esfera.pulso(0.4);
      u.onstart = () => { Esfera.pulso(0.8); marcarVozComecou(); };
      u.onend = seguir; u.onerror = seguir;
      falaAtual = u;                         // segura a referência (o Chrome perde o onend de frase "solta")
      s.speak(u);
      vigiaAparelho = setTimeout(seguir, 4000 + txt.length * 110);
    };
    prox();
  }
  let falaAtual = null;
  return {
    get falando() { return naturalTocando || VozNatural.tocando || !!(s && (s.speaking || s.pending)); },
    get texto() { return falandoAgora; },
    /** 05/out/2026 (a "caixa do momento"): o PEDAÇO que está tocando agora (a frase dita neste instante), '' se calado. */
    get pedacoAtual() {
      if (!this.falando) return '';
      const k = VozNatural.pronta && naturalTocando ? VozNatural.pedacoTocando() : iAparelho;
      return k >= 0 ? String(pecas[k] || '') : '';
    },
    /** A última resposta falada inteira (o "repete"). */
    get ultimaFala() { return ultimaFala; },
    /** A fala cortada no meio: { pecas, de, em } (o "continua" retoma do pedaço que tocava). */
    get interrompida() { return interrompida; },
    esquecerInterrompida() { interrompida = null; },
    /** Fala os pedaços dados (o "continua"), sem mudar a "última resposta". */
    falarPedacos(ps, aoFim) {
      const guardada = ultimaFala; this.falar(ps.join(' '), aoFim); ultimaFala = guardada;
    },
    destravar() { VozNatural.destravar(); try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; s && s.speak(u); } catch (e) {} },
    falar(texto, aoFim) {
      this.parar(); interrompida = null; falandoAgora = texto; ultimaFala = texto;
      const ps = partes(texto); pecas = ps.slice(); iAparelho = 0;
      if (VozNatural.pronta) {
        naturalTocando = true;
        VozNatural.falar(ps, () => { naturalTocando = false; falandoAgora = ''; aoFim && aoFim(); });
        return;
      }
      if (SEM_VOZ_DO_APARELHO) {
        // no Mac: espera o Piper (a legenda já mostra o texto); sem ele, só a legenda — nunca a voz feminina
        diag('voz: esperando a voz natural (Mac)');
        VozNatural.esperarPronta(ESPERA_PIPER_MS).then((pronta) => {
          if (falandoAgora !== texto) return;
          if (pronta) { naturalTocando = true; VozNatural.falar(ps, () => { naturalTocando = false; falandoAgora = ''; aoFim && aoFim(); }); return; }
          diag('voz: sem voz natural no Mac — só a legenda');
          setTimeout(() => { if (falandoAgora === texto) { falandoAgora = ''; aoFim && aoFim(); } }, Math.min(15000, 1500 + texto.length * 60));
        });
        return;
      }
      if (!s) { aoFim && aoFim(); return; }
      // o Chrome engole a fala dada logo depois de um cancel(): um respiro curto
      setTimeout(() => { if (falandoAgora === texto) falarAparelho(ps, aoFim); }, 60);
    },
    // FALA EM FLUXO (03/out/2026): a resposta chega frase a frase (rota /voz com `fluxo`).
    // Devolve { mais(frase), fim() }; aoFim quando a última frase acabou de tocar.
    fluxo(aoFim) {
      this.parar(); interrompida = null; falandoAgora = ''; ultimaFala = ''; pecas = []; iAparelho = 0;
      const acabar = () => { naturalTocando = false; falandoAgora = ''; aoFim && aoFim(); };
      if (VozNatural.pronta) {
        naturalTocando = true;
        const f = VozNatural.fluxo(acabar);
        return { mais: (t) => { falandoAgora = (falandoAgora + ' ' + t).trim(); ultimaFala = falandoAgora; for (const p of partes(t)) { pecas.push(p); f.mais(p); } }, fim: () => f.fim() };
      }
      if (SEM_VOZ_DO_APARELHO) {
        // no Mac: as frases esperam o Piper numa fila; pronto, vão todas para a voz natural; sem ele, só a legenda
        const espera = []; let f = null, fechou = false, desistiu = false;
        VozNatural.esperarPronta(ESPERA_PIPER_MS).then((pronta) => {
          if (!pronta) { desistiu = true; diag('voz: sem voz natural no Mac — só a legenda'); if (fechou) acabar(); return; }
          naturalTocando = true; f = VozNatural.fluxo(acabar);
          for (const p of espera) f.mais(p); if (fechou) f.fim();
        });
        return {
          mais: (t) => { falandoAgora = (falandoAgora + ' ' + t).trim(); ultimaFala = falandoAgora; for (const p of partes(t)) { pecas.push(p); if (f) f.mais(p); else espera.push(p); } },
          fim: () => { fechou = true; if (f) f.fim(); else if (desistiu) acabar(); },
        };
      }
      if (!s) return { mais() {}, fim() { acabar(); } };
      // voz do aparelho: uma fila de frases; cada uma espera a anterior (com a mesma rede de segurança)
      escolhida = escolhida || escolher();
      const fila = []; let falandoUma = false, acabou = false, terminou = false;
      const prox = () => {
        clearTimeout(vigiaAparelho);
        if (!fila.length) { falandoUma = false; if (acabou && !terminou) { terminou = true; acabar(); } return; }
        falandoUma = true;
        const txt = fila.shift(); iAparelho = pecas.length - fila.length - 1;
        const u = new SpeechSynthesisUtterance(txt); u.lang = 'pt-BR'; if (escolhida) u.voice = escolhida; u.rate = taxaDoAparelho();
        let foi = false; const seguir = () => { if (foi) return; foi = true; prox(); };
        u.onboundary = () => Esfera.pulso(0.4);
        u.onstart = () => { Esfera.pulso(0.8); marcarVozComecou(); };
        u.onend = seguir; u.onerror = seguir;
        falaAtual = u; s.speak(u);
        vigiaAparelho = setTimeout(seguir, 4000 + txt.length * 110);
      };
      return {
        mais: (t) => { falandoAgora = (falandoAgora + ' ' + t).trim(); ultimaFala = falandoAgora; const ps = partes(t); pecas.push(...ps); fila.push(...ps); if (!falandoUma) setTimeout(() => { if (!falandoUma) prox(); }, 60); },
        fim: () => { acabou = true; if (!falandoUma) setTimeout(() => { if (!falandoUma) prox(); }, 60); },
      };
    },
    // AVISO DE ESPERA (02/out/2026, João: "diminuir para 2 segundos"): a resposta
    // leva de 3 a 15 s (o agente consulta o banco); um "Um instante." curto sai
    // logo e a voz não fica muda. Devolve a promessa do fim — a resposta espera
    // ele acabar (nunca corta no meio). Não religa o microfone.
    avisar(texto) {
      return new Promise((ok) => {
        if (VozNatural.pronta) { naturalTocando = true; VozNatural.falar([texto], () => { naturalTocando = false; ok(); }); setTimeout(ok, 6000); return; }
        if (!s) return ok();            // no Mac sem a voz natural: o aviso de espera fica calado (nunca a voz do aparelho)
        try { s.cancel(); } catch (e) {}
        const u = new SpeechSynthesisUtterance(texto); u.lang = 'pt-BR'; escolhida = escolhida || escolher(); if (escolhida) u.voice = escolhida; u.rate = taxaDoAparelho();
        u.onend = () => ok(); u.onerror = () => ok(); falaAtual = u; s.speak(u); setTimeout(ok, 5000);
      });
    },
    parar() {
      // cortou uma resposta no meio (toque, "para", pergunta nova…): guarda de onde, para o "continua"
      if (falandoAgora && pecas.length && this.falando) {
        const k = VozNatural.pronta && naturalTocando ? VozNatural.pedacoTocando() : iAparelho;
        interrompida = { pecas: pecas.slice(), de: Math.max(0, k), em: Date.now() };
      }
      falandoAgora = ''; naturalTocando = false; clearTimeout(vigiaAparelho); VozNatural.parar(); try { s && s.cancel(); } catch (e) {}
    },
  };
})();

// a folha segue o SOM da voz natural (amplitude real)
setInterval(() => { if (fase === 'falando' && VozNatural.pronta) { const n = VozNatural.nivel(); if (n > 0.05) Esfera.pulso(n * 0.6); } }, 70);

export {
  VozNatural, Voz, pronunciar, codigoFalado, mudarRitmo,
};
