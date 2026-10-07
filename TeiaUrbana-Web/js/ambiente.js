// Céu estilizado (nuvens em dois tons, sol, estrelas), ciclo de dia, luzes, neblina e mar.
import * as THREE from '../vendor/three.module.min.js';
import { CAMADA_FX, lerp } from './util.js';
import { LIMITE } from './cidade.js';

// Quadros-chave do dia: [hora, topo, horizonte, sol, intensidadeSol, ambiente, noite]
const CHAVES = [
  [0, '#060a20', '#1a2550', '#8fa6ff', 0.55, 0.45, 1],
  [5, '#0b1236', '#2c3268', '#9fb0ff', 0.5, 0.45, 1],
  [6.3, '#41558f', '#f6a77a', '#ffc690', 1.3, 0.7, 0.45],
  [8.5, '#3d84d2', '#b8dcf0', '#fff1d8', 2.2, 0.95, 0],
  [12, '#3388d8', '#c4e4f4', '#fffaf0', 2.5, 1.0, 0],
  [16, '#3a78c8', '#cfe0ec', '#ffe9c4', 2.3, 0.95, 0],
  [17.6, '#3b4f9a', '#ff9e6b', '#ffb070', 2.0, 0.85, 0.25],
  [18.7, '#2a2361', '#ee5f7d', '#ff7a5c', 1.1, 0.65, 0.6],
  [19.8, '#0f1238', '#3b2f6e', '#a58cff', 0.6, 0.5, 0.95],
  [24, '#060a20', '#1a2550', '#8fa6ff', 0.55, 0.45, 1],
];

const C = (h) => new THREE.Color(h);
const CHAVES_COR = CHAVES.map((k) => ({ h: k[0], topo: C(k[1]), hor: C(k[2]), sol: C(k[3]), iSol: k[4], amb: k[5], noite: k[6] }));

const VERT_CEU = /* glsl */`
varying vec3 vDir;
void main(){ vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;

const FRAG_CEU = /* glsl */`
uniform vec3 uTopo; uniform vec3 uHor; uniform vec3 uSolCor; uniform vec3 uSolDir; uniform float uNoite; uniform float uTempo;
varying vec3 vDir;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float ruido(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<5;i++){ s += a*ruido(p); p = p*2.03 + 7.1; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHor, uTopo, pow(smoothstep(-0.02, 0.55, h), 0.75));
  col = mix(col, uHor * 0.55, smoothstep(0.0, -0.25, h));
  float s = max(dot(d, uSolDir), 0.0);
  col += uSolCor * (pow(s, 6.0) * 0.28 + pow(s, 60.0) * 0.5) * (1.0 - uNoite * 0.6);
  float disco = smoothstep(0.9990, 0.9994, s);
  col = mix(col, mix(vec3(1.0, 0.96, 0.85), vec3(0.92, 0.94, 1.0), uNoite), disco);
  // nuvens em dois tons (estilo animação)
  if (h > 0.0) {
    vec2 p = d.xz / (h + 0.18) * 1.4 + vec2(uTempo * 0.006, uTempo * 0.002);
    float n = fbm(p);
    float n2 = fbm(p - uSolDir.xz * 0.12);
    float massa = smoothstep(0.56, 0.575, n) * smoothstep(0.0, 0.12, h);
    float luz = step(n2, n - 0.012);
    vec3 sombra = mix(uTopo, uHor, 0.55) * mix(0.95, 0.6, uNoite);
    vec3 clara = mix(uHor, vec3(1.0, 0.95, 0.9), 0.55) * mix(1.0, 0.45, uNoite);
    clara = mix(clara, uSolCor, 0.25);
    col = mix(col, mix(sombra, clara, luz), massa * 0.95);
    // estrelas
    vec2 g = floor(d.xz / (h + 0.3) * 260.0);
    float est = step(0.9975, h21(g)) * uNoite * smoothstep(0.1, 0.4, h) * (1.0 - massa);
    col += vec3(est);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const FRAG_MAR = /* glsl */`
uniform vec3 uCor; uniform vec3 uCorFundo; uniform vec3 uHor; uniform float uTempo; uniform float uNoite; uniform vec3 uSolDir;
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
varying vec3 vPos;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float ruido(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 p = vPos.xz * 0.05;
  float n = ruido(p + uTempo * 0.25) * 0.6 + ruido(p * 2.3 - uTempo * 0.3) * 0.4;
  vec3 col = mix(uCorFundo, uCor, 0.5 + 0.5 * step(0.5, n));
  float brilho = step(0.83, ruido(p * 4.0 + vec2(uTempo * 0.6, 0.0)));
  col = mix(col, mix(uHor, vec3(1.0), 0.5), brilho * 0.6);
  // espuma no cais
  float borda = max(abs(vPos.x), abs(vPos.z)) - ${LIMITE.toFixed(1)};
  col = mix(vec3(0.92, 0.95, 1.0) * mix(1.0, 0.45, uNoite), col, smoothstep(1.5, 5.0 + 2.0 * sin(uTempo * 1.7 + vPos.x * 0.1), borda));
  float dist = length(vPos - cameraPosition);
  float f = smoothstep(fogNear, fogFar, dist);
  gl_FragColor = vec4(mix(col, fogColor, f), 1.0);
  #include <colorspace_fragment>
}`;

export class Ambiente {
  constructor(cena, uniformsCidade) {
    this.cena = cena;
    this.u = uniformsCidade;
    this.hora = 17.0;
    this.velocidadeDia = 24 / (36 * 60); // um dia inteiro a cada 36 minutos
    this.pausarCiclo = false;

    this.uCeu = {
      uTopo: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSolCor: { value: new THREE.Color() },
      uSolDir: { value: new THREE.Vector3(0, 1, 0) }, uNoite: { value: 0 }, uTempo: { value: 0 },
    };
    const ceu = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.uCeu, vertexShader: VERT_CEU, fragmentShader: FRAG_CEU, side: THREE.BackSide, depthWrite: false, fog: false }));
    ceu.frustumCulled = false;
    ceu.renderOrder = -10;
    ceu.layers.set(CAMADA_FX);
    this.ceu = ceu;
    cena.add(ceu);

    cena.fog = new THREE.Fog(0xffffff, 160, 1250);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    cena.add(this.hemi);
    this.sol = new THREE.DirectionalLight(0xffffff, 2);
    this.sol.castShadow = true;
    const s = this.sol.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.left = -110; s.camera.right = 110; s.camera.top = 110; s.camera.bottom = -110;
    s.camera.near = 10; s.camera.far = 900;
    s.bias = -0.0008;
    s.normalBias = 0.9;
    cena.add(this.sol, this.sol.target);

    // Mar
    this.uMar = {
      uCor: { value: new THREE.Color('#2f7fae') }, uCorFundo: { value: new THREE.Color('#1f5a86') }, uHor: { value: new THREE.Color() },
      uTempo: { value: 0 }, uNoite: { value: 0 }, uSolDir: this.uCeu.uSolDir,
      fogColor: { value: cena.fog.color }, fogNear: { value: 160 }, fogFar: { value: 1250 },
    };
    const mar = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000, 1, 1), new THREE.ShaderMaterial({
      uniforms: this.uMar,
      vertexShader: 'varying vec3 vPos; void main(){ vPos = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vPos,1.0); }',
      fragmentShader: FRAG_MAR,
    }));
    mar.rotation.x = -Math.PI / 2;
    mar.position.y = -2.2;
    cena.add(mar);

    this.corNeblina = new THREE.Color();
    this.noite = 0;
    this.aplicar();
  }

  amostra(h) {
    let a = CHAVES_COR[0], b = CHAVES_COR[1];
    for (let i = 0; i < CHAVES_COR.length - 1; i++) {
      if (h >= CHAVES_COR[i].h && h <= CHAVES_COR[i + 1].h) { a = CHAVES_COR[i]; b = CHAVES_COR[i + 1]; break; }
    }
    const t = (h - a.h) / Math.max(1e-6, b.h - a.h);
    return { a, b, t };
  }

  aplicar() {
    const { a, b, t } = this.amostra(this.hora);
    const topo = a.topo.clone().lerp(b.topo, t), hor = a.hor.clone().lerp(b.hor, t), solCor = a.sol.clone().lerp(b.sol, t);
    const iSol = lerp(a.iSol, b.iSol, t), amb = lerp(a.amb, b.amb, t), noite = lerp(a.noite, b.noite, t);
    this.noite = noite;

    // Sol (de dia) ou lua (de noite)
    const ang = ((this.hora - 6) / 12) * Math.PI;
    const dirSol = new THREE.Vector3(Math.cos(ang) * 0.85, Math.sin(ang), 0.42).normalize();
    const dirLuz = dirSol.y > 0.06 ? dirSol : new THREE.Vector3(-dirSol.x * 0.6, Math.max(0.35, -dirSol.y), -0.5).normalize();
    this.dirLuz = dirLuz;
    this.uCeu.uTopo.value.copy(topo);
    this.uCeu.uHor.value.copy(hor);
    this.uCeu.uSolCor.value.copy(solCor);
    this.uCeu.uSolDir.value.copy(dirSol.y > -0.1 ? dirSol : dirLuz);
    this.uCeu.uNoite.value = noite;

    this.sol.color.copy(solCor);
    this.sol.intensity = iSol;
    this.hemi.color.copy(topo).lerp(new THREE.Color('#ffffff'), 0.45);
    this.hemi.groundColor.copy(hor).multiplyScalar(0.45);
    this.hemi.intensity = amb * 1.6;

    this.corNeblina.copy(hor).lerp(topo, 0.15);
    this.cena.fog.color.copy(this.corNeblina);
    this.u.uNoite.value = noite;
    this.u.uCeuH.value.copy(hor);
    this.u.uCeuT.value.copy(topo);
    this.uMar.uHor.value.copy(hor);
    this.uMar.uNoite.value = noite;
    this.uMar.uCor.value.set('#2f86b3').lerp(hor, 0.25).multiplyScalar(lerp(1, 0.35, noite));
    this.uMar.uCorFundo.value.set('#1d5b8a').lerp(topo, 0.2).multiplyScalar(lerp(1, 0.35, noite));
  }

  avancar(horas) { this.hora = (this.hora + horas + 24) % 24; this.aplicar(); }

  atualizar(dt, alvo) {
    if (!this.pausarCiclo) this.hora = (this.hora + dt * this.velocidadeDia) % 24;
    this.uCeu.uTempo.value += dt;
    this.uMar.uTempo.value += dt;
    this.u.uTempo.value += dt;
    this.aplicar();
    // Sombra acompanha o jogador (texels estáveis para não "nadar")
    const passo = 220 / 2048;
    const cx = Math.round(alvo.x / passo) * passo, cz = Math.round(alvo.z / passo) * passo;
    this.sol.target.position.set(cx, 0, cz);
    this.sol.position.set(cx + this.dirLuz.x * 450, this.dirLuz.y * 450, cz + this.dirLuz.z * 450);
    this.ceu.position.copy(alvo);
  }
}
