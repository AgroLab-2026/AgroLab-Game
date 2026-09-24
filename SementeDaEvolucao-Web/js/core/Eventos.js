// Mini "event" do C#: assina com +=, aqui com .on(fn). Sem DOM.
export class Evento {
  constructor() { this.ouvintes = []; }
  on(fn) { this.ouvintes.push(fn); return () => this.off(fn); }
  off(fn) { this.ouvintes = this.ouvintes.filter((f) => f !== fn); }
  emit(...args) { for (const f of this.ouvintes) f(...args); }
}
