// Provedor "http" (stub): faz POST do snapshot para um endpoint configurável e
// espera { acao, motivo }. Não há serviço real ainda; sem URL, falha na hora e o
// ProvedorComFallback usa as regras. Nenhuma chave de API fica no frontend.

export class ProvedorHttp {
  constructor(url) {
    this.nome = 'http';
    this.url = url || '';
  }

  async decidir(snapshot) {
    if (!this.url) throw new Error('sem iaUrl configurada');
    const resp = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }
}
