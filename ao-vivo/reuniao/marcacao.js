// OSCARPES AO VIVO — reuniao/marcacao.js
// A MARCAÇÃO DA REUNIÃO (era o <body> de reuniao/index.html até 06/out/2026). modo.js põe isto numa SOMBRA (shadow DOM)
// por cima do Jarvis: os ids daqui (legenda, aviso, abertura, caixa…) não se misturam com os do Jarvis.
export const MARCACAO = `<div class="sala" id="sala">
<div class="lgpd" id="lgpd" hidden><span><span class="rec"></span><b>Esta reunião está sendo transcrita</b> para a ata. O áudio fica só neste Mac e é apagado depois de virar texto; a voz de quem autorizar fica guardada só neste Mac para reconhecer quem fala (dá para apagar em “Vozes”). O Oscar só fala quando é chamado pelo nome.</span><span id="relogio">00:00</span></div>
<!-- 06/out (1ª reunião real, João e Tainá): "câmeras embaixo"; "os painéis não podem ser fixos — bem pequeno num canto e
     aparecendo conforme a gente chama, vidro subindo, igual ao conceito do Jarvis". Agora: topo enxuto; RESUMO pequeno no
     canto direito; o PALCO no meio só com o que foi chamado (cartões de vidro que sobem e somem); o PAINEL COMPLETO numa
     gaveta de vidro que abre pelo botão ou "Oscar, mostra as decisões"; a FAIXA DE CÂMERAS embaixo. -->
<header>
  <img id="folha" src="folha.png" alt="">
  <div><h1 id="titulo">Oscarpes · Reunião</h1><div class="sub" id="sub">Painel ao vivo — diga “Oscar, …” para pedir algo</div></div>
  <div class="chips" id="assuntos"></div>
  <div class="dir">
    <button id="btnConta" title="Entrar com a conta do app (para o Oscar puxar dados e o admin autorizar)">Entrar com a conta do app</button>
    <button id="btnMic" title="Pausar/retomar a escuta">Escuta: ligada</button>
    <button id="btnCamera" title="Ligar a câmera deste computador">Câmera: desligada</button>
    <button id="btnVidro" title="A pessoa sem o fundo, flutuando num painel de vidro (o recorte é feito neste computador)">Fundo de vidro: ligado</button>
    <button id="btnTela" title="Mostrar a tela de um computador no painel">Compartilhar tela</button>
    <button id="btnClaude" title="Quando ligado, mudança no app DECIDIDA vai para a fila do Claude Code">Claude Code: desligado</button>
    <button id="btnConvidar" hidden title="Link, código e convite pelo zap para quem está longe">Convidar</button>
    <button id="btnPainel" title="Abrir o painel completo (decisões, pendências, fila, vozes)">Painel</button>
    <button id="btnEncerrar">Encerrar</button>
    <button id="btnSair" hidden>Sair da reunião</button>
  </div>
</header>
<!-- quem pede para entrar aparece aqui, grande, no alto (na 1ª reunião ninguém viu o pedido no canto) -->
<div id="salaEspera"></div>
<button id="btnSom" hidden>Ativar o som da reunião</button>
<!-- RESUMO no canto: contagens + a última decisão + os cartões minimizados -->
<aside id="resumo">
  <div class="r-linha" data-abrir="decisoes"><b id="rDec">0</b> decisões<span id="rUltima"></span></div>
  <div class="r-linha" data-abrir="pendencias"><b id="rPend">0</b> pendências</div>
  <div class="r-linha" data-abrir="fila" id="rFilaLinha" hidden><b id="rFila">0</b> na fila do Claude Code</div>
  <div id="esperas"></div>
  <div class="chips" id="minimizados"></div>
</aside>
<!-- PALCO: só o que foi chamado — tela compartilhada, cartões de dados (pedidos e automáticos) -->
<section id="palcoCartoes">
  <section class="holo convites" id="cardConvites" hidden></section>
  <section class="holo c-tela" id="cardTela" hidden><h2>Tela compartilhada <small>— o pedido do app criado agora leva uma foto desta tela</small></h2><video id="video" autoplay muted playsinline></video></section>
  <div id="dados"></div>
  <div id="mesa"></div>
  <div id="ofertas" aria-live="polite"></div>
</section>
<!-- GAVETA: o painel completo, de vidro, abre pela direita -->
<section id="gaveta" aria-hidden="true">
  <div class="g-topo"><b>Painel da reunião</b><button class="mini" id="btnGavetaFechar">fechar</button></div>
  <section class="card" id="g-decisoes"><h2>Decisões</h2><ul id="decisoes"></ul></section>
  <section class="card" id="g-pendencias"><h2>Pendências <small>— dono e prazo</small></h2><ul id="pendencias"></ul></section>
  <section class="card" id="g-fila"><h2>Fila do Claude Code <small id="filaEstado"></small></h2><ul id="fila"></ul></section>
  <section class="card" id="g-sugestoes"><h2>Sugestões para o app <small>— ainda não decididas</small></h2><ul id="sugestoes"></ul></section>
  <section class="card c-vozes" id="g-vozes"><h2>Vozes <small id="vozesEstado">— quem fala é reconhecido pela voz, no próprio Mac</small></h2><div id="vozes"></div>
    <p class="sub" style="margin:.5rem 0 0;font-size:.72rem;color:var(--mudo)">Vozes guardadas neste Mac: <span id="cadastradas">—</span> <button class="mini" id="btnApagarVozes">apagar todas</button></p></section>
</section>
<!-- FAIXA DE CÂMERAS embaixo, como numa reunião normal -->
<div id="faixa"></div>
<div id="mascote"></div>
<footer>
  <div id="legenda"></div>
  <div class="barra"><input id="caixa" placeholder="Escrever uma fala (ex.: decidido: tirar o botão X da tela de laudos)" autocomplete="off"><button id="btnMandar">Enviar</button></div>
  <div class="barra" id="login"><input id="email" type="email" placeholder="e-mail do app"><input id="senha" type="password" placeholder="senha"><button id="btnEntrar">Entrar</button></div>
  <div id="aviso"></div>
</footer>
<div id="abertura"><div class="caixa">
  <img id="aberturaLogo" class="logoMarca" src="folha.png" alt="">
  <h1 id="aberturaTitulo">Reunião com o Oscar</h1>
  <!-- 1º passo (João, 06/out: "login primeiro, como todo app de reunião"): entrar com a conta do app -->
  <div id="passoLogin">
    <p class="sub">Entre com a sua conta do app para começar.</p>
    <input type="email" id="aEmail" placeholder="e-mail do app" autocomplete="username" class="campo">
    <input type="password" id="aSenha" placeholder="senha" autocomplete="current-password" class="campo">
    <button class="grande" id="btnAEntrar">Entrar</button>
    <p class="sub" id="aLoginAviso"></p>
  </div>
  <!-- 2º passo: nova reunião — quem está aqui na sala (do app, com o papel; ou escrito à mão = convidado sem acesso) -->
  <div id="passoNova" hidden>
    <p class="sub" id="aConectado"></p>
    <p class="sub" style="text-align:left;margin-bottom:.2rem">Quem está aqui na sala?</p>
    <div id="aPessoas" class="pessoas"></div>
    <div style="display:flex;gap:.4rem"><input type="text" id="participantes" placeholder="nome de quem está na sala sem conta do app (convidado)" autocomplete="off" class="campo" style="flex:1"><button id="btnAAdd">adicionar</button></div>
    <p class="sub" style="text-align:left;font-size:.72rem">Quem está longe entra pelo convite (botão “Convidar”, ou diga “Oscar, chama o …”).</p>
  </div>
  <div class="lgpd-txt">
    <p>Ao começar, a reunião passa a ser <b>transcrita</b> para a ata, e o Oscar avisa todos em voz alta.</p>
    <p>Para saber <b>quem falou</b>, o áudio é analisado <b>só neste Mac</b> (nada vai para a internet) e apagado logo depois de virar texto.
      Quem der o nome à própria voz pode deixá-la guardada neste Mac para ser reconhecido nas próximas reuniões — e apagar quando quiser.</p>
    <p>Dado restrito (financeiro, custos, comissões, salários, fiscal, carteira de clientes) só aparece com a <b>permissão de um sócio</b> quando há na sala alguém sem acesso a ele.</p>
    <p>Quem não concordar deve dizer antes de começar.</p>
  </div>
  <button class="grande" id="btnComecar" hidden>Nova reunião</button>
  <p class="sub" id="aberturaAviso"></p>
</div></div>
<!-- CONVITE (anfitrião): link + código; gente do app; o zap abre com a mensagem pronta e só envia no clique do João lá -->
<div id="convite" class="modal"><div class="caixa">
  <h1>Convidar para a reunião</h1>
  <p class="sub">Código: <b id="conviteCodigo"></b> — quem abrir o link pede para entrar e você admite aqui no painel.</p>
  <div style="display:flex;gap:.4rem"><input id="conviteLink" readonly class="campo" style="flex:1"><button id="btnConviteCopiar">copiar convite</button></div>
  <p class="sub" style="text-align:left;margin:.6rem 0 .2rem">Gente do app:</p>
  <div id="convitePessoas" class="pessoas"></div>
  <p><button id="btnConvitePreparar">Preparar convites pelo zap</button> <button id="btnConviteFechar">Fechar</button></p>
  <div id="conviteZap"></div>
</div></div>
<!-- PORTA DO CONVIDADO (?entrar=<código>): 1) quem é (conta do app ou nome) 2) confere câmera e microfone 3) sala de espera -->
<div id="entrada" class="modal"><div class="caixa">
  <img class="logoMarca" src="folha.png" alt="">
  <h1 id="eTitulo">Entrar na reunião</h1>
  <div id="ePasso1">
    <button class="grande" id="eEntrarConta" hidden></button>
    <div id="eConta" hidden></div>
    <div id="eLogin">
      <p class="sub">Com a sua conta do app:</p>
      <input type="email" id="eEmail" placeholder="e-mail do app" class="campo" autocomplete="username">
      <input type="password" id="eSenha" placeholder="senha" class="campo" autocomplete="current-password">
      <button class="grande" id="eLoginBtn">Entrar com a conta</button>
      <p class="sub" style="margin-top:1rem">Sem conta do app (convidado, sem acesso a dados):</p>
    </div>
    <div style="display:flex;gap:.4rem"><input type="text" id="eNome" placeholder="seu nome" class="campo" style="flex:1"><button id="eEntrarNome">Entrar como convidado</button></div>
  </div>
  <div id="ePasso2" hidden>
    <div class="teste"><div class="ladrilho" id="eVideoCaixa"><div class="ini" id="eIni">?</div><div class="nome" id="eNomeTeste"></div></div><div class="medidor" title="microfone"><span id="eNivel"></span></div></div>
    <p class="sub" id="eTesteTxt">Confira a câmera e o microfone (a barra mexe quando você fala).</p>
    <div class="botoes"><button id="eMic">Microfone: ligado</button><button id="eCam">Câmera: ligada</button><button id="eVidro">Fundo de vidro: ligado</button></div>
    <button class="grande" id="ePedir">Pedir para entrar</button>
  </div>
  <p class="lgpd-txt" style="color:#ffd79a;font-size:.8rem;text-align:left">Esta reunião é transcrita para a ata. O seu áudio vai para o computador de quem convidou e vira texto com o seu nome; o recorte do fundo de vidro é feito no seu próprio aparelho. Câmera e microfone desligam pelos botões no topo.</p>
  <p class="sub" id="eAviso"></p>
</div></div>
<div id="saiu"><div class="caixa"><img class="logoMarca" src="folha.png" alt=""><h1>Você saiu da reunião</h1><p class="sub">Pode fechar esta janela.</p></div></div>
<div id="fim"><div class="caixa">
  <h1>Ata da reunião</h1>
  <p id="fimEstado" class="sub"></p>
  <p><button id="btnBaixarHtml">Baixar ata (HTML)</button> <button id="btnBaixarTxt">Baixar ata (texto)</button> <button id="btnVoltar">Voltar ao painel</button> <button id="btnJarvis">Voltar ao Jarvis</button></p>
  <p class="sub">Mandar a ata pelo zap só depois do seu sim: peça ao Claude/Oscar indicando para quem.</p>
  <iframe id="ataQuadro" title="Ata"></iframe>
</div></div>
</div>`;
