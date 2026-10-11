/* ---------------------------------------------------------------------------------------------
   APRESENTAÇÃO DA REVENDA — as telas (tema Brevant da tela ao vivo, 05/out/2026). SÓ FUNÇÕES PURAS.

   João, 05/out/2026, sobre a Thamilly Carpes apresentar para a Mocellin pelo Jarvis em vez da
   apresentação HTML: "acredito que se fosse apresentar por lá ia estar mais ou menos igual à
   apresentação que montou". Então a consulta dados_carteira (o servidor já preso na revenda que ela
   citou) vira a MESMA sequência da HTML, uma tela por vez, com as janelas de vidro do tema:
     crescimento · recompra · pedido × vendido · volume em plano · campo da região · B2701 por época ·
     estratégia · próximos passos  (+ B2900 só quando ELA citou o B2900; + clientes para ligar só
     quando ELA pediu — o servidor tira as duas chaves antes nos outros casos).

   As regras de linguagem do João (em vigor):
     - nada de "saldo só fechado" nem "provável" solto: os nomes vêm de `rotulos` ("Pedido ainda sem
       cliente", "Pedido ainda sem cliente, descontando quem deve recomprar"); as frases, de `textos`;
     - o campo é POR LAVOURA ("34 de 49 lavouras acima da média dos concorrentes"); a comparação com os
       híbridos concorrentes só em letra pequena, como na HTML;
     - nunca destacar derrota: "depois de 20/fev" só na tabela, sem cor nem selo;
     - o rótulo de autoria do campo (os ensaios são da Thamilly Carpes E do Lucas Tomaz) sempre à vista.

   Por que um arquivo só de funções puras: o portão scripts/conferir-filtro-revenda.ts importa ESTE
   arquivo no Deno e monta as telas com dados FALSOS — prova que nada de outra revenda, do B2900 sem
   pedido ou dos clientes sem pedido aparece, e que a parte pedida por voz é a mesma que o servidor
   entende (parteDaFala aqui × parteCitada em carteira-revenda.ts). O desenho na página é do carteira.js.
   --------------------------------------------------------------------------------------------- */
(function (raiz) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const lista = (v) => (Array.isArray(v) ? v : []);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
  const numero = (v) => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v));

  // ---- números em português (mesmo jeito da HTML: 7.543 · +33,5 % · +3,9 · −3,3) ----------------
  const mil = (v) => { const n = numero(v); if (n == null) return '—'; const r = Math.round(n); return (r < 0 ? '−' : '') + String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  const dec1 = (v, sinal = true) => { const n = numero(v); if (n == null) return '—'; let s = Math.abs(n).toFixed(1).replace('.', ','); if (Number(n.toFixed(1)) < 0) s = '−' + s; else if (sinal) s = '+' + s; return s; };
  const comSinal = (v) => { const n = numero(v); if (n == null) return '—'; return n > 0 ? '+' + mil(n) : mil(n); };
  const pct = (fr, casas = 0) => { const n = numero(fr); if (n == null) return '—'; return (n * 100).toFixed(casas).replace('.', ',') + ' %'; };
  const dataBR = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  /** "MARCEL MARTELLI E OUTRO" → "Marcel Martelli e outro" (os nomes como na HTML) */
  const nome = (s) => String(s || '').toLowerCase().split(/\s+/).filter(Boolean)
    .map((p, i) => (i > 0 && /^(e|da|de|do|das|dos)$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
  const safra = (s) => String(s || '').replace(/[^0-9]/g, '');

  // os nomes de sempre, quando a carga não trouxer `rotulos` (os mesmos da carga da Mocellin)
  const ROTULOS = {
    pedido: 'Volume de pedidos', vend_t: 'Volume de vendas', sem_cliente: 'Pedido ainda sem cliente', encaminhado: 'Já encaminhado',
    ainda_sem_ninguem: 'Ainda sem ninguém', plano: 'Volume em plano', recompra_fora_plano: 'Clientes de 26 que devem recomprar (parte fora do plano)',
  };
  const HIB_CAMPO = 'B2701PWU';     // as chaves b2701_* do campo são do B2701PWU

  // ---- peças -------------------------------------------------------------------------------------
  let nPainel = 0;
  const painel = (rot, corpo, cls = '', extra = '') => `<section class="pb-p cv-p ${cls}" style="--i:${nPainel++}" ${extra}>${rot ? `<div class="cv-rot">${rot}</div>` : ''}<div class="cv-pc">${corpo}</div></section>`;
  const grande = (v, unid = '', cls = '') => `<b class="cv-g ${cls}">${esc(v)}${unid ? `<small>${esc(unid)}</small>` : ''}</b>`;
  const barra = (fr, cls) => `<div class="cv-trilho"><i class="${cls}" style="--w:${Math.max(0, Math.min(100, fr * 100)).toFixed(1)}%"></i></div>`;
  const chip = (t) => `<span class="cv-chip">${esc(t)}</span>`;
  const etiqueta = (t) => `<span class="cv-etq">${esc(t)}</span>`;

  /** As autorias dos ensaios ("Thamilly Carpes e Lucas Tomaz"), na ordem de quem tem mais lavouras. */
  function autores(c) {
    const p = obj(c && c.lavouras_por_tecnico);
    if (!p) return '';
    const nomes = Object.entries(p).sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0)).map(([n]) => n);
    return nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : (nomes[0] || '');
  }
  /** "Lucas Tomaz 27 · Thamilly Carpes 18" (lavouras de ensaio de cada um, no lugar) */
  function porTecnico(c) {
    const p = obj(c && c.lavouras_por_tecnico);
    if (!p) return '';
    return Object.entries(p).sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0)).map(([n, v]) => `${n} ${mil(v)}`).join(' · ');
  }

  // ---- as telas ----------------------------------------------------------------------------------
  function telaCrescimento(D, ctx) {
    const nu = ctx.nu;
    const a = numero(nu.sc26), b = numero(nu.sc27);
    if (a == null || b == null) return null;
    const cres = numero(nu.crescimento_volume) != null ? Number(nu.crescimento_volume) : (a ? (b - a) / a : null);
    const mx = Math.max(a, b, 1);
    const cliA = numero(nu.cli26), cliB = numero(nu.cli27), tkA = numero(nu.ticket26), tkB = numero(nu.ticket27);
    const corpo =
      painel(`${esc(ctx.rot.vend_t)} · ${esc(D.representante || '')}${D.representante ? ' na ' : ''}${esc(ctx.curta)}`,
        `<div class="cv-barras">
          <div class="cv-linha"><span>Plantio ${esc(ctx.ant)}</span>${barra(a / mx, 'b')}${grande(mil(a), 'sc')}</div>
          <div class="cv-linha"><span>Plantio ${esc(ctx.dep)}</span>${barra(b / mx, 'l')}${grande(mil(b), 'sc', 'lar')}</div>
        </div>`, 'cv-a-vol') +
      (cres != null ? painel('Crescimento do volume de vendas', grande((cres > 0 ? '+' : '') + pct(cres, 1), '', 'lar cv-xg'), 'cv-a-cres') : '') +
      (cliA != null && cliB != null ? painel('Clientes', `<div class="cv-seta">${grande(mil(cliA))}<em>→</em>${grande(mil(cliB), '', 'lar')}</div>${cliB < cliA && b > a ? '<p class="cv-mudo">menos clientes, mais volume</p>' : ''}`, 'cv-a-cli') : '') +
      (tkA != null && tkB != null ? painel('Volume médio por cliente', `<div class="cv-seta">${grande(mil(tkA))}<em>→</em>${grande(mil(tkB), '', 'lar')}</div><p class="cv-mudo">sc por cliente</p>`, 'cv-a-tk') : '');
    return {
      id: 'crescimento', nav: 'VOLUME', tag: `Plantio ${ctx.ant} → ${ctx.dep}`, titulo: `Volume de vendas na ${ctx.curta}`,
      sub: ctx.textos.crescimento_volume || '', corpo: `<div class="cv-grade cv-g-cres">${corpo}</div>`,
      pe: D.unidade ? `unidade: ${D.unidade}` : '', fala: ctx.textos.crescimento_volume || '',
    };
  }

  function telaRecompra(D, ctx) {
    const nu = ctx.nu;
    if (numero(nu.recompra_cli) == null && !ctx.textos.recompra) return null;
    const des = obj(D.recompra_destaques) || {};
    const novos = lista(des.novos), cres = lista(des.cresceram);
    const kpi = (v, t1, t2) => painel('', `<div class="cv-kpi">${grande(v, '', 'lar')}<p><b>${esc(t1)}</b><br>${esc(t2)}</p></div>`, 'cv-k');
    const kpis =
      (numero(nu.recompra_cli) != null ? kpi(pct(nu.recompra_cli), 'taxa de recompra', `${mil(nu.recompra_n)} de ${mil(nu.cli26)} clientes de ${ctx.ant} já compraram de novo para ${ctx.dep}`) : '') +
      (numero(nu.recompra_vol) != null ? kpi(pct(nu.recompra_vol), `do volume de vendas de ${ctx.ant}`, `era dos clientes que já compraram de novo para ${ctx.dep}`) : '') +
      (numero(nu.novos27) != null ? kpi(mil(nu.novos27), `clientes novos em ${ctx.dep}`, numero(nu.sc_novos27) != null ? `volume de ${mil(nu.sc_novos27)} sc` : '') : '');
    const li = (a, b) => `<li><b>${esc(a)}</b><span>${b}</span></li>`;
    const listas =
      (novos.length ? painel(`Clientes novos em ${esc(ctx.dep)}`, `<ul class="cv-lista">${novos.slice(0, 6).map((c) => li(nome(c.cliente), `${mil(c.sc27)} sc${c.hibrido ? ` <em>${esc(c.hibrido)}</em>` : ''}`)).join('')}</ul>`, 'cv-topo') : '') +
      (cres.length ? painel(`Maior aumento de volume ${esc(ctx.ant)} → ${esc(ctx.dep)}`, `<ul class="cv-lista">${cres.slice(0, 5).map((c) => li(nome(c.cliente), `${mil(c.sc26)}<i class="cv-sc">→</i>${mil(c.sc27)} sc`)).join('')}</ul>`, 'cv-topo') : '');
    return {
      id: 'recompra', nav: 'RECOMPRA', tag: `Recompra ${ctx.ant} → ${ctx.dep}`, titulo: 'Recompra e clientes novos', sub: ctx.textos.recompra || '',
      corpo: `<div class="cv-grade cv-g-rec"><div class="cv-fila3">${kpis}</div>${listas ? `<div class="cv-fila2">${listas}</div>` : ''}</div>`,
      pe: '', fala: ctx.textos.recompra || '',
    };
  }

  // ---- A CASCATA do pedido (05/out/2026, madrugada) --------------------------------------------------
  // A conta antiga da sobra ("descontando quem deve recomprar") contava cliente em dobro: quem estava no
  // plano E na lista dos que devem recomprar entrava duas vezes. A carga nova traz três números, cada
  // cliente uma vez:  1) Pedido ainda sem cliente (pedido − vendido) → 2) Já encaminhado (volume em plano
  // + a parte dos clientes de 26 que devem recomprar FORA do plano) → 3) Ainda sem ninguém (1 − 2).
  // Venda acima do pedido = "falta semente" (nunca um número negativo solto). Carga antiga (saldo_*):
  // só o 1) aparece — o "descontando" antigo NÃO é reaproveitado, porque era a conta em dobro.
  const tirarNumero = (t) => String(t || '').replace(/^\s*\d+[.)]\s*/, '');
  function cascataDe(D) {
    let linhas = lista(D.pedido_x_vendido).filter((r) => obj(r));
    if (!linhas.length) linhas = lista(D.hibridos).filter((r) => obj(r)).map((h) => ({ hib: h.hibrido, pedido: h.pedido, vend_t: h.vendido }));
    linhas = linhas.map((r) => Object.assign({}, r, {
      sem_cliente: numero(r.sem_cliente) ?? numero(r.saldo_fechado) ?? (numero(r.pedido) != null && numero(r.vend_t) != null ? Number(r.pedido) - Number(r.vend_t) : null),
      // desde a 2ª troca (05/out, madrugada) o já encaminhado É o volume em plano, e a chave `plano` pode faltar
      plano: numero(r.plano) ?? numero(r.plano_t_fora) ?? (numero(r.recompra_fora_plano) == null ? numero(r.encaminhado) : null),
    }));
    const tot = linhas.find((r) => String(r.hib).toUpperCase() === 'TOTAL') || null;
    const hibs = linhas.filter((r) => r !== tot);
    const soma = (k) => (hibs.some((r) => numero(r[k]) != null) ? hibs.reduce((x, r) => x + (numero(r[k]) || 0), 0) : null);
    const T = tot || { hib: 'TOTAL', pedido: soma('pedido'), pedido_pend: soma('pedido_pend'), vend_t: soma('vend_t'), sem_cliente: soma('sem_cliente'), plano: soma('plano'), recompra_fora_plano: soma('recompra_fora_plano'), encaminhado: soma('encaminhado'), ainda_sem_ninguem: soma('ainda_sem_ninguem') };
    const tp = obj(D.totais_pedido) || {};
    const v = (k, ...velhas) => { for (const c of [k, ...velhas]) if (numero(tp[c]) != null) return Number(tp[c]); return numero(T[k]); };
    const tt = {
      pedido: v('pedido'), vend_t: v('vend_t', 'vendido'), sem_cliente: v('sem_cliente', 'saldo_so_fechado'), encaminhado: v('encaminhado'),
      ainda_sem_ninguem: v('ainda_sem_ninguem'), plano: v('plano', 'plano_fora_da_lista'), recompra_fora_plano: v('recompra_fora_plano'),
    };
    if (tt.plano == null && tt.recompra_fora_plano == null && tt.encaminhado != null) tt.plano = tt.encaminhado;

    const nova = tt.encaminhado != null && tt.ainda_sem_ninguem != null;
    return { hibs, T, tt, nova, frases: lista((obj(D.textos) || {}).cascata).map(String) };
  }
  /** Volume da cascata: negativo = a venda passou do pedido → "falta semente". */
  const volCascata = (v) => (numero(v) == null ? '—' : Number(v) < 0 ? `falta semente (${mil(-Number(v))} sc)` : mil(v));

  function telaPedido(D, ctx, foco) {
    const rot = ctx.rot, C = cascataDe(D);
    if (!C.hibs.length) return null;
    const k = (r, v, cls = '', extra = '') => painel(esc(r), numero(v) != null && Number(v) < 0 ? `<b class="cv-g lar">falta semente</b><p class="cv-mudo">${mil(-Number(v))} sc acima do pedido</p>` : grande(mil(v), 'sc', cls), 'cv-k4' + extra);
    const alvo = foco === 'sem-ninguem' ? ' cv-alvo' : '';
    const kpis = k(rot.pedido, C.tt.pedido) + k(rot.vend_t, C.tt.vend_t) + k(`${C.nova ? '1. ' : ''}${rot.sem_cliente} (pedido − vendido)`, C.tt.sem_cliente, 'lar') +
      (C.nova ? k(`2. ${rot.encaminhado}`, C.tt.encaminhado, 'lar') + k(`3. ${rot.ainda_sem_ninguem}`, C.tt.ainda_sem_ninguem, 'lar', alvo) : '');
    const cols = [['pedido', rot.pedido], ['pedido_pend', 'Pendente de faturar'], ['vend_t', rot.vend_t], ['sem_cliente', `${C.nova ? '1. ' : ''}${rot.sem_cliente}`, 'c'],
      ...(C.nova ? [['encaminhado', `2. ${rot.encaminhado}`, 'c'], ['ainda_sem_ninguem', `3. ${rot.ainda_sem_ninguem}`, 'c']] : [])]
      .filter(([c]) => C.hibs.some((r) => numero(r[c]) != null));
    const tr = (r, total) => `<tr class="${total ? 'tot' : ''}"><td>${total ? 'Total' : etiqueta(r.hib)}</td>${cols.map(([c, , cas]) => {
      const x = numero(r[c]); return `<td class="${cas && x > 0 && c !== 'encaminhado' ? 'pos' : ''}">${cas ? volCascata(x) : mil(x)}</td>`; }).join('')}</tr>`;
    const tabela = `<table class="cv-tab"><thead><tr><th>Híbrido</th>${cols.map(([, n]) => `<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>${C.hibs.map((r) => tr(r, false)).join('')}${tr(C.T, true)}</tbody></table>`;
    // as frases prontas: a cascata nova; na carga antiga, só a do pedido ainda sem cliente (a do "descontando" era a conta em dobro)
    const notas = C.frases.length ? C.frases : [ctx.textos.pedido_ainda_sem_cliente].filter(Boolean);
    const fala = foco === 'sem-ninguem' && C.frases[2] ? tirarNumero(C.frases[2]) : notas.map(tirarNumero).join(' ');
    return {
      id: 'pedido', nav: 'PEDIDO × VENDIDO', tag: 'Pedido × vendido', titulo: 'Volume de pedidos × volume de vendas por híbrido',
      sub: `${D.pedido_data ? `Pedido no sistema de ${dataBR(D.pedido_data)} × ` : ''}lista de vendas da ${ctx.curta} · volume em sc`,
      corpo: `<div class="cv-grade cv-g-ped"><div class="${C.nova ? 'cv-fila5' : 'cv-fila3'}">${kpis}</div>${painel('', tabela, 'cv-tabp')}</div>`,
      pe: notas.join('   '), fala, foco: foco === 'sem-ninguem' ? foco : null,
    };
  }

  function telaPlano(D, ctx) {
    const rot = ctx.rot, C = cascataDe(D);
    const total = C.tt.plano ?? numero(ctx.nu.plano27);
    if (!(total > 0)) return null;
    // o detalhe com NOMES (encaminhado_detalhe; na carga antiga, plano_fora_da_lista) só chega quando ela pede os clientes
    const det = lista(D.encaminhado_detalhe).filter((c) => obj(c) && numero(c.sc) > 0);
    const antigo = lista(D.plano_fora_da_lista).filter((c) => obj(c) && numero(c.plano) > 0).map((c) => ({ cliente: c.cliente, hib: c.hib, sc: c.plano, origem: 'volume em plano' }));
    const quem = det.length ? det : antigo;
    const doPlano = quem.filter((c) => /plano/i.test(String(c.origem)) && !/fora do plano/i.test(String(c.origem)));
    const nCli = new Set(doPlano.map((c) => c.cliente)).size;
    const hibsDoPlano = C.hibs.filter((r) => numero(r.plano) > 0).map((r) => r.hib);
    const topo = painel(`${esc(rot.plano)} · fora da lista de vendas da ${esc(ctx.curta)}`,
      `<div class="cv-kpi">${grande(mil(total), 'sc', 'lar cv-xg')}<p>${nCli ? `<b>${nCli} ${nCli === 1 ? 'cliente' : 'clientes'}</b><br>` : ''}${hibsDoPlano.length === 1 ? `${nCli > 1 ? 'todos em ' : 'em '}${etiqueta(hibsDoPlano[0])}` : hibsDoPlano.map(etiqueta).join(' ')}</p></div>`, 'cv-a-tot');
    // o JÁ ENCAMINHADO montado: volume em plano + os clientes de 26 que devem recomprar fora do plano = 2) da cascata
    let comp = '';
    if (C.nova) {
      // a cascata em barras (1 → 2 → 3). Desde a 2ª troca da madrugada de 05/out o "já encaminhado" é SÓ o
      // volume em plano; carga com a parte dos clientes de 26 fora do plano mostra a soma embaixo
      const mx = Math.max(C.tt.sem_cliente || 0, C.tt.encaminhado || 0, Math.abs(C.tt.ainda_sem_ninguem || 0), 1);
      const b = (r, x, cls) => `<div class="cv-linha cv-linha-p"><span>${esc(r)}</span>${barra(Math.max(0, x) / mx, cls)}${grande(volCascata(x), '', cls === 'l' ? 'lar' : '')}</div>`;
      const soma = numero(C.tt.recompra_fora_plano) > 0 ? `${rot.encaminhado} = ${rot.plano.toLowerCase()} ${mil(total)} + ${rot.recompra_fora_plano.toLowerCase()} ${mil(C.tt.recompra_fora_plano)} · ` : '';
      comp = painel(`O pedido ainda sem cliente, em 3 números`,
        `<div class="cv-barras">${b(`1. ${rot.sem_cliente}`, C.tt.sem_cliente, 'b')}${b(`2. ${rot.encaminhado}`, C.tt.encaminhado, 'l')}${b(`3. ${rot.ainda_sem_ninguem}`, C.tt.ainda_sem_ninguem, 'v')}</div>
         <p class="cv-mudo">${esc(soma)}cada cliente conta uma vez</p>`, 'cv-a-barras');
    }
    let lado = '';
    if (quem.length) {
      const grupos = [...new Set(quem.map((c) => String(c.origem || 'volume em plano')))];
      lado = painel(`Detalhe do ${esc(rot.encaminhado.toLowerCase())}`, grupos.map((g) => `<p class="cv-autor" style="margin-top:.6em">${esc(g)}</p><ul class="cv-lista cv-lista-d">${quem.filter((c) => String(c.origem || 'volume em plano') === g).slice(0, 12)
        .map((c) => `<li><b>${esc(nome(c.cliente))}</b><span>${mil(c.sc)} sc${c.hib ? ` <em>${esc(c.hib)}</em>` : ''}</span></li>`).join('')}</ul>`).join(''), 'cv-a-quem cv-topo');
    } else if (C.nova) {
      // sem os nomes (ela não pediu os clientes): o encaminhado por híbrido
      const linhas = C.hibs.filter((r) => numero(r.encaminhado) > 0 || numero(r.plano) > 0);
      lado = painel(`${esc(rot.encaminhado)} por híbrido`, `<table class="cv-tab"><thead><tr><th>Híbrido</th><th>${esc(rot.plano)}</th><th>Recompra fora do plano</th><th>${esc(rot.encaminhado)}</th></tr></thead><tbody>${linhas
        .map((r) => `<tr><td>${etiqueta(r.hib)}</td><td>${mil(r.plano)}</td><td>${mil(r.recompra_fora_plano)}</td><td class="pos">${mil(r.encaminhado)}</td></tr>`).join('')}</tbody></table>`, 'cv-a-quem cv-topo');
    }
    const fala = C.frases[1] ? tirarNumero(C.frases[1]) : `${rot.plano}: ${mil(total)} sc${nCli ? `, de ${nCli} ${nCli === 1 ? 'cliente' : 'clientes'}` : ''}.`;
    return {
      id: 'plano', nav: 'PLANO', tag: `Plano ${ctx.dep}`, titulo: `${rot.plano}: ${mil(total)} sc`, sub: C.frases[1] ? tirarNumero(C.frases[1]) : '',
      corpo: `<div class="cv-grade cv-g-plano">${topo}${comp}${lado}</div>`, pe: '', fala,
    };
  }

  /** Os cartões de cidade do campo: campo_<lugar> (menos o campo_atendido, que é a região inteira). */
  function cidadesDoCampo(D) {
    return Object.keys(D).filter((k) => /^campo_[a-z0-9_]+$/.test(k) && k !== 'campo_atendido' && obj(D[k]) && numero(D[k].b2701_lavouras_com_conc) > 0)
      .map((k) => ({ chave: k.replace(/^campo_/, '').replace(/_/g, '-'), c: D[k] }));
  }
  const linhaDoCampo = (c) => `acima da média dos concorrentes em ${mil(c.b2701_lav_acima_media_conc)} de ${mil(c.b2701_lavouras_com_conc)} lavouras, com ${dec1(c.b2701_dif_vs_media_conc)} sc/ha`;
  const pequenoDoCampo = (c) => (numero(c.b2701_confrontos) != null ? `comparado com ${mil(c.b2701_confrontos)} híbridos concorrentes nessas lavouras, ganhou de ${mil(c.b2701_vitorias)}` : '');

  function telaCampo(D, ctx, foco) {
    const A = obj(D.campo_atendido);
    if (!A || !(numero(A.b2701_lavouras_com_conc) > 0)) return null;
    const cid = cidadesDoCampo(D);
    const fr = Number(A.b2701_lav_acima_media_conc) / Number(A.b2701_lavouras_com_conc);
    const R = 150, C = 2 * Math.PI * R;
    const tec = autores(A);
    const anel = `<svg class="cv-anel" viewBox="0 0 340 340"><circle class="f" cx="170" cy="170" r="${R}"/><circle class="a" cx="170" cy="170" r="${R}" transform="rotate(-90 170 170)" stroke-dasharray="${C.toFixed(1)}" style="--ini:${C.toFixed(1)};--fim:${(C * (1 - fr)).toFixed(1)}"/><text x="170" y="170" dominant-baseline="central" text-anchor="middle">${Math.round(fr * 100)} %</text></svg>`;
    const regiao = painel(`Região atendida · ${mil(A.lavouras)} lavouras de ensaio · ${mil(A.b2701_lavouras_com_conc)} com ${HIB_CAMPO}`,
      `<div class="cv-campo">${anel}<div><div class="cv-dey">${grande(mil(A.b2701_lav_acima_media_conc), '', 'lar')}<i>de</i>${grande(mil(A.b2701_lavouras_com_conc))}</div><p class="cv-forte">lavouras acima da média<br>dos concorrentes</p></div></div>
       <div class="cv-chips">${chip(`${dec1(A.b2701_dif_vs_media_conc)} sc/ha sobre a média dos concorrentes`)}${numero(A.b2701_lav_acima_de_todos_conc) != null ? chip(`acima de todos em ${mil(A.b2701_lav_acima_de_todos_conc)}`) : ''}</div>
       <p class="cv-mudo">${esc(pequenoDoCampo(A))}</p>`, 'cv-a-reg');
    const cards = cid.map(({ chave, c }) => painel(esc(c.area || chave),
      `<div class="cv-dey">${grande(mil(c.b2701_lav_acima_media_conc), '', 'lar')}<i>de</i>${grande(mil(c.b2701_lavouras_com_conc))}<i>lavouras</i></div>
       <p class="cv-forte"><b>acima da média dos concorrentes</b> · ${dec1(c.b2701_dif_vs_media_conc)} sc/ha</p>
       <p class="cv-mudo">${esc(pequenoDoCampo(c))}</p>${porTecnico(c) ? `<p class="cv-autor">lavouras de ensaio: ${esc(porTecnico(c))}</p>` : ''}`,
      `cv-cid${foco && foco === chave ? ' cv-alvo' : ''}`, `data-cidade="${esc(chave)}"`)).join('');
    const nomesCid = cid.map(({ c }) => c.area).filter(Boolean);
    const alvo = foco && cid.find((x) => x.chave === foco);
    const fala = alvo
      ? `Em ${alvo.c.area}, o ${HIB_CAMPO} ficou ${linhaDoCampo(alvo.c)}.`
      : `Nos ensaios da região${tec ? `, de ${tec}` : ''}, o ${HIB_CAMPO} ficou ${linhaDoCampo(A)}.`;
    return {
      id: 'campo', nav: 'CAMPO', tag: `Resultado de campo · ensaios ${ctx.ant}S`.replace(/SS$/, 'S'), titulo: `${HIB_CAMPO} na região da ${ctx.curta}`,
      sub: `Ensaios ${ctx.ant}S da região atendida pela ${ctx.curta}${nomesCid.length ? ` (${nomesCid.join(' + ')})` : ''}`.replace(/SS /, 'S '),
      autoria: `ensaios de ${tec || 'técnicos da região'} · cada lavoura contada uma vez · média dos concorrentes = média dos híbridos concorrentes da mesma lavoura`,
      corpo: `<div class="cv-grade cv-g-campo">${regiao}<div class="cv-col">${cards}</div></div>`,
      pe: '', fala, foco: alvo ? alvo.chave : null,
    };
  }

  function linhasPorEpoca(D) {
    const E = obj(D.b2701_por_epoca);
    if (!E) return null;
    const tab = lista(E.tabela).filter((r) => obj(r) && numero(r.lavouras) > 0);
    if (!tab.length) return null;
    const tot = tab.find((r) => /todo o plantio/i.test(String(r.epoca))) || null;
    const ep = tab.filter((r) => r !== tot);
    // "melhor resultado": a época com a maior diferença sobre a média — e NADA marca a pior (João: nunca destacar derrota)
    const melhor = ep.reduce((a, r) => (!a || Number(r.dif_vs_media_conc) > Number(a.dif_vs_media_conc) ? r : a), null);
    return { E, ep, tot, melhor };
  }
  function tabelaEpoca(P, grandeTab) {
    const tr = (r, cls) => `<tr class="${cls}"><td>${esc(r.epoca)}${r === P.melhor ? ' <span class="cv-etq cv-etq-p">melhor resultado</span>' : ''}</td>
      <td>${mil(r.acima_media_conc)} de ${mil(r.lavouras)}</td><td>${mil(r.acima_de_todos_conc)}</td>
      <td class="${r === P.melhor || (cls === 'tot' && Number(r.dif_vs_media_conc) > 0) ? 'pos' : ''}">${dec1(r.dif_vs_media_conc)}</td>
      <td class="peq">${numero(r.concorrentes_comparados) != null ? `ganhou de ${mil(r.vitorias_confrontos)} de ${mil(r.concorrentes_comparados)}` : ''}</td></tr>`;
    return `<table class="cv-tab cv-tab-ep${grandeTab ? ' cv-tab-g' : ''}"><thead><tr><th>Época de plantio</th><th>Lavouras acima da<br>média dos concorrentes</th><th>Acima de todos<br>os concorrentes</th><th>Sobre a média dos<br>concorrentes, sc/ha</th><th>Híbridos concorrentes<br>comparados</th></tr></thead>
      <tbody>${P.ep.map((r) => tr(r, '')).join('')}${P.tot ? tr(P.tot, 'tot') : ''}</tbody></table>`;
  }
  function telaEpoca(D, ctx) {
    const P = linhasPorEpoca(D);
    if (!P) return null;
    return {
      id: 'epoca', nav: 'POR ÉPOCA', tag: `${HIB_CAMPO} por época · ensaios ${ctx.ant}S`.replace(/SS\b/, 'S'), titulo: `${HIB_CAMPO} por época de plantio`,
      sub: P.E.frase || '', autoria: P.E.rotulo || '',
      corpo: `<div class="cv-grade cv-g-ep">${painel('Por lavoura, em cada época de plantio', tabelaEpoca(P, true), 'cv-tabp')}</div>`,
      pe: '', fala: P.E.frase || '',
    };
  }

  /** As ações da estratégia (a 1ª repete a frase do campo: no cartão fica só a parte que é ação, como na HTML). */
  function acoesDaEstrategia(D) {
    const E = obj(D.b2701_por_epoca), frase = E && E.frase ? String(E.frase) : '';
    return lista(D.estrategia).map((x) => (typeof x === 'string' ? x : (obj(x) && (x.texto || x.frase)) || '')).filter(Boolean)
      .map((s) => (frase && s.startsWith(frase) && s.length > frase.length ? s.slice(frase.length).trim() : s));
  }
  function telaEstrategia(D, ctx) {
    const acoes = acoesDaEstrategia(D);
    if (!acoes.length) return null;
    const P = linhasPorEpoca(D);
    const cards = acoes.slice(0, 4).map((s, i) => painel('', `<div class="cv-card"><b class="cv-n">${i + 1}</b><p>${esc(s)}</p></div>`, 'cv-k')).join('');
    return {
      id: 'estrategia', nav: 'ESTRATÉGIA', tag: `Estratégia ${ctx.dep}`, titulo: P ? `${HIB_CAMPO} em todo o plantio` : `Estratégia com a ${ctx.curta}`,
      sub: P && P.E.frase ? P.E.frase : '',
      corpo: `<div class="cv-grade cv-g-estr">${P ? painel('', tabelaEpoca(P, false), 'cv-tabp') : ''}<div class="cv-fila4 cv-cards">${cards}</div></div>`,
      pe: '', fala: acoes.slice(0, 4).join(' '),
    };
  }

  function telaB2900(D, ctx) {
    const B = obj(D.b2900_regiao);
    if (!B) return null;
    const rec = lista(B.recortes).filter((r) => obj(r));
    const g0 = rec.find((r) => r.recorte === 'geral');
    const outros = rec.filter((r) => r !== g0 && numero(r.lavouras) != null);
    const grupos = [...new Set(outros.map((r) => r.recorte))];
    const meio = Math.ceil(grupos.length / 2);
    const tabela = (gs) => `<table class="cv-tab cv-tab-rc"><thead><tr><th>Recorte</th><th>Lavouras acima<br>da média conc.</th><th>Dif. contra<br>conc., sc/ha</th><th>Ganhou de<br>(híbridos)</th><th></th></tr></thead><tbody>${gs.map((gn) =>
      `<tr class="grp"><td colspan="5">${esc(gn)}</td></tr>` + outros.filter((r) => r.recorte === gn).map((r) =>
        `<tr><td>${esc(r.faixa || '')}</td><td>${mil(r.lav_acima_media_conc)} de ${mil(r.lavouras)}</td><td>${dec1(r.dif_media)}</td><td class="peq">${numero(r.vitorias) != null ? `${mil(r.vitorias)} de ${mil(r.confrontos)}` : ''}</td><td>${r.padrao === 'SIM' ? '<span class="cv-sinal">sinal</span>' : ''}</td></tr>`).join('')).join('')}</tbody></table>`;
    const sinais = outros.filter((r) => r.padrao === 'SIM').length;
    const G = obj(B.geral) || {};
    // a conclusão POR LAVOURA, como a HTML montou (a da carga fala em confrontos — João tirou essa métrica do destaque)
    const concl = g0 ? `Ficou acima da média dos concorrentes em ${mil(g0.lav_acima_media_conc)} de ${mil(g0.lavouras)} lavouras` +
      (numero(G.n ?? G.confrontos) != null ? `; comparado com ${mil(G.n ?? G.confrontos)} híbridos concorrentes nessas lavouras, ganhou de ${mil(G.vitorias)}` : '') +
      (numero(G.vantagem_sc_ha ?? G.dif_media) != null ? `, com ${dec1(G.vantagem_sc_ha ?? G.dif_media)} sc/ha em média contra eles` : '') + '.' +
      (outros.length ? (sinais ? ` Nenhum recorte mostra padrão firme: ${sinais === 1 ? 'o marcado' : `os ${sinais} marcados`} como “sinal” passa${sinais === 1 ? '' : 'm'} só na régua mínima e são amostras pequenas.` : ' Nenhum recorte mostra padrão firme.') : '')
      : (typeof B.conclusao === 'string' ? B.conclusao : '');
    if (!concl && !outros.length) return null;
    return {
      id: 'b2900', nav: 'B2900', tag: 'B2900PWU · ensaios da região', titulo: 'B2900PWU — resultado na região',
      sub: g0 ? `Acima da média dos concorrentes em ${mil(g0.lav_acima_media_conc)} de ${mil(g0.lavouras)} lavouras` : '',
      autoria: B.rotulo || B.fonte || '',
      corpo: `<div class="cv-grade cv-g-b29">${painel('Conclusão', `<p class="cv-txt">${esc(concl)}</p>`, 'cv-a-conc')}${outros.length ? `<div class="cv-fila2">${painel('', tabela(grupos.slice(0, meio)), 'cv-tabp')}${painel('', tabela(grupos.slice(meio)), 'cv-tabp')}</div>` : ''}</div>`,
      pe: sinais ? 'sinal = passa só na régua mínima (5+ confrontos, 3+ lavouras, 60 %+ de vitória): amostra pequena, sinal a acompanhar, não padrão firme' : '',
      fala: concl.split('. ')[0].replace(/\.$/, '') + '.',
    };
  }

  function telaPassos(D, ctx) {
    const rot = ctx.rot, C = cascataDe(D), tp = obj(D.totais_pedido) || {};
    const det = lista(D.encaminhado_detalhe).filter((c) => obj(c) && /plano/i.test(String(c.origem)) && !/fora do plano/i.test(String(c.origem)));
    const fora = det.length ? det : lista(D.plano_fora_da_lista).filter((c) => obj(c) && numero(c.plano) > 0);
    const nCli = new Set(fora.map((c) => c.cliente)).size;
    const plano = C.tt.plano, rec = C.tt.recompra_fora_plano ?? numero(tp.provavel), sem = C.tt.ainda_sem_ninguem;
    const pend = numero(C.T.pedido_pend);
    // os primeiros vêm dos números (o texto é o da HTML aprovada pelo João, na cascata nova); os outros são as ações da estratégia
    const passos = [];
    if (plano > 0) passos.push([`Registrar na lista de vendas da ${ctx.curta} o ${rot.plano.toLowerCase()}`, '', `${mil(plano)} sc${nCli ? ` · ${nCli} clientes` : ''}`]);
    const val = lista(D.validar_com_revenda).filter((c) => obj(c));
    if (val.length) passos.push([TITULO_VALIDAR.replace('26', ctx.ant), '', `${val.length} clientes`]);
    else if (rec > 0) passos.push([`Fechar ${ctx.dep} com os clientes de ${ctx.ant} que devem recomprar`, C.nova ? 'a parte que ainda não está no plano' : `volume estimado pelo que cada um comprou em ${ctx.ant}`, `${mil(rec)} sc`]);
    if (sem != null && sem > 0) {
      const porque = (C.frases[2] && /—\s*(.+?)\.?$/.exec(C.frases[2]) || [])[1] || '';
      passos.push([porque ? `${rot.ainda_sem_ninguem}: ${porque}` : rot.ainda_sem_ninguem, '', `${mil(sem)} sc`]);
    }
    if (sem != null && sem < 0) passos.push(['Falta semente', 'a venda passou do pedido', `${mil(-sem)} sc`]);
    if (pend > 0) passos.push(['Acompanhar o faturamento do pedido', D.pedido_data ? `pedido no sistema de ${dataBR(D.pedido_data)}` : '', `${mil(pend)} sc pendentes`]);
    for (const a of acoesDaEstrategia(D)) if (passos.length < 7 && !/volume em plano/i.test(a)) passos.push([a, '', '']);
    if (!passos.length) return null;
    const rows = passos.map((p, i) => painel('', `<div class="cv-passo"><b class="cv-bola">${i + 1}</b><div><p class="t1">${esc(p[0])}</p>${p[1] ? `<p class="t2">${esc(p[1])}</p>` : ''}</div>${p[2] ? chip(p[2]) : ''}</div>`, 'cv-pp')).join('');
    return {
      id: 'passos', nav: 'PRÓXIMOS PASSOS', tag: `Ação de venda ${ctx.dep}`, titulo: `Próximos passos com a ${ctx.curta}`, sub: '',
      corpo: `<div class="cv-grade cv-g-passos">${rows}</div>`, pe: '',
      fala: 'Próximos passos: ' + passos.slice(0, 3).map((p) => p[0].charAt(0).toLowerCase() + p[0].slice(1)).join('; ') + '.',
    };
  }

  // CLIENTES DE 26 PARA VALIDARMOS JUNTOS (05/out/2026, madrugada) — os clientes do ano passado que ainda
  // não compraram deixaram de ser descontados do pedido: viram uma lista para conferir COM a revenda (a
  // reunião é com ela e os clientes são dela). "Chance de repetir" fica em branco — é para preencher juntos.
  const TITULO_VALIDAR = 'Clientes de 26 para validarmos juntos';
  const campoDe = (c, ...ks) => { for (const k of ks) if (c[k] != null && c[k] !== '') return c[k]; return null; };
  function telaValidar(D, ctx) {
    const val = lista(D.validar_com_revenda).filter((c) => obj(c));
    if (!val.length) return null;
    // formato da carga (05/out, madrugada): nome_planilha (o nome que ela usa) / nome_notas (o das notas da revenda),
    // sc26_revenda + hib26_*, plano27 + hib_plano27, chance_de_repetir (em branco, para preencher juntos)
    const real = (t) => (t && !/^\(.*\)$/.test(String(t).trim()) ? String(t) : '');
    // "B2701PWU 23, B2900PWU 160" → só os híbridos (o volume já está ao lado)
    const soHib = (h) => [...new Set(String(h || '').match(/\b[A-Z]{1,3}\d{3,5}[A-Z0-9]*\b/g) || [])].join(', ');
    const vol = (v, hib) => (numero(v) > 0 ? `${mil(v)} sc${soHib(hib) ? `<em> ${esc(soHib(hib))}</em>` : ''}` : '—');
    const linhas = val.slice(0, 12).map((c) => {
      const nP = real(campoDe(c, 'nome_planilha', 'cliente', 'nome')), nN = real(campoDe(c, 'nome_notas'));
      const principal = nome(nP || nN);
      const outro = nP && nN && norm(nP) !== norm(nN) ? `<small class="cv-nn">nas notas: ${esc(nome(nN))}</small>` : '';
      const chance = campoDe(c, 'chance_de_repetir', 'chance_repetir', 'chance');
      return `<tr><td><b>${esc(principal)}</b>${outro}</td><td>${vol(campoDe(c, 'sc26_revenda', 'sc26_planilha', 'sc26_notas', 'sc26', 'comprou_26'), campoDe(c, 'hib26_planilha', 'hib26_notas'))}</td><td>${vol(campoDe(c, 'plano27', 'plano_27', 'plano'), campoDe(c, 'hib_plano27'))}</td><td class="cv-branco">${chance == null ? '' : esc(chance)}</td></tr>`;
    }).join('');
    const titulo = TITULO_VALIDAR.replace('26', ctx.ant);
    return {
      id: 'validar', nav: 'CLIENTES DE ' + ctx.ant, tag: `Recompra ${ctx.dep} · com a ${ctx.curta}`, titulo, sub: (ctx.textos.validar_com_revenda || ctx.textos.validar || ''),
      corpo: `<div class="cv-grade cv-g-ep">${painel('', `<table class="cv-tab cv-tab-g cv-tab-val"><thead><tr><th>Cliente</th><th>Comprou em ${esc(ctx.ant)}</th><th>Plano ${esc(ctx.dep)}</th><th>Chance de repetir</th></tr></thead><tbody>${linhas}</tbody></table>`, 'cv-tabp')}</div>`,
      pe: val.length > 12 ? `e mais ${val.length - 12} na lista` : '', fala: ctx.textos.validar_com_revenda || ctx.textos.validar || `${titulo}: ${val.length} ${val.length === 1 ? 'cliente' : 'clientes'}, na tela.`,
    };
  }

  // ---- A ESTIMATIVA DE VENDAS (08/out/2026) ---------------------------------------------------------
  // A carteira que vem da planilha "Estimativa de Vendas Brevant (SALES INPUT)" do representante
  // (_compartilhado/estimativa-brevant.ts): uma safra só, sem pedido do sistema. Os rótulos são os da
  // planilha — "Escoado" SIM / PLANO / NÃO e "Venda por" ERC / REVENDA —, sem traduzir.
  function telaEstimativa(D, ctx) {
    const E = obj(D.estimativa);
    if (!E || numero(E.total) == null) return null;
    const total = Number(E.total);
    const k = (rot, v, unid, cls = '') => painel(esc(rot), grande(v, unid, cls), 'cv-k4');
    const esc_ = lista(E.por_escoado).filter((e) => obj(e)).slice(0, 3);
    const kpis = k('Estimativa ' + (obj(D.safras) || {}).depois, mil(total), 'sc', 'lar') + k('Clientes', mil(E.clientes), '') +
      esc_.map((e) => k(`${(obj(D.rotulos) || {}).escoado || 'Escoado'}: ${e.situacao}`, mil(e.sc), `sc · ${pct(e.fracao)}`)).join('');
    const sits = lista(E.por_escoado).map((e) => e.situacao).slice(0, 3);
    const hibs = lista(E.por_hibrido).filter((h) => obj(h));
    const tabHib = `<table class="cv-tab"><thead><tr><th>Híbrido</th><th>Volume</th>${sits.map((s) => `<th>${esc(s)}</th>`).join('')}<th>Clientes</th></tr></thead><tbody>${
      hibs.map((h) => `<tr><td>${etiqueta(h.hibrido)}</td><td>${mil(h.sc)}</td>${sits.map((s) => `<td>${mil((obj(h.escoado) || {})[s] || 0)}</td>`).join('')}<td>${mil(h.clientes)}</td></tr>`).join('')
    }<tr class="tot"><td>Total</td><td>${mil(total)}</td>${sits.map((s) => `<td>${mil((lista(E.por_escoado).find((e) => e.situacao === s) || {}).sc || 0)}</td>`).join('')}<td>${mil(E.clientes)}</td></tr></tbody></table>`;
    const revs = lista(E.por_revenda).filter((r) => obj(r));
    let lado;
    if (revs.length) {
      lado = painel('Por revenda', `<table class="cv-tab"><thead><tr><th>Revenda</th><th>Volume</th>${sits.slice(0, 2).map((s) => `<th>${esc(s)}</th>`).join('')}<th>Clientes</th></tr></thead><tbody>${
        revs.map((r) => `<tr><td>${esc(r.revenda)}</td><td>${mil(r.sc)}</td>${sits.slice(0, 2).map((s) => `<td>${mil((obj(r.escoado) || {})[s] || 0)}</td>`).join('')}<td>${mil(r.clientes)}</td></tr>`).join('')
      }</tbody></table>`, 'cv-tabp');
    } else {
      const pr = obj(E.precos_agricultor);
      const venda = lista(E.por_venda).filter((v) => obj(v));
      lado = painel(`Venda por`, `<ul class="cv-lista">${venda.map((v) => `<li><b>${esc(v.venda_por)}</b><span>${mil(v.sc)} sc · ${mil(v.clientes)} ${v.clientes === 1 ? 'cliente' : 'clientes'}</span></li>`).join('')}</ul>` +
        (pr ? `<p class="cv-mudo">Preço ao agricultor (média ponderada): R$ ${esc(String(pr.media_ponderada).replace('.', ','))}/sc em ${mil(pr.sc_com_preco)} sc com preço</p>` : ''), 'cv-tabp');
    }
    return {
      id: 'estimativa', nav: 'ESTIMATIVA', tag: `Estimativa de vendas ${(obj(D.safras) || {}).depois || ''}`.trim(),
      titulo: revs.length ? `Estimativa de vendas${D.representante ? ' · ' + D.representante : ''}` : `Estimativa de vendas na ${ctx.curta}`,
      sub: D.atualizacao_planilha ? `Planilha atualizada em ${dataBR(D.atualizacao_planilha)}` : '',
      corpo: `<div class="cv-grade cv-g-ped"><div class="cv-fila5">${kpis}</div><div class="cv-fila2">${painel('Por híbrido', tabHib, 'cv-tabp')}${lado}</div></div>`,
      pe: D.arquivo ? `fonte: ${D.arquivo}` : '', fala: ctx.textos.estimativa || '',
    };
  }

  function telaClientes(D) {
    const cli = lista(D.clientes_para_ligar).filter((c) => obj(c));
    if (!cli.length) return null;
    return {
      id: 'clientes', nav: 'CLIENTES', tag: 'Uso interno · não mostrar à revenda', titulo: 'Clientes para ligar', sub: '',
      corpo: `<div class="cv-grade cv-g-passos">${cli.slice(0, 8).map((c) => painel('', `<div class="cv-passo"><b class="cv-nome">${esc(nome(c.cliente || c.nome))}</b><p class="t2">${esc(c.motivo || '')}</p></div>`, 'cv-pp')).join('')}</div>`,
      pe: '', fala: `${cli.length} ${cli.length === 1 ? 'cliente' : 'clientes'} para ligar, na tela.`,
    };
  }

  /** Os rótulos da carga (os antigos — saldo_fechado, plano_t_fora — viram os nomes novos). */
  function rotulosDe(D) {
    const r = obj(D.rotulos) || {};
    return Object.assign({}, ROTULOS, r.saldo_fechado ? { sem_cliente: r.saldo_fechado } : {}, r.plano_t_fora ? { plano: r.plano_t_fora } : {}, r);
  }

  /** A ordem da apresentação (a mesma da HTML da Mocellin). */
  const ORDEM = ['estimativa', 'crescimento', 'recompra', 'pedido', 'plano', 'validar', 'campo', 'epoca', 'estrategia', 'b2900', 'passos', 'clientes'];

  /**
   * O resultado de dados_carteira → { revenda, chave, telas: [{ id, nav, tag, titulo, sub, autoria, corpo, pe, fala }] }.
   * `foco` = a cidade do campo em destaque ("boa-esperanca", "nova-ubirata").
   */
  function montarApresentacao(r, foco) {
    const R = obj(r) || {};
    const D = obj(R.dados) || {};
    const revenda = String(R.revenda || D.revenda || '').trim();
    if (!revenda) return null;
    nPainel = 0;
    const s = obj(D.safras) || {};
    const nu = obj(D.numeros_detalhe) || (obj(D.numeros) ? D.numeros : {});
    // sem o detalhe, o volume ainda sai do primeiro número ("Sacos vendidos")
    if (numero(nu.sc26) == null) {
      const sv = lista(D.numeros).find((n) => obj(n) && /sacos|volume/i.test(String(n.rotulo)));
      if (sv) { nu.sc26 = sv.antes; nu.sc27 = sv.depois; }
    }
    const ctx = {
      nu, ant: safra(s.antes) || '26', dep: safra(s.depois) || '27',
      curta: revenda, textos: obj(D.textos) || {}, rot: rotulosDe(D),
    };
    const fazer = {
      estimativa: () => telaEstimativa(D, ctx),
      crescimento: () => telaCrescimento(D, ctx), recompra: () => telaRecompra(D, ctx), pedido: () => telaPedido(D, ctx, foco),
      plano: () => telaPlano(D, ctx), campo: () => telaCampo(D, ctx, foco), epoca: () => telaEpoca(D, ctx),
      estrategia: () => telaEstrategia(D, ctx), b2900: () => telaB2900(D, ctx), passos: () => telaPassos(D, ctx), clientes: () => telaClientes(D), validar: () => telaValidar(D, ctx),
    };
    const telas = [];
    for (const id of ORDEM) { let t = null; nPainel = 0; try { t = fazer[id](); } catch (e) { t = null; } if (t) telas.push(t); }
    if (!telas.length) return null;
    return { revenda, chave: String(R.revenda_chave || ''), representante: String(D.representante || ''), telas };
  }

  // ---- a parte que a fala pede (MESMA regra de parteCitada em carteira-revenda.ts — o portão compara) ----
  const CITA_B2900 = /\b(b ?2900|2900|dois mil e novecentos|b dois mil e novecentos|vinte e nove zero zero|b vinte e nove)\b/;
  function parteDaFala(texto) {
    const n = norm(texto);
    if (!n) return null;
    if (CITA_B2900.test(n)) return 'b2900';
    if (/\b(clientes? do ano passado|clientes? de 26|clientes? de 2026|validar\w*)\b/.test(n) && !/\b(ligar|ligo)\b/.test(n)) return 'validar';
    if (/\b(clientes? para ligar|clientes? pra ligar|quem (eu )?(ligo|ligar)|ligar para quem|pra quem ligar|para quem ligar)\b/.test(n)) return 'clientes';
    if (/\b(proximos? passos?|plano de acao|acao de venda|o que fazer agora)\b/.test(n)) return 'passos';
    if (/\b(por epoca|epocas?|data de plantio|datas de plantio|janela de plantio)\b/.test(n)) return 'epoca';
    if (/\bestrategi\w*/.test(n)) return 'estrategia';
    // chuva/clima é outra conversa (o bom dia fala da chuva da cidade dela)
    if (/\b(chuva|chover|choveu|previsao|clima|tempo)\b/.test(n)) return null;
    // a cidade no NOME da revenda ("Mocellin Boa Esperança") é a revenda, não o campo da cidade
    const semRevenda = n.replace(/\b(mocellin|revenda|filial|loja|unidade) (de )?(boa esperanca( do norte)?|nova ubirata|sorriso)\b/g, '$1');
    const local = /\b(campo|ensaios?|lavouras?|resultado|area|regiao)\b/.test(semRevenda) || semRevenda.split(' ').length <= 4;
    if (/\bnova ubirata\b/.test(semRevenda) && local) return 'campo-nova-ubirata';
    if (/\bboa esperanca\b/.test(semRevenda) && local) return 'campo-boa-esperanca';
    if (/\b(campo|ensaios?|resultado de campo|na regiao|da regiao|lavouras)\b/.test(n)) return 'campo';
    if (/\bestimativ\w*/.test(n)) return 'estimativa';
    if (/\b(sem ninguem|falta semente|faltando semente)\b/.test(n)) return 'sem-ninguem';
    if (/\b(volume em plano|em plano|plano 27|o plano|do plano|no plano|encaminhad\w*)\b/.test(n)) return 'plano';
    if (/\b(recompr\w*|compraram de novo|comprou de novo|clientes? novos?)\b/.test(n)) return 'recompra';
    if (/\b(pedidos?|vendido|sem cliente|por hibrido)\b/.test(n)) return 'pedido';
    if (/\b(crescimento|cresceu|crescemos|volume de vendas?|quanto (vendeu|vendemos|vendi))\b/.test(n)) return 'crescimento';
    return null;
  }
  /** "próximo", "volta", "fecha" — a navegação da apresentação aberta. */
  function navegacaoDaFala(texto) {
    const n = norm(texto);
    if (/^(e )?(a )?(proxim[ao]|seguinte|avanca|avancar|pode avancar|passa|pode passar|proxima tela|proximo slide|vai)( tela| slide)?$/.test(n)) return 'proxima';
    if (/^(e )?(a )?(anterior|tela anterior|slide anterior|volta uma|volta um|voltar uma|uma antes)$/.test(n)) return 'anterior';
    if (/^(fecha|fechar|fecha a apresentacao|fechar a apresentacao|encerra|encerrar|encerra a apresentacao|sair da apresentacao)$/.test(n)) return 'fechar';
    if (/^(do comeco|desde o comeco|volta ao comeco|volta pro comeco|primeira tela|comeca de novo)$/.test(n)) return 'comeco';
    return null;
  }

  /** A parte pedida → a tela e o destaque nela ("campo-nova-ubirata" → campo + Nova Ubiratã; "sem-ninguem" → pedido + o 3). */
  function alvoDaParte(parte) {
    const p = String(parte || '');
    if (!p) return null;
    const c = /^campo-(.+)$/.exec(p);
    if (c) return { tela: 'campo', foco: c[1] };
    if (p === 'sem-ninguem') return { tela: 'pedido', foco: 'sem-ninguem' };
    return { tela: p, foco: null };
  }

  raiz.CarteiraTelas = { alvoDaParte, montarApresentacao, parteDaFala, navegacaoDaFala, ORDEM, _fmt: { mil, dec1, pct, nome } };
})(typeof window !== 'undefined' ? window : globalThis);
