// Efeitos: fios de teia (fitas viradas para a câmera), partículas, ondas de choque
// e onomatopeias de quadrinhos ("THWIP!", "POW!") presas a pontos do mundo.
import * as THREE from '../vendor/three.module.min.js';
import { CAMADA_FX } from './util.js';

const SEG = 18;

class FioTeia {
  constructor(cena) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array((SEG + 1) * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const idx = [];
    for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.malha = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#f2f8ff', side: THREE.DoubleSide, fog: true }));
    this.malha.frustumCulled = false;
    this.malha.layers.set(CAMADA_FX);
    this.malha.visible = false;
    cena.add(this.malha);
    this.a = new THREE.Vector3();
    this.b = new THREE.Vector3();
    this.ext = 1;
    this.onda = 0;
    this.largura = 0.035;
    this.ativo = false;
  }

  definir(a, b, ext = 1, onda = 0, largura = 0.035) {
    this.a.copy(a); this.b.copy(b); this.ext = ext; this.onda = onda; this.largura = largura; this.ativo = true;
  }

  atualizar(camera, tempo) {
    this.malha.visible = this.ativo;
    if (!this.ativo) return;
    const fim = new THREE.Vector3().lerpVectors(this.a, this.b, this.ext);
    const dir = fim.clone().sub(this.a);
    const len = dir.length() || 1;
    dir.divideScalar(len);
    const lado = new THREE.Vector3();
    const perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    if (perp.lengthSq() < 1e-4) perp.set(1, 0, 0);
    perp.normalize();
    const p = new THREE.Vector3();
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      p.lerpVectors(this.a, fim, t);
      const env = Math.sin(t * Math.PI);
      p.addScaledVector(perp, Math.sin(t * 9 + tempo * 40) * this.onda * env);
      p.y -= this.onda * 0.6 * env;
      const paraCam = camera.position.clone().sub(p);
      lado.crossVectors(dir, paraCam).normalize();
      const w = this.largura * (1 + Math.min(2.5, paraCam.length() * 0.012));
      this.pos[i * 6 + 0] = p.x + lado.x * w; this.pos[i * 6 + 1] = p.y + lado.y * w; this.pos[i * 6 + 2] = p.z + lado.z * w;
      this.pos[i * 6 + 3] = p.x - lado.x * w; this.pos[i * 6 + 4] = p.y - lado.y * w; this.pos[i * 6 + 5] = p.z - lado.z * w;
    }
    this.malha.geometry.attributes.position.needsUpdate = true;
  }
}

const VERT_PART = /* glsl */`
attribute float aTam; attribute vec3 aCor; attribute float aAlfa;
varying vec3 vCor; varying float vAlfa;
uniform float uEscala;
void main(){ vCor = aCor; vAlfa = aAlfa; vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aTam * uEscala / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FRAG_PART = /* glsl */`
varying vec3 vCor; varying float vAlfa;
void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5 || vAlfa <= 0.0) discard;
  float borda = step(0.38, r); gl_FragColor = vec4(mix(vCor, vCor * 0.35, borda), vAlfa); }`;

export class Efeitos {
  constructor(cena, camera, camadaHud) {
    this.cena = cena;
    this.camera = camera;
    this.hud = camadaHud;
    this.fios = Array.from({ length: 8 }, () => new FioTeia(cena));
    this.tempo = 0;

    const MAX = 600;
    this.MAX = MAX;
    this.parts = [];
    const g = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX * 3);
    this.pTam = new Float32Array(MAX);
    this.pCor = new Float32Array(MAX * 3);
    this.pAlfa = new Float32Array(MAX);
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    g.setAttribute('aTam', new THREE.BufferAttribute(this.pTam, 1));
    g.setAttribute('aCor', new THREE.BufferAttribute(this.pCor, 3));
    g.setAttribute('aAlfa', new THREE.BufferAttribute(this.pAlfa, 1));
    this.uPart = { uEscala: { value: 600 } };
    this.pontos = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.uPart, vertexShader: VERT_PART, fragmentShader: FRAG_PART, transparent: true, depthWrite: false,
    }));
    this.pontos.frustumCulled = false;
    this.pontos.layers.set(CAMADA_FX);
    cena.add(this.pontos);
    for (let i = 0; i < MAX; i++) this.parts.push({ vivo: false, p: new THREE.Vector3(), v: new THREE.Vector3(), vida: 0, max: 1, tam: 1, cor: new THREE.Color(), grav: 0 });
    this.cursor = 0;

    this.ondas = [];
    this.onomas = [];
    this.geoAnel = new THREE.RingGeometry(0.85, 1, 40);
    this.geoAnel.rotateX(-Math.PI / 2);
  }

  pegarFio() {
    const f = this.fios.find((x) => !x.ativo && !x.reservado) || this.fios[0];
    return f;
  }

  redimensionar(altura) { this.uPart.uEscala.value = altura * 0.9; }

  emitir(pos, qtd, { vel = 6, cor = '#ffffff', tam = 0.5, vida = 0.6, grav = 0, dir = null, espalhar = 1 } = {}) {
    const c = new THREE.Color(cor);
    for (let k = 0; k < qtd; k++) {
      const pt = this.parts[this.cursor];
      this.cursor = (this.cursor + 1) % this.MAX;
      pt.vivo = true;
      pt.p.copy(pos);
      pt.v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(vel * (0.4 + Math.random() * 0.6) * espalhar);
      if (dir) pt.v.addScaledVector(dir, vel);
      pt.vida = pt.max = vida * (0.6 + Math.random() * 0.6);
      pt.tam = tam * (0.6 + Math.random() * 0.8);
      pt.cor.copy(c);
      pt.grav = grav;
    }
  }

  faiscas(pos, cor = '#ffe066') { this.emitir(pos, 14, { vel: 9, cor, tam: 0.35, vida: 0.35 }); this.emitir(pos, 5, { vel: 3, cor: '#ffffff', tam: 0.8, vida: 0.2 }); }
  poeira(pos, qtd = 18, raio = 6) { this.emitir(pos, qtd, { vel: raio, cor: '#d9d2c4', tam: 1.4, vida: 0.7, grav: -2 }); }

  onda(pos, raioMax = 8, cor = '#ffffff', dur = 0.45) {
    const m = new THREE.Mesh(this.geoAnel, new THREE.MeshBasicMaterial({ color: cor, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(pos); m.position.y += 0.15;
    m.layers.set(CAMADA_FX);
    this.cena.add(m);
    this.ondas.push({ m, t: 0, dur, raioMax });
  }

  // Onomatopeia de HQ presa a um ponto 3D
  onoma(texto, pos, estilo = 'pow', escala = 1) {
    const el = document.createElement('div');
    el.className = `onoma onoma-${estilo}`;
    el.textContent = texto;
    el.style.setProperty('--esc', escala);
    el.style.setProperty('--rot', `${(Math.random() * 24 - 12).toFixed(1)}deg`);
    this.hud.appendChild(el);
    this.onomas.push({ el, pos: pos.clone(), t: 0, dur: 0.9 });
    if (this.onomas.length > 10) { const o = this.onomas.shift(); o.el.remove(); }
  }

  atualizar(dt, dtReal) {
    this.tempo += dt;
    for (const f of this.fios) f.atualizar(this.camera, this.tempo);
    let n = 0;
    for (let i = 0; i < this.MAX; i++) {
      const pt = this.parts[i];
      if (!pt.vivo) { this.pAlfa[i] = 0; continue; }
      pt.vida -= dt;
      if (pt.vida <= 0) { pt.vivo = false; this.pAlfa[i] = 0; continue; }
      pt.v.y -= pt.grav * dt;
      pt.v.multiplyScalar(Math.exp(-3 * dt));
      pt.p.addScaledVector(pt.v, dt);
      const k = pt.vida / pt.max;
      this.pPos[i * 3] = pt.p.x; this.pPos[i * 3 + 1] = pt.p.y; this.pPos[i * 3 + 2] = pt.p.z;
      this.pTam[i] = pt.tam * (0.5 + 0.5 * k);
      this.pCor[i * 3] = pt.cor.r; this.pCor[i * 3 + 1] = pt.cor.g; this.pCor[i * 3 + 2] = pt.cor.b;
      this.pAlfa[i] = Math.min(1, k * 2);
      n++;
    }
    const at = this.pontos.geometry.attributes;
    at.position.needsUpdate = at.aTam.needsUpdate = at.aCor.needsUpdate = at.aAlfa.needsUpdate = true;

    for (let i = this.ondas.length - 1; i >= 0; i--) {
      const o = this.ondas[i];
      o.t += dt;
      const k = o.t / o.dur;
      const s = 0.5 + k * o.raioMax;
      o.m.scale.set(s, 1, s);
      o.m.material.opacity = Math.max(0, 1 - k);
      if (k >= 1) { this.cena.remove(o.m); o.m.material.dispose(); this.ondas.splice(i, 1); }
    }

    const w = innerWidth, h = innerHeight;
    const v = new THREE.Vector3();
    for (let i = this.onomas.length - 1; i >= 0; i--) {
      const o = this.onomas[i];
      o.t += dtReal;
      v.copy(o.pos).project(this.camera);
      const atras = v.z > 1;
      o.el.style.left = `${((v.x + 1) / 2) * w}px`;
      o.el.style.top = `${((1 - v.y) / 2) * h}px`;
      o.el.style.opacity = atras ? 0 : Math.min(1, (o.dur - o.t) * 4);
      if (o.t >= o.dur) { o.el.remove(); this.onomas.splice(i, 1); }
    }
    return n;
  }
}
