// Áudio 100% sintetizado (WebAudio): efeitos, vento da velocidade, sirene e trilha procedural.
export class Audio {
  constructor() {
    this.ctx = null;
    this.ligado = true;
    this.volMusica = 0.55;
    this.volEfeitos = 0.9;
    this.intensidade = 0; // 0 calmo, 1 ação
  }

  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.mestre = c.createGain(); this.mestre.gain.value = this.ligado ? 0.9 : 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.mestre.connect(comp).connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = this.volEfeitos; this.sfx.connect(this.mestre);
    this.mus = c.createGain(); this.mus.gain.value = this.volMusica * 0.5; this.mus.connect(this.mestre);

    // ruído branco reutilizável
    const len = c.sampleRate * 2;
    this.ruido = c.createBuffer(1, len, c.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // vento contínuo
    const v = c.createBufferSource(); v.buffer = this.ruido; v.loop = true;
    this.ventoFiltro = c.createBiquadFilter(); this.ventoFiltro.type = 'bandpass'; this.ventoFiltro.frequency.value = 500; this.ventoFiltro.Q.value = 0.7;
    this.ventoGanho = c.createGain(); this.ventoGanho.gain.value = 0;
    v.connect(this.ventoFiltro).connect(this.ventoGanho).connect(this.sfx);
    v.start();

    // sirene (para crimes)
    this.sireneOsc = c.createOscillator(); this.sireneOsc.type = 'sawtooth'; this.sireneOsc.frequency.value = 700;
    const sf = c.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1400;
    this.sireneGanho = c.createGain(); this.sireneGanho.gain.value = 0;
    this.sirenePan = c.createStereoPanner();
    this.sireneOsc.connect(sf).connect(this.sireneGanho).connect(this.sirenePan).connect(this.sfx);
    this.sireneOsc.start();

    this.iniciarMusica();
  }

  alternar() {
    this.ligado = !this.ligado;
    if (this.mestre) this.mestre.gain.setTargetAtTime(this.ligado ? 0.9 : 0, this.ctx.currentTime, 0.05);
    return this.ligado;
  }

  setVolumes(musica, efeitos) {
    this.volMusica = musica; this.volEfeitos = efeitos;
    if (!this.ctx) return;
    this.mus.gain.setTargetAtTime(musica * 0.5, this.ctx.currentTime, 0.1);
    this.sfx.gain.setTargetAtTime(efeitos, this.ctx.currentTime, 0.1);
  }

  get t() { return this.ctx.currentTime; }

  _ruido(dur, freqA, freqB, q, vol, tipo = 'bandpass', atraso = 0, destino = this.sfx) {
    const c = this.ctx, t = this.t + atraso;
    const s = c.createBufferSource(); s.buffer = this.ruido;
    const f = c.createBiquadFilter(); f.type = tipo; f.Q.value = q;
    f.frequency.setValueAtTime(freqA, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(destino);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  _tom(freqA, freqB, dur, vol, tipo = 'sine', atraso = 0, destino = this.sfx) {
    const c = this.ctx, t = this.t + atraso;
    const o = c.createOscillator(); o.type = tipo;
    o.frequency.setValueAtTime(freqA, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(destino); o.start(t); o.stop(t + dur + 0.05);
  }

  tocar(nome, vol = 1) {
    if (!this.ctx || !this.ligado) return;
    switch (nome) {
      case 'thwip':
        this._ruido(0.16, 5200, 900, 3, 0.55 * vol);
        this._tom(2400, 900, 0.07, 0.12 * vol, 'triangle');
        break;
      case 'soltar': this._ruido(0.25, 600, 2400, 1, 0.18 * vol); break;
      case 'soco':
        this._tom(150, 45, 0.18, 0.9 * vol, 'sine');
        this._ruido(0.08, 2500, 400, 1.2, 0.5 * vol, 'lowpass');
        break;
      case 'chute':
        this._tom(110, 35, 0.25, 1.0 * vol, 'sine');
        this._ruido(0.14, 1800, 200, 1, 0.55 * vol, 'lowpass');
        break;
      case 'esquiva': this._ruido(0.3, 300, 3000, 2, 0.35 * vol); break;
      case 'pouso':
        this._tom(90, 30, 0.35, 0.8 * vol, 'sine');
        this._ruido(0.4, 800, 80, 0.8, 0.6 * vol, 'lowpass');
        break;
      case 'passo': this._ruido(0.05, 900, 300, 1, 0.08 * vol, 'lowpass'); break;
      case 'teiaAcerta': this._ruido(0.2, 1500, 300, 2, 0.4 * vol); this._tom(500, 180, 0.15, 0.2 * vol, 'square'); break;
      case 'tiro': this._ruido(0.22, 3000, 120, 0.7, 0.9 * vol, 'lowpass'); this._tom(220, 50, 0.12, 0.5 * vol, 'square'); break;
      case 'sentido':
        for (let k = 0; k < 3; k++) this._tom(1800 + k * 300, 2600 + k * 200, 0.12, 0.12 * vol, 'sine', k * 0.04);
        break;
      case 'dano': this._tom(200, 70, 0.3, 0.6 * vol, 'sawtooth'); this._ruido(0.2, 1000, 200, 1, 0.4 * vol, 'lowpass'); break;
      case 'coleta': [880, 1108, 1318, 1760].forEach((f, k) => this._tom(f, f, 0.18, 0.22 * vol, 'triangle', k * 0.06)); break;
      case 'anel': this._tom(1320, 1760, 0.18, 0.25 * vol, 'triangle'); this._tom(660, 880, 0.2, 0.15 * vol, 'sine'); break;
      case 'nivel': [523, 659, 784, 1046, 1318].forEach((f, k) => this._tom(f, f, 0.35, 0.25 * vol, 'square', k * 0.09)); break;
      case 'missao': [392, 523, 659, 784].forEach((f, k) => this._tom(f, f * 1.01, 0.3, 0.22 * vol, 'triangle', k * 0.11)); break;
      case 'falha': [392, 349, 311, 262].forEach((f, k) => this._tom(f, f * 0.98, 0.3, 0.22 * vol, 'sawtooth', k * 0.14)); break;
      case 'finalizar':
        this._tom(300, 40, 0.6, 1.0 * vol, 'sine');
        this._ruido(0.5, 4000, 100, 0.8, 0.7 * vol, 'lowpass');
        this._tom(1200, 300, 0.3, 0.2 * vol, 'square', 0.05);
        break;
      case 'lento': this._tom(400, 120, 0.8, 0.3 * vol, 'sine'); this._ruido(0.7, 2000, 200, 4, 0.25 * vol); break;
      case 'ui': this._tom(900, 1200, 0.06, 0.12 * vol, 'triangle'); break;
      case 'bloqueio': this._tom(800, 600, 0.1, 0.3 * vol, 'square'); this._ruido(0.08, 6000, 2000, 2, 0.3 * vol); break;
      case 'lancar': this._ruido(0.45, 400, 4000, 1.5, 0.4 * vol); this._tom(200, 600, 0.3, 0.2 * vol, 'sawtooth'); break;
      default: break;
    }
  }

  atualizar(dt, velocidade, sirene) {
    if (!this.ctx) return;
    const t = this.t;
    const v = Math.min(1, Math.max(0, (velocidade - 8) / 50));
    this.ventoGanho.gain.setTargetAtTime(v * v * 0.6, t, 0.12);
    this.ventoFiltro.frequency.setTargetAtTime(300 + v * 1800, t, 0.15);
    // sirene: duas notas alternadas, volume pela distância
    if (sirene) {
      const vol = Math.max(0, 1 - sirene.dist / 260) * 0.07;
      this.sireneGanho.gain.setTargetAtTime(vol, t, 0.2);
      this.sireneOsc.frequency.setTargetAtTime((Math.floor(t * 1.6) % 2) ? 760 : 580, t, 0.03);
      this.sirenePan.pan.setTargetAtTime(Math.max(-1, Math.min(1, sirene.pan)), t, 0.1);
    } else this.sireneGanho.gain.setTargetAtTime(0, t, 0.3);
  }

  // ---------------------------------------------------------------- trilha procedural
  iniciarMusica() {
    this.bpm = 104;
    this.passoMus = 0;
    this.proxNota = this.ctx.currentTime + 0.1;
    // progressão heroica em Ré menor: Dm - Bb - F - C
    this.acordes = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]];
    clearInterval(this._timer);
    this._timer = setInterval(() => this.agendar(), 50);
  }

  agendar() {
    if (!this.ctx) return;
    const seg = 60 / this.bpm / 4; // semicolcheia
    while (this.proxNota < this.ctx.currentTime + 0.15) {
      this.tocarPasso(this.passoMus, this.proxNota);
      this.proxNota += seg;
      this.passoMus = (this.passoMus + 1) % 256;
    }
  }

  tocarPasso(p, t) {
    if (!this.ligado) return;
    const c = this.ctx, I = this.intensidade;
    const passoNoCompasso = p % 16;
    const ac = this.acordes[Math.floor(p / 32) % 4];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const nota = (freq, dur, vol, tipo, filtro = 3000) => {
      const o = c.createOscillator(); o.type = tipo; o.frequency.value = freq;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filtro;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f).connect(g).connect(this.mus); o.start(t); o.stop(t + dur + 0.02);
    };
    const bat = (freqA, freqB, dur, vol) => {
      const o = c.createOscillator(); o.frequency.setValueAtTime(freqA, t); o.frequency.exponentialRampToValueAtTime(freqB, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.mus); o.start(t); o.stop(t + dur);
    };
    const ruido = (dur, freq, vol, tipo = 'highpass') => {
      const s = c.createBufferSource(); s.buffer = this.ruido;
      const f = c.createBiquadFilter(); f.type = tipo; f.frequency.value = freq;
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f).connect(g).connect(this.mus); s.start(t, Math.random()); s.stop(t + dur);
    };
    // bumbo e caixa
    if (passoNoCompasso % 8 === 0 || (I > 0.5 && passoNoCompasso === 10)) bat(140, 40, 0.3, 0.9);
    if (passoNoCompasso === 4 || passoNoCompasso === 12) ruido(0.18, 1500, 0.35 + 0.15 * I, 'bandpass');
    if (passoNoCompasso % 2 === 0) ruido(0.04, 8000, I > 0.3 ? 0.12 : 0.06);
    // baixo pulsante
    if (passoNoCompasso % 2 === 0) nota(hz(ac[0] - 12), 0.18, 0.28, 'sawtooth', 500 + 600 * I);
    // pad
    if (passoNoCompasso === 0 && p % 32 === 0) for (const m of ac) nota(hz(m), 60 / this.bpm * 8, 0.05, 'triangle', 1800);
    // arpejo (só em ação)
    if (I > 0.25 && p % 2 === 0) {
      const m = ac[(p / 2) % 3] + 12 + ((p % 16) >= 8 ? 12 : 0);
      nota(hz(m), 0.12, 0.05 * I, 'square', 2600);
    }
  }
}
