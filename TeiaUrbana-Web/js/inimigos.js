// Bandidos: brigões (corpo a corpo), atiradores e brutamontes (bloqueiam socos).
// IA com "fichas de ataque" (no máximo 2 atacando ao mesmo tempo) e aviso de sentido aranha.
import * as THREE from '../vendor/three.module.min.js';
import { criarHumanoide, Animador, Poses } from './modelo.js';
import { CAMADA_FX, dampAng, clamp, toon } from './util.js';

const TIPOS = {
  brigao: { hp: 4, vel: 5.6, dano: 10, dist: 1.9, preparo: 0.75, escala: 1, xp: 20 },
  atirador: { hp: 3, vel: 4.6, dano: 8, dist: 11, preparo: 1.15, escala: 1, xp: 25 },
  bruto: { hp: 10, vel: 3.6, dano: 18, dist: 2.3, preparo: 1.0, escala: 1.32, xp: 45 },
};

const JAQUETAS = ['#e0703a', '#4d8f4f', '#7d7d86', '#9b3b3b', '#3b5f9b', '#c9a43a', '#6a4a8a'];
const PELES = ['#c98d6a', '#8d5a3c', '#e2b08c', '#6b4330', '#d9a07a'];

function texSprite(desenho, w = 128, h = 128) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  desenho(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const TEX_AVISO = () => texSprite((g, w, h) => {
  g.translate(w / 2, h / 2);
  g.beginPath();
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, r = k % 2 ? 40 : 60;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = '#ffdd33'; g.fill();
  g.lineWidth = 6; g.strokeStyle = '#d0142c'; g.stroke();
  g.fillStyle = '#d0142c'; g.font = 'bold 64px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('!', 0, 4);
});

export class Inimigo {
  constructor(mgr, tipo, pos, grupo) {
    this.mgr = mgr;
    this.tipo = tipo;
    this.cfg = TIPOS[tipo];
    this.grupo = grupo;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.hp = this.cfg.hp;
    this.estado = 'ocioso';
    this.timer = 0;
    this.cooldown = 1 + Math.random() * 2;
    this.teia = 0;
    this.vivo = true;
    this.temFicha = false;
    this.orbita = Math.random() < 0.5 ? 1 : -1;
    this.tempo = Math.random() * 10;
    this.avisou = false;
    this.morteT = 0;

    const r = Math.random;
    const { raiz, j } = criarHumanoide({
      pele: PELES[Math.floor(r() * PELES.length)],
      tronco: JAQUETAS[Math.floor(r() * JAQUETAS.length)],
      bracos: tipo === 'bruto' ? PELES[1] : null,
      pernas: ['#2b2f3a', '#3b4252', '#45372b'][Math.floor(r() * 3)],
      cabeca: r() < 0.5 ? 'gorro' : 'cabelo',
      cabelo: ['#1a1a1a', '#2a2a40', '#5a3a1a', '#b03030'][Math.floor(r() * 4)],
      escala: this.cfg.escala,
      peitoLarg: tipo === 'bruto' ? 1.45 : 1,
      ombros: tipo === 'bruto' ? 0.25 : 0.2,
    });
    this.raiz = raiz;
    this.j = j;
    this.anim = new Animador(j);
    if (tipo === 'atirador') {
      const arma = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.28), toon('#202228'));
      arma.position.set(0, -0.07, 0.1);
      j.maoD.add(arma);
      this.arma = arma;
    }
    // Casulo de teia (cresce a cada acerto)
    const geoCasulo = new THREE.IcosahedronGeometry(0.5, 1); geoCasulo.computeVertexNormals();
    this.casulo = new THREE.Mesh(geoCasulo, toon('#f1f5ff'));
    this.casulo.visible = false;
    this.casulo.position.y = 1.0;
    raiz.add(this.casulo);
    // Aviso de ataque
    this.aviso = new THREE.Sprite(new THREE.SpriteMaterial({ map: mgr.texAviso, depthTest: false, transparent: true }));
    this.aviso.scale.setScalar(0.8);
    this.aviso.position.y = 2.45 * this.cfg.escala;
    this.aviso.visible = false;
    this.aviso.layers.set(CAMADA_FX);
    this.aviso.renderOrder = 10;
    raiz.add(this.aviso);
    raiz.position.copy(this.pos);
    mgr.ctx.cena.add(raiz);
  }

  centro() { return this.pos.clone().add(new THREE.Vector3(0, 1.1 * this.cfg.escala, 0)); }

  soltarFicha() { if (this.temFicha) { this.temFicha = false; this.mgr.fichas--; } }

  remover() {
    this.soltarFicha();
    this.mgr.ctx.cena.remove(this.raiz);
    if (this.laser) this.mgr.ctx.cena.remove(this.laser);
  }

  derrotar(como) {
    if (!this.vivo) return;
    this.vivo = false;
    this.soltarFicha();
    this.estado = 'derrotado';
    this.morteT = 0;
    this.aviso.visible = false;
    if (this.laser) this.laser.visible = false;
    if (como === 'teia') { this.casulo.visible = true; this.casulo.scale.set(1.1, 1.9, 1.1); }
    this.mgr.ctx.aoDerrotarInimigo(this, como);
  }

  receberGolpe(dano, tipo, dir) {
    if (!this.vivo) return false;
    const atordoado = ['atordoado', 'teiado', 'noAr', 'recuperar'].includes(this.estado);
    if (this.tipo === 'bruto' && !atordoado && tipo === 'soco' && this.teia === 0) {
      const paraJog = this.mgr.ctx.jogador.pos.clone().sub(this.pos).normalize();
      const frente = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      if (paraJog.dot(frente) > 0.2) {
        this.mgr.ctx.efeitos.onoma('BLOCK!', this.centro(), 'block', 0.9);
        this.mgr.ctx.audio.tocar('bloqueio');
        this.mgr.ctx.hud.dica('O brutamontes bloqueia socos! Acerte-o com TEIA (botão direito) ou use a FINALIZAÇÃO.');
        return false;
      }
    }
    this.hp -= dano;
    this.soltarFicha();
    this.aviso.visible = false;
    if (this.laser) this.laser.visible = false;
    this.vel.copy(dir).multiplyScalar(tipo === 'lancar' ? 9 : 3);
    if (tipo === 'lancar') { this.vel.y = 10; this.estado = 'noAr'; }
    else if (this.hp <= 0) { this.derrotar('golpe'); return true; }
    else if (this.estado !== 'teiado') { this.estado = 'atordoado'; this.timer = 0.5; }
    return true;
  }

  atualizar(dt) {
    const mgr = this.mgr, ctx = mgr.ctx, jog = ctx.jogador;
    this.tempo += dt;
    const an = this.anim;
    an.zerar();
    const paraJog = jog.pos.clone().sub(this.pos);
    const dy = paraJog.y;
    paraJog.y = 0;
    const dist = paraJog.length();
    const dirJog = dist > 0.001 ? paraJog.clone().divideScalar(dist) : new THREE.Vector3(0, 0, 1);
    let mover = new THREE.Vector3();
    let olhar = true;

    switch (this.estado) {
      case 'ocioso':
        Poses.parado(an, this.tempo);
        an.set('ombroD', -0.6 + Math.sin(this.tempo * 3) * 0.3, 0, -0.3); an.set('cotoveloD', -1.2);
        olhar = dist < 40;
        if (dist < 32 && Math.abs(dy) < 30) this.alertar();
        break;
      case 'perseguir': {
        const alvoDist = this.cfg.dist;
        if (dist > alvoDist + 0.6) mover.copy(dirJog);
        else if (dist < alvoDist - 1.2) mover.copy(dirJog).multiplyScalar(-0.7);
        // circula em volta do jogador
        const lado = new THREE.Vector3(-dirJog.z, 0, dirJog.x).multiplyScalar(this.orbita * 0.45);
        mover.add(lado);
        this.cooldown -= dt;
        const alcance = this.tipo === 'atirador' ? 26 : alvoDist + 1.4;
        const alturaOk = this.tipo === 'atirador' ? Math.abs(dy) < 25 : Math.abs(dy) < 2.5;
        if (this.cooldown <= 0 && dist < alcance && alturaOk && mgr.fichas < 2 && !jog.morto) {
          this.estado = 'preparar';
          this.timer = this.cfg.preparo;
          this.temFicha = true;
          mgr.fichas++;
          this.avisou = false;
        }
        const v = mover.length();
        if (v > 0.05) {
          this.fase = (this.fase || 0) + dt * this.cfg.vel * 1.1;
          Poses.correr(an, this.fase, 0.8, 0);
        } else Poses.parado(an, this.tempo);
        break;
      }
      case 'preparar': {
        this.timer -= dt;
        Poses.preparar(an, this.tempo, this.tipo === 'atirador');
        this.aviso.visible = true;
        const s = 0.75 + Math.sin(this.tempo * 18) * 0.12 + (this.timer < 0.4 ? 0.3 : 0);
        this.aviso.scale.setScalar(s);
        this.aviso.material.color.set(this.timer < 0.4 ? '#ffffff' : '#ffd0d0');
        if (this.timer < 0.42 && !this.avisou) { this.avisou = true; mgr.perigo = Math.max(mgr.perigo, 0.5); ctx.audio.tocar('sentido', 0.8); }
        if (this.timer < 0.42) mgr.perigo = 0.5;
        if (this.tipo === 'atirador') this.mostrarLaser(jog);
        else if (dist > 2.2) mover.copy(dirJog).multiplyScalar(0.6);
        if (this.timer <= 0) this.executarAtaque(dist, dy, jog);
        break;
      }
      case 'golpe':
        this.timer -= dt;
        Poses.golpeInimigo(an, 1 - this.timer / 0.45, this.tipo === 'atirador');
        if (this.timer <= 0) { this.estado = 'perseguir'; this.cooldown = 1.4 + Math.random() * 2.2; }
        break;
      case 'atordoado':
        this.timer -= dt;
        Poses.atingido(an, 1 - this.timer / 0.5);
        olhar = false;
        if (this.timer <= 0) { this.estado = 'perseguir'; this.cooldown = Math.max(this.cooldown, 0.6); }
        break;
      case 'noAr':
        Poses.queda(an, this.tempo);
        olhar = false;
        this.vel.y -= 30 * dt;
        break;
      case 'teiado':
        this.timer -= dt;
        Poses.preparar(an, this.tempo * 3, false);
        an.set('ombroE', 0, 0, 0.1); an.set('ombroD', 0, 0, -0.1); an.set('cotoveloE', 0); an.set('cotoveloD', 0);
        olhar = false;
        this.casulo.rotation.y += dt * 0.5;
        if (this.timer <= 0) { this.teia = 0; this.casulo.visible = false; this.estado = 'perseguir'; this.cooldown = 1; }
        break;
      case 'derrotado':
        Poses.caido(an);
        olhar = false;
        this.morteT += dt;
        break;
      default: break;
    }

    // Movimento
    const k = this.estado === 'noAr' ? 0 : Math.min(1, dt * 8);
    if (this.estado !== 'noAr') {
      const alvoV = mover.multiplyScalar(this.cfg.vel);
      const ehEmpurrao = this.estado === 'atordoado' || this.estado === 'derrotado';
      if (ehEmpurrao) this.vel.multiplyScalar(Math.exp(-5 * dt));
      else { this.vel.x += (alvoV.x - this.vel.x) * k; this.vel.z += (alvoV.z - this.vel.z) * k; }
    }
    // Separação entre bandidos
    for (const o of mgr.lista) {
      if (o === this || !o.vivo) continue;
      const d = this.pos.clone().sub(o.pos); d.y = 0;
      const l = d.length();
      if (l < 1.4 && l > 0.001) this.pos.addScaledVector(d.divideScalar(l), (1.4 - l) * 0.5);
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.colidir();
    const solo = ctx.cidade.alturaSolo(this.pos.x, this.pos.z, this.pos.y + 0.5);
    if (this.estado === 'noAr') {
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= solo && this.vel.y < 0) {
        this.pos.y = solo;
        ctx.efeitos.poeira(this.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 8, 3);
        if (this.hp <= 0) this.derrotar('golpe');
        else { this.estado = 'atordoado'; this.timer = 0.9; }
      }
    } else this.pos.y = Math.max(solo, this.pos.y - 20 * dt);

    if (olhar && dist > 0.1) this.yaw = dampAng(this.yaw, Math.atan2(dirJog.x, dirJog.z), 8, dt);
    else if (this.vel.lengthSq() > 1 && this.estado === 'perseguir') this.yaw = dampAng(this.yaw, Math.atan2(this.vel.x, this.vel.z), 8, dt);
    if (this.estado !== 'preparar') { this.aviso.visible = false; if (this.laser) this.laser.visible = false; }

    an.aplicar(dt, this.estado === 'golpe' ? 30 : 14);
    this.raiz.position.copy(this.pos);
    this.raiz.rotation.set(0, this.yaw, 0);
    if (this.estado === 'derrotado') {
      this.raiz.rotation.x = -Math.PI / 2 * Math.min(1, this.morteT * 4);
      this.raiz.position.y += 0.15;
      if (this.morteT > 6) this.raiz.position.y -= (this.morteT - 6) * 0.8;
    }
    if (this.estado === 'noAr') this.raiz.rotation.x = -0.7;
  }

  colidir() {
    const c = this.mgr.ctx.cidade;
    const R = 0.4;
    for (const b of c.consultar(this.pos.x - R, this.pos.z - R, this.pos.x + R, this.pos.z + R, this.mgr.tmp)) {
      if (b.max.y - this.pos.y < 0.7 || b.min.y > this.pos.y + 1.6) continue;
      if (this.pos.x + R <= b.min.x || this.pos.x - R >= b.max.x || this.pos.z + R <= b.min.z || this.pos.z - R >= b.max.z) continue;
      const px = Math.min(this.pos.x + R - b.min.x, b.max.x - (this.pos.x - R));
      const pz = Math.min(this.pos.z + R - b.min.z, b.max.z - (this.pos.z - R));
      if (px < pz) this.pos.x += (this.pos.x < (b.min.x + b.max.x) / 2 ? -px : px);
      else this.pos.z += (this.pos.z < (b.min.z + b.max.z) / 2 ? -pz : pz);
    }
  }

  alertar() {
    if (this.estado !== 'ocioso') return;
    this.estado = 'perseguir';
    for (const o of this.mgr.lista) if (o.grupo === this.grupo && o.estado === 'ocioso') o.estado = 'perseguir';
  }

  mostrarLaser(jog) {
    const ctx = this.mgr.ctx;
    if (!this.laser) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
      this.laser = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.8 }));
      this.laser.layers.set(CAMADA_FX);
      this.laser.frustumCulled = false;
      ctx.cena.add(this.laser);
    }
    this.laser.visible = true;
    const a = new THREE.Vector3(); this.arma.getWorldPosition(a);
    const b = jog.centro();
    const pos = this.laser.geometry.attributes.position;
    pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z); pos.needsUpdate = true;
    this.laser.material.opacity = this.timer < 0.4 ? (Math.sin(this.tempo * 50) > 0 ? 1 : 0.3) : 0.5;
  }

  executarAtaque(dist, dy, jog) {
    const ctx = this.mgr.ctx;
    this.estado = 'golpe';
    this.timer = 0.45;
    if (this.tipo === 'atirador') {
      const a = new THREE.Vector3(); this.arma.getWorldPosition(a);
      const r = jog.tentarAcertar(this.cfg.dano, this.pos, 'tiro');
      ctx.audio.tocar('tiro', 0.6);
      const fim = jog.centro();
      if (r !== 'acertou') fim.add(new THREE.Vector3(Math.random() * 4 - 2, Math.random() * 2, Math.random() * 4 - 2));
      this.mgr.rastro(a, fim);
      ctx.efeitos.emitir(a, 6, { vel: 3, cor: '#ffcc55', tam: 0.3, vida: 0.15 });
    } else {
      this.vel.addScaledVector(jog.pos.clone().sub(this.pos).setY(0).normalize(), 5);
      if (dist < 2.9 * this.cfg.escala && Math.abs(dy) < 2.5) {
        const r = jog.tentarAcertar(this.cfg.dano, this.pos, 'soco');
        if (r === 'acertou') { ctx.audio.tocar(this.tipo === 'bruto' ? 'chute' : 'soco'); ctx.efeitos.faiscas(jog.centro(), '#ff6060'); }
      }
    }
    this.soltarFicha();
  }
}

export class Inimigos {
  constructor(ctx) {
    this.ctx = ctx;
    this.lista = [];
    this.fichas = 0;
    this.tmp = [];
    this.perigo = 0;
    this.texAviso = TEX_AVISO();
    this.rastros = [];
    this.extras = []; // alvos de teia que não são bandidos (ex.: carro em fuga)
  }

  criar(tipo, pos, grupo) {
    const i = new Inimigo(this, tipo, pos, grupo);
    this.lista.push(i);
    return i;
  }

  rastro(a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#fff3b0', transparent: true }));
    l.layers.set(CAMADA_FX);
    this.ctx.cena.add(l);
    this.rastros.push({ l, t: 0 });
  }

  atualizar(dt) {
    this.perigo = Math.max(0, this.perigo - dt * 2);
    for (let i = this.lista.length - 1; i >= 0; i--) {
      const e = this.lista[i];
      e.atualizar(dt);
      if (!e.vivo && e.morteT > 8) { e.remover(); this.lista.splice(i, 1); }
    }
    for (let i = this.rastros.length - 1; i >= 0; i--) {
      const r = this.rastros[i];
      r.t += dt;
      r.l.material.opacity = 1 - r.t / 0.15;
      if (r.t > 0.15) { this.ctx.cena.remove(r.l); r.l.geometry.dispose(); this.rastros.splice(i, 1); }
    }
    const jog = this.ctx.jogador;
    jog.emCombate = this.lista.some((e) => e.vivo && e.estado !== 'ocioso' && e.pos.distanceTo(jog.pos) < 35);
  }

  vivosDoGrupo(grupo) { return this.lista.filter((e) => e.vivo && e.grupo === grupo); }

  limparGrupo(grupo) {
    for (let i = this.lista.length - 1; i >= 0; i--) {
      if (this.lista[i].grupo === grupo) { this.lista[i].remover(); this.lista.splice(i, 1); }
    }
  }

  alvoAtaque(pos, dir, maxDist, incluirTeiados = true) {
    let melhor = null, nota = Infinity;
    const d = dir.clone(); d.y = 0; d.normalize();
    for (const e of this.lista) {
      if (!e.vivo) continue;
      if (!incluirTeiados && e.estado === 'teiado') continue;
      const v = e.pos.clone().sub(pos);
      const dy = Math.abs(v.y);
      v.y = 0;
      const dist = v.length();
      if (dist > maxDist || dy > 6) continue;
      const ang = dist > 0.5 ? v.normalize().dot(d) : 1;
      if (ang < -0.2 && dist > 3) continue;
      const s = dist * (1.6 - ang) + dy;
      if (s < nota) { nota = s; melhor = e; }
    }
    return melhor;
  }

  alvoTeia(pos, camPos, camDir, maxDist) {
    let melhor = null, nota = Infinity;
    for (const e of [...this.lista, ...this.extras]) {
      if (!e.vivo) continue;
      const c = e.centro();
      if (c.distanceTo(pos) > maxDist) continue;
      const v = c.clone().sub(camPos).normalize();
      const ang = v.dot(camDir);
      if (ang < 0.85) continue;
      const s = (1 - ang) * 100 + c.distanceTo(pos) * 0.05;
      if (s < nota) { nota = s; melhor = e; }
    }
    return melhor;
  }

  golpeEmArea(ponto, raio, dano, tipo, frente, preferido) {
    let n = 0;
    for (const e of this.lista) {
      if (!e.vivo) continue;
      const ok = e === preferido ? e.centro().distanceTo(ponto) < raio + 1.2 : e.centro().distanceTo(ponto) < raio;
      if (!ok) continue;
      const dir = e.pos.clone().sub(this.ctx.jogador.pos).setY(0).normalize();
      if (e.receberGolpe(dano, tipo, dir)) n++;
    }
    return n;
  }

  acertarTeia(e) {
    if (!e.vivo) return;
    if (e.isCarro) { e.acertarTeia(); return; }
    e.teia++;
    e.soltarFicha();
    e.aviso.visible = false;
    if (e.laser) e.laser.visible = false;
    e.casulo.visible = true;
    const s = 0.7 + e.teia * 0.25;
    e.casulo.scale.set(s, s * 1.4, s);
    e.estado = 'teiado';
    e.timer = 4;
    e.vel.set(0, 0, 0);
    this.ctx.efeitos.onoma('THWAP!', e.centro(), 'thwip', 0.8);
    if (e.teia >= 3 || (e.teia >= 2 && e.hp <= 2)) e.derrotar('teia');
  }

  finalizar(e) { e.hp = 0; e.derrotar('finalizacao'); }

  ondaDeChoque(pos, raio) {
    for (const e of this.lista) {
      if (!e.vivo) continue;
      const d = e.pos.distanceTo(pos);
      if (d < raio) e.receberGolpe(1, 'lancar', e.pos.clone().sub(pos).setY(0).normalize());
    }
  }
}
