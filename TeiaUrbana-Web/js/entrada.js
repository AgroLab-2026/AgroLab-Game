// Teclado + mouse (pointer lock) + controle (Gamepad API) unificados em ações.
const TECLAS = {
  frente: ['KeyW', 'ArrowUp'], tras: ['KeyS', 'ArrowDown'], esq: ['KeyA', 'ArrowLeft'], dir: ['KeyD', 'ArrowRight'],
  pular: ['Space'], balancar: ['ShiftLeft', 'ShiftRight'], esquivar: ['KeyC'], zip: ['KeyQ'],
  finalizar: ['KeyF'], curar: ['KeyR'], interagir: ['KeyE'], mapa: ['KeyM', 'Tab'], pausa: ['Escape', 'KeyP'],
  hora: ['KeyT'], som: ['KeyN'], atacarTecla: ['KeyJ'], teiaTecla: ['KeyK'],
};

export class Entrada {
  constructor(alvo) {
    this.alvo = alvo;
    this.baixo = new Set();
    this.apertados = new Set();
    this.mouse = { dx: 0, dy: 0, esq: false, dir: false, meio: false };
    this.cliques = new Set();
    this.travado = false;
    this.sensibilidade = 1;
    this.inverterY = false;
    this.ultimoDispositivo = 'teclado';
    this.padAnterior = [];
    this.padAcoes = new Set();
    this.padApertos = new Set();
    this.padMover = [0, 0];
    this.padOlhar = [0, 0];

    addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.baixo.has(e.code)) this.apertados.add(e.code);
      this.baixo.add(e.code);
      this.ultimoDispositivo = 'teclado';
    });
    addEventListener('keyup', (e) => this.baixo.delete(e.code));
    addEventListener('blur', () => { this.baixo.clear(); this.mouse.esq = this.mouse.dir = false; });
    alvo.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.esq = true; this.cliques.add('esq'); }
      if (e.button === 2) { this.mouse.dir = true; this.cliques.add('dir'); }
      if (e.button === 1) { this.mouse.meio = true; this.cliques.add('meio'); e.preventDefault(); }
      this.ultimoDispositivo = 'teclado';
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.esq = false;
      if (e.button === 2) this.mouse.dir = false;
      if (e.button === 1) this.mouse.meio = false;
    });
    alvo.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.travado) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => { this.travado = document.pointerLockElement === alvo; });
  }

  travar() {
    if (document.pointerLockElement !== this.alvo) {
      try { const p = this.alvo.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* sem pointer lock */ }
    }
  }
  soltar() { if (document.pointerLockElement) document.exitPointerLock(); }

  tecla(acao) { return TECLAS[acao].some((k) => this.baixo.has(k)); }
  teclaApertou(acao) { return TECLAS[acao].some((k) => this.apertados.has(k)); }

  // ----- Controle
  lerControle() {
    this.padApertos.clear();
    this.padAcoes.clear();
    this.padMover = [0, 0];
    this.padOlhar = [0, 0];
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p && p.connected);
    if (!pad) return;
    const zm = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    const b = pad.buttons.map((x) => (x ? x.value > 0.4 : false));
    const mapa = { 0: 'pular', 1: 'esquivar', 2: 'atacar', 3: 'teia', 4: 'zip', 5: 'finalizar', 7: 'balancar', 6: 'balancar', 13: 'curar', 12: 'interagir', 8: 'mapa', 9: 'pausa', 10: 'interagir', 11: 'finalizar' };
    for (const [i, acao] of Object.entries(mapa)) {
      if (b[i]) {
        this.padAcoes.add(acao);
        if (!this.padAnterior[i]) this.padApertos.add(acao);
      }
    }
    this.padAnterior = b;
    this.padMover = [zm(pad.axes[0] || 0), -zm(pad.axes[1] || 0)];
    this.padOlhar = [zm(pad.axes[2] || 0), zm(pad.axes[3] || 0)];
    if (b.some(Boolean) || Math.abs(this.padMover[0]) + Math.abs(this.padMover[1]) > 0.1) this.ultimoDispositivo = 'controle';
  }

  // ----- API de ações
  segurando(acao) {
    if (this.padAcoes.has(acao)) return true;
    if (acao === 'atacar') return this.mouse.esq || this.tecla('atacarTecla');
    if (acao === 'teia') return this.mouse.dir || this.tecla('teiaTecla');
    return TECLAS[acao] ? this.tecla(acao) : false;
  }

  apertou(acao) {
    if (this.padApertos.has(acao)) return true;
    if (acao === 'atacar') return this.cliques.has('esq') || this.teclaApertou('atacarTecla');
    if (acao === 'teia') return this.cliques.has('dir') || this.teclaApertou('teiaTecla');
    if (acao === 'zip' && this.cliques.has('meio')) return true;
    return TECLAS[acao] ? this.teclaApertou(acao) : false;
  }

  mover() {
    let x = 0, y = 0;
    if (this.tecla('frente')) y += 1;
    if (this.tecla('tras')) y -= 1;
    if (this.tecla('dir')) x += 1;
    if (this.tecla('esq')) x -= 1;
    x += this.padMover[0]; y += this.padMover[1];
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return [x, y];
  }

  // Delta de câmera em radianos
  olhar(dt) {
    const s = 0.0022 * this.sensibilidade;
    let dx = this.mouse.dx * s, dy = this.mouse.dy * s;
    dx += this.padOlhar[0] * 3.2 * dt * this.sensibilidade;
    dy += this.padOlhar[1] * 2.4 * dt * this.sensibilidade;
    if (this.inverterY) dy = -dy;
    this.mouse.dx = 0; this.mouse.dy = 0;
    return [dx, dy];
  }

  houveOlhar() { return this.mouse.dx !== 0 || this.mouse.dy !== 0 || Math.abs(this.padOlhar[0]) + Math.abs(this.padOlhar[1]) > 0.05; }

  fimDoQuadro() { this.apertados.clear(); this.cliques.clear(); }
}
