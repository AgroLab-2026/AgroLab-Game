// Clima externo + deriva natural da bancada (Fase 4, Passo 4: "clima externo").
// O clima atinge as duas estufas por igual; cada estufa aplica a própria sombra.
import { limitar } from '../core/EnvironmentState.js';

export class ClimateModel {
  constructor(cfgAmbiente) {
    this.cfg = cfgAmbiente;
    this.tempo = 0;
    this.Reset(null);
    this.ambienteExterno = { airTemperature: cfgAmbiente.externoBase.airTemperature, luminosity: cfgAmbiente.externoBase.luminosity, umidadeAr: cfgAmbiente.externoBase.umidadeAr, condicao: 'Ensolarado' };
  }

  /**
   * Centra o clima base na cultura: a estufa é montada para ela. Sem isso a
   * temperatura/luz ficariam cronicamente fora da faixa (nenhuma das 4 ações
   * aquece ou ilumina), e o tomate morreria sem culpa do jogador.
   */
  Reset(crop) {
    this.tempo = 0;
    const b = this.cfg.externoBase;
    this.baseTemperatura = crop ? crop.temperatureRange.centro : b.airTemperature;
    this.baseLuz = crop ? crop.luminosityRange.centro : b.luminosity;
    this.amplitudeTemperatura = crop ? Math.min(b.amplitudeTemperatura, (crop.temperatureRange.max - crop.temperatureRange.min) * 0.4) : b.amplitudeTemperatura;
    this.amplitudeLuz = crop ? Math.min(b.amplitudeLuz, (crop.luminosityRange.max - crop.luminosityRange.min) * 0.4) : b.amplitudeLuz;
  }

  /** Atualiza o clima externo (base que oscila + desvio do evento ativo). */
  Tick(dt, evento, idEvento) {
    this.tempo += dt;
    const b = this.cfg.externoBase;
    const onda = Math.sin((this.tempo / b.periodo) * Math.PI * 2);
    const e = this.ambienteExterno;
    e.airTemperature = this.baseTemperatura + this.amplitudeTemperatura * onda + (evento?.temperatura ?? 0);
    e.luminosity = limitar(this.baseLuz + this.amplitudeLuz * onda + (evento?.luz ?? 0), 0, 100);
    e.umidadeAr = limitar(b.umidadeAr - 6 * onda + (idEvento === 'HeavyRain' ? 28 : 0) - (idEvento === 'HeatWave' ? 18 : 0), 0, 100);
    e.condicao = idEvento === 'HeavyRain' ? 'Chuva forte'
      : idEvento === 'HeatWave' ? 'Calor extremo'
      : idEvento === 'PowerFailure' ? 'Sem energia'
      : idEvento === 'Pest' ? 'Praga'
      : onda > -0.3 ? 'Ensolarado' : 'Nublado';
  }

  /**
   * Deriva natural de uma bancada durante dt (segundos de jogo):
   * temperatura e luz relaxam para o clima externo (menos a sombra),
   * o substrato evapora, a planta consome nutrientes e o pH sobe devagar.
   */
  aplicarDeriva(env, estufa, plantaAtiva, evento, dt) {
    const c = this.cfg;
    const ext = this.ambienteExterno;
    const sombra = estufa.sombra > 0;
    const alvoT = ext.airTemperature + (sombra ? estufa.sombraTemperatura : 0);
    const alvoL = ext.luminosity + (sombra ? estufa.sombraLuz : 0);
    const k = Math.min(1, c.relaxamentoClima * dt);
    env.airTemperature += (alvoT - env.airTemperature) * k;
    env.luminosity += (alvoL - env.luminosity) * k;

    const evap = c.evaporacaoBase + Math.max(0, env.airTemperature - c.temperaturaReferenciaEvaporacao) * c.evaporacaoPorGrauAcima;
    env.soilMoisture -= evap * dt;

    if (plantaAtiva) {
      env.nitrogen -= c.consumoNutrientes.nitrogen * dt;
      env.phosphorus -= c.consumoNutrientes.phosphorus * dt;
      env.potassium -= c.consumoNutrientes.potassium * dt;
    }
    env.ph += c.derivaPh * dt;

    if (evento) {
      if (evento.umidadePorSegundo) env.soilMoisture += evento.umidadePorSegundo * dt;
      if (evento.phPorSegundo) env.ph += evento.phPorSegundo * dt;
      if (evento.nitrogenioPorSegundo) env.nitrogen += evento.nitrogenioPorSegundo * dt;
    }
    if (estufa.sombra > 0) estufa.sombra = Math.max(0, estufa.sombra - dt);
    env.limitar();
  }
}

/** Estado físico de uma estufa além das 7 variáveis (a sombra ativa). */
export function novaEstufa() {
  return { sombra: 0, sombraTemperatura: 0, sombraLuz: 0 };
}
