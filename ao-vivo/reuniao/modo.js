// OSCARPES AO VIVO — reuniao/modo.js
// A REUNIÃO COMO MODO DO JARVIS (06/out/2026). Carregado SÓ quando alguém abre uma reunião (js/porta-reuniao.js faz o
// import() — nada daqui entra na carga normal do Jarvis). Monta a reunião numa SOMBRA (shadow DOM) por cima da cena
// do Jarvis: a mesma tela vira a sala (câmeras embaixo, cartões de vidro, resumo no canto, mascote), com a marca e as
// cores do tema aberto (Oscarpes, Brevant, Crop…). O estilo passa pela MESMA troca de cores do tema (window.TEMA_TROCA).
//   abrirReuniao({ papel: 'anfitriao', convidar: ['Ararê'], ponte })   — João pediu por voz (ou ?reuniao=1)
//   abrirReuniao({ papel: 'convidado', codigo, ponte })                  — link do convite (?entrar=<código>)
import { MARCACAO } from './marcacao.js?v=20261010213811';

let aberta = null;      // a promessa da reunião montada (abrir duas vezes devolve a mesma)

// o que some do Jarvis enquanto a reunião está na tela (só existe com a reunião carregada)
const ESTILO_DO_JARVIS = `
html.em-reuniao .topo,html.em-reuniao .controles,html.em-reuniao #legenda,html.em-reuniao #estado,html.em-reuniao #abertura,html.em-reuniao #aviso{display:none!important}
html.em-reuniao #esfera{opacity:.22;pointer-events:none;transition:opacity .8s}
html.em-reuniao #paineis{z-index:32}
html.em-reuniao #visor{z-index:40}`;

export function abrirReuniao(opcoes = {}) {
  if (aberta) return aberta.then((r) => { if (opcoes.papel === 'anfitriao' && r.convidarMais) r.convidarMais(opcoes.convidar || []); return r; });
  aberta = montar(opcoes).catch((e) => { aberta = null; throw e; });
  return aberta;
}

async function montar(opcoes) {
  if (!document.getElementById('estilo-reuniao-jarvis')) {
    const st = document.createElement('style'); st.id = 'estilo-reuniao-jarvis'; st.textContent = ESTILO_DO_JARVIS; document.head.appendChild(st);
  }
  const hospede = document.createElement('div');
  hospede.id = 'reuniaoModo';
  document.body.appendChild(hospede);
  const raiz = hospede.attachShadow({ mode: 'open' });
  let css = await (await fetch(new URL('./reuniao.css?v=20261010213811', import.meta.url))).text();
  // as cores da reunião são as da Oscarpes; o tema troca pelas dele (a mesma tabela do Jarvis, ver index.html)
  if (typeof window.TEMA_TROCA === 'function') css = window.TEMA_TROCA(css);
  raiz.innerHTML = `<style>${css}</style>${MARCACAO}`;
  // o que o JS desenha depois dentro da sombra também passa pela troca (o observador do Jarvis não entra na sombra)
  if (typeof window.TEMA_TROCA === 'function' && 'MutationObserver' in window) {
    const troca = window.TEMA_TROCA, ATR = ['style', 'fill', 'stroke', 'stop-color', 'color'];
    const repintar = (el) => { for (const a of ATR) { const v = el.getAttribute && el.getAttribute(a); if (v) { const n = troca(v); if (n !== v) el.setAttribute(a, n); } } };
    new MutationObserver((l) => { for (const r of l) { if (r.type === 'attributes') repintar(r.target); else r.addedNodes.forEach((no) => { if (no.nodeType === 1) { repintar(no); no.querySelectorAll && no.querySelectorAll('[style],[fill],[stroke]').forEach(repintar); } }); } })
      .observe(raiz, { subtree: true, childList: true, attributes: true, attributeFilter: ATR });
  }
  window.__REUNIAO_RAIZ = raiz;
  const r = await import('./reuniao.js?v=20261010213811');
  await r.iniciar({ ...opcoes, raiz, hospede });
  return r;
}
