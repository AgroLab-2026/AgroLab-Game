// Câmera em terceira pessoa: órbita com mouse/controle, colisão com prédios,
// FOV dinâmico com a velocidade, auto-alinhamento durante o balanço e tremor.
import * as THREE from '../vendor/three.module.min.js';
import { clamp, damp, dampAng, fatorDamp } from './util.js';

export class CameraJogo {
  constructor(camera, cidade) {
    this.cam = camera;
    this.cidade = cidade;
    this.yaw = Math.PI;
    this.pitch = 0.18;
    this.dist = 5.5;
    this.alvoSuave = new THREE.Vector3();
    this.tremor = 0;
    this.semMouse = 0;
    this.fovBase = 70;
    this.cinematico = 0; // >0 = câmera de finalização
    this.focoCine = new THREE.Vector3();
    this.iniciado = false;
  }

  sacudir(q) { this.tremor = Math.min(1.2, this.tremor + q); }

  frente() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  direita() { return new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); }

  direcaoOlhar() {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(Math.sin(this.yaw) * cp, -Math.sin(this.pitch), Math.cos(this.yaw) * cp).normalize();
  }

  atualizar(dt, jog, entrada) {
    const [dx, dy] = entrada.olhar(dt);
    if (Math.abs(dx) + Math.abs(dy) > 0.0001) this.semMouse = 0; else this.semMouse += dt;
    this.yaw -= dx;
    this.pitch = clamp(this.pitch + dy, -1.2, 1.25);

    const vel = jog.vel.length();
    const noAr = jog.estado === 'balanco' || jog.estado === 'ar' || jog.estado === 'zip';
    // Auto-alinhar atrás do movimento quando o jogador não mexe na câmera
    if (noAr && this.semMouse > 1.0 && vel > 12) {
      const h = Math.atan2(jog.vel.x, jog.vel.z);
      this.yaw = dampAng(this.yaw, h, 1.6, dt);
      this.pitch = damp(this.pitch, 0.22, 1.2, dt);
    }

    let distAlvo = 5.2;
    if (jog.estado === 'balanco') distAlvo = 6.2 + Math.min(1.8, vel * 0.03);
    else if (noAr) distAlvo = 5.8 + Math.min(1.8, vel * 0.03);
    else if (jog.estado === 'parede') distAlvo = 6.5;
    if (jog.emCombate) distAlvo += 1.8;
    this.dist = damp(this.dist, distAlvo, 3, dt);

    const alvo = jog.pos.clone();
    alvo.y += jog.estado === 'parede' ? 1.0 : 1.55;
    if (!this.iniciado) { this.alvoSuave.copy(alvo); this.iniciado = true; }
    // Segue com um pouco de atraso em alta velocidade (sensação de impulso)
    this.alvoSuave.lerp(alvo, fatorDamp(vel > 25 ? 18 : 24, dt));

    const dir = this.direcaoOlhar();
    const lado = this.direita();
    const desejada = this.alvoSuave.clone().addScaledVector(dir, -this.dist).addScaledVector(lado, 0.55);
    desejada.y += 0.25;

    // Colisão com prédios: puxa a câmera para perto do herói
    const orig = this.alvoSuave.clone();
    const raio = desejada.clone().sub(orig);
    const lenR = raio.length();
    raio.divideScalar(lenR || 1);
    const hit = this.cidade.raycast(orig, raio, lenR + 0.4, true);
    if (hit) desejada.copy(orig).addScaledVector(raio, Math.max(0.6, hit.dist - 0.4));
    if (desejada.y < 0.4) desejada.y = 0.4;

    this.cam.position.copy(desejada);
    if (this.tremor > 0) {
      const a = this.tremor * this.tremor * 0.35;
      this.cam.position.x += (Math.random() * 2 - 1) * a;
      this.cam.position.y += (Math.random() * 2 - 1) * a;
      this.cam.position.z += (Math.random() * 2 - 1) * a;
      this.tremor = Math.max(0, this.tremor - dt * 2.5);
    }
    const olhar = this.alvoSuave.clone().addScaledVector(dir, 10).addScaledVector(lado, 0.55);
    if (this.cinematico > 0) {
      this.cinematico -= dt;
      olhar.lerp(this.focoCine, 0.6);
    }
    this.cam.lookAt(olhar);

    const fovAlvo = this.fovBase + clamp((vel - 14) * 0.5, 0, 22) - (this.cinematico > 0 ? 12 : 0);
    this.cam.fov = damp(this.cam.fov, fovAlvo, 4, dt);
    this.cam.updateProjectionMatrix();
  }
}
