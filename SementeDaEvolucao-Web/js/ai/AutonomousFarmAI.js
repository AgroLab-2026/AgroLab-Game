// Porte de AutonomousFarmAI.cs (Pilar 6): a estufa autônoma rival.
// Simulação paralela com ambiente e planta próprios; a cada intervalo pede uma
// decisão ao provedor de IA (padrão: regras) e aplica com dosagem de precisão.
import { FarmAction } from '../core/EnvironmentState.js';
import { PlantController } from '../crops/PlantController.js';
import { aplicarEfeito } from '../resources/PlayerActionController.js';
import { novaEstufa } from '../systems/ClimateModel.js';
import { criarSnapshot } from './IAProvider.js';
import { Evento } from '../core/Eventos.js';

const TRADUCAO = {
  [FarmAction.DoNothing]: 'Não fazer nada',
  [FarmAction.LockIrrigation]: 'Travar irrigação',
  [FarmAction.Irrigate]: 'Irrigar',
  [FarmAction.ProtectPlant]: 'Proteger a planta',
};

export class AutonomousFarmAI {
  /**
   * @param {object} cfgIA     balanceamento.ia
   * @param {object} cfgPlanta balanceamento.planta
   * @param {object} provedor  provedor de IA (contrato decidir(snapshot))
   */
  constructor(cfgIA, cfgPlanta, provedor) {
    this.cfg = cfgIA;
    this.provedor = provedor;
    this.aiPlant = new PlantController(cfgPlanta);
    this.crop = null;
    this.OnAction = new Evento();
    this.aiEnv = null;
    this.Reset(null, null);
  }

  static Translate(action) { return TRADUCAO[action] ?? action; }

  Reset(crop, envInicial) {
    this.crop = crop;
    this.aiPlant.crop = crop;
    this.aiPlant.Reset();
    this.aiEnv = envInicial ? envInicial.Clone() : null;
    this.estufa = novaEstufa();
    this.waterUsed = 0;
    this.energyUsed = 0;
    this.fertilizerUsed = 0;
    this.actionsTaken = 0;
    this.lastAction = FarmAction.DoNothing;
    this.lastReason = 'Aguardando a primeira leitura dos sensores.';
    this.lastSource = this.provedor?.nome ?? 'regras';
    this.historico = [];
    this._acumulado = 0;
    this._pendente = false;
    this._resposta = null;
    this._geracao = (this._geracao ?? 0) + 1;
  }

  /** Sente o clima, decide, age e cultiva a planta da IA. */
  Tick(clima, evento, dt, tempo) {
    if (!this.crop) return;
    const ativa = !this.aiPlant.morta && !this.aiPlant.colhida;
    clima.aplicarDeriva(this.aiEnv, this.estufa, ativa, evento, dt);

    if (this._resposta) {
      this.aplicar(this._resposta, tempo);
      this._resposta = null;
    }
    this._acumulado += dt;
    if (ativa && !this._pendente && this._acumulado >= this.cfg.intervaloDecisao) {
      this._acumulado = 0;
      this._pendente = true;
      const geracao = this._geracao;
      const snap = criarSnapshot({
        crop: this.crop, env: this.aiEnv, planta: this.aiPlant, tempo, estufa: this.estufa,
        recursos: { agua: this.waterUsed, fertilizante: this.fertilizerUsed, energia: this.energyUsed },
        clima: clima.ambienteExterno, evento: evento ? { id: evento.id, restante: evento.restante } : null,
      });
      this.provedor.decidir(snap).then((r) => {
        if (geracao !== this._geracao) return; // resposta de uma fase antiga
        this._resposta = r;
        this._pendente = false;
      }, () => { this._pendente = false; });
    }
    this.aiPlant.Tick(this.aiEnv, dt);
  }

  aplicar(r, tempo) {
    const tabela = this.cfg.acoes[r.acao];
    this.lastAction = r.acao;
    this.lastReason = r.motivo || '';
    this.lastSource = r.fonte || this.provedor?.nome;
    if (r.acao === FarmAction.DoNothing) return;
    aplicarEfeito(this.aiEnv, this.crop, tabela.efeito, this.estufa);
    this.waterUsed += tabela.custo.agua;
    this.energyUsed += tabela.custo.energia;
    this.fertilizerUsed += tabela.custo.fertilizante;
    this.actionsTaken++;
    this.historico.push({ tempo, acao: r.acao, motivo: r.motivo });
    this.OnAction.emit(r.acao, r.motivo);
  }

  /** Texto pronto para o painel de comparação (como no C#). */
  ScoreboardLine() {
    return `Saúde ${this.aiPlant.health.toFixed(0)}% · Crescimento ${(this.aiPlant.progresso * 100).toFixed(0)}% · ` +
      `Água ${this.waterUsed.toFixed(0)}L · Ações ${this.actionsTaken} · Última: ${AutonomousFarmAI.Translate(this.lastAction)}`;
  }
}
