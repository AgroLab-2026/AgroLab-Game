// Utilidades de pixel art: RNG determinístico, mistura de cores, sprites em texto
// e primitivas "crocantes" (sem antisserrilhado).

/** Gerador pseudoaleatório determinístico (mulberry32). Mesma semente = mesmo cenário. */
export function criarRng(semente = 1) {
  let a = semente >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cacheRgb = new Map();
export function hexParaRgb(hex) {
  let c = cacheRgb.get(hex);
  if (!c) {
    const h = hex.replace('#', '');
    c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    cacheRgb.set(hex, c);
  }
  return c;
}

export function rgbParaHex(r, g, b) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

/** Mistura duas cores (t = 0 → a, t = 1 → b). */
export function misturar(a, b, t) {
  const [r1, g1, b1] = hexParaRgb(a);
  const [r2, g2, b2] = hexParaRgb(b);
  return rgbParaHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Planta doente: perde a saturação e puxa para o amarelo-palha (Pilar 3: "fica acinzentada"). */
const cacheDoente = new Map();
export function corDoente(hex, saude01) {
  const q = Math.round(Math.max(0, Math.min(1, saude01)) * 20) / 20;
  const chave = hex + q;
  let c = cacheDoente.get(chave);
  if (!c) {
    const [r, g, b] = hexParaRgb(hex);
    const cinza = r * 0.3 + g * 0.59 + b * 0.11;
    const palha = misturar(rgbParaHex(cinza, cinza, cinza), '#a08850', 0.45);
    c = misturar(palha, hex, q);
    cacheDoente.set(chave, c);
  }
  return c;
}

export function clarear(hex, t) { return misturar(hex, '#ffffff', t); }
export function escurecer(hex, t) { return misturar(hex, '#000000', t); }

/**
 * Converte um sprite em texto (uma string por linha) num canvas.
 * Cada caractere é uma chave da paleta; '.' ou ' ' é transparente.
 */
export function spriteDeTexto(linhas, paleta) {
  const h = linhas.length;
  const w = Math.max(...linhas.map((l) => l.length));
  const cv = criarCanvas(w, h);
  const ctx = cv.getContext('2d');
  for (let y = 0; y < h; y++) {
    const linha = linhas[y];
    for (let x = 0; x < linha.length; x++) {
      const ch = linha[x];
      if (ch === '.' || ch === ' ') continue;
      const cor = paleta[ch];
      if (!cor) continue;
      ctx.fillStyle = cor;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

/** Espelha um canvas horizontalmente. */
export function espelhar(cv) {
  const out = criarCanvas(cv.width, cv.height);
  const ctx = out.getContext('2d');
  ctx.translate(cv.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(cv, 0, 0);
  return out;
}

export function criarCanvas(w, h) {
  const cv = typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined'
    ? new OffscreenCanvas(w, h)
    : document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

/** Retângulo inteiro (evita meio-pixel borrado). */
export function ret(ctx, x, y, w, h, cor) {
  ctx.fillStyle = cor;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function px(ctx, x, y, cor) {
  ctx.fillStyle = cor;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

/** Elipse preenchida pixel a pixel (bordas duras, como pixel art feita à mão). */
export function elipse(ctx, cx, cy, rx, ry, cor) {
  ctx.fillStyle = cor;
  const x0 = Math.round(cx), y0 = Math.round(cy);
  for (let dy = -ry; dy <= ry; dy++) {
    const t = 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5));
    if (t < 0) continue;
    const meia = Math.floor((rx + 0.5) * Math.sqrt(t));
    ctx.fillRect(x0 - meia, y0 + dy, meia * 2 + 1, 1);
  }
}

/** Linha de Bresenham. */
export function linha(ctx, x0, y0, x1, y1, cor) {
  ctx.fillStyle = cor;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Contorno de 1 px ao redor dos pixels opacos de um canvas (efeito "outline" do Stardew). */
export function comContorno(cv, cor = '#1a0f08') {
  const w = cv.width + 2, h = cv.height + 2;
  const out = criarCanvas(w, h);
  const ctx = out.getContext('2d');
  const src = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const opaco = (x, y) => x >= 0 && y >= 0 && x < cv.width && y < cv.height && src[(y * cv.width + x) * 4 + 3] > 0;
  ctx.fillStyle = cor;
  for (let y = -1; y <= cv.height; y++) {
    for (let x = -1; x <= cv.width; x++) {
      if (opaco(x, y)) continue;
      if (opaco(x - 1, y) || opaco(x + 1, y) || opaco(x, y - 1) || opaco(x, y + 1)) ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  ctx.drawImage(cv, 1, 1);
  return out;
}
