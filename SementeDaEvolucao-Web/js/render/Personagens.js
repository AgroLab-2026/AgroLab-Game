// Personagens em pixel art: o fazendeiro (jogador), os robôs da estufa autônoma
// e o retrato do Sr. Bruno. Substituem Sunnyside/ e _Generated/bruno_face.png.
import { spriteDeTexto, comContorno, espelhar, criarCanvas, elipse, ret, px, linha } from './Pixel.js';

const PAL_FAZENDEIRO = {
  h: '#eec85a', H: '#c0943a', l: '#fbe594', // chapéu de palha (estilo Chico Bento)
  d: '#9a7430',                              // fiapos e trama da palha
  s: '#f1c27d', S: '#d49a5a',                // pele
  e: '#2a1a10',                              // olhos
  c: '#4f8a3a', C: '#356a2a',                // camisa verde
  u: '#3a5fa0', U: '#2a4478', b: '#e8d8a0',  // macacão azul + botão
  p: '#5a3418', P: '#3a200c',                // botas
  t: '#9aa0a8', m: '#6a4020',                // pá (lâmina e cabo)
};

// Frente, parado. 16 × 23.
const FAZ_FRENTE = [
  '.....d.hhhh.d.....',
  '.....hlhhhhhhH....',
  '....hlhhdhhhdhH...',
  '....hhdhhhdhhhH...',
  '..hhlhhhhhhhhhhH..',
  'hhlhhdhhhhdhhhhhhH',
  'dHhdHSSSSSSSSHdHhd',
  'd.d..SsssssssS.d.d',
  '....sseesseess..',
  '....ssssssssss..',
  '.....sssSSsss...',
  '......SsssS.....',
  '....ccuccccucc..',
  '...cccuccccuccc.',
  '...ccUuubbuuUcc.',
  '...ssUuuuuuuUss.',
  '...ss.uuuuuu.ss.',
  '......uuuuuu....',
  '......uuUUuu....',
  '......uu..uu....',
  '......uu..uu....',
  '.....ppp..ppp...',
  '.....PPP..PPP...',
];

// O chapéu (8 primeiras linhas) tem 18 px de largura; o corpo, 16: centraliza o corpo.
const LINHAS_CHAPEU = 8;

function fazendeiroQuadro(passo) {
  const linhas = FAZ_FRENTE.slice();
  if (passo === 1) {
    linhas[19] = '......uu..uu....';
    linhas[20] = '......uu...uu...';
    linhas[21] = '.....ppp...ppp..';
    linhas[22] = '.....PPP...PPP..';
  } else if (passo === 2) {
    linhas[19] = '......uu..uu....';
    linhas[20] = '.....uu...uu....';
    linhas[21] = '....ppp...ppp...';
    linhas[22] = '....PPP...PPP...';
  }
  return linhas.map((l, i) => (i >= LINHAS_CHAPEU ? `.${l}` : l));
}

/** Fazendeiro segurando a pá (quadro da referência). */
function comPa(linhas) {
  const cv = spriteDeTexto(linhas, PAL_FAZENDEIRO);
  const out = criarCanvas(cv.width + 4, cv.height);
  const c = out.getContext('2d');
  c.drawImage(cv, 4, 0);
  // Cabo e lâmina da pá na mão esquerda.
  linha(c, 6, 15, 1, 20, PAL_FAZENDEIRO.m);
  ret(c, 0, 19, 3, 3, PAL_FAZENDEIRO.t);
  px(c, 0, 19, '#c8d0d8');
  return out;
}

let _fazendeiro = null;
export function spritesFazendeiro() {
  if (_fazendeiro) return _fazendeiro;
  const q = [0, 1, 0, 2].map((p) => comContorno(comPa(fazendeiroQuadro(p)), '#1a0f08'));
  _fazendeiro = { parado: q[0], andando: q, esquerda: q.map(espelhar) };
  return _fazendeiro;
}

// Robô da estufa autônoma: cúpula branca, visor escuro e olhos ciano. 14 × 14.
const PAL_ROBO = { w: '#eef2f6', W: '#b8c4d0', k: '#1a2230', c: '#4fe0f0', C: '#bff8ff', g: '#9aa4b0', G: '#6a7480', y: '#f6d84a', r: '#e2553a' };
const ROBO = [
  '......y.......',
  '......G.......',
  '...wwwwwwww...',
  '..wwwwwwwwwW..',
  '..wkkkkkkkkW..',
  '..wkcCkkcCkW..',
  '..wkkkkkkkkW..',
  '...WWWWWWWW...',
  '.g..gggggg..g.',
  '.Gg.gwwwwg.gG.',
  '..G.gggggg.G..',
  '....GgggggG...',
  '.....G..G.....',
  '..............',
];

let _robo = null;
export function spritesRobo() {
  if (_robo) return _robo;
  const a = comContorno(spriteDeTexto(ROBO, PAL_ROBO), '#101820');
  const piscando = ROBO.slice();
  piscando[5] = '..wkkkkkkkkW..';
  const b = comContorno(spriteDeTexto(piscando, PAL_ROBO), '#101820');
  _robo = { normal: a, piscando: b };
  return _robo;
}

/**
 * Retrato do Sr. Bruno (≈ 64 × 58 pixels de arte), desenhado com formas.
 * Chapéu de palha, sobrancelhas e bigode brancos, camisa verde e macacão azul.
 */
export function desenharRetratoBruno(falando = false, piscar = false) {
  const W = 64, H = 58;
  const cv = criarCanvas(W, H);
  const c = cv.getContext('2d');
  // Fundo: parede de madeira quente (como na referência).
  ret(c, 0, 0, W, H, '#c67a26');
  for (let y = 3; y < H; y += 7) ret(c, 0, y, W, 1, '#a55e1a');
  for (let x = 0; x < W; x += 13) ret(c, x + ((x / 13) % 2) * 5, 0, 1, H, '#b06a20');

  // Ombros e camisa verde.
  elipse(c, 32, 58, 27, 12, '#2f5e24');
  elipse(c, 32, 58, 25, 11, '#4f8a3a');
  // Macacão azul com alças e botões.
  ret(c, 20, 49, 24, 9, '#3a5fa0');
  ret(c, 20, 49, 24, 1, '#2a4478');
  ret(c, 17, 44, 5, 14, '#3a5fa0');
  ret(c, 42, 44, 5, 14, '#3a5fa0');
  ret(c, 18, 50, 3, 3, '#e8c86a'); ret(c, 43, 50, 3, 3, '#e8c86a');
  px(c, 19, 51, '#8a6a2a'); px(c, 44, 51, '#8a6a2a');
  // Pescoço.
  ret(c, 27, 40, 10, 6, '#d49a5a');

  // Rosto.
  elipse(c, 32, 30, 13, 14, '#b8784a');
  elipse(c, 32, 30, 12, 13, '#e8b07a');
  elipse(c, 31, 28, 10, 10, '#f1c28a');
  // Orelhas.
  elipse(c, 19, 30, 2, 3, '#d49a5a');
  elipse(c, 45, 30, 2, 3, '#d49a5a');
  // Olhos (piscam) e sobrancelhas brancas.
  if (piscar) {
    ret(c, 24, 28, 5, 1, '#3a2010'); ret(c, 35, 28, 5, 1, '#3a2010');
  } else {
    ret(c, 25, 27, 3, 3, '#ffffff'); ret(c, 36, 27, 3, 3, '#ffffff');
    ret(c, 26, 28, 2, 2, '#2a1a10'); ret(c, 37, 28, 2, 2, '#2a1a10');
    px(c, 26, 28, '#6a4a30'); px(c, 37, 28, '#6a4a30');
  }
  ret(c, 22, 24, 8, 2, '#f4f4f0'); ret(c, 34, 24, 8, 2, '#f4f4f0');
  ret(c, 22, 25, 8, 1, '#c8c8c0'); ret(c, 34, 25, 8, 1, '#c8c8c0');
  // Nariz e bochechas.
  elipse(c, 32, 32, 3, 2, '#d8905a');
  px(c, 31, 31, '#f8d0a0');
  elipse(c, 23, 34, 2, 1, '#e8906a'); elipse(c, 41, 34, 2, 1, '#e8906a');
  // Barba e bigode brancos.
  elipse(c, 32, 40, 12, 6, '#d8d8d0');
  elipse(c, 32, 39, 11, 5, '#f4f4ee');
  elipse(c, 27, 35, 6, 2, '#e8e8e0');
  elipse(c, 37, 35, 6, 2, '#e8e8e0');
  ret(c, 22, 35, 2, 2, '#f4f4ee'); ret(c, 40, 35, 2, 2, '#f4f4ee');
  for (let i = 0; i < 9; i++) px(c, 24 + i * 2, 42 + (i % 2), '#c8c8c0');
  // Boca (abre quando fala).
  if (falando) ret(c, 30, 37, 4, 2, '#7a3020');
  else ret(c, 30, 37, 4, 1, '#9a5040');

  // Chapéu de palha no estilo Chico Bento: aba larga e desfiada, copa redonda, sem fita.
  elipse(c, 32, 18, 31, 6, '#9a7430');
  elipse(c, 32, 17, 30, 5, '#eec85a');
  for (let x = 4; x < 61; x += 3) px(c, x, 17 + ((x / 3) % 2), '#c8a048');
  // Fiapos pendurados na borda da aba.
  for (let x = 3; x < 62; x += 2) {
    if (x > 17 && x < 47) continue; // não cobre o rosto
    const comp = 1 + ((x * 7) % 3);
    for (let k = 0; k < comp; k++) px(c, x, 22 + k - (Math.abs(x - 32) > 24 ? 2 : 0), k === comp - 1 ? '#9a7430' : '#d8b050');
  }
  elipse(c, 32, 9, 14, 9, '#c0943a');
  elipse(c, 31, 8, 13, 8, '#eec85a');
  // Trama da palha na copa e alguns fiapos soltos no topo.
  for (let y = 2; y < 15; y += 2) for (let x = 20; x < 44; x += 4) px(c, x + (y % 4 ? 2 : 0), y, '#c8a048');
  px(c, 25, 3, '#fbe594'); px(c, 26, 3, '#fbe594'); px(c, 27, 4, '#fbe594');
  for (const [x, y] of [[22, 0], [23, 1], [38, 0], [37, 1], [30, 0]]) px(c, x, y, '#9a7430');
  ret(c, 18, 14, 28, 1, '#c0943a');
  return cv;
}
