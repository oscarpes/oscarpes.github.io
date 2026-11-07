/* ACESSO DO JARVIS AGROESTE (09/out/2026) — a abertura só libera o INICIAR com login de quem é da
   org Agroeste (org_membros) ou do super admin. João, 09/out: "pode publicar o Jarvis da Agroeste";
   o material é de uso restrito (Template Agroeste, Bayer), por isso o tema vai ao ar COM LOGIN
   (scripts/temas-com-login.txt), nunca aberto.
   Mesmo caminho da Brevant (temas/brevant/playbook.js): a rota /voz?tema=agroeste&dados=1 só responde 200
   a membro ativo da org do tema (temas_ao_vivo + org_membros — o servidor confere); 401 = sem login,
   403 = login sem acesso. A trava da página é conveniência: a voz é negada no servidor do mesmo jeito. */
(function () {
  const TEMA = window.TEMA || {};
  const A = () => window.AO_VIVO || null;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const caixaAbertura = $('#abertura .caixa');
  const botaoIniciar = $('#comecar');
  const caixa = document.createElement('form');
  caixa.className = 'ag-login';
  caixa.setAttribute('autocomplete', 'on');
  function travar(html) {
    if (botaoIniciar) botaoIniciar.style.display = 'none';
    caixa.innerHTML = html;
    if (caixaAbertura && !caixa.isConnected) caixaAbertura.insertBefore(caixa, botaoIniciar || null);
  }
  function liberar() { caixa.remove(); if (botaoIniciar) botaoIniciar.style.display = ''; document.documentElement.classList.add('ag-liberado'); }
  function mostrarLogin(msg = '') {
    travar(`<p class="ag-login-tit">Entre com o e-mail liberado para o assistente Agroeste</p>
      <input name="email" type="email" autocomplete="username" placeholder="e-mail" required>
      <input name="senha" type="password" autocomplete="current-password" placeholder="senha" required>
      <button type="submit">ENTRAR</button><small class="ag-login-msg">${esc(msg)}</small>`);
    caixa.onsubmit = async (e) => {
      e.preventDefault();
      const s = A() && A().sessao; if (!s) return;
      const b = $('button', caixa); b.disabled = true; b.textContent = 'ENTRANDO…';
      const r = await s.entrar(caixa.email.value, caixa.senha.value);
      if (r.erro) { mostrarLogin(r.erro); return; }
      conferir();
    };
  }
  function mostrarNegado() {
    travar('<p class="ag-login-tit">Acesso não liberado para esta conta.</p><small class="ag-login-msg">O assistente Agroeste é só para quem trabalha para a Agroeste.</small><button type="button" class="ag-login-sair">ENTRAR COM OUTRA CONTA</button>');
    $('.ag-login-sair', caixa).onclick = () => { const s = A() && A().sessao; if (s) s.sair(); mostrarLogin(); };
  }
  async function conferir() {
    const s = A() && A().sessao;
    if (!s) { travar('<p class="ag-login-tit">Não consegui abrir agora. Recarregue a página.</p>'); return; }
    travar('<p class="ag-login-tit">Conferindo o acesso…</p>');
    let r = null;
    try { r = await s.dadosDoTema(); } catch (e) { r = null; }
    if (r && r.status === 200) { liberar(); return; }
    if (r && r.status === 401) { mostrarLogin(); return; }
    if (r && r.status === 403) { mostrarNegado(); return; }
    travar('<p class="ag-login-tit">Não consegui conferir o acesso agora.</p><button type="button" class="ag-login-sair">TENTAR DE NOVO</button>');
    $('.ag-login-sair', caixa).onclick = () => conferir();
  }
  // tema sem "login" não abre (falha fechada)
  if (TEMA.login) conferir();
  else travar('<p class="ag-login-tit">Este tema precisa de login.</p>');
})();
