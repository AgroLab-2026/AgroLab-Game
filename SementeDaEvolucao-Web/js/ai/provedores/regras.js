// Provedor "regras": o porte do AutonomousFarmAI.cs — decide pelas faixas da
// cultura via EnvironmentState.SuggestAction. É o padrão e o fallback de todos.
import { EnvironmentState, IdealRange, FarmAction } from '../../core/EnvironmentState.js';

const CAMPOS = {
  nitrogen: 'nitrogenRange', phosphorus: 'phosphorusRange', potassium: 'potassiumRange', ph: 'phRange',
  airTemperature: 'temperatureRange', soilMoisture: 'moistureRange', luminosity: 'luminosityRange',
};

/** Reconstrói um "crop" mínimo a partir das faixas do snapshot. */
function cropDoSnapshot(faixas) {
  const crop = {};
  for (const [v, campo] of Object.entries(CAMPOS)) crop[campo] = IdealRange.de(faixas[v]);
  return crop;
}

function motivo(acao, amb, crop) {
  const f = (x, n = 0) => x.toFixed(n);
  switch (acao) {
    case FarmAction.ProtectPlant:
      return amb.airTemperature > crop.temperatureRange.max
        ? `Temperatura ${f(amb.airTemperature, 1)} °C acima do máximo (${crop.temperatureRange.max} °C).`
        : `Luz ${f(amb.luminosity)}% acima do máximo (${crop.luminosityRange.max}%).`;
    case FarmAction.LockIrrigation:
      return amb.soilMoisture > crop.moistureRange.max
        ? `Substrato encharcado: ${f(amb.soilMoisture)}% (máx. ${crop.moistureRange.max}%).`
        : `pH ${f(amb.ph, 2)} fora da faixa ${crop.phRange.min}–${crop.phRange.max}.`;
    case FarmAction.Irrigate:
      return amb.soilMoisture < crop.moistureRange.min
        ? `Substrato seco: ${f(amb.soilMoisture)}% (mín. ${crop.moistureRange.min}%).`
        : 'Nutrientes (N/P/K) abaixo do mínimo.';
    default:
      return 'Tudo dentro da faixa ideal.';
  }
}

export class ProvedorRegras {
  constructor() { this.nome = 'regras'; }

  async decidir(snapshot) {
    const crop = cropDoSnapshot(snapshot.cultura.faixas);
    const env = new EnvironmentState(snapshot.ambiente);
    let acao = env.SuggestAction(crop);
    // Não renova a sombra que ainda está ativa (evita gastar energia à toa).
    if (acao === FarmAction.ProtectPlant && snapshot.clima.sombraAtiva) acao = FarmAction.DoNothing;
    return { acao, motivo: acao === FarmAction.DoNothing && snapshot.clima.sombraAtiva ? 'Sombra já ativa; aguardando.' : motivo(acao, snapshot.ambiente, crop) };
  }
}
