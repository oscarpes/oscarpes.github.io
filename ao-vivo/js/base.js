// OSCARPES AO VIVO — base.js
// Configuração (Supabase, chave pública, ?demo, tempos de silêncio, avisos de espera), a conferência
// da versão publicada, os atalhos de sempre ($, esc, num, reais, dataBR), o diagnóstico (DIAG/diag), o
// relógio do topo, o aviso e o diagnóstico de falha do microfone.
// TEMA, TEMA_PADRAO e VERSAO vêm do index.html (scripts clássicos que rodam antes dos módulos).
// A página era um arquivo só até 03/out/2026; a divisão em módulos não mudou nada na tela — a ordem
// de carga é a mesma do arquivo antigo (ver a CORRENTE DE CARGA em main.js).
import { token } from './servidor.js?v=20261010213811';

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------
const SUPABASE_URL = 'https://sjtfwipgqeryeukreyst.supabase.co';
// VERSÃO: a constante VERSAO mora no index.html (a conferência abaixo lê o index.html do
// servidor e compara) — ver o comentário lá.
// TEMA (03/out/2026): recarregar pela versão e limpar o endereço do chamado NÃO podem perder o
// ?tema= — senão a página da empresa voltava a ser a da Oscarpes. No padrão fica vazio (igual antes).
const TEMA_BUSCA = TEMA.id === TEMA_PADRAO.id ? '' : 'tema=' + encodeURIComponent(TEMA.id);
async function conferirVersao() {
  if (VERSAO.startsWith('__')) return;
  // regravação em curso (js/regravar.js): recarregar no meio perderia o vídeo — confere na próxima abertura
  if (document.body && document.body.classList.contains('regravando')) return;
  try {
    const r = await fetch(location.pathname + '?checar=' + Date.now(), { cache: 'no-store' });
    const m = /const VERSAO = '([^']+)'/.exec(await r.text());
    if (m && m[1] !== VERSAO && !sessionStorage.getItem('ao-vivo-recarregou-' + m[1])) {
      sessionStorage.setItem('ao-vivo-recarregou-' + m[1], '1');
      // 07/out/2026: guarda TODOS os parâmetros (?reuniao=1, ?entrar=…, tema) — antes só o tema
      // sobrevivia e a recarga de versão tirava o João de dentro da reunião.
      const q = new URLSearchParams(location.search); q.set('v', m[1]); if (TEMA_BUSCA && !q.has('tema')) q.set('tema', TEMA.id);
      location.replace(location.pathname + '?' + q.toString() + location.hash);
    }
  } catch (e) {}
}
conferirVersao();
// 02/out/2026: o Chrome do iPhone RESTAURA a aba do cache (sem rodar a página de
// novo) — no log das 20:25–20:29 ele ainda falava com a página de antes da do
// Safari, aberta no mesmo minuto. Confere de novo sempre que a aba volta.
addEventListener('pageshow', (e) => { if (e.persisted) conferirVersao(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) conferirVersao(); });
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdGZ3aXBncWVyeWV1a3JleXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTI1MTksImV4cCI6MjA5MjcyODUxOX0.DG0pLGoPbo8W50_AeXb1zA0BALCchyKPAGFfP3hghcM';
const CHAVE_SESSAO = 'sb-sjtfwipgqeryeukreyst-auth-token';
// 03/out/2026 — o tema vai na rota: o servidor confere se a pessoa é da empresa do tema (org_membros)
// e roda o agente só com os dados dela (org-contexto.ts). Sem tema = Oscarpes, como sempre.
// 06/out/2026: servida pelo balcão da reunião no Mac (127.0.0.1:47815, a cópia de teste antes de publicar), a rota do agente só
// aceita a origem do site — o balcão repassa (/api/agente, com o login de quem está na página). No site, nada muda.
const PELO_BALCAO = /^http:\/\/(127\.0\.0\.1|localhost):47815$/.test(location.origin);
const ROTA_VOZ = (PELO_BALCAO ? '/api/agente' : SUPABASE_URL + '/functions/v1/whatsapp/voz') + (TEMA_BUSCA ? '?' + TEMA_BUSCA : '');
const DEMO = new URLSearchParams(location.search).has('demo');   // só desenho, sem servidor (teste visual)
const SILENCIO_MS = 1300;     // depois da última palavra, quanto espero para mandar
const SILENCIO_FINAL_MS = 550; // …quando o reconhecedor já fechou a frase (resultado final)
// Aviso de espera: se a resposta não chegou em ESPERA_AVISO_MS depois de mandar,
// a voz diz uma destas (curtas, geradas antes — saem na hora). Desligar: [].
const AVISOS_DE_ESPERA = ['Um instante.', 'Só um momento.', 'Já vejo.', 'Deixa eu conferir.'];
const ESPERA_AVISO_MS = 1100;

const $ = (id) => document.getElementById(id);
// TEMA NA MARCAÇÃO (03/out/2026): no padrão não faz nada. Num tema troca a marca do topo, a
// abertura e a música; texto vai por textContent e imagem por atributo (o tema é dado, não HTML).
(function marcarTema() {
  if (TEMA.id === TEMA_PADRAO.id) return;
  const img = (src, alt, cls) => { const i = document.createElement('img'); i.src = src; i.alt = alt || ''; if (cls) i.className = cls; return i; };
  const topo = document.querySelector('.topo .marca');
  if (topo && TEMA.marca) {
    topo.textContent = '';
    if (TEMA.marca.imagem) topo.appendChild(img(TEMA.marca.imagem, TEMA.nome, 'logo-tema'));
    if (TEMA.marca.texto) { const t = document.createElement('span'); t.textContent = TEMA.marca.texto; topo.appendChild(t); }
  }
  const ab = TEMA.abertura, caixa = document.querySelector('#abertura .caixa');
  if (caixa && ab) {
    const velha = caixa.querySelector(':scope > img');
    if (velha) velha.replaceWith(img(ab.imagem, TEMA.nome, 'logo-tema'));
    const h1 = caixa.querySelector('h1'); if (h1 && ab.titulo != null) h1.textContent = ab.titulo;
    const p = caixa.querySelector('p'); if (p && ab.texto) p.textContent = ab.texto;
  }
  if (TEMA.musica === false) { const m = $('musica'); if (m) m.remove(); }
  document.documentElement.classList.add('tema-pronto');
})();
// DIAGNÓSTICO (02/out/2026): o João testa no iPhone e eu não vejo a tela dele.
// Cada pergunta leva um resumo técnico curto (sem dado pessoal) que o servidor
// registra no log: o 3D carregou? a folha montou? o que o microfone fez?
const NAV = /CriOS/.test(navigator.userAgent) ? 'chrome-iphone' : /EdgiOS|FxiOS/.test(navigator.userAgent) ? 'outro-iphone'
  : /Edg\//.test(navigator.userAgent) ? 'edge' : /Chrome\//.test(navigator.userAgent) ? (/Android/.test(navigator.userAgent) ? 'chrome-android' : 'chrome')
  : /Safari\//.test(navigator.userAgent) ? 'safari' : 'outro';
// tempos: a última pergunta medida na tela (fim da fala → envio, servidor, voz começou)
const DIAG = { versao: '', nav: NAV, ios: false, webgl: null, three: !!window.THREE, folha: null, eventos: [], voz: '', tempos: null };
function diag(ev) { DIAG.eventos.push(`${Math.round(performance.now() / 1000)}s ${ev}`); if (DIAG.eventos.length > 14) DIAG.eventos.shift(); }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, casas = 1) => (v == null || !isFinite(v)) ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas });
const reais = (v) => (v == null || !isFinite(v)) ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const dataBR = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${m[3]}/${m[2]}` : (iso || '—'); };
setInterval(() => { $('hora').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }, 1000);

function aviso(html) { const a = $('aviso'); a.innerHTML = html; a.style.display = html ? 'block' : 'none'; }
// Falha de microfone NÃO gera pergunta — e sem pergunta o servidor não via
// nada (02/out/2026, "no Chrome continua com problema" sem rastro no log). Essas
// falhas mandam só o diagnóstico (no máximo 1 a cada 30 s).
let ultimoDiagSo = 0;
function avisarFalha(ev) {
  diag(ev);
  if (DEMO || Date.now() - ultimoDiagSo < 30_000) return;
  ultimoDiagSo = Date.now();
  token().then((t) => { if (!t) return;
    fetch(ROTA_VOZ, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
      body: JSON.stringify({ so_diag: true, diag: { ...DIAG, motivo: ev, ua: navigator.userAgent.slice(0, 160) } }) }).catch(() => {});
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// AUDITORIA VISUAL (05/out/2026 — João, na TV: "a tela que ele abriu … abriu de forma que não dá para ver o
// conteúdo; nosso agente não está pegando esse tipo de erro?"). Cada janela/lâmina que termina de abrir é
// medida AQUI, na tela de quem está olhando: conteúdo cortado (a caixa não mostra tudo), fora da área visível,
// letra menor que 14 px e caixas sobrepostas. Defeito vai ao servidor (so_defeito → tabela ao_vivo_defeitos;
// a vigia do agente lê). Sem texto do conteúdo — só onde, o quê e o tamanho da tela.
// ---------------------------------------------------------------------------
const LETRA_MINIMA_PX = 14;
function auditarTela(caixas, onde, opcoes = {}) {
  const W = innerWidth, H = innerHeight, defeitos = [];
  const lista = [...(caixas || [])].filter((el) => el && el.isConnected && el.getClientRects().length);
  const nomeDe = (el, i) => el.dataset.id || el.dataset.tipo || el.className.split(' ')[0] + '#' + (i + 1);
  lista.forEach((el, i) => {
    const r = el.getBoundingClientRect(), nome = nomeDe(el, i);
    if (r.right > W + 2 || r.bottom > H + 2 || r.left < -2 || r.top < -2) defeitos.push({ caixa: nome, defeito: 'fora_da_tela', r: [r.left, r.top, r.right, r.bottom].map(Math.round) });
    if (!opcoes.rolaPorDentro && (el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4)) defeitos.push({ caixa: nome, defeito: 'conteudo_cortado', falta_px: [el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight] });
    // 05/out/2026 (ensaio da demo): na TV a janela NÃO rola — o que sobrou no corpo depois de encolher (caber) é corte
    const corpo = opcoes.corpoSemRolagem && !el.classList.contains('focado') && !el.classList.contains('miniatura') ? el.querySelector(opcoes.corpoSemRolagem) : null;
    if (corpo && (corpo.scrollHeight > corpo.clientHeight + 4 || corpo.scrollWidth > corpo.clientWidth + 4)) defeitos.push({ caixa: nome, defeito: 'conteudo_cortado', falta_px: [corpo.scrollWidth - corpo.clientWidth, corpo.scrollHeight - corpo.clientHeight] });
    let menor = 99, quantos = 0;
    el.querySelectorAll('*').forEach((x) => {
      if (![...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      const fs = parseFloat(getComputedStyle(x).fontSize) || 99; const q = x.getBoundingClientRect();
      if (q.width && q.height && fs < LETRA_MINIMA_PX) { quantos++; menor = Math.min(menor, fs); }
    });
    if (quantos) defeitos.push({ caixa: nome, defeito: 'letra_pequena', menor_px: Math.round(menor * 10) / 10, textos: quantos });
  });
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
    const a = lista[i].getBoundingClientRect(), b = lista[j].getBoundingClientRect();
    const sx = Math.min(a.right, b.right) - Math.max(a.left, b.left), sy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (sx > 8 && sy > 8) defeitos.push({ caixa: nomeDe(lista[i], i) + ' × ' + nomeDe(lista[j], j), defeito: 'sobreposta', px: [Math.round(sx), Math.round(sy)] });
  }
  const registro = { onde: String(onde || '').slice(0, 80), tela: { w: W, h: H, dpr: devicePixelRatio, cheia: !!document.fullscreenElement || (screen.width === outerWidth && screen.height === outerHeight) }, defeitos: defeitos.slice(0, 20), versao: VERSAO, tema: TEMA.id };
  window.__ultimaAuditoria = registro;
  if (defeitos.length) { diag('defeito na tela: ' + onde + ' (' + defeitos.length + ')'); reportarDefeito(registro); }
  return registro;
}
let defeitosEnviados = {};
function reportarDefeito(registro) {
  if (DEMO || /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) return;
  const chave = registro.onde + '|' + registro.defeitos.map((d) => d.defeito + d.caixa).join(',');
  if (Date.now() - (defeitosEnviados[chave] || 0) < 600_000) return;   // o mesmo defeito, no máximo 1 a cada 10 min
  defeitosEnviados[chave] = Date.now();
  token().then((t) => { if (!t) return;
    fetch(ROTA_VOZ, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
      body: JSON.stringify({ so_defeito: true, defeito: registro, tema: TEMA.id === TEMA_PADRAO.id ? undefined : TEMA.id }) }).catch(() => {});
  }).catch(() => {});
}
window.AO_VIVO_AUDITAR = auditarTela;


// "Entrar no app" de dentro do Jarvis (07/out/2026): o app volta para ESTE endereço depois do login
// (lib/voltar-depois-login.ts no app; só caminhos /ao-vivo e /apresentacao são aceitos lá).
const linkEntrar = () => '/?voltar=' + encodeURIComponent(location.pathname + location.search);

export {
  auditarTela, SUPABASE_URL, TEMA_BUSCA, ANON, CHAVE_SESSAO, ROTA_VOZ, DEMO, SILENCIO_MS, SILENCIO_FINAL_MS,
  AVISOS_DE_ESPERA, ESPERA_AVISO_MS, $, DIAG, diag, esc, num, reais, dataBR, aviso, avisarFalha, linkEntrar,
};
