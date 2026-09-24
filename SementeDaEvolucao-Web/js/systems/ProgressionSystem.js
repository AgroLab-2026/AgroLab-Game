// Fases, tecnologias e tentativas (regras da conversa com a equipe):
// 5 fases; só avança quem VENCE a fase; cada fase tem 3 tentativas e, se todas
// falharem, é game over. Cada fase traz as tecnologias das fases anteriores
// mais as suas (progressao.json → fases[].tecnologias).

export class ProgressionSystem {
  constructor(progressao) {
    this.tecnologias = progressao.tecnologias;
    this.fases = progressao.fases;
    this.tentativasPorFase = progressao.tentativasPorFase ?? 3;
    this.Reset();
  }

  /** Volta ao começo do jogo (novo jogo ou depois do game over). */
  Reset() {
    this.faseAtual = 1;
    this.tentativa = 1;
    this.historico = []; // { fase, cultura, venceu, eficiencia, tentativa }
  }

  get dadosFase() { return this.fases[this.faseAtual - 1]; }
  get ultimaFase() { return this.fases.length; }
  get tentativasRestantes() { return this.tentativasPorFase - this.tentativa; }

  /** Tecnologias em uso na fase atual (as desta fase e das anteriores). */
  get liberadas() {
    const ids = new Set();
    for (const f of this.fases.slice(0, this.faseAtual)) for (const id of f.tecnologias ?? []) ids.add(id);
    return ids;
  }

  tem(id) { return this.liberadas.has(id); }

  /** Tecnologias que chegam nesta fase (para destacar no HUD e na introdução). */
  get novasNestaFase() {
    const ids = new Set(this.dadosFase.tecnologias ?? []);
    return this.tecnologias.filter((t) => ids.has(t.id));
  }

  /** Tecnologias que a PRÓXIMA fase libera (mostradas ao vencer). */
  get proximasTecnologias() {
    const prox = this.fases[this.faseAtual];
    if (!prox) return [];
    const ids = new Set(prox.tecnologias ?? []);
    return this.tecnologias.filter((t) => ids.has(t.id));
  }

  registrar(resultado) { this.historico.push({ ...resultado, tentativa: this.tentativa }); }

  /**
   * Registra o resultado e decide o que vem depois:
   * 'proxima' (venceu), 'vitoriaFinal' (venceu a última), 'tentarDeNovo' ou 'gameOver'.
   */
  resultado(venceu) {
    if (venceu) return this.faseAtual >= this.ultimaFase ? 'vitoriaFinal' : 'proxima';
    return this.tentativa >= this.tentativasPorFase ? 'gameOver' : 'tentarDeNovo';
  }

  avancar() {
    if (this.faseAtual < this.ultimaFase) this.faseAtual++;
    this.tentativa = 1;
  }

  novaTentativa() { this.tentativa = Math.min(this.tentativasPorFase, this.tentativa + 1); }

  irPara(fase) { this.faseAtual = Math.max(1, Math.min(this.ultimaFase, fase)); }
}
