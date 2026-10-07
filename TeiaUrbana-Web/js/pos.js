// Pós-processamento estilo história em quadrinhos: contorno de tinta (profundidade + normais),
// retícula (halftone) nas sombras, aberração cromática e linhas de velocidade.
import * as THREE from '../vendor/three.module.min.js';
import { CAMADA_FX } from './util.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const FRAG = /* glsl */`
#include <packing>
uniform sampler2D tCor; uniform sampler2D tProf; uniform sampler2D tNormal;
uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform float uTempo;
uniform float uVel; uniform float uDano; uniform float uFoco; uniform float uLento; uniform float uFlash;
uniform vec3 uTinta; uniform float uEscala; uniform float uReticula;
varying vec2 vUv;

float profLinear(vec2 uv){ float d = texture2D(tProf, uv).x; return -perspectiveDepthToViewZ(d, uNear, uFar); }
vec3 normalEm(vec2 uv){ return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
float h11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }

void main(){
  vec2 px = 1.0 / uRes;
  vec2 c = vUv - 0.5;
  float r = length(c * vec2(uRes.x / uRes.y, 1.0));

  // Aberração cromática (cresce com a velocidade e nas bordas da tela)
  float ab = (0.0012 + uVel * 0.006 + uDano * 0.004) * smoothstep(0.15, 0.9, r);
  vec2 dirAb = normalize(c + 1e-5) * ab;
  vec3 col;
  col.r = texture2D(tCor, vUv + dirAb).r;
  col.g = texture2D(tCor, vUv).g;
  col.b = texture2D(tCor, vUv - dirAb).b;

  // Contorno: diferenças de profundidade e de normal nos vizinhos
  float t = uEscala;
  float d0 = profLinear(vUv);
  float dl = profLinear(vUv - vec2(px.x * t, 0.0)), dr = profLinear(vUv + vec2(px.x * t, 0.0));
  float du = profLinear(vUv + vec2(0.0, px.y * t)), dd = profLinear(vUv - vec2(0.0, px.y * t));
  float dMin = min(min(dl, dr), min(du, dd));
  float dMax = max(max(dl, dr), max(du, dd));
  float bordaProf = smoothstep(0.035, 0.08, (dMax - dMin) / max(d0, 0.5));
  vec3 n0 = normalEm(vUv);
  float nd = 0.0;
  nd = max(nd, 1.0 - dot(n0, normalEm(vUv - vec2(px.x * t, 0.0))));
  nd = max(nd, 1.0 - dot(n0, normalEm(vUv + vec2(px.x * t, 0.0))));
  nd = max(nd, 1.0 - dot(n0, normalEm(vUv + vec2(0.0, px.y * t))));
  nd = max(nd, 1.0 - dot(n0, normalEm(vUv - vec2(0.0, px.y * t))));
  float bordaNorm = smoothstep(0.25, 0.45, nd) * (1.0 - smoothstep(180.0, 420.0, d0));
  float ceu = step(uFar * 0.98, d0);
  float borda = max(bordaProf * (1.0 - smoothstep(700.0, 1300.0, d0) * 0.7), bordaNorm) * (1.0 - ceu * (1.0 - bordaProf));
  float fadeLonge = 1.0 - smoothstep(350.0, 1200.0, d0) * 0.55;

  // Retícula nas sombras (pontos girados 45°)
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float esc = uRes.y / 900.0;
  vec2 p = gl_FragCoord.xy / (5.0 * max(esc, 0.7));
  p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
  vec2 f = fract(p) - 0.5;
  float escuro = smoothstep(0.42, 0.06, lum) * (1.0 - ceu);
  float ponto = 1.0 - smoothstep(0.0, 0.08, length(f) - sqrt(escuro) * 0.42);
  col = mix(col, col * 0.55 + uTinta * 0.25, ponto * escuro * 0.75 * uReticula);

  // Leve realce de saturação para o visual de animação
  float l2 = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l2), col, 1.18);

  col = mix(col, uTinta, borda * 0.92 * fadeLonge);

  // Linhas de velocidade
  if (uVel > 0.01) {
    float ang = atan(c.y, c.x);
    float faixa = floor(ang * 70.0);
    float sorteio = h11(faixa + floor(uTempo * 14.0) * 13.0);
    float linha = step(0.86, sorteio) * smoothstep(0.32, 0.75, r) * uVel;
    col = mix(col, vec3(1.0), linha * 0.55);
  }

  // Câmera lenta (esquiva perfeita): bordas azuladas e dessaturadas
  if (uLento > 0.001) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 frio = mix(vec3(l), col, 0.35) * vec3(0.8, 0.9, 1.15);
    col = mix(col, frio, uLento * smoothstep(0.2, 0.75, r));
  }
  // Foco cheio: brilho dourado nas bordas
  col += vec3(1.0, 0.7, 0.2) * uFoco * smoothstep(0.55, 0.95, r) * 0.25;
  // Dano: vinheta vermelha
  col = mix(col, vec3(0.75, 0.05, 0.08), uDano * smoothstep(0.35, 0.9, r) * 0.8);
  // Vinheta
  col *= 1.0 - smoothstep(0.55, 1.15, r) * 0.45;
  col += vec3(uFlash);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class PosProcesso {
  constructor(renderer) {
    this.renderer = renderer;
    this.rtCor = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.rtCor.depthTexture = new THREE.DepthTexture(1, 1);
    this.rtCor.depthTexture.type = THREE.UnsignedIntType;
    this.rtNormal = new THREE.WebGLRenderTarget(1, 1);
    this.matNormal = new THREE.MeshNormalMaterial();
    this.uniforms = {
      tCor: { value: this.rtCor.texture }, tProf: { value: this.rtCor.depthTexture }, tNormal: { value: this.rtNormal.texture },
      uRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: 0.3 }, uFar: { value: 4000 }, uTempo: { value: 0 },
      uVel: { value: 0 }, uDano: { value: 0 }, uFoco: { value: 0 }, uLento: { value: 0 }, uFlash: { value: 0 },
      uTinta: { value: new THREE.Color('#141a3a') }, uEscala: { value: 1 }, uReticula: { value: 1 },
    };
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    }));
    this.quad.frustumCulled = false;
    this.cenaQuad = new THREE.Scene();
    this.cenaQuad.add(this.quad);
    this.camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.corLimpa = new THREE.Color(0.5, 0.5, 1.0);
  }

  redimensionar(w, h, pr) {
    const W = Math.floor(w * pr), H = Math.floor(h * pr);
    this.rtCor.setSize(W, H);
    this.rtNormal.setSize(W, H);
    this.uniforms.uRes.value.set(W, H);
    this.uniforms.uEscala.value = Math.max(1, pr * 0.9);
  }

  renderizar(cena, camera) {
    const r = this.renderer;
    this.uniforms.uNear.value = camera.near;
    this.uniforms.uFar.value = camera.far;

    // 1) cor + profundidade (tudo)
    camera.layers.enableAll();
    r.shadowMap.needsUpdate = true;
    r.setRenderTarget(this.rtCor);
    r.render(cena, camera);

    // 2) normais (só o mundo, sem céu nem efeitos), sem refazer sombras
    const fundo = cena.background, neblina = cena.fog;
    cena.overrideMaterial = this.matNormal;
    cena.background = this.corLimpa;
    cena.fog = null;
    camera.layers.set(0);
    r.setRenderTarget(this.rtNormal);
    r.render(cena, camera);
    cena.overrideMaterial = null;
    cena.background = fundo;
    cena.fog = neblina;
    camera.layers.enableAll();

    // 3) composição na tela
    r.setRenderTarget(null);
    r.render(this.cenaQuad, this.camQuad);
  }
}

export { CAMADA_FX };
