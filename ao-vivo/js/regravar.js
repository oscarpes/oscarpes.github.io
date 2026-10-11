// OSCARPES AO VIVO — regravar.js
// REGRAVAÇÃO (04/out/2026) — João filmou com dois celulares uma conversa com o Jarvis na TV do
// escritório (04/out, 11:03–11:11 de Cuiabá) e quer, para a edição do vídeo, a MESMA conversa gravada
// limpa da tela. Este modo refaz as perguntas daquele dia, no mesmo ritmo, e a página se grava sozinha.
//
// COMO FUNCIONA
//  - Endereço: /ao-vivo/?regravar=<id>. O roteiro mora em regravacoes/<id>.json: a ORDEM das perguntas,
//    o intervalo original entre elas e o id de cada fala no log (whatsapp_conversas). O TEXTO das
//    perguntas NÃO está no arquivo (o site é público e as perguntas citam cliente): ele é lido do
//    log com a sessão do João — a tabela só abre para admin (RLS is_admin()), então quem não é admin
//    não recebe nem as perguntas. O "[Nota do servidor: …]" que o servidor cola na frente sai aqui.
//  - Nunca dispara sozinho: precisa do ?regravar= E do clique em GRAVAR REGRAVAÇÃO, e o botão só
//    acende depois de o servidor dizer que a pessoa é admin (sou_admin) e de as falas chegarem.
//  - O clique pede ao Chrome "compartilhar esta aba" (getDisplayMedia) e grava com MediaRecorder.
//    Depois anda sozinho: 3 s, e pergunta por pergunta, cada uma pelo mesmo caminho da caixa de texto
//    (perguntar) — as janelas voam como no uso normal. Entre uma e outra vale o intervalo original,
//    mas nunca antes de a resposta anterior acabar de ser falada (nada se sobrepõe).
//  - Tela limpa: sem cursor, sem a caixa de texto, sem o microfone (o reconhecimento NÃO liga —
//    a voz do Jarvis não pode virar pergunta), modo apresentação ligado e música desligada (a
//    edição põe a trilha dela; "musica": true no JSON liga).
//  - No fim baixa regravacao-<id>-<data>.webm (vai para Downloads). Parar o compartilhamento pela
//    barra do Chrome também encerra e salva o que já foi gravado.
//  - Som: só a VOZ NATURAL (que toca dentro da aba) entra na gravação; a voz do aparelho sai pelo
//    sistema e o Chrome não captura — por isso a regravação espera a voz natural ficar pronta.
//  - ?demo&regravar=<id> (só em localhost): sem servidor, com as perguntas inventadas do JSON
//    (texto_demo) e as respostas do demo — para conferir o ritmo, o botão e a gravação.
//    &rapido=N (só no demo) divide os intervalos por N.
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import './porta-reuniao.js?v=20261010213811';
import { $, ANON, DEMO, SUPABASE_URL, diag, esc, linkEntrar } from './base.js?v=20261010213811';
import { fase, mudarFase } from './cena.js?v=20261010213811';
import { Voz, VozNatural } from './voz.js?v=20261010213811';
import { token } from './servidor.js?v=20261010213811';
import { ocupado, perguntar } from './ouvido.js?v=20261010213811';
import { Apresentacao } from './controle.js?v=20261010213811';
import { Musica } from './musica.js?v=20261010213811';

// <idDaRegravacao> — função pura (o portão roda ela): o id do roteiro no endereço, ou null
function idDaRegravacao(busca) { const v = new URLSearchParams(busca || '').get('regravar'); return v && /^[a-z0-9-]{1,60}$/.test(v) ? v : null; }
// </idDaRegravacao>
// <falaDoJoao> — função pura: tira do começo as "[Nota do servidor: …]" (uma linha cada, seguida de
// linha em branco) que o servidor cola na pergunta gravada no log; sobra o que o João falou
function falaDoJoao(pergunta) {
  let t = String(pergunta || '');
  for (let i = 0; i < 6 && /^\s*\[Nota do servidor:/.test(t); i++) { const k = t.indexOf('\n\n'); if (k < 0) return ''; t = t.slice(k + 2); }
  return t.trim();
}
// </falaDoJoao>
// <filaDaRegravacao> — função pura: confere o roteiro e devolve as perguntas NA ORDEM do arquivo
// ({ ordem, conversaId, textoDemo, intervaloMs }). "ordem" tem que ser 1, 2, 3… igual à posição —
// um roteiro embaralhado ou com intervalo estranho para tudo antes de gravar.
function filaDaRegravacao(roteiro, rapido) {
  const lista = roteiro && Array.isArray(roteiro.perguntas) ? roteiro.perguntas : [];
  if (!lista.length) throw new Error('roteiro sem perguntas');
  const div = rapido > 1 ? rapido : 1;
  return lista.map((p, i) => {
    if (!p || p.ordem !== i + 1) throw new Error(`pergunta ${i + 1} fora de ordem`);
    if (!/^[0-9a-f-]{36}$/.test(String(p.conversa_id || ''))) throw new Error(`pergunta ${i + 1} sem conversa_id`);
    const s = Number(p.intervalo_s);
    if (!isFinite(s) || s < 0 || s > 600 || (i === 0 && s !== 0)) throw new Error(`pergunta ${i + 1} com intervalo inválido`);
    return { ordem: p.ordem, conversaId: p.conversa_id, textoDemo: String(p.texto_demo || '').trim(), intervaloMs: Math.round((s * 1000) / div) };
  });
}
// </filaDaRegravacao>

const REGRAVAR_ID = idDaRegravacao(location.search);
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const dormir = (ms) => new Promise((ok) => setTimeout(ok, Math.max(0, ms)));

const Regravacao = (() => {
  let roteiro = null, fila = [], textos = [], liberado = false, rodando = false, encerrado = false;
  let captura = null, gravador = null, pedacos = [], tipo = '', travaTela = null;
  let prepararVoz = async () => {};

  function caixa() { return document.querySelector('#abertura .caixa'); }
  function estado(html) { const e = $('regravarEstado'); if (e) e.innerHTML = html; }
  /** A abertura vira a da regravação: título, resumo e o botão (apagado até tudo conferir). */
  function montarTela() {
    const cx = caixa(); if (!cx) return;
    const h1 = cx.querySelector('h1'); if (h1) h1.textContent = 'REGRAVAÇÃO';
    const p = cx.querySelector('p'); if (p) p.textContent = 'Preparando a regravação…';
    const ini = $('comecar'); if (ini) ini.style.display = 'none';
    const b = document.createElement('button'); b.id = 'gravarRegravacao'; b.type = 'button'; b.disabled = true; b.textContent = 'GRAVAR REGRAVAÇÃO';
    const st = document.createElement('div'); st.id = 'regravarEstado'; st.className = 'nota';
    cx.appendChild(b); cx.appendChild(st);
    b.onclick = () => { if (liberado && !rodando && !encerrado) comecarRegravacao(); };   // o ÚNICO jeito de começar
  }

  // ---- ADMIN e as falas do log (com a sessão do João; o servidor decide o que ele vê) ----
  async function rest(caminho, opcoes = {}) {
    const t = await token();
    if (!t) throw Object.assign(new Error('sem sessão'), { login: true });
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + caminho, { ...opcoes, headers: { apikey: ANON, authorization: 'Bearer ' + t, 'content-type': 'application/json', ...(opcoes.headers || {}) } });
    if (r.status === 401) throw Object.assign(new Error('sessão vencida'), { login: true });
    if (!r.ok) throw new Error('servidor ' + r.status);
    return r.json();
  }
  async function souAdmin() { return (await rest('rpc/sou_admin', { method: 'POST', body: '{}' })) === true; }
  async function falasDoLog(ids) {
    const linhas = await rest('whatsapp_conversas?select=id,pergunta&id=in.(' + ids.join(',') + ')');
    const porId = new Map((linhas || []).map((l) => [l.id, falaDoJoao(l.pergunta)]));
    return ids.map((id) => porId.get(id) || '');
  }

  async function preparar(id, opcoes) {
    prepararVoz = opcoes.prepararVoz || prepararVoz;
    montarTela();
    try {
      if (DEMO && !LOCAL) throw new Error('o demo da regravação só roda no computador de teste (localhost)');
      const r = await fetch('regravacoes/' + id + '.json?c=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('roteiro "' + id + '" não encontrado');
      roteiro = await r.json();
      const rapido = DEMO ? Number(new URLSearchParams(location.search).get('rapido')) || 1 : 1;
      fila = filaDaRegravacao(roteiro, rapido);
      if (DEMO) textos = fila.map((q) => q.textoDemo);
      else {
        estado('Conferindo o acesso…');
        if (!(await souAdmin())) throw new Error('a regravação é só para administrador');
        textos = await falasDoLog(fila.map((q) => q.conversaId));
      }
      const falta = textos.findIndex((t) => !t);
      if (falta >= 0) throw new Error(`não achei a fala da pergunta ${falta + 1} no log`);
    } catch (e) {
      const login = e && e.login;
      const p = caixa() && caixa().querySelector('p');
      if (p) p.textContent = login ? 'Entre no app neste Chrome (mesmo endereço) e abra este link de novo.' : 'A regravação não pode começar.';
      estado(esc(e && e.message ? e.message : String(e)) + (login ? ' — <a href="' + linkEntrar() + '">Entrar no app</a>' : ''));
      diag('regravar recusada');
      return;
    }
    const total = fila.reduce((s, q) => s + q.intervaloMs, 0);
    const p = caixa() && caixa().querySelector('p');
    if (p) p.textContent = `${roteiro.titulo || REGRAVAR_ID} · ${fila.length} perguntas · uns ${Math.max(1, Math.round(total / 60000))} min. ` +
      'Um clique: o Chrome pede para compartilhar ESTA aba (deixe "compartilhar o áudio da aba" ligado) e o resto anda sozinho. Não troque de aba enquanto grava.';
    // a voz natural é a única que entra na gravação (a do aparelho sai pelo sistema)
    estado('Preparando a voz natural…');
    if (VozNatural.possivel && (!DEMO || await VozNatural.jaBaixada())) {
      // termina quando a voz fica pronta OU falha (aí não adianta esperar os 2 min)
      await Promise.race([Promise.resolve(prepararVoz()).catch(() => {}), dormir(120000)]);
    }
    estado(VozNatural.pronta ? 'Pronto para gravar.' : '<b>Atenção:</b> a voz natural não ficou pronta — a voz do aparelho NÃO sai na gravação (só a imagem).');
    liberado = true;
    $('gravarRegravacao').disabled = false;
    diag('regravar pronta ' + fila.length);
  }

  // ---- A GRAVAÇÃO DA PRÓPRIA ABA ----
  async function abrirCaptura() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error('este navegador não grava a aba (use o Chrome do computador)');
    const tentativas = [
      { video: { displaySurface: 'browser', frameRate: 30, width: 3840, height: 2160 }, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include' },
      { video: { displaySurface: 'browser', frameRate: 30 }, audio: true, preferCurrentTab: true },
      { video: { frameRate: 30 }, audio: true },
      { video: true, audio: true },
      { video: true },
    ];
    let ultimo = null;
    for (const op of tentativas) {
      try { return await navigator.mediaDevices.getDisplayMedia(op); }
      catch (e) { ultimo = e; if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError' || e.name === 'InvalidStateError')) break; }   // recusou: não insiste
    }
    throw ultimo || new Error('sem captura');
  }
  function escolherTipo() {
    const op = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,opus', 'video/mp4'];
    return op.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  }
  function nomeDoArquivo() {
    const d = new Date(), z = (n) => String(n).padStart(2, '0');
    const ext = /mp4/.test(tipo) ? 'mp4' : 'webm';
    return `regravacao-${REGRAVAR_ID}-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}h${z(d.getMinutes())}.${ext}`;
  }

  async function comecarRegravacao() {
    rodando = true; $('gravarRegravacao').disabled = true;
    Voz.destravar();                                          // o clique libera o som da voz natural
    try { captura = await abrirCaptura(); }
    catch (e) { rodando = false; $('gravarRegravacao').disabled = false; estado('O Chrome não liberou a gravação da aba (' + esc(e && e.name || e) + '). Clique de novo e escolha "esta aba".'); return; }
    const v = captura.getVideoTracks()[0];
    const ajuste = v && v.getSettings ? v.getSettings() : {};
    diag(`regravar captura ${ajuste.displaySurface || '?'} ${ajuste.width || '?'}x${ajuste.height || '?'} audio:${captura.getAudioTracks().length}`);
    try { if (v && 'contentHint' in v) v.contentHint = 'detail'; } catch (e) {}
    if (v) v.addEventListener('ended', () => { if (!encerrado) encerrar('compartilhamento parado'); });
    tipo = escolherTipo();
    pedacos = [];
    try { gravador = new MediaRecorder(captura, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 16_000_000, audioBitsPerSecond: 192_000 }); }
    catch (e) { gravador = new MediaRecorder(captura); }
    tipo = gravador.mimeType || tipo || 'video/webm';
    gravador.ondataavailable = (ev) => { if (ev.data && ev.data.size) pedacos.push(ev.data); };
    gravador.onstop = salvar;
    // tela limpa: sem cursor, sem caixa de texto, sem abertura; apresentação e música conforme o roteiro
    document.body.classList.add('regravando');
    $('abertura').style.display = 'none';
    try { if (navigator.wakeLock) travaTela = await navigator.wakeLock.request('screen'); } catch (e) {}
    if (roteiro.apresentacao !== false && !Apresentacao.ativa) Apresentacao.ligar();
    if (roteiro.musica === true) Musica.comecar();
    mudarFase('espera');
    gravador.start(1000);
    rodarRoteiro().catch((e) => { console.log('[ao-vivo] regravar', e); encerrar('erro'); });
  }

  /** Espera a resposta em curso acabar de ser falada (calma por 800 ms seguidos; teto 3 min). */
  async function respostaAcabou() {
    const t0 = Date.now(); let calmaDesde = 0;
    while (Date.now() - t0 < 180000 && !encerrado) {
      const calmo = !ocupado && !Voz.falando && fase !== 'pensando' && fase !== 'falando';
      if (!calmo) calmaDesde = 0; else if (!calmaDesde) calmaDesde = Date.now(); else if (Date.now() - calmaDesde >= 800) return;
      await dormir(150);
    }
  }
  async function rodarRoteiro() {
    const seg = (k, padrao) => { const n = Number(roteiro[k]); return (isFinite(n) && n >= 0 ? n : padrao) * 1000; };
    await dormir(seg('pausa_inicial_s', 3));
    let ultimoEnvio = 0;
    for (let i = 0; i < fila.length && !encerrado; i++) {
      if (i > 0) {
        await respostaAcabou();
        const alvo = Math.max(ultimoEnvio + fila[i].intervaloMs, Date.now() + seg('folga_minima_s', 1.5));
        await dormir(alvo - Date.now());
      }
      if (encerrado) return;
      ultimoEnvio = Date.now();
      diag(`regravar ${i + 1}/${fila.length}`);
      // o mesmo caminho da caixa de texto; semComando: a frase vai ao Jarvis (como foi naquele dia), não a um comando local
      perguntar(textos[i], undefined, { semComando: true });
    }
    await respostaAcabou();
    await dormir(seg('cauda_s', 4));
    encerrar('fim do roteiro');
  }
  function encerrar(motivo) {
    if (encerrado) return;
    encerrado = true; diag('regravar fim: ' + motivo);
    try { if (gravador && gravador.state !== 'inactive') gravador.stop(); else salvar(); } catch (e) { salvar(); }
    try { captura && captura.getTracks().forEach((t) => t.stop()); } catch (e) {}
    try { travaTela && travaTela.release(); } catch (e) {}
  }
  let salvo = false;
  function salvar() {
    if (salvo) return; salvo = true;
    document.body.classList.remove('regravando');
    const blob = new Blob(pedacos, { type: tipo || 'video/webm' });
    const nome = nomeDoArquivo();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    window.AO_VIVO_REGRAVACAO_ARQUIVO = { nome, bytes: blob.size, tipo: blob.type };
    // a mensagem fica na tela (a gravação já parou: ela não entra no vídeo)
    const ab = $('abertura'); ab.style.display = '';
    const cx = caixa();
    if (cx) {
      cx.querySelector('h1').textContent = 'PRONTO';
      cx.querySelector('p').textContent = `Pronto, arquivo salvo em Downloads: ${nome} (${(blob.size / 1048576).toFixed(0)} MB).`;
      const b = $('gravarRegravacao'); if (b) b.remove();
      const outra = document.createElement('button'); outra.type = 'button'; outra.className = 'regravar-outra'; outra.textContent = 'SALVAR TAMBÉM EM OUTRA PASTA';
      // escolher a pasta pede um clique (o Chrome só abre o seletor com gesto) — o Downloads já está salvo
      if (window.showSaveFilePicker) outra.onclick = async () => {
        try { const h = await window.showSaveFilePicker({ suggestedName: nome }); const w = await h.createWritable(); await w.write(blob); await w.close(); estado('Salvo também na pasta escolhida.'); }
        catch (e) { if (e && e.name !== 'AbortError') estado('Não salvou na outra pasta: ' + esc(e.name || e)); }
      };
      if (window.showSaveFilePicker) cx.appendChild(outra);
    }
    estado(pedacos.length ? '' : '<b>A gravação saiu vazia.</b>');
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
  }

  return { preparar, get ativa() { return rodando; } };
})();

/** main.js chama ao carregar: só faz algo com ?regravar=<id> no endereço. */
function ligarRegravacao(opcoes = {}) {
  if (!REGRAVAR_ID) return false;
  Regravacao.preparar(REGRAVAR_ID, opcoes);
  return true;
}

export {
  REGRAVAR_ID, Regravacao, idDaRegravacao, falaDoJoao, filaDaRegravacao, ligarRegravacao,
};
