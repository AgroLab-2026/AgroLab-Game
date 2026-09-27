// Modo debug (tecla ` / ' ao lado do 1): FPS, EnvironmentState, velocidade 1×/2×/4×,
// disparo de eventos e sobreposição da referência com opacidade ajustável.
import { VARIAVEIS } from '../core/EnvironmentState.js';

export class Debug {
  constructor(gm) {
    this.gm = gm;
    this.el = document.getElementById('debug');
    this.info = document.getElementById('debug-info');
    this.ref = document.getElementById('sobreposicao-ref');
    this.quadros = 0;
    this.fps = 0;
    this._janela = performance.now();

    for (const b of this.el.querySelectorAll('[data-vel]')) {
      b.addEventListener('click', () => { this.gm.velocidade = Number(b.dataset.vel); });
    }
    const ctrl = this.el.querySelector('.debug-ctrl');
    const eventos = document.createElement('div');
    eventos.innerHTML = 'Evento: ' + Object.entries(gm.bal.clima.eventos).map(([id, e]) => `<button data-evento="${id}">${e.nome}</button>`).join('');
    ctrl.appendChild(eventos);
    for (const b of eventos.querySelectorAll('[data-evento]')) b.addEventListener('click', () => this.gm.weather.Disparar(b.dataset.evento));

    const opac = document.getElementById('debug-opacidade');
    opac.addEventListener('input', () => {
      this.ref.classList.toggle('escondido', opac.value === '0');
      this.ref.style.opacity = String(opac.value / 100);
    });
  }

  get visivel() { return !this.el.classList.contains('escondido'); }
  alternar() { this.el.classList.toggle('escondido'); }

  quadro() {
    this.quadros++;
    const agora = performance.now();
    if (agora - this._janela >= 500) {
      this.fps = (this.quadros * 1000) / (agora - this._janela);
      this.quadros = 0;
      this._janela = agora;
    }
    if (!this.visivel) return;
    const gm = this.gm, f = (x) => (typeof x === 'number' ? x.toFixed(2) : x);
    const linhas = [
      `FPS ${this.fps.toFixed(0)} · estado ${gm.estado} · velocidade ${gm.velocidade}× · timeScale ${gm.timeScale}`,
      `fase ${gm.progressao.faseAtual} · ${gm.crop.cropName} · tempo de jogo ${gm.tempo.toFixed(0)} s`,
      `provedor IA: ${gm.aiAI.lastSource} · falhas ${gm.provedorIA.falhas}`,
      `som: ${window.jogo?.sons?.ctx?.state ?? 'não iniciado'}${window.jogo?.sons?.mudo ? ' (MUDO)' : ''}`,
      `IA: ${gm.aiAI.ScoreboardLine()}`,
      `evento: ${gm.weather.eventoAtual ?? '-'} · próximo ${gm.weather.proximo} em ${gm.weather.tempoParaProximo.toFixed(0)} s`,
      '',
      'variável        jogador     IA     faixa',
      ...VARIAVEIS.map((v) => {
        const fx = gm.crop.faixaDe(v);
        return `${v.padEnd(15)} ${f(gm.playerEnv[v]).padStart(7)} ${f(gm.aiAI.aiEnv[v]).padStart(7)}   ${fx.min}–${fx.max}`;
      }),
      `saúde           ${f(gm.playerPlant.health).padStart(7)} ${f(gm.aiAI.aiPlant.health).padStart(7)}`,
      `crescimento     ${f(gm.playerPlant.growthPoints).padStart(7)} ${f(gm.aiAI.aiPlant.growthPoints).padStart(7)}`,
      `sombra (s)      ${f(gm.estufaJogador.sombra).padStart(7)} ${f(gm.aiAI.estufa.sombra).padStart(7)}`,
    ];
    this.info.textContent = linhas.join('\n');
  }
}
