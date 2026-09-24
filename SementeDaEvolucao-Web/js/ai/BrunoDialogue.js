// Porte de BrunoDialogue.cs (Pilar 7): o tutor Sr. Bruno.
// Escolhe, por prioridade, a dica mais relevante: emergência → orientação → elogio.
// Hoje usa o roteiro de data/falas.json; depois pode usar um gerador externo
// com o mesmo formato de entrada (ver docs/contrato-ia.md).

export class BrunoDialogue {
  /**
   * @param {object} falas    roteiro (data/falas.json)
   * @param {object} gerador  opcional: { gerarFala(contexto) → Promise<string> } (ver docs/contrato-ia.md)
   */
  constructor(falas, gerador = null) {
    this.falas = falas;
    this.gerador = gerador;
    this._gerada = null;
    this._chaveGerada = '';
    this._pedindo = false;
    this.crop = null;
    this.temMedidor = false;
    this.indice = 0;
    this._anuncio = null;
    this._anuncioAte = 0;
  }

  /** Fala fixa por um tempo (abertura, eventos, fim de fase). */
  Anunciar(texto, agora, duracao = 6) {
    this._anuncio = texto;
    this._anuncioAte = agora + duracao;
  }

  /** Passa para a próxima variação da fala atual (botão ▶). */
  Proxima() { this.indice++; this._anuncio = null; }

  /** Categoria da situação atual, na ordem de prioridade do Pilar 7. */
  Categoria(env, planta) {
    const c = this.crop;
    if (planta.health < 35) return 'saudeCritica';
    if (env.airTemperature > c.temperatureRange.max || env.luminosity > c.luminosityRange.max) return 'calorLuz';
    if (env.soilMoisture > c.moistureRange.max) return 'encharcado';
    if (env.soilMoisture < c.moistureRange.min) return 'seco';
    const faltaNutriente = env.nitrogen < c.nitrogenRange.min || env.phosphorus < c.phosphorusRange.min || env.potassium < c.potassiumRange.min;
    if (faltaNutriente) return this.temMedidor ? 'nutrientes' : 'semMedidor';
    if (!c.phRange.Contains(env.ph)) return this.temMedidor ? 'ph' : 'semMedidor';
    return 'otimo';
  }

  /** Devolve a frase mais pertinente ao estado atual. */
  GetContextualTip(env, planta, agora = 0) {
    if (this._anuncio && agora < this._anuncioAte) return this._anuncio;
    this._anuncio = null;
    const cat = this.Categoria(env, planta);
    const lista = this.falas[cat];
    // Troca de variação a cada ~12 s para a fala não ficar repetitiva.
    const janela = this.indice + Math.floor(agora / 12);
    const roteiro = lista[janela % lista.length].replace('{cultura}', this.crop.cropName.toLowerCase());
    if (!this.gerador) return roteiro;

    // Gerador externo: pede uma fala nova por categoria/janela; enquanto não
    // chega (ou se falhar), vale o roteiro. O jogo nunca espera.
    const chave = `${cat}|${janela}`;
    if (chave !== this._chaveGerada && !this._pedindo) {
      this._pedindo = true;
      const pedido = chave;
      this.gerador.gerarFala({ categoria: cat, cultura: this.crop.cropName, ambiente: env.toJSON(), saude: planta.health, falaRoteiro: roteiro })
        .then((t) => { this._chaveGerada = pedido; this._gerada = typeof t === 'string' && t.trim() ? t.trim() : null; })
        .catch(() => { this._chaveGerada = pedido; this._gerada = null; })
        .finally(() => { this._pedindo = false; });
    }
    return chave === this._chaveGerada && this._gerada ? this._gerada : roteiro;
  }
}
