// Ajusta o palco (1024×682) à janela. O mundo é desenhado em 512×341 e, sempre que possível,
// ocupa um número INTEIRO de pixels físicos por pixel de arte.
// Com o terminal da IA visível, a faixa da direita fica para ele (TerminalIA.js).
export const PALCO_L = 1024;
export const PALCO_A = 682;
const MUNDO_L = 512;
const MUNDO_A = 341;
const TERMINAL_MIN = 250; // px CSS
const TERMINAL_MAX = 440;

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
  const { s, k } = escalaPara(comTerminal ? L - TERMINAL_MIN : L, A, dpr);
  const l = PALCO_L * s, a = PALCO_A * s;
  let larguraTerminal = 0;
  if (comTerminal) {
    larguraTerminal = Math.floor(Math.min(TERMINAL_MAX, Math.max(TERMINAL_MIN, L - l)));
    terminal.style.width = `${larguraTerminal}px`;
  }
  palco.style.transform = `scale(${s})`;
  palco.style.left = `${Math.floor((L - larguraTerminal - l) / 2)}px`;
  palco.style.top = `${Math.floor((A - a) / 2)}px`;
  return { escala: s, k, dpr };
}
