// Porte de GameManager.cs: O MAESTRO. Avança o tempo de jogo, faz a planta do
// jogador e a da IA crescerem, executa as 4 ações e conecta todos os sistemas.
// Não toca DOM nem Canvas: a interface lê o estado e chama DoAction/UI_*.
//
// Regras de fase (conversa com a equipe): cada fase dura 1:30 (tempo real).
// VITÓRIA = colher antes do tempo acabar. DERROTA = a planta morre ou o tempo
// acaba. Só avança quem vence; 3 tentativas por fase, depois game over.
// Nada age sozinho na estufa do jogador: as tecnologias medem, avisam e sugerem.
import { EnvironmentState, FarmAction, VARIAVEIS } from './EnvironmentState.js';
import { Evento } from './Eventos.js';
import { carregarCulturas } from '../crops/CropData.js';
import { PlantController } from '../crops/PlantController.js';
import { ResourceSystem } from '../resources/ResourceSystem.js';
import { PlayerActionController } from '../resources/PlayerActionController.js';
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
    this.OnAcao = new Evento();          // (quem: 'jogador'|'ia', acao, ok)
    this.OnGasto = new Evento();         // ({ acao, agua, fertilizante, energia, aguaGanha })
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
    });
    this.aiAI.OnAction.on((acao) => this.OnAcao.emit('ia', acao, true));

    this.IniciarFase(1);
  }

  get crop() { return this.cropAtual; }
  get evento() { return this.weather.eventoAtual ? { id: this.weather.eventoAtual, restante: this.weather.restante, ...this.weather.dadosAtuais } : null; }
  get tempoLimite() { return this.bal.fase.tempoLimiteReal; }
  get tempoRestante() { return Math.max(0, this.tempoLimite - this.tempoReal); }

  /** Começa (ou recomeça) uma fase com a cultura indicada. */
  IniciarFase(numero, idCultura) {
    this.progressao.irPara(numero);
    const fase = this.progressao.dadosFase;
    const crop = this.crops[idCultura ?? fase.cultura];
    this.cropAtual = crop;
    const tec = this.bal.tecnologias;

    // Distribui a MESMA instância de ambiente e a cultura para todo mundo.
    this.playerEnv = EnvironmentState.paraCultura(crop);
    this.estufaJogador = novaEstufa();
    this.resources.Reset();
    this.playerActions.resources = this.resources;
    this.playerActions.playerEnv = this.playerEnv;
    this.playerActions.estufa = this.estufaJogador;
    this.playerActions.crop = crop;
    this.playerActions.multiplicadorEnergia = {};
    if (this.progressao.tem('timerIrrigacao')) this.playerActions.multiplicadorEnergia[FarmAction.Irrigate] = tec.timerIrrigacaoEnergia;
    if (this.progressao.tem('sombrite')) this.playerActions.multiplicadorEnergia[FarmAction.ProtectPlant] = tec.sombriteEnergia;
    this.playerActions.duracaoSombra = this.progressao.tem('sombrite') ? tec.sombriteDuracao : 1;
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
    this.acoesJogador = [];  // { tempo, acao }
    this.registroGastos = []; // { tempoReal, acao, agua, fertilizante, energia, aguaGanha }
    this.foraDaFaixa = Object.fromEntries(VARIAVEIS.map((v) => [v, 0])); // segundos reais fora da faixa
    this.relatorio = null;
    this.sugestaoIA = null;
    this._sugestaoAcum = 0;
    this._sugestaoPendente = false;
    this._alertMsg = '';
    this.estado = EstadoJogo.Jogando;

    const texto = numero === 1 && this.progressao.tentativa === 1 ? this.falas.abertura
      : this.progressao.tem('iaAssistente') ? this.falas.parceria : fase.objetivo;
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
    this.pedirSugestaoIA(dt);

    this.playerPlant.Tick(this.playerEnv, dt);   // planta do jogador
    this.aiAI.Tick(this.clima, evento, dt, this.tempo); // IA sente o mesmo clima e cultiva a dela

    for (const v of VARIAVEIS) if (!this.crop.faixaDe(v).Contains(this.playerEnv[v])) this.foraDaFaixa[v] += real;
    this.verificarFimDeFase();
  }

  // ------------------------------------------------------------ ações
  /** Custo atual de uma ação do jogador (já com os descontos das tecnologias). */
  CustoDe(action) {
    if (action === 'Refill') return { agua: 0, fertilizante: 0, energia: this.bal.recursos.refill.energia };
    return this.playerActions.custoDe(action);
  }

  /** Diz se o jogador tem recursos para a ação (e qual recurso falta). */
  PodePagar(action) {
    const c = this.CustoDe(action), r = this.resources;
    const falta = [];
    if (c.agua > r.water + 1e-9) falta.push('agua');
    if (c.fertilizante > r.nutrientStock + 1e-9) falta.push('fertilizante');
    if (c.energia > r.energy + 1e-9) falta.push('energia');
    if (action === 'Refill' && r.water >= r.waterMax - 1e-6) falta.push('cheio');
    return { ok: falta.length === 0, falta };
  }

  /** Executa uma ação do jogador (teclas 1–4 ou botões). */
  DoAction(action) {
    if (this.estado !== EstadoJogo.Jogando) return false;
    const custo = this.CustoDe(action);
    const ok = this.playerActions.Execute(action);
    if (ok && action !== FarmAction.DoNothing) {
      this.maoDeObra++;
      this.acoesJogador.push({ tempo: this.tempo, acao: action });
      this.registrarGasto({ acao: action, ...custo, aguaGanha: 0 });
      this._alertMsg = `Você: ${AutonomousFarmAI.Translate(action)}`;
    } else if (ok) {
      this._alertMsg = 'Você: aguardar e observar';
    } else {
      this._alertMsg = `Falta ${this.PodePagar(action).falta.map(nomeRecurso).join(' e ')} para ${AutonomousFarmAI.Translate(action).toLowerCase()}!`;
    }
    this.OnAcao.emit('jogador', action, ok);
    this.OnMensagem.emit(this._alertMsg, !ok);
    return ok;
  }

  /** Reabastece a água (tecla R). */
  Refill() {
    if (this.estado !== EstadoJogo.Jogando) return false;
    const antes = this.resources.water;
    const ok = this.resources.RefillWater();
    if (ok) {
      this.maoDeObra++;
      this.registrarGasto({ acao: 'Refill', agua: 0, fertilizante: 0, energia: this.bal.recursos.refill.energia, aguaGanha: this.resources.water - antes });
      this._alertMsg = 'Você: encher o tanque de água';
    } else {
      this._alertMsg = this.resources.water >= this.resources.waterMax - 1e-6 ? 'O tanque já está cheio.' : 'Falta energia para encher o tanque!';
    }
    this.OnAcao.emit('jogador', 'Refill', ok);
    this.OnMensagem.emit(this._alertMsg, !ok);
    return ok;
  }

  registrarGasto(g) {
    const item = { tempoReal: this.tempoReal, ...g };
    this.registroGastos.push(item);
    this.OnGasto.emit(item);
  }

  // Comandos dos botões (Fase 2 do Unity).
  UI_Nada() { return this.DoAction(FarmAction.DoNothing); }
  UI_Travar() { return this.DoAction(FarmAction.LockIrrigation); }
  UI_Irrigar() { return this.DoAction(FarmAction.Irrigate); }
  UI_Proteger() { return this.DoAction(FarmAction.ProtectPlant); }

  // ------------------------------------------------------------ tecnologias (só ajudam, não agem)
  /** Sensor de Umidade: qual ação a umidade pede agora (ou null). */
  get alertaSensor() {
    if (!this.progressao.tem('sensorUmidade')) return null;
    const e = this.playerEnv.soilMoisture, f = this.crop.moistureRange;
    if (e < f.min) return FarmAction.Irrigate;
    if (e > f.max) return FarmAction.LockIrrigation;
    return null;
  }

  /** IA Assistente: pede ao provedor a melhor ação para a estufa DO JOGADOR, só como sugestão. */
  pedirSugestaoIA(dt) {
    if (!this.progressao.tem('iaAssistente')) return;
    this._sugestaoAcum += dt;
    if (this._sugestaoPendente || this._sugestaoAcum < this.bal.ia.intervaloDecisao) return;
    this._sugestaoAcum = 0;
    this._sugestaoPendente = true;
    const fase = this.progressao.faseAtual;
    const snap = criarSnapshot({
      crop: this.crop, env: this.playerEnv, planta: this.playerPlant, tempo: this.tempo, estufa: this.estufaJogador,
      recursos: { agua: this.resources.water, fertilizante: this.resources.nutrientStock, energia: this.resources.energy },
      clima: this.clima.ambienteExterno, evento: this.evento,
    });
    this.provedorIA.decidir(snap).then((r) => {
      this._sugestaoPendente = false;
      if (this.progressao.faseAtual === fase && this.estado === EstadoJogo.Jogando) this.sugestaoIA = r;
    }, () => { this._sugestaoPendente = false; });
  }

  // ------------------------------------------------------------ fim de fase e pontuação
  verificarFimDeFase() {
    let motivo = null;
    if (this.playerPlant.colhida) motivo = 'colheu';
    else if (this.playerPlant.morta) motivo = 'morreu';
    else if (this.tempoReal >= this.tempoLimite) motivo = 'tempo';
    if (!motivo) return;
    this.estado = EstadoJogo.FimDeFase;
    const venceu = motivo === 'colheu';
    this.relatorio = this.GerarRelatorio(motivo, venceu);
    this.progressao.registrar({ fase: this.progressao.faseAtual, cultura: this.crop.cropName, venceu, eficiencia: this.relatorio.eficiencia });
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

  /** Gasto total por tipo de ação (para o relatório). */
  gastosPorAcao() {
    const r = {};
    for (const g of this.registroGastos) {
      const t = (r[g.acao] ??= { vezes: 0, agua: 0, fertilizante: 0, energia: 0 });
      t.vezes++; t.agua += g.agua; t.fertilizante += g.fertilizante; t.energia += g.energia;
    }
    return r;
  }

  /** Relatório de fim de fase: vitória ou "a derrota que ensina". */
  GerarRelatorio(motivo, venceu) {
    const p = this.Pontuacao();
    const janela = this.bal.fase.janelaReacao;
    const reacoes = this.aiAI.historico.map((h) => ({
      ...h,
      jogadorReagiu: this.acoesJogador.some((a) => a.acao === h.acao && Math.abs(a.tempo - h.tempo) <= janela),
    }));
    const perdidas = reacoes.filter((r) => !r.jogadorReagiu);
    const proximoPasso = this.progressao.resultado(venceu);
    return {
      motivo, venceu, proximoPasso,
      fase: this.progressao.faseAtual,
      ultimaFase: this.progressao.ultimaFase,
      titulo: this.progressao.dadosFase.titulo,
      cultura: this.crop.cropName,
      tentativa: this.progressao.tentativa,
      tentativasPorFase: this.progressao.tentativasPorFase,
      tempoReal: this.tempoReal,
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
      gastos: this.gastosPorAcao(),
      foraDaFaixa: { ...this.foraDaFaixa },
      reacoesIA: reacoes.length,
      reacoesPerdidas: perdidas.length,
      momentosPerdidos: perdidas.slice(0, 4),
      tecnologiasLiberadas: venceu ? this.progressao.proximasTecnologias : [],
      historico: this.progressao.historico.slice(),
      tempo: this.tempo,
    };
  }

  /** Vai para a próxima fase (só depois de vencer). */
  ProximaFase() {
    if (!this.relatorio?.venceu) return;
    this.progressao.avancar();
    this.IniciarFase(this.progressao.faseAtual);
  }

  /** Nova tentativa da mesma fase (gasta uma das 3). */
  TentarDeNovo(idCultura) {
    this.progressao.novaTentativa();
    this.IniciarFase(this.progressao.faseAtual, idCultura);
  }

  /** Troca a cultura antes de começar, sem gastar tentativa. */
  TrocarCultura(idCultura) { this.IniciarFase(this.progressao.faseAtual, idCultura); }

  /** Recomeça o jogo do zero (depois do game over ou da vitória final). */
  NovoJogo() {
    this.progressao.Reset();
    this.IniciarFase(1);
  }

  AlternarPausa() {
    if (this.estado === EstadoJogo.Jogando) this.estado = EstadoJogo.Pausado;
    else if (this.estado === EstadoJogo.Pausado) this.estado = EstadoJogo.Jogando;
  }
}

function nomeRecurso(r) {
  return { agua: 'água', fertilizante: 'fertilizante', energia: 'energia', cheio: 'espaço no tanque' }[r] ?? r;
}
