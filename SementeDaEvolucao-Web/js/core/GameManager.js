// Porte de GameManager.cs: O MAESTRO. Avança o tempo de jogo, faz a planta do
// jogador e a da IA crescerem, executa as 4 ações e conecta todos os sistemas.
// Não toca DOM nem Canvas: a interface lê o estado e chama DoAction/UI_*.
import { EnvironmentState, FarmAction } from './EnvironmentState.js';
import { Evento } from './Eventos.js';
import { carregarCulturas } from '../crops/CropData.js';
import { PlantController } from '../crops/PlantController.js';
import { ResourceSystem } from '../resources/ResourceSystem.js';
import { PlayerActionController, aplicarEfeito } from '../resources/PlayerActionController.js';
import { WeatherEventSystem } from '../systems/WeatherEventSystem.js';
import { ClimateModel, novaEstufa } from '../systems/ClimateModel.js';
import { ProgressionSystem } from '../systems/ProgressionSystem.js';
import { AutonomousFarmAI } from '../ai/AutonomousFarmAI.js';
import { BrunoDialogue } from '../ai/BrunoDialogue.js';
import { criarProvedorIA, criarSnapshot } from '../ai/IAProvider.js';

export const EstadoJogo = Object.freeze({ Jogando: 'jogando', FimDeFase: 'fimDeFase', Pausado: 'pausado' });

export class GameManager {
  /**
   * @param {object} dados   { culturas, balanceamento, progressao, falas } (JSON de data/)
   * @param {object} opcoes  { provedorIA, configIA, rng, geradorFalas }
   */
  constructor(dados, opcoes = {}) {
    const b = dados.balanceamento;
    this.bal = b;
    this.crops = carregarCulturas(dados.culturas);
    this.timeScale = b.gameManager.timeScale;
    this.velocidade = 1; // multiplicador do modo debug (1×/2×/4×)
    this.rng = opcoes.rng ?? Math.random;

    this.resources = new ResourceSystem(b.recursos);
    this.playerActions = new PlayerActionController(b.acoesJogador);
    this.playerPlant = new PlantController(b.planta);
    this.weather = new WeatherEventSystem(b.clima, this.rng);
    this.clima = new ClimateModel(b.ambiente);
    this.progressao = new ProgressionSystem(dados.progressao);
    this.bruno = new BrunoDialogue(dados.falas, opcoes.geradorFalas ?? null);
    this.falas = dados.falas;
    const provedor = opcoes.provedorIA ?? criarProvedorIA({ ...(opcoes.configIA || {}), timeoutMs: b.ia.timeoutMs });
    this.provedorIA = provedor;
    this.aiAI = new AutonomousFarmAI(b.ia, b.planta, provedor);

    // Eventos para a interface (HUD, som, animações).
    this.OnAcao = new Evento();          // (quem: 'jogador'|'automacao'|'assistente'|'ia', acao, ok)
    this.OnMensagem = new Evento();      // (texto, ruim)
    this.OnFaseIniciada = new Evento();  // (dadosFase)
    this.OnFaseTerminou = new Evento();  // (relatorio)

    // Mensagens temporárias para o HUD (como no GameManager.cs).
    this._weatherMsg = 'Tempo estável.';
    this._alertMsg = '';

    this.weather.OnEventStarted.on((evt, desc) => {
      this._weatherMsg = desc;
      this.bruno.Anunciar(this.falas.eventos[evt], this.tempoReal, 6);
    });
    this.weather.OnEventEnded.on(() => { this._weatherMsg = 'Tempo estável.'; });
    this.resources.OnResourceDepleted.on((recurso) => {
      this._alertMsg = `Sem ${recurso}!`;
      this.OnMensagem.emit(this._alertMsg, true);
    });
    this.aiAI.OnAction.on((acao) => this.OnAcao.emit('ia', acao, true));

    this.IniciarFase(1);
  }

  get crop() { return this.cropAtual; }
  get evento() { return this.weather.eventoAtual ? { id: this.weather.eventoAtual, restante: this.weather.restante, ...this.weather.dadosAtuais } : null; }

  /** Começa (ou recomeça) uma fase com a cultura indicada. */
  IniciarFase(numero, idCultura) {
    this.progressao.irPara(numero);
    const fase = this.progressao.dadosFase;
    const crop = this.crops[idCultura ?? fase.cultura];
    this.cropAtual = crop;

    // Distribui a MESMA instância de ambiente e a cultura para todo mundo.
    this.playerEnv = EnvironmentState.paraCultura(crop);
    this.estufaJogador = novaEstufa();
    this.resources.Reset();
    this.playerActions.resources = this.resources;
    this.playerActions.playerEnv = this.playerEnv;
    this.playerActions.estufa = this.estufaJogador;
    this.playerActions.crop = crop;
    this.playerActions.multiplicadorEnergia = this.progressao.tem('timerIrrigacao') ? { [FarmAction.Irrigate]: 0.5 } : {};
    this.playerPlant.crop = crop;
    this.playerPlant.Reset();
    this.bruno.crop = crop;
    this.bruno.temMedidor = this.progressao.tem('medidorPh');
    this.aiAI.Reset(crop, this.playerEnv);
    this.weather.Reset();
    this.clima.Reset(crop);

    this.tempo = 0;          // segundos de jogo
    this.tempoReal = 0;      // segundos reais desde o início da fase
    this.maoDeObra = 0;      // tarefas manuais feitas pelo fazendeiro
    this.acoesJogador = [];  // { tempo, acao, quem }
    this.tempoColheitaIA = null;
    this.relatorio = null;
    this._automacaoAcum = 0;
    this._assistenteAcum = 0;
    this._assistentePendente = false;
    this._assistenteResposta = null;
    this._alertMsg = '';
    this.estado = EstadoJogo.Jogando;

    const texto = this.progressao.tem('iaAssistente') ? this.falas.parceria : numero === 1 ? this.falas.abertura : fase.objetivo;
    this.bruno.Anunciar(texto, 0, 10);
    this.OnFaseIniciada.emit(fase);
  }

  /** Um passo de simulação. dtReal em segundos reais (o passo fixo do laço). */
  Step(dtReal) {
    if (this.estado !== EstadoJogo.Jogando) return;
    const real = dtReal * this.velocidade;
    const dt = real * this.timeScale;
    this.tempoReal += real;
    this.tempo += dt;

    this.weather.Tick(real);
    const evento = this.evento;
    this.resources.regeneracaoBloqueada = !!(evento && evento.bloqueiaRegeneracao);
    this.resources.Tick(real);
    this.clima.Tick(dt, evento, evento?.id);

    const ativa = !this.playerPlant.morta && !this.playerPlant.colhida;
    this.clima.aplicarDeriva(this.playerEnv, this.estufaJogador, ativa, evento, dt);
    this.automacoes(dt);
    this.assistente(dt);

    this.playerPlant.Tick(this.playerEnv, dt);   // planta do jogador
    this.aiAI.Tick(this.clima, evento, dt, this.tempo); // IA sente o mesmo clima e cultiva a dela

    this.verificarFimDeFase();
  }

  // ------------------------------------------------------------ ações
  /** Executa uma ação do jogador (teclas 1–4 ou botões). */
  DoAction(action, quem = 'jogador') {
    if (this.estado !== EstadoJogo.Jogando) return false;
    const ok = this.playerActions.Execute(action);
    this._alertMsg = ok ? `Você: ${AutonomousFarmAI.Translate(action)}` : 'Recurso insuficiente para essa ação!';
    if (ok && action !== FarmAction.DoNothing) {
      if (quem === 'jogador') this.maoDeObra++;
      this.acoesJogador.push({ tempo: this.tempo, acao: action, quem });
    }
    this.OnAcao.emit(quem, action, ok);
    if (quem === 'jogador') this.OnMensagem.emit(this._alertMsg, !ok);
    return ok;
  }

  /** Reabastece a água (tecla R). */
  Refill() {
    if (this.estado !== EstadoJogo.Jogando) return false;
    const ok = this.resources.RefillWater();
    if (ok) this.maoDeObra++;
    this._alertMsg = ok ? 'Você: Encher água' : this.resources.water >= this.resources.waterMax ? 'O tanque já está cheio.' : 'Recurso insuficiente para essa ação!';
    this.OnAcao.emit('jogador', 'Refill', ok);
    this.OnMensagem.emit(this._alertMsg, !ok);
    return ok;
  }

  // Comandos dos botões (Fase 2 do Unity).
  UI_Nada() { return this.DoAction(FarmAction.DoNothing); }
  UI_Travar() { return this.DoAction(FarmAction.LockIrrigation); }
  UI_Irrigar() { return this.DoAction(FarmAction.Irrigate); }
  UI_Proteger() { return this.DoAction(FarmAction.ProtectPlant); }

  /** Tecnologias automáticas (sensor de umidade e sombrite). Gastam energia como a IA. */
  automacoes(dt) {
    this._automacaoAcum += dt;
    if (this._automacaoAcum < 1) return;
    this._automacaoAcum = 0;
    const c = this.crop, e = this.playerEnv;
    if (this.progressao.tem('sensorUmidade') && e.soilMoisture > c.moistureRange.max) this.executarAutomatico(FarmAction.LockIrrigation, 'automacao');
    if (this.progressao.tem('sombrite') && this.estufaJogador.sombra <= 0 &&
        (e.airTemperature > c.temperatureRange.max || e.luminosity > c.luminosityRange.max)) this.executarAutomatico(FarmAction.ProtectPlant, 'automacao');
  }

  /** Ação feita por automação/IA assistente: usa a tabela de precisão da IA e os recursos do jogador. */
  executarAutomatico(action, quem) {
    if (action === FarmAction.DoNothing) return false;
    const t = this.bal.ia.acoes[action];
    if (!this.resources.TrySpend(t.custo.agua, t.custo.fertilizante, t.custo.energia)) return false;
    aplicarEfeito(this.playerEnv, this.crop, t.efeito, this.estufaJogador);
    this.acoesJogador.push({ tempo: this.tempo, acao: action, quem });
    this.OnAcao.emit(quem, action, true);
    return true;
  }

  /** Fase 7: a IA assistente cuida da estufa do jogador junto com ele. */
  assistente(dt) {
    if (!this.progressao.tem('iaAssistente')) return;
    if (this._assistenteResposta) {
      const r = this._assistenteResposta;
      this._assistenteResposta = null;
      this.ultimaDicaAssistente = r;
      this.executarAutomatico(r.acao, 'assistente');
    }
    this._assistenteAcum += dt;
    if (this._assistentePendente || this._assistenteAcum < this.bal.ia.intervaloDecisao * 2) return;
    this._assistenteAcum = 0;
    this._assistentePendente = true;
    const fase = this.progressao.faseAtual;
    const snap = criarSnapshot({
      crop: this.crop, env: this.playerEnv, planta: this.playerPlant, tempo: this.tempo, estufa: this.estufaJogador,
      recursos: { agua: this.resources.water, fertilizante: this.resources.nutrientStock, energia: this.resources.energy },
      clima: this.clima.ambienteExterno, evento: this.evento,
    });
    this.provedorIA.decidir(snap).then((r) => {
      this._assistentePendente = false;
      if (this.progressao.faseAtual === fase && this.estado === EstadoJogo.Jogando) this._assistenteResposta = r;
    }, () => { this._assistentePendente = false; });
  }

  // ------------------------------------------------------------ fim de fase e pontuação
  verificarFimDeFase() {
    const f = this.bal.fase;
    if (this.aiAI.aiPlant.colhida && this.tempoColheitaIA === null) this.tempoColheitaIA = this.tempo;
    let motivo = null;
    if (this.playerPlant.colhida) motivo = 'colheu';
    else if (this.playerPlant.morta) motivo = 'morreu';
    else if (this.tempoColheitaIA !== null && this.tempo - this.tempoColheitaIA > f.tempoAposColheitaIA) motivo = 'tempoIA';
    else if (this.tempo > f.tempoMaximo) motivo = 'tempoMaximo';
    if (!motivo) return;
    this.estado = EstadoJogo.FimDeFase;
    this.relatorio = this.GerarRelatorio(motivo);
    this.progressao.registrar({ fase: this.progressao.faseAtual, cultura: this.crop.cropName, eficiencia: this.relatorio.eficiencia });
    this.relatorio.historico = this.progressao.historico.slice();
    this.OnFaseTerminou.emit(this.relatorio);
  }

  produtividade(planta) {
    if (planta.morta) return 0;
    return this.crop.produtividadeKg * planta.progresso * (planta.saudeMedia / 100);
  }

  /** Pontuação em "% da eficiência da IA" (decisão da conversa). */
  Pontuacao() {
    const pJ = this.produtividade(this.playerPlant);
    const pI = Math.max(1e-6, this.produtividade(this.aiAI.aiPlant));
    const aJ = Math.max(1, this.resources.aguaGasta), aI = Math.max(1, this.aiAI.waterUsed);
    const eJ = Math.max(1, this.resources.energiaGasta), eI = Math.max(1, this.aiAI.energyUsed);
    const rProd = Math.min(1, pJ / pI);
    const rAgua = Math.min(1, (pJ / aJ) / (pI / aI));
    const rEnergia = Math.min(1, (pJ / eJ) / (pI / eI));
    const w = this.bal.fase.pesos;
    return {
      eficiencia: Math.round(100 * (w.produtividade * rProd + w.agua * rAgua + w.energia * rEnergia)),
      rProd, rAgua, rEnergia, prodJogador: pJ, prodIA: pI,
    };
  }

  /** Relatório de fim de fase: "a derrota que ensina". */
  GerarRelatorio(motivo) {
    const p = this.Pontuacao();
    const janela = this.bal.fase.janelaReacao;
    const reacoes = this.aiAI.historico.map((h) => ({
      ...h,
      jogadorReagiu: this.acoesJogador.some((a) => a.acao === h.acao && Math.abs(a.tempo - h.tempo) <= janela),
    }));
    const perdidas = reacoes.filter((r) => !r.jogadorReagiu);
    return {
      motivo,
      fase: this.progressao.faseAtual,
      titulo: this.progressao.dadosFase.titulo,
      cultura: this.crop.cropName,
      eficiencia: p.eficiencia,
      pontuacao: p,
      jogador: {
        saude: this.playerPlant.health, saudeMedia: this.playerPlant.saudeMedia, crescimento: this.playerPlant.progresso,
        produtividade: p.prodJogador, agua: this.resources.aguaGasta, energia: this.resources.energiaGasta,
        fertilizante: this.resources.fertilizanteGasto, acoes: this.acoesJogador.length, maoDeObra: this.maoDeObra,
      },
      ia: {
        saude: this.aiAI.aiPlant.health, saudeMedia: this.aiAI.aiPlant.saudeMedia, crescimento: this.aiAI.aiPlant.progresso,
        produtividade: p.prodIA, agua: this.aiAI.waterUsed, energia: this.aiAI.energyUsed,
        fertilizante: this.aiAI.fertilizerUsed, acoes: this.aiAI.actionsTaken,
      },
      reacoesIA: reacoes.length,
      reacoesPerdidas: perdidas.length,
      momentosPerdidos: perdidas.slice(0, 4),
      tecnologiaLiberada: this.progressao.faseAtual < this.progressao.ultimaFase ? this.progressao.proximaTecnologia : null,
      historico: this.progressao.historico.slice(),
      tempo: this.tempo,
    };
  }

  /** Vai para a próxima fase (liberando a tecnologia). */
  ProximaFase() {
    this.progressao.avancar();
    this.IniciarFase(this.progressao.faseAtual);
  }

  RepetirFase(idCultura) { this.IniciarFase(this.progressao.faseAtual, idCultura); }

  AlternarPausa() {
    if (this.estado === EstadoJogo.Jogando) this.estado = EstadoJogo.Pausado;
    else if (this.estado === EstadoJogo.Pausado) this.estado = EstadoJogo.Jogando;
  }
}
