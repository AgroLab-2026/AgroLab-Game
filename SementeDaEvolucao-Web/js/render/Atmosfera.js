// Atmosfera em alta resolução por cima da pixel art (canvas #atmosfera, 1024×682 do palco ×2):
// brilho suave nas fontes de luz, poeira dourada flutuando nos raios de sol, gotas de chuva em
// primeiro plano, brasas subindo na onda de calor. A pixel art continua nítida; só a luz é suave
// (a mistura de "8 bits com iluminação moderna" que dá profundidade à cena).
// Só lê a vista do mundo; não altera a simulação.

import { LAYOUT } from './Cenario.js';

const L = 1024, A = 682, Q = 2; // Q: resolução extra do canvas
const E = 2;                     // mundo (512×341) → palco (1024×682)

// Fontes de luz fixas do cenário (coordenadas do palco).
const LUZES = [
  { x: 208, y: 348, r: 70, cor: [255, 190, 90], forca: 0.55, tipo: 'lampiao' },
  { x: 722, y: 196, r: 46, cor: [90, 230, 255], forca: 0.35, tipo: 'tela' },
  { x: 661, y: 132, r: 40, cor: [90, 220, 255], forca: 0.35, tipo: 'tela' },
  { x: 775, y: 268, r: 34, cor: [120, 180, 255], forca: 0.3, tipo: 'tela' },
  { x: 556, y: 222, r: 26, cor: [120, 255, 160], forca: 0.22, tipo: 'tela' },
  { x: 615, y: 222, r: 26, cor: [120, 255, 160], forca: 0.22, tipo: 'tela' },
];

/** Sprite de brilho (gradiente radial) pré-desenhado, para pintar muitas vezes sem custo. */
function sprite(cor, tamanho = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = tamanho;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(tamanho / 2, tamanho / 2, 0, tamanho / 2, tamanho / 2, tamanho / 2);
  const [r, gg, b] = cor;
  grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grad.addColorStop(0.35, `rgba(${r},${gg},${b},.45)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, tamanho, tamanho);
  return c;
}

export class Atmosfera {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = L * Q;
    canvas.height = A * Q;
    this.ctx = canvas.getContext('2d');
    this.sprites = new Map();
    this.rng = Math.random;
    // Poeira/pólen na luz que entra pelo vidro (sobre as duas estufas).
    this.poeira = Array.from({ length: 46 }, () => this.novaPoeira(true));
    this.gotas = Array.from({ length: 70 }, () => this.novaGota(true));
    this.brasas = Array.from({ length: 30 }, () => this.novaBrasa(true));
    this.faiscas = [];   // brilhos curtos: frutos maduros, mudança de estágio, névoa da irrigação
    this.estagioAnterior = { jogador: null, ia: null };
    this._proximoBrilho = 0;
  }

  brilho(cor) {
    const k = cor.join(',');
    if (!this.sprites.has(k)) this.sprites.set(k, sprite(cor));
    return this.sprites.get(k);
  }

  novaPoeira(inicio) {
    return {
      x: 200 + this.rng() * 600, y: inicio ? 40 + this.rng() * 460 : 500 + this.rng() * 20,
      r: 1 + this.rng() * 2.2, vy: -(4 + this.rng() * 9), fase: this.rng() * 6.28, vel: 0.6 + this.rng() * 1.2,
    };
  }

  novaGota(inicio) {
    return { x: this.rng() * (L + 200), y: inicio ? this.rng() * A : -40 - this.rng() * 80, v: 650 + this.rng() * 350, c: 18 + this.rng() * 26, a: 0.3 + this.rng() * 0.35 };
  }

  novaBrasa(inicio) {
    return { x: 190 + this.rng() * 620, y: inicio ? 100 + this.rng() * 420 : 520, vy: -(18 + this.rng() * 30), r: 0.8 + this.rng() * 1.6, fase: this.rng() * 6.28, vida: 1 };
  }

  /** Névoa d'água sobre o canteiro (jogador) ou as prateleiras (IA) quando alguém irriga. */
  borrifar(quem) {
    const area = quem === 'ia' ? { x0: 524, x1: 646, y0: 190, y1: 390 } : { x0: 310, x1: 500, y0: 170, y1: 420 };
    for (let i = 0; i < 26; i++) {
      this.faiscas.push({
        x: area.x0 + this.rng() * (area.x1 - area.x0), y: area.y0 + this.rng() * (area.y1 - area.y0),
        vx: (this.rng() - 0.5) * 10, vy: -6 - this.rng() * 10, vida: 0.8 + this.rng() * 0.6, total: 1.4,
        r: 2 + this.rng() * 3, cor: [150, 210, 255], tipo: 'nevoa',
      });
    }
  }

  /** Estrelinha de brilho (frutos maduros) ou faísca dourada (mudou de estágio). */
  faisca(x, y, tipo) {
    this.faiscas.push(tipo === 'estagio'
      ? { x, y, vx: (this.rng() - 0.5) * 30, vy: -20 - this.rng() * 30, vida: 0.9, total: 0.9, r: 2 + this.rng() * 2, cor: [255, 225, 120], tipo }
      : { x, y, vx: 0, vy: -3, vida: 0.7, total: 0.7, r: 3.5, cor: [255, 255, 230], tipo: 'estrela' });
  }

  /** Planta mudou de estágio: chuva de faíscas douradas sobre as plantas daquela estufa. */
  verificarEstagios(vista) {
    for (const quem of ['jogador', 'ia']) {
      const e = vista[quem]?.estagio;
      const antes = this.estagioAnterior[quem];
      this.estagioAnterior[quem] = e;
      if (antes === null || e === undefined || e <= antes) continue;
      const plantas = quem === 'ia' ? LAYOUT.plantasIA : LAYOUT.plantasJogador;
      for (let i = 0; i < 18; i++) {
        const pl = plantas[Math.floor(this.rng() * plantas.length)];
        this.faisca(pl.x * E, pl.y * E - 8, 'estagio');
      }
    }
  }

  /**
   * @param {{tempo:number, evento:string|null}} vista  vistaMundo
   * @param {number} dt segundos reais
   */
  desenhar(vista, dt) {
    const c = this.ctx, t = vista.tempo, ev = vista.evento;
    c.setTransform(Q, 0, 0, Q, 0, 0);
    c.clearRect(0, 0, L, A);
    c.globalCompositeOperation = 'lighter';

    // Brilho das luzes: o lampião pisca como chama; as telas apagam na falta de energia.
    for (const luz of LUZES) {
      if (luz.tipo === 'tela' && ev === 'PowerFailure') continue;
      let forca = luz.forca;
      if (luz.tipo === 'lampiao') forca *= (ev === 'PowerFailure' ? 1.8 : 1) * (0.85 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.05);
      else forca *= 0.9 + Math.sin(t * 2 + luz.x) * 0.1;
      c.globalAlpha = Math.min(1, forca);
      c.drawImage(this.brilho(luz.cor), luz.x - luz.r, luz.y - luz.r, luz.r * 2, luz.r * 2);
    }

    // Luz de cultivo (LED) sob cada prateleira da estufa autônoma: apaga na falta de energia.
    if (ev !== 'PowerFailure') {
      const led = this.brilho([255, 170, 235]);
      for (const py of LAYOUT.prateleiras) {
        c.globalAlpha = 0.3 + Math.sin(t * 1.3 + py) * 0.04;
        c.drawImage(led, 516, py * E - 34, 134, 30);
      }
    }

    // Frutos maduros (colheita) cintilam de vez em quando.
    this.verificarEstagios(vista);
    if (dt > 0 && t > this._proximoBrilho) {
      this._proximoBrilho = t + 0.25;
      for (const [quem, plantas] of [['jogador', LAYOUT.plantasJogador], ['ia', LAYOUT.plantasIA]]) {
        if (vista[quem]?.estagio !== 5 || vista[quem].saude01 < 0.4) continue;
        const pl = plantas[Math.floor(this.rng() * plantas.length)];
        this.faisca(pl.x * E + (this.rng() - 0.5) * 10, pl.y * E - 6 - this.rng() * 14, 'estrela');
      }
    }
    for (const f of this.faiscas) {
      f.vida -= dt; f.x += f.vx * dt; f.y += f.vy * dt;
      const k = Math.max(0, f.vida / f.total);
      if (f.tipo === 'estrela') {
        // Cruz de luz: aparece e some.
        const a = Math.sin(k * Math.PI);
        c.globalAlpha = 0.9 * a;
        c.fillStyle = '#fffbe0';
        c.fillRect(f.x - f.r, f.y - 0.5, f.r * 2, 1);
        c.fillRect(f.x - 0.5, f.y - f.r, 1, f.r * 2);
        c.globalAlpha = 0.5 * a;
        const d = f.r * 3;
        c.drawImage(this.brilho(f.cor), f.x - d / 2, f.y - d / 2, d, d);
      } else {
        c.globalAlpha = (f.tipo === 'nevoa' ? 0.35 : 0.8) * k;
        const d = f.r * (f.tipo === 'nevoa' ? 4 : 3);
        c.drawImage(this.brilho(f.cor), f.x - d / 2, f.y - d / 2, d, d);
      }
    }
    this.faiscas = this.faiscas.filter((f) => f.vida > 0);

    // Poeira dourada: some na chuva e no escuro.
    const comLuz = ev !== 'HeavyRain' && ev !== 'PowerFailure';
    const poeiraSprite = this.brilho(ev === 'HeatWave' ? [255, 200, 120] : [255, 240, 200]);
    for (const p of this.poeira) {
      p.y += p.vy * dt;
      p.x += Math.sin(t * p.vel + p.fase) * 8 * dt;
      if (p.y < 30) Object.assign(p, this.novaPoeira(false));
      if (!comLuz) continue;
      const pisca = 0.35 + 0.65 * Math.max(0, Math.sin(t * p.vel * 1.7 + p.fase));
      c.globalAlpha = 0.55 * pisca;
      const d = p.r * 5;
      c.drawImage(poeiraSprite, p.x - d / 2, p.y - d / 2, d, d);
    }

    // Onda de calor: brasas subindo.
    if (ev === 'HeatWave') {
      const s = this.brilho([255, 140, 50]);
      for (const b of this.brasas) {
        b.y += b.vy * dt;
        b.x += Math.sin(t * 3 + b.fase) * 12 * dt;
        if (b.y < 60) Object.assign(b, this.novaBrasa(false));
        c.globalAlpha = 0.5 + Math.sin(t * 6 + b.fase) * 0.3;
        const d = b.r * 7;
        c.drawImage(s, b.x - d / 2, b.y - d / 2, d, d);
      }
    }
    c.globalCompositeOperation = 'source-over';

    // Chuva: gotas longas e borradas em primeiro plano (a pixel art já tem a chuva fina).
    if (ev === 'HeavyRain') {
      c.lineCap = 'round';
      for (const g of this.gotas) {
        g.y += g.v * dt;
        g.x -= g.v * 0.28 * dt;
        if (g.y > A + 40) Object.assign(g, this.novaGota(false));
        c.globalAlpha = g.a;
        c.strokeStyle = '#d8ecff';
        c.lineWidth = 1.2 + g.a * 2;
        c.beginPath();
        c.moveTo(g.x, g.y);
        c.lineTo(g.x + g.c * 0.28, g.y - g.c);
        c.stroke();
      }
      // Relâmpago de vez em quando.
      const raio = Math.sin(t * 0.9) > 0.995 || Math.sin(t * 1.37 + 1) > 0.997;
      if (raio) { c.globalAlpha = 0.35; c.fillStyle = '#e8f4ff'; c.fillRect(0, 0, L, A); }
    }
    c.globalAlpha = 1;
  }
}
