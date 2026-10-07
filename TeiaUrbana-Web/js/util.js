// Utilidades matemáticas e helpers compartilhados.
import * as THREE from '../vendor/three.module.min.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const suave = (a, b, t) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
// Amortecimento independente de FPS (lambda alto = segue mais rápido).
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const fatorDamp = (lambda, dt) => 1 - Math.exp(-lambda * dt);

export function difAng(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export const dampAng = (a, b, lambda, dt) => a + difAng(a, b) * fatorDamp(lambda, dt);

// Gerador pseudoaleatório com semente (mulberry32): a cidade sai sempre igual.
export function criarRng(semente) {
  let s = semente >>> 0;
  const f = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.entre = (a, b) => a + (b - a) * f();
  f.int = (a, b) => Math.floor(a + (b - a + 1) * f());
  f.escolher = (lista) => lista[Math.floor(f() * lista.length)];
  return f;
}

// Rampa de tons para o MeshToonMaterial (3 faixas de luz = visual de animação).
export function gradienteToon(niveis = [90, 170, 255]) {
  const dados = new Uint8Array(niveis);
  const tex = new THREE.DataTexture(dados, niveis.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export const GRADIENTE = gradienteToon();

export function toon(cor, extra = {}) {
  return new THREE.MeshToonMaterial({ color: cor, gradientMap: GRADIENTE, ...extra });
}

// Camadas de renderização: 0 = mundo (gera contorno), 1 = efeitos/céu (sem contorno).
export const CAMADA_FX = 1;

export function paraFx(obj) {
  obj.traverse((o) => o.layers.set(CAMADA_FX));
  return obj;
}

export function formatarTempo(seg) {
  const s = Math.max(0, seg);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
