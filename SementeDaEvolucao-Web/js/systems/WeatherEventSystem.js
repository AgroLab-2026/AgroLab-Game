// Porte de WeatherEventSystem.cs (Pilar 8): eventos climáticos em intervalos aleatórios.
// Cada evento foi desenhado para "pedir" uma das 4 ações.
// Tempo em segundos REAIS: a corrotina do Unity não usa o timeScale do GameManager.
import { Evento } from '../core/Eventos.js';

export const WeatherEvent = Object.freeze({
  HeatWave: 'HeatWave',
  HeavyRain: 'HeavyRain',
  Pest: 'Pest',
  PowerFailure: 'PowerFailure',
});

export class WeatherEventSystem {
  constructor(cfg, rng = Math.random) {
    this.cfg = cfg;
    this.rng = rng;
    this.minInterval = cfg.minIntervalReal;
    this.maxInterval = cfg.maxIntervalReal;
    this.eventDuration = cfg.eventDurationReal;
    this.OnEventStarted = new Evento();
    this.OnEventEnded = new Evento();
    this.Reset();
  }

  Reset() {
    this.eventoAtual = null;
    this.restante = 0;
    this.agendarProximo();
  }

  agendarProximo() {
    const ids = Object.keys(this.cfg.eventos);
    this.proximo = ids[Math.floor(this.rng() * ids.length)];
    this.tempoParaProximo = this.minInterval + this.rng() * (this.maxInterval - this.minInterval);
  }

  /** Dados do evento ativo (ou null). */
  get dadosAtuais() { return this.eventoAtual ? this.cfg.eventos[this.eventoAtual] : null; }

  Tick(dtReal) {
    if (this.eventoAtual) {
      this.restante -= dtReal;
      if (this.restante <= 0) {
        const fim = this.eventoAtual;
        this.eventoAtual = null;
        this.agendarProximo();
        this.OnEventEnded.emit(fim);
      }
      return;
    }
    this.tempoParaProximo -= dtReal;
    if (this.tempoParaProximo <= 0) this.Disparar(this.proximo);
  }

  /** Dispara um evento na hora (também usado pelo modo debug). */
  Disparar(id) {
    if (this.eventoAtual) this.OnEventEnded.emit(this.eventoAtual);
    this.eventoAtual = id;
    this.restante = this.eventDuration;
    this.OnEventStarted.emit(id, this.cfg.eventos[id].descricao);
  }
}
