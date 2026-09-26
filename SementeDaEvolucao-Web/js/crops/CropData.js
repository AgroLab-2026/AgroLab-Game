// Porte de CropData.cs (Pilar 2): as regras de uma cultura.
// No Unity é um ScriptableObject; aqui vem de data/culturas.json.
import { IdealRange } from '../core/EnvironmentState.js';

const FAIXAS = [
  ['nitrogenRange', 'nitrogen'],
  ['phosphorusRange', 'phosphorus'],
  ['potassiumRange', 'potassium'],
  ['phRange', 'ph'],
  ['temperatureRange', 'airTemperature'],
  ['moistureRange', 'soilMoisture'],
  ['luminosityRange', 'luminosity'],
];

export class CropData {
  constructor(id, dados) {
    this.id = id;
    this.cropName = dados.cropName;
    this.descricaoEducativa = dados.descricaoEducativa;
    this.growthPointsToHarvest = dados.growthPointsToHarvest;
    this.produtividadeKg = dados.produtividadeKg;
    for (const [faixa] of FAIXAS) this[faixa] = IdealRange.de(dados[faixa]);
    this.visual = dados.visual;
  }

  /** Faixa ideal correspondente a uma variável do EnvironmentState. */
  faixaDe(variavel) {
    const par = FAIXAS.find(([, v]) => v === variavel);
    return par ? this[par[0]] : null;
  }

  /** Estresse (0..1) de cada variável. */
  estresses(env) {
    const r = {};
    for (const [faixa, v] of FAIXAS) r[v] = this[faixa].Stress(env[v]);
    return r;
  }

  /**
   * De 0 a 1: o quão favorável o ambiente está para esta cultura.
   * O coração do cálculo de crescimento e saúde (Pilar 2).
   */
  EvaluateConditions(env) {
    let soma = 0;
    for (const [faixa, v] of FAIXAS) soma += this[faixa].Stress(env[v]);
    return 1 - soma / FAIXAS.length;
  }
}

/** Cria todas as culturas a partir do JSON. */
export function carregarCulturas(json) {
  const r = {};
  for (const [id, d] of Object.entries(json)) if (!id.startsWith('_')) r[id] = new CropData(id, d);
  return r;
}
