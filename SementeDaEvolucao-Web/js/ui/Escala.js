// Ajusta o palco (1024×682) à janela. O mundo é desenhado em 512×341 e deve
// sempre ocupar um número INTEIRO de pixels físicos por pixel de arte.
export const PALCO_L = 1024;
export const PALCO_A = 682;
const MUNDO_L = 512;
const MUNDO_A = 341;

export function ajustarEscala(palco) {
  const dpr = window.devicePixelRatio || 1;
  const larguraFis = window.innerWidth * dpr;
  const alturaFis = window.innerHeight * dpr;
  // k = pixels físicos por pixel de arte (inteiro, no mínimo 1).
  let k = Math.floor(Math.min(larguraFis / MUNDO_L, alturaFis / MUNDO_A));
  if (k < 1) k = 1;
  // Escala CSS do palco: 1024 px CSS do palco = 512·k px físicos.
  let s = (MUNDO_L * k) / (PALCO_L * dpr);
  // Janela menor que 512×341 físicos: aceita escala fracionária para caber.
  if (MUNDO_L * k > larguraFis || MUNDO_A * k > alturaFis) {
    s = Math.min(window.innerWidth / PALCO_L, window.innerHeight / PALCO_A);
  }
  const l = PALCO_L * s, a = PALCO_A * s;
  palco.style.transform = `scale(${s})`;
  palco.style.left = `${Math.floor((window.innerWidth - l) / 2)}px`;
  palco.style.top = `${Math.floor((window.innerHeight - a) / 2)}px`;
  return { escala: s, k, dpr };
}
