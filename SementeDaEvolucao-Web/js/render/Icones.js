// Ícones do HUD em pixel art (12×12 aprox.), gerados por código.
// Cada ícone vira uma imagem (data URL) usada pelo HUD em <img>.
import { spriteDeTexto, comContorno, elipse, ret, px, criarCanvas } from './Pixel.js';

const K = '#2a160a';

const MAPAS = {
  agua: [[
    '.....k......',
    '....kwk.....',
    '....kbk.....',
    '...kwbbk....',
    '...kwbbk....',
    '..kwbbbbk...',
    '..kwbbbbk...',
    '..kbbbbdk...',
    '..kbbbbdk...',
    '...kbddk....',
    '....kkk.....',
  ], { k: '#16305e', b: '#3f8fe0', w: '#bfe6ff', d: '#2a5fb0' }],

  energia: [[
    '......kkk.',
    '.....kyyk.',
    '....kyyk..',
    '...kyyk...',
    '..kyyyykk.',
    '..kkkyyyk.',
    '....kyyk..',
    '...kyyk...',
    '...kyk....',
    '..kyk.....',
    '..kk......',
  ], { k: '#6b4a0c', y: '#f6c945' }],

  nutrientes: [[
    '.........kk',
    '.......kkgk',
    '.....kkgggk',
    '....kgglggk',
    '...kgglgggk',
    '...kglgggk.',
    '..kglgggk..',
    '..kgggkk...',
    '.klkkk.....',
    'kl.........',
  ], { k: '#1f4a17', g: '#5fae3a', l: '#a9e06a' }],

  maoDeObra: [[
    '....kkkk....',
    '...kyyyyk...',
    '..kyyyyyyk..',
    '.kkkkkkkkkk.',
    '...kssssk...',
    '...ksesek...',
    '...kssssk...',
    '..kggggggk..',
    '.kgbggggbgk.',
    '.ksbbbbbbsk.',
    '..kbbbbbbk..',
    '..kbbkkbbk..',
  ], { k: K, y: '#e8b64c', s: '#f1c27d', e: '#2a1a10', g: '#4f8a3a', b: '#3a5fa0' }],

  automacao: [[
    '....kk.kk...',
    '...kggkggk..',
    '.kkgggggggkk',
    '.kggwwwwwggk',
    '..kgwkkkwgk.',
    '.kggwk.kwggk',
    '.kggwk.kwggk',
    '..kgwkkkwgk.',
    '.kggwwwwwggk',
    '.kkgggggggkk',
    '...kggkggk..',
    '....kk.kk...',
  ], { k: '#3a3a3a', g: '#b8b8b8', w: '#e8e8e8' }],

  regador: [[
    '............',
    '....kkkk....',
    '...k....k...',
    '.kkkkkkkkk..',
    'kkbbbbbbbkk.',
    'kwbwwbbbbk.k',
    '.kbbbbbbbkk.',
    '.kbbbbbbbk..',
    '.kbbbbbbdk..',
    '.kkkkkkkkk..',
  ], { k: '#16305e', b: '#4f9fd8', w: '#bfe6ff', d: '#2a5fb0' }],

  valvula: [[
    '...kkkkk....',
    '..krrrrrk...',
    '.krk.k.krk..',
    '.krrkrkrrk..',
    '.krk.k.krk..',
    '..krrrrrk...',
    '....kgk.....',
    'kkkkkgkkkkkk',
    'gggggggggggg',
    'wwwwwwwwwwww',
    'kkkkkkkkkkkk',
  ], { k: '#3a1a10', r: '#d9432b', g: '#9aa0a8', w: '#d6dbe0' }],

  proteger: [[
    '.....kk.....',
    '...kkggkk...',
    '..kglgglgk..',
    '.kgglgglggk.',
    'kgglgglgglgk',
    'kkkkkkkkkkkk',
    '.....kw.....',
    '.....kw.....',
    '.....kw.....',
    '...k.kw.....',
    '....kk......',
  ], { k: '#1f4a17', g: '#3f8a36', l: '#7fcf4a', w: '#8a6a3a' }],

  aguardar: [[
    '.kkkkkkkk.',
    '.kwwwwwwk.',
    '..kyyyyk..',
    '...kyyk...',
    '....kk....',
    '...kwwk...',
    '..kwyywk..',
    '.kyyyyyyk.',
    '.kkkkkkkk.',
  ], { k: '#5a3a1a', w: '#e8f4ff', y: '#e8b64c' }],

  balde: [[
    '..kkkkkk..',
    '.k......k.',
    'kkkkkkkkkk',
    'kgbbbbbbgk',
    '.kbwbbbbk.',
    '.kbbbbbbk.',
    '.kgbbbbgk.',
    '..kkkkkk..',
  ], { k: '#3a3a3a', g: '#9aa0a8', b: '#4f9fd8', w: '#bfe6ff' }],

  termometro: [[
    '....kk....',
    '...kwwk...',
    '...kwwk...',
    '...kwrk...',
    '...kwrk...',
    '...kwrk...',
    '...krrk...',
    '..krrrrk..',
    '..krwrrk..',
    '..krrrrk..',
    '...kkkk...',
  ], { k: '#3a1a10', w: '#f4f4f4', r: '#d9432b' }],

  gotaGrande: [[
    '....kk....',
    '...kbbk...',
    '..kwbbbk..',
    '..kwbbbk..',
    '.kwbbbbbk.',
    '.kbbbbbdk.',
    '.kbbbbbdk.',
    '..kbbddk..',
    '...kkkk...',
  ], { k: '#16305e', b: '#3f8fe0', w: '#bfe6ff', d: '#2a5fb0' }],

  lampada: [[
    '...kkkk...',
    '..kyyyyk..',
    '.kyywyyyk.',
    '.kyywyyyk.',
    '.kyyyyyyk.',
    '..kyyyyk..',
    '...kyyk...',
    '...kggk...',
    '...kggk...',
    '....kk....',
  ], { k: '#5a3a0a', y: '#f6d84a', w: '#fffbe0', g: '#9aa0a8' }],

  ph: [[
    '..kkkkkk..',
    '...kwwk...',
    '...kwwk...',
    '...kwwk...',
    '..kwwwwk..',
    '.kpppppk..',
    '.kpwppppk.',
    '.kppppppk.',
    '..kkkkkk..',
  ], { k: '#2a1a3a', w: '#e8f4ff', p: '#b05ad8' }],

  cadeado: [[
    '...kkkk...',
    '..kk..kk..',
    '..k....k..',
    '.kkkkkkkk.',
    '.kyyyyyyk.',
    '.kyykkyyk.',
    '.kyykkyyk.',
    '.kyyyyyyk.',
    '.kkkkkkkk.',
  ], { k: '#3a2a0a', y: '#d9a53a' }],

  nuvemChuva: [[
    '....kkkk....',
    '..kkwwwwkk..',
    '.kwwwwwwwwk.',
    'kwwwwwwwwwwk',
    'kggwwwwwwggk',
    '.kkkkkkkkkk.',
    '..b..b..b...',
    '.b..b..b....',
    '...b..b..b..',
  ], { k: '#3a4a5a', w: '#c8d4dc', g: '#94a4b0', b: '#4f9fd8' }],

  inseto: [[
    'k.......k.',
    '.k.....k..',
    '..kkkkk...',
    '.kgggggk..',
    'kgkgggkgk.',
    '.kgggggk..',
    'kgkgggkgk.',
    '.kgggggk..',
    '..kkkkk...',
  ], { k: '#1a2a0a', g: '#7fbf3a' }],

  robo: [[
    '.....k......',
    '....kyk.....',
    '..kkkkkkk...',
    '.kwwwwwwwk..',
    '.kwkkkkkwk..',
    '.kwkckckwk..',
    '.kwkkkkkwk..',
    '..kkkkkkk...',
    '.kgggggggk..',
    'kkgkgggkgkk.',
    '..kgggggk...',
    '..kk...kk...',
  ], { k: '#1a2230', w: '#eef2f6', c: '#4fe0f0', g: '#9aa4b0', y: '#f6d84a' }],

  painel: [[
    'kkkkkkkkkkk.',
    'kddddddddk..',
    'kdgddddyddk.',
    'kdggdddyydk.',
    'kdgggdyyydk.',
    'kdggggyyydk.',
    'kkkkkkkkkkk.',
    '....kk......',
    '..kkkkkk....',
  ], { k: '#1a2230', d: '#123a2a', g: '#5fe07a', y: '#f6d84a' }],

  sensor: [[
    '...kkkk...',
    '..kccccw..',
    '..kcckck..',
    '..kkkkkk..',
    '...kggk...',
    '...kggk...',
    '...kggk...',
    '..kbbbbk..',
    '.kbbbbbbk.',
    '.kbbbbbbk.',
  ], { k: '#1a2230', c: '#4fe0f0', w: '#eaffff', g: '#9aa4b0', b: '#7a4a1a' }],

  medidor: [[
    '.kkkkkkk..',
    '.kddddddk.',
    '.kdgggdk..',
    '.kdddddk..',
    '.kkkkkkk..',
    '.kbbrbbk..',
    '.kbbbbbk..',
    '.kkkkkkk..',
    '....k.....',
    '....k.....',
    '....w.....',
  ], { k: '#1a2230', d: '#123a2a', g: '#5fe07a', b: '#e8b64c', r: '#d9432b', w: '#bfe6ff' }],

  sombra: [[
    'kkkkkkkkkkkk',
    'kglglglglglk',
    'klglglglglgk',
    'kkkkkkkkkkkk',
    '.k........k.',
    '.k.y.y.y..k.',
    '.k..y.y.y.k.',
    '.k........k.',
  ], { k: '#1f4a17', g: '#3f8a36', l: '#5fae3a', y: '#f6d84a' }],

  estrela: [[
    '....kk....',
    '....yk....',
    '...kyyk...',
    'kkkyyyykkk',
    '.kyyyyyyk.',
    '..kyyyyk..',
    '..kyykyk..',
    '.kyk..kyk.',
    '.kk....kk.',
  ], { k: '#8a5a0a', y: '#f6c945' }],

  estrelaVazia: [[
    '....kk....',
    '....gk....',
    '...kggk...',
    'kkkggggkkk',
    '.kggggggk.',
    '..kggggk..',
    '..kggkgk..',
    '.kgk..kgk.',
    '.kk....kk.',
  ], { k: '#2a2a2a', g: '#5a5a5a' }],

  estrelaVermelha: [[
    '....kk....',
    '....rk....',
    '...krrk...',
    'kkkrrrrkkk',
    '.krrrrrrk.',
    '..krrrrk..',
    '..krrkrk..',
    '.krk..krk.',
    '.kk....kk.',
  ], { k: '#5a0a0a', r: '#e2553a' }],

  fechar: [[
    'kkkkkkkkkk',
    'krrrrrrrrk',
    'krwrrrrwrk',
    'krrwrrwrrk',
    'krrrwwrrrk',
    'krrrwwrrrk',
    'krrwrrwrrk',
    'krwrrrrwrk',
    'krrrrrrrrk',
    'kkkkkkkkkk',
  ], { k: '#5a1a0a', r: '#c8452a', w: '#ffe8c8' }],

  raminho: [[
    '......kk',
    '....kkgk',
    '..kkglk.',
    '.kgglk..',
    'kglkk...',
    'kkk.....',
  ], { k: '#1f4a17', g: '#5fae3a', l: '#a9e06a' }],
};

/** Ícones desenhados por código (formas redondas). */
function iconeSol() {
  const cv = criarCanvas(13, 13);
  const c = cv.getContext('2d');
  const y = '#f6c945', o = '#e8902a';
  for (const [x, yy] of [[6, 0], [6, 12], [0, 6], [12, 6], [2, 2], [10, 2], [2, 10], [10, 10]]) px(c, x, yy, o);
  for (const [x, yy] of [[6, 1], [6, 11], [1, 6], [11, 6]]) px(c, x, yy, y);
  elipse(c, 6, 6, 3, 3, o);
  elipse(c, 6, 6, 2, 2, y);
  px(c, 5, 5, '#fff6c0');
  return cv;
}

function iconeNuvem() {
  const cv = criarCanvas(14, 9);
  const c = cv.getContext('2d');
  elipse(c, 4, 5, 3, 2, '#94a4b0');
  elipse(c, 8, 4, 4, 3, '#94a4b0');
  elipse(c, 4, 4, 2, 2, '#dfe7ec');
  elipse(c, 8, 3, 3, 2, '#dfe7ec');
  ret(c, 1, 6, 12, 1, '#94a4b0');
  return cv;
}

const cache = new Map();

/** Canvas do ícone (com contorno leve). */
export function iconeCanvas(nome) {
  if (cache.has(nome)) return cache.get(nome);
  let cv;
  if (nome === 'sol') cv = iconeSol();
  else if (nome === 'nuvem') cv = iconeNuvem();
  else {
    const m = MAPAS[nome];
    if (!m) throw new Error(`Ícone desconhecido: ${nome}`);
    cv = spriteDeTexto(m[0], m[1]);
  }
  cache.set(nome, cv);
  return cv;
}

const cacheUrl = new Map();
/** Data URL do ícone para usar em <img>. */
export function iconeUrl(nome) {
  if (!cacheUrl.has(nome)) cacheUrl.set(nome, iconeCanvas(nome).toDataURL());
  return cacheUrl.get(nome);
}

export const NOMES_ICONES = [...Object.keys(MAPAS), 'sol', 'nuvem'];
export { comContorno };
