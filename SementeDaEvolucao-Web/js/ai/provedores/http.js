// Provedor "http": faz POST do snapshot para um endpoint configurável (ex.: o servidor da IA do
// grupo, ia-servidor/servidor_ia.py) e espera { acao, motivo }. Nenhuma chave de API fica no frontend.
// Também sabe "pingar" o servidor (GET na raiz) para o jogo distinguir servidor desligado de lento.

export class ProvedorHttp {
  constructor(url) {
    this.nome = 'http';
    this.url = url || '';
    this.online = null;          // null = ainda não verificado
    this.info = null;            // o que o servidor diz de si (modelo, colunas...)
    this.ultimaVerificacao = 0;
    this._verificando = null;
  }

  /** Raiz do servidor: http://127.0.0.1:5000/decidir -> http://127.0.0.1:5000/ */
  get urlRaiz() { return this.url.replace(/\/decidir\/?$/, '/'); }

  /** Confere se o servidor está de pé (sem travar o jogo). */
  verificar() {
    if (this._verificando) return this._verificando;
    this.ultimaVerificacao = Date.now();
    if (!this.url) { this.online = false; return Promise.resolve(false); }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    this._verificando = fetch(this.urlRaiz, { signal: ctrl.signal })
      .then(async (r) => { this.info = await r.json().catch(() => null); this.online = r.ok; return this.online; })
      .catch(() => { this.online = false; return false; })
      .finally(() => { clearTimeout(timer); this._verificando = null; });
    return this._verificando;
  }

  async decidir(snapshot) {
    if (!this.url) throw new Error('sem iaUrl configurada');
    let resp;
    try {
      resp = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });
    } catch (erro) {
      this.online = false;
      throw erro;
    }
    this.online = true;
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }
}
