// Porte de EnvironmentState.cs (Pilar 1).
// O estado físico-químico da bancada: as 7 variáveis do jogo, o enum das 4 ações
// e a faixa ideal. Não toca DOM nem Canvas (roda no Node nos testes).

/** As 4 ações do jogo (enum FarmAction do C#). */
export const FarmAction = Object.freeze({
  DoNothing: 'DoNothing',
  LockIrrigation: 'LockIrrigation',
  Irrigate: 'Irrigate',
  ProtectPlant: 'ProtectPlant',
});

export const ACOES = Object.values(FarmAction);

/** Faixa ideal de uma variável (struct IdealRange do C#). */
export class IdealRange {
  constructor(min, max) {
    this.min = min;
    this.max = max;
  }

  static de(obj) { return new IdealRange(obj.min, obj.max); }

  get centro() { return (this.min + this.max) / 2; }

  /** Diz se o valor está dentro da faixa. */
  Contains(valor) { return valor >= this.min && valor <= this.max; }

  /** Quão fora da faixa o valor está: 0 dentro; 1 quando fica uma largura de faixa inteira para fora. */
  Stress(valor) {
    const largura = Math.max(1e-6, this.max - this.min);
    if (valor < this.min) return Math.min(1, (this.min - valor) / largura);
    if (valor > this.max) return Math.min(1, (valor - this.max) / largura);
    return 0;
  }
}

/** Nomes das 7 variáveis, na ordem usada no HUD e no snapshot da IA. */
export const VARIAVEIS = ['nitrogen', 'phosphorus', 'potassium', 'ph', 'airTemperature', 'soilMoisture', 'luminosity'];

export class EnvironmentState {
  constructor(valores = {}) {
    this.nitrogen = 150;       // N (mg/L)
    this.phosphorus = 50;      // P (mg/L)
    this.potassium = 210;      // K (mg/L)
    this.ph = 6.0;             // pH da solução
    this.airTemperature = 22;  // °C
    this.soilMoisture = 68;    // % do substrato
    this.luminosity = 65;      // % de luz
    Object.assign(this, valores);
  }

  /** Estado inicial no centro das faixas da cultura (ponto de partida do GameManager). */
  static paraCultura(crop) {
    return new EnvironmentState({
      nitrogen: crop.nitrogenRange.centro,
      phosphorus: crop.phosphorusRange.centro,
      potassium: crop.potassiumRange.centro,
      ph: crop.phRange.centro,
      airTemperature: crop.temperatureRange.centro,
      soilMoisture: crop.moistureRange.centro,
      luminosity: crop.luminosityRange.centro,
    });
  }

  /** Cópia independente (a IA usa para ter o ambiente dela). */
  Clone() { return new EnvironmentState(this.toJSON()); }

  /** Mantém as variáveis em limites físicos (nada de umidade negativa ou pH 20). */
  limitar() {
    this.nitrogen = limitar(this.nitrogen, 0, 400);
    this.phosphorus = limitar(this.phosphorus, 0, 150);
    this.potassium = limitar(this.potassium, 0, 500);
    this.ph = limitar(this.ph, 3, 9);
    this.airTemperature = limitar(this.airTemperature, -5, 50);
    this.soilMoisture = limitar(this.soilMoisture, 0, 100);
    this.luminosity = limitar(this.luminosity, 0, 100);
  }

  /**
   * Decide, pelas faixas da cultura, qual das 4 ações a situação pede.
   * Mesma ordem de prioridade do Sr. Bruno (Pilar 7).
   */
  SuggestAction(crop) {
    if (this.airTemperature > crop.temperatureRange.max || this.luminosity > crop.luminosityRange.max) return FarmAction.ProtectPlant;
    if (this.soilMoisture > crop.moistureRange.max) return FarmAction.LockIrrigation;
    if (this.soilMoisture < crop.moistureRange.min) return FarmAction.Irrigate;
    if (this.nitrogen < crop.nitrogenRange.min || this.phosphorus < crop.phosphorusRange.min || this.potassium < crop.potassiumRange.min) {
      return FarmAction.Irrigate;
    }
    if (!crop.phRange.Contains(this.ph)) return FarmAction.LockIrrigation;
    return FarmAction.DoNothing;
  }

  toJSON() {
    const o = {};
    for (const v of VARIAVEIS) o[v] = this[v];
    return o;
  }
}

export function limitar(v, min, max) { return v < min ? min : v > max ? max : v; }
