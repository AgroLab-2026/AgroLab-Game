// Provedor "mock": respostas fixas, para testar a integração sem IA real.
// ?ia=mock usa a sequência padrão; ?ia=mock&mockAcoes=Irrigate,DoNothing define a sua.
import { FarmAction, ACOES } from '../../core/EnvironmentState.js';

export class ProvedorMock {
  constructor(acoes) {
    this.nome = 'mock';
    const lista = (Array.isArray(acoes) ? acoes : String(acoes || '').split(',')).map((s) => s.trim()).filter((a) => ACOES.includes(a));
    this.acoes = lista.length ? lista : [FarmAction.DoNothing, FarmAction.DoNothing, FarmAction.Irrigate, FarmAction.DoNothing];
    this.i = 0;
  }

  async decidir() {
    const acao = this.acoes[this.i++ % this.acoes.length];
    return { acao, motivo: `Resposta fixa do mock (${acao}).` };
  }
}
