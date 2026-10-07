// Interface: vida/foco/XP, minimapa giratório, mapa completo, objetivo, marcadores,
// banners de quadrinhos, contador de combo e dicas contextuais.
import * as THREE from '../vendor/three.module.min.js';
import { LIMITE, MEIO } from './cidade.js';
import { formatarTempo, clamp } from './util.js';

const $ = (s) => document.querySelector(s);

export class Hud {
  constructor(ctx) {
    this.ctx = ctx;
    this.el = $('#hud');
    this.vida = $('#vida-barra');
    this.vidaFantasma = $('#vida-fantasma');
    this.vidaTxt = $('#vida-txt');
    this.focoCel = $('#foco');
    this.xpBarra = $('#xp-barra');
    this.nivelEl = $('#nivel');
    this.objEl = $('#objetivo');
    this.objTitulo = $('#obj-titulo');
    this.objTexto = $('#obj-texto');
    this.objTempo = $('#obj-tempo');
    this.dicaEl = $('#dica');
    this.bannerEl = $('#banner');
    this.comboEl = $('#combo');
    this.miraZip = $('#mira-zip');
    this.marcador = $('#marcador');
    this.sentido = $('#sentido');
    this.contCristais = $('#cont-cristais');
    this.contCrimes = $('#cont-crimes');
    this.xpPop = $('#xp-pop');
    this.velEl = $('#velocidade');
    this.mini = $('#minimapa');
    this.miniCtx = this.mini.getContext('2d');
    this.mapaEl = $('#mapa');
    this.mapaCv = $('#mapa-canvas');
    this.dicaT = 0;
    this.bannerT = 0;
    this.bannerFila = [];
    this.danoT = 0;
    this.vidaFant = 1;
    this.mapaAberto = false;
    this.focoAnt = -1;
    this.preRenderizarMapa();
  }

  preRenderizarMapa() {
    const cid = this.ctx.cidade;
    const T = Math.ceil(LIMITE * 2 + 60);
    const cv = document.createElement('canvas');
    cv.width = cv.height = T;
    const g = cv.getContext('2d');
    const o = T / 2;
    g.fillStyle = '#1d4f78'; g.fillRect(0, 0, T, T);
    g.fillStyle = '#9d9a92'; g.fillRect(o - LIMITE, o - LIMITE, LIMITE * 2, LIMITE * 2);
    g.fillStyle = '#3a3f52'; g.fillRect(o - MEIO - 9, o - MEIO - 9, MEIO * 2 + 18, MEIO * 2 + 18);
    g.fillStyle = '#b9b3a8';
    for (const c of cid.colisores) if (c.tipo === 'calcada') { g.fillRect(o + c.min.x, o + c.min.z, c.max.x - c.min.x, c.max.z - c.min.z); }
    g.fillStyle = '#6fae5a';
    for (const p of cid.parque) g.fillRect(o + p.x0, o + p.z0, p.x1 - p.x0, p.z1 - p.z0);
    const ordenados = [...cid.predios].sort((a, b) => a.h - b.h);
    for (const p of ordenados) {
      const k = clamp(p.h / 220, 0, 1);
      const l = Math.round(70 + k * 120);
      g.fillStyle = `rgb(${l * 0.85}, ${l * 0.9}, ${l + 20})`;
      g.fillRect(o + p.x0, o + p.z0, p.x1 - p.x0, p.z1 - p.z0);
      g.strokeStyle = 'rgba(10,14,30,0.6)'; g.lineWidth = 1;
      g.strokeRect(o + p.x0, o + p.z0, p.x1 - p.x0, p.z1 - p.z0);
    }
    if (cid.torre) {
      g.fillStyle = '#ffc23d';
      g.beginPath(); g.arc(o + cid.torre.x, o + cid.torre.z, 6, 0, Math.PI * 2); g.fill();
    }
    this.mapaImg = cv;
    this.mapaO = o;
  }

  // ------------------------------------------------------------ mensagens
  dica(txt, dur = 3.5) {
    if (this.dicaEl.textContent !== txt) this.dicaEl.textContent = txt;
    this.dicaEl.classList.add('visivel');
    this.dicaT = Math.max(this.dicaT, dur);
  }

  aviso(txt) { this.dica(txt, 3); }

  banner(titulo, texto, tipo = 'crime', dur = 3) {
    this.bannerFila.push({ titulo, texto, tipo, dur });
    if (this.bannerT <= 0) this.proximoBanner();
  }

  proximoBanner() {
    const b = this.bannerFila.shift();
    if (!b) { this.bannerEl.classList.remove('visivel'); return; }
    this.bannerEl.className = `banner banner-${b.tipo}`;
    this.bannerEl.innerHTML = `<div class="banner-titulo">${b.titulo}</div><div class="banner-texto">${b.texto}</div>`;
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('visivel');
    this.bannerT = b.dur;
  }

  objetivo(titulo, texto, tempo) {
    if (!titulo) { this.objEl.classList.remove('visivel'); return; }
    this.objEl.classList.add('visivel');
    if (this.objTitulo.textContent !== titulo) this.objTitulo.textContent = titulo;
    if (this.objTexto.textContent !== texto) this.objTexto.textContent = texto;
    const tt = tempo == null || !isFinite(tempo) ? '' : formatarTempo(tempo);
    if (this.objTempo.textContent !== tt) this.objTempo.textContent = tt;
    this.objTempo.classList.toggle('urgente', tempo != null && tempo < 10);
  }

  xpGanho(q, motivo) {
    const el = document.createElement('div');
    el.className = 'xp-item';
    el.textContent = `+${q} XP · ${motivo}`;
    this.xpPop.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  levouDano() { this.danoT = 1; this.vidaFantDelay = 0.6; }

  alternarMapa(forcar) {
    this.mapaAberto = forcar ?? !this.mapaAberto;
    this.mapaEl.classList.toggle('visivel', this.mapaAberto);
    if (this.mapaAberto) this.desenharMapa();
  }

  // ------------------------------------------------------------ quadro a quadro
  atualizar(dt) {
    const { jogador: jog, missoes: mis, camJogo, camera } = this.ctx;
    // vida
    const k = jog.hp / jog.hpMax;
    this.vida.style.width = `${k * 100}%`;
    this.vidaFantDelay = Math.max(0, (this.vidaFantDelay || 0) - dt);
    if (this.vidaFantDelay <= 0) this.vidaFant += (k - this.vidaFant) * Math.min(1, dt * 3);
    if (this.vidaFant < k) this.vidaFant = k;
    this.vidaFantasma.style.width = `${this.vidaFant * 100}%`;
    this.vida.classList.toggle('baixa', k < 0.3);
    this.vidaTxt.textContent = `${Math.ceil(jog.hp)}`;
    // foco
    const f = Math.round(jog.foco * 20) / 20;
    if (f !== this.focoAnt || this.focoCel.children.length !== jog.focoMax) {
      this.focoAnt = f;
      if (this.focoCel.children.length !== jog.focoMax) {
        this.focoCel.innerHTML = '';
        for (let i = 0; i < jog.focoMax; i++) { const d = document.createElement('div'); d.className = 'foco-cel'; d.innerHTML = '<i></i>'; this.focoCel.appendChild(d); }
      }
      [...this.focoCel.children].forEach((c, i) => {
        const v = clamp(jog.foco - i, 0, 1);
        c.firstChild.style.width = `${v * 100}%`;
        c.classList.toggle('cheia', v >= 1);
      });
    }
    this.xpBarra.style.width = `${(mis.xp / mis.xpNecessario()) * 100}%`;
    this.nivelEl.textContent = mis.nivel;
    this.contCristais.textContent = `${mis.qtdColetados}/${mis.cristais.length}`;
    this.contCrimes.textContent = mis.crimesResolvidos;
    const v = jog.vel.length();
    this.velEl.textContent = `${Math.round(v * 3.6)} km/h`;
    this.velEl.classList.toggle('rapido', v > 30);

    // combo
    if (jog.contadorCombo >= 2) {
      this.comboEl.classList.add('visivel');
      const t = `${jog.contadorCombo}`;
      if (this.comboEl.dataset.n !== t) {
        this.comboEl.dataset.n = t;
        this.comboEl.innerHTML = `<b>${t}</b><span>GOLPES</span>`;
        this.comboEl.classList.remove('pulso'); void this.comboEl.offsetWidth; this.comboEl.classList.add('pulso');
      }
    } else this.comboEl.classList.remove('visivel');

    // dica / banner
    if (this.dicaT > 0) { this.dicaT -= dt; if (this.dicaT <= 0) this.dicaEl.classList.remove('visivel'); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.proximoBanner(); }

    // sentido aranha
    this.sentido.classList.toggle('visivel', this.ctx.inimigos.perigo > 0.05);

    // mira do zip
    const W = innerWidth, H = innerHeight;
    const p = new THREE.Vector3();
    if (jog.alvoZipVisivel) {
      p.copy(jog.alvoZipVisivel).project(camera);
      this.miraZip.style.transform = `translate(${((p.x + 1) / 2) * W}px, ${((1 - p.y) / 2) * H}px)`;
      this.miraZip.classList.add('visivel');
    } else this.miraZip.classList.remove('visivel');

    // marcador do objetivo (com seta na borda quando fora da tela)
    const alvo = mis.alvoHud;
    if (alvo) {
      p.copy(alvo.pos).project(camera);
      const atras = p.z > 1;
      let x = p.x, y = p.y;
      if (atras) { x = -x; y = -y; }
      const fora = atras || Math.abs(x) > 0.92 || Math.abs(y) > 0.88;
      if (fora) {
        const m = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.85);
        x /= m; y /= m;
      }
      const dist = Math.round(alvo.pos.distanceTo(jog.pos));
      this.marcador.style.transform = `translate(${((x + 1) / 2) * W}px, ${((1 - y) / 2) * H}px)`;
      this.marcador.style.setProperty('--cor', alvo.cor);
      this.marcador.classList.add('visivel');
      this.marcador.classList.toggle('fora', fora);
      const ang = Math.atan2(-y, x);
      this.marcador.style.setProperty('--ang', `${ang}rad`);
      this.marcador.querySelector('span').textContent = `${alvo.rotulo} ${dist} m`;
    } else this.marcador.classList.remove('visivel');

    this.desenharMinimapa(camJogo.yaw);
    if (this.mapaAberto) this.desenharMapa();
  }

  desenharMinimapa(yaw) {
    const g = this.miniCtx, cv = this.mini;
    const S = cv.width, c = S / 2;
    const jog = this.ctx.jogador;
    const esc = 0.75 * (S / 190);
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(c, c, c - 3, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#1d4f78'; g.fillRect(0, 0, S, S);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const rot = -Math.PI / 2 - Math.atan2(fz, fx);
    g.translate(c, c);
    g.rotate(rot);
    g.scale(esc, esc);
    g.drawImage(this.mapaImg, -this.mapaO - jog.pos.x, -this.mapaO - jog.pos.z);
    g.restore();
    // marcadores (presos na borda)
    const marc = this.ctx.missoes.marcadores();
    const raioMax = c - 10;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (const m of marc) {
      const dx = (m.x - jog.pos.x) * esc, dz = (m.z - jog.pos.z) * esc;
      let sx = dx * cr - dz * sr, sy = dx * sr + dz * cr;
      const l = Math.hypot(sx, sy);
      if (l > raioMax) { sx *= raioMax / l; sy *= raioMax / l; }
      g.fillStyle = m.cor; g.strokeStyle = '#0b0f24'; g.lineWidth = 2;
      g.beginPath();
      if (m.tipo === 'desafio') g.rect(c + sx - 5, c + sy - 5, 10, 10);
      else g.arc(c + sx, c + sy, 6, 0, Math.PI * 2);
      g.fill(); g.stroke();
    }
    // cristais próximos
    g.fillStyle = '#ffd84a';
    for (const cr2 of this.ctx.missoes.cristais) {
      if (cr2.pego) continue;
      const dx = (cr2.p.x - jog.pos.x) * esc, dz = (cr2.p.z - jog.pos.z) * esc;
      if (Math.hypot(dx, dz) > raioMax) continue;
      const sx = dx * cr - dz * sr, sy = dx * sr + dz * cr;
      g.beginPath(); g.moveTo(c + sx, c + sy - 5); g.lineTo(c + sx + 3.5, c + sy); g.lineTo(c + sx, c + sy + 5); g.lineTo(c + sx - 3.5, c + sy); g.fill();
    }
    // jogador (seta na direção do movimento relativo à câmera)
    const fac = jog.facing;
    const vx = Math.sin(fac), vz = Math.cos(fac);
    const ax = vx * cr - vz * sr, ay = vx * sr + vz * cr;
    const a = Math.atan2(ay, ax);
    g.save(); g.translate(c, c); g.rotate(a);
    g.fillStyle = '#33e1ff'; g.strokeStyle = '#0b0f24'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, 6); g.lineTo(-3, 0); g.lineTo(-6, -6); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.strokeStyle = '#0b0f24'; g.lineWidth = 4; g.beginPath(); g.arc(c, c, c - 3, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#33e1ff'; g.lineWidth = 2; g.beginPath(); g.arc(c, c, c - 6, 0, Math.PI * 2); g.stroke();
    // Norte
    const norte = { x: sr * (c - 14), y: -cr * (c - 14) };
    g.fillStyle = '#ffffff'; g.font = 'bold 13px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', c + norte.x, c + norte.y);
  }

  desenharMapa() {
    const cv = this.mapaCv;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d');
    const T = this.mapaImg.width;
    const esc = Math.min(W, H) / T;
    const ox = (W - T * esc) / 2, oy = (H - T * esc) / 2;
    g.fillStyle = '#0d1a33'; g.fillRect(0, 0, W, H);
    g.drawImage(this.mapaImg, ox, oy, T * esc, T * esc);
    const P = (x, z) => [ox + (x + this.mapaO) * esc, oy + (z + this.mapaO) * esc];
    for (const c of this.ctx.missoes.cristais) {
      if (c.pego) continue;
      const [x, y] = P(c.p.x, c.p.z);
      g.fillStyle = '#ffd84a'; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 4, y); g.lineTo(x, y + 5); g.lineTo(x - 4, y); g.fill();
    }
    for (const m of this.ctx.missoes.marcadores()) {
      const [x, y] = P(m.x, m.z);
      g.fillStyle = m.cor; g.strokeStyle = '#0b0f24'; g.lineWidth = 2;
      g.beginPath(); if (m.tipo === 'desafio') g.rect(x - 7, y - 7, 14, 14); else g.arc(x, y, 8, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    const jog = this.ctx.jogador;
    const [px, py] = P(jog.pos.x, jog.pos.z);
    g.save(); g.translate(px, py); g.rotate(Math.atan2(Math.cos(jog.facing), Math.sin(jog.facing)));
    g.fillStyle = '#33e1ff'; g.strokeStyle = '#0b0f24'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(12, 0); g.lineTo(-8, 8); g.lineTo(-4, 0); g.lineTo(-8, -8); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
