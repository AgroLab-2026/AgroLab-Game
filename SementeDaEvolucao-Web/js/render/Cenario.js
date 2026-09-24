// Cenário estático da estufa (desenhado uma vez num canvas 512×341).
// Metade esquerda: estufa rústica do fazendeiro. Metade direita: estufa autônoma.
// Substitui Tiles/ e Greenhouse/ (arte protegida, que não entra no projeto).
import { criarCanvas, criarRng, ret, px, elipse, linha, misturar, clarear, escurecer } from './Pixel.js';

export const LARGURA = 512;
export const ALTURA = 341;

/** Posições usadas pelo desenho dinâmico (plantas, personagens, efeitos). */
export const LAYOUT = {
  estufa: { x0: 92, x1: 396, y0: 0, y1: 252 },
  divisoria: 255,
  canteiro: { x0: 152, y0: 70, x1: 252, y1: 216 },
  plantasJogador: (() => {
    const pos = [];
    const cols = [168, 190, 212, 236];
    const linhas = [92, 110, 128, 146, 164, 182, 200];
    linhas.forEach((y, i) => cols.forEach((x, j) => {
      if (j === 2 && i % 2 === 1) return; // coluna do meio intercala com aspersores
      pos.push({ x, y });
    }));
    return pos;
  })(),
  aspersores: [{ x: 212, y: 110 }, { x: 212, y: 146 }, { x: 212, y: 182 }],
  fazendeiro: { x: 236, y: 156 },
  prateleiras: [102, 130, 160, 190],
  plantasIA: (() => {
    const pos = [];
    for (const y of [102, 130, 160, 190]) for (let i = 0; i < 6; i++) pos.push({ x: 268 + i * 9, y: y - 1 });
    return pos;
  })(),
  vasoIA: { x: 357, y: 204 },
  robos: [{ x: 332, y: 146 }, { x: 352, y: 170 }, { x: 302, y: 212 }],
  tanqueAgua: { x: 132, y: 84 },
  lampiao: { x: 104, y: 178 },
  telasLcd: [],
};

const COR = {
  folhaEscura: '#0c1f0d', folha1: '#163a17', folha2: '#24541f', folha3: '#3a7a2c', folha4: '#5a9e3a',
  pedraFundo: '#3e2e14', pedra: ['#6a5028', '#7a6034', '#5e4722', '#806638'],
  terra: '#8d561d', terraEsc: '#6e4012', terraClara: '#a36a2c',
  tabua: '#7a4a1a', tabuaClara: '#9a6226', tabuaEsc: '#4a2a0c',
  madeira: '#6a3a14', madeiraClara: '#8f5320', madeiraEsc: '#3e200a',
  ceu: '#8fd0f0', ceuClaro: '#d0f0fa',
  azulejo: '#a7d5ed', azulejoLinha: '#7fb0cf', azulejoBrilho: '#cdeefb',
  branco: '#eef2f6', brancoSombra: '#b8c4cc', metal: '#8a8e96', metalClaro: '#c8ccd4', metalEsc: '#5a5e66',
};

export function desenharCenario() {
  const cv = criarCanvas(LARGURA, ALTURA);
  const c = cv.getContext('2d');
  const rng = criarRng(2026);

  folhagem(c, rng, 0, 0, LARGURA, ALTURA, 420);
  gramaInferior(c, rng);
  paredeFundo(c, rng);
  pisoRustico(c, rng);
  canteiro(c, rng);
  paredeVidroEsquerda(c, rng);
  pisoAzulejo(c);
  paredeVidroDireita(c);
  divisoria(c);
  objetosRusticos(c, rng);
  objetosTecnologicos(c, rng);
  trepadeiras(c, rng);
  return cv;
}

// ---------------------------------------------------------------- folhagem
function moita(c, x, y, r, rng) {
  elipse(c, x, y + 1, r, Math.max(1, r - 1), COR.folhaEscura);
  elipse(c, x, y, r, Math.max(1, r - 1), COR.folha1);
  elipse(c, x - 1, y - 1, r - 1, Math.max(1, r - 2), COR.folha2);
  if (r > 2) elipse(c, x - 2, y - 2, r - 3 > 0 ? r - 3 : 1, Math.max(1, r - 4), COR.folha3);
  for (let i = 0; i < r; i++) {
    px(c, x - r + Math.floor(rng() * r * 2), y - r + 1 + Math.floor(rng() * r), rng() < 0.5 ? COR.folha4 : COR.folha3);
  }
}

function folhagem(c, rng, x0, y0, w, h, n) {
  ret(c, x0, y0, w, h, COR.folhaEscura);
  for (let i = 0; i < n; i++) {
    moita(c, x0 + rng() * w, y0 + rng() * h, 3 + Math.floor(rng() * 6), rng);
  }
}

function gramaInferior(c, rng) {
  // Faixa de pedra na base da estufa + grama e flores.
  const { x0, x1, y1 } = LAYOUT.estufa;
  ret(c, x0 - 4, y1, x1 - x0 + 8, 6, '#4a3a1c');
  for (let x = x0 - 4; x < x1 + 4; x += 6) {
    ret(c, x, y1 + 1, 5, 4, rng() < 0.5 ? '#6a5430' : '#5a4626');
    px(c, x, y1 + 1, '#8a7448');
  }
  for (let i = 0; i < 40; i++) {
    const x = 92 + rng() * 310, y = 262 + rng() * 70;
    if (rng() < 0.3) { px(c, x, y, rng() < 0.5 ? '#e8d84a' : '#f0f0f0'); px(c, x + 1, y + 1, '#d86a8a'); }
  }
}

// ---------------------------------------------------------------- parede do fundo
function paredeFundo(c, rng) {
  const { x0, x1 } = LAYOUT.estufa;
  const d = LAYOUT.divisoria;
  // Vidro com céu e árvores ao fundo.
  for (let y = 0; y < 62; y++) ret(c, x0, y, x1 - x0, 1, misturar(COR.ceu, COR.ceuClaro, y / 70));
  for (let i = 0; i < 26; i++) {
    const x = x0 + rng() * (x1 - x0), y = 30 + rng() * 26;
    elipse(c, x, y, 6 + rng() * 6, 4 + rng() * 4, i % 2 ? '#3f8a36' : '#2f6b2a');
    elipse(c, x - 2, y - 2, 3, 2, '#5aa84a');
  }
  ret(c, x0, 52, x1 - x0, 10, '#2f6b2a');
  // Lado rústico: montantes de madeira grossos e travessas.
  for (let x = x0; x < d; x += 27) {
    ret(c, x, 0, 4, 64, COR.madeira);
    ret(c, x, 0, 1, 64, COR.madeiraClara);
    ret(c, x + 3, 0, 1, 64, COR.madeiraEsc);
  }
  for (const y of [0, 28]) {
    ret(c, x0, y, d - x0, 4, COR.madeira);
    ret(c, x0, y, d - x0, 1, COR.madeiraClara);
    ret(c, x0, y + 3, d - x0, 1, COR.madeiraEsc);
  }
  // Rodapé de madeira do lado rústico.
  ret(c, x0, 60, d - x0, 6, COR.madeiraEsc);
  ret(c, x0, 60, d - x0, 2, COR.madeira);
  // Lado tecnológico: caixilhos brancos finos.
  for (let x = d; x < x1; x += 22) {
    ret(c, x, 0, 3, 64, COR.branco);
    ret(c, x + 2, 0, 1, 64, COR.brancoSombra);
  }
  for (const y of [0, 22, 44]) {
    ret(c, d, y, x1 - d, 2, COR.branco);
    ret(c, d, y + 2, x1 - d, 1, COR.brancoSombra);
  }
  ret(c, d, 60, x1 - d, 6, '#d8e2ea');
  ret(c, d, 65, x1 - d, 1, COR.brancoSombra);
  // Reflexos diagonais no vidro.
  for (let x = x0 + 6; x < x1; x += 31) {
    for (let i = 0; i < 12; i++) px(c, x + i, 16 - i, 'rgba(255,255,255,0.55)');
  }
}

// ---------------------------------------------------------------- piso rústico
function pisoRustico(c, rng) {
  const x0 = LAYOUT.estufa.x0, x1 = LAYOUT.divisoria, y0 = 66, y1 = LAYOUT.estufa.y1;
  ret(c, x0, y0, x1 - x0, y1 - y0, COR.pedraFundo);
  for (let y = y0; y < y1; y += 5) {
    const off = ((y - y0) / 5) % 2 ? 3 : 0;
    for (let x = x0 - off; x < x1; x += 7) {
      const w = 6, h = 4;
      const cor = COR.pedra[Math.floor(rng() * COR.pedra.length)];
      ret(c, x, y, w, h, cor);
      ret(c, x, y, w, 1, clarear(cor, 0.12));
      px(c, x + w - 1, y + h - 1, escurecer(cor, 0.25));
    }
  }
}

function canteiro(c, rng) {
  const { x0, y0, x1, y1 } = LAYOUT.canteiro;
  // Borda de tábuas.
  ret(c, x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8, COR.tabuaEsc);
  ret(c, x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6, COR.tabua);
  for (let x = x0 - 3; x < x1 + 3; x += 9) { px(c, x, y0 - 3, COR.tabuaClara); px(c, x, y1 + 2, COR.tabuaEsc); }
  for (let y = y0 - 3; y < y1 + 3; y += 9) { px(c, x0 - 3, y, COR.tabuaClara); px(c, x1 + 2, y, COR.tabuaEsc); }
  // Terra com sulcos.
  ret(c, x0, y0, x1 - x0, y1 - y0, COR.terra);
  for (let y = y0 + 3; y < y1; y += 6) {
    ret(c, x0, y, x1 - x0, 1, COR.terraEsc);
    ret(c, x0, y - 1, x1 - x0, 1, COR.terraClara);
  }
  for (let i = 0; i < 260; i++) {
    px(c, x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0), rng() < 0.5 ? COR.terraEsc : '#9a6428');
  }
  // Sombra interna no topo (a borda projeta sombra).
  ret(c, x0, y0, x1 - x0, 2, 'rgba(40,20,5,0.35)');
  // Cano de irrigação ao longo da coluna dos aspersores.
  const xa = LAYOUT.aspersores[0].x;
  ret(c, xa - 1, y0 + 2, 2, y1 - y0 - 4, '#6a6e76');
  ret(c, xa - 1, y0 + 2, 1, y1 - y0 - 4, '#9aa0a8');
}

function paredeVidroEsquerda(c, rng) {
  // Parede lateral de vidro velho em perspectiva (painéis inclinados, alguns rachados).
  const baseX = 94, topo = 34, base = 244;
  for (let y = topo; y < base; y++) {
    const inclinacao = Math.round((base - y) * 0.16);
    const x = baseX + inclinacao;
    ret(c, x, y, 44, 1, misturar('#4f7a86', '#86b8c4', ((y - topo) % 34) / 50));
  }
  // Caixilhos de madeira.
  for (let y = topo; y <= base; y += 35) {
    const inc = Math.round((base - y) * 0.16);
    ret(c, baseX + inc - 1, y - 2, 47, 4, COR.madeira);
    ret(c, baseX + inc - 1, y - 2, 47, 1, COR.madeiraClara);
  }
  for (let y = topo; y < base; y++) {
    const inc = Math.round((base - y) * 0.16);
    for (const dx of [-1, 21, 43]) {
      ret(c, baseX + inc + dx, y, 3, 1, COR.madeira);
      px(c, baseX + inc + dx, y, COR.madeiraClara);
    }
  }
  // Rachaduras e reflexos.
  for (let i = 0; i < 5; i++) {
    const y = topo + 8 + Math.floor(rng() * 180);
    const x = baseX + Math.round((base - y) * 0.16) + 4 + Math.floor(rng() * 30);
    linha(c, x, y, x + 5, y + 4, 'rgba(230,245,250,0.8)');
    linha(c, x + 5, y + 4, x + 8, y + 2, 'rgba(230,245,250,0.8)');
  }
  for (let y = topo + 4; y < base; y += 35) {
    const x = baseX + Math.round((base - y) * 0.16) + 6;
    for (let i = 0; i < 8; i++) px(c, x + i, y + 10 - i, 'rgba(255,255,255,0.5)');
  }
}

// ---------------------------------------------------------------- lado tecnológico
function pisoAzulejo(c) {
  const x0 = LAYOUT.divisoria, x1 = LAYOUT.estufa.x1, y0 = 66, y1 = LAYOUT.estufa.y1;
  ret(c, x0, y0, x1 - x0, y1 - y0, COR.azulejo);
  for (let y = y0; y < y1; y += 11) {
    for (let x = x0; x < x1; x += 11) {
      ret(c, x, y, 11, 1, COR.azulejoLinha);
      ret(c, x, y, 1, 11, COR.azulejoLinha);
      ret(c, x + 1, y + 1, 4, 1, COR.azulejoBrilho);
      px(c, x + 1, y + 2, COR.azulejoBrilho);
    }
  }
}

function paredeVidroDireita(c) {
  const x = LAYOUT.estufa.x1 - 14, topo = 20, base = 250;
  for (let y = topo; y < base; y++) {
    const inc = Math.round((y - topo) * 0.06);
    ret(c, x + inc, y, 16, 1, misturar('#9fd4ea', '#d8f2fb', ((y - topo) % 40) / 60));
  }
  for (let y = topo; y <= base; y += 40) ret(c, x + Math.round((y - topo) * 0.06) - 1, y, 18, 2, COR.branco);
  for (let y = topo; y < base; y++) {
    const inc = Math.round((y - topo) * 0.06);
    ret(c, x + inc - 1, y, 2, 1, COR.branco);
    ret(c, x + inc + 15, y, 2, 1, COR.brancoSombra);
  }
}

function divisoria(c) {
  const x = LAYOUT.divisoria - 2;
  ret(c, x, 0, 5, LAYOUT.estufa.y1 + 2, COR.branco);
  ret(c, x, 0, 1, LAYOUT.estufa.y1 + 2, '#ffffff');
  ret(c, x + 4, 0, 1, LAYOUT.estufa.y1 + 2, COR.brancoSombra);
  // Sombra da divisória no piso rústico.
  ret(c, x - 3, 66, 3, LAYOUT.estufa.y1 - 66, 'rgba(0,0,0,0.25)');
}

// ---------------------------------------------------------------- objetos
function sombraChao(c, x, y, rx, ry) {
  c.globalAlpha = 0.35;
  elipse(c, x, y, rx, ry, '#1a0f05');
  c.globalAlpha = 1;
}

function objetosRusticos(c, rng) {
  // Tanque de água azul (tambor) com cano até o canteiro.
  const t = LAYOUT.tanqueAgua;
  sombraChao(c, t.x, t.y + 22, 12, 3);
  ret(c, t.x - 10, t.y, 20, 22, '#2a5f98');
  ret(c, t.x - 9, t.y, 16, 22, '#3f7fc0');
  ret(c, t.x - 7, t.y + 2, 3, 18, '#7ab8e8');
  elipse(c, t.x, t.y, 10, 3, '#2a5f98');
  elipse(c, t.x, t.y, 8, 2, '#5a9ad8');
  for (const dy of [6, 15]) ret(c, t.x - 10, t.y + dy, 20, 2, '#1e4a7a');
  ret(c, t.x + 10, t.y + 17, 12, 2, '#8a6a4a');
  ret(c, t.x + 20, t.y + 17, 2, 14, '#8a6a4a');
  ret(c, t.x + 20, t.y + 29, 32, 2, '#8a6a4a');
  px(c, t.x + 13, t.y + 17, '#c89a6a');

  // Barril de madeira.
  const bx = 108, by = 204;
  sombraChao(c, bx, by + 22, 11, 3);
  ret(c, bx - 9, by, 18, 22, '#7a4a1a');
  for (let x = bx - 9; x < bx + 9; x += 4) ret(c, x, by, 1, 22, '#5a3210');
  ret(c, bx - 7, by + 2, 2, 18, '#a0682a');
  for (const dy of [3, 17]) ret(c, bx - 9, by + dy, 18, 2, '#5a5e66');
  elipse(c, bx, by, 9, 2, '#9a6226');
  elipse(c, bx, by, 7, 1, '#4a2a0c');

  // Lampião (o brilho pisca no desenho dinâmico).
  const l = LAYOUT.lampiao;
  ret(c, l.x - 3, l.y - 8, 6, 8, '#3a2a1a');
  ret(c, l.x - 2, l.y - 7, 4, 6, '#f6a33a');
  px(c, l.x - 1, l.y - 6, '#ffe08a');
  ret(c, l.x - 1, l.y - 10, 2, 2, '#3a2a1a');

  // Ancinho encostado na parede.
  linha(c, 140, 128, 150, 162, '#8a5a2a');
  linha(c, 141, 128, 151, 162, '#a06a32');
  ret(c, 136, 124, 9, 2, '#6a6e76');
  for (let i = 0; i < 5; i++) px(c, 136 + i * 2, 126, '#6a6e76');

  // Regador verde, enxada e pá no chão.
  const rx = 164, ry = 232;
  sombraChao(c, rx + 2, ry + 6, 7, 2);
  ret(c, rx - 4, ry - 4, 10, 8, '#5a8a3a');
  ret(c, rx - 4, ry - 4, 10, 1, '#7aaa4a');
  ret(c, rx - 4, ry + 3, 10, 1, '#3a6a2a');
  linha(c, rx + 6, ry - 2, rx + 11, ry - 6, '#5a8a3a');
  ret(c, rx + 10, ry - 7, 3, 2, '#3a6a2a');
  ret(c, rx - 2, ry - 7, 6, 1, '#3a6a2a');
  linha(c, 186, 238, 206, 226, '#8a5a2a');
  ret(c, 204, 222, 4, 5, '#8a8e96');
  linha(c, 122, 236, 140, 230, '#8a5a2a');
  ret(c, 118, 233, 5, 3, '#6a6e76');

  // Vasinhos na prateleira do fundo.
  for (let i = 0; i < 4; i++) {
    const vx = 164 + i * 14, vy = 60;
    ret(c, vx - 3, vy - 4, 7, 5, '#b8602a');
    ret(c, vx - 3, vy - 4, 7, 1, '#d8804a');
    elipse(c, vx, vy - 6, 3, 2, i % 2 ? '#3f8a36' : '#5aa84a');
  }
}

function objetosTecnologicos(c, rng) {
  // Estante hidropônica: montantes de metal e 4 bandejas com água.
  const x0 = 262, x1 = 322;
  sombraChao(c, (x0 + x1) / 2, 214, 34, 4);
  for (const x of [x0, x1]) {
    ret(c, x - 1, 74, 3, 140, COR.metal);
    ret(c, x - 1, 74, 1, 140, COR.metalClaro);
    ret(c, x + 1, 74, 1, 140, COR.metalEsc);
  }
  ret(c, x0 - 1, 74, x1 - x0 + 3, 2, COR.metalClaro);
  for (const y of LAYOUT.prateleiras) {
    ret(c, x0, y, x1 - x0, 5, COR.branco);
    ret(c, x0, y, x1 - x0, 1, '#ffffff');
    ret(c, x0 + 1, y + 1, x1 - x0 - 2, 1, '#4f9fd8');
    ret(c, x0, y + 4, x1 - x0, 1, COR.brancoSombra);
    ret(c, x0, y + 5, x1 - x0, 1, 'rgba(0,0,0,0.25)');
    // Etiquetas LCD sob as bandejas.
    for (const lx of [x0 + 12, x0 + 40]) {
      ret(c, lx, y + 7, 11, 6, '#1a2a1e');
      ret(c, lx + 1, y + 8, 9, 4, '#123a22');
      LAYOUT.telasLcd.push({ x: lx + 1, y: y + 8 });
    }
  }
  // Cano de nutrientes do tanque até a estante.
  ret(c, 322, 88, 12, 2, '#6a8aa0');
  ret(c, 332, 70, 2, 20, '#6a8aa0');

  // Tanque cilíndrico de solução nutritiva.
  const tx = 331, ty = 48;
  sombraChao(c, tx, ty + 36, 10, 3);
  ret(c, tx - 9, ty, 18, 36, '#c8d0d8');
  ret(c, tx - 9, ty, 3, 36, '#e8eef2');
  ret(c, tx + 6, ty, 3, 36, '#9aa4b0');
  elipse(c, tx, ty, 9, 3, '#d8e0e6');
  elipse(c, tx, ty, 7, 2, '#9aa4b0');
  ret(c, tx - 3, ty + 8, 6, 20, '#1a2a3a');
  ret(c, tx - 2, ty + 14, 4, 13, '#4fe0f0');
  ret(c, tx - 2, ty + 14, 1, 13, '#bff8ff');

  // Máquina de climatização com ventoinha.
  const mx = 346, my = 62;
  sombraChao(c, mx + 15, my + 58, 17, 3);
  ret(c, mx, my, 30, 56, '#6a7480');
  ret(c, mx + 1, my + 1, 28, 54, '#9aa4b0');
  ret(c, mx + 1, my + 1, 28, 1, '#c8d0d8');
  elipse(c, mx + 15, my + 14, 10, 10, '#3a424c');
  elipse(c, mx + 15, my + 14, 9, 9, '#c8d0d8');
  elipse(c, mx + 15, my + 14, 8, 8, '#5a626c');
  ret(c, mx + 5, my + 30, 20, 10, '#1a2230');
  ret(c, mx + 6, my + 31, 18, 8, '#123a22');
  ret(c, mx + 6, my + 44, 5, 5, '#3a424c');
  px(c, mx + 8, my + 46, '#5fe07a');
  ret(c, mx + 14, my + 44, 10, 3, '#3a424c');
  LAYOUT.ventoinha = { x: mx + 15, y: my + 14, r: 7 };
  LAYOUT.telaMaquina = { x: mx + 6, y: my + 31, w: 18, h: 8 };

  // Terminal de controle.
  const cx = 380, cy = 122;
  sombraChao(c, cx + 7, cy + 44, 9, 2);
  ret(c, cx, cy, 15, 44, '#5a626c');
  ret(c, cx + 1, cy + 1, 13, 42, '#8a929c');
  ret(c, cx + 2, cy + 4, 11, 14, '#1a2230');
  ret(c, cx + 3, cy + 5, 9, 12, '#1e5a8a');
  LAYOUT.telaTerminal = { x: cx + 3, y: cy + 5, w: 9, h: 12 };
  for (let i = 0; i < 3; i++) ret(c, cx + 3 + i * 3, cy + 24, 2, 2, ['#e2553a', '#f6d84a', '#5fe07a'][i]);
  ret(c, cx + 3, cy + 30, 9, 8, '#3a424c');

  // Vaso branco (a planta da IA é desenhada por cima).
  const v = LAYOUT.vasoIA;
  sombraChao(c, v.x, v.y + 12, 13, 3);
  ret(c, v.x - 12, v.y, 24, 12, COR.branco);
  ret(c, v.x - 12, v.y, 24, 2, '#ffffff');
  ret(c, v.x - 12, v.y + 10, 24, 2, COR.brancoSombra);
  ret(c, v.x - 10, v.y + 2, 20, 2, '#4a3014');
}

function trepadeiras(c, rng) {
  // Trepadeiras pendendo das vigas (mais no lado rústico).
  for (const [x, comp] of [[100, 40], [128, 22], [176, 18], [238, 30], [300, 16], [372, 26]]) {
    for (let y = 2; y < comp; y += 3) {
      const dx = Math.round(Math.sin(y * 0.5) * 2);
      px(c, x + dx, y, '#2f6b2a');
      elipse(c, x + dx + (y % 2 ? 2 : -2), y + 1, 2, 1, y % 6 ? '#4f9a3a' : '#6ab84a');
    }
  }
  // Moitas em primeiro plano, no pé das paredes.
  for (let i = 0; i < 10; i++) moita(c, 88 + rng() * 12, 150 + rng() * 100, 4 + Math.floor(rng() * 4), rng);
  for (let i = 0; i < 8; i++) moita(c, 398 + rng() * 10, 120 + rng() * 120, 4 + Math.floor(rng() * 4), rng);
}
