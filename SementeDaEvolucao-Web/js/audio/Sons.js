// Efeitos sonoros sintetizados com a Web Audio API (nenhum arquivo de áudio:
// funciona offline e sem direitos autorais). Cada som é montado com osciladores
// e ruído filtrado. O navegador só libera o áudio depois de um clique ou tecla,
// por isso iniciar() é chamado no primeiro gesto do jogador.

const CHAVE_MUDO = 'semente.mudo';

export class Sons {
  constructor() {
    this.ctx = null;
    this.volume = 1;
    this.mudo = false;
    try { this.mudo = localStorage.getItem(CHAVE_MUDO) === '1'; } catch { /* sem localStorage */ }
    this._chuva = null;
    this._ultimo = {};
  }

  /** Cria/retoma o contexto de áudio (precisa de um gesto do usuário). */
  iniciar() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.mestre = this.ctx.createGain();
      this.mestre.gain.value = this.mudo ? 0 : this.volume;
      // Compressor + ganho final: sons bem mais altos sem distorcer (os sons
      // sintetizados saíam em ~10% do volume máximo, baixo demais em notebook).
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.2;
      this.saida = this.ctx.createGain();
      this.saida.gain.value = 1.6;
      this.mestre.connect(this.compressor).connect(this.saida).connect(this.ctx.destination);
      // 2 s de ruído branco, reaproveitado por todos os sons de ruído.
      const n = this.ctx.sampleRate * 2;
      this.bufRuido = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this.bufRuido.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  /** Situação do áudio, para o botão "Testar som" e o modo debug. */
  get situacao() {
    if (!(window.AudioContext || window.webkitAudioContext)) return 'Este navegador não tem suporte a áudio.';
    if (this.mudo) return 'O som está DESLIGADO no jogo (tecla M ou botão ao lado do título).';
    if (!this.ctx) return 'O som ainda não foi liberado: clique na tela ou aperte uma tecla.';
    if (this.ctx.state !== 'running') return `O navegador bloqueou o áudio (${this.ctx.state}). Clique na tela e confira o ícone de som na barra de endereço.`;
    return 'Som funcionando. Se não ouviu nada, confira o volume do computador e a saída de áudio.';
  }

  /** Som de teste: três notas bem audíveis. */
  teste() {
    [523, 659, 784].forEach((f, i) => this.tom({ freq: f, tipo: 'triangle', dur: 0.3, vol: 0.3, atraso: i * 0.18 }));
  }

  get ativo() { return !!this.ctx && !this.mudo; }

  alternarMudo() {
    this.mudo = !this.mudo;
    try { localStorage.setItem(CHAVE_MUDO, this.mudo ? '1' : '0'); } catch { /* ignora */ }
    if (this.mestre) this.mestre.gain.setTargetAtTime(this.mudo ? 0 : this.volume, this.ctx.currentTime, 0.05);
    return this.mudo;
  }

  /** Pausa/retoma todo o áudio (aba oculta, jogo pausado). */
  suspender(sim) {
    if (!this.ctx) return;
    if (sim && this.ctx.state === 'running') this.ctx.suspend();
    if (!sim && this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** Evita repetir o mesmo som várias vezes no mesmo instante. */
  limitar(nome, segundos) {
    const agora = this.ctx.currentTime;
    if (this._ultimo[nome] && agora - this._ultimo[nome] < segundos) return false;
    this._ultimo[nome] = agora;
    return true;
  }

  // ------------------------------------------------------------ primitivas
  /** Um tom com envelope (ataque rápido, decaimento exponencial). */
  tom({ freq, freqFim = freq, tipo = 'sine', dur = 0.15, vol = 0.2, atraso = 0, ataque = 0.005 }) {
    if (!this.ativo) return;
    const c = this.ctx, t = c.currentTime + atraso;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (freqFim !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqFim), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.mestre);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Ruído filtrado (água, vento, chuva, cliques). */
  ruido({ dur = 0.3, vol = 0.2, filtro = 'bandpass', freq = 1000, freqFim = freq, q = 1, atraso = 0, ataque = 0.01 }) {
    if (!this.ativo) return;
    const c = this.ctx, t = c.currentTime + atraso;
    const s = c.createBufferSource();
    s.buffer = this.bufRuido;
    const f = c.createBiquadFilter();
    f.type = filtro;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqFim !== freq) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqFim), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.mestre);
    s.start(t, Math.random() * Math.max(0, 1.9 - dur));
    s.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------ ações do jogador
  /** Irrigar: jato de água dos aspersores + gotinhas. */
  irrigar() {
    this.ruido({ dur: 0.8, vol: 0.22, filtro: 'bandpass', freq: 2400, freqFim: 900, q: 0.8, ataque: 0.04 });
    this.ruido({ dur: 0.6, vol: 0.1, filtro: 'highpass', freq: 5000, atraso: 0.05 });
    for (let i = 0; i < 6; i++) this.tom({ freq: 700 + Math.random() * 600, freqFim: 1500 + Math.random() * 500, dur: 0.05, vol: 0.06, atraso: 0.15 + i * 0.09 + Math.random() * 0.04 });
  }

  /** Travar irrigação: registro girando e fechando (clique metálico). */
  travar() {
    this.ruido({ dur: 0.05, vol: 0.2, filtro: 'highpass', freq: 3000 });
    this.tom({ freq: 260, freqFim: 180, tipo: 'square', dur: 0.08, vol: 0.08, atraso: 0.02 });
    this.tom({ freq: 520, tipo: 'triangle', dur: 0.12, vol: 0.07, atraso: 0.12 });
    this.ruido({ dur: 0.25, vol: 0.08, filtro: 'lowpass', freq: 600, freqFim: 200, atraso: 0.1 });
  }

  /** Proteger: sombrite sendo puxado (tecido ao vento). */
  proteger() {
    this.ruido({ dur: 0.5, vol: 0.4, filtro: 'bandpass', freq: 400, freqFim: 2200, q: 0.7, ataque: 0.08 });
    this.ruido({ dur: 0.3, vol: 0.08, filtro: 'bandpass', freq: 1800, freqFim: 700, q: 1.2, atraso: 0.35 });
  }

  /** Encher o tanque: balde despejando e borbulhando. */
  encher() {
    this.ruido({ dur: 1.1, vol: 0.26, filtro: 'lowpass', freq: 900, freqFim: 500, ataque: 0.1 });
    for (let i = 0; i < 9; i++) this.tom({ freq: 220 + Math.random() * 120, freqFim: 500 + Math.random() * 300, dur: 0.07, vol: 0.07, atraso: 0.1 + i * 0.1 + Math.random() * 0.05 });
  }

  /** Aguardar: "hum" curto e calmo. */
  aguardar() {
    this.tom({ freq: 520, tipo: 'triangle', dur: 0.12, vol: 0.06 });
    this.tom({ freq: 390, tipo: 'triangle', dur: 0.16, vol: 0.05, atraso: 0.1 });
  }

  /** Gasto de energia: faísca elétrica curta. */
  energia() {
    if (!this.ativo || !this.limitar('energia', 0.1)) return;
    this.tom({ freq: 1400, freqFim: 500, tipo: 'sawtooth', dur: 0.09, vol: 0.035 });
    this.tom({ freq: 90, tipo: 'square', dur: 0.1, vol: 0.03 });
  }

  /** Energia/água acabando: dois bipes de alerta. */
  alertaRecurso() {
    if (!this.ativo || !this.limitar('alerta', 2)) return;
    this.tom({ freq: 660, tipo: 'triangle', dur: 0.12, vol: 0.09 });
    this.tom({ freq: 495, tipo: 'triangle', dur: 0.16, vol: 0.09, atraso: 0.14 });
  }

  /** Ação negada (falta recurso). */
  erro() {
    this.tom({ freq: 150, tipo: 'square', dur: 0.14, vol: 0.08 });
    this.tom({ freq: 110, tipo: 'square', dur: 0.2, vol: 0.08, atraso: 0.12 });
  }

  clique() { this.tom({ freq: 1200, tipo: 'triangle', dur: 0.03, vol: 0.05 }); }

  /** Robôs da estufa autônoma: bipe baixinho (no máximo um por segundo). */
  robo() {
    if (!this.ativo || !this.limitar('robo', 1.2)) return;
    this.tom({ freq: 1600, freqFim: 2100, dur: 0.05, vol: 0.02 });
    this.tom({ freq: 2100, freqFim: 1700, dur: 0.05, vol: 0.02, atraso: 0.06 });
  }

  // ------------------------------------------------------------ cronômetro
  /** Tique dos últimos segundos (mais agudo nos 5 finais). */
  relogio(segundosRestantes) {
    const urgente = segundosRestantes <= 5;
    this.tom({ freq: urgente ? 1500 : 1000, tipo: 'square', dur: 0.04, vol: urgente ? 0.07 : 0.045 });
    this.ruido({ dur: 0.03, vol: 0.05, filtro: 'highpass', freq: 4000 });
    if (urgente) this.tom({ freq: 750, tipo: 'square', dur: 0.04, vol: 0.05, atraso: 0.12 });
  }

  /** Tempo esgotado: três bipes de alarme. */
  tempoAcabou() {
    for (let i = 0; i < 3; i++) this.tom({ freq: 880, tipo: 'square', dur: 0.14, vol: 0.09, atraso: i * 0.2 });
  }

  // ------------------------------------------------------------ clima
  /** Onda de calor: zumbido subindo + cigarras. */
  calor() {
    this.tom({ freq: 180, freqFim: 520, tipo: 'sine', dur: 1.2, vol: 0.08, ataque: 0.3 });
    for (let i = 0; i < 3; i++) this.cigarra(0.5 + i * 0.9);
  }

  cigarra(atraso = 0) {
    if (!this.ativo) return;
    const c = this.ctx, t = c.currentTime + atraso;
    const o = c.createOscillator(), lfo = c.createOscillator(), prof = c.createGain(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 4200;
    lfo.type = 'square'; lfo.frequency.value = 38;
    prof.gain.value = 0.5;
    f.type = 'bandpass'; f.frequency.value = 4500; f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    const am = c.createGain(); am.gain.value = 0.5;
    lfo.connect(prof).connect(am.gain);
    o.connect(f).connect(am).connect(g).connect(this.mestre);
    o.start(t); lfo.start(t); o.stop(t + 0.85); lfo.stop(t + 0.85);
  }

  /** Trovão (início da chuva). */
  trovao() {
    this.ruido({ dur: 2.2, vol: 0.4, filtro: 'lowpass', freq: 300, freqFim: 60, ataque: 0.15 });
    this.ruido({ dur: 0.4, vol: 0.2, filtro: 'lowpass', freq: 1200, freqFim: 200, atraso: 0.05 });
  }

  /** Chuva contínua enquanto o evento durar. */
  iniciarChuva() {
    if (!this.ctx || this._chuva) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.bufRuido; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.4;
    const f2 = c.createBiquadFilter(); f2.type = 'highshelf'; f2.frequency.value = 4000; f2.gain.value = -8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 1.5);
    s.connect(f).connect(f2).connect(g).connect(this.mestre);
    s.start();
    this._chuva = { s, g };
    this.trovao();
  }

  pararChuva() {
    if (!this._chuva) return;
    const { s, g } = this._chuva, t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    s.stop(t + 1.6);
    this._chuva = null;
  }

  /** Praga: zumbido de insetos. */
  praga() {
    for (let i = 0; i < 3; i++) {
      const base = 210 + i * 45;
      this.tom({ freq: base, freqFim: base * 1.15, tipo: 'sawtooth', dur: 0.9, vol: 0.06, atraso: i * 0.25, ataque: 0.15 });
    }
  }

  /** Falha de energia: tudo desligando. */
  faltaLuz() {
    this.ruido({ dur: 0.06, vol: 0.25, filtro: 'highpass', freq: 2000 });
    this.tom({ freq: 420, freqFim: 35, tipo: 'sawtooth', dur: 1.3, vol: 0.1, atraso: 0.03 });
  }

  /** Energia voltou. */
  voltaLuz() {
    this.tom({ freq: 60, freqFim: 420, tipo: 'sawtooth', dur: 0.8, vol: 0.06, ataque: 0.2 });
    this.tom({ freq: 1320, tipo: 'sine', dur: 0.2, vol: 0.05, atraso: 0.75 });
  }

  // ------------------------------------------------------------ fim de fase
  /** Planta colhida: arpejo alegre. */
  vitoria() {
    [523, 659, 784, 1047].forEach((f, i) => this.tom({ freq: f, tipo: 'triangle', dur: 0.35, vol: 0.12, atraso: i * 0.12 }));
    this.tom({ freq: 1568, tipo: 'sine', dur: 0.6, vol: 0.06, atraso: 0.5 });
  }

  /** Perdeu uma vida: descida triste. */
  derrota() {
    [392, 330, 262].forEach((f, i) => this.tom({ freq: f, freqFim: f * 0.97, tipo: 'triangle', dur: 0.4, vol: 0.12, atraso: i * 0.25 }));
  }

  gameOver() {
    [392, 370, 349, 330].forEach((f, i) => this.tom({ freq: f, tipo: 'square', dur: 0.35, vol: 0.06, atraso: i * 0.35 }));
    this.tom({ freq: 262, freqFim: 130, tipo: 'triangle', dur: 1.4, vol: 0.12, atraso: 1.4 });
  }

  vitoriaFinal() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tom({ freq: f, tipo: 'triangle', dur: 0.3, vol: 0.12, atraso: i * 0.13 }));
  }
}
