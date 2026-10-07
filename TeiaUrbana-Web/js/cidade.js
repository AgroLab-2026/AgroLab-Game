// Cidade procedural de Nova Aurora: prédios, ruas, calçadas, parque e colisores.
// Tudo é feito de caixas alinhadas aos eixos, o que deixa colisão, raycast e escolha
// de ponto de teia rápidos e previsíveis.
import * as THREE from '../vendor/three.module.min.js';
import { criarRng, toon, GRADIENTE } from './util.js';

export const N = 12;            // quadras por lado
export const QUADRA = 70;       // distância entre eixos de rua
export const RUA = 18;          // largura da rua
export const MEIO = (N * QUADRA) / 2; // 420: ruas vão de -420 a 420
export const LIMITE = MEIO + 50;      // borda do cais
export const CALCADA = 0.25;

const PALETA = ['#d9826b', '#e8c39e', '#7fa8a8', '#6f86b5', '#b5545c', '#d6b77a', '#8fc0a9', '#9a8fb5',
  '#c96f4a', '#e3d7c0', '#6b8fb8', '#a6b0bc', '#c98f8f', '#88a37a'];
const VIDRO = ['#3f6f8f', '#2f5d7a', '#4a7f9c', '#57859e', '#3e5f86'];

// Estilos (atributo aDados.y): 0 janelas recortadas, 1 faixas, 2 pele de vidro,
// 3 liso (adereços), 4 calçada, 5 grama, 6 vidro dourado (torre).
export const ESTILO = { JANELAS: 0, FAIXAS: 1, VIDRO: 2, LISO: 3, CALCADA: 4, GRAMA: 5, OURO: 6 };

export class Caixa {
  constructor(x0, y0, z0, x1, y1, z1, tipo = 'predio') {
    this.min = new THREE.Vector3(x0, y0, z0);
    this.max = new THREE.Vector3(x1, y1, z1);
    this.tipo = tipo;
    this.marca = 0;
  }
}

// Acumula geometria não indexada com cor e dados por vértice (uma única draw call).
class Construtor {
  constructor() { this.p = []; this.n = []; this.c = []; this.d = []; }

  quad(cx, cy, cz, ux, uy, uz, vx, vy, vz, nx, ny, nz, cor, sem, est) {
    const a = [cx - ux - vx, cy - uy - vy, cz - uz - vz];
    const b = [cx + ux - vx, cy + uy - vy, cz + uz - vz];
    const c = [cx + ux + vx, cy + uy + vy, cz + uz + vz];
    const d = [cx - ux + vx, cy - uy + vy, cz - uz + vz];
    for (const v of [a, b, c, a, c, d]) {
      this.p.push(v[0], v[1], v[2]);
      this.n.push(nx, ny, nz);
      this.c.push(cor.r, cor.g, cor.b);
      this.d.push(sem, est);
    }
  }

  caixa(x0, y0, z0, x1, y1, z1, cor, sem, est, fundo = false) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    const hx = (x1 - x0) / 2, hy = (y1 - y0) / 2, hz = (z1 - z0) / 2;
    this.quad(x1, cy, cz, 0, 0, -hz, 0, hy, 0, 1, 0, 0, cor, sem, est);
    this.quad(x0, cy, cz, 0, 0, hz, 0, hy, 0, -1, 0, 0, cor, sem, est);
    this.quad(cx, cy, z1, hx, 0, 0, 0, hy, 0, 0, 0, 1, cor, sem, est);
    this.quad(cx, cy, z0, -hx, 0, 0, 0, hy, 0, 0, 0, -1, cor, sem, est);
    this.quad(cx, y1, cz, hx, 0, 0, 0, 0, -hz, 0, 1, 0, cor, sem, est);
    if (fundo) this.quad(cx, y0, cz, hx, 0, 0, 0, 0, hz, 0, -1, 0, cor, sem, est);
  }

  geometria(geo, matriz, cor, sem, est) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matriz);
    const pos = g.attributes.position, nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      this.p.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      this.n.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      this.c.push(cor.r, cor.g, cor.b);
      this.d.push(sem, est);
    }
    g.dispose();
  }

  criar() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aDados', new THREE.Float32BufferAttribute(this.d, 2));
    g.computeBoundingSphere();
    return g;
  }
}

const GLSL_HASH = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

// Material dos prédios: toon + janelas procedurais calculadas pela posição no mundo.
function materialPredios(uniforms) {
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: GRADIENTE });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aDados; varying vec2 vDados; varying vec3 vPosMundo; varying vec3 vNormMundo;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vDados = aDados; vPosMundo = (modelMatrix * vec4(transformed, 1.0)).xyz; vNormMundo = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vDados; varying vec3 vPosMundo; varying vec3 vNormMundo;
uniform float uNoite; uniform vec3 uCeuH; uniform vec3 uCeuT; uniform float uTempo;
${GLSL_HASH}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float sem = vDados.x; float est = vDados.y;
  vec3 Nm = normalize(vNormMundo); vec3 P = vPosMundo;
  float parede = 1.0 - step(0.5, abs(Nm.y));
  if (est < 2.5 || est > 5.5) {
    if (parede > 0.5) {
      float u = abs(Nm.x) > 0.5 ? P.z : P.x;
      float v = P.y;
      float colW = 2.6 + floor(fract(sem * 13.7) * 3.0) * 0.7;
      float andar = 3.4 + fract(sem * 5.3) * 0.6;
      vec2 cel = vec2(u / colW, (v - 0.25) / andar);
      vec2 f = fract(cel); vec2 id = floor(cel);
      float jan;
      if (est < 0.5) jan = step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.84);
      else if (est < 1.5) jan = step(0.32, f.y) * step(f.y, 0.86) * step(0.05, f.x) * step(f.x, 0.95);
      else jan = step(0.05, f.x) * step(f.x, 0.95) * step(0.07, f.y) * step(f.y, 0.95);
      if (v < 4.8) { float fu = fract(u / 6.5); jan = step(0.08, fu) * step(fu, 0.92) * step(0.7, v) * step(v, 3.9); id = vec2(floor(u / 6.5), -7.0); }
      float h = hash12(id + sem * 91.0);
      float alturaRel = clamp(v / 140.0, 0.0, 1.0);
      vec3 reflexo = mix(uCeuH, uCeuT, clamp(alturaRel * 0.8 + h * 0.3, 0.0, 1.0));
      vec3 vidro = mix(vec3(0.07, 0.11, 0.2), reflexo, mix(0.32, 0.1, uNoite) + h * 0.14);
      if (est > 1.5 && est < 2.5) vidro = mix(diffuseColor.rgb * 0.7, reflexo, 0.45 + 0.3 * alturaRel) * mix(1.0, 0.35, uNoite);
      if (est > 5.5) vidro = mix(vec3(0.95, 0.72, 0.35), reflexo, 0.35) * mix(1.0, 0.45, uNoite);
      // reflexo diagonal estilizado no vidro
      float diag = step(0.86, fract((u * 0.6 + v) * 0.035 + sem * 3.1)) * (1.0 - uNoite);
      vidro = mix(vidro, mix(reflexo, vec3(1.0), 0.6), diag * 0.55);
      diffuseColor.rgb = mix(diffuseColor.rgb, vidro, jan);
      float acesa = step(h, mix(0.05, 0.42, uNoite));
      vec3 luz = mix(vec3(1.0, 0.72, 0.38), vec3(0.62, 0.82, 1.0), step(0.75, fract(h * 7.31)));
      if (v < 4.8) { acesa = step(0.25, uNoite); luz = vec3(1.0, 0.85, 0.6); }
      totalEmissiveRadiance += luz * jan * acesa * (0.12 + 0.75 * uNoite) * (0.75 + 0.5 * fract(h * 3.7));
      totalEmissiveRadiance += reflexo * jan * 0.12 * (1.0 - uNoite);
      diffuseColor.rgb *= mix(0.6, 1.0, smoothstep(0.0, 20.0, v));
    } else if (Nm.y > 0.5) {
      vec2 pl = fract(P.xz / 3.0);
      float junta = clamp(step(pl.x, 0.04) + step(pl.y, 0.04), 0.0, 1.0);
      float g = hash12(floor(P.xz / 3.0) + sem);
      vec3 laje = mix(vec3(0.66, 0.65, 0.66), diffuseColor.rgb, 0.25);
      float mancha = smoothstep(0.55, 0.6, hash12(floor(P.xz / 9.0) + sem * 3.0));
      diffuseColor.rgb = laje * (0.9 + 0.14 * g) * (1.0 - 0.3 * junta) * (1.0 - 0.12 * mancha);
    }
  } else if (est < 3.5) {
    diffuseColor.rgb *= mix(0.75, 1.0, smoothstep(0.0, 12.0, P.y));
  } else if (est < 4.5) {
    vec2 t = fract(P.xz / 2.0);
    float linha = step(t.x, 0.04) + step(t.y, 0.04);
    diffuseColor.rgb *= 1.0 - 0.12 * clamp(linha, 0.0, 1.0);
    if (Nm.y < 0.5) diffuseColor.rgb *= 0.8;
  } else {
    float faixa = step(0.5, fract((P.x + P.z) / 6.0));
    float g = hash12(floor(P.xz * 2.0));
    diffuseColor.rgb *= 0.9 + 0.1 * faixa + 0.06 * g;
  }
}`);
  };
  m.customProgramCacheKey = () => 'predios-v1';
  return m;
}

// Asfalto com faixas, faixas de pedestre e calçadão fora da grade.
function materialChao(uniforms) {
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRADIENTE });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vPosMundo; varying vec3 vNormMundo;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vPosMundo = (modelMatrix * vec4(transformed, 1.0)).xyz; vNormMundo = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vPosMundo; varying vec3 vNormMundo; uniform float uNoite;
${GLSL_HASH}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 w = vPosMundo.xz;
  vec3 asfalto = vec3(0.2, 0.22, 0.29);
  vec3 cor;
  float ruido = hash12(floor(w * 3.0));
  if (vNormMundo.y < 0.5) {
    cor = vec3(0.55, 0.53, 0.5) * (0.8 + 0.2 * step(0.5, fract(vPosMundo.y / 1.2)));
  } else if (max(abs(w.x), abs(w.y)) > ${MEIO.toFixed(1)} + 9.0) {
    vec2 t = fract(w / 4.0);
    cor = vec3(0.62, 0.6, 0.56) * (1.0 - 0.1 * clamp(step(t.x, 0.03) + step(t.y, 0.03), 0.0, 1.0));
  } else {
    vec2 l = mod(w + ${MEIO.toFixed(1)}, ${QUADRA.toFixed(1)});
    vec2 dr = min(l, ${QUADRA.toFixed(1)} - l);
    cor = asfalto;
    bool rx = dr.x < 9.0; bool rz = dr.y < 9.0;
    if (rx && !rz) {
      if (dr.x < 0.16 && fract(w.y / 8.0) < 0.55) cor = vec3(0.95, 0.78, 0.25);
      if (abs(dr.x - 4.4) < 0.1 && fract(w.y / 5.0) < 0.4) cor = vec3(0.8);
      if (dr.y < 13.0 && dr.x < 8.4 && fract(w.x / 1.3) < 0.5) cor = vec3(0.86, 0.86, 0.84);
    } else if (rz && !rx) {
      if (dr.y < 0.16 && fract(w.x / 8.0) < 0.55) cor = vec3(0.95, 0.78, 0.25);
      if (abs(dr.y - 4.4) < 0.1 && fract(w.x / 5.0) < 0.4) cor = vec3(0.8);
      if (dr.x < 13.0 && dr.y < 8.4 && fract(w.y / 1.3) < 0.5) cor = vec3(0.86, 0.86, 0.84);
    }
    cor *= 0.94 + 0.08 * ruido;
  }
  diffuseColor.rgb = cor;
}`);
  };
  m.customProgramCacheKey = () => 'chao-v1';
  return m;
}

export class Cidade {
  constructor(cena, uniforms, semente = 2026) {
    this.cena = cena;
    this.uniforms = uniforms;
    this.rng = criarRng(semente);
    this.colisores = [];
    this.telhados = [];   // topo de cada prédio (para coletáveis, spawns, mapa)
    this.predios = [];    // pegadas para o minimapa
    this.parque = [];     // lotes de parque
    this.marcaAtual = 0;
    this.CEL = 40;
    this.ORIG = -LIMITE - 40;
    this.DIM = Math.ceil((2 * LIMITE + 80) / this.CEL);
    this.grade = Array.from({ length: this.DIM * this.DIM }, () => []);
    this.gerar();
  }

  addColisor(c) {
    this.colisores.push(c);
    const i0 = Math.max(0, Math.floor((c.min.x - this.ORIG) / this.CEL));
    const i1 = Math.min(this.DIM - 1, Math.floor((c.max.x - this.ORIG) / this.CEL));
    const j0 = Math.max(0, Math.floor((c.min.z - this.ORIG) / this.CEL));
    const j1 = Math.min(this.DIM - 1, Math.floor((c.max.z - this.ORIG) / this.CEL));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) this.grade[i * this.DIM + j].push(c);
    return c;
  }

  consultar(x0, z0, x1, z1, saida = []) {
    saida.length = 0;
    const m = ++this.marcaAtual;
    const i0 = Math.max(0, Math.floor((x0 - this.ORIG) / this.CEL));
    const i1 = Math.min(this.DIM - 1, Math.floor((x1 - this.ORIG) / this.CEL));
    const j0 = Math.max(0, Math.floor((z0 - this.ORIG) / this.CEL));
    const j1 = Math.min(this.DIM - 1, Math.floor((z1 - this.ORIG) / this.CEL));
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        for (const c of this.grade[i * this.DIM + j]) {
          if (c.marca === m) continue;
          c.marca = m;
          if (c.max.x < x0 || c.min.x > x1 || c.max.z < z0 || c.min.z > z1) continue;
          saida.push(c);
        }
      }
    }
    return saida;
  }

  dentroDaIlha(x, z) { return Math.abs(x) <= LIMITE && Math.abs(z) <= LIMITE; }

  // Altura do chão mais alto sob (x,z) que não está acima de yRef (+ degrau).
  alturaSolo(x, z, yRef = 1e9) {
    let h = this.dentroDaIlha(x, z) ? 0 : -1e9;
    for (const c of this.consultar(x - 0.01, z - 0.01, x + 0.01, z + 0.01, this._tmpSolo || (this._tmpSolo = []))) {
      if (x >= c.min.x && x <= c.max.x && z >= c.min.z && z <= c.max.z && c.max.y <= yRef + 0.6 && c.max.y > h) h = c.max.y;
    }
    return h;
  }

  // Raycast contra as caixas e o chão. Retorna {dist, ponto, normal, caixa} ou null.
  raycast(o, d, maxDist, ignorarPequenas = false) {
    let melhor = maxDist, normal = null, caixa = null;
    const passo = 24;
    const lista = this._tmpRay || (this._tmpRay = []);
    for (let t0 = 0; t0 < maxDist; t0 += passo) {
      const t1 = Math.min(maxDist, t0 + passo);
      const ax = o.x + d.x * t0, az = o.z + d.z * t0, bx = o.x + d.x * t1, bz = o.z + d.z * t1;
      this.consultar(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), lista);
      for (const c of lista) {
        if (ignorarPequenas && c.tipo === 'calcada') continue;
        const r = this.raioCaixa(o, d, c);
        if (r && r.t < melhor) { melhor = r.t; normal = r.n; caixa = c; }
      }
      if (melhor <= t1) break;
    }
    if (d.y < -1e-4) {
      const t = -o.y / d.y;
      if (t >= 0 && t < melhor) {
        const px = o.x + d.x * t, pz = o.z + d.z * t;
        if (this.dentroDaIlha(px, pz)) { melhor = t; normal = new THREE.Vector3(0, 1, 0); caixa = null; }
      }
    }
    if (!normal) return null;
    return { dist: melhor, ponto: o.clone().addScaledVector(d, melhor), normal, caixa };
  }

  raioCaixa(o, d, c) {
    let tmin = -Infinity, tmax = Infinity, eixo = -1, sinal = 0;
    const os = [o.x, o.y, o.z], ds = [d.x, d.y, d.z];
    const mn = [c.min.x, c.min.y, c.min.z], mx = [c.max.x, c.max.y, c.max.z];
    for (let k = 0; k < 3; k++) {
      if (Math.abs(ds[k]) < 1e-9) {
        if (os[k] < mn[k] || os[k] > mx[k]) return null;
      } else {
        let t1 = (mn[k] - os[k]) / ds[k], t2 = (mx[k] - os[k]) / ds[k];
        let s = -1;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
        if (t1 > tmin) { tmin = t1; eixo = k; sinal = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return null;
      }
    }
    if (tmax < 0 || tmin < 0 || eixo < 0) return null;
    const n = new THREE.Vector3();
    n.setComponent(eixo, sinal);
    return { t: tmin, n };
  }

  // ------------------------------------------------------------------ geração
  gerar() {
    const r = this.rng;
    const b = new Construtor();
    const cor = new THREE.Color();
    const corCalcada = new THREE.Color('#b9b3a8');
    const corGrama = new THREE.Color('#6fae5a');
    const arvores = [];
    this.torre = null;

    const torreI = 6, torreJ = 5;
    const parqueI = [2, 3], parqueJ = [7, 8];

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x0 = -MEIO + i * QUADRA + RUA / 2, x1 = x0 + QUADRA - RUA;
        const z0 = -MEIO + j * QUADRA + RUA / 2, z1 = z0 + QUADRA - RUA;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const ehParque = parqueI.includes(i) && parqueJ.includes(j);

        if (ehParque) {
          b.caixa(x0, 0, z0, x1, CALCADA + 0.05, z1, corGrama, r(), ESTILO.GRAMA);
          this.addColisor(new Caixa(x0, 0, z0, x1, CALCADA + 0.05, z1, 'calcada'));
          this.parque.push({ x0, z0, x1, z1 });
          const qtd = r.int(14, 22);
          for (let k = 0; k < qtd; k++) arvores.push([r.entre(x0 + 3, x1 - 3), r.entre(z0 + 3, z1 - 3), r.entre(0.8, 1.4)]);
          // coreto no parque
          if (i === parqueI[0] && j === parqueJ[0]) {
            cor.set('#e9e1d0');
            b.caixa(x1 - 12, CALCADA, z1 - 12, x1 - 2, CALCADA + 0.6, z1 - 2, cor, 0.3, ESTILO.LISO);
            this.addColisor(new Caixa(x1 - 12, 0, z1 - 12, x1 - 2, CALCADA + 0.6, z1 - 2));
          }
          continue;
        }

        b.caixa(x0, 0, z0, x1, CALCADA, z1, corCalcada, r(), ESTILO.CALCADA);
        this.addColisor(new Caixa(x0, 0, z0, x1, CALCADA, z1, 'calcada'));

        const bx0 = x0 + 3.5, bx1 = x1 - 3.5, bz0 = z0 + 3.5, bz1 = z1 - 3.5;
        if (i === torreI && j === torreJ) { this.construirTorre(b, cx, cz); continue; }

        const dist = Math.hypot(cx, cz) / MEIO;
        const base = 26 + 150 * Math.exp(-dist * dist * 2.4);
        const lotes = [];
        const sorte = r();
        if (sorte < 0.3) lotes.push([bx0, bz0, bx1, bz1]);
        else if (sorte < 0.65) {
          const g = r() < 0.5 ? 0 : 3;
          if (r() < 0.5) { const m = r.entre(bx0 + 16, bx1 - 16); lotes.push([bx0, bz0, m - g / 2, bz1], [m + g / 2, bz0, bx1, bz1]); }
          else { const m = r.entre(bz0 + 16, bz1 - 16); lotes.push([bx0, bz0, bx1, m - g / 2], [bx0, m + g / 2, bx1, bz1]); }
        } else {
          const mx = r.entre(bx0 + 17, bx1 - 17), mz = r.entre(bz0 + 17, bz1 - 17), g = 2;
          lotes.push([bx0, bz0, mx - g, mz - g], [mx + g, bz0, bx1, mz - g], [bx0, mz + g, mx - g, bz1], [mx + g, mz + g, bx1, bz1]);
        }
        for (const [fx0, fz0, fx1, fz1] of lotes) {
          let h = base * r.entre(0.5, 1.3) * (lotes.length === 4 ? 0.8 : 1);
          if (r() < 0.06) h *= 1.6;
          h = Math.max(14, Math.min(230, h));
          this.construirPredio(b, fx0, fz0, fx1, fz1, h);
        }
      }
    }

    // Geometria final dos prédios
    this.matPredios = materialPredios(this.uniforms);
    const malha = new THREE.Mesh(b.criar(), this.matPredios);
    malha.castShadow = true;
    malha.receiveShadow = true;
    malha.frustumCulled = false;
    this.cena.add(malha);
    this.malhaPredios = malha;

    // Laje do chão (com muro do cais)
    this.matChao = materialChao(this.uniforms);
    const laje = new THREE.Mesh(new THREE.BoxGeometry(LIMITE * 2, 12, LIMITE * 2), this.matChao);
    laje.position.y = -6;
    laje.receiveShadow = true;
    this.cena.add(laje);

    this.criarArvores(arvores);
    this.criarPostes();
  }

  construirPredio(b, x0, z0, x1, z1, h) {
    const r = this.rng;
    const cor = new THREE.Color();
    let estilo;
    const e = r();
    if (h > 100 && e < 0.55) estilo = ESTILO.VIDRO;
    else estilo = e < 0.5 ? ESTILO.JANELAS : e < 0.8 ? ESTILO.FAIXAS : ESTILO.VIDRO;
    cor.set(estilo === ESTILO.VIDRO ? r.escolher(VIDRO) : r.escolher(PALETA));
    const sem = r();
    const corBorda = cor.clone().multiplyScalar(0.72).lerp(new THREE.Color('#e8e2d6'), 0.25);
    const corLiso = new THREE.Color('#8a8d96');

    const niveis = h > 70 ? (r() < 0.5 ? 2 : 3) : (r() < 0.3 ? 2 : 1);
    let y = CALCADA;
    let a = [x0, z0, x1, z1];
    const fracs = niveis === 1 ? [1] : niveis === 2 ? [r.entre(0.6, 0.78)] : [r.entre(0.5, 0.62), r.entre(0.22, 0.3)];
    if (niveis > 1) fracs.push(1 - fracs.reduce((s, v) => s + v, 0));
    for (let k = 0; k < niveis; k++) {
      const hk = h * fracs[k];
      const yt = y + hk;
      b.caixa(a[0], y, a[1], a[2], yt, a[3], cor, sem, estilo);
      this.addColisor(new Caixa(a[0], y, a[1], a[2], yt, a[3]));
      // cornija
      b.caixa(a[0] - 0.35, yt - 0.7, a[1] - 0.35, a[2] + 0.35, yt + 0.25, a[3] + 0.35, corBorda, sem, ESTILO.LISO);
      this.predios.push({ x0: a[0], z0: a[1], x1: a[2], z1: a[3], h: yt });
      y = yt;
      if (k < niveis - 1) {
        const w = a[2] - a[0], d = a[3] - a[1];
        const ins = () => r.entre(2, Math.max(2.5, Math.min(w, d) * 0.2));
        a = [a[0] + ins(), a[1] + ins(), a[2] - ins(), a[3] - ins()];
        if (a[2] - a[0] < 6 || a[3] - a[1] < 6) break;
      }
    }
    const topo = y + 0.25;
    this.telhados.push({ x: (a[0] + a[2]) / 2, z: (a[1] + a[3]) / 2, y: topo, x0: a[0], z0: a[1], x1: a[2], z1: a[3] });

    // Adereços no telhado
    const w = a[2] - a[0], d = a[3] - a[1];
    if (w > 10 && d > 10 && r() < 0.45 && h < 150) {
      const tx = r.entre(a[0] + 4, a[2] - 4), tz = r.entre(a[1] + 4, a[3] - 4);
      this.caixaDAgua(b, tx, topo, tz);
    }
    const nAc = r.int(0, 3);
    for (let k = 0; k < nAc; k++) {
      const ax = r.entre(a[0] + 2, a[2] - 4), az = r.entre(a[1] + 2, a[3] - 3);
      b.caixa(ax, topo, az, ax + 2.2, topo + 1.3, az + 1.6, corLiso, sem, ESTILO.LISO);
      this.addColisor(new Caixa(ax, topo, az, ax + 2.2, topo + 1.3, az + 1.6, 'adereco'));
    }
    if (r() < 0.5 && w > 8 && d > 8) {
      const sx = r.entre(a[0] + 1, a[2] - 5), sz = r.entre(a[1] + 1, a[3] - 5);
      b.caixa(sx, topo, sz, sx + 3.6, topo + 3, sz + 3.6, corBorda, sem, ESTILO.LISO);
      this.addColisor(new Caixa(sx, topo, sz, sx + 3.6, topo + 3, sz + 3.6, 'adereco'));
    }
    if (h > 130 && r() < 0.6) {
      const cx = (a[0] + a[2]) / 2, cz = (a[1] + a[3]) / 2, ha = r.entre(10, 26);
      b.caixa(cx - 0.25, topo, cz - 0.25, cx + 0.25, topo + ha, cz + 0.25, new THREE.Color('#c9cbd3'), sem, ESTILO.LISO);
      b.caixa(cx - 0.5, topo + ha, cz - 0.5, cx + 0.5, topo + ha + 0.8, cz + 0.5, new THREE.Color('#ff4040'), sem, ESTILO.LISO);
    }
  }

  caixaDAgua(b, x, y, z) {
    const madeira = new THREE.Color('#8a5a3c'), escuro = new THREE.Color('#4a3a33');
    const m = new THREE.Matrix4();
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
      b.caixa(x + dx - 0.15, y, z + dz - 0.15, x + dx + 0.15, y + 2.6, z + dz + 0.15, escuro, 0, ESTILO.LISO);
    }
    const cil = new THREE.CylinderGeometry(2.3, 2.3, 4.2, 14, 1);
    m.makeTranslation(x, y + 2.6 + 2.1, z);
    b.geometria(cil, m, madeira, 0, ESTILO.LISO);
    const cone = new THREE.ConeGeometry(2.5, 1.6, 14, 1);
    m.makeTranslation(x, y + 2.6 + 4.2 + 0.8, z);
    b.geometria(cone, m, escuro, 0, ESTILO.LISO);
    this.addColisor(new Caixa(x - 2.3, y + 2.4, z - 2.3, x + 2.3, y + 7.6, z + 2.3, 'adereco'));
  }

  construirTorre(b, cx, cz) {
    const ouro = new THREE.Color('#c9a35a');
    const borda = new THREE.Color('#e8dcc0');
    const niveis = [[22, 130], [17, 210], [12, 262], [7, 288]];
    let y = CALCADA;
    for (const [m, yt] of niveis) {
      b.caixa(cx - m, y, cz - m, cx + m, yt, cz + m, ouro, 0.77, ESTILO.OURO);
      this.addColisor(new Caixa(cx - m, y, cz - m, cx + m, yt, cz + m));
      b.caixa(cx - m - 0.6, yt - 1.2, cz - m - 0.6, cx + m + 0.6, yt + 0.4, cz + m + 0.6, borda, 0, ESTILO.LISO);
      this.predios.push({ x0: cx - m, z0: cz - m, x1: cx + m, z1: cz + m, h: yt });
      y = yt;
    }
    b.caixa(cx - 0.6, y, cz - 0.6, cx + 0.6, y + 46, cz + 0.6, borda, 0, ESTILO.LISO);
    b.caixa(cx - 1, y + 46, cz - 1, cx + 1, y + 48, cz + 1, new THREE.Color('#ff5050'), 0, ESTILO.LISO);
    this.addColisor(new Caixa(cx - 0.6, y, cz - 0.6, cx + 0.6, y + 46, cz + 0.6, 'adereco'));
    this.torre = { x: cx, z: cz, topo: y + 0.4 };
    this.telhados.push({ x: cx, z: cz, y: y + 0.4, x0: cx - 7, z0: cz - 7, x1: cx + 7, z1: cz + 7, torre: true });
  }

  criarArvores(lista) {
    const tronco = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 6), toon('#6b4a35'), lista.length);
    const geoCopa = new THREE.IcosahedronGeometry(2.6, 1); geoCopa.computeVertexNormals();
    const copa = new THREE.InstancedMesh(geoCopa, toon('#ffffff'), lista.length);
    const m = new THREE.Matrix4(), cor = new THREE.Color();
    const verdes = ['#4f9a4a', '#6cb35a', '#3f8a55', '#86b84f'];
    lista.forEach(([x, z, s], k) => {
      m.makeScale(s, s, s).setPosition(x, CALCADA + 1.5 * s, z);
      tronco.setMatrixAt(k, m);
      m.makeScale(s, s * 1.1, s).setPosition(x, CALCADA + 4.2 * s, z);
      copa.setMatrixAt(k, m);
      copa.setColorAt(k, cor.set(verdes[k % verdes.length]));
    });
    for (const o of [tronco, copa]) { o.castShadow = true; o.receiveShadow = true; this.cena.add(o); }
  }

  criarPostes() {
    // Postes nas esquinas: dão escala e brilham à noite.
    const pontos = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x0 = -MEIO + i * QUADRA + RUA / 2, z0 = -MEIO + j * QUADRA + RUA / 2;
      pontos.push([x0 + 0.8, z0 + 0.8], [x0 + QUADRA - RUA - 0.8, z0 + QUADRA - RUA - 0.8]);
    }
    const haste = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 5), toon('#3d4250'), pontos.length);
    this.matLampada = new THREE.MeshBasicMaterial({ color: '#fff1c4' });
    const lamp = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), this.matLampada, pontos.length);
    const m = new THREE.Matrix4();
    pontos.forEach(([x, z], k) => {
      m.makeTranslation(x, CALCADA + 3.5, z); haste.setMatrixAt(k, m);
      m.makeTranslation(x, CALCADA + 7.1, z); lamp.setMatrixAt(k, m);
    });
    haste.castShadow = true;
    this.cena.add(haste, lamp);
  }

  // Ponto aleatório no meio de uma rua (para crimes e perseguições).
  pontoDeRua(rng = Math.random, perto = null, raioMin = 0, raioMax = 1e9) {
    for (let t = 0; t < 200; t++) {
      const k = Math.floor(rng() * (N + 1));
      const linha = -MEIO + k * QUADRA;
      const ao = (rng() * 2 - 1) * (MEIO - 20);
      // evita os cruzamentos
      const l = ((ao + MEIO) % QUADRA + QUADRA) % QUADRA;
      if (l < 14 || l > QUADRA - 14) continue;
      const p = rng() < 0.5 ? new THREE.Vector3(linha, 0, ao) : new THREE.Vector3(ao, 0, linha);
      p.eixoRua = p.x === linha ? 'z' : 'x';
      if (perto) {
        const d = Math.hypot(p.x - perto.x, p.z - perto.z);
        if (d < raioMin || d > raioMax) continue;
      }
      return p;
    }
    return new THREE.Vector3(0, 0, 0);
  }
}
