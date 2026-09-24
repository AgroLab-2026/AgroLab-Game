// Fases e tecnologias (regra nova, decisão da conversa com a equipe):
// cada fase concluída libera uma tecnologia; a fase 7 é a parceria com a IA.

export class ProgressionSystem {
  constructor(progressao) {
    this.tecnologias = progressao.tecnologias;
    this.fases = progressao.fases;
    this.faseAtual = 1;
    this.historico = []; // { fase, cultura, eficiencia }
  }

  get dadosFase() { return this.fases[Math.min(this.faseAtual, this.fases.length) - 1]; }
  get ultimaFase() { return this.fases.length; }

  /** Tecnologias liberadas na fase atual (a fase n tem as n−1 primeiras). */
  get liberadas() { return new Set(this.tecnologias.slice(0, Math.min(this.faseAtual - 1, this.tecnologias.length)).map((t) => t.id)); }

  tem(id) { return this.liberadas.has(id); }

  /** Tecnologia que será liberada ao concluir a fase atual (ou null). */
  get proximaTecnologia() { return this.tecnologias[this.faseAtual - 1] ?? null; }

  registrar(resultado) { this.historico.push(resultado); }

  avancar() { if (this.faseAtual < this.ultimaFase) this.faseAtual++; }

  irPara(fase) { this.faseAtual = Math.max(1, Math.min(this.ultimaFase, fase)); }
}
