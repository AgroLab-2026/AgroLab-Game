// Ajusta o palco (1024×682) à janela. O mundo é desenhado em 512×341 e, sempre que possível,
// ocupa um número INTEIRO de pixels físicos por pixel de arte.
// Com o terminal da IA visível, ele fica à direita do palco, como um monitor pequeno (TerminalIA.js):
// estreito, mais baixo que o jogo e alinhado à parte de baixo do palco.
export const PALCO_L = 1024;
export const PALCO_A = 682;
const MUNDO_L = 512;
const MUNDO_A = 341;
const TERMINAL_MIN = 200;     // px CSS
const TERMINAL_MAX = 250;
const TERMINAL_ALTURA = 0.6;  // fração da altura do palco
const ESPACO = 8;             // entre o palco e o terminal

/** Escala CSS do palco para caber em largura × altura (px CSS). */
function escalaPara(largura, altura, dpr) {
  const encaixe = Math.min(largura / PALCO_L, altura / PALCO_A);
  // k = pixels físicos por pixel de arte (inteiro, no mínimo 1).
  const k = Math.max(1, Math.floor(Math.min((largura * dpr) / MUNDO_L, (altura * dpr) / MUNDO_A)));
  const inteira = (MUNDO_L * k) / (PALCO_L * dpr);
  // Escala inteira que não cabe, ou que deixaria o jogo muito menor que a tela: usa a fracionária.
  if (inteira > encaixe || inteira < encaixe * 0.85) return { s: encaixe, k };
  return { s: inteira, k };
}

/**
 * @param {HTMLElement} palco
 * @param {HTMLElement|null} terminal barra lateral da IA (null ou hidden = sem reserva)
 */
export function ajustarEscala(palco, terminal = null) {
  const dpr = window.devicePixelRatio || 1;
  const L = window.innerWidth, A = window.innerHeight;
  const comTerminal = terminal && !terminal.hidden;
  const { s, k } = escalaPara(comTerminal ? L - TERMINAL_MIN - ESPACO : L, A, dpr);
  const l = PALCO_L * s, a = PALCO_A * s;
  const topo = Math.floor((A - a) / 2);
  let esquerda = Math.floor((L - l) / 2);
  if (comTerminal) {
    // Palco + terminal centralizados juntos na tela.
    const larguraTerminal = Math.floor(Math.min(TERMINAL_MAX, Math.max(TERMINAL_MIN, L - l - ESPACO)));
    esquerda = Math.max(0, Math.floor((L - l - ESPACO - larguraTerminal) / 2));
    const altura = Math.floor(Math.min(A, a * TERMINAL_ALTURA));
    Object.assign(terminal.style, {
      width: `${larguraTerminal}px`,
      height: `${altura}px`,
      left: `${Math.min(L - larguraTerminal, esquerda + l + ESPACO)}px`,
      top: `${Math.max(0, topo + a - altura)}px`,
    });
  }
  palco.style.transform = `scale(${s})`;
  palco.style.left = `${esquerda}px`;
  palco.style.top = `${topo}px`;
  return { escala: s, k, dpr };
}
