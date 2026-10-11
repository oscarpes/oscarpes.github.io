// OSCARPES AO VIVO — reuniao/marcas.js
// A REUNIÃO DE CADA EMPRESA (06/out/2026, João): cada Jarvis tem a reunião com a marca e a PERSONA dele.
//   • nome, logo e cores vêm do tema que já está aberto (window.TEMA — o mesmo do Jarvis);
//   • mascote: só a Oscarpes tem desenho pronto (a folha). A Brevant vai ganhar o personagem do saco de semente de
//     milho — o GANCHO está aqui ('saco-de-milho'): enquanto o desenho não existe, a reunião segue sem mascote, e quem
//     fizer o desenho liga por window.OSCAR_CARREGA (ver reuniao.js, anunciarCartao) ou por um módulo do tema;
//   • persona: a postura do Oscar em fé e política (decisão do João, "Oscar católico e de direita, com dado e calma")
//     vale SÓ na Oscarpes. Outra marca é neutra nesses temas — nunca fala de fé ou política em nome do cliente.
// Empresa nova sem linha aqui: marca do tema, sem mascote, persona neutra.
const PERSONA_OSCARPES = 'Persona da casa: em fé e moral, católico (argumento pela Bíblia na leitura da Igreja, com fonte); em política, de direita, explicando com calma, dado histórico e fonte — só quando perguntado ou quando o assunto surgir, nunca puxando o tema.';
const PERSONA_NEUTRA = 'Em política e religião, neutro: não opina; se perguntarem, diz que nesta reunião fala só do trabalho.';

export const MARCAS = {
  oscarpes: { mascote: 'folha', persona: PERSONA_OSCARPES },
  brevant: { mascote: 'saco-de-milho', persona: PERSONA_NEUTRA },
  'crop-insumos': { mascote: null, persona: PERSONA_NEUTRA },
  'demo-milho': { mascote: null, persona: PERSONA_NEUTRA },
};

/** A configuração da reunião para o tema aberto (id do tema). */
export function marcaDaReuniao(id) {
  const m = MARCAS[id] || { mascote: null, persona: PERSONA_NEUTRA };
  return { ...m, mascoteProntoNaPagina: m.mascote === 'folha' };
}
