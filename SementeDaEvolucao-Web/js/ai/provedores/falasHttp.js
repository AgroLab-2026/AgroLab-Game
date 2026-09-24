// Gerador externo de falas do Sr. Bruno (stub): POST { categoria, cultura,
// ambiente, saude, falaRoteiro } → { fala }. Com timeout; sem URL, não é usado.

export class GeradorFalasHttp {
  constructor(url, timeoutMs = 1500) {
    this.url = url;
    this.timeoutMs = timeoutMs;
  }

  async gerarFala(contexto) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const resp = await fetch(this.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contexto), signal: ctrl.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const r = await resp.json();
      return typeof r.fala === 'string' ? r.fala.slice(0, 280) : null;
    } finally {
      clearTimeout(timer);
    }
  }
}
