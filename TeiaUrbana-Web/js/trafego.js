// Vida da cidade: carros nas faixas (instanciados) e pedestres nas calçadas.
import * as THREE from '../vendor/three.module.min.js';
import { N, QUADRA, RUA, MEIO, CALCADA } from './cidade.js';
import { toon, criarRng } from './util.js';

function mesclar(partes) {
  const pos = [], nor = [], cor = [];
  for (const { geo, x = 0, y = 0, z = 0, c = null } of partes) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.translate(x, y, z);
    const p = g.attributes.position, n = g.attributes.normal;
    const col = new THREE.Color(c || '#ffffff');
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      cor.push(col.r, col.g, col.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  return g;
}

// Geometrias do carro (frente = +Z)
export function geometriasCarro() {
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const corpo = mesclar([
    { geo: B(1.9, 0.75, 4.4), y: 0.75 },
    { geo: B(1.7, 0.12, 2.2), y: 1.86, z: -0.25 },
  ]);
  const roda = () => { const c = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10); c.rotateZ(Math.PI / 2); return c; };
  const detalhes = mesclar([
    { geo: B(1.66, 0.7, 2.1), y: 1.48, z: -0.25, c: '#1d2633' },
    { geo: roda(), x: 0.85, y: 0.36, z: 1.4, c: '#15161a' }, { geo: roda(), x: -0.85, y: 0.36, z: 1.4, c: '#15161a' },
    { geo: roda(), x: 0.85, y: 0.36, z: -1.4, c: '#15161a' }, { geo: roda(), x: -0.85, y: 0.36, z: -1.4, c: '#15161a' },
    { geo: B(1.95, 0.22, 0.2), y: 0.45, z: 2.2, c: '#3a3d45' }, { geo: B(1.95, 0.22, 0.2), y: 0.45, z: -2.2, c: '#3a3d45' },
  ]);
  const luzes = mesclar([
    { geo: B(0.4, 0.18, 0.06), x: 0.6, y: 0.9, z: 2.21, c: '#fff6c8' }, { geo: B(0.4, 0.18, 0.06), x: -0.6, y: 0.9, z: 2.21, c: '#fff6c8' },
    { geo: B(0.4, 0.16, 0.06), x: 0.65, y: 0.92, z: -2.21, c: '#ff2a2a' }, { geo: B(0.4, 0.16, 0.06), x: -0.65, y: 0.92, z: -2.21, c: '#ff2a2a' },
  ]);
  return { corpo, detalhes, luzes };
}

const CORES_CARRO = ['#e8e4dc', '#d23c3c', '#2f6db5', '#f2c94c', '#3a3d45', '#4e9a6a', '#e07b39', '#8a5ab5', '#c4ccd6', '#1f2a44'];

export class Trafego {
  constructor(cena, semente = 7) {
    const r = criarRng(semente);
    this.r = r;
    const geo = geometriasCarro();
    this.faixas = [];
    for (let k = 0; k <= N; k++) {
      const linha = -MEIO + k * QUADRA;
      for (const eixo of ['x', 'z']) {
        for (const dir of [1, -1]) {
          // mão direita: +X usa z = linha + 3.5; -X usa z = linha - 3.5; +Z usa x = linha - 3.5; -Z usa x = linha + 3.5
          const off = eixo === 'x' ? dir * 3.5 : -dir * 3.5;
          this.faixas.push({ eixo, dir, coord: linha + off, vel: r.entre(11, 17) });
        }
      }
    }
    this.carros = [];
    for (const f of this.faixas) {
      const qtd = r.int(1, 3);
      let s = r.entre(-MEIO, MEIO);
      for (let q = 0; q < qtd; q++) {
        this.carros.push({ f, s, cor: r.escolher(CORES_CARRO) });
        s += r.entre(60, 260);
      }
    }
    const n = this.carros.length;
    this.n = n;
    const matCorpo = toon('#ffffff');
    this.corpo = new THREE.InstancedMesh(geo.corpo, matCorpo, n);
    this.det = new THREE.InstancedMesh(geo.detalhes, toon('#ffffff', { vertexColors: true }), n);
    this.luz = new THREE.InstancedMesh(geo.luzes, new THREE.MeshBasicMaterial({ vertexColors: true }), n);
    const cor = new THREE.Color();
    this.carros.forEach((c, i) => this.corpo.setColorAt(i, cor.set(c.cor)));
    for (const m of [this.corpo, this.det]) { m.castShadow = true; m.receiveShadow = true; }
    for (const m of [this.corpo, this.det, this.luz]) { m.frustumCulled = false; cena.add(m); }

    // Pedestres
    const lotes = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x0 = -MEIO + i * QUADRA + RUA / 2, z0 = -MEIO + j * QUADRA + RUA / 2;
      lotes.push([x0 + 1.6, z0 + 1.6, x0 + QUADRA - RUA - 1.6, z0 + QUADRA - RUA - 1.6]);
    }
    this.pedestres = [];
    const NP = 320;
    for (let k = 0; k < NP; k++) {
      const l = r.escolher(lotes);
      const per = 2 * (l[2] - l[0]) + 2 * (l[3] - l[1]);
      this.pedestres.push({ l, per, s: r.entre(0, per), v: r.entre(1.1, 1.8) * (r() < 0.5 ? 1 : -1), fase: r.entre(0, 6), alt: r.entre(0.9, 1.1) });
    }
    const corpoP = new THREE.CapsuleGeometry(0.24, 0.85, 3, 8); corpoP.translate(0, 0.72, 0);
    const cabeca = new THREE.SphereGeometry(0.14, 8, 6); cabeca.translate(0, 1.45, 0);
    this.pCorpo = new THREE.InstancedMesh(corpoP, toon('#ffffff'), NP);
    this.pCab = new THREE.InstancedMesh(cabeca, toon('#ffffff'), NP);
    const roupas = ['#e05a47', '#3f7fbf', '#f2c94c', '#4caf7a', '#9a6fc4', '#ec8f3b', '#e8e8e8', '#2d3a55', '#c0507a'];
    const peles = ['#c98d6a', '#8d5a3c', '#e2b08c', '#6b4330', '#d9a07a'];
    this.pedestres.forEach((p, i) => { this.pCorpo.setColorAt(i, cor.set(r.escolher(roupas))); this.pCab.setColorAt(i, cor.set(r.escolher(peles))); });
    for (const m of [this.pCorpo, this.pCab]) { m.castShadow = true; m.frustumCulled = false; cena.add(m); }
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.t = 0;
  }

  atualizar(dt, centro) {
    this.t += dt;
    const m = this.m, q = this.q, e = this.e;
    const um = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const LIM = MEIO + 12;
    this.carros.forEach((c, i) => {
      const f = c.f;
      c.s += f.vel * f.dir * dt;
      if (c.s > LIM) c.s -= 2 * LIM;
      if (c.s < -LIM) c.s += 2 * LIM;
      if (f.eixo === 'x') { p.set(c.s, 0, f.coord); e.set(0, f.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0); }
      else { p.set(f.coord, 0, c.s); e.set(0, f.dir > 0 ? 0 : Math.PI, 0); }
      q.setFromEuler(e);
      m.compose(p, q, um);
      this.corpo.setMatrixAt(i, m); this.det.setMatrixAt(i, m); this.luz.setMatrixAt(i, m);
    });
    this.corpo.instanceMatrix.needsUpdate = this.det.instanceMatrix.needsUpdate = this.luz.instanceMatrix.needsUpdate = true;

    // pedestres: só os próximos animam de verdade, mas todos andam
    this.pedestres.forEach((pd, i) => {
      pd.s = (pd.s + pd.v * dt + pd.per) % pd.per;
      const [x0, z0, x1, z1] = pd.l;
      const w = x1 - x0, d = z1 - z0;
      let s = pd.s, x, z, ang;
      if (s < w) { x = x0 + s; z = z0; ang = Math.PI / 2; }
      else if ((s -= w) < d) { x = x1; z = z0 + s; ang = 0; }
      else if ((s -= d) < w) { x = x1 - s; z = z1; ang = -Math.PI / 2; }
      else { s -= w; x = x0; z = z1 - s; ang = Math.PI; }
      if (pd.v < 0) ang += Math.PI;
      const bob = Math.abs(Math.sin(this.t * 7 + pd.fase)) * 0.06;
      p.set(x, CALCADA + bob, z);
      e.set(0, ang, Math.sin(this.t * 7 + pd.fase) * 0.06);
      q.setFromEuler(e);
      m.compose(p, q, um.set(1, pd.alt, 1));
      this.pCorpo.setMatrixAt(i, m); this.pCab.setMatrixAt(i, m);
      um.set(1, 1, 1);
    });
    this.pCorpo.instanceMatrix.needsUpdate = this.pCab.instanceMatrix.needsUpdate = true;
  }
}
