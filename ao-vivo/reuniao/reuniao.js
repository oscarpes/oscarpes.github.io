// OSCARPES AO VIVO — reuniao/reuniao.js
// JARVIS REUNIÃO (06/out/2026): a página do telão na reunião.
//   • ouve a sala o tempo todo (reconhecimento do Chrome, pt-BR) para a legenda e o painel NA HORA;
//   • em paralelo GRAVA a sala em trechos de 10 s e manda ao balcão do Mac (127.0.0.1:47815): Whisper + ECAPA no
//     próprio Mac dizem QUEM falou (João: "a pessoa avisar toda hora que é ela que está falando não tem fundamento").
//     Voz nova vira "Voz 2" e o painel pergunta o nome UMA vez; a ata usa essa transcrição com nome;
//   • cada frase passa pelas regras de extrair.js e o PAINEL se monta sozinho;
//   • o Oscar só FALA quando chamado pelo nome; CARTÕES AUTOMÁTICOS chegam calados na coluna "Na mesa" quando o
//     assunto pede (chuva, financeiro, laboratório, estoque, clientes, pragas), no máximo 1 por assunto a cada 10 min;
//   • PERMISSÃO: dado sensível com gente sem acesso na sala só aparece depois do sim de um sócio/admin (pela voz
//     reconhecida ou pelo clique de quem está logado como admin); tudo vai para a ata;
//   • faixa de vídeo (câmera da sala + quadrinho de cada pessoa), ladrilho do Claude Code e o mascote (a folha);
//   • "Oscar, encerra a reunião" → ata (HTML escuro + texto), salva no Mac e no segundo cérebro pelo balcão.
// TEMA (?tema=brevant): a página usa a marca e a PERSONA da empresa (o servidor, rota whatsapp/voz com o tema, prende o
// agente à org dela e à persona dela — a persona da Oscarpes, com as regras dela, nunca vale para outra marca).
// Nada aqui manda mensagem a ninguém nem publica: o zap da ata é só com o sim do João.
// DENTRO DO JARVIS (06/out/2026, João: "a reunião vira um MODO do Jarvis"): esta página deixou de ser solta. modo.js a
// monta numa SOMBRA (shadow DOM) por cima da cena do Jarvis e chama iniciar(); por isso $ procura na sombra (RAIZ) e
// nada aqui roda sozinho ao carregar. O Jarvis empresta a PONTE (porta-reuniao.js): pausa o ouvido e a voz dele
// durante a reunião, deixa os comandos locais dele valendo e devolve tudo em "Voltar ao Jarvis".
// No Mac do João o balcão (127.0.0.1:47815) faz o pesado (quem fala, fila do Claude Code, ata no cofre) — a página
// pergunta uma vez se ele está ali (/api/saude) e, sem ele, segue sem (ata por download).
import { ASSUNTOS, ASSUNTOS_SENSIVEIS, assuntosDe, classificar, contextoDaReuniao, convitesParaMandar, corrigirNomes, definirNomesExtra, falaDegenerada, fazendaCitada, pedidoSemNome, perguntaDeDiagnostico, problemaRelatado, mesmoNome, norm, pedidoDeAdmitir, pedidoDeConviteNaReuniao, perguntaDoPainel, respostaDePermissao, sensivel, trocaDeQuemFala } from './extrair.js?v=20261010213811';
import { MASCOTE_CSS, MASCOTE_SVG } from './mascote.js?v=20261010213811';
import { criarAnfitriao, criarConvidado, criarSinal, novoCodigo, novoId } from './sala.js?v=20261010213811';
import { camadaDeVidro, medidas as medidasVidro, telaRecortada, vidroPossivel } from './vidro.js?v=20261010213811';
import { marcaDaReuniao } from './marcas.js?v=20261010213811';

// a reunião mora na sombra que modo.js montou (sem ela, no documento — só para um teste solto)
const RAIZ = window.__REUNIAO_RAIZ || document;
const $ = (id) => RAIZ.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PARAMS = new URLSearchParams(location.search);
const MUDO = PARAMS.has('mudo');                 // teste: nunca toca som
const SEM_CARTOES = PARAMS.get('cartoes') === '0';
const SEM_GRAVAR = PARAMS.get('gravar') === '0';
// o tema é o que o Jarvis abriu (window.TEMA — tema que não existe no site já caiu na Oscarpes lá)
const TEMA_ID = window.TEMA && /^[a-z0-9-]{2,40}$/.test(window.TEMA.id || '') ? window.TEMA.id : (/^[a-z0-9-]{2,40}$/.test(PARAMS.get('tema') || '') ? PARAMS.get('tema') : 'oscarpes');
const ORG = TEMA_ID;
// CONVIDADO DE LONGE (?entrar=<código>): esta página vira a do convidado — liga só com o Mac do anfitrião (WebRTC), não
// fala com o balcão do Mac dele (não existe no computador do convidado) e mostra o painel que o anfitrião manda.
let CODIGO_ENTRAR = '';
let MODO_CONVIDADO = false;   // definido em iniciar() (papel 'convidado')
let PONTE = null;              // o que o Jarvis empresta (porta-reuniao.js)
let MARCA_REUNIAO = marcaDaReuniao('oscarpes');
// o link que vai no convite: sempre o site (o Mac não é alcançável de fora); ?linkLocal=1 só para o ensaio
// 06/out: o link é o do JARVIS (/ao-vivo/?entrar=…); o /ao-vivo/reuniao/ antigo só redireciona para cá
const BASE_LINK = PARAMS.has('linkLocal') ? location.origin + location.pathname : 'https://app.oscarpes.com.br/ao-vivo/';
const SUPABASE_URL = 'https://sjtfwipgqeryeukreyst.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdGZ3aXBncWVyeWV1a3JleXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTI1MTksImV4cCI6MjA5MjcyODUxOX0.DG0pLGoPbo8W50_AeXb1zA0BALCchyKPAGFfP3hghcM';
const CHAVE_SESSAO = 'sb-sjtfwipgqeryeukreyst-auth-token';
const ROTA_VOZ = SUPABASE_URL + '/functions/v1/whatsapp/voz' + (TEMA_ID !== 'oscarpes' ? '?tema=' + encodeURIComponent(TEMA_ID) : '');
// o balcão: a própria origem quando a página vem dele (qualquer porta local); senão o do Mac
const BALCAO = /^https?:\/\/(127\.0\.0\.1|localhost):\d+$/.test(location.origin) ? '' : 'http://127.0.0.1:47815';
// a voz do Oscar de mesa pelo repasse do balcão (o programa do Mac só atende a origem do site). NUNCA a voz do navegador.
// no site, a página fala direto com a voz do Mac (47814 atende a origem do site); servida pelo balcão, pelo repasse dele
const VOZ_MAC = BALCAO === '' ? '/api/voz' : 'http://127.0.0.1:47814/voz';
const CHAVE_ESTADO = 'oscarpes:reuniao:estado:' + TEMA_ID;
const TRECHO_MS = 10000;          // cada pedaço de áudio que vai ao Mac
const AUTO_INTERVALO_MS = 10 * 60 * 1000;   // cartão automático: no máximo 1 por assunto a cada 10 min
const AUTO_JANELA_MS = 3 * 60 * 1000;       // …quando o assunto aparece N vezes nesta janela
let MARCA = { nome: 'Oscarpes', dizer: 'Oscar', logo: 'folha.png' };

// ---------------------------------------------------------------------------
// ESTADO — guardado no navegador a cada mudança (recarregar a página não perde a reunião)
// ---------------------------------------------------------------------------
let E = null;
function novoEstado(participantes) {
  const d = new Date(); const z = (n) => String(n).padStart(2, '0');
  return {
    id: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`,
    tema: TEMA_ID, inicio: d.toISOString(), fim: null, participantes, quemFala: 'sala', quemFalaEm: 0,
    claude: false, linhas: [], enviadas: 0, assuntos: {}, decisoes: [], pendencias: [], pedidos: [], dados: [], auto: {},
    segN: 0, segmentos: [], acesso: {}, operadorAdmin: false, liberado: {}, permissoes: [], esperas: [],
  };
}
function salvar() { try { localStorage.setItem(CHAVE_ESTADO, JSON.stringify({ ...E, dados: E.dados.map((d) => ({ ...d, telas: [] })), auto: Object.fromEntries(Object.entries(E.auto).map(([k, v]) => [k, { ...v, telas: [] }])) })); } catch (e) { /* cheio ou bloqueado */ } }
function carregar() { try { const s = JSON.parse(localStorage.getItem(CHAVE_ESTADO) || 'null'); return s && !s.fim ? s : null; } catch (e) { return null; } }
const hora = (iso) => new Date(iso || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// ---------------------------------------------------------------------------
// BALCÃO DO MAC (fila, áudio → quem fala, transcrição, ata). Sem o balcão a reunião segue: a ata sai por download.
// ---------------------------------------------------------------------------
let balcaoVivo = false;
let temBalcao = null;     // null = ainda não sei · true = o balcão do Mac respondeu · false = não tem (outro computador)
/** O balcão do Mac está aqui? (uma pergunta só, com prazo curto — fora do Mac não pode segurar a reunião) */
async function sondarBalcao() {
  if (MODO_CONVIDADO) { temBalcao = false; return false; }
  try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 1500); const r = await fetch(BALCAO + '/api/saude', { cache: 'no-store', signal: c.signal }); clearTimeout(t); temBalcao = r.ok; }
  catch (e) { temBalcao = false; }
  balcaoVivo = temBalcao; return temBalcao;
}
async function balcao(rota, corpo) {
  if (MODO_CONVIDADO || temBalcao === false) return null;      // o convidado nunca fala com serviço de Mac nenhum
  try {
    const r = await fetch(BALCAO + rota, corpo === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
    balcaoVivo = true;
    return await r.json();
  } catch (e) { balcaoVivo = false; return null; }
}

// ---------------------------------------------------------------------------
// SESSÃO (a mesma do app), o AGENTE (rota whatsapp/voz, com o tema) e QUEM TEM ACESSO (whatsapp_autorizados)
// ---------------------------------------------------------------------------
async function token() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null'); } catch (e) { /* nada */ }
  if (!s || !s.access_token) return null;
  const vence = (s.expires_at || 0) * 1000;
  if (vence && vence - Date.now() < 60_000) {
    if (!s.refresh_token || ANON.startsWith('__')) return null;
    try {
      const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
      if (r.ok) { const n = await r.json(); localStorage.setItem(CHAVE_SESSAO, JSON.stringify(n)); return n.access_token; }
    } catch (e) { /* sem rede */ }
    return null;
  }
  return s.access_token;
}
/** o botão da conta: "Entrar com a conta do app" ou "conectado como …" (sempre à vista — João não achava o login) */
async function atualizarConta() {
  const t = await token();
  const b = $('btnConta');
  if (t) { b.textContent = 'conectado como ' + (emailDaSessao() || 'conta do app'); b.title = 'Clique para sair'; b.dataset.logado = '1'; }
  else { b.textContent = 'Entrar com a conta do app'; b.title = 'Entrar com a conta do app'; b.dataset.logado = ''; }
}
function emailDaSessao() { try { return (JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null') || {}).user?.email || ''; } catch (e) { return ''; } }
async function entrar() {
  if (ANON.startsWith('__')) { avisar('Login indisponível nesta cópia (sem a chave pública).'); return; }
  const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email: $('email').value.trim(), password: $('senha').value }) }).catch(() => null);
  if (!r || !r.ok) { avisar('E-mail ou senha não conferem.'); return; }
  const s = await r.json();
  if (!s.expires_at && s.expires_in) s.expires_at = Math.floor(Date.now() / 1000) + Number(s.expires_in);
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
  $('senha').value = ''; $('login').style.display = 'none'; avisar('');
  atualizarConta();
  await carregarAcessos();
  // convites que ficaram sem telefone por falta de login: refaz agora
  if (E && (E.convites || []).some((c) => !c.tel)) { pessoasDoApp = null; const ditos = E.convites.filter((c) => !c.tel).map((c) => c.dito); E.convites = E.convites.filter((c) => c.tel); await prepararConvitesPorVoz(ditos); falar(fraseDosConvites()); }
}
// CONTEXTO (07/out/2026, João: "ele não escuta tudo… parece que entendia errado"): toda pergunta ao Oscar leva as falas
// dos últimos 8 min (limpas, com quem falou) e o que já foi anotado — num campo à parte (contexto_reuniao), fora do teto
// de 1.500 letras da pergunta. Os nomes da casa que o reconhecimento erra são corrigidos antes (corrigirNomes).
function falasParaContexto() { return E ? E.linhas.map((l) => ({ t: l.em || l.t || 0, quem: l.quem, texto: l.texto })) : []; }
function contextoAgora() { return E ? contextoDaReuniao(falasParaContexto(), { decisoes: E.decisoes, pendencias: E.pendencias }) : ''; }
async function perguntarAoAgente(texto, opcoes = {}) {
  texto = corrigirNomes(texto);
  if (opcoes.quem && opcoes.quem !== 'sala') texto = `(${opcoes.quem} perguntou) ${texto}`;
  const contexto = opcoes.semContexto ? '' : contextoAgora();
  if (typeof window.REUNIAO_AGENTE_FALSO === 'function') return window.REUNIAO_AGENTE_FALSO(texto, { contexto, semNome: !!opcoes.semNome });   // ensaio sem servidor
  const t = await token();
  if (!t) { $('login').style.display = 'flex'; avisar('Entre com a sua conta do app (botão no topo) para o Oscar trazer os dados.'); return { erro: 'sem login' }; }
  // 06/out, 1ª reunião real: TODO cartão voltava "Sem conexão com o servidor" — a rota do agente só aceita a origem do site
  // (CORS) e esta página roda em 127.0.0.1:47815. No Mac, o pedido vai pelo balcão (/api/agente), que repassa com a origem do site.
  // no SITE (o Jarvis no Mac ou em qualquer computador) a origem é aceita pela rota: vai direto, sem depender do balcão
  const rota = MODO_CONVIDADO || BALCAO !== '' ? ROTA_VOZ : `/api/agente${TEMA_ID !== 'oscarpes' ? '?tema=' + encodeURIComponent(TEMA_ID) : ''}`;
  try {
    const r = await fetch(rota, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
      body: JSON.stringify({ texto: (`[Reunião ao vivo — resposta curta, para a sala. ${MARCA_REUNIAO.persona}] ` + texto).slice(0, 1500), telas: true, fluxo: false, ...(contexto ? { contexto_reuniao: contexto } : {}), ...(opcoes.semNome ? { sem_nome: true } : {}), ...(TEMA_ID !== 'oscarpes' ? { tema: TEMA_ID } : {}) }) });
    const c = await r.json().catch(() => ({}));
    if (r.status === 401) { $('login').style.display = 'flex'; return { erro: 'sem login', falar: 'Entre com a sua conta do app para eu trazer os dados.' }; }
    if (!r.ok) return { erro: c.erro || 'O agente não respondeu agora.' };
    return c;
  } catch (e) { return { erro: MODO_CONVIDADO || BALCAO !== '' ? 'Sem conexão com o servidor.' : 'O balcão do Mac não respondeu (o programa da reunião está ligado?).' }; }
}
// NÍVEL DE ACESSO de cada participante: o papel dele no app (whatsapp_autorizados; a regra do banco só deixa ADMIN ler
// esta tabela — se a leitura funciona, quem está logado neste navegador é admin e pode autorizar com um clique).
// Nome que não bate com ninguém, ou bate com dois papéis diferentes, fica sem acesso. Voz sem nome = sem acesso.
async function carregarAcessos() {
  if (!E) return;
  const t = await token();
  if (!t || ANON.startsWith('__')) { E.operadorAdmin = false; desenhar(); return; }
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/whatsapp_autorizados?select=nome,papel,ativo&ativo=eq.true', { headers: { apikey: ANON, authorization: 'Bearer ' + t } });
    if (!r.ok) { E.operadorAdmin = false; desenhar(); return; }
    const lista = await r.json();
    E.operadorAdmin = Array.isArray(lista) && lista.length > 0;
    definirAcessos(Object.fromEntries(E.participantes.map((p) => [p, nivelDe(p, lista)])));
  } catch (e) { E.operadorAdmin = false; desenhar(); }
}
function nivelDe(nome, lista) {
  const n = norm(nome); if (!n) return { nivel: 'restrito', papel: '?' };
  // 07/out: "Emiliano Carpes" × "Emiliano Antonio Carpes Filho" não casava (ficava "não cadastrado") — mesmoNome casa o primeiro
  // nome e exige as outras palavras ditas dentro do nome completo
  const achados = lista.filter((a) => { const an = norm(a.nome); return an === n || an.startsWith(n + ' ') || an.split(' ')[0] === n || mesmoNome(nome, a.nome); });
  const papeis = [...new Set(achados.map((a) => a.papel))];
  if (papeis.length === 1) return { nivel: papeis[0] === 'admin' ? 'admin' : 'restrito', papel: papeis[0] };
  return { nivel: 'restrito', papel: papeis.length ? 'ambíguo' : 'não cadastrado' };
}
function definirAcessos(mapa) { for (const [k, v] of Object.entries(mapa)) E.acesso[k] = typeof v === 'string' ? { nivel: v, papel: v } : v; salvar(); desenhar(); }
const ehAdmin = (nome) => !!(E.acesso[nome] && E.acesso[nome].nivel === 'admin');
/** Tem na sala alguém sem acesso total? (participante não-admin, ou voz ainda sem nome que já falou) */
function reuniaoMista() {
  if (E.participantes.some((p) => !ehAdmin(p))) return true;
  return vozesServidor.some((v) => !v.nome && v.segundos >= 3);
}

// ---------------------------------------------------------------------------
// FALA — só quando chamado. Voz do Oscar de mesa (127.0.0.1:47814) e, sem ela, a voz do navegador.
// Enquanto fala, a escuta pausa; o pedaço de áudio com a voz dele é ignorado na identificação.
// ---------------------------------------------------------------------------
let falando = false;
const falasDoOscar = [];
async function falar(texto) {
  texto = String(texto || '').trim();
  if (!texto) return;
  legenda(MARCA.dizer, texto, true);
  Mascote.estado('falando'); setTimeout(() => Mascote.estado('ouvindo'), Math.min(9000, 1500 + texto.length * 60));
  if (MUDO || MODO_CONVIDADO) return;
  const ini = Date.now();
  falando = true; $('folha').classList.add('falando'); Escuta.pausar();
  try {
    let tocou = false;
    try {
      const c = new AbortController(); const tm = setTimeout(() => c.abort(), 20000);
      const r = await fetch(VOZ_MAC, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ texto }), signal: c.signal });
      clearTimeout(tm);
      if (r.ok) { const a = new Audio(URL.createObjectURL(await r.blob())); Mistura.ligarAudio(a); await new Promise((ok) => { a.onended = ok; a.onerror = ok; a.play().catch(ok); }); tocou = true; }
    } catch (e) { /* sem a voz do Mac */ }
    // João (06/out): nunca a voz do navegador — sem a voz do Mac, a fala fica só escrita na legenda
    if (!tocou) avisar('A voz do Oscar (programa do Mac) não respondeu: a fala ficou só escrita.');
  } finally { falando = false; falasDoOscar.push([ini, Date.now() + 500]); $('folha').classList.remove('falando'); Escuta.retomar(); }
}
const foiOOscar = (ini, fim) => falasDoOscar.some(([a, b]) => (ini + fim) / 2 >= a && (ini + fim) / 2 <= b);

// ---------------------------------------------------------------------------
// ESCUTA — reconhecimento contínuo do Chrome (legenda e painel na hora); religa sozinho
// ---------------------------------------------------------------------------
const Escuta = (() => {
  const C = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, ligado = false, pausado = false, ativo = false;
  function novo() {
    const r = new C(); r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true;
    r.onstart = () => { ativo = true; };
    r.onresult = (ev) => {
      if (pausado || falando) return;
      let interino = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) ouvir(t); else interino += t;
      }
      if (interino) legenda(quemAgora(), interino, false, true);
    };
    r.onend = () => { ativo = false; if (ligado && !pausado) setTimeout(tentar, 250); };
    r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { ligado = false; avisar('O navegador não deixou usar o microfone. Libere o microfone para este endereço e clique em “Escuta”.'); atualizarMic(); } };
    return r;
  }
  function tentar() { if (!ligado || pausado || ativo || !C) return; rec = rec || novo(); try { rec.start(); } catch (e) { /* já ligado */ } }
  setInterval(() => { if (ligado && !pausado && !ativo) tentar(); }, 2000);
  return {
    disponivel: !!C, get ligado() { return ligado && !pausado; },
    ligar() { if (!C) return false; ligado = true; pausado = false; tentar(); return true; },
    desligar() { ligado = false; try { rec && rec.abort(); } catch (e) { /* nada */ } },
    pausar() { pausado = true; try { rec && rec.abort(); } catch (e) { /* nada */ } ativo = false; },
    retomar() { pausado = false; setTimeout(tentar, 300); },
  };
})();

// ---------------------------------------------------------------------------
// GRAVADOR — a sala em trechos de 10 s para o Mac (quem fala). Cada trecho é um arquivo inteiro (o gravador
// recomeça a cada 10 s), então o Mac lê cada um sozinho. Nada vai para a internet.
// ---------------------------------------------------------------------------
function criarGravador({ obterStream, quem = '', pararFaixas = true, extra = () => '' }) {
  let stream = null, rec = null, ligado = false, t0 = 0, timer = null, ultimoEnvio = Promise.resolve();
  const tipo = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
  function ciclo() {
    if (!ligado || !stream) return;
    if (!stream.getAudioTracks().some((t) => t.readyState === 'live')) { ligado = false; return; }
    const partes = []; const mime = tipo(); const ini = Date.now();
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); } catch (e) { avisar('Este navegador não grava áudio: sem identificação de quem fala.'); ligado = false; return; }
    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) partes.push(ev.data); };
    rec.onstop = () => {
      const blob = new Blob(partes, { type: rec.mimeType || mime || 'audio/webm' });
      // quem: áudio de convidado de longe já vem com o nome (a conta/nome com que ele entrou) — o Mac não precisa adivinhar
      if (blob.size > 2000 && E && !E.fim) ultimoEnvio = fetch(`${BALCAO}/api/audio?reuniao=${encodeURIComponent(E.id)}&t0=${ini}&org=${encodeURIComponent(ORG)}${quem ? '&quem=' + encodeURIComponent(quem) : extra()}`, { method: 'POST', headers: { 'content-type': blob.type }, body: blob }).then(() => { balcaoVivo = true; }).catch(() => { balcaoVivo = false; });
      if (ligado) ciclo();
    };
    rec.start(); t0 = ini;
    timer = setTimeout(() => { try { rec.state !== 'inactive' && rec.stop(); } catch (e) { /* nada */ } }, TRECHO_MS);
  }
  return {
    get ligado() { return ligado; }, get t0() { return t0; },
    async ligar() {
      if (ligado) return true;
      if (!window.MediaRecorder) return false;
      try { stream = stream || await obterStream(); } catch (e) { return false; }
      if (!stream) return false;
      ligado = true; ciclo(); return true;
    },
    /** para e espera o último trecho chegar ao Mac */
    async parar() { ligado = false; clearTimeout(timer); try { rec && rec.state !== 'inactive' && rec.stop(); } catch (e) { /* nada */ } await new Promise((r) => setTimeout(r, 300)); await ultimoEnvio; if (stream && pararFaixas) stream.getTracks().forEach((t) => t.stop()); stream = null; },
  };
}
// só UMA pessoa na sala (os outros longe): a voz do microfone da sala é dela — o Mac não inventa "Voz 3, 4, 12"
function soUmaNaSala() { if (!E) return ''; const sala = E.participantes.filter((p) => !Sala.remotos[p]); return sala.length === 1 ? sala[0] : ''; }
const Gravador = criarGravador({ obterStream: () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }), extra: () => { const h = soUmaNaSala(); return h ? '&so_anfitriao=' + encodeURIComponent(h) : ''; } });

// MISTURA (anfitrião): o áudio que vai para quem está longe = microfone da sala + a voz do Oscar (Web Audio)
const Mistura = (() => {
  let ctx = null, destino = null;
  return {
    async ligar() {
      if (ctx || MODO_CONVIDADO) return;
      try {
        ctx = new AudioContext(); destino = ctx.createMediaStreamDestination();
        const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        ctx.createMediaStreamSource(mic).connect(destino);
      } catch (e) { console.error('[Reuniao] mistura', e); }
    },
    ligarAudio(a) { if (!ctx || !destino) return; try { const src = ctx.createMediaElementSource(a); src.connect(ctx.destination); src.connect(destino); } catch (e) { /* já ligado */ } },
    get stream() { return destino ? destino.stream : null; },
    retomar() { try { ctx && ctx.state === 'suspended' && ctx.resume(); } catch (e) { /* nada */ } },
  };
})();

// ---------------------------------------------------------------------------
// QUEM FALA — os segmentos do Mac (Whisper + voz) chegam a cada 3 s e dão nome às falas do painel
// ---------------------------------------------------------------------------
let vozesServidor = [], motorVozes = '';
// 07/out: com só o João na sala (Tainá e Emiliano de longe) a legenda saía "sala: …" — quem fala na sala, sozinho, é ele
// (quemAgora só nomeia o que o microfone DA SALA ouviu; a fala de quem está longe chega com o nome dele em ouvir())
function quemAgora() { if (!E) return 'sala'; const so = soUmaNaSala(); if (so) return so; return Date.now() - E.quemFalaEm < 20000 ? E.quemFala : 'sala'; }
async function lerVozes() {
  if (!E || !balcaoVivo && E.segN > 0 && Math.random() < 0.5) return;
  const r = await balcao(`/api/vozes?reuniao=${encodeURIComponent(E.id)}&desde=${E.segN}`);
  if (!r) return;
  motorVozes = r.motor; vozesServidor = r.vozes || [];
  const nomes = Object.fromEntries(vozesServidor.filter((v) => v.nome).map((v) => [v.voz, v.nome]));
  // voz que ganhou nome depois: corrige os segmentos já recebidos
  for (const s of E.segmentos) if (nomes[s.voz]) s.quem = nomes[s.voz];
  for (const s of r.segmentos || []) {
    E.segN++;
    if (foiOOscar(s.ini, s.fim)) continue;
    // 07/out: "Oi, oi, oi…" ×200 da faixa da Tainá (Whisper em laço) foi para a legenda, o painel e a transcrição — fora
    if (falaDegenerada(s.texto)) continue;
    const seg = { ini: s.ini, fim: s.fim, texto: s.texto, voz: s.voz, quem: nomes[s.voz] || s.quem || s.voz };
    E.segmentos.push(seg);
    aplicarSegmento(seg);
    // convidado de longe: a legenda do Chrome não ouve ele (cancelamento de eco) — a fala dele entra no painel por aqui
    if (String(s.voz).startsWith('R:')) juntarDeLonge(seg);
  }
  relabelar();
  salvar(); desenhar();
}
// FRASE CORTADA (07/out: "O Oscar, a contadora já apresentou…" / "A nossa planilha financeira já está…" chegaram em dois
// trechos de 10 s): as falas de longe da MESMA pessoa, coladas (≤ 3 s), viram uma frase só antes de ir para o painel.
// Sai na hora quando a frase fecha (". ? !"); cortada (sem ponto, ou "…") espera o próximo trecho dela.
const deLonge = new Map();
function juntarDeLonge(seg) {
  const b = deLonge.get(seg.voz);
  if (b && seg.ini - b.fim <= 3000) { b.texto = b.texto.replace(/[.…]+$/, '') + ' ' + seg.texto; b.fim = seg.fim; clearTimeout(b.timer); }
  else { if (b) { clearTimeout(b.timer); soltarDeLonge(seg.voz); } deLonge.set(seg.voz, { texto: seg.texto, quem: seg.quem, fim: seg.fim }); }
  const atual = deLonge.get(seg.voz);
  // frase fechada (". ? !", não reticências) sai já; cortada espera o próximo trecho de 10 s dela (até 11 s)
  if (/[^.][.?!]\s*$/.test(atual.texto)) soltarDeLonge(seg.voz); else atual.timer = setTimeout(() => soltarDeLonge(seg.voz), 11000);
}
function soltarDeLonge(voz) { const b = deLonge.get(voz); if (!b) return; deLonge.delete(voz); ouvir(b.texto, b.quem, true); }
function aplicarSegmento(seg) {
  if (seg.fim > E.quemFalaEm) { E.quemFala = seg.quem; E.quemFalaEm = seg.fim; }
  // PERMISSÃO PELA VOZ: um sócio/admin RECONHECIDO diz "pode mostrar" / "não"
  const resp = respostaDePermissao(seg.texto);
  if (resp && E.esperas.length && ehAdmin(seg.quem)) {
    const w = E.esperas[E.esperas.length - 1];
    if (seg.ini >= w.em - 2000) { if (resp === 'sim') conceder(w, seg.quem, 'voz reconhecida'); else negar(w, seg.quem, 'voz reconhecida'); }
  }
}
/** Dá o nome de quem falou às falas da legenda (Chrome), às decisões, pendências e pedidos — pelo horário. */
function relabelar() {
  // só os trechos da SALA dão nome à legenda do Chrome (ela só ouve o microfone da sala). Na 1ª reunião a fala do João virou
  // "Tainá" porque o trecho dela (faixa de longe) caía no mesmo horário.
  const achar = (t) => { if (!t) return null; let m = null; for (const s of E.segmentos) if (!String(s.voz).startsWith('R:') && t >= s.ini - 1500 && t <= s.fim + 3500) m = s; return m; };
  for (const l of E.linhas) { const s = achar(l.t); if (s) l.quem = s.quem; }
  for (const lst of [E.decisoes, E.pendencias, E.pedidos]) for (const x of lst) {
    const s = achar(x.t); if (!s) continue; x.quem = s.quem;
    if (x.donoEu) x.dono = s.quem;   // "eu vou ligar…" → o dono é quem falou
  }
}
async function nomearVoz(voz, nome, guardar) {
  const r = await balcao('/api/vozes/nomear', { reuniao: E.id, org: ORG, voz, nome, guardar });
  if (!r || !r.ok) { avisar('Não consegui dar o nome (balcão do Mac desligado?).'); return; }
  if (!E.participantes.includes(nome)) { E.participantes.push(nome); carregarAcessos(); }
  await lerVozes(); atualizarCadastradas();
}
async function atualizarCadastradas() { const r = await balcao(`/api/vozes/cadastradas?org=${encodeURIComponent(ORG)}`); $('cadastradas').textContent = r && r.nomes ? (r.nomes.join(', ') || 'nenhuma') : '—'; }

// ---------------------------------------------------------------------------
// CÂMERA DA SALA e COMPARTILHAR TELA
// ---------------------------------------------------------------------------
let fluxoCamera = null, camadaSala = null;
// FUNDO DE VIDRO: ligado por padrão (João); o botão vale para a câmera DESTE computador (cada um decide a sua)
let vidroQuer = !PARAMS.has('semVidro');
async function alternarCamera() {
  if (fluxoCamera) { if (camadaSala) camadaSala.parar(); fluxoCamera.getTracks().forEach((t) => t.stop()); fluxoCamera = null; camadaSala = null; }
  else {
    try {
      const bruta = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      camadaSala = camadaDeVidro(bruta, { ligado: vidroQuer, aoMudar: () => { atualizarBotaoVidro(); if (Sala.anfitriao) Sala.anfitriao.repassar(); desenharFaixa(); } });
      fluxoCamera = camadaSala.stream;
    } catch (e) { avisar('O navegador não deixou usar a câmera.'); }
  }
  $('btnCamera').textContent = 'Câmera: ' + (fluxoCamera ? 'ligada' : 'desligada'); $('btnCamera').classList.toggle('ligado', !!fluxoCamera);
  atualizarBotaoVidro();
  if (Sala.anfitriao) Sala.anfitriao.repassar();   // quem está longe passa a ver (ou deixa de ver) a sala
  desenharFaixa();
}
/** a camada de vidro da câmera DESTE computador (anfitrião: a da sala; convidado: a dele) */
const minhaCamada = () => (MODO_CONVIDADO ? Sala.minhaCamada : camadaSala);
function alternarVidro() {
  const c = minhaCamada();
  vidroQuer = c ? c.alternar() : !vidroQuer;
  atualizarBotaoVidro();
}
function atualizarBotaoVidro() {
  const c = minhaCamada();
  const est = c ? c.estado : (vidroQuer ? 'ligado' : 'desligado');
  const txt = { ligado: 'ligado', carregando: 'ligando…', desligado: 'desligado', lento: 'desligado (aparelho lento)', indisponivel: vidroPossivel() ? 'indisponível' : 'indisponível neste navegador' }[est] || est;
  for (const id of ['btnVidro', 'eVidro']) { const b = $(id); if (b) { b.textContent = 'Fundo de vidro: ' + txt; b.classList.toggle('ligado', est === 'ligado'); } }
  if (MODO_CONVIDADO && Sala.convidado) Sala.convidado.definirVidro(!!(c && c.ligado), infoDoVidro());
}
/** o que o anfitrião precisa saber do recorte deste aparelho (aparelho só pelo tipo: iPhone/Android/Mac/Windows) */
function infoDoVidro() {
  const c = minhaCamada(), ua = navigator.userAgent || '';
  const aparelho = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'outro';
  return { estado: c ? c.estado : 'sem câmera', caminho: (c && c.caminho) || '', aparelho };
}
let fluxoTela = null;
async function compartilharTela() {
  if (fluxoTela) { pararTela(); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { avisar('Este navegador não deixa compartilhar a tela.'); return; }
  try { fluxoTela = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); } catch (e) { avisar('Compartilhamento cancelado.'); return; }
  $('video').srcObject = fluxoTela; $('cardTela').hidden = false; $('btnTela').textContent = 'Parar de compartilhar'; $('btnTela').classList.add('ligado');
  fluxoTela.getVideoTracks()[0].addEventListener('ended', pararTela);
}
function pararTela() {
  if (fluxoTela && !fluxoTela.remota) fluxoTela.getTracks().forEach((t) => t.stop());
  fluxoTela = null; $('video').srcObject = null; $('cardTela').hidden = true; $('btnTela').textContent = 'Compartilhar tela'; $('btnTela').classList.remove('ligado');
}
function fotoDaTela() {
  const v = $('video');
  if (!fluxoTela || !v.videoWidth) return null;
  const k = Math.min(1, 1600 / v.videoWidth);
  const c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

// ---------------------------------------------------------------------------
// MASCOTE — a folha Oscar (desenho de mascote.js). Traz os cartões: voa até o lugar e "puxa" o cartão de dentro de si.
// Só onde a marca tem mascote desenhado (marcas.js: hoje a folha da Oscarpes; a Brevant tem o gancho do saco de semente de
// milho, ainda sem desenho — até lá, sem mascote). API igual à da cena de demonstração.
// GANCHO: todo cartão dispara window 'oscar:cartao' {detail:{assunto, titulo, estado, el}} antes de aparecer; quem
// quiser outro mascote/animação define window.OSCAR_CARREGA = async (detail) => {...} e a página espera ela.
// ---------------------------------------------------------------------------
const Mascote = (() => {
  let ativo = false;   // decidido em montar() pela marca (marcas.js)
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mov = null, svg = null, bob = null, flip = null, x = -200, y = 0, L = 140;
  function montar() {
    ativo = MARCA_REUNIAO.mascoteProntoNaPagina && !PARAMS.has('semMascote');
    if (!ativo || mov) return;
    const st = document.createElement('style'); st.textContent = MASCOTE_CSS; RAIZ.appendChild(st);
    $('mascote').innerHTML = `<div class="oscar-mov"><div class="oscar-flip"><div class="oscar-incl"><div class="oscar-bob flutuando">${MASCOTE_SVG}</div></div></div></div>`;
    mov = $('mascote').querySelector('.oscar-mov'); svg = mov.querySelector('svg'); bob = mov.querySelector('.oscar-bob'); flip = mov.querySelector('.oscar-flip');
    y = innerHeight - 260; x = innerWidth - L - 20; pos(); estado('ouvindo');
  }
  const pos = () => { if (mov) mov.style.transform = `translate(${x}px,${y}px)`; };
  function estado(e) { if (svg) svg.dataset.estado = e; }
  async function ir(nx, ny, ms = 900) {
    if (!mov) return;
    flip.style.transform = nx < x ? 'scaleX(-1)' : '';
    if (calmo) { x = nx; y = ny; pos(); return; }
    const a = mov.animate([{ transform: `translate(${x}px,${y}px)` }, { transform: `translate(${(x + nx) / 2}px,${Math.min(y, ny) - 60}px)`, offset: 0.5 }, { transform: `translate(${nx}px,${ny}px)` }], { duration: ms, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
    await a.finished; x = nx; y = ny; pos(); a.cancel();
  }
  async function puxar(el, ms = 1100) {
    if (!el) return;
    if (!mov || calmo) { el.style.opacity = 1; return; }
    const r = el.getBoundingClientRect(); const cx = x + L / 2, cy = y + L * 0.45;
    const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    const a = el.animate([{ transform: `translate(${dx}px,${dy}px) scale(.03)`, opacity: 0 }, { transform: `translate(${dx}px,${dy - 80}px) scale(.15)`, opacity: 1, offset: 0.3 }, { transform: 'none', opacity: 1 }], { duration: ms, easing: 'cubic-bezier(.3,.7,.2,1)' });
    await a.finished;
  }
  /** leva o cartão até o lugar: voa para perto, puxa de dentro da folha, volta a descansar no canto */
  async function trazer(el) {
    if (!mov || !el) return;
    estado('pensando');
    const r = el.getBoundingClientRect();
    await ir(Math.max(8, Math.min(innerWidth - L - 8, r.left - L * 0.75)), Math.max(60, Math.min(innerHeight - L - 80, r.top - 20)));
    estado('falando'); el.style.opacity = 0; await puxar(el); el.style.opacity = 1;
    estado('comemorando'); setTimeout(() => estado('ouvindo'), 1400);
    setTimeout(() => ir(innerWidth - L - 20, innerHeight - 260, 1200), 1800);
  }
  return { get ativo() { return ativo; }, montar, estado, trazer };
})();
async function anunciarCartao(detail) {
  try { window.dispatchEvent(new CustomEvent('oscar:cartao', { detail })); } catch (e) { /* nada */ }
  if (typeof window.OSCAR_CARREGA === 'function') { try { await window.OSCAR_CARREGA(detail); } catch (e) { /* o mascote de fora falhou: segue */ } return; }
  if (detail.estado === 'pronto' && detail.el) await Mascote.trazer(detail.el);
}

// ---------------------------------------------------------------------------
// CADA FRASE DA SALA (da legenda do Chrome ou escrita na caixa)
// ---------------------------------------------------------------------------
let aguardandoPergunta = 0, aguardandoDe = '', origemDaUltima = 'sala';
function ouvir(frase, quem, fixo = false) {
  frase = String(frase || '').trim();
  if (!frase || !E || E.fim) return;
  if (falaDegenerada(frase)) return;
  quemPerguntou = quem || quemAgora();
  // ADMITIR PELA VOZ (07/out: "Admitir a Tainá" ×2, sem "Oscar", não fazia nada): só da SALA (quem está longe não abre a porta)
  if (!fixo && admitirPelaVoz(frase)) { E.linhas.push({ em: Date.now(), t: Date.now(), hora: hora(), quem: quemAgora(), texto: frase }); legenda(quemAgora(), frase); salvar(); desenhar(); return; }
  // "Oscar" … (pausa) … "traz o financeiro": até 6 s depois de chamar só pelo nome, a próxima frase é a pergunta
  // a continuação tem que vir de quem chamou (sala ou a mesma pessoa de longe) — senão a fala de outro vira a pergunta
  const origemFala = fixo ? 'longe:' + (quem || '') : 'sala';
  if (Date.now() < aguardandoPergunta && aguardandoDe === origemFala && !classificar(frase, {}).some((x) => x.tipo === 'chamado' || x.tipo === 'encerrar')) {
    aguardandoPergunta = 0;
    E.linhas.push({ em: Date.now(), t: fixo ? 0 : Date.now(), hora: hora(), quem: quem || quemAgora(), texto: frase });
    legenda(quem || quemAgora(), frase); atenderChamado(frase); salvar(); desenhar(); return;
  }
  origemDaUltima = origemFala;
  if (Date.now() < conversaAte && conversaDe === origemFala && PEDIDO_AO_OSCAR_RE.test(norm(frase)) && !classificar(frase, {}).some((x) => x.tipo === 'decisao')) {
    conversaAte = 0;
    E.linhas.push({ em: Date.now(), t: fixo ? 0 : Date.now(), hora: hora(), quem: quem || quemAgora(), texto: frase });
    legenda(quem || quemAgora(), frase); atenderChamado(frase); salvar(); desenhar(); return;
  }
  // convites prontos (pedidos por voz) e alguém da SALA diz "pode mandar" — sem precisar do "Oscar" (até 3 min depois)
  if (!fixo && E.convitesPendentes && Date.now() - E.convitesPendentes < 180000 && !E.esperas.length && PODE_MANDAR_RE.test(norm(frase))) {
    E.linhas.push({ em: Date.now(), t: Date.now(), hora: hora(), quem: quemAgora(), texto: frase }); legenda(quemAgora(), frase); mandarConvites(convitesParaMandar(frase, E.convites || [])); salvar(); return;
  }
  const troca = trocaDeQuemFala(frase, E.participantes);
  if (troca) { E.quemFala = troca; E.quemFalaEm = Date.now(); }
  if (quem) { E.quemFala = quem; E.quemFalaEm = Date.now(); }
  const fala = { em: Date.now(), t: fixo ? 0 : Date.now(), hora: hora(), quem: quem || quemAgora(), texto: frase };
  E.linhas.push(fala);
  legenda(fala.quem, frase);
  Mascote.estado('ouvindo');
  const itens = classificar(frase, { participantes: E.participantes, quemFala: fala.quem });
  quemPerguntou = fala.quem;
  for (const it of itens) aplicar(it, fala);
  if (!itens.some((x) => x.tipo === 'chamado' || x.tipo === 'encerrar')) escutarParaAjudar(fala, fixo);
  salvar(); desenhar();
}
// ---------------------------------------------------------------------------
// O OSCAR QUE ESCUTA (07/out/2026). Sem ser chamado, ele:
//   • PROBLEMA RELATADO ("o financeiro não está legal", "esses 1.400.000 negativos", "as notas fiscais não deram certo") →
//     investiga com as ferramentas e traz o DIAGNÓSTICO num cartão (só o que a ferramenta devolveu; sem dado, o que falta);
//     fala UMA frase curta só se a sala estiver quieta. No máximo 1 diagnóstico por assunto a cada 10 min.
//   • PEDIDO CLARO sem "Oscar" ("traz os mapas da Cidara") → responde (o servidor ainda pode calar se não era com ele);
//   • PERGUNTA sobre dado do app sem pedido ("qual o saldo…?") → cartão discreto "Posso trazer…?" (um clique);
//   • FAZENDA citada → cartão calado com o resumo dela (uma vez por fazenda).
// Nunca durante a fala do Oscar nem no modo convidado; ?escuta=0 desliga (ensaio).
// ---------------------------------------------------------------------------
const ESCUTA_ATIVA = PARAMS.get('escuta') !== '0';
let ultimaFalaDaSala = 0;
function salaQuieta() { return Date.now() - ultimaFalaDaSala > 6000; }
// QUEM PERGUNTOU vai junto da pergunta (07/out: Emiliano e Tainá, de longe, perguntaram e "ele só responde você") — o
// agente responde chamando a pessoa pelo nome; o acesso ao dado continua sendo o da reunião (permissão do painel)
let quemPerguntou = '';
function escutarParaAjudar(fala, deLonge = false) {
  if (!ESCUTA_ATIVA || MODO_CONVIDADO || !E || E.fim || SEM_CARTOES) return;
  ultimaFalaDaSala = Date.now();
  const frase = corrigirNomes(fala.texto);
  const prob = problemaRelatado(frase);
  if (prob) {
    const chave = 'diag-' + prob.assunto, ja = E.auto[chave];
    if (!ja || (!ja.carregando && Date.now() - ja.em > AUTO_INTERVALO_MS)) {
      const sensivel = ['financeiro', 'fiscal'].includes(prob.assunto);
      cartaoAutomatico({ id: sensivel ? prob.assunto : chave, chave, sensivel, nome: 'Diagnóstico: ' + ({ financeiro: 'financeiro', fiscal: 'fiscal', laboratorio: 'laboratório', mapa: 'mapas', sincronizacao: 'sincronização' }[prob.assunto] || prob.assunto),
        pergunta: perguntaDeDiagnostico(prob, fala.quem),
        aoChegar: () => { if (salaQuieta() && !falando) falar(`${String(fala.quem || '').split(' ')[0] || 'Pessoal'}, olhei ${prob.assunto === 'financeiro' ? 'o financeiro' : prob.assunto === 'fiscal' ? 'o fiscal' : 'isso'}: o que achei está no painel.`); } });
    }
    return;
  }
  const pedido = pedidoSemNome(frase);
  if (pedido === 'claro' && !falando) { atenderChamado(frase, { semNome: true }); return; }
  // de longe não dá para clicar no "Posso trazer…?": a pergunta de quem está longe vai ao agente (marcada sem nome — se
  // era conversa entre eles, o servidor cala)
  if (pedido === 'talvez' && deLonge && !falando) { atenderChamado(frase, { semNome: true }); return; }
  if (pedido === 'talvez') { oferecer(frase); return; }
  const faz = fazendaCitada(frase);
  if (faz) {
    const chave = 'fazenda-' + norm(faz).replace(/ /g, '-');
    if (!E.auto[chave]) cartaoAutomatico({ id: 'campo', chave, sensivel: false, nome: 'Fazenda ' + faz, pergunta: `Resumo curto da fazenda ${faz} para a reunião (sem falar): análises de solo (todos os anos, diga o mais recente), mapas de fertilidade, última visita/monitoramento e o que está pendente. Só o que as ferramentas devolverem.` });
  }
}
/** "Posso trazer…?" — cartão discreto, um clique (ou "Oscar, pode") e vira pergunta */
function oferecer(frase) {
  E.ofertas = (E.ofertas || []).filter((o) => Date.now() - o.em < 120000).slice(-2);
  if (E.ofertas.some((o) => norm(o.frase) === norm(frase))) return;
  E.ofertas.push({ frase, em: Date.now() });
  desenharOfertas();
}
function desenharOfertas() {
  const el = $('ofertas'); if (!el || !E) return;
  const vivas = (E.ofertas || []).filter((o) => Date.now() - o.em < 120000);
  el.innerHTML = vivas.map((o, i) => `<button class="mini oferta" data-oferta="${i}" title="O Oscar ouviu a pergunta e pode trazer o dado">Posso trazer: “${esc(o.frase.slice(0, 70))}”?</button>`).join('');
}
setInterval(() => { if (E && (E.ofertas || []).length) desenharOfertas(); }, 10000);
function aplicar(it, fala) {
  if (it.tipo === 'encerrar') { encerrar(); return; }
  if (it.tipo === 'chamado') { atenderChamado(it.pergunta); return; }
  if (it.tipo === 'assunto') { for (const id of it.ids) contarAssunto(id); return; }
  if (it.tipo === 'decisao') { E.decisoes.push({ texto: it.texto, quem: fala.quem, hora: fala.hora, t: fala.t, novo: true }); return; }
  if (it.tipo === 'pendencia') {
    const donoEu = !!it.dono && it.dono === fala.quem && !E.participantes.some((p) => norm(it.texto).includes(norm(p)));
    E.pendencias.push({ texto: it.texto, dono: it.dono, donoEu, prazo: it.prazo, quem: fala.quem, hora: fala.hora, t: fala.t, novo: true }); return;
  }
  if (it.tipo === 'pedido') {
    const p = { texto: it.texto, tela: it.tela, definido: !!it.definido, quem: fala.quem, hora: fala.hora, t: fala.t, frase: fala.texto, foto: fotoDaTela(), novo: true };
    E.pedidos.push(p);
    if (p.definido) mandarParaFila(p);
  }
}

// ---------------------------------------------------------------------------
// CARTÕES AUTOMÁTICOS (calados) e PERMISSÃO
// ---------------------------------------------------------------------------
function contarAssunto(id) {
  const a = E.assuntos[id] || (E.assuntos[id] = { vezes: 0, ultimo: null, mencoes: [] });
  const agora = Date.now();
  a.vezes++; a.ultimo = agora; a.mencoes = [...(a.mencoes || []).filter((t) => agora - t < AUTO_JANELA_MS), agora];
  const def = ASSUNTOS.find((x) => x.id === id);
  if (!def || !def.pergunta || SEM_CARTOES) return;
  if (a.mencoes.length < (def.gatilho || 2)) return;
  const ja = E.auto[id];
  if (ja && (ja.carregando || agora - ja.em < AUTO_INTERVALO_MS)) return;   // não repete: atualiza no máximo a cada 10 min
  cartaoAutomatico(def);
}
function contextoDaConversa() { return E.linhas.slice(-4).map((l) => l.texto).join(' / ').slice(0, 500); }
async function cartaoAutomatico(def) {
  // def.chave: o lugar do cartão (diagnóstico e fazenda têm o deles); def.id: o assunto da permissão
  const k = def.chave || def.id;
  const sens = def.sensivel !== undefined ? def.sensivel : ASSUNTOS_SENSIVEIS.includes(def.id);
  if (sens && reuniaoMista() && !E.liberado[def.id]) { pedirPermissao({ assunto: def.id, titulo: def.nome, pergunta: def.pergunta, auto: true, falar: false, def }); return; }
  const c = E.auto[k] || (E.auto[k] = { assunto: k, titulo: def.nome, texto: '', telas: [], em: 0 });
  const novo = !c.em;
  c.carregando = true; c.em = Date.now(); c.abertoEm = Date.now(); c.fechado = false; desenhar();
  anunciarCartao({ assunto: k, titulo: def.nome, estado: 'chegando' });
  const r = await perguntarAoAgente(def.pergunta);
  c.carregando = false;
  if (r.erro) { c.texto = r.erro === 'sem login' ? 'Entre com a conta do app para o Oscar trazer os números.' : r.erro; c.telas = []; }
  else { c.texto = String(r.texto || '').trim(); c.telas = Array.isArray(r.telas) ? r.telas.slice(0, 4) : []; }
  c.hora = hora(); salvar(); desenhar();
  anunciarCartao({ assunto: k, titulo: def.nome, estado: novo ? 'pronto' : 'atualizado', el: RAIZ.querySelector(`#mesa [data-auto="${k}"]`) });
  if (def.aoChegar && !r.erro) def.aoChegar(c);
}
function chaveSensivel(texto) { const ids = assuntosDe(texto).filter((i) => ASSUNTOS_SENSIVEIS.includes(i)); return ids[0] || 'restrito'; }
function pedirPermissao(w) {
  const chave = w.assunto;
  if (E.esperas.some((x) => x.assunto === chave && x.pergunta === w.pergunta)) return;
  E.esperas.push({ ...w, em: Date.now(), hora: hora() });
  salvar(); desenhar();
  if (w.falar) falar(`Posso mostrar ${w.titulo.toLowerCase()}? Tem gente na reunião sem acesso a isso. Um sócio precisa autorizar.`);
}
function conceder(w, quem, como) {
  // a permissão vale para o ASSUNTO na reunião inteira: libera todos os pedidos dele que estavam esperando
  const juntos = E.esperas.filter((x) => x.assunto === w.assunto);
  E.esperas = E.esperas.filter((x) => x.assunto !== w.assunto);
  E.liberado[w.assunto] = true;
  E.permissoes.push({ assunto: w.titulo, chave: w.assunto, quem, como, hora: hora(), sim: true });
  salvar(); desenhar();
  for (const x of juntos) {
    if (x.auto) { const def = x.def || ASSUNTOS.find((d) => d.id === x.assunto); if (def) cartaoAutomatico(def); }
    else puxarCartao(x.titulo, x.pergunta, true);
  }
}
function negar(w, quem, como) {
  E.esperas = E.esperas.filter((x) => x !== w);
  E.permissoes.push({ assunto: w.titulo, chave: w.assunto, quem, como, hora: hora(), sim: false });
  salvar(); desenhar();
}

async function mandarParaFila(p) {
  if (!E.claude) { p.fila = null; p.foraDaFila = 'Claude Code desligado'; return; }
  const r = await balcao('/api/fila', { texto: p.texto, frase: p.frase, quem: p.quem, tela: p.tela, reuniao: E.id, imagem: p.foto || undefined });
  if (r && r.item) { p.fila = r.item.id; p.foraDaFila = null; } else p.foraDaFila = 'balcão do Mac desligado';
  salvar(); desenhar();
}
async function atenderChamado(pergunta, opcoes = {}) {
  conversaAte = 0;
  const p = norm(pergunta);
  Mascote.estado('pensando');
  if (!p) { aguardandoPergunta = Date.now() + 10000; aguardandoDe = origemDaUltima; Mascote.estado('ouvindo'); legenda(MARCA.dizer, 'Pode falar…', true); return; }
  const gav = p.match(/\b(mostra|abre|abrir|ver)\b.*\b(decisoes|decisao|pendencias|pendencia|fila|sugestoes|vozes|painel)\b/);
  if (gav) abrirGaveta({ decisao: 'decisoes', decisoes: 'decisoes', pendencia: 'pendencias', pendencias: 'pendencias', fila: 'fila', sugestoes: 'sugestoes', vozes: 'vozes', painel: 'decisoes' }[gav[2]]);
  // 07/out: "Oscar, a contadora Ciça já apresentou as pendências dela…?" (da Tainá) virou "Nenhuma pendência anotada" — o atalho
  // do painel só vale para pergunta sobre o painel (perguntaDoPainel); o resto vai ao agente
  if (admitirPelaVoz(pergunta)) return;
  // "Oscar, pode" / "pode trazer" com um "Posso trazer…?" na tela: traz o último oferecido
  const ofertasVivas = (E.ofertas || []).filter((o) => Date.now() - o.em < 120000);
  if (ofertasVivas.length && /^(pode|sim|pode sim|traz|traga|pode trazer|manda)$/.test(p)) { const o = ofertasVivas[ofertasVivas.length - 1]; E.ofertas = E.ofertas.filter((x) => x !== o); desenharOfertas(); await puxarCartao(o.frase.slice(0, 60), o.frase, true); return; }
  if (perguntaDoPainel(pergunta, 'decisoes') && /\b(quantas|quais|le|ler|mostra|resume|resumo|lista|repete|decisoes|decisao)\b/.test(p)) { falar(E.decisoes.length ? `Temos ${E.decisoes.length} decisões: ${E.decisoes.map((d) => d.texto).join('; ')}.` : 'Nenhuma decisão registrada ainda.'); return; }
  if (perguntaDoPainel(pergunta, 'pendencias') && !/\banota\b/.test(p)) { falar(E.pendencias.length ? `São ${E.pendencias.length} pendências: ${E.pendencias.map((x) => `${x.texto}${x.dono ? ', com ' + x.dono : ''}${x.prazo ? ', até ' + x.prazo : ''}`).join('; ')}.` : 'Nenhuma pendência anotada.'); return; }
  if (/\bclaude\b/.test(p) && /\b(desliga|desativa|tira|sai)\b/.test(p)) { mudarClaude(false); falar('Claude Code fora. As decisões ficam só na ata.'); return; }
  if (/\bclaude\b/.test(p) && /\b(liga|ativa|participa|participar|entra|chama)\b/.test(p)) { mudarClaude(true); falar('Claude Code participando. O que for decidido para o app vai para a fila.'); return; }
  if (/\bfila\b/.test(p)) { const n = E.pedidos.filter((x) => x.fila).length; falar(n ? `${n} pedidos na fila do Claude Code.` : 'A fila do Claude Code está vazia.'); return; }
  if (/\b(compartilha|mostra) (a )?tela\b/.test(p)) { falar('Clique em compartilhar tela no computador que vai mostrar.'); return; }
  // CONVITES: "Oscar, pode mandar" (os convites prontos) · "Oscar, chama a Tainá" (mais gente de longe)
  if ((E.convites || []).some((x) => x.tel && !x.aberto) && !E.esperas.length && PODE_MANDAR_RE.test(p)) { mandarConvites(); return; }
  // "Oscar, mande o link pro Emiliano" com o convite dele já pronto: abre o zap DELE (07/out: só repetia "está pronto")
  if (!MODO_CONVIDADO) { const prontos = convitesParaMandar(pergunta, E.convites || []); if (prontos.length) { mandarConvites(prontos); return; } }
  if (!MODO_CONVIDADO) {
    const pc = pedidoDeConviteNaReuniao(pergunta, await lerPessoasDoApp(), euNome);
    if (pc) { if (pc.nomes.length) convidarMais(pc.nomes, pc.link); else mostrarLink(); return; }
  }
  // O RESTO DO JARVIS segue valendo dentro da reunião: música, modo apresentação, "volta aquela", janelas (sem servidor)
  if (PONTE && PONTE.comandoLocal(pergunta)) { Mascote.estado('ouvindo'); return; }
  if (/\b(fundo de vidro|vidro)\b/.test(p) && /\b(liga|ativa|desliga|tira|desativa)\b/.test(p)) { const quer = !/\b(desliga|tira|desativa)\b/.test(p); const c = minhaCamada(); if (c && c.ligado !== quer) alternarVidro(); else vidroQuer = quer; falar(quer ? 'Fundo de vidro ligado.' : 'Fundo de vidro desligado.'); return; }
  if (sensivel(pergunta) && reuniaoMista()) {
    const chave = chaveSensivel(pergunta);
    if (!E.liberado[chave]) { pedirPermissao({ assunto: chave, titulo: (ASSUNTOS.find((x) => x.id === chave) || {}).nome || 'esse dado', pergunta, auto: false, falar: true }); return; }
  }
  await puxarCartao(pergunta.slice(0, 60), pergunta, true, opcoes);
}
async function puxarCartao(titulo, pergunta, falarResposta, opcoes = {}) {
  const cartao = { titulo, pergunta, hora: hora(), texto: 'Buscando…', telas: [], carregando: true };
  E.dados.unshift(cartao); desenhar();
  const r = await perguntarAoAgente(pergunta, { quem: quemPerguntou, ...opcoes });
  cartao.carregando = false;
  // sem "Oscar": o servidor decidiu que não era com ele ([[SILENCIO]]) — o cartão some, nada é dito
  if (opcoes.semNome && r.silencio) { E.dados = E.dados.filter((x) => x !== cartao); salvar(); desenhar(); return; }
  if (r.erro) { cartao.texto = r.erro === 'sem login' ? 'Entre com a sua conta do app (botão no topo) para eu trazer os dados.' : r.erro; desenhar(); if (falarResposta) falar(r.erro === 'sem login' ? 'Entre com a sua conta do app para eu trazer os dados.' : r.erro); return; }
  cartao.texto = String(r.texto || '').trim(); cartao.telas = Array.isArray(r.telas) ? r.telas.slice(0, 6) : [];
  salvar(); desenhar();
  anunciarCartao({ assunto: 'pedido', titulo, estado: 'pronto', el: $('dados').firstElementChild });
  // as telas ricas (dossiê, mapa) abrem no Jarvis por baixo, como fora da reunião ("já está na sua tela" tem que ser verdade)
  if (PONTE && !MODO_CONVIDADO && cartao.telas.length) PONTE.mostrarTelas(r.telas);
  if (falarResposta && cartao.texto && !r.silencio) await falar(cartao.texto);
  if (falarResposta) abrirConversaDaReuniao();
}
// CONVERSA CORRIDA NA REUNIÃO (06/out: "o que ele comprou? me abre esses pedidos" logo depois da resposta, sem "Oscar", ficava
// sem resposta). Depois que o Oscar responde, por 25 s um PEDIDO claro da mesma origem (sala) vale sem o nome — conversa da sala
// (sem verbo de pedido) continua só no painel.
let conversaAte = 0, conversaDe = '';
function abrirConversaDaReuniao() { conversaAte = Date.now() + 25000; conversaDe = origemDaUltima; }
const PEDIDO_AO_OSCAR_RE = /^(e |entao |agora |ok |beleza )?(me |nos )?(abre|abra|mostra|mostre|traz|traga|puxa|puxe|fala|diz|conta|explica|detalha|compara|quanto|quantos|quantas|qual|quais|como|onde|quando|o que|e o|e a|e os|e as|eu quero que (voce|ce|vc) |quero (ver|que)|pode (abrir|mostrar|trazer))\b/;

// ---------------------------------------------------------------------------
// PAINEL
// ---------------------------------------------------------------------------
function legenda(quem, texto, oscar = false, interino = false) {
  $('legenda').innerHTML = `<span class="quem ${oscar ? 'oscar' : ''}">${esc(quem)}:</span><span style="${interino ? 'opacity:.6' : ''}">${esc(String(texto).slice(-260))}</span>`;
}
function avisar(t) { $('aviso').textContent = t; $('aviso').style.display = t ? 'block' : 'none'; }
function lista(el, itens, vazio, linha) {
  $(el).innerHTML = itens.length ? itens.map((x, i) => `<li class="${x.novo ? 'novo' : ''}">${linha(x, i)}</li>`).join('') : `<li class="vazio">${vazio}</li>`;
  itens.forEach((x) => { x.novo = false; });
}
let filaRemota = [];
const iniciais = (n) => String(n).split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
// o programador de pixel do Claude Code (desenho NOSSO, 16×16, só para as reuniões internas)
const PIXEL = [
  '................', '.....hhhhhh.....', '....hhhhhhhh....', '....hssssssh....', '....sossosss....', '....ssssssss....', '.....ssmmss.....', '......ssss......',
  '...bbbbbbbbbb...', '..bbbbbbbbbbbb..', '..bbllllllllbb..', '..ssllllllllss..', '...lllggggllll..', '..cccccccccccc..', '..cccccccccccc..', '................'];
const CORES_PIXEL = { h: '#3b2a1a', s: '#e8b98f', o: '#1b1b1b', m: '#b5655a', b: '#3d6fb8', l: '#9aa3ad', g: '#7ddc8a', c: '#5b6470' };
const BONECO = `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">${PIXEL.map((linha, y) => [...linha].map((ch, x) => ch === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${CORES_PIXEL[ch]}"${y >= 12 && 'sc'.includes(ch) ? ' class="maos"' : ''}/>`).join('')).join('')}</svg>`;
const ETAPAS = ['lendo o código', 'editando', 'testando', 'pronto para revisar'];
function ladrilhoClaude() {
  const ativos = filaRemota.filter((i) => i.reuniao === E.id || E.pedidos.some((p) => p.fila === i.id));
  const atual = ativos.find((i) => ['em código', 'lendo o código', 'editando', 'testando'].includes(i.status)) || [...ativos].reverse().find((i) => i.status === 'pronto para revisar') || ativos.find((i) => i.status === 'definido');
  const trabalhando = atual && atual.status !== 'definido' && atual.status !== 'pronto para revisar';
  const k = atual ? (atual.status === 'em código' ? 0 : ETAPAS.indexOf(atual.status)) : -1;
  const etapas = ETAPAS.map((e, i) => `<span class="${k > i || (atual && atual.status === 'pronto para revisar') ? 'feita' : k === i ? 'agora' : ''}">${e}</span>`).join('');
  const img = (q) => atual && (q === 'preview' ? atual.preview : atual.imagem) ? `<img alt="" src="${BALCAO}/api/fila/imagem?id=${encodeURIComponent(atual.id)}&qual=${q}&v=${encodeURIComponent(atual.atualizado || '')}">` : '';
  const vista = !atual ? `<b>Esperando</b> — o que a reunião decidir para o app aparece aqui. Na fila: ${ativos.filter((i) => i.status === 'definido').length}.`
    : `<b>${esc(atual.id)}</b> · ${esc(atual.status)}<br>${esc(atual.texto)} <span style="color:var(--mudo)">— ${esc(atual.quem || 'sala')}${atual.tela ? ' · ' + esc(atual.tela) : ''}</span>
      <div class="etapas">${etapas}</div>
      ${atual.progresso && atual.progresso.length ? `<div>agora: ${esc(atual.progresso[0].texto)}</div>` : ''}
      ${atual.resumo ? `<div>mudança: ${esc(atual.resumo)}</div>` : ''}
      ${atual.arquivos && atual.arquivos.length ? `<div>arquivos: ${atual.arquivos.slice(0, 4).map((a) => `<code>${esc(a)}</code>`).join(', ')}${atual.arquivos.length > 4 ? ` +${atual.arquivos.length - 4}` : ''}</div>` : ''}
      ${atual.portoes && atual.portoes.length ? `<div>portões: ${esc(atual.portoes[0].texto)}</div>` : ''}
      ${atual.link ? `<div>prévia: <a href="${esc(atual.link)}" target="_blank" rel="noopener" style="color:var(--verde)">${esc(atual.link)}</a></div>` : ''}
      <div class="miniaturas">${img('foto')}${img('preview')}</div>`;
  return `<div class="ladrilho claude" id="ladrilhoClaude"><div class="boneco ${trabalhando ? 'trabalhando' : ''}">${BONECO}<span>Claude Code</span></div><div class="vista">${vista}</div></div>`;
}
// vídeos persistentes (redesenhar a faixa não pode recriar o <video>, senão pisca): um por stream
const videos = new Map();
function videoDe(stream, espelho = false) {
  let v = videos.get(stream.id);
  if (!v) { v = Object.assign(document.createElement('video'), { autoplay: true, muted: true, playsInline: true }); v.srcObject = stream; if (!espelho) v.style.transform = 'none'; videos.set(stream.id, v); }
  return v;
}
// FUNDO DE VIDRO: a pessoa sem o verde-chave, num canvas (um por stream, também persistente)
const recortes = new Map();
function recorteDe(stream) {
  let c = recortes.get(stream.id);
  if (!c) { c = telaRecortada(stream); recortes.set(stream.id, c); }
  return c;
}
/** o que vai dentro do ladrilho: o recorte (com vidro) ou o vídeo normal */
function imagemDe(stream, vidro, espelho) { return vidro ? recorteDe(stream) : videoDe(stream, espelho); }
/** a câmera de cada pessoa: { nome → MediaStream } (anfitrião: dos convidados; convidado: do mapa que o Mac manda) */
function camerasPorNome() {
  const m = {};   // nome → { stream, vidro }
  if (Sala.anfitriao) for (const c of Sala.anfitriao.convidados) { const cam = c.streams.find((x) => x.tipo === 'camera' && x.stream.getVideoTracks().length); if (cam) m[c.nome] = { stream: cam.stream, vidro: !!c.vidro }; }
  if (MODO_CONVIDADO) {
    for (const [sid, info] of Object.entries(Sala.mapa)) { const st = Sala.recebidos.get(sid); if (st && info.tipo === 'camera' && st.getVideoTracks().length) m[info.nome] = { stream: st, vidro: !!info.vidro }; }
    if (Sala.minha && Sala.minha.getVideoTracks().length) m[Sala.euNome] = { stream: Sala.minha, vidro: !!(Sala.minhaCamada && Sala.minhaCamada.ligado) };
  }
  return m;
}
function desenharFaixa() {
  if (!E) return;
  const falandoAgora = Date.now() - E.quemFalaEm < 6000 ? E.quemFala : '';
  const cams = camerasPorNome();
  // quem está SOZINHO na sala do anfitrião vira o ladrilho "Sala · <nome>" (no Mac e, desde 06/out, também para quem está longe)
  const sozinhoNaSala = MODO_CONVIDADO ? (E.soUmaNaSala || '') : soUmaNaSala();
  const camSala = MODO_CONVIDADO ? cams.Sala : (fluxoCamera ? { stream: fluxoCamera, vidro: !!(camadaSala && camadaSala.ligado) } : null);
  const pessoa = (nome, extra = '') => {
    const a = E.acesso[nome];
    const tag = a ? `<span class="acesso ${a.nivel}">${a.nivel === 'admin' ? 'sócio/admin' : 'sem acesso a restrito'}</span>` : '<span class="acesso">acesso ?</span>';
    const longe = Sala.remotos[nome] ? ' <span class="acesso">de longe</span>' : '';
    return `<div class="ladrilho ${falandoAgora === nome ? 'falando' : ''} ${cams[nome] && cams[nome].vidro ? 'vidro' : ''} ${extra}" data-pessoa="${esc(nome)}">${cams[nome] ? '' : `<div class="ini">${esc(iniciais(nome))}</div>`}<div class="nome">${esc(nome)}${extra === 'eu' ? ' (você)' : ''} ${tag}${longe}</div></div>`;
  };
  const sala = `<div class="ladrilho ${!MODO_CONVIDADO && soUmaNaSala() && falandoAgora === soUmaNaSala() ? 'falando' : ''} ${camSala && camSala.vidro ? 'vidro' : ''}" id="ladrilhoSala">${camSala ? '' : '<div class="ini">📷</div>'}<div class="nome">${MODO_CONVIDADO ? 'Sala' + (sozinhoNaSala ? ' · ' + esc(sozinhoNaSala) : ' (Mac do anfitrião)') : 'Sala' + (soUmaNaSala() ? ' · ' + esc(soUmaNaSala()) : '') + ' (você)'}${camSala ? '' : ' · câmera desligada'}</div></div>`;
  const desconhecidas = vozesServidor.filter((v) => !v.nome && v.segundos >= 2).map((v) => `<div class="ladrilho desconhecida ${falandoAgora === v.voz ? 'falando' : ''}"><div class="ini">?</div><div class="nome">${esc(v.voz)} <span class="acesso restrito">sem nome</span></div></div>`).join('');
  // o convidado SEMPRE se vê (na 1ª reunião a Tainá não se via até o painel chegar)
  // no Mac, quem está sozinho na sala já é o ladrilho "Sala · <nome> (você)" — sem ladrilho repetido
  const lista = (MODO_CONVIDADO ? (Sala.euNome && !E.participantes.includes(Sala.euNome) ? [...E.participantes, Sala.euNome] : E.participantes) : E.participantes).filter((p) => p !== sozinhoNaSala);
  $('faixa').innerHTML = sala + lista.map((p) => pessoa(p, MODO_CONVIDADO && p === Sala.euNome ? 'eu' : '')).join('') + desconhecidas + (E.claude && !MODO_CONVIDADO ? ladrilhoClaude() : '');
  if (camSala) $('ladrilhoSala').prepend(imagemDe(camSala.stream, camSala.vidro, !MODO_CONVIDADO));
  for (const [nome, c] of Object.entries(cams)) { const el = RAIZ.querySelector(`#faixa [data-pessoa="${CSS.escape(nome)}"]`); if (el) el.prepend(imagemDe(c.stream, c.vidro, MODO_CONVIDADO && c.stream === Sala.minha)); }
}
function tabelaDe(v) {
  const linhas = Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').slice(0, 8) : [];
  if (!linhas.length) return '';
  const cols = Object.keys(linhas[0]).filter((k) => ['string', 'number'].includes(typeof linhas[0][k])).slice(0, 5);
  if (!cols.length) return '';
  return `<table><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${linhas.map((l) => `<tr>${cols.map((c) => `<td>${esc(typeof l[c] === 'number' ? l[c].toLocaleString('pt-BR') : l[c])}</td>`).join('')}</tr>`).join('')}</table>`;
}
function telaHtml(t) {
  const r = (t && t.resultado) || {};
  if (t.ferramenta === 'imagem' && r.base64) return `<img alt="" src="data:${esc(r.mime || 'image/png')};base64,${r.base64}">${r.legenda ? `<p>${esc(r.legenda)}</p>` : ''}`;
  const simples = Object.entries(r).filter(([, v]) => ['string', 'number'].includes(typeof v) && String(v).length < 140).slice(0, 8);
  const lista1 = Object.values(r).find((v) => Array.isArray(v));
  return `<p><b>${esc(String(t.ferramenta || '').replace(/_/g, ' '))}</b></p>${simples.map(([k, v]) => `<p>${esc(k.replace(/_/g, ' '))}: ${esc(typeof v === 'number' ? v.toLocaleString('pt-BR') : v)}</p>`).join('')}${tabelaDe(lista1)}`;
}
// cartão com chave: só é CRIADO uma vez (a animação de subir roda só na chegada); depois só troca o conteúdo
function cartoesNoPalco(caixa, lista, conteudo, dataAuto) {
  const vivos = new Set(lista.map((c) => c.chave));
  for (const el of [...caixa.children]) if (!vivos.has(el.dataset.chave) && !el.classList.contains('saindo')) { el.classList.add('saindo'); setTimeout(() => el.remove(), 450); }
  for (const c of lista) {
    let el = caixa.querySelector(`[data-chave="${c.chave}"]`);
    const html = `<button class="mini fechar" data-fechar="${c.chave}">×</button>` + conteudo(c);
    if (!el) { el = document.createElement('div'); el.className = 'holo'; el.dataset.chave = c.chave; if (dataAuto) el.dataset.auto = dataAuto(c); caixa.prepend(el); }
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
  }
}
function abrirGaveta(secao) {
  $('gaveta').classList.add('aberta'); $('gaveta').setAttribute('aria-hidden', 'false');
  RAIZ.querySelectorAll('#gaveta .card').forEach((c) => c.classList.toggle('foco', c.id === 'g-' + secao));
  const alvo = $('g-' + secao); if (alvo) alvo.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function fecharGaveta() { $('gaveta').classList.remove('aberta'); $('gaveta').setAttribute('aria-hidden', 'true'); }
function desenhar() {
  if (!E) return;
  const ass = Object.entries(E.assuntos).sort((a, b) => b[1].ultimo - a[1].ultimo);
  $('assuntos').innerHTML = ass.slice(0, 5).map(([id, a]) => `<span class="chip ${Date.now() - a.ultimo < 90000 ? 'quente' : ''}">${esc((ASSUNTOS.find((x) => x.id === id) || {}).nome || id)}</span>`).join('');
  lista('decisoes', E.decisoes, 'Diga “decidido: …” ou “fica decidido que …”.', (d) => `${esc(d.texto)}<span class="meta">${esc(d.quem)} · ${d.hora}</span>`);
  lista('pendencias', E.pendencias, '“O Ararê fica de … até sexta.”', (p, i) => `${esc(p.texto)}<span class="meta">dono: <b>${esc(p.dono || 'sem dono')}</b> · prazo: <b>${esc(p.prazo || 'sem prazo')}</b> · ${esc(p.quem)} ${p.hora} <button class="mini" data-tirar-pend="${i}">tirar</button></span>`);
  const sug = E.pedidos.map((p, i) => ({ ...p, i })).filter((p) => !p.definido);
  lista('sugestoes', sug, '“O app devia …” aparece aqui.', (p) => `${esc(p.texto)}<span class="meta">${esc(p.quem)} · ${p.hora}${p.tela ? ' · ' + esc(p.tela) : ''} <button class="mini" data-definir="${p.i}">definir</button></span>${p.foto ? `<img class="foto" alt="" src="${p.foto}">` : ''}`);
  const def = E.pedidos.filter((p) => p.definido);
  lista('fila', def, E.claude ? 'Mudança no app DECIDIDA entra aqui.' : 'Claude Code desligado: decisões do app ficam só na ata.', (p) => {
    const rem = filaRemota.find((x) => x.id === p.fila);
    const st = rem ? rem.status : (p.fila ? 'definido' : (p.foraDaFila ? 'só na ata' : 'enviando…'));
    return `${esc(p.texto)} <span class="st st-${norm(st).replace(/ /g, '-')}">${esc(st)}</span><span class="meta">${p.fila ? esc(p.fila) + ' · ' : ''}${esc(p.quem)} · ${p.hora}${p.tela ? ' · ' + esc(p.tela) : ''}${p.foraDaFila && p.foraDaFila !== 'Claude Code desligado' ? ' · ' + esc(p.foraDaFila) : ''}${rem && rem.branch ? ' · ' + esc(rem.branch) : ''}${p.fila && rem && rem.status === 'definido' ? ` <button class="mini" data-descartar="${esc(p.fila)}">descartar</button>` : ''}</span>${p.foto ? `<img class="foto" alt="" src="${p.foto}">` : ''}`;
  });
  $('filaEstado').textContent = E.claude ? (balcaoVivo ? '— ligado, balcão do Mac ok' : '— ligado, balcão do Mac SEM resposta') : '— desligado';
  // CARTÕES no palco: só os abertos; cada um fica 90 s e vai para o canto (chip) — clicar no chip traz de volta
  const agora = Date.now();
  for (const c of [...E.dados, ...Object.values(E.auto)]) { if (!c.chave) c.chave = 'c' + Math.random().toString(36).slice(2, 9); if (!c.abertoEm) c.abertoEm = c.em || agora; if (!c.fechado && !c.carregando && !MODO_CONVIDADO && agora - c.abertoEm > 90000) c.fechado = true; }
  cartoesNoPalco($('dados'), E.dados.filter((d) => !d.fechado).slice(0, 3), (d) => `<h3>${esc(d.titulo)} <span class="atual">${d.carregando ? 'buscando…' : esc(d.hora || '')}</span></h3><p>${esc(d.texto)}</p>${(d.telas || []).map(telaHtml).join('')}`);
  // NA MESA: pedidos de permissão (recolhidos) e cartões automáticos
  $('esperas').innerHTML = E.esperas.map((w, i) => `<div class="espera"><b>${esc(w.titulo)}</b> — aguardando permissão<span class="meta">Tem gente na sala sem acesso a isso. Um sócio diz “pode mostrar” (voz reconhecida) ou clica.${w.auto ? ' (cartão automático)' : ''}</span><button class="mini" data-permitir="${i}" ${E.operadorAdmin ? '' : 'disabled title="Só quem está logado como admin neste navegador"'}>permitir</button><button class="mini" data-negar="${i}">agora não</button></div>`).join('');
  const autos = Object.values(E.auto).sort((a, b) => b.em - a.em);
  cartoesNoPalco($('mesa'), autos.filter((c) => !c.fechado), (c) => `<h3>${esc(c.titulo)} <span class="atual">${c.carregando ? 'buscando…' : 'atualizado ' + esc(c.hora || '')}</span></h3><p>${esc(c.texto)}</p>${(c.telas || []).map(telaHtml).join('')}`, (c) => c.assunto);
  // RESUMO no canto
  $('rDec').textContent = E.decisoes.length; $('rPend').textContent = E.pendencias.length; $('rFila').textContent = E.pedidos.filter((p) => p.fila).length;
  $('rUltima').textContent = E.decisoes.length ? '“' + E.decisoes[E.decisoes.length - 1].texto + '”' : '';
  $('rFilaLinha').hidden = !E.claude;
  const mins = [...E.dados.filter((d) => d.fechado), ...autos.filter((c) => c.fechado)];
  $('minimizados').innerHTML = mins.map((c) => `<span class="chip" data-reabrir="${esc(c.chave)}">${esc(c.titulo)}</span>`).join('');
  // VOZES: as sem nome pedem o nome uma vez
  const semNome = vozesServidor.filter((v) => !v.nome && v.segundos >= 2);
  const comNome = vozesServidor.filter((v) => v.nome);
  $('vozesEstado').textContent = motorVozes === 'pronto' ? '— reconhecendo pela voz, no próprio Mac' : motorVozes === 'carregando' ? '— ligando o reconhecimento de voz (≈ 15 s)…' : motorVozes === 'indisponivel' ? '— reconhecimento de voz indisponível neste computador (use “quem fala” escrevendo “aqui é o …”)' : balcaoVivo ? '— esperando a primeira fala' : '— balcão do Mac desligado';
  $('vozes').innerHTML = (semNome.length || comNome.length) ? [
    ...semNome.map((v) => `<div class="voz"><b>${esc(v.voz)}</b> falou ${Math.round(v.segundos)} s — quem é? ${E.participantes.map((p) => `<button class="mini" data-voz="${esc(v.voz)}" data-nome="${esc(p)}">${esc(p)}</button>`).join('')}<button class="mini" data-voz="${esc(v.voz)}" data-nome="">outro…</button><label style="font-size:.72rem;color:var(--mudo)"><input type="checkbox" data-guardar="${esc(v.voz)}" checked> guardar a voz neste Mac</label><q>${esc(v.ultimo)}</q></div>`),
    ...comNome.map((v) => `<div class="voz">${esc(v.voz.startsWith('P:') ? v.nome : v.voz + ' = ' + v.nome)} <span style="color:var(--mudo);font-size:.75rem">· ${Math.round(v.segundos)} s</span></div>`),
  ].join('') : '<span class="vazio">Quando alguém falar, a voz aparece aqui para dar o nome uma vez.</span>';
  desenharFaixa();
  desenharSala();
  desenharConvites();
  enviarPainel();
}
function mudarClaude(v) {
  E.claude = !!v;
  $('btnClaude').textContent = 'Claude Code: ' + (E.claude ? 'ligado' : 'desligado');
  $('btnClaude').classList.toggle('ligado', E.claude);
  if (E.claude) E.pedidos.filter((p) => p.definido && !p.fila).forEach(mandarParaFila);
  salvar(); desenhar();
}
function atualizarMic() { $('btnMic').textContent = 'Escuta: ' + (Escuta.ligado ? 'ligada' : 'pausada'); }

// ---------------------------------------------------------------------------
// ATA — a transcrição com nome vem do Mac (Whisper + voz); sem ela, a legenda do Chrome
// ---------------------------------------------------------------------------
function transcricao() {
  return E.segmentos.length
    ? E.segmentos.map((s) => ({ hora: hora(s.ini), quem: s.quem, texto: s.texto }))
    : E.linhas.map((l) => ({ hora: l.hora, quem: l.quem, texto: l.texto }));
}
function dadosDaAta() {
  const ini = new Date(E.inicio), fim = new Date(E.fim || Date.now());
  const min = Math.round((fim - ini) / 60000);
  return {
    reuniao: E.id, tema: TEMA_ID, dia: E.id.slice(0, 10), hora: hora(E.inicio), duracao: `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`,
    participantes: E.participantes,
    assuntos: Object.entries(E.assuntos).sort((a, b) => b[1].vezes - a[1].vezes).map(([id, a]) => ({ nome: (ASSUNTOS.find((x) => x.id === id) || {}).nome || id, vezes: a.vezes })),
    decisoes: E.decisoes.map(({ texto, quem, hora: h }) => ({ texto, quem, hora: h })),
    pendencias: E.pendencias.map(({ texto, dono, prazo, hora: h }) => ({ texto, dono, prazo, hora: h })),
    pedidos: E.pedidos.map(({ texto, tela, definido, quem, hora: h, fila }) => ({ texto, tela, definido, quem, hora: h, fila: fila || null })),
    dados: [...E.dados.map(({ titulo, texto, hora: h }) => ({ titulo, texto, hora: h })), ...Object.values(E.auto).map(({ titulo, texto, hora: h }) => ({ titulo: titulo + ' (automático)', texto, hora: h }))],
    permissoes: E.permissoes,
    tecnico: E.tecnico || {},
    conexao: E.conexao || {},
    transcricaoComVoz: E.segmentos.length > 0,
  };
}
function ataTexto(d) {
  const L = [`ATA — Reunião ${MARCA.nome} ${d.dia.split('-').reverse().join('/')} ${d.hora} (${d.duracao})`, `Participantes: ${d.participantes.join(', ') || '—'}`, 'Esta reunião foi transcrita (aviso dado no início).', '',
    'DECISÕES', ...(d.decisoes.length ? d.decisoes.map((x, i) => `${i + 1}. ${x.texto} (${x.quem}, ${x.hora})`) : ['— nenhuma']), '',
    'PENDÊNCIAS', ...(d.pendencias.length ? d.pendencias.map((x, i) => `${i + 1}. ${x.texto} — dono: ${x.dono || 'sem dono'} — prazo: ${x.prazo || 'sem prazo'}`) : ['— nenhuma']), '',
    'PEDIDOS DE MUDANÇA NO APP', ...(d.pedidos.length ? d.pedidos.map((x, i) => `${i + 1}. [${x.definido ? 'DEFINIDO' : 'sugestão'}] ${x.texto}${x.tela ? ' (' + x.tela + ')' : ''}${x.fila ? ' → fila Claude Code ' + x.fila : ''}`) : ['— nenhum']), '',
    'PERMISSÕES PARA DADO RESTRITO', ...(d.permissoes.length ? d.permissoes.map((x) => `• ${x.hora} — ${x.assunto}: ${x.sim ? 'AUTORIZADO' : 'negado'} por ${x.quem} (${x.como})`) : ['— nenhuma pedida']), '',
    'ASSUNTOS', d.assuntos.map((a) => `${a.nome} (${a.vezes}×)`).join(' · ') || '—', '',
    ...(d.dados.length ? ['DADOS MOSTRADOS', ...d.dados.map((x) => `• ${x.titulo} (${x.hora || ''}): ${x.texto}`), ''] : []),
    ...(Object.keys(d.conexao || {}).length ? ['CONEXÃO DE QUEM ESTAVA LONGE', ...Object.entries(d.conexao).map(([n, v]) => `• ${n}: ${v.estado} — quedas ${v.quedas}, caminho refeito ${v.reinicios}×, imagem travou ${v.travadas}×, pacotes perdidos ${v.perdidos}, menor ${v.fpsMin === 99 ? '?' : v.fpsMin} quadros/s, atraso máx. ${v.rttMax || '?'} ms`), ''] : []),
    ...(Object.keys(d.tecnico || {}).length ? ['FUNDO DE VIDRO DE QUEM ESTAVA LONGE', ...Object.entries(d.tecnico).map(([n, v]) => `• ${n}: ${v.estado}${v.caminho ? ' (' + v.caminho + ')' : ''} — ${v.aparelho || '?'}`), ''] : []),
    `TRANSCRIÇÃO${d.transcricaoComVoz ? ' (quem falou reconhecido pela voz)' : ''}`, ...transcricao().map((l) => `[${l.hora}] ${l.quem}: ${l.texto}`)];
  return L.join('\n');
}
function ataHtml(d) {
  const sec = (t, itens) => `<section><h2>${t}</h2>${itens}</section>`;
  const ul = (a, f, v) => a.length ? `<ol>${a.map((x) => `<li>${f(x)}</li>`).join('')}</ol>` : `<p class="m">${v}</p>`;
  const fotos = E.pedidos.filter((p) => p.foto);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ata ${d.dia} ${d.hora}</title><style>
:root{--bg:#0b1102;--txt:#f1e9c4;--verde:#c4ca3c;--ouro:#f9a322;--mudo:#b3a97a;--borda:rgba(214,220,110,.3)}
body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.5 Inter,"Helvetica Neue",Arial,sans-serif;padding:24px 16px}
main{max-width:860px;margin:0 auto}h1{margin:0;font-size:1.6rem}h2{color:var(--verde);font-size:.85rem;letter-spacing:.12em;text-transform:uppercase;border-bottom:1px solid var(--borda);padding-bottom:4px;margin-top:28px}
.m{color:var(--mudo)}li{margin:.35rem 0}b{color:var(--ouro)}.t{font-size:.85rem;color:var(--mudo);white-space:pre-wrap}img{max-width:100%;border-radius:8px;border:1px solid var(--borda)}
</style></head><body><main>
<p class="m">${esc(MARCA.nome)} · ata gerada pelo Jarvis Reunião</p><h1>Reunião ${d.dia.split('-').reverse().join('/')} · ${d.hora}</h1>
<p class="m">Participantes: ${esc(d.participantes.join(', ') || '—')} · duração ${d.duracao} · reunião transcrita com aviso no início</p>
${sec('Decisões', ul(d.decisoes, (x) => `${esc(x.texto)} <span class="m">(${esc(x.quem)}, ${x.hora})</span>`, 'Nenhuma decisão registrada.'))}
${sec('Pendências', ul(d.pendencias, (x) => `${esc(x.texto)} — dono: <b>${esc(x.dono || 'sem dono')}</b> · prazo: <b>${esc(x.prazo || 'sem prazo')}</b>`, 'Nenhuma pendência.'))}
${sec('Pedidos de mudança no app', ul(d.pedidos, (x) => `${x.definido ? '<b>DEFINIDO</b>' : 'sugestão'}: ${esc(x.texto)}${x.tela ? ` <span class="m">(${esc(x.tela)})</span>` : ''}${x.fila ? ` <span class="m">→ fila ${esc(x.fila)}</span>` : ''}`, 'Nenhum pedido.'))}
${sec('Permissões para dado restrito', ul(d.permissoes, (x) => `${x.hora} — ${esc(x.assunto)}: <b>${x.sim ? 'autorizado' : 'negado'}</b> por ${esc(x.quem)} <span class="m">(${esc(x.como)})</span>`, 'Nenhuma pedida.'))}
${fotos.length ? sec('Telas mostradas nos pedidos', fotos.map((p) => `<p class="m">${esc(p.texto)}</p><img alt="" src="${p.foto}">`).join('')) : ''}
${sec('Assuntos', `<p>${esc(d.assuntos.map((a) => `${a.nome} (${a.vezes}×)`).join(' · ') || '—')}</p>`)}
${d.dados.length ? sec('Dados mostrados', d.dados.map((x) => `<p><b>${esc(x.titulo)}</b> <span class="m">${x.hora || ''}</span><br>${esc(x.texto)}</p>`).join('')) : ''}
${sec('Transcrição' + (d.transcricaoComVoz ? ' <span class="m" style="text-transform:none;letter-spacing:0">— quem falou reconhecido pela voz</span>' : ''), `<div class="t">${transcricao().map((l) => `[${l.hora}] <b>${esc(l.quem)}</b>: ${esc(l.texto)}`).join('<br>')}</div>`)}
</main></body></html>`;
}
let ultimaAta = null;
async function encerrar() {
  if (!E || E.fim) return;
  E.fim = new Date().toISOString();
  Escuta.desligar(); pararTela(); atualizarMic();
  avisar('Fechando a ata: esperando o Mac terminar de transcrever as últimas falas…');
  await Gravador.parar();
  await Promise.all(Object.values(Sala.gravadores).map((g) => g.parar()));
  if (Sala.anfitriao) { const a = Sala.anfitriao; a.mandarTodos({ tipo: 'fim' }); setTimeout(() => a.fechar(), 1500); Sala.anfitriao = null; Sala.remotos = {}; }
  if (fluxoCamera) alternarCamera();
  // espera o Mac terminar os trechos que faltam (até 40 s)
  for (let i = 0; i < 20; i++) { const r = await balcao(`/api/vozes?reuniao=${encodeURIComponent(E.id)}&desde=${E.segN}`); if (!r || !r.pendentes) break; await new Promise((ok) => setTimeout(ok, 2000)); }
  await lerVozes(); avisar('');
  const d = dadosDaAta();
  ultimaAta = { d, html: ataHtml(d), texto: ataTexto(d) };
  await enviarTranscricao();
  const r = await balcao('/api/ata', { reuniao: E.id, html: ultimaAta.html, texto: ultimaAta.texto, dados: d });
  $('fimEstado').innerHTML = r && r.ok
    ? `Salva no Mac em <b>${esc(r.pasta)}</b>${r.nota ? ` e no segundo cérebro (${esc(r.nota.split('/').slice(-1)[0])}, linha no Diário)` : ''}.`
    : 'O balcão do Mac não respondeu: baixe a ata pelos botões abaixo.';
  $('ataQuadro').srcdoc = ultimaAta.html; $('fim').style.display = 'block';
  salvar();
  try { localStorage.setItem('oscarpes:reuniao:ultima', JSON.stringify({ id: E.id, texto: ultimaAta.texto })); localStorage.removeItem(CHAVE_ESTADO); } catch (e) { /* nada */ }
  Mascote.estado('comemorando');
  falar(`Reunião encerrada. ${d.decisoes.length} decisões, ${d.pendencias.length} pendências e ${d.pedidos.filter((p) => p.definido).length} pedidos para o app. A ata está na tela.`);
}
function baixar(nome, conteudo, tipo) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo })); a.download = nome; a.click(); }
async function enviarTranscricao() {
  if (!E || E.enviadas >= E.linhas.length) return;
  const novas = E.linhas.slice(E.enviadas);
  const r = await balcao('/api/transcricao', { reuniao: E.id, linhas: novas });
  if (r && r.ok) { E.enviadas += novas.length; salvar(); }
}
setInterval(enviarTranscricao, 20000);
// ATA EM RASCUNHO (07/out/2026: as reuniões de 06/out 16:55 e 07/out 10:00 acabaram com a página fechada, sem "encerrar", e
// ficaram sem ata). A cada 30 s — e ao fechar a página, por beacon — o balcão recebe a ata como ela seria agora; se a página
// sumir sem encerrar, o balcão fecha a ata com este rascunho depois de 10 min sem sinal (mesa-reuniao.js, ata automática).
function rascunhoDaAta() { const d = dadosDaAta(); return { reuniao: E.id, html: ataHtml(d), texto: ataTexto(d), dados: d }; }
setInterval(() => { if (E && !E.fim && !MODO_CONVIDADO && temBalcao && (E.linhas.length || E.segmentos.length)) balcao('/api/rascunho', rascunhoDaAta()); }, 30000);
addEventListener('pagehide', () => {
  if (!E || E.fim || MODO_CONVIDADO || !temBalcao || !(E.linhas.length || E.segmentos.length)) return;
  try { enviarTranscricao(); navigator.sendBeacon(BALCAO + '/api/rascunho', new Blob([JSON.stringify(rascunhoDaAta())], { type: 'text/plain' })); } catch (e) { /* o rascunho de 30 s já está lá */ }
});
// UM OSCAR SÓ: com a reunião aberta (e o balcão do Mac aqui), o ouvido do Mac fica calado — a sala é ouvida por esta página
setInterval(() => { if (E && !E.fim && !MODO_CONVIDADO && temBalcao) balcao('/api/silenciar-ouvido?tema=' + encodeURIComponent(TEMA_ID), {}); }, 8000);
setInterval(async () => { const r = await balcao('/api/fila'); if (r && r.itens) { filaRemota = r.itens; if (E) desenhar(); } }, 4000);
setInterval(() => { if (E && !E.fim) lerVozes(); }, 3000);
setInterval(() => { if (E && !E.fim) { const s = Math.floor((Date.now() - new Date(E.inicio)) / 1000); $('relogio').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; desenharFaixa(); } }, 1000);

// ---------------------------------------------------------------------------
// SALA DE LONGE — anfitrião (o Mac) e convidado (?entrar=<código>). WebRTC em sala.js; sinal pelo Supabase Realtime.
// ---------------------------------------------------------------------------
const Sala = { anfitriao: null, convidado: null, sinal: null, remotos: {}, gravadores: {}, audios: {}, mapa: {}, recebidos: new Map(), minha: null, euNome: '', ultimoPainel: 0 };
function linkDaReuniao() { return `${BASE_LINK}?entrar=${E.codigo}${TEMA_ID !== 'oscarpes' ? '&tema=' + TEMA_ID : ''}`; }
function abrirSala() {
  if (MODO_CONVIDADO || Sala.anfitriao || ANON.startsWith('__') || PARAMS.get('sala') === '0') return;
  E.codigo = E.codigo || novoCodigo(); salvar();
  Sala.sinal = criarSinal(E.codigo, ANON);
  Sala.anfitriao = criarAnfitriao({
    sinal: Sala.sinal,
    saida: { get audio() { const st = Mistura.stream; return st ? st.getAudioTracks()[0] : null; }, get audioStream() { return Mistura.stream; }, get camera() { return fluxoCamera; }, get vidro() { return !!(camadaSala && camadaSala.ligado); } },
    aoPedido: (p) => { desenhar(); Mascote.estado('ouvindo'); falar(`${p.nome.split(' ')[0]} está pedindo para entrar na reunião.`); },
    aoAbriu: () => { Sala.ultimoPainel = 0; ultimoPainelJson = ''; ultimaLegendaLonge = ''; enviarPainel(); },
    aoFaixa: (id, track, stream) => faixaDeConvidado(id, track, stream),
    aoSaiu: (id) => convidadoSaiu(id),
    aoDados: () => { guardarTecnico(); atualizarTelaRemota(); desenhar(); },
    aoEstado: () => desenhar(),
  });
  $('btnConvidar').hidden = false;
  desenhar();
}
// SOM DE QUEM ESTÁ LONGE (06/out: "vejo voz um, voz dois, mas não consigo ouvir ninguém"): o navegador pode bloquear o
// som sem um clique; se o play() for recusado, aparece "Ativar o som da reunião" e um clique libera todos
function tocarAudio(stream) {
  const a = Object.assign(document.createElement('audio'), { autoplay: true }); a.muted = MUDO; a.srcObject = stream; document.body.appendChild(a);
  const p = a.play(); if (p && p.catch) p.catch(() => { $('btnSom').hidden = false; });
  return a;
}
function ativarSom() {
  for (const a of Object.values(Sala.audios)) { try { a.play(); } catch (e) { /* nada */ } }
  Mistura.retomar && Mistura.retomar(); $('btnSom').hidden = true;
}
function nomeDoConvidado(id) { return (Sala.anfitriao.convidados.find((c) => c.id === id) || {}).nome || 'Convidado'; }
function faixaDeConvidado(id, track, stream) {
  const nome = nomeDoConvidado(id);
  if (track.kind === 'audio') {
    // ouve na sala (alto-falante da TV) e grava para a ata com o NOME de quem entrou — sem adivinhar pela voz
    if (!Sala.audios[stream.id]) Sala.audios[stream.id] = tocarAudio(stream);
    if (!Sala.gravadores[stream.id] && !SEM_GRAVAR_LONGE && temBalcao) { const g = criarGravador({ obterStream: async () => new MediaStream([track]), quem: nome, pararFaixas: false }); Sala.gravadores[stream.id] = g; g.ligar(); }
  }
  setTimeout(() => { atualizarTelaRemota(); desenhar(); }, 400);
}
const SEM_GRAVAR_LONGE = PARAMS.get('gravarLonge') === '0';
function atualizarTelaRemota() {
  // tela compartilhada por quem está longe: aparece no cartão "Tela compartilhada" (e a foto vai com o pedido do app)
  if (fluxoTela && !fluxoTela.remota) return;
  let achou = null;
  for (const c of Sala.anfitriao ? Sala.anfitriao.convidados : []) for (const st of c.streams) if (st.tipo === 'tela' && c.telaAtiva && st.stream.getVideoTracks().some((t) => t.readyState === 'live')) achou = { st: st.stream, nome: c.nome };
  if (achou && fluxoTela !== achou.st) { fluxoTela = achou.st; fluxoTela.remota = true; $('video').srcObject = fluxoTela; $('cardTela').hidden = false; }
  else if (!achou && fluxoTela && fluxoTela.remota) { fluxoTela = null; $('video').srcObject = null; $('cardTela').hidden = true; }
}
// 07/out: como saiu o fundo de vidro de cada um (para a próxima falha não ficar no escuro) — vai na ata
function guardarTecnico() {
  if (!E || !Sala.anfitriao) return;
  E.tecnico = E.tecnico || {};
  for (const c of Sala.anfitriao.convidados) if (c.vidroInfo) E.tecnico[c.nome] = { ...(E.tecnico[c.nome] || {}), ...c.vidroInfo };
}
// CONEXÃO DE CADA UM (07/out: as câmeras travaram e nada ficou registrado) — a cada 15 s; a ata guarda o pior momento
setInterval(async () => {
  if (!E || E.fim || MODO_CONVIDADO || !Sala.anfitriao || !Sala.anfitriao.convidados.length) return;
  const m = await Sala.anfitriao.medir(); E.conexao = E.conexao || {};
  for (const [nome, v] of Object.entries(m)) {
    const a = E.conexao[nome] || { fpsMin: 99, travadas: 0, perdidos: 0, quedas: 0, reinicios: 0, rttMax: 0 };
    E.conexao[nome] = { estado: v.estado, fpsMin: v.fps ? Math.min(a.fpsMin, v.fps) : a.fpsMin, travadas: Math.max(a.travadas, v.travadas), perdidos: Math.max(a.perdidos, v.perdidos), quedas: v.quedas, reinicios: v.reinicios, rttMax: Math.max(a.rttMax, v.rttMs || 0) };
  }
  salvar();
}, 15000);
function convidadoSaiu(id) {
  for (const [nome, rid] of Object.entries(Sala.remotos)) if (rid === id) delete Sala.remotos[nome];
  atualizarTelaRemota(); desenhar();
}
/** "Admitir a Tainá" / "Oscar, deixa o Emiliano entrar" / "pode entrar" — devolve true se era pedido de admitir (e admitiu) */
function admitirPelaVoz(frase) {
  if (MODO_CONVIDADO || !Sala.anfitriao || !Sala.anfitriao.pedidos.length) return false;
  const ids = pedidoDeAdmitir(frase, Sala.anfitriao.pedidos);
  if (!ids.length) return false;
  const nomes = ids.map((id) => (Sala.anfitriao.pedidos.find((x) => x.id === id) || {}).nome).filter(Boolean);
  for (const id of ids) admitirConvidado(id, false);
  falar(nomes.length ? `${nomes.map((n) => n.split(' ')[0]).join(' e ')} ${nomes.length > 1 ? 'entraram' : 'entrou'} na reunião.` : 'Pronto.');
  return true;
}
function admitirConvidado(id, comoSocio) {
  const p = Sala.anfitriao.pedidos.find((x) => x.id === id); if (!p) return;
  let nome = p.nome; while (E.participantes.includes(nome) && Sala.remotos[nome] !== id) nome += ' (longe)';
  Sala.anfitriao.admitir(id, { nome });
  Sala.remotos[nome] = id;
  if (!E.participantes.includes(nome)) E.participantes.push(nome);
  // o nível de acesso de quem chega de longe começa RESTRITO; "admitir como sócio" é o anfitrião quem decide.
  // 07/out: Tainá e Emiliano entraram COM A CONTA do app e são admin no app, mas ficaram "restritos" — o Oscar disse que
  // eles não tinham acesso ao financeiro. Quem entra com a conta ganha o papel do app (pelo nome do perfil, lido em
  // whatsapp_autorizados com o login do anfitrião); quem entra só com um nome digitado continua restrito.
  definirAcessos({ [nome]: comoSocio ? { nivel: 'admin', papel: 'admin (o anfitrião confirmou)' } : { nivel: 'restrito', papel: p.conta ? 'conta do app' : 'convidado' } });
  if (!comoSocio && p.conta) papelDoApp(p.nome).then((v) => { if (v && E && E.acesso[nome] && E.acesso[nome].nivel !== 'admin') definirAcessos({ [nome]: v }); });
  E.permissoes.push({ assunto: 'entrada na reunião', chave: 'entrada', quem: emailDaSessao() || 'anfitrião', como: `${nome}${p.email ? ' <' + p.email + '>' : ''} admitido${comoSocio ? ' como sócio' : ''}`, hora: hora(), sim: true });
  salvar(); desenhar();
}
/** o nível de acesso de um nome pelo cadastro do app (só o admin logado consegue ler a lista) */
async function papelDoApp(nomeDoPerfil) {
  const t = await token();
  if (!t || ANON.startsWith('__')) return null;
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/whatsapp_autorizados?select=nome,papel,ativo&ativo=eq.true', { headers: { apikey: ANON, authorization: 'Bearer ' + t } });
    if (!r.ok) return null;
    const v = nivelDe(nomeDoPerfil, await r.json());
    return v.papel === 'não cadastrado' || v.papel === 'ambíguo' ? null : v;
  } catch (e) { return null; }
}
/** o painel para quem está longe (pelo canal de dados, só para admitidos): sem transcrição e sem fotos pesadas */
function painelParaLonge() {
  // 07/out: os cartões com MAPA (imagem em base64, 100 KB+) iam inteiros no painel a cada redesenho — pelo mesmo cano do
  // vídeo, no 4G de quem estava longe. Agora o cartão grande vai sem as telas (o texto vai) e o painel só sai quando muda.
  const leve = (x) => { const j = JSON.stringify(x); return j.length > 40000 ? { ...x, telas: [] } : x; };
  return {
    id: E.id, inicio: E.inicio, participantes: E.participantes, acesso: E.acesso, quemFala: E.quemFala, quemFalaEm: E.quemFalaEm,
    assuntos: E.assuntos, decisoes: E.decisoes, pendencias: E.pendencias, pedidos: E.pedidos.map(({ foto, ...r }) => r),
    dados: E.dados.map(leve), auto: Object.fromEntries(Object.entries(E.auto).map(([k, v]) => [k, leve(v)])), esperas: E.esperas.map(({ titulo, assunto, auto, em, hora: h }) => ({ titulo, assunto, auto, em, hora: h })),
    claude: false, marca: MARCA, soUmaNaSala: soUmaNaSala(),
  };
}
let ultimoPainelJson = '', ultimaLegendaLonge = '', painelAgendado = null;
function enviarPainel() {
  if (!Sala.anfitriao) return;
  // a legenda muda a cada frase: vai sozinha (pequena); o painel inteiro só quando mudou, no máximo 1 a cada 2 s
  const leg = $('legenda').innerHTML;
  if (leg !== ultimaLegendaLonge) { ultimaLegendaLonge = leg; Sala.anfitriao.legenda(leg); }
  if (Date.now() - Sala.ultimoPainel < 2000) { if (!painelAgendado) painelAgendado = setTimeout(() => { painelAgendado = null; enviarPainel(); }, 2100); return; }
  const p = painelParaLonge(); const j = JSON.stringify(p);
  if (j === ultimoPainelJson) return;
  ultimoPainelJson = j; Sala.ultimoPainel = Date.now();
  Sala.anfitriao.painel(p);
}
function desenharSala() {
  const el = $('salaEspera'); if (!el) return;
  if (MODO_CONVIDADO || !Sala.anfitriao) { el.innerHTML = ''; return; }
  const ped = Sala.anfitriao.pedidos, conv = Sala.anfitriao.convidados;
  el.innerHTML = (ped.length ? ped.map((p) => `<div class="espera"><b>${esc(p.nome)}</b> quer entrar<span class="meta">${p.conta ? 'com a conta ' + esc(p.email) : 'convidado sem conta'} — o nome é o que a pessoa digitou</span><button class="mini" data-admitir="${esc(p.id)}">admitir</button><button class="mini" data-admitir-socio="${esc(p.id)}">admitir como sócio</button><button class="mini" data-recusar="${esc(p.id)}">recusar</button></div>`).join('') : '')
    + (conv.length ? `<div class="sub" style="font-size:.72rem;color:var(--mudo);text-align:center">De longe: ${conv.map((c) => `${esc(c.nome)} (${esc({ connected: 'conectado', connecting: 'conectando…', new: 'conectando…', disconnected: 'caiu, reconectando', failed: 'caiu' }[c.estado] || c.estado)})`).join(', ')}</div>` : '');
}

// CONVITE: link + código; escolher gente do app; o zap abre com a mensagem pronta e só sai quando o João aperta enviar lá
async function abrirConvite() {
  $('convite').style.display = 'flex';
  $('conviteLink').value = linkDaReuniao(); $('conviteCodigo').textContent = E.codigo;
  const t = await token();
  let lista = [];
  if (t && !ANON.startsWith('__')) { try { const r = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_autorizados?select=nome,papel,telefone&ativo=eq.true&order=nome`, { headers: { apikey: ANON, authorization: 'Bearer ' + t } }); if (r.ok) lista = (await r.json()).filter((u) => u.nome && u.telefone); } catch (e) { /* sem rede */ } }
  $('convitePessoas').innerHTML = lista.length ? lista.map((u, i) => `<label><input type="checkbox" data-convidar="${i}" data-tel="${esc(u.telefone)}" data-nome="${esc(u.nome)}"> ${esc(u.nome)} <small>${esc(u.papel)}</small></label>`).join('') : '<span class="vazio">Entre como admin para escolher gente do app (ou copie o link).</span>';
  $('conviteZap').innerHTML = '';
}
function mensagemDoConvite(nome) { return `Olá${nome ? ' ' + nome.split(' ')[0] : ''}! ${euNome || 'O João'} está te chamando para a reunião ${MARCA.nome} agora: ${linkDaReuniao()} (código ${E.codigo}). Entre com a sua conta do app; sem conta, dá para entrar como convidado.`; }
function prepararConvites() {
  const sel = [...RAIZ.querySelectorAll('[data-convidar]:checked')];
  $('conviteZap').innerHTML = sel.length ? '<p class="sub">Clique em cada um: o zap abre com a mensagem pronta e só envia quando você apertar enviar lá.</p>' + sel.map((c) => `<a class="zap" target="_blank" rel="noopener" href="https://wa.me/${encodeURIComponent(String(c.dataset.tel).replace(/\D/g, ''))}?text=${encodeURIComponent(mensagemDoConvite(c.dataset.nome))}">Abrir no zap: ${esc(c.dataset.nome)}</a>`).join('') : '<p class="sub">Marque quem convidar.</p>';
}

// ---- MODO CONVIDADO: a PORTA (06/out) — 1) quem é  2) confere câmera e microfone (com o fundo de vidro)  3) sala de espera ----
let identidade = null;     // { nome, email, conta }
async function entrarComoConvidado(comConta) {
  const nomeDigitado = $('eNome').value.trim();
  let nome = nomeDigitado, email = '';
  if (comConta) {
    email = emailDaSessao();
    try { const t = await token(); const uid = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || '{}').user?.id; const r = await fetch(`${SUPABASE_URL}/rest/v1/perfis?select=nome&id=eq.${uid}`, { headers: { apikey: ANON, authorization: 'Bearer ' + t } }); const d = r.ok ? await r.json() : []; nome = (d[0] && d[0].nome) || nome || email.split('@')[0]; } catch (e) { nome = nome || email.split('@')[0]; }
  }
  if (!nome) { $('eAviso').textContent = 'Diga o seu nome.'; return; }
  Sala.euNome = nome.split(' ').slice(0, 2).join(' ');
  identidade = { nome: Sala.euNome, email, conta: comConta };
  $('eAviso').textContent = 'Ligando câmera e microfone…';
  let bruta = null;
  try { bruta = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: { width: 640, height: 360 } }); }
  catch (e) { try { bruta = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); } catch (e2) { bruta = null; } }
  // a câmera vai com o fundo de vidro (recorte feito AQUI, no aparelho de quem entra); o microfone segue igual
  Sala.minhaCamada = bruta && bruta.getVideoTracks().length ? camadaDeVidro(bruta, { ligado: vidroQuer, aoMudar: () => { atualizarBotaoVidro(); desenharTeste(); if (E) desenhar(); } }) : null;
  Sala.minha = Sala.minhaCamada ? Sala.minhaCamada.stream : bruta;
  medirMicrofone(bruta);
  $('ePasso1').hidden = true; $('ePasso2').hidden = false;
  $('eNomeTeste').textContent = Sala.euNome + (comConta ? ' · conta do app' : ' · convidado');
  $('eIni').textContent = iniciais(Sala.euNome);
  $('eAviso').textContent = bruta ? '' : 'Sem câmera e sem microfone: dá para entrar só assistindo.';
  atualizarBotaoVidro(); desenharTeste();
}
/** a prévia da própria câmera na porta (com o vidro, se ligado) */
function desenharTeste() {
  const caixa = $('eVideoCaixa'); if (!caixa) return;
  const vidro = !!(Sala.minhaCamada && Sala.minhaCamada.ligado);
  caixa.classList.toggle('vidro', vidro);
  for (const el of [...caixa.querySelectorAll('video,canvas')]) el.remove();
  const temVideo = Sala.minha && Sala.minha.getVideoTracks().some((t) => t.enabled);
  $('eIni').hidden = !!temVideo;
  if (temVideo) caixa.prepend(imagemDe(Sala.minha, vidro, true));
}
let medidor = null;
function medirMicrofone(st) {
  if (!st || !st.getAudioTracks().length || medidor) return;
  try {
    const ctx = new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(new MediaStream(st.getAudioTracks())).connect(an);
    const buf = new Float32Array(an.fftSize);
    medidor = setInterval(() => { if ($('ePasso2').hidden) { clearInterval(medidor); try { ctx.close(); } catch (e) { /* nada */ } return; } an.getFloatTimeDomainData(buf); let q = 0; for (const v of buf) q += v * v; $('eNivel').style.width = Math.min(100, Math.sqrt(q / buf.length) * 900) + '%'; }, 80);
  } catch (e) { /* sem medidor */ }
}
function pedirParaEntrar() {
  if (!identidade || Sala.convidado) return;
  $('ePedir').disabled = true;
  $('eAviso').textContent = 'Esperando o anfitrião deixar você entrar…';
  Sala.sinal = criarSinal(CODIGO_ENTRAR, ANON);
  Sala.convidado = criarConvidado({
    sinal: Sala.sinal, eu: { id: novoId(), nome: identidade.nome, email: identidade.email, conta: identidade.conta }, midia: Sala.minha,
    aoAdmitido: (d) => { if (d.nome) Sala.euNome = d.nome; $('entrada').style.display = 'none'; $('lgpd').hidden = false; desenhar(); },
    aoRecusado: () => { $('eAviso').textContent = 'O anfitrião não liberou a entrada.'; },
    aoFaixa: (track, stream) => {
      if (!stream) return;
      Sala.recebidos.set(stream.id, stream);
      if (track.kind === 'audio' && !Sala.audios[stream.id]) Sala.audios[stream.id] = tocarAudio(stream);
      setTimeout(desenharConvidado, 300);
    },
    aoDados: (m) => {
      if (m.tipo === 'painel') { E = { ...novoEstado([]), ...m.estado, segmentos: [], linhas: [], permissoes: [] }; if (m.estado.legenda) $('legenda').innerHTML = m.estado.legenda; desenharConvidado(); }
      if (m.tipo === 'legenda' && typeof m.html === 'string') $('legenda').innerHTML = m.html;
      if (m.tipo === 'faixas') { Sala.mapa = m.mapa || {}; desenharConvidado(); }
      if (m.tipo === 'fim') { $('aviso').textContent = 'A reunião foi encerrada pelo anfitrião.'; $('aviso').style.display = 'block'; }
    },
  });
  Sala.convidado.definirVidro(!!(Sala.minhaCamada && Sala.minhaCamada.ligado), infoDoVidro());
}
function desenharConvidado() {
  if (!E) E = novoEstado([]);
  desenhar();
  // tela compartilhada por alguém (inclusive pela sala)
  const tela = Object.entries(Sala.mapa).find(([sid, i]) => i.tipo === 'tela' && i.ativa !== false && Sala.recebidos.get(sid) && Sala.recebidos.get(sid).getVideoTracks().some((t) => !t.muted));
  if (tela && $('video').srcObject !== Sala.recebidos.get(tela[0])) { $('video').srcObject = Sala.recebidos.get(tela[0]); $('cardTela').hidden = false; }
  if (!tela && !Sala.minhaTela) $('cardTela').hidden = true;
}
async function convidadoTela() {
  if (!Sala.convidado) return;
  if (Sala.minhaTela) { Sala.minhaTela.getTracks().forEach((t) => t.stop()); Sala.minhaTela = null; await Sala.convidado.compartilharTela(null); $('btnTela').textContent = 'Compartilhar tela'; $('btnTela').classList.remove('ligado'); $('cardTela').hidden = true; return; }
  try { Sala.minhaTela = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); } catch (e) { return; }
  Sala.minhaTela.getVideoTracks()[0].addEventListener('ended', () => { if (Sala.minhaTela) convidadoTela(); });
  await Sala.convidado.compartilharTela(Sala.minhaTela);
  $('video').srcObject = Sala.minhaTela; $('cardTela').hidden = false; $('btnTela').textContent = 'Parar de compartilhar'; $('btnTela').classList.add('ligado');
}
async function prepararEntrada() {
  $('sala').classList.add('remoto');
  $('abertura').style.display = 'none'; $('entrada').style.display = 'flex';
  for (const id of ['btnClaude', 'btnEncerrar', 'btnConvidar', 'btnConta']) $(id).hidden = true;
  $('btnSair').hidden = false;
  $('sub').textContent = 'Você está na reunião de longe — o painel é o do anfitrião';
  const t = await token();
  if (t) { $('eEntrarConta').textContent = 'Entrar como ' + emailDaSessao(); $('eEntrarConta').hidden = false; $('eLogin').hidden = true; }
}

// ---------------------------------------------------------------------------
// MARCA (tema) e LIGAR
// ---------------------------------------------------------------------------
/** A marca é a do tema que o Jarvis abriu (window.TEMA): nome, como chamar, logo, mascote e persona (marcas.js). */
function carregarMarca() {
  const T = window.TEMA || {};
  MARCA_REUNIAO = marcaDaReuniao(TEMA_ID);
  const logo = (T.marca && T.marca.imagem) || (T.abertura && T.abertura.imagem) || 'folha.png';
  MARCA = { nome: T.nome || 'Oscarpes', dizer: (T.chamada && T.chamada.dizer) || 'Oscar', logo };
  definirNomesExtra((T.chamada && T.chamada.extras) || []);
  $('titulo').textContent = `${MARCA.nome} · Reunião`; $('aberturaTitulo').textContent = `Reunião com o ${MARCA.dizer}`;
  RAIZ.querySelectorAll('#folha,#aberturaLogo,.logoMarca').forEach((i) => { i.src = MARCA.logo; });
  $('sub').textContent = `Painel ao vivo — diga “${MARCA.dizer}, …” para pedir algo`;
}
async function comecar(retomada, opcoes = {}) {
  $('abertura').style.display = 'none'; $('lgpd').hidden = false;
  if (PONTE) PONTE.assumir();          // o ouvido e a voz do Jarvis param: quem ouve a sala agora é a reunião
  mudarClaude(E.claude); Mascote.montar(); await Mistura.ligar();
  if (!Escuta.ligar()) avisar('Este navegador não tem reconhecimento de voz (use o Chrome no Mac). Dá para escrever as falas na caixa embaixo.');
  atualizarMic(); desenhar();
  balcao('/api/saude?vozes=1');                     // liga o motor de vozes já (carrega em ~15 s)
  // sem o balcão do Mac (outro computador) não há quem transcreva: não grava
  if (!SEM_GRAVAR && temBalcao) Gravador.ligar().then((ok) => { if (!ok) avisar('Sem gravação da sala: o nome de quem fala não vai ser reconhecido.'); });
  carregarAcessos(); atualizarCadastradas();
  abrirSala();
  // pedida por voz com gente de longe: a câmera da sala já liga (com o fundo de vidro) e os convites ficam prontos
  const convidar = opcoes.convidar || [];
  if (convidar.length && !fluxoCamera && !PARAMS.has('semCamera')) alternarCamera();
  if (convidar.length) await prepararConvitesPorVoz(convidar);
  if (!retomada) {
    const aviso = 'Aviso a todos: esta reunião está sendo transcrita para a ata. Eu só falo quando me chamarem pelo nome.';
    falar(convidar.length ? `Reunião aberta. ${fraseDosConvites()} ${aviso}` : aviso);
  }
}
// ABERTURA (João, 06/out: "login primeiro, como todo app de reunião"): 1) entrar com a conta do app; 2) "Nova reunião"
// com quem está na sala — gente do app (nome + papel → nível de acesso) ou escrita à mão (convidado, sem acesso a dado
// restrito). Quem entra logado é o primeiro participante. ?semLogin=1 só para o ensaio headless.
// PRÓXIMO (vídeo remoto): "Nova reunião" ganha link + código; "Convidar" escolhe gente do app e manda o convite pelo zap
// só depois do clique de confirmação; quem abre o link entra com a PRÓPRIA conta e isso dá nome, papel e acesso.
let usuariosDoApp = [], euNome = '', euPapel = '';
const SEM_LOGIN = PARAMS.has('semLogin');
async function prepararAbertura() {
  const t = SEM_LOGIN ? null : await token();
  if (!t && !SEM_LOGIN) { $('passoLogin').hidden = false; $('passoNova').hidden = true; $('btnComecar').hidden = true; return; }
  $('passoLogin').hidden = true; $('passoNova').hidden = false; $('btnComecar').hidden = false;
  const marcados = new Set();
  if (t && !ANON.startsWith('__')) {
    const h = { apikey: ANON, authorization: 'Bearer ' + t };
    try {
      const uid = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || '{}').user?.id;
      const eu = uid ? await (await fetch(`${SUPABASE_URL}/rest/v1/perfis?select=nome,papel&id=eq.${uid}`, { headers: h })).json() : [];
      euNome = (eu[0] && eu[0].nome || emailDaSessao().split('@')[0]).split(' ')[0]; euPapel = eu[0] && eu[0].papel || '';
      // a lista de quem usa o app (só admin consegue ler — regra do banco); com papel, para o nível de acesso
      const r = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_autorizados?select=nome,papel&ativo=eq.true&order=nome`, { headers: h });
      usuariosDoApp = r.ok ? (await r.json()).filter((u) => u.nome) : [];
    } catch (e) { /* sem rede: segue só com o nome escrito */ }
    $('aConectado').textContent = `Conectado como ${emailDaSessao()}${euPapel ? ' (' + euPapel + ')' : ''}.`;
    if (euNome) marcados.add(euNome);
  }
  desenharPessoas(marcados);
}
let pessoasExtra = [];
function desenharPessoas(marcados) {
  const todos = [...new Map([...(euNome ? [{ nome: euNome, papel: euPapel || 'admin' }] : []), ...usuariosDoApp.map((u) => ({ nome: u.nome.split(' ')[0] === u.nome ? u.nome : u.nome, papel: u.papel })), ...pessoasExtra.map((n) => ({ nome: n, papel: 'convidado' }))].map((u) => [u.nome, u])).values()];
  $('aPessoas').innerHTML = todos.map((u) => `<label class="${marcados.has(u.nome) ? 'marcado' : ''}"><input type="checkbox" data-pessoa-sala="${esc(u.nome)}" data-papel="${esc(u.papel)}" ${marcados.has(u.nome) ? 'checked' : ''} hidden>${esc(u.nome)} <small>${esc(u.papel)}</small></label>`).join('') || '<span class="vazio">Adicione abaixo quem está na sala.</span>';
}
$('aPessoas').addEventListener('change', (e) => { const l = e.target.closest('label'); if (l) l.classList.toggle('marcado', e.target.checked); });
$('btnAAdd').onclick = () => {
  const marcados = new Set([...RAIZ.querySelectorAll('[data-pessoa-sala]:checked')].map((c) => c.dataset.pessoaSala));
  for (const n of $('participantes').value.split(',').map((x) => x.trim()).filter(Boolean)) { pessoasExtra.push(n); marcados.add(n); }
  $('participantes').value = ''; desenharPessoas(marcados);
};
$('participantes').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnAAdd').click(); });
async function entrarNaAbertura() {
  if (ANON.startsWith('__')) { $('aLoginAviso').textContent = 'Login indisponível nesta cópia (sem a chave pública).'; return; }
  $('aLoginAviso').textContent = 'Entrando…';
  const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email: $('aEmail').value.trim(), password: $('aSenha').value }) }).catch(() => null);
  if (!r || !r.ok) { $('aLoginAviso').textContent = 'E-mail ou senha não conferem.'; return; }
  const ses = await r.json();
  if (!ses.expires_at && ses.expires_in) ses.expires_at = Math.floor(Date.now() / 1000) + Number(ses.expires_in);
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(ses));
  $('aSenha').value = ''; $('aLoginAviso').textContent = '';
  atualizarConta(); prepararAbertura();
}
$('btnAEntrar').onclick = () => entrarNaAbertura();
$('aSenha').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrarNaAbertura(); });
$('btnComecar').onclick = () => {
  if ($('participantes').value.trim()) $('btnAAdd').click();
  const marc = [...RAIZ.querySelectorAll('[data-pessoa-sala]:checked')];
  const ps = marc.map((c) => c.dataset.pessoaSala);
  if (!ps.length) { $('aberturaAviso').textContent = 'Marque ou adicione quem está na sala.'; return; }
  E = novoEstado(ps); salvar();
  // convidado escrito à mão: sem acesso a dado restrito (o papel do app dos outros vem de carregarAcessos)
  definirAcessos(Object.fromEntries(marc.map((c) => [c.dataset.pessoaSala, c.dataset.papel === 'admin' ? { nivel: 'admin', papel: 'admin' } : { nivel: 'restrito', papel: c.dataset.papel }])));
  comecar(false);
};
$('btnMic').onclick = () => { if (Escuta.ligado) Escuta.pausar(); else if (!Escuta.ligar()) avisar('Sem reconhecimento de voz neste navegador.'); else Escuta.retomar(); atualizarMic(); };
$('btnEncerrar').onclick = () => encerrar();
$('btnTela').onclick = () => compartilharTela();
$('btnCamera').onclick = () => alternarCamera();
$('btnClaude').onclick = () => mudarClaude(!E.claude);
$('btnMandar').onclick = () => { const v = $('caixa').value; $('caixa').value = ''; ouvir(v); };
$('caixa').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnMandar').click(); });
$('btnEntrar').onclick = () => entrar();
$('senha').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
$('btnConta').onclick = () => {
  if ($('btnConta').dataset.logado) { if (confirm('Sair da conta neste navegador?')) { try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* nada */ } atualizarConta(); if (E) { E.operadorAdmin = false; desenhar(); } } return; }
  const l = $('login'); l.style.display = l.style.display === 'flex' ? 'none' : 'flex'; if (l.style.display === 'flex') $('email').focus();
};
atualizarConta();
$('btnBaixarHtml').onclick = () => ultimaAta && baixar(`ata-${ultimaAta.d.reuniao}.html`, ultimaAta.html, 'text/html');
$('btnBaixarTxt').onclick = () => ultimaAta && baixar(`ata-${ultimaAta.d.reuniao}.txt`, ultimaAta.texto, 'text/plain');
$('btnVoltar').onclick = () => { $('fim').style.display = 'none'; };
$('btnConvidar').onclick = () => abrirConvite();
$('btnPainel').onclick = () => ($('gaveta').classList.contains('aberta') ? fecharGaveta() : abrirGaveta('decisoes'));
$('btnGavetaFechar').onclick = () => fecharGaveta();
$('btnSom').onclick = () => ativarSom();
RAIZ.addEventListener('click', (e) => {
  const r = e.target.closest('[data-abrir]'); if (r) abrirGaveta(r.dataset.abrir);
  const f = e.target.closest('[data-fechar]'); if (f && E) { const c = [...E.dados, ...Object.values(E.auto)].find((x) => x.chave === f.dataset.fechar); if (c) { c.fechado = true; salvar(); desenhar(); } }
  const re = e.target.closest('[data-reabrir]'); if (re && E) { const c = [...E.dados, ...Object.values(E.auto)].find((x) => x.chave === re.dataset.reabrir); if (c) { c.fechado = false; c.abertoEm = Date.now(); salvar(); desenhar(); } }
});
$('btnConviteFechar').onclick = () => { $('convite').style.display = 'none'; };
$('btnConvitePreparar').onclick = () => prepararConvites();
$('btnConviteCopiar').onclick = async () => { try { await navigator.clipboard.writeText(mensagemDoConvite('')); $('btnConviteCopiar').textContent = 'copiado'; } catch (e) { $('conviteLink').select(); } };
$('btnApagarVozes').onclick = async () => { if (!confirm('Apagar todas as vozes guardadas neste Mac?')) return; await balcao('/api/vozes/apagar', { org: ORG }); atualizarCadastradas(); };
RAIZ.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !E) return;
  if (b.dataset.oferta !== undefined) { const o = (E.ofertas || [])[Number(b.dataset.oferta)]; if (o) { E.ofertas = E.ofertas.filter((x) => x !== o); desenharOfertas(); puxarCartao(o.frase.slice(0, 60), o.frase, true); } }
  if (b.dataset.admitir) admitirConvidado(b.dataset.admitir, false);
  if (b.dataset.admitirSocio) admitirConvidado(b.dataset.admitirSocio, true);
  if (b.dataset.recusar && Sala.anfitriao) { Sala.anfitriao.recusar(b.dataset.recusar); desenhar(); }
  if (b.dataset.definir !== undefined) { const p = E.pedidos[Number(b.dataset.definir)]; if (p) { p.definido = true; p.novo = true; E.decisoes.push({ texto: p.texto, quem: p.quem, hora: hora(), t: Date.now(), novo: true }); mandarParaFila(p); salvar(); desenhar(); } }
  if (b.dataset.tirarPend !== undefined) { E.pendencias.splice(Number(b.dataset.tirarPend), 1); salvar(); desenhar(); }
  if (b.dataset.descartar) { balcao('/api/fila/marcar', { id: b.dataset.descartar, status: 'descartado' }); }
  if (b.dataset.permitir !== undefined && E.operadorAdmin) { const w = E.esperas[Number(b.dataset.permitir)]; if (w) conceder(w, emailDaSessao() || 'admin logado', 'clique do admin logado'); }
  if (b.dataset.negar !== undefined) { const w = E.esperas[Number(b.dataset.negar)]; if (w) negar(w, quemAgora(), 'clique'); }
  if (b.dataset.voz !== undefined) {
    let nome = b.dataset.nome;
    if (!nome) nome = (prompt('Nome desta pessoa:') || '').trim();
    if (!nome) return;
    const cx = RAIZ.querySelector(`input[data-guardar="${CSS.escape(b.dataset.voz)}"]`);
    nomearVoz(b.dataset.voz, nome, cx ? cx.checked : true);
  }
});
// ---------------------------------------------------------------------------
// CONVITES PEDIDOS POR VOZ ("Oscar, chama o Ararê e a Tainá para uma reunião"): o convite fica PRONTO na tela; o zap
// só abre com o "pode mandar" (ou o clique) do João — e quem envia é ele, no próprio zap (wa.me com a mensagem pronta).
// O navegador só abre uma janela nova com um clique: pela voz, o 1º abre e os outros ficam piscando para um clique.
// ---------------------------------------------------------------------------
let pessoasDoApp = null;
async function lerPessoasDoApp() {
  if (pessoasDoApp && pessoasDoApp.length) return pessoasDoApp;
  if (Array.isArray(window.REUNIAO_PESSOAS_FALSAS)) return (pessoasDoApp = window.REUNIAO_PESSOAS_FALSAS);   // ensaio sem banco
  const t = await token();
  if (!t || ANON.startsWith('__')) return [];
  // a lista do zap (só admin lê) e, junto, os perfis do app que a regra do banco deixar ler — quem tem telefone primeiro
  const h = { apikey: ANON, authorization: 'Bearer ' + t };
  const ler = async (u) => { try { const r = await fetch(u, { headers: h }); return r.ok ? await r.json() : []; } catch (e) { return []; } };
  const [zap, perfis] = await Promise.all([
    ler(`${SUPABASE_URL}/rest/v1/whatsapp_autorizados?select=nome,papel,telefone&ativo=eq.true&order=nome`),
    ler(`${SUPABASE_URL}/rest/v1/perfis?select=nome,papel,telefone&nome=not.is.null`),
  ]);
  const lista = [...zap, ...perfis].filter((u) => u && u.nome);
  const vistos = new Map();
  for (const u of lista) { const k = norm(u.nome); const ja = vistos.get(k); if (!ja || (!ja.telefone && u.telefone)) vistos.set(k, u); }
  pessoasDoApp = [...vistos.values()];
  return pessoasDoApp;
}
async function prepararConvitesPorVoz(nomes) {
  if (!E || !nomes.length) return;
  E.codigo = E.codigo || novoCodigo();
  const lista = await lerPessoasDoApp();
  // sem login não dá para achar telefone (a lista do app só abre com a conta): o convite diz isso, e refaz ao entrar
  E.convitesSemLogin = !lista.length && !(await token());
  if (E.convitesSemLogin) E.mostrarLink = true;
  E.convites = E.convites || [];
  for (const dito of nomes) {
    if (E.convites.some((c) => norm(c.dito) === norm(dito) || norm(c.nome) === norm(dito) || norm(c.nome).split(' ')[0] === norm(dito).split(' ')[0])) continue;   // o mesmo, dito de outro jeito
    const n = norm(dito);
    const achados = lista.filter((u) => { const un = norm(u.nome); return un === n || un.split(' ')[0] === n || un.startsWith(n + ' '); });
    const comTel = achados.filter((x) => x.telefone);
    const u = achados.length === 1 ? achados[0] : comTel.length === 1 ? comTel[0] : null;
    E.convites.push({ dito, nome: u ? u.nome : dito, tel: u && u.telefone ? String(u.telefone).replace(/\D/g, '') : '', ambiguo: achados.length > 1, aberto: false });
  }
  E.convitesPendentes = Date.now();
  salvar(); desenharConvites();
}
function fraseDosConvites() {
  const c = (E && E.convites) || []; if (!c.length) return '';
  const nomes = c.map((x) => x.nome.split(' ')[0]); const j = nomes.length < 2 ? nomes[0] : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
  const sem = c.filter((x) => !x.tel).map((x) => x.dito);
  if (E.convitesSemLogin) return 'Para eu achar o telefone deles, entre com a sua conta do app no botão do topo. O link da reunião já está na tela.';
  return `O convite ${c.length > 1 ? 'de' : 'do'} ${j} está pronto: diga “pode mandar” ou clique no nome.${sem.length ? ` Não achei o telefone de ${sem.join(' e ')}: copie o link.` : ''}`;
}
// (window.open com 'noopener' sempre devolve null — não daria para saber se o navegador bloqueou)
function abrirSemOpener(url) { const w = window.open(url, '_blank'); if (w) { try { w.opener = null; } catch (e) { /* nada */ } } return w; }
function linkZap(c) { return `https://wa.me/${encodeURIComponent(c.tel)}?text=${encodeURIComponent(mensagemDoConvite(c.nome))}`; }
function desenharConvites() {
  const el = $('cardConvites'); if (!el || !E) return;
  const c = E.convites || [];
  if ((!c.length && !E.mostrarLink) || MODO_CONVIDADO) { el.hidden = true; return; }
  if (el.dataset.fechado !== '1') el.hidden = false;
  const html = `<button class="mini fechar" data-fechar-convites="1">×</button><h3>Convites <span class="atual">código ${esc(E.codigo || '')}</span></h3>
    <p>${c.map((x) => x.tel ? `<a class="zap ${x.aberto ? 'aberto' : ''}" data-convite="${esc(x.dito)}" target="_blank" rel="noopener" href="${esc(linkZap(x))}">${x.aberto ? '✓ ' : ''}Abrir no zap: ${esc(x.nome)}</a>` : `<span class="semtel">${esc(x.dito)}: ${E.convitesSemLogin ? 'entre com a sua conta do app para eu achar o telefone' : x.ambiguo ? 'mais de um com esse nome no app' : 'sem telefone no app'} — copie o link</span>`).join(' ')}</p>
    <p class="sub" style="font-size:.75rem">O zap abre com a mensagem pronta; quem envia é você, lá. <button class="mini" data-copiar-link="1">copiar link</button></p>${E.mostrarLink || !c.length ? `<p><input class="campo" readonly value="${esc(E.codigo ? linkDaReuniao() : '')}" style="width:100%"></p>` : ''}`;
  if (el._html !== html) { el.innerHTML = html; el._html = html; }   // sem redesenhar à toa (o pisca não recomeça)
}
/** "pode mandar": abre o zap de cada convite (o navegador deixa abrir o 1º sem clique; os outros piscam pedindo um clique) */
function mandarConvites(so) {
  // so = os convites pedidos pelo nome ("manda pro Emiliano") — abre de novo mesmo se já tinha aberto antes
  const c = so && so.length ? so.filter((x) => x.tel) : ((E && E.convites) || []).filter((x) => x.tel && !x.aberto);
  if (!c.length) { falar('Os convites já foram abertos no zap.'); return; }
  let abertos = 0;
  // no ensaio (?mudo) nada abre: só marca — o zap de verdade nunca é tocado por teste
  for (const x of c) { const w = PARAMS.has('mudo') ? true : abrirSemOpener(linkZap(x)); if (w) { x.aberto = true; abertos++; } else break; }
  E.convitesPendentes = 0; salvar(); desenharConvites();
  const falta = c.filter((x) => !x.aberto);
  if (falta.length) { $('cardConvites').classList.add('chamando'); falar(abertos ? `Abri o zap ${abertos > 1 ? 'dos primeiros' : 'do primeiro'}. Para ${falta.map((x) => x.nome.split(' ')[0]).join(' e ')}, clique no nome: o navegador pede um clique.` : 'O navegador pede um clique: clique no nome de cada um.'); }
  else falar(abertos > 1 ? 'Abri o zap de cada um com a mensagem pronta. É só apertar enviar.' : 'Abri o zap com a mensagem pronta. É só apertar enviar.');
}
const PODE_MANDAR_RE = /\b(pode mandar|manda (os |o )?convites?|pode enviar|envia (os |o )?convites?|manda (pra|para) (eles|ela|ele))\b/;
/** reunião aberta e alguém pede para chamar mais gente ("Oscar, chama a Tainá") */
async function convidarMais(nomes, comLink = false) {
  if (!E || E.fim || !nomes.length) return;
  if (!Sala.anfitriao) abrirSala();
  await prepararConvitesPorVoz(nomes);
  if (comLink) E.mostrarLink = true;
  const el = $('cardConvites'); if (el) el.dataset.fechado = '';
  desenharConvites();
  if (!fluxoCamera && !PARAMS.has('semCamera')) alternarCamera();
  falar(fraseDosConvites());
}
/** "gera um link pra eu passar pra eles": o link e o código na tela (e na área de transferência) */
function mostrarLink() {
  if (!E || E.fim) return;
  if (!Sala.anfitriao) abrirSala();
  E.codigo = E.codigo || novoCodigo(); E.mostrarLink = true; salvar();
  const el = $('cardConvites'); if (el) el.dataset.fechado = '';
  desenharConvites();
  try { navigator.clipboard && navigator.clipboard.writeText(mensagemDoConvite('')).catch(() => {}); } catch (e) { /* sem permissão */ }
  falar('O link da reunião está na tela, e copiei o convite: é só colar no zap. Se quiser, diga o nome que eu preparo o convite de cada um.');
}

// ---------------------------------------------------------------------------
// LIGAR (06/out: quem chama é modo.js, depois de montar a sombra) e VOLTAR AO JARVIS
// ---------------------------------------------------------------------------
let opcoesDeInicio = {};
let ligado = false;
function ligarBotoes() {
  if (ligado) return; ligado = true;
  $('btnVidro').onclick = () => alternarVidro();
  $('btnJarvis').onclick = () => voltarAoJarvis();
  RAIZ.addEventListener('click', (e) => {
    const t = e.target.closest('[data-fechar-convites],[data-copiar-link],[data-convite]'); if (!t || !E) return;
    if (t.dataset.fecharConvites) { $('cardConvites').hidden = true; $('cardConvites').dataset.fechado = '1'; }
    if (t.dataset.copiarLink) { navigator.clipboard && navigator.clipboard.writeText(mensagemDoConvite('')).catch(() => {}); t.textContent = 'copiado'; }
    if (t.dataset.convite) { const c = (E.convites || []).find((x) => x.dito === t.dataset.convite); if (c) { c.aberto = true; salvar(); setTimeout(desenharConvites, 50); } }
  });
}
/** "Voltar ao Jarvis" (depois da ata): a sala some e o Jarvis volta a ouvir */
function voltarAoJarvis() {
  $('fim').style.display = 'none';
  if (opcoesDeInicio.hospede) opcoesDeInicio.hospede.hidden = true;
  Escuta.desligar(); Mascote.estado('ouvindo');
  if (PONTE) PONTE.devolver();
}
/** Uma reunião nova quando a anterior já acabou (a mesma tela, sem recarregar), ou mais convites na que está aberta. */
async function reabrir(opcoes = {}) {
  if (E && !E.fim) { if ((opcoes.convidar || []).length) convidarMais(opcoes.convidar); return; }
  if (opcoesDeInicio.hospede) opcoesDeInicio.hospede.hidden = false;
  E = null; filaRemota = []; vozesServidor = [];
  $('fim').style.display = 'none';
  await abrirComoAnfitriao(opcoes);
}
async function abrirComoAnfitriao(opcoes) {
  const convidar = opcoes.convidar || [];
  const guardado = carregar();
  // pedida por VOZ (ou "Nova reunião" com o login já feito): começa direto, com quem está logado na sala
  if (opcoes.comoFoi === 'voz' && !guardado) {
    const t = SEM_LOGIN ? null : await token();
    if (t || SEM_LOGIN) {
      await prepararAbertura();
      const eu = SEM_LOGIN ? (PARAMS.get('anfitriao') || 'Anfitrião') : (euNome || emailDaSessao().split('@')[0] || 'Anfitrião');
      E = novoEstado([eu]); salvar();
      definirAcessos({ [eu]: SEM_LOGIN || euPapel === 'admin' || !euPapel ? { nivel: 'admin', papel: euPapel || 'admin' } : { nivel: 'restrito', papel: euPapel } });
      $('abertura').style.display = 'none';
      await comecar(false, { convidar });
      return;
    }
    // sem login: a abertura pede a conta; os convites ficam guardados para quando começar
    pendentesDaVoz = convidar;
  }
  $('abertura').style.display = 'flex';
  await prepararAbertura();
  if (guardado) { E = { ...novoEstado(guardado.participantes), ...guardado }; $('aberturaAviso').textContent = `Há uma reunião em andamento desde ${hora(E.inicio)}.`; $('btnComecar').hidden = false; $('btnComecar').textContent = 'Continuar reunião'; $('btnComecar').onclick = () => comecar(true); }
}
let pendentesDaVoz = [];
export async function iniciar(opcoes = {}) {
  opcoesDeInicio = opcoes;
  PONTE = opcoes.ponte || null;
  MODO_CONVIDADO = opcoes.papel === 'convidado';
  CODIGO_ENTRAR = MODO_CONVIDADO ? String(opcoes.codigo || '') : '';
  carregarMarca(); ligarBotoes();
  atualizarConta();
  if (MODO_CONVIDADO) {
    if (PONTE) PONTE.assumir();
    await prepararEntrada();
    $('eEntrarConta').onclick = () => entrarComoConvidado(true);
    $('eEntrarNome').onclick = () => entrarComoConvidado(false);
    $('eNome').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrarComoConvidado(false); });
    $('ePedir').onclick = () => pedirParaEntrar();
    $('eMic').onclick = () => { const t = Sala.minha && Sala.minha.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; $('eMic').textContent = $('btnMic').textContent = 'Microfone: ' + (t.enabled ? 'ligado' : 'mudo'); } };
    $('eCam').onclick = () => { const t = Sala.minha && Sala.minha.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; $('eCam').textContent = $('btnCamera').textContent = 'Câmera: ' + (t.enabled ? 'ligada' : 'desligada'); desenharTeste(); } };
    $('eVidro').onclick = () => alternarVidro();
    $('eLoginBtn').onclick = async () => {
      const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email: $('eEmail').value.trim(), password: $('eSenha').value }) }).catch(() => null);
      if (!r || !r.ok) { $('eAviso').textContent = 'E-mail ou senha não conferem.'; return; }
      const ses = await r.json(); if (!ses.expires_at && ses.expires_in) ses.expires_at = Math.floor(Date.now() / 1000) + Number(ses.expires_in);
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(ses)); $('eSenha').value = ''; entrarComoConvidado(true);
    };
    $('btnMic').onclick = () => $('eMic').click();
    $('btnCamera').onclick = () => $('eCam').click();
    $('btnTela').onclick = () => convidadoTela();
    $('btnSair').onclick = () => { if (Sala.convidado) Sala.convidado.sair(); if (Sala.minhaCamada) Sala.minhaCamada.parar(); if (Sala.minha) Sala.minha.getTracks().forEach((t) => t.stop()); $('saiu').style.display = 'flex'; };
    $('btnMic').textContent = 'Microfone: ligado'; $('btnCamera').textContent = 'Câmera: ligada';
    return;
  }
  // ANFITRIÃO: o balcão do Mac está aqui? (no Mac do João sim; em outro computador a reunião segue sem ele)
  await sondarBalcao();
  await abrirComoAnfitriao(opcoes);
}
// "Nova reunião" depois do login (a abertura): os convites pedidos por voz entram aqui
const comecarDaAbertura = $('btnComecar').onclick;
$('btnComecar').onclick = () => { comecarDaAbertura(); if (E && pendentesDaVoz.length) { const c = pendentesDaVoz; pendentesDaVoz = []; setTimeout(() => convidarMais(c), 300); } };

window.REUNIAO = { $, raiz: RAIZ, vidro: medidasVidro, get camadaSala() { return camadaSala; }, convidarMais, mandarConvites, reabrir, Sala, soUmaNaSala, admitirConvidado, linkDaReuniao: () => E && E.codigo ? linkDaReuniao() : '', ouvir, encerrar, get estado() { return E; }, mudarClaude, definirAcessos, lerVozes, set operadorAdmin(v) { E.operadorAdmin = !!v; desenhar(); } };
