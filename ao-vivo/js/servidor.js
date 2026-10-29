// OSCARPES AO VIVO — servidor.js
// O SERVIDOR: a sessão (token, a mesma do app), a pergunta à rota whatsapp/voz com a resposta em
// FLUXO (uma linha JSON por evento) e o aquecimento (ping).
// ordem de carga: a 1ª importação é SEMPRE o módulo anterior da corrente (ver main.js)
import { ultimaDeVozSemNome } from './ouvido.js?v=20261029171555';
import { $, ANON, CHAVE_SESSAO, DEMO, DIAG, ROTA_VOZ, SUPABASE_URL, diag } from './base.js?v=20261029171555';
import { comContextoDaTela } from './comandos.js?v=20261029171555';

// ---------------------------------------------------------------------------
// SESSÃO — a mesma do app (mesmo endereço)
// ---------------------------------------------------------------------------
let geracaoSessao = 0;
addEventListener('storage', e => { if (e.key === CHAVE_SESSAO || e.key === null) geracaoSessao++; });
function sessaoAtual() { try { return JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null'); } catch { return null; } }
function contaAtual() { return sessaoAtual()?.user?.id || null; }
async function token() {
  // TEMA SEM SERVIDOR (03/out/2026): tema publicado antes de existir o servidor dele (sem contexto de
  // empresa) — nada sai desta página para o servidor da Oscarpes, nem com sessão aberta no navegador.
  if (TEMA.semServidor) return null;
  const antes = localStorage.getItem(CHAVE_SESSAO);
  let s = null;
  try { s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null'); } catch (e) {}
  if (!s || !s.access_token) return null;
  const vence = (s.expires_at || 0) * 1000;
  if (vence && vence - Date.now() < 60_000 && s.refresh_token && !ANON.startsWith('__')) {
    try {
      const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
      if (r.ok) { const n = await r.json(); if (localStorage.getItem(CHAVE_SESSAO) !== antes || n.user?.id !== s.user?.id) return null; localStorage.setItem(CHAVE_SESSAO, JSON.stringify(n)); return n.access_token; }
    } catch (e) {}
    return null;
  }
  return s.access_token;
}
async function chamar(texto, audio, aoEvento, mensagemId = crypto.randomUUID()) {
  if (TEMA.semServidor) return { texto: String(TEMA.semServidorTexto || 'Essa pergunta livre chega na próxima versão.') };
  const conta = contaAtual(), geracao = geracaoSessao;
  let jwtDaOrigem = null;
  const vigente = () => !!conta && contaAtual() === conta && geracaoSessao === geracao && (!jwtDaOrigem || sessaoAtual()?.access_token === jwtDaOrigem);
  const t = await token();
  jwtDaOrigem = t;
  if (!vigente()) return { silencio: true, origemValida: () => false };
  if (!t) return { erro: 'Entre no app com a sua conta neste navegador e volte para esta página.', login: true };
  // O retry conserva exatamente payload, id e JWT, inclusive quando houve commit e a resposta caiu.
  const payload = JSON.stringify({ mensagem_id: mensagemId, ...(audio ? { audio: audio.audio, mime: audio.mime } : { texto: comContextoDaTela(texto).slice(0, 1500) }), telas: true, fluxo: !!aoEvento && !!window.ReadableStream, ...(ultimaDeVozSemNome && !(typeof window.AO_VIVO_CONTEXTO_TELA === 'function' && window.AO_VIVO_CONTEXTO_TELA()) ? { sem_nome: true } : {}), diag: { ...DIAG, voz: $('vozChip').textContent, ua: navigator.userAgent.slice(0, 120) } });
  const executar = () => fetch(ROTA_VOZ, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: payload });
  const vincular = corpo => ({ ...corpo, origemValida: vigente, confirmarRender: () => {
    const a = corpo.apresentacao_devolucao || corpo.apresentacao_extrato;
    if (!vigente() || !a || typeof a.token !== 'string' || a.texto !== corpo.texto) return;
    const extrato = !corpo.apresentacao_devolucao && corpo.apresentacao_extrato;
    if (extrato && !['lote_id', 'decisao_id', 'versao'].every(k => typeof a[k] === 'string' && a[k])) return;
    const apresentacao = extrato ? { apresentacao_extrato: { token: a.token, lote_id: a.lote_id, decisao_id: a.decisao_id, versao: a.versao } } : { apresentacao_devolucao: a.token };
    return fetch(ROTA_VOZ, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ somente_recibo: true, ...apresentacao }) }).catch(() => {});
  } });
  async function receber(r) {
  // servidor antigo, erro antes do agente (login, teto, transcrição) ou navegador sem leitura em fluxo: JSON inteiro
  if (!r.ok || !/ndjson/.test(r.headers.get('content-type') || '') || !r.body || !r.body.getReader) {
    const corpo = await r.json().catch(() => ({ erro: 'A conexão caiu na resposta.', falhaTransporte: true }));
    if (!r.ok) return vincular({ erro: corpo.erro || 'Não consegui responder agora.', login: r.status === 401 });
    return vincular(corpo);
  }
  // FLUXO: uma linha JSON por evento; resolve no "fim" (o servidor ainda pode estar gravando o log)
  return await new Promise((resolver) => {
    const leitor = r.body.getReader(), dec = new TextDecoder();
    let buf = '', feito = false;
    const fechar = (v) => { if (!feito) { feito = true; resolver(vincular(v)); } };
    (async () => {
      try {
        for (;;) {
          const { value, done } = await leitor.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const linha = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!linha) continue;
            let ev; try { ev = JSON.parse(linha); } catch (e) { continue; }
            if (ev.tipo === 'fim') fechar({ ...ev, fluxo: true });
            else if (ev.tipo === 'erro') fechar({ erro: ev.erro || 'Não consegui responder agora.' });
            else if (!feito && vigente()) aoEvento(ev);
          }
        }
      } catch (e) { diag('fluxo caiu ' + String(e && e.message || e).slice(0, 40)); }
      fechar({ erro: 'A conexão caiu no meio da resposta. Fale de novo.', falhaTransporte: true });
    })();
  });
  }
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    if (!vigente()) return { silencio: true, origemValida: () => false };
    try {
      const r = await executar();
      if (!vigente()) return { silencio: true, origemValida: () => false };
      ultimoAquecimento = Date.now();
      const resposta = await receber(r);
      if (!resposta.falhaTransporte || tentativa === 1) return resposta;
    } catch (e) {
      if (tentativa === 1) return vincular({ erro: 'Sem conexão com o servidor. Confira a internet e fale de novo.' });
    }
  }
}
// AQUECER (03/out/2026, rapidez): ouvir "Oscar" já manda um `ping` — enquanto a pessoa termina a
// frase, a conexão (TLS), o isolate do servidor e o login conferido ficam quentes. Também a cada
// 4 min com a página à vista. No máximo um a cada 20 s; nada vai ao agente.
let ultimoAquecimento = 0;
async function aquecerServidor(motivo) {
  if (DEMO || Date.now() - ultimoAquecimento < 20000) return;
  ultimoAquecimento = Date.now();
  const t = await token(); if (!t) return;
  try { await fetch(ROTA_VOZ, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ ping: true }) }); diag('aquecido ' + (motivo || '')); } catch (e) {}
}
setInterval(() => { if (document.visibilityState === 'visible') aquecerServidor('relogio'); }, 240000);

// ENTRAR NA PRÓPRIA TELA (03/out/2026, tema de empresa com "login": a empresa testa no endereço
// dela com login de quem o João autorizar). Mesmo Auth do app, mesma chave
// de sessão no aparelho (o app no mesmo endereço também fica entrado). Só e-mail + senha: o convite
// do painel manda o link de criar a senha.
async function entrarComSenha(email, senha) {
  if (ANON.startsWith('__')) return { erro: 'Login indisponível nesta cópia local (sem a chave pública).' };
  let r;
  try {
    r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email: String(email || '').trim(), password: String(senha || '') }) });
  } catch (e) { return { erro: 'Sem conexão. Confira a internet.' }; }
  if (!r.ok) return { erro: r.status === 400 ? 'E-mail ou senha não conferem.' : 'Não consegui entrar agora.' };
  const s = await r.json();
  if (!s.expires_at && s.expires_in) s.expires_at = Math.floor(Date.now() / 1000) + Number(s.expires_in);
  geracaoSessao++;
  try { localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); } catch (e) { return { erro: 'O navegador não deixou guardar a sessão.' }; }
  return { ok: true };
}
function sairDaSessao() { geracaoSessao++; try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) {} }
/** Os dados do tema (rota /voz?tema=…&dados=1): só para membro da org do tema. */
async function dadosDoTema() {
  const t = await token();
  if (!t) return { status: 401 };
  try {
    const r = await fetch(ROTA_VOZ + (ROTA_VOZ.includes('?') ? '&' : '?') + 'dados=1', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: '{}' });
    if (!r.ok) return { status: r.status };
    return { status: 200, dados: await r.json() };
  } catch (e) { return { status: 0 }; }
}

// RESPOSTA DA PÁGINA NO LOG (05/out/2026, 20:36–20:45: a página respondeu sozinha e nada ficou registrado): todo turno que
// a página resolve sem o servidor vai ao log (rota /voz, `pagina`) — a frase ouvida, a ação e o que ela falou
async function registrarRespostaDaPagina(ouvido, acao, resposta) {
  if (DEMO) return;
  const t = await token(); if (!t) return;
  try { await fetch(ROTA_VOZ, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ pagina: { ouvido: String(ouvido || '').slice(0, 600), acao: String(acao || 'tela'), resposta: String(resposta || '').slice(0, 2000) } }) }); } catch (e) {}
}

export {
  token, chamar, aquecerServidor, entrarComSenha, sairDaSessao, dadosDoTema, registrarRespostaDaPagina,
};
