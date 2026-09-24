// Porte de PlantController.cs (Pilar 3): motor de crescimento e saúde de uma planta.
// O mesmo código serve para a planta do jogador e para a planta-clone da IA.

export class PlantController {
  /**
   * @param {object} cfg  balanceamento.planta
   */
  constructor(cfg) {
    this.crop = null;
    this.baseGrowthRate = cfg.baseGrowthRate;
    this.maxHealthDecay = cfg.maxHealthDecay;
    this.healthRegenRate = cfg.healthRegenRate;
    this.limiarEstresse = cfg.limiarEstresse;
    this.limiarRecuperacao = cfg.limiarRecuperacao;
    this.estagios = cfg.estagios;
    // Quanto maior, mais o crescimento cai quando as condições pioram (q³: 0,9 → 73%).
    this.expoenteCondicao = cfg.expoenteCondicao ?? 1;
    this.Reset();
  }

  Reset() {
    this.health = 100;
    this.growthPoints = 0;
    this.ultimaCondicao = 1;
    // Para a pontuação: média da saúde ao longo do ciclo.
    this.somaSaude = 0;
    this.tempoVivo = 0;
  }

  get progresso() { return this.crop ? Math.min(1, this.growthPoints / this.crop.growthPointsToHarvest) : 0; }
  get colhida() { return this.progresso >= 1; }
  get morta() { return this.health <= 0; }

  /** Estágio 0..5 (Semente, Muda, Vegetativo, Floração, Frutificação, Colheita). */
  get estagio() {
    if (this.colhida) return this.estagios - 1;
    return Math.min(this.estagios - 2, Math.floor(this.progresso * (this.estagios - 1)));
  }

  get saudeMedia() { return this.tempoVivo > 0 ? this.somaSaude / this.tempoVivo : this.health; }

  /** Avança a planta: cresce mais rápido com boas condições e perde saúde com as ruins. */
  Tick(env, dt) {
    if (!this.crop || this.morta || this.colhida) return;
    const q = this.crop.EvaluateConditions(env);
    this.ultimaCondicao = q;

    this.growthPoints += this.baseGrowthRate * q ** this.expoenteCondicao * (0.5 + 0.5 * (this.health / 100)) * dt;

    if (q < this.limiarEstresse) this.health -= this.maxHealthDecay * (1 - q) * dt;
    else if (q >= this.limiarRecuperacao) this.health += this.healthRegenRate * dt;
    this.health = Math.max(0, Math.min(100, this.health));

    this.somaSaude += this.health * dt;
    this.tempoVivo += dt;
  }
}
