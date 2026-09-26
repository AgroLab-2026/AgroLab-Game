// Porte de ResourceSystem.cs (Pilar 4): água, fertilizante e energia do jogador.
// A escassez é o que cria a tensão educativa: cada ação manual custa.
import { Evento } from '../core/Eventos.js';

export class ResourceSystem {
  constructor(cfg) {
    this.cfg = cfg;
    this.OnResourceDepleted = new Evento();
    this.Reset();
  }

  Reset() {
    const c = this.cfg;
    this.water = c.water;
    this.waterMax = c.waterMax;
    this.nutrientStock = c.nutrientStock;
    this.nutrientMax = c.nutrientMax;
    this.energy = c.energy;
    this.energyMax = c.energyMax;
    this.energyRegenPerSecond = c.energyRegenPerSecondReal;
    this.regeneracaoBloqueada = false;
    // Métricas de consumo (para o relatório de fim de fase).
    this.aguaGasta = 0;
    this.fertilizanteGasto = 0;
    this.energiaGasta = 0;
  }

  /** Recupera energia devagar (segundos reais, como o Update do Unity). */
  Tick(dtReal) {
    if (this.regeneracaoBloqueada) return;
    this.energy = Math.min(this.energyMax, this.energy + this.energyRegenPerSecond * dtReal);
  }

  /** Tenta gastar; devolve false (e avisa) se faltar algum recurso. */
  TrySpend(agua, fertilizante, energia) {
    const faltou = [];
    if (agua > this.water + 1e-9) faltou.push('água');
    if (fertilizante > this.nutrientStock + 1e-9) faltou.push('fertilizante');
    if (energia > this.energy + 1e-9) faltou.push('energia');
    if (faltou.length) {
      for (const r of faltou) this.OnResourceDepleted.emit(r);
      return false;
    }
    this.water -= agua;
    this.nutrientStock -= fertilizante;
    this.energy -= energia;
    this.aguaGasta += agua;
    this.fertilizanteGasto += fertilizante;
    this.energiaGasta += energia;
    return true;
  }

  /** Reabastece a água (custa energia: é o fazendeiro carregando baldes). */
  RefillWater() {
    const custo = this.cfg.refill.energia;
    if (this.water >= this.waterMax - 1e-6) return false;
    if (!this.TrySpend(0, 0, custo)) return false;
    this.water = this.waterMax;
    return true;
  }
}
