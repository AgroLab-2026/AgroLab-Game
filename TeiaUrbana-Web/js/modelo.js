// Humanoide articulado (herói, bandidos e civis) + animador procedural por poses.
// Convenção: o boneco olha para +Z; o lado ESQUERDO dele fica em +X.
// Rotação X negativa na coxa/ombro = membro para frente; positiva no joelho = dobra para trás.
import * as THREE from '../vendor/three.module.min.js';
import { toon, fatorDamp } from './util.js';

const JUNTAS = ['quadril', 'tronco', 'peito', 'pescoco', 'cabeca', 'ombroE', 'cotoveloE', 'maoE', 'ombroD', 'cotoveloD', 'maoD',
  'coxaE', 'joelhoE', 'peE', 'coxaD', 'joelhoD', 'peD'];

// Membro torneado (LatheGeometry): mais "orgânico" que uma cápsula reta.
const cacheMembro = new Map();
function geoMembro(rTop, rBot, comp, bojo = 0, seg = 12) {
  const chave = [rTop, rBot, comp, bojo, seg].join('|');
  if (cacheMembro.has(chave)) return cacheMembro.get(chave);
  const pts = [];
  for (let k = 0; k <= 4; k++) { const a = -Math.PI / 2 + (k / 4) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(0.0001, rBot * Math.cos(a)), -comp + rBot * Math.sin(a))); }
  for (let k = 1; k < 9; k++) {
    const t = 1 - k / 9;
    pts.push(new THREE.Vector2(rTop + (rBot - rTop) * t + bojo * Math.sin(Math.PI * Math.pow(t, 0.8)), -comp * t));
  }
  for (let k = 0; k <= 4; k++) { const a = (k / 4) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(0.0001, rTop * Math.cos(a)), rTop * Math.sin(a))); }
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateY(Math.PI / 2);
  cacheMembro.set(chave, g);
  return g;
}
function membro(rTop, rBot, comp, mat, bojo = 0) {
  const m = new THREE.Mesh(geoMembro(rTop, rBot, comp, bojo), mat);
  m.castShadow = true;
  return m;
}
// Tronco torneado e achatado na frente/trás (emblema da textura fica na frente)
function geoTronco(perfil, seg = 18) {
  const g = new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg);
  g.rotateY(-Math.PI / 2);
  g.scale(1, 1, 0.64);
  return g;
}

function elipsoide(rx, ry, rz, mat, seg = 14) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.max(8, seg - 4)), mat);
  m.scale.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

export function criarHumanoide(o = {}) {
  const c = {
    pele: '#c98d6a', tronco: '#3a4a6a', bracos: null, pernas: '#2b2f3a', botas: '#1b1d24', maos: null,
    cabeca: 'cabelo', cabelo: '#2a1d16', ombros: 0.2, peitoLarg: 1, escala: 1, ...o,
  };
  const mt = (cor) => toon(cor);
  const matTronco = c.matTronco || mt(c.tronco);
  const matBracos = c.matBracos || (c.bracos ? mt(c.bracos) : matTronco);
  const matPernas = c.matPernas || mt(c.pernas);
  const matMaos = c.matMaos || mt(c.maos || c.pele);
  const matBotas = c.matBotas || mt(c.botas);
  const matCabeca = c.matCabeca || mt(c.pele);

  const j = {};
  const raiz = new THREE.Group();
  for (const n of JUNTAS) { j[n] = new THREE.Group(); j[n].name = n; }
  raiz.add(j.quadril);
  j.quadril.position.set(0, 0.98, 0);
  j.quadril.add(j.tronco); j.tronco.position.set(0, 0.1, 0);
  j.tronco.add(j.peito); j.peito.position.set(0, 0.2, 0);
  j.peito.add(j.pescoco); j.pescoco.position.set(0, 0.25, 0.0);
  j.pescoco.add(j.cabeca); j.cabeca.position.set(0, 0.08, 0.01);
  const ombro = c.ombros;
  j.peito.add(j.ombroE); j.ombroE.position.set(ombro, 0.17, 0);
  j.peito.add(j.ombroD); j.ombroD.position.set(-ombro, 0.17, 0);
  j.ombroE.add(j.cotoveloE); j.cotoveloE.position.set(0, -0.29, 0);
  j.ombroD.add(j.cotoveloD); j.cotoveloD.position.set(0, -0.29, 0);
  j.cotoveloE.add(j.maoE); j.maoE.position.set(0, -0.27, 0);
  j.cotoveloD.add(j.maoD); j.maoD.position.set(0, -0.27, 0);
  j.quadril.add(j.coxaE); j.coxaE.position.set(0.1, -0.04, 0);
  j.quadril.add(j.coxaD); j.coxaD.position.set(-0.1, -0.04, 0);
  j.coxaE.add(j.joelhoE); j.joelhoE.position.set(0, -0.45, 0);
  j.coxaD.add(j.joelhoD); j.joelhoD.position.set(0, -0.45, 0);
  j.joelhoE.add(j.peE); j.peE.position.set(0, -0.44, 0);
  j.joelhoD.add(j.peD); j.peD.position.set(0, -0.44, 0);

  // Corpo
  const L = c.peitoLarg;
  const pelve = elipsoide(0.145, 0.11, 0.1, matPernas); pelve.position.y = -0.01; j.quadril.add(pelve);
  const abd = new THREE.Mesh(geoTronco([[0, -0.1], [0.09, -0.09], [0.125, -0.05], [0.13 * L, 0.05], [0.14 * L, 0.16], [0.12, 0.24], [0, 0.26]]), matTronco);
  abd.castShadow = true; j.tronco.add(abd);
  const peito = new THREE.Mesh(geoTronco([[0, -0.1], [0.12, -0.09], [0.15 * L, -0.02], [0.195 * L, 0.1], [0.205 * L, 0.17], [0.17 * L, 0.24], [0.08, 0.29], [0, 0.3]]), matTronco);
  peito.castShadow = true; j.peito.add(peito);
  const trap = elipsoide(0.15 * L, 0.06, 0.08, matTronco); trap.position.set(0, 0.22, -0.01); j.peito.add(trap);
  const pesc = membro(0.048, 0.055, 0.12, matCabeca); pesc.position.y = 0.1; j.pescoco.add(pesc);
  const cab = elipsoide(0.102, 0.122, 0.11, matCabeca, 20); cab.position.y = 0.1; j.cabeca.add(cab);
  const queixo = elipsoide(0.07, 0.06, 0.08, matCabeca, 12); queixo.position.set(0, 0.03, 0.02); j.cabeca.add(queixo);
  for (const [lado, sx] of [['E', 1], ['D', -1]]) {
    const delt = elipsoide(0.078 * L, 0.075, 0.075, matBracos); delt.position.set(sx * 0.012, -0.025, 0); j['ombro' + lado].add(delt);
    j['ombro' + lado].add(membro(0.062, 0.05, 0.29, matBracos, 0.008));
    j['cotovelo' + lado].add(membro(0.05, 0.038, 0.26, matBracos, 0.01));
    const mao = elipsoide(0.046, 0.06, 0.034, matMaos, 10); mao.position.y = -0.05; j['mao' + lado].add(mao);
    const polegar = elipsoide(0.017, 0.03, 0.017, matMaos, 8); polegar.position.set(sx * -0.03, -0.03, 0.025); polegar.rotation.z = sx * 0.5; j['mao' + lado].add(polegar);
    j['coxa' + lado].add(membro(0.095, 0.062, 0.45, matPernas, 0.012));
    j['joelho' + lado].add(membro(0.064, 0.042, 0.44, matPernas, 0.016));
    const pe = elipsoide(0.056, 0.048, 0.13, matBotas, 12);
    pe.position.set(0, -0.025, 0.055); j['pe' + lado].add(pe);
  }
  if (c.cabeca === 'cabelo') {
    const cabelo = elipsoide(0.112, 0.08, 0.118, mt(c.cabelo)); cabelo.position.set(0, 0.16, -0.01); j.cabeca.add(cabelo);
  } else if (c.cabeca === 'gorro') {
    const gorro = elipsoide(0.115, 0.09, 0.12, mt(c.cabelo)); gorro.position.set(0, 0.17, -0.005); j.cabeca.add(gorro);
  }
  raiz.scale.setScalar(c.escala);
  raiz.traverse((x) => { if (x.isMesh) x.castShadow = true; });
  return { raiz, j };
}

// ---------------------------------------------------------------------------------------------
// Animador: cada quadro calcula uma pose-alvo (ângulos por junta) e amacia até ela.
export class Animador {
  constructor(j) {
    this.j = j;
    this.atual = {};
    this.alvo = {};
    for (const n of JUNTAS) { this.atual[n] = [0, 0, 0]; this.alvo[n] = [0, 0, 0]; }
    this.quadrilY = 0.98;
    this.alvoQuadrilY = 0.98;
    this.overrides = {}; // junta -> {q: Quaternion, peso}
    this._q = new THREE.Quaternion();
  }

  zerar() { for (const n of JUNTAS) { const a = this.alvo[n]; a[0] = a[1] = a[2] = 0; } this.alvoQuadrilY = 0.98; }
  set(n, x, y = 0, z = 0) { const a = this.alvo[n]; a[0] = x; a[1] = y; a[2] = z; }
  add(n, x, y = 0, z = 0) { const a = this.alvo[n]; a[0] += x; a[1] += y; a[2] += z; }

  aplicar(dt, velocidade = 16) {
    const k = fatorDamp(velocidade, dt);
    for (const n of JUNTAS) {
      const a = this.atual[n], b = this.alvo[n];
      a[0] += (b[0] - a[0]) * k; a[1] += (b[1] - a[1]) * k; a[2] += (b[2] - a[2]) * k;
      this.j[n].rotation.set(a[0], a[1], a[2]);
      const ov = this.overrides[n];
      if (ov && ov.peso > 0.001) {
        this._q.copy(this.j[n].quaternion).slerp(ov.q, ov.peso);
        this.j[n].quaternion.copy(this._q);
      }
    }
    this.quadrilY += (this.alvoQuadrilY - this.quadrilY) * k;
    this.j.quadril.position.y = this.quadrilY;
  }

  // Aponta um braço (a partir do ombro) para um ponto do mundo.
  apontarBraco(lado, pontoMundo, peso, dt, raiz) {
    const n = 'ombro' + lado;
    const ombro = this.j[n];
    let ov = this.overrides[n];
    if (!ov) ov = this.overrides[n] = { q: new THREE.Quaternion(), peso: 0 };
    const alvoPeso = peso;
    ov.peso += (alvoPeso - ov.peso) * fatorDamp(20, dt);
    if (ov.peso < 0.001 || !pontoMundo) return;
    raiz.updateMatrixWorld(true);
    const pai = ombro.parent;
    const pOmbro = new THREE.Vector3().setFromMatrixPosition(ombro.matrixWorld);
    const dirMundo = pontoMundo.clone().sub(pOmbro).normalize();
    const qPai = new THREE.Quaternion();
    pai.getWorldQuaternion(qPai);
    const dirLocal = dirMundo.applyQuaternion(qPai.invert());
    ov.q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirLocal);
  }

  soltarBraco(lado, dt) {
    const ov = this.overrides['ombro' + lado];
    if (ov) ov.peso += (0 - ov.peso) * fatorDamp(14, dt);
  }
}

// --------------------------------------------------------------------------------- poses
export const Poses = {
  parado(a, t) {
    const resp = Math.sin(t * 2.2) * 0.03;
    a.set('ombroE', 0.05, 0, 0.16 + resp); a.set('ombroD', 0.05, 0, -0.16 - resp);
    a.set('cotoveloE', -0.25); a.set('cotoveloD', -0.25);
    a.set('tronco', resp * 0.5); a.set('cabeca', -resp);
    a.set('coxaE', -0.05, 0, 0.05); a.set('coxaD', 0.05, 0, -0.05);
    a.set('joelhoE', 0.1); a.set('joelhoD', 0.1);
  },
  correr(a, fase, intens, sprint) {
    const A = 0.55 + 0.45 * sprint, s = Math.sin(fase), co = Math.cos(fase);
    a.set('coxaE', -s * A - 0.1 * sprint); a.set('coxaD', s * A - 0.1 * sprint);
    a.set('joelhoE', 0.25 + (0.9 + sprint * 0.6) * Math.max(0, co));
    a.set('joelhoD', 0.25 + (0.9 + sprint * 0.6) * Math.max(0, -co));
    a.set('peE', -0.2 * s); a.set('peD', 0.2 * s);
    const B = 0.5 + 0.6 * sprint;
    if (sprint > 0.5) {
      // corrida de herói: braços para trás
      a.set('ombroE', 0.9 + s * 0.15, 0, 0.25); a.set('ombroD', 0.9 - s * 0.15, 0, -0.25);
      a.set('cotoveloE', -0.3); a.set('cotoveloD', -0.3);
    } else {
      a.set('ombroE', s * B, 0, 0.12); a.set('ombroD', -s * B, 0, -0.12);
      a.set('cotoveloE', -1.1); a.set('cotoveloD', -1.1);
    }
    a.set('tronco', 0.12 + 0.35 * sprint, -s * 0.15 * intens); a.set('peito', 0, -s * 0.12);
    a.set('cabeca', -0.1 - 0.3 * sprint);
    a.alvoQuadrilY = 0.98 - 0.04 * intens + Math.abs(Math.cos(fase)) * 0.05 * intens - 0.06 * sprint;
  },
  salto(a, vy) {
    const subindo = vy > 0 ? 1 : 0;
    a.set('coxaE', -1.2 * subindo - 0.5, 0, 0.1); a.set('coxaD', -0.4 - 0.3 * subindo, 0, -0.1);
    a.set('joelhoE', 1.6); a.set('joelhoD', 1.2 + subindo * 0.6);
    a.set('ombroE', -0.6, 0, 1.0); a.set('ombroD', -0.4, 0, -1.2);
    a.set('cotoveloE', -0.8); a.set('cotoveloD', -0.6);
    a.set('tronco', 0.15);
  },
  queda(a, t) {
    const w = Math.sin(t * 9) * 0.06;
    a.set('coxaE', 0.15, 0, 0.12 + w); a.set('coxaD', 0.25, 0, -0.12 - w);
    a.set('joelhoE', 0.5); a.set('joelhoD', 0.9);
    a.set('ombroE', 0.3, 0, 1.0 + w); a.set('ombroD', 0.3, 0, -1.0 - w);
    a.set('cotoveloE', -0.3); a.set('cotoveloD', -0.3);
    a.set('cabeca', -0.6);
  },
  mergulho(a, t) {
    const w = Math.sin(t * 12) * 0.05;
    a.set('coxaE', 0.1, 0, 0.05); a.set('coxaD', 0.1, 0, -0.05);
    a.set('joelhoE', 0.15 + w); a.set('joelhoD', 0.15 - w);
    a.set('ombroE', 0.45, 0, 0.45 + w); a.set('ombroD', 0.45, 0, -0.45 - w);
    a.set('cotoveloE', -0.15); a.set('cotoveloD', -0.15);
    a.set('cabeca', -0.7);
  },
  balanco(a, fase, ladoTeia) {
    // fase: -1 (início, subindo atrás) .. 1 (fim, à frente)
    const pernas = -0.4 - 0.6 * Math.max(0, fase) + 0.4 * Math.max(0, -fase);
    a.set('coxaE', pernas - 0.25, 0, 0.12); a.set('coxaD', pernas + 0.15, 0, -0.08);
    a.set('joelhoE', 0.9 + 0.4 * Math.max(0, fase)); a.set('joelhoD', 0.5 + 0.8 * Math.max(0, -fase));
    const livre = ladoTeia === 'D' ? 'E' : 'D';
    const s = livre === 'E' ? 1 : -1;
    a.set('ombro' + livre, -0.3, 0, s * (1.1 + 0.3 * fase));
    a.set('cotovelo' + livre, -0.7);
    a.set('cotovelo' + ladoTeia, -0.08);
    a.set('tronco', -0.1 + fase * 0.15);
    a.set('cabeca', 0.1);
  },
  parede(a, fase, mov) {
    const s = Math.sin(fase) * mov;
    a.set('coxaE', -0.7 + s * 0.5, 0, 0.75); a.set('coxaD', -0.7 - s * 0.5, 0, -0.75);
    a.set('joelhoE', 1.6); a.set('joelhoD', 1.6);
    a.set('ombroE', -2.2 - s * 0.5, 0, 0.6); a.set('ombroD', -2.2 + s * 0.5, 0, -0.6);
    a.set('cotoveloE', -0.6); a.set('cotoveloD', -0.6);
    a.set('cabeca', 0.5);
    a.alvoQuadrilY = 0.8;
  },
  agachado(a, t) {
    const resp = Math.sin(t * 2) * 0.03;
    a.set('coxaE', -1.9, 0, 0.35); a.set('coxaD', -1.9, 0, -0.35);
    a.set('joelhoE', 2.5); a.set('joelhoD', 2.5);
    a.set('peE', 0.5); a.set('peD', 0.5);
    a.set('tronco', 0.55 + resp);
    a.set('ombroE', -0.5, 0, 0.1); a.set('ombroD', -0.5, 0, -0.1);
    a.set('cotoveloE', -0.4); a.set('cotoveloD', -0.4);
    a.set('cabeca', -0.4);
    a.alvoQuadrilY = 0.42;
  },
  pouso(a) {
    a.set('coxaE', -1.5, 0, 0.3); a.set('coxaD', -0.2, 0, -0.25);
    a.set('joelhoE', 2.2); a.set('joelhoD', 2.0);
    a.set('tronco', 0.7);
    a.set('ombroD', -0.5, 0, -0.2); a.set('cotoveloD', 0);
    a.set('ombroE', 0.6, 0, 0.9); a.set('cotoveloE', -0.4);
    a.set('cabeca', -0.4);
    a.alvoQuadrilY = 0.45;
  },
  zip(a) {
    a.set('ombroE', -2.4, 0, 0.15); a.set('ombroD', -2.4, 0, -0.15);
    a.set('cotoveloE', -0.1); a.set('cotoveloD', -0.1);
    a.set('coxaE', -0.3); a.set('coxaD', 0.2); a.set('joelhoE', 1.0); a.set('joelhoD', 0.6);
    a.set('tronco', -0.2);
  },
  soco(a, golpe, t) {
    // t: 0..1 do golpe
    const pico = Math.sin(Math.min(1, t * 1.6) * Math.PI);
    a.set('coxaE', -0.4, 0, 0.15); a.set('coxaD', 0.3, 0, -0.15); a.set('joelhoE', 0.5); a.set('joelhoD', 0.4);
    a.alvoQuadrilY = 0.9;
    a.set('ombroE', -0.4, 0, 0.3); a.set('ombroD', -0.4, 0, -0.3); a.set('cotoveloE', -1.8); a.set('cotoveloD', -1.8);
    if (golpe === 0) { a.set('ombroD', -1.55 * pico - 0.3 * (1 - pico), 0.2, -0.15); a.set('cotoveloD', -0.1 - 1.5 * (1 - pico)); a.set('tronco', 0.1, -0.5 * pico); }
    else if (golpe === 1) { a.set('ombroE', -1.5 * pico - 0.3 * (1 - pico), -0.4 * pico, 0.6 * pico); a.set('cotoveloE', -0.5 - 1.2 * (1 - pico)); a.set('tronco', 0.1, 0.6 * pico); }
    else if (golpe === 2) { a.set('coxaD', -1.7 * pico, 0, -0.1); a.set('joelhoD', 0.2 + 1.4 * (1 - pico)); a.set('tronco', -0.25 * pico, 0.3 * pico); a.set('ombroE', 0.2, 0, 1.0); a.set('ombroD', 0.2, 0, -1.0); }
    else { a.set('ombroE', -2.6 * pico, 0, 0.2); a.set('ombroD', -2.6 * pico, 0, -0.2); a.set('cotoveloE', -0.2); a.set('cotoveloD', -0.2); a.set('tronco', -0.3 * pico); a.set('coxaE', -0.9 * pico); a.set('joelhoE', 1.2); }
  },
  atingido(a, t) {
    const k = Math.max(0, 1 - t * 2);
    a.set('tronco', -0.5 * k); a.set('cabeca', -0.4 * k);
    a.set('ombroE', 0.6 * k, 0, 0.9 * k); a.set('ombroD', 0.6 * k, 0, -0.9 * k);
    a.set('coxaE', -0.3); a.set('joelhoE', 0.6); a.set('joelhoD', 0.3);
  },
  caido(a) {
    a.set('ombroE', -0.4, 0, 1.3); a.set('ombroD', 0.3, 0, -1.1); a.set('cotoveloE', -0.6);
    a.set('coxaE', -0.2, 0, 0.2); a.set('joelhoE', 0.6); a.set('coxaD', 0, 0, -0.15);
    a.set('cabeca', 0.2, 0.5);
  },
  pendurado(a, t) {
    const w = Math.sin(t * 3) * 0.15;
    a.set('ombroE', -2.9, 0, 0.2); a.set('ombroD', -2.9, 0, -0.2);
    a.set('coxaE', w, 0, 0.1); a.set('coxaD', -w, 0, -0.1); a.set('joelhoE', 0.3); a.set('joelhoD', 0.5);
    a.set('cabeca', 0.3);
  },
  preparar(a, t, arma) {
    const tremor = Math.sin(t * 40) * 0.03;
    if (arma) {
      a.set('ombroD', -1.55, 0.25, 0); a.set('cotoveloD', -0.05);
      a.set('ombroE', -1.3, -0.5, 0); a.set('cotoveloE', -0.5);
      a.set('tronco', 0, -0.2);
    } else {
      a.set('ombroD', 0.6 + tremor, 0, -0.5); a.set('cotoveloD', -2.0);
      a.set('ombroE', -0.8, 0, 0.3); a.set('cotoveloE', -1.6);
      a.set('tronco', -0.15, 0.5);
    }
    a.set('coxaE', -0.5, 0, 0.15); a.set('coxaD', 0.35, 0, -0.15); a.set('joelhoE', 0.6); a.set('joelhoD', 0.4);
    a.alvoQuadrilY = 0.9;
  },
  golpeInimigo(a, t, arma) {
    if (arma) { Poses.preparar(a, 0, true); a.add('ombroD', -0.25 * Math.max(0, 1 - t * 3)); return; }
    a.set('ombroD', -1.6, 0.3, -0.1); a.set('cotoveloD', -0.1);
    a.set('ombroE', 0.4, 0, 0.4); a.set('cotoveloE', -1.2);
    a.set('tronco', 0.25, -0.5);
    a.set('coxaE', -0.6); a.set('joelhoE', 0.5); a.set('coxaD', 0.4);
  },
};
