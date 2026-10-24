// Desenho procedural das culturas nos 6 estágios (Semente → Colheita): alface crespa (roseta),
// morango (moita) e tomate (haste). Pixel art com 3 tons por folha, contorno escuro, brilho e
// sombra no chão. A saúde desbota as cores (corDoente) e, abaixo de 50 %, aparecem folhas
// queimadas e a planta murcha um pouco.
import { criarRng, corDoente, elipse, ret, px, clarear, escurecer, misturar } from './Pixel.js';

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
  const t = {
    folha: cor(visual.folha),
    esc: cor(visual.folhaEscura),
    contorno: cor(escurecer(visual.folhaEscura, 0.35)),
    clara: cor(clarear(visual.folha, 0.35)),
    brilho: cor(clarear(visual.folha, 0.6)),
  };
  x = Math.round(x); y = Math.round(y);

  if (estagio <= 0) {
    // Semente: montinho de terra com a semente aparecendo.
    ret(ctx, x - 2, y - 1, 5, 1, '#4a2a0e');
    ret(ctx, x - 1, y - 2, 3, 1, '#7a4a1c');
    px(ctx, x, y - 2, '#e8d098');
    px(ctx, x + 1, y - 2, '#b89a60');
    return;
  }

  sombraChao(ctx, x, y, [0, 2, 4, 5, 6, 7][estagio]);
  const b = Math.round(balanco);
  const murcha = saude01 < 0.5 ? 1 : 0; // a planta "cai" um pixel quando está mal
  const args = { t, cor, visual, rng, b, murcha, saude01 };
  if (visual.forma === 'roseta') alface(ctx, x, y, estagio, args);
  else if (visual.forma === 'haste') tomate(ctx, x, y, estagio, args);
  else morango(ctx, x, y, estagio, args);
  if (saude01 < 0.5) manchas(ctx, x, y, estagio, rng, saude01);
}

function sombraChao(ctx, x, y, r) {
  ctx.globalAlpha = 0.28;
  elipse(ctx, x, y, r, 1, '#1a0e04');
  ctx.globalAlpha = 1;
}

/** Folhas queimadas/amareladas quando a planta está doente. */
function manchas(ctx, x, y, estagio, rng, saude01) {
  const n = Math.round((0.5 - saude01) * 10) + 1;
  const alt = [0, 3, 6, 8, 10, 11][estagio];
  for (let i = 0; i < n; i++) {
    px(ctx, x - 4 + Math.round(rng() * 8), y - 1 - Math.round(rng() * alt), i % 2 ? '#8a5a1a' : '#b8902a');
  }
}

// ------------------------------------------------------------------ alface crespa
function alface(ctx, x, y, estagio, { t, rng, b, murcha }) {
  if (estagio === 1) {
    // Muda: dois cotilédones redondos.
    ret(ctx, x, y - 2, 1, 2, t.esc);
    elipse(ctx, x - 2, y - 3, 1, 1, t.folha); px(ctx, x - 2, y - 4, t.clara);
    elipse(ctx, x + 2, y - 3, 1, 1, t.folha); px(ctx, x + 2, y - 4, t.clara);
    return;
  }
  const r = [0, 0, 3, 4, 5, 6][estagio];
  const ry = Math.max(2, Math.round(r * 0.7));
  const cy = y - ry - 1 + murcha;
  const coracao = '#e4f6a0';
  // Anel externo: folhas grandes e onduladas, com contorno escuro (vista 3/4, achatada).
  const n = 5 + estagio;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const lx = x + Math.round(Math.cos(a) * (r - 1)), ly = cy + Math.round(Math.sin(a) * (ry - 1) * 0.85);
    elipse(ctx, lx, ly + 1, 2, 2, t.contorno);
    elipse(ctx, lx, ly, 2, 1, t.esc);
    px(ctx, lx, ly - 1, t.folha);
    // Babado da alface crespa: pontinhas claras na borda de cada folha.
    px(ctx, lx + Math.round(Math.cos(a) * 2), ly + Math.round(Math.sin(a)) - 1, t.clara);
  }
  // Anel do meio: folhas mais claras, sobrepostas.
  const m = Math.max(3, estagio + 1);
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2 + 0.9;
    const lx = x + Math.round(Math.cos(a) * (r - 3)) + b, ly = cy - 1 + Math.round(Math.sin(a) * (ry - 2) * 0.7);
    elipse(ctx, lx, ly, 2, 1, t.folha);
    px(ctx, lx - 1, ly - 1, t.clara);
    px(ctx, lx + 1, ly, t.esc);
  }
  // Coração: folhinhas novas, verde-amareladas.
  elipse(ctx, x + b, cy - 2, Math.max(1, r - 4), 1, t.clara);
  px(ctx, x + b, cy - 2, coracao);
  if (estagio >= 4) { px(ctx, x - 1 + b, cy - 2, coracao); px(ctx, x + 1 + b, cy - 3, t.brilho); }
  // Nervuras claras saindo do centro.
  if (estagio >= 3) {
    for (const s of [-1, 1]) {
      px(ctx, x + s * (r - 2), cy, t.brilho);
      px(ctx, x + s * (r - 3), cy - 1, t.clara);
    }
  }
  if (estagio === 5) {
    // Pé pronto para colher: cabeça cheia, borda bem crespa.
    for (const s of [-1, 1]) { px(ctx, x + s * r, cy - 1, t.clara); px(ctx, x + s * (r + 1), cy, t.esc); }
  }
}

// ------------------------------------------------------------------ morango
function morango(ctx, x, y, estagio, { t, cor, visual, rng, b, murcha }) {
  if (estagio === 1) {
    // Muda: um trifólio pequeno.
    ret(ctx, x, y - 3, 1, 3, t.esc);
    trifolio(ctx, x, y - 4, t, 1);
    return;
  }
  const r = [0, 0, 3, 4, 5, 5][estagio];
  const alt = [0, 0, 4, 6, 7, 7][estagio] - murcha;
  // Pecíolos e trifólios em leque.
  const folhas = [[-r + 1, -alt + 2], [r - 1, -alt + 2], [b, -alt], [-r + 3, -alt + 4], [r - 3, -alt + 4]]
    .slice(0, estagio === 2 ? 3 : 5);
  for (const [dx, dy] of folhas) {
    linhaV(ctx, x, y - 1, x + dx, y + dy + 1, t.esc);
  }
  for (const [dx, dy] of folhas) trifolio(ctx, x + dx, y + dy, t, 1);

  if (estagio >= 3) {
    // Flores brancas de 5 pétalas com miolo amarelo.
    const n = estagio === 3 ? 3 : estagio === 4 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const fx = x + Math.round((rng() - 0.5) * r * 1.6), fy = y - alt + 1 + Math.round(rng() * 3);
      flor(ctx, fx, fy, cor(visual.flor), cor('#f4c83a'));
    }
  }
  if (estagio >= 4) {
    // Morangos pendurados pela frente e nas laterais: na frutificação alguns ainda
    // verdes/rosados; na colheita todos vermelhos.
    // Os frutos pendem para fora da moita, perto do chão, onde aparecem bem.
    const pos = [[-r - 2, -1], [r, 0], [-1, 1], [3, -3]].slice(0, estagio === 5 ? 4 : 3);
    pos.forEach(([dx, dy], i) => {
      const maturacao = estagio === 5 ? 2 : [0, 1, 2][i];
      linhaV(ctx, x, y - 4, x + dx + 1, y + dy - 2, t.esc);
      frutoMorango(ctx, x + dx + (i === 2 ? b : 0), y + dy, maturacao, cor);
    });
  }
}

/** Folha de morango: três folíolos serrilhados com nervura central. */
function trifolio(ctx, cx, cy, t, tam) {
  const f = [[-tam - 1, 0], [tam + 1, 0], [0, -tam - 1]];
  for (const [dx, dy] of f) {
    elipse(ctx, cx + dx, cy + dy + 1, tam + 1, tam, t.contorno);
    elipse(ctx, cx + dx, cy + dy, tam + 1, tam, t.esc);
    elipse(ctx, cx + dx, cy + dy - (tam > 1 ? 1 : 0), tam, Math.max(1, tam - 1), t.folha);
    px(ctx, cx + dx, cy + dy, t.clara);
    // Serrilhado: pontinhas escuras na borda externa.
    px(ctx, cx + dx * 2 - Math.sign(dx), cy + dy * 2 - Math.sign(dy) - (dy ? 0 : 1), t.contorno);
  }
  px(ctx, cx, cy, t.esc);
}

/** Morango em "coração": cálice verde, corpo vermelho com sementinhas, brilho e ponta. */
function frutoMorango(ctx, fx, fy, maturacao, cor) {
  const corpo = cor(['#b8d86a', '#f49090', '#e0262a'][maturacao]);
  const sombra = cor(['#7aa03a', '#c85a5a', '#8e1418'][maturacao]);
  const brilho = cor(['#e8f8b0', '#ffd0d0', '#ff8a7a'][maturacao]);
  const semente = cor(maturacao === 2 ? '#f6e070' : '#e8f0c0');
  // Cálice em estrela.
  px(ctx, fx - 1, fy - 1, cor('#2f7a2a')); px(ctx, fx + 3, fy - 1, cor('#2f7a2a'));
  ret(ctx, fx, fy - 1, 3, 1, cor('#3f9a34')); px(ctx, fx + 1, fy - 2, cor('#5fbe48'));
  // Corpo: 4 × 3, afinando na ponta.
  ret(ctx, fx - 1, fy, 5, 1, sombra);
  ret(ctx, fx - 1, fy, 4, 1, corpo);
  ret(ctx, fx - 1, fy + 1, 5, 1, corpo);
  ret(ctx, fx, fy + 2, 3, 1, corpo);
  px(ctx, fx + 3, fy + 1, sombra); px(ctx, fx + 2, fy + 2, sombra);
  px(ctx, fx + 1, fy + 3, sombra);
  px(ctx, fx - 1, fy, brilho); px(ctx, fx, fy, brilho);
  px(ctx, fx + 1, fy + 1, semente); px(ctx, fx + 2, fy, semente); px(ctx, fx, fy + 2, semente);
}

// ------------------------------------------------------------------ tomate
function tomate(ctx, x, y, estagio, { t, cor, visual, rng, b, murcha }) {
  const caule = cor(misturar(visual.folhaEscura, '#6a5a1a', 0.3));
  if (estagio === 1) {
    // Muda: caulinho e dois cotilédones compridos.
    ret(ctx, x, y - 3, 1, 3, caule);
    ret(ctx, x - 3, y - 4, 3, 1, t.folha); px(ctx, x - 3, y - 5, t.clara);
    ret(ctx, x + 1, y - 4, 3, 1, t.folha); px(ctx, x + 3, y - 5, t.clara);
    return;
  }
  const alt = [0, 0, 9, 13, 16, 18][estagio] - murcha * 2;
  if (estagio >= 3) {
    // Tutor de bambu com nós e amarrilho.
    ret(ctx, x + 3, y - alt - 1, 1, alt + 1, '#c8a058');
    ret(ctx, x + 4, y - alt - 1, 1, alt + 1, '#9a7a3a');
    for (let i = 4; i < alt; i += 6) px(ctx, x + 3, y - i, '#8a6a2a');
    px(ctx, x + 2, y - Math.round(alt * 0.6), '#e8d8a0');
  }
  // Caule com leve curva do vento.
  const cx = (i) => x + (i > alt / 2 ? b : 0);
  for (let i = 0; i < alt; i++) px(ctx, cx(i), y - i, caule);
  // Folhas compostas alternadas: pecíolo + folíolos recortados (deixam o caule à vista).
  for (let i = 3, k = 0; i < alt - 1; i += 3, k++) {
    const lado = k % 2 ? 1 : -1;
    const lx = cx(i), ly = y - i;
    px(ctx, lx + lado, ly, caule); px(ctx, lx + lado * 2, ly - 1, caule);
    foliolo(ctx, lx + lado * 3, ly - 2, t);
    foliolo(ctx, lx + lado * 5, ly - 1, t);
    foliolo(ctx, lx + lado * 2, ly + 1, t, true);
  }
  // Ponteiro: tufo de folhas novas, mais claras.
  elipse(ctx, cx(alt), y - alt, 2, 1, t.esc);
  elipse(ctx, cx(alt), y - alt - 1, 2, 1, t.folha);
  px(ctx, cx(alt) - 1, y - alt - 2, t.brilho); px(ctx, cx(alt) + 1, y - alt - 2, t.clara);

  if (estagio === 3 || estagio === 4) {
    // Flores amarelas em estrela, em cachinhos.
    const n = estagio === 3 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const fx = x - 3 + Math.round(rng() * 6), fy = y - 5 - Math.round(rng() * (alt - 8));
      estrela(ctx, fx, fy, cor(visual.flor), cor('#c89a1a'));
    }
  }
  if (estagio >= 4) {
    // Pencas de tomates redondos: verdes → laranja → vermelhos.
    const pencas = [[-4, 4], [4, 8], [-3, 12]];
    pencas.forEach(([dx, dy], i) => {
      if (dy > alt - 3) return;
      const m = estagio === 5 ? 2 : [0, 1, 0][i];
      frutoTomate(ctx, cx(dy) + dx, y - dy, m, cor);
      if (i < 2) frutoTomate(ctx, cx(dy) + dx + (dx < 0 ? -2 : 2), y - dy + 3, estagio === 5 ? 2 : 1, cor);
    });
  }
}

function foliolo(ctx, fx, fy, t, escuro = false) {
  elipse(ctx, fx, fy + 1, 1, 1, t.contorno);
  elipse(ctx, fx, fy, 1, 1, escuro ? t.esc : t.folha);
  px(ctx, fx, fy - 1, escuro ? t.folha : t.clara);
}

/** Tomate: bola com brilho, sombra embaixo e cálice verde em estrela. */
function frutoTomate(ctx, fx, fy, maturacao, cor) {
  const corpo = cor(['#8fc04a', '#f0962a', '#e0302a'][maturacao]);
  const sombra = cor(['#5a8a2a', '#b8601a', '#8e1a12'][maturacao]);
  const brilho = cor(['#d0f0a0', '#ffd890', '#ffb0a0'][maturacao]);
  elipse(ctx, fx, fy, 2, 2, sombra);
  elipse(ctx, fx - 1, fy - 1, 1, 1, corpo);
  ret(ctx, fx - 2, fy - 1, 4, 2, corpo);
  px(ctx, fx - 1, fy - 1, brilho); px(ctx, fx - 2, fy, brilho);
  const verde = cor('#2f7a2a');
  px(ctx, fx, fy - 2, verde); px(ctx, fx - 1, fy - 2, verde); px(ctx, fx + 1, fy - 2, verde); px(ctx, fx, fy - 3, cor('#5fbe48'));
}

// ------------------------------------------------------------------ peças comuns
function flor(ctx, fx, fy, petala, miolo) {
  px(ctx, fx - 1, fy, petala); px(ctx, fx + 1, fy, petala);
  px(ctx, fx, fy - 1, petala); px(ctx, fx - 1, fy + 1, petala); px(ctx, fx + 1, fy + 1, petala);
  px(ctx, fx, fy, miolo);
}

function estrela(ctx, fx, fy, petala, miolo) {
  px(ctx, fx, fy - 1, petala); px(ctx, fx - 1, fy, petala); px(ctx, fx + 1, fy, petala); px(ctx, fx, fy + 1, petala);
  px(ctx, fx, fy, miolo);
}

/** Linha de 1 px (pecíolos e cabinhos). */
function linhaV(ctx, x0, y0, x1, y1, corLinha) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i++) px(ctx, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), corLinha);
}
