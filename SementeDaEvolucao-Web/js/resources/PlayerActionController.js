// Porte de PlayerActionController.cs (Pilar 5): traduz as 4 ações em efeitos
// sobre o ambiente, com custo de recursos.
import { FarmAction } from '../core/EnvironmentState.js';

/**
 * Aplica o efeito de uma ação num ambiente. Compartilhado com a IA (que usa
 * uma tabela de efeitos mais precisa). `estufa` guarda a sombra ativa.
 */
export function aplicarEfeito(env, crop, efeito, estufa, duracaoSombra = 1) {
  if (efeito.soilMoisture) env.soilMoisture += efeito.soilMoisture;
  if (efeito.nitrogen) env.nitrogen += efeito.nitrogen;
  if (efeito.phosphorus) env.phosphorus += efeito.phosphorus;
  if (efeito.potassium) env.potassium += efeito.potassium;
  if (efeito.phParaCentro && crop) {
    // Corrige o pH em direção ao centro da faixa, sem passar do alvo.
    const alvo = crop.phRange.centro;
    const passo = Math.min(Math.abs(alvo - env.ph), efeito.phParaCentro);
    env.ph += Math.sign(alvo - env.ph) * passo;
  }
  if (efeito.sombraSegundos) {
    estufa.sombra = efeito.sombraSegundos * duracaoSombra;
    estufa.sombraTotal = estufa.sombra;
    estufa.sombraTemperatura = efeito.sombraTemperatura;
    estufa.sombraLuz = efeito.sombraLuz;
  }
  env.limitar();
}

export class PlayerActionController {
  constructor(tabela) {
    this.tabela = tabela;       // balanceamento.acoesJogador
    this.resources = null;      // injetado pelo GameManager
    this.playerEnv = null;      // injetado pelo GameManager
    this.estufa = null;         // estado da estufa do jogador (sombra)
    this.crop = null;
    this.multiplicadorEnergia = {}; // ex.: { Irrigate: 0.5 } com o Timer de Irrigação
    this.duracaoSombra = 1;         // 2 com o Sombrite Reforçado
  }

  custoDe(action) {
    const c = this.tabela[action].custo;
    const m = this.multiplicadorEnergia[action] ?? 1;
    return { agua: c.agua, fertilizante: c.fertilizante, energia: c.energia * m };
  }

  /** Aplica a ação escolhida; devolve false se faltou recurso. */
  Execute(action) {
    if (!(action in this.tabela)) throw new Error(`Ação desconhecida: ${action}`);
    if (action === FarmAction.DoNothing) return true;
    const c = this.custoDe(action);
    if (!this.resources.TrySpend(c.agua, c.fertilizante, c.energia)) return false;
    aplicarEfeito(this.playerEnv, this.crop, this.tabela[action].efeito, this.estufa, this.duracaoSombra);
    return true;
  }
}
