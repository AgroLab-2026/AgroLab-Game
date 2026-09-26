// Desenho procedural das culturas nos 6 estágios (Semente → Colheita).
// Substitui os sprites de Crops/ e Sunnyside/ enquanto a arte final não chega.
import { criarRng, corDoente, elipse, ret, px, clarear, escurecer } from './Pixel.js';

/**
 * Desenha uma planta com a base em (x, y).
 * @param {object} visual  cores e forma da cultura (culturas.json → visual)
 * @param {number} estagio 0..5
 * @param {number} saude01 0..1 (abaixo de 1 a planta perde a cor)
 * @param {number} semente variação individual
 * @param {number} balanco deslocamento de vento, em pixels (−1..1)
 */
export function desenharPlanta(ctx, x, y, visual, estagio, saude01, semente = 1, balanco = 0) {
  const rng = criarRng(semente * 9301 + 49297);
  const cor = (hex) => corDoente(hex, saude01);
  const folha = cor(visual.folha);
  const folhaEsc = cor(visual.folhaEscura);
  const folhaClara = cor(clarear(visual.folha, 0.35));
  x = Math.round(x); y = Math.round(y);

  if (estagio <= 0) {
    // Semente: montinho de terra com a semente aparecendo.
    ret(ctx, x - 2, y - 1, 5, 1, '#5a3412');
    ret(ctx, x - 1, y - 2, 3, 1, '#7a4a1c');
    px(ctx, x, y - 2, '#d8c08a');
    return;
  }
  if (estagio === 1) {
    // Muda: caule curto e duas folhinhas.
    ret(ctx, x, y - 3, 1, 3, folhaEsc);
    ret(ctx, x - 2, y - 4, 2, 1, folhaClara);
    ret(ctx, x + 1, y - 4, 2, 1, folha);
    px(ctx, x - 2, y - 5, folhaClara);
    px(ctx, x + 2, y - 5, folha);
    return;
  }

  const b = Math.round(balanco);
  if (visual.forma === 'roseta') return alface(ctx, x, y, estagio, { folha, folhaEsc, folhaClara, cor, visual, rng, b });
  if (visual.forma === 'haste') return tomate(ctx, x, y, estagio, { folha, folhaEsc, folhaClara, cor, visual, rng, b });
  return morango(ctx, x, y, estagio, { folha, folhaEsc, folhaClara, cor, visual, rng, b });
}

function morango(ctx, x, y, estagio, { folha, folhaEsc, folhaClara, cor, visual, rng, b }) {
  const r = [0, 0, 4, 5, 6, 6][estagio];
  const alt = [0, 0, 6, 8, 10, 10][estagio];
  // Hastes.
  for (let i = -1; i <= 1; i++) ret(ctx, x + i * 2 + (i === 0 ? b : 0), y - alt + 2, 1, alt - 2, folhaEsc);
  // Trifólios: três bolotas de folha por haste.
  const centros = [[-r + 1, -alt + 2], [r - 1, -alt + 2], [0 + b, -alt], [-r + 2, -alt + 4], [r - 2, -alt + 4]];
  for (const [dx, dy] of centros) {
    elipse(ctx, x + dx, y + dy, 2, 1, folhaEsc);
    elipse(ctx, x + dx, y + dy - 1, 2, 1, folha);
    px(ctx, x + dx - 1, y + dy - 1, folhaClara);
  }
  if (estagio >= 3) {
    // Flores brancas com miolo amarelo.
    const n = estagio === 3 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const fx = x + Math.round((rng() - 0.5) * r * 2), fy = y - alt + Math.round(rng() * 3);
      px(ctx, fx - 1, fy, cor(visual.flor)); px(ctx, fx + 1, fy, cor(visual.flor));
      px(ctx, fx, fy - 1, cor(visual.flor)); px(ctx, fx, fy + 1, cor(visual.flor));
      px(ctx, fx, fy, cor('#f4c83a'));
    }
  }
  if (estagio >= 4) {
    // Morangos: verdes na frutificação, vermelhos na colheita.
    const fruto = estagio === 5 ? cor(visual.fruto) : cor('#b8d86a');
    const frutoEsc = estagio === 5 ? cor(visual.frutoEscuro) : cor('#7aa03a');
    const n = estagio === 5 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const fx = x - r + 1 + Math.round(rng() * (r * 2 - 2)), fy = y - 3 + Math.round(rng() * 2);
      ret(ctx, fx, fy, 2, 2, fruto);
      px(ctx, fx + 1, fy + 1, frutoEsc);
      px(ctx, fx, fy + 2, frutoEsc);
      px(ctx, fx, fy - 1, folhaEsc);
      if (estagio === 5) px(ctx, fx, fy, clarear(fruto, 0.4));
    }
  }
}

function alface(ctx, x, y, estagio, { folha, folhaEsc, folhaClara, rng, b }) {
  const r = [0, 0, 4, 5, 6, 7][estagio];
  const ry = Math.max(2, r - 2);
  elipse(ctx, x, y - ry, r, ry, folhaEsc);
  elipse(ctx, x, y - ry - 1, r - 1, ry - 1 < 1 ? 1 : ry - 1, folha);
  // Bordas crespas: pixels claros e escuros alternados no contorno.
  for (let a = 0; a < 14; a++) {
    const ang = (a / 14) * Math.PI * 2;
    const fx = x + Math.round(Math.cos(ang) * r), fy = y - ry + Math.round(Math.sin(ang) * ry) - 1;
    px(ctx, fx, fy, a % 2 ? folhaClara : folhaEsc);
  }
  // Miolo mais claro e folhas internas.
  elipse(ctx, x + b, y - ry - 1, Math.max(1, r - 3), Math.max(1, ry - 2), folhaClara);
  if (estagio >= 3) {
    for (let i = 0; i < 3; i++) {
      const fx = x - r + 2 + Math.round(rng() * (r * 2 - 4));
      px(ctx, fx, y - ry - 1 - Math.round(rng() * ry), escurecer(folha, 0.1));
    }
  }
  if (estagio >= 5) px(ctx, x, y - ry - 2, clarear(folhaClara, 0.3));
}

function tomate(ctx, x, y, estagio, { folha, folhaEsc, folhaClara, cor, visual, rng, b }) {
  const alt = [0, 0, 9, 13, 17, 19][estagio];
  if (estagio >= 3) {
    // Tutor de bambu.
    ret(ctx, x + 3, y - alt - 1, 1, alt + 1, '#b8904a');
    px(ctx, x + 3, y - alt - 2, '#8a6a32');
  }
  // Caule com leve curva do vento.
  for (let i = 0; i < alt; i++) px(ctx, x + (i > alt / 2 ? b : 0), y - i, folhaEsc);
  // Pares de folhas alternados.
  for (let i = 2; i < alt; i += 3) {
    const lado = (i / 3) % 2 ? 1 : -1;
    const lx = x + (i > alt / 2 ? b : 0);
    elipse(ctx, lx + lado * 3, y - i, 2, 1, folhaEsc);
    ret(ctx, lx + lado * 2, y - i - 1, 3, 1, folha);
    px(ctx, lx + lado * 3, y - i - 1, folhaClara);
    elipse(ctx, lx - lado * 2, y - i + 1, 1, 1, folha);
  }
  elipse(ctx, x + b, y - alt, 2, 1, folha);
  if (estagio === 3) {
    for (let i = 0; i < 3; i++) {
      const fx = x - 2 + Math.round(rng() * 4), fy = y - alt + 2 + Math.round(rng() * (alt - 6));
      px(ctx, fx, fy, cor(visual.flor)); px(ctx, fx + 1, fy, cor(visual.flor));
    }
  }
  if (estagio >= 4) {
    const fruto = estagio === 5 ? cor(visual.fruto) : cor('#8fc04a');
    const frutoEsc = estagio === 5 ? cor(visual.frutoEscuro) : cor('#5a8a2a');
    const n = estagio === 5 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const lado = i % 2 ? 1 : -1;
      const fx = x + lado * (2 + Math.round(rng())), fy = y - 4 - i * 3;
      elipse(ctx, fx, fy, 1, 1, fruto);
      px(ctx, fx + 1, fy + 1, frutoEsc);
      px(ctx, fx - 1, fy - 1, clarear(fruto, 0.45));
    }
  }
}
