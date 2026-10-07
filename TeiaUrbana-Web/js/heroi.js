// O herói TEIA: traje índigo com teia ciano, olhos brancos angulosos e emblema próprio.
import * as THREE from '../vendor/three.module.min.js';
import { criarHumanoide, Animador } from './modelo.js';
import { GRADIENTE } from './util.js';

const INDIGO = '#2b3cb8';
const INDIGO_ESCURO = '#161c5c';
const CIANO = '#33e1ff';
const OURO = '#ffc23d';

function texTraje(comEmblema) {
  const W = 512, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#3a4fd6'); grad.addColorStop(1, INDIGO);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // Linhas de teia: raios a partir da frente (u = 0.25) e arcos concêntricos
  const cx = W * 0.25, cy = H * 0.5;
  g.strokeStyle = 'rgba(90, 230, 255, 0.85)';
  g.lineWidth = 3;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * W, cy + Math.sin(a) * W * 0.5); g.stroke();
    g.beginPath(); g.moveTo(cx + W, cy); g.lineTo(cx + W + Math.cos(a) * W, cy + Math.sin(a) * W * 0.5); g.stroke();
  }
  for (let r = 22; r < W; r += 24) {
    g.beginPath(); g.ellipse(cx, cy, r, r * 0.5, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(cx + W, cy, r, r * 0.5, 0, 0, Math.PI * 2); g.stroke();
  }
  if (comEmblema) {
    // Emblema: losango estelar com quatro traços angulares
    g.save();
    g.translate(cx, cy + 6);
    g.scale(1, 0.62);
    g.fillStyle = INDIGO_ESCURO;
    g.beginPath(); g.arc(0, 0, 44, 0, Math.PI * 2); g.fill();
    g.strokeStyle = CIANO; g.fillStyle = CIANO; g.lineWidth = 6; g.lineJoin = 'miter';
    g.beginPath(); g.moveTo(0, -30); g.lineTo(12, 0); g.lineTo(0, 30); g.lineTo(-12, 0); g.closePath(); g.fill();
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 10, -8); g.lineTo(s * 26, -22); g.lineTo(s * 36, -6); g.stroke();
      g.beginPath(); g.moveTo(s * 10, 8); g.lineTo(s * 26, 22); g.lineTo(s * 36, 6); g.stroke();
    }
    g.restore();
    // cinto dourado na base do peito
    g.fillStyle = OURO;
    g.fillRect(0, H * 0.86, W, 6);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function texMembro() {
  const W = 256, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#3346c9'); grad.addColorStop(0.5, INDIGO); grad.addColorStop(1, '#3346c9');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // faixas ciano nas laterais (u = 0 e 0,5 ficam nos lados do membro)
  g.fillStyle = CIANO;
  g.fillRect(W * 0.47, 0, W * 0.06, H);
  g.fillRect(0, 0, W * 0.03, H);
  g.fillRect(W * 0.97, 0, W * 0.03, H);
  g.strokeStyle = 'rgba(90, 230, 255, 0.28)'; g.lineWidth = 2;
  for (let y = 18; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(W / 4, y + 14, W / 2, y); g.quadraticCurveTo(W * 0.75, y + 14, W, y); g.stroke(); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function olho(lado) {
  const s = new THREE.Shape();
  // forma angulosa: canto interno baixo, externo alto e pontudo
  s.moveTo(0, 0);
  s.lineTo(0.052, 0.028);
  s.quadraticCurveTo(0.03, -0.02, -0.004, -0.018);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s);
  geo.translate(-0.022, 0, 0);
  const borda = new THREE.Mesh(geo.clone().scale(1.35, 1.5, 1), new THREE.MeshBasicMaterial({ color: '#05060f' }));
  const branco = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#f4fbff' }));
  branco.position.z = 0.0015;
  const g = new THREE.Group();
  g.add(borda, branco);
  if (lado < 0) g.scale.x = -1;
  return g;
}

export function criarHeroi() {
  const matTronco = new THREE.MeshToonMaterial({ map: texTraje(true), gradientMap: GRADIENTE, emissive: '#0c1240' });
  const matCabeca = new THREE.MeshToonMaterial({ map: texTraje(false), gradientMap: GRADIENTE, emissive: '#0c1240' });
  const texM = texMembro();
  const matMembro = new THREE.MeshToonMaterial({ map: texM, gradientMap: GRADIENTE, emissive: '#0c1240' });
  const matLuva = new THREE.MeshToonMaterial({ color: INDIGO_ESCURO, gradientMap: GRADIENTE });
  const { raiz, j } = criarHumanoide({
    matTronco, matBracos: matMembro, matPernas: matMembro, matMaos: matLuva, matBotas: matLuva, matCabeca,
    cabeca: 'mascara', ombros: 0.21, peitoLarg: 1.08,
  });
  // Olhos
  const oE = olho(1); oE.position.set(0.048, 0.118, 0.097); oE.rotation.set(-0.08, 0.42, -0.08);
  const oD = olho(-1); oD.position.set(-0.048, 0.118, 0.097); oD.rotation.set(-0.08, -0.42, 0.08);
  j.cabeca.add(oE, oD);
  // Lança-teias nos pulsos e cinto
  const anel = new THREE.TorusGeometry(0.052, 0.014, 6, 14);
  const matCiano = new THREE.MeshToonMaterial({ color: CIANO, emissive: '#0b5c70', gradientMap: GRADIENTE });
  for (const lado of ['E', 'D']) {
    const a = new THREE.Mesh(anel, matCiano);
    a.rotation.x = Math.PI / 2; a.position.y = -0.235;
    j['cotovelo' + lado].add(a);
  }
  const cinto = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.018, 6, 20), new THREE.MeshToonMaterial({ color: OURO, gradientMap: GRADIENTE }));
  cinto.rotation.x = Math.PI / 2; cinto.scale.set(1, 0.78, 1); cinto.position.y = 0.06;
  j.quadril.add(cinto);
  raiz.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const anim = new Animador(j);
  return { raiz, j, anim };
}
