// Molduras de madeira em pixel art, geradas por código e aplicadas no HUD via
// CSS `border-image` (9-slice). Substituem wood_frame.png / wood_frame_btn.png.
import { criarCanvas, criarRng, misturar } from './Pixel.js';

/**
 * Gera uma moldura quadrada S×S com borda de B pixels.
 * `camadas[d]` é a cor na distância d da borda externa (0 = mais externa).
 */
function gerarMoldura({ S = 12, camadas, pino = null, veio = 0.18, semente = 7 }) {
  const B = camadas.length;
  const cv = criarCanvas(S, S);
  const c = cv.getContext('2d');
  const rng = criarRng(semente);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.min(x, y, S - 1 - x, S - 1 - y);
      if (d >= B) continue;
      let cor = camadas[d];
      // Veio da madeira: variações discretas nas camadas do meio.
      if (d > 0 && d < B - 1 && rng() < veio) cor = misturar(cor, '#2a1406', 0.25);
      else if (d > 0 && d < B - 1 && rng() < veio * 0.5) cor = misturar(cor, '#ffd9a0', 0.18);
      c.fillStyle = cor;
      c.fillRect(x, y, 1, 1);
    }
  }
  if (pino) {
    // Pinos dourados nos cantos (como na referência).
    for (const [px0, py0] of [[1, 1], [S - 3, 1], [1, S - 3], [S - 3, S - 3]]) {
      c.fillStyle = pino[0]; c.fillRect(px0, py0, 2, 2);
      c.fillStyle = pino[1]; c.fillRect(px0, py0, 1, 1);
    }
  }
  return cv;
}

export const MOLDURAS = {
  madeira: () => gerarMoldura({
    S: 12,
    camadas: ['#2e1606', '#d27a30', '#a4531b', '#5a2c0e'],
    pino: ['#b8862a', '#f6d77a'],
  }),
  madeiraClara: () => gerarMoldura({
    S: 12,
    camadas: ['#2e1606', '#e39a4a', '#b8651f', '#6a3610'],
    pino: ['#b8862a', '#f6d77a'],
    semente: 11,
  }),
  lousa: () => gerarMoldura({
    S: 9,
    camadas: ['#1c1206', '#8a6432', '#5c4020'],
    veio: 0.1,
    semente: 3,
  }),
  escura: () => gerarMoldura({
    S: 12,
    camadas: ['#1c0e04', '#b8651f', '#7a3e12', '#2a1606'],
    pino: ['#b8862a', '#f6d77a'],
    semente: 5,
  }),
};

/** Registra as molduras como variáveis CSS (--moldura-madeira etc.). */
export function registrarMolduras(raiz = document.documentElement) {
  for (const [nome, gerar] of Object.entries(MOLDURAS)) {
    raiz.style.setProperty(`--moldura-${nome}`, `url(${gerar().toDataURL()})`);
  }
}
