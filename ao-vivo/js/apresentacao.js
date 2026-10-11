// OSCARPES AO VIVO — apresentacao.js (05/out/2026)
// "Jarvis, abre a apresentação da <revenda/fazenda>": o agente devolve o LINK (ferramentas montar_apresentacao /
// minhas_apresentacoes, campo `abrir`) e esta página abre a apresentação em TELA CHEIA por cima de tudo, pelo
// visor do site (/apresentacao/#u=…, iframe isolado). A voz navega: "próxima", "volta", "pula", "tela cheia",
// "primeira", "última", "fecha a apresentação". As ordens vão por postMessage ao visor, que repassa à
// apresentação (supabase/functions/_compartilhado/apresentacao/pagina/pagina.js escuta { apresentacao: … }).
// Enquanto a apresentação está aberta, a frase passa PRIMEIRO por aqui (window.AO_VIVO_FRASE embrulhada;
// a do tema volta ao fechar). Pergunta de verdade ("quanto vendeu essa revenda?") segue para o agente.
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import './demo.js?v=20261010213811';
import { DESENHOS, desenhoGenerico } from './desenhos.js?v=20261010213811';
import { SUPABASE_URL, diag } from './base.js?v=20261010213811';
import { token } from './servidor.js?v=20261010213811';
import { sinal } from './controle.js?v=20261010213811';

let quadro = null, fraseDoTema = null, contextoDoTema = null, telaAtual = null, calaContexto = false;

// <entenderApresentacao> (função pura — o portão roda ela)
/** A frase é ordem para a apresentação aberta? Devolve a ordem ou null. */
function entenderApresentacao(frase) {
  // tira acento, o nome do assistente antes da vírgula (qualquer tema: "Oscar, …") e a pontuação
  const f = String(frase || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/^\s*[^,]{1,24},\s*/, '').replace(/[.!?,]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!f || f.split(' ').length > 6) return null;
  if (/^(fecha|fechar|sai|sair|encerra|encerrar|termina)( a)?( apresentacao)?$/.test(f)) return { cmd: 'fechar' };
  if (/^(proxima|proximo|avanca|avancar|segue|seguinte|vai|passa)( tela| pagina| slide)?$/.test(f)) return { cmd: 'proxima' };
  if (/^(volta|voltar|anterior|volta uma|tela anterior|slide anterior)( tela| pagina| slide)?$/.test(f)) return { cmd: 'anterior' };
  if (/^(pula|pular|pula essa|pula essas|pula as opcionais)$/.test(f)) return { cmd: 'pula' };
  if (/^(tela cheia|tela inteira|maximiza|aumenta a tela)$/.test(f)) return { cmd: 'cheia' };
  if (/^(primeira|volta ao inicio|do comeco|comeco)( tela)?$/.test(f)) return { cmd: 'inicio' };
  if (/^(ultima|vai pro final|final)( tela)?$/.test(f)) return { cmd: 'fim' };
  const m = f.match(/^(vai (para|pra) a |tela |slide )(\d{1,2})$/);
  if (m) return { cmd: 'ir', n: +m[3] };
  return null;
}
// </entenderApresentacao>

function abrirApresentacao(link, titulo) {
  if (!/^https:\/\/[^/]+\/apresentacao\/#u=/.test(String(link || ''))) return false;
  fecharApresentacao();
  quadro = document.createElement('div');
  quadro.id = 'apresentacaoAberta';
  quadro.setAttribute('style', 'position:fixed;inset:0;z-index:60;background:#000');
  const f = document.createElement('iframe');
  f.src = link; f.allow = 'fullscreen; autoplay'; f.setAttribute('allowfullscreen', ''); f.title = String(titulo || 'Apresentação');
  f.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;border:0');
  quadro.appendChild(f);
  document.body.appendChild(quadro);
  // a frase passa por aqui primeiro enquanto a apresentação estiver aberta
  fraseDoTema = typeof window.AO_VIVO_FRASE === 'function' ? window.AO_VIVO_FRASE : null;
  window.AO_VIVO_FRASE = (texto) => (comandoDaApresentacao(texto) ? true : (fraseDoTema ? fraseDoTema(texto) : false));
  // PERGUNTA DO CLIENTE SOBRE A TELA (06/out/2026, apresentação de vendas): a apresentação avisa a tela em
  // que está (pagina.js manda { apresentacao:'tela', n, titulo, texto }); a pergunta que não é ordem vai ao
  // agente com "(Na minha tela está aberto: …)" — ele responde pelo que ESTÁ na tela, sem inventar.
  contextoDoTema = typeof window.AO_VIVO_CONTEXTO_TELA === 'function' ? window.AO_VIVO_CONTEXTO_TELA : null;
  telaAtual = { titulo: String(titulo || 'Apresentação') };
  window.AO_VIVO_CONTEXTO_TELA = contextoDaApresentacao;
  sinal('▶', 'apresentação');
  diag('apresentacao abre');
  return true;
}
function fecharApresentacao() {
  if (!quadro) return false;
  quadro.remove(); quadro = null;
  window.AO_VIVO_FRASE = fraseDoTema || undefined;
  fraseDoTema = null;
  window.AO_VIVO_CONTEXTO_TELA = contextoDoTema || undefined;
  contextoDoTema = null; telaAtual = null;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  return true;
}
/** O que está na tela da apresentação, para a pergunta que vai ao agente. Vazio logo depois de uma ORDEM
 *  ("próxima"): o histórico de vistas (controle.js historicoDoTema) lê o contexto na mesma hora e não deve
 *  guardar cada tela como uma vista do Jarvis. */
function contextoDaApresentacao() {
  if (!quadro || !telaAtual || calaContexto) return '';
  const t = telaAtual;
  const onde = t.n > 0 ? `tela ${t.n} de ${t.total}` : (t.n === -1 ? 'tela interna (só de quem apresenta)' : 'tela');
  return `a apresentação "${String(t.apresentacao || t.titulo).slice(0, 90)}", ${onde}: ${String(t.texto || t.titulo || '').slice(0, 1000)}` +
    ' — responda à pergunta pelo que está nesta tela; o que estiver marcado "no lançamento" ou "em implantação" ainda não existe, diga assim';
}
// a apresentação (pelo visor) avisa em que tela está
addEventListener('message', (e) => {
  const d = e.data;
  if (!quadro || !d || d.apresentacao !== 'tela') return;
  const f = quadro.querySelector('iframe');
  if (!f || e.source !== f.contentWindow) return;
  telaAtual = { n: Number(d.n) || 0, total: Number(d.total) || 0, titulo: String(d.titulo || ''), texto: String(d.texto || ''), apresentacao: String(d.apresentacaoTitulo || (telaAtual && telaAtual.apresentacao) || '') };
});
function comandoDaApresentacao(texto) {
  if (!quadro) return false;
  const c = entenderApresentacao(texto);
  if (!c) return false;
  calaContexto = true; setTimeout(() => { calaContexto = false; }, 0);
  if (c.cmd === 'fechar') { fecharApresentacao(); sinal('■', 'apresentação fechada'); return true; }
  if (c.cmd === 'cheia') { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); }
  const f = quadro.querySelector('iframe');
  try { f.contentWindow.postMessage({ apresentacao: c.cmd, n: c.n }, '*'); } catch (e) {}
  sinal('▸', c.cmd === 'ir' ? `tela ${c.n}` : c.cmd);
  return true;
}

// MONTAR (05/out/2026): na voz o agente não chama outra função (portão conferir-modo-joao) — ele guarda o
// roteiro aprovado e devolve `montar: <id>`; quem pede a montagem é ESTA página, com o login de quem falou
// (a função apresentacao só monta a linha dessa pessoa). Pronto o link, abre em tela cheia.
async function montarEAbrir(id, titulo) {
  sinal('◷', 'montando a apresentação');
  try {
    const t = await token();
    if (!t) { sinal('·', 'entre no app para montar'); return; }
    const r = await fetch(SUPABASE_URL + '/functions/v1/apresentacao', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ acao: 'montar', id }) });
    const c = await r.json().catch(() => ({}));
    if (c && c.ok && c.link) abrirApresentacao(c.link, titulo); else { sinal('·', 'não montou'); diag('apresentacao nao montou ' + String(c && c.erro || r.status).slice(0, 60)); }
  } catch (e) { sinal('·', 'não montou'); }
}

// o resultado da ferramenta (pela voz) abre a apresentação; a janela fica de fora (null = sem painel)
const desenhoDaApresentacao = (r) => {
  if (r && r.montar) { montarEAbrir(String(r.montar), r.apresentacao && r.apresentacao.titulo); return null; }
  const link = r && r.abrir;
  if (link) { abrirApresentacao(link, r.apresentacao && r.apresentacao.titulo); return null; }
  return r && r.apresentacoes ? desenhoGenerico(r, {}, 'minhas_apresentacoes') : null;
};
DESENHOS.montar_apresentacao = desenhoDaApresentacao;
DESENHOS.minhas_apresentacoes = desenhoDaApresentacao;
addEventListener('keydown', (e) => { if (e.key === 'Escape' && quadro && !document.fullscreenElement) fecharApresentacao(); });

export { entenderApresentacao, abrirApresentacao, fecharApresentacao, comandoDaApresentacao, contextoDaApresentacao };
