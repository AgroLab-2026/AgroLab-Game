// Contrato único de IA: decidir(snapshot) → Promise<{ acao, motivo }>.
// Os provedores são trocáveis por URL/config (?ia=regras|mock|http), e todos
// passam pelo ProvedorComFallback: o jogo nunca trava esperando a IA.
import { ACOES } from '../core/EnvironmentState.js';
import { ProvedorRegras } from './provedores/regras.js';
import { ProvedorMock } from './provedores/mock.js';
import { ProvedorHttp } from './provedores/http.js';

export const VERSAO_CONTRATO = 1;

/**
 * Monta o snapshot serializável em JSON que vai para a IA.
 * Formato documentado em docs/contrato-ia.md.
 */
export function criarSnapshot({ crop, env, planta, recursos, clima, evento, tempo, estufa }) {
  const faixas = {};
  for (const v of ['nitrogen', 'phosphorus', 'potassium', 'ph', 'airTemperature', 'soilMoisture', 'luminosity']) {
    const f = crop.faixaDe(v);
    faixas[v] = { min: f.min, max: f.max };
  }
  const arred = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
  const ambiente = {};
  for (const [k, v] of Object.entries(env.toJSON())) ambiente[k] = arred(v);
  return {
    versao: VERSAO_CONTRATO,
    tempo: arred(tempo, 1),
    cultura: { id: crop.id, nome: crop.cropName, faixas },
    ambiente,
    planta: {
      estagio: planta.estagio,
      saude: arred(planta.health, 1),
      crescimento: arred(planta.progresso, 3),
    },
    recursos: recursos ? { agua: arred(recursos.agua, 1), fertilizante: arred(recursos.fertilizante, 1), energia: arred(recursos.energia, 1) } : null,
    clima: {
      externo: { airTemperature: arred(clima.airTemperature, 1), luminosity: arred(clima.luminosity, 1), umidadeAr: arred(clima.umidadeAr, 1), condicao: clima.condicao },
      evento: evento ? { id: evento.id, restante: arred(evento.restante, 1) } : null,
      sombraAtiva: estufa ? estufa.sombra > 0 : false,
    },
  };
}

/** Valida a resposta de um provedor externo. */
export function respostaValida(r) {
  return r && typeof r === 'object' && ACOES.includes(r.acao) && (r.motivo === undefined || typeof r.motivo === 'string');
}

/**
 * Envolve um provedor com timeout e fallback. Se o provedor demorar, falhar ou
 * responder algo inválido, a decisão vem do fallback (regras) e `fonte` diz isso.
 */
export class ProvedorComFallback {
  constructor(provedor, fallback, timeoutMs = 800) {
    this.provedor = provedor;
    this.fallback = fallback;
    this.timeoutMs = timeoutMs;
    this.nome = provedor.nome;
    this.url = provedor.url || '';
    this.falhas = 0;
    this.respostas = 0; // respostas válidas do provedor externo
    // Última troca com a IA (para o painel IA AO VIVO): o que foi enviado, o que voltou,
    // quanto demorou e, se caiu nas regras, por quê.
    this.ultima = null;
  }

  /** O provedor é externo (a IA de vocês), e não as próprias regras do jogo? */
  get externo() { return this.provedor !== this.fallback; }

  async decidir(snapshot) {
    if (!this.externo) return { ...(await this.fallback.decidir(snapshot)), fonte: this.nome };
    let timer;
    const tempoEsgotado = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), this.timeoutMs); });
    const inicio = Date.now();
    try {
      const r = await Promise.race([this.provedor.decidir(snapshot), tempoEsgotado]);
      if (!respostaValida(r)) throw new Error('resposta inválida');
      this.respostas++;
      this.ultima = { snapshot, resposta: r, erro: null, latenciaMs: Date.now() - inicio, quando: Date.now() };
      return { acao: r.acao, motivo: r.motivo || '', fonte: this.nome };
    } catch (erro) {
      this.falhas++;
      const r = await this.fallback.decidir(snapshot);
      this.ultima = { snapshot, resposta: null, erro: erro.message, latenciaMs: Date.now() - inicio, quando: Date.now() };
      return { ...r, fonte: `${this.fallback.nome} (fallback: ${erro.message})` };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Cria o provedor pelo nome. `config` vem da URL e/ou de data/ia.json:
 * { ia: 'regras'|'mock'|'http', iaUrl, timeoutMs, mockAcoes }
 */
export function criarProvedorIA(config = {}) {
  const regras = new ProvedorRegras();
  let base;
  switch (config.ia) {
    case 'mock': base = new ProvedorMock(config.mockAcoes); break;
    case 'http': base = new ProvedorHttp(config.iaUrl); break;
    default: base = regras;
  }
  return new ProvedorComFallback(base, regras, config.timeoutMs ?? 800);
}
