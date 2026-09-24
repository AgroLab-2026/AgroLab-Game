// Desenha o mundo (canvas 512×341): cenário + plantas + personagens + VFX.
// Só lê o "retrato" do estado (vista); não altera a simulação.
import { desenharCenario, LAYOUT, LARGURA, ALTURA } from './Cenario.js';
import { desenharPlanta } from './Plantas.js';
import { spritesFazendeiro, spritesRobo } from './Personagens.js';
import { criarRng, ret, px, elipse, linha } from './Pixel.js';

export class WorldRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = LARGURA;
    canvas.height = ALTURA;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.fundo = desenharCenario();
    this.particulas = [];
    this.rng = criarRng(99);
    this.chuva = Array.from({ length: 140 }, () => ({ x: this.rng() * LARGURA, y: this.rng() * ALTURA, v: 180 + this.rng() * 80 }));
    this.insetos = Array.from({ length: 10 }, (_, i) => ({ i, fase: this.rng() * 6 }));
    this.faz = { x: LAYOUT.fazendeiro.x, y: LAYOUT.fazendeiro.y, alvo: null, volta: null, espera: 0, passo: 0, dir: 1 };
    this.robos = LAYOUT.robos.map((r, i) => ({ ...r, bx: r.x, by: r.y, fase: i * 1.7, alvo: null, espera: 0 }));
    this.efeitos = { irrigaJogador: 0, travaJogador: 0, irrigaIA: 0, travaIA: 0 };
  }

  /** Chamado pelo jogo quando alguém age: dispara a animação correspondente. */
  animarAcao(quem, acao) {
    if (quem === 'jogador') {
      if (acao === 'Irrigate') this.efeitos.irrigaJogador = 1.6;
      if (acao === 'LockIrrigation') this.efeitos.travaJogador = 1.4;
      // O fazendeiro vai até o aspersor mais próximo e volta.
      if (acao !== 'DoNothing') {
        const a = LAYOUT.aspersores[Math.floor(this.rng() * LAYOUT.aspersores.length)];
        this.faz.alvo = { x: a.x + 10, y: a.y + 6 };
        this.faz.volta = { x: LAYOUT.fazendeiro.x, y: LAYOUT.fazendeiro.y };
        this.faz.espera = 0.8;
      }
    } else {
      if (acao === 'Irrigate') this.efeitos.irrigaIA = 1.2;
      if (acao === 'LockIrrigation') this.efeitos.travaIA = 1.2;
      if (acao !== 'DoNothing') {
        const r = this.robos[Math.floor(this.rng() * 2)];
        const p = LAYOUT.plantasIA[Math.floor(this.rng() * LAYOUT.plantasIA.length)];
        r.alvo = { x: 330, y: p.y + 4 };
        r.espera = 0.6;
      }
    }
  }

  desenhar(vista, dt) {
    const c = this.ctx;
    const t = vista.tempo;
    this.atualizar(vista, dt);
    c.drawImage(this.fundo, 0, 0);

    const semEnergia = vista.evento === 'PowerFailure';
    this.lampiao(c, t);
    this.telas(c, t, semEnergia);
    this.ventoinha(c, t, semEnergia);

    // Plantas do jogador + fazendeiro, ordenados por y (profundidade top-down).
    const vento = vista.evento === 'HeavyRain' ? 1 : 0.5;
    const objs = LAYOUT.plantasJogador.map((p, i) => ({ y: p.y, desenhar: () => {
      const bal = Math.sin(t * 2 + i) * vento;
      desenharPlanta(c, p.x, p.y, vista.jogador.visual, vista.jogador.estagio, vista.jogador.saude01, i + 1, bal);
    } }));
    for (const a of LAYOUT.aspersores) objs.push({ y: a.y, desenhar: () => this.aspersor(c, a, t) });
    objs.push({ y: this.faz.y, desenhar: () => this.fazendeiro(c) });
    objs.sort((a, b) => a.y - b.y);
    for (const o of objs) o.desenhar();

    if (vista.jogador.sombra > 0) this.sombrite(c, LAYOUT.canteiro, vista.jogador.sombra);
    this.jatoAgua(c, t, 'jogador');

    // Plantas da IA nas prateleiras + vaso.
    LAYOUT.plantasIA.forEach((p, i) => {
      desenharPlanta(c, p.x, p.y, vista.ia.visual, vista.ia.estagio, vista.ia.saude01, 100 + i, Math.sin(t * 1.5 + i) * 0.3);
    });
    desenharPlanta(c, LAYOUT.vasoIA.x, LAYOUT.vasoIA.y + 3, vista.ia.visual, vista.ia.estagio, vista.ia.saude01, 7, 0);
    if (vista.ia.sombra > 0) this.sombrite(c, { x0: 260, y0: 74, x1: 324, y1: 212 }, vista.ia.sombra);
    this.jatoAgua(c, t, 'ia');
    for (const r of this.robos) this.robo(c, r, t, semEnergia);

    if (vista.evento === 'Pest') this.praga(c, t, vista);
    this.particulasDesenhar(c);
    this.clima(c, vista, t);
  }

  // ------------------------------------------------------------ animação
  atualizar(vista, dt) {
    for (const k of Object.keys(this.efeitos)) this.efeitos[k] = Math.max(0, this.efeitos[k] - dt);
    // Fazendeiro anda até o alvo, espera e volta.
    const f = this.faz;
    const destino = f.alvo || f.volta;
    if (destino) {
      const dx = destino.x - f.x, dy = destino.y - f.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) {
        if (f.alvo) { f.espera -= dt; if (f.espera <= 0) f.alvo = null; }
        else f.volta = null;
      } else {
        const v = Math.min(dist, 48 * dt);
        f.x += (dx / dist) * v; f.y += (dy / dist) * v;
        f.dir = dx < 0 ? -1 : 1;
        f.passo += dt * 8;
      }
    }
    // Robôs: flutuam e patrulham; quando a IA age, vão até a estante.
    for (const r of this.robos) {
      if (r.alvo) {
        const dx = r.alvo.x - r.x, dy = r.alvo.y - r.y, d = Math.hypot(dx, dy);
        if (d < 1) { r.espera -= dt; if (r.espera <= 0) r.alvo = null; }
        else { const v = Math.min(d, 70 * dt); r.x += (dx / d) * v; r.y += (dy / d) * v; }
      } else {
        const dx = r.bx - r.x, dy = r.by - r.y, d = Math.hypot(dx, dy);
        if (d > 0.5) { const v = Math.min(d, 40 * dt); r.x += (dx / d) * v; r.y += (dy / d) * v; }
      }
    }
    // Partículas.
    for (const p of this.particulas) { p.vida -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; }
    this.particulas = this.particulas.filter((p) => p.vida > 0);
    if (vista.evento === 'HeavyRain') for (const g of this.chuva) { g.y += g.v * dt; g.x -= g.v * 0.25 * dt; if (g.y > ALTURA) { g.y = -4; g.x = this.rng() * (LARGURA + 60); } }
  }

  fazendeiro(c) {
    const s = spritesFazendeiro();
    const andando = !!(this.faz.alvo || this.faz.volta) && !(this.faz.alvo && Math.hypot(this.faz.alvo.x - this.faz.x, this.faz.alvo.y - this.faz.y) < 1);
    const lista = this.faz.dir < 0 ? s.esquerda : s.andando;
    const q = andando ? lista[Math.floor(this.faz.passo) % 4] : lista[0];
    const x = Math.round(this.faz.x - q.width / 2), y = Math.round(this.faz.y - q.height);
    c.globalAlpha = 0.35; elipse(c, this.faz.x, this.faz.y, 6, 2, '#1a0f05'); c.globalAlpha = 1;
    c.drawImage(q, x, y);
  }

  robo(c, r, t, semEnergia) {
    const s = spritesRobo();
    const bob = semEnergia ? 0 : Math.round(Math.sin(t * 3 + r.fase) * 1.5);
    const img = (Math.floor(t * 0.7 + r.fase) % 5 === 0) || semEnergia ? s.piscando : s.normal;
    c.globalAlpha = 0.3; elipse(c, r.x, r.y + 2, 5, 1, '#0a1a2a'); c.globalAlpha = 1;
    c.drawImage(img, Math.round(r.x - img.width / 2), Math.round(r.y - img.height - 3 + bob));
  }

  aspersor(c, a, t) {
    ret(c, a.x - 2, a.y - 5, 5, 5, '#6a6e76');
    ret(c, a.x - 2, a.y - 5, 5, 1, '#c8ccd4');
    ret(c, a.x - 4, a.y - 3, 9, 2, '#8a8e96');
    px(c, a.x, a.y - 6, '#4f9fd8');
    if (this.efeitos.travaJogador > 0) {
      // Válvula fechada: um X vermelho piscando.
      if (Math.floor(t * 8) % 2) { linha(c, a.x - 2, a.y - 10, a.x + 2, a.y - 6, '#e2553a'); linha(c, a.x + 2, a.y - 10, a.x - 2, a.y - 6, '#e2553a'); }
    }
  }

  jatoAgua(c, t, quem) {
    if (quem === 'jogador' && this.efeitos.irrigaJogador > 0) {
      for (const a of LAYOUT.aspersores) {
        for (let i = 0; i < 3; i++) {
          const ang = this.rng() * Math.PI * 2, v = 20 + this.rng() * 25;
          this.particulas.push({ x: a.x, y: a.y - 6, vx: Math.cos(ang) * v, vy: -30 - this.rng() * 20, vida: 0.6, cor: '#8fd0f8' });
        }
      }
    }
    if (quem === 'ia' && this.efeitos.irrigaIA > 0) {
      // Gotejamento de precisão: gotas finas caindo em cada bandeja.
      for (const y of LAYOUT.prateleiras) {
        const x = 266 + Math.floor(this.rng() * 52);
        this.particulas.push({ x, y: y - 12, vx: 0, vy: 20, vida: 0.25, cor: '#4fe0f0' });
      }
    }
    if (quem === 'ia' && this.efeitos.travaIA > 0) {
      for (const y of LAYOUT.prateleiras) if (Math.floor(t * 8) % 2) ret(c, 264, y + 1, 56, 1, '#e2553a');
    }
  }

  sombrite(c, area, restante) {
    // Tela de sombreamento verde (some aos poucos no fim).
    const alfa = Math.min(1, restante / 3) * 0.28;
    c.globalAlpha = alfa;
    ret(c, area.x0 - 4, area.y0 - 6, area.x1 - area.x0 + 8, area.y1 - area.y0 + 8, '#1f5a24');
    c.globalAlpha = alfa * 0.7;
    for (let y = area.y0 - 6; y < area.y1 + 2; y += 4) ret(c, area.x0 - 4, y, area.x1 - area.x0 + 8, 1, '#0e2e12');
    for (let x = area.x0 - 4; x < area.x1 + 4; x += 4) ret(c, x, area.y0 - 6, 1, area.y1 - area.y0 + 8, '#0e2e12');
    c.globalAlpha = 1;
    for (const [x, y] of [[area.x0 - 4, area.y0 - 6], [area.x1 + 3, area.y0 - 6], [area.x0 - 4, area.y1 + 1], [area.x1 + 3, area.y1 + 1]]) ret(c, x, y, 2, 2, '#8a6a3a');
  }

  lampiao(c, t) {
    const l = LAYOUT.lampiao;
    const brilho = 0.18 + Math.sin(t * 7) * 0.03 + Math.sin(t * 13) * 0.02;
    c.globalAlpha = brilho;
    elipse(c, l.x, l.y - 4, 14, 10, '#f6a33a');
    c.globalAlpha = brilho * 1.6;
    elipse(c, l.x, l.y - 4, 7, 5, '#ffd27a');
    c.globalAlpha = 1;
  }

  telas(c, t, semEnergia) {
    for (const [i, tl] of LAYOUT.telasLcd.entries()) {
      if (semEnergia) { ret(c, tl.x, tl.y, 9, 4, '#0a140e'); continue; }
      ret(c, tl.x, tl.y, 9, 4, '#123a22');
      const n = 3 + ((Math.floor(t * 1.3) + i * 3) % 5);
      for (let k = 0; k < n; k++) px(c, tl.x + 1 + k, tl.y + 1 + ((k + i) % 2), '#5fe07a');
    }
    const m = LAYOUT.telaMaquina;
    ret(c, m.x, m.y, m.w, m.h, semEnergia ? '#0a140e' : '#123a22');
    if (!semEnergia) for (let k = 0; k < 6; k++) ret(c, m.x + 1 + k * 3, m.y + m.h - 1 - ((k * 3 + Math.floor(t * 4)) % 6), 2, 1 + ((k * 3 + Math.floor(t * 4)) % 6), '#5fe07a');
    const tt = LAYOUT.telaTerminal;
    ret(c, tt.x, tt.y, tt.w, tt.h, semEnergia ? '#0a1018' : '#1e5a8a');
    if (!semEnergia) for (let k = 0; k < 4; k++) ret(c, tt.x + 1, tt.y + 2 + k * 3, 2 + ((k * 5 + Math.floor(t * 2)) % 7), 1, '#bfe6ff');
  }

  ventoinha(c, t, semEnergia) {
    const v = LAYOUT.ventoinha;
    elipse(c, v.x, v.y, v.r + 1, v.r + 1, '#5a626c');
    const ang = semEnergia ? 0.3 : t * 9;
    for (let i = 0; i < 4; i++) {
      const a = ang + (i * Math.PI) / 2;
      linha(c, v.x, v.y, v.x + Math.cos(a) * v.r, v.y + Math.sin(a) * v.r, '#dfe6ec');
      linha(c, v.x + 1, v.y, v.x + 1 + Math.cos(a + 0.3) * (v.r - 1), v.y + Math.sin(a + 0.3) * (v.r - 1), '#b8c4cc');
    }
    ret(c, v.x - 1, v.y - 1, 3, 3, '#3a424c');
  }

  praga(c, t, vista) {
    // Pulgões nas plantas do jogador; na estufa autônoma os robôs dão conta.
    for (const b of this.insetos) {
      const p = LAYOUT.plantasJogador[(b.i * 5) % LAYOUT.plantasJogador.length];
      const x = p.x + Math.round(Math.sin(t * 3 + b.fase) * 4), y = p.y - 4 + Math.round(Math.cos(t * 2 + b.fase) * 2);
      px(c, x, y, '#1a2a0a'); px(c, x + 1, y, '#7fbf3a');
    }
    for (let i = 0; i < 3; i++) {
      const p = LAYOUT.plantasIA[(i * 7) % LAYOUT.plantasIA.length];
      px(c, p.x + Math.round(Math.sin(t * 4 + i) * 3), p.y - 4, '#1a2a0a');
    }
  }

  particulasDesenhar(c) {
    for (const p of this.particulas) px(c, p.x, p.y, p.cor);
  }

  clima(c, vista, t) {
    if (vista.evento === 'HeatWave') {
      c.globalAlpha = 0.14 + Math.sin(t * 2) * 0.04;
      ret(c, 0, 0, LARGURA, ALTURA, '#ff8a2a');
      c.globalAlpha = 0.35;
      for (let i = 0; i < 18; i++) {
        const x = (i * 37 + Math.floor(t * 20)) % LARGURA, y = 70 + ((i * 53) % 170);
        for (let k = 0; k < 6; k++) px(c, x + Math.round(Math.sin(t * 6 + k + i) * 1.5), y - k * 2, '#fff0c0');
      }
      c.globalAlpha = 1;
    } else if (vista.evento === 'HeavyRain') {
      c.globalAlpha = 0.22; ret(c, 0, 0, LARGURA, ALTURA, '#1a2a4a'); c.globalAlpha = 0.7;
      for (const g of this.chuva) linha(c, g.x, g.y, g.x - 2, g.y + 6, '#a8d0f0');
      c.globalAlpha = 1;
    } else if (vista.evento === 'PowerFailure') {
      c.globalAlpha = 0.38 + (Math.sin(t * 17) > 0.93 ? -0.2 : 0);
      ret(c, 0, 0, LARGURA, ALTURA, '#05080f');
      c.globalAlpha = 1;
      this.lampiao(c, t);
    }
  }
}
