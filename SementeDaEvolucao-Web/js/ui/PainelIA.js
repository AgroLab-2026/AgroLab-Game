// Mostra se a IA externa (ex.: o Random Forest do grupo) está rodando e recebendo os dados do jogo:
// - o selo no painel COMPARE E APRENDA! (luz que pisca a cada resposta, latência e contagem);
// - o painel IA AO VIVO (tecla I ou clique no selo): o que o jogo enviou, o que o modelo recebeu
//   depois da tradução do servidor e o que ele respondeu.
import { AutonomousFarmAI } from '../ai/AutonomousFarmAI.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Estufa da IA, como o jogo envia (snapshot.ambiente).
const ENVIADO = [
  ['airTemperature', 'Temperatura do ar', '°C', 1],
  ['soilMoisture', 'Umidade do substrato', '%', 0],
  ['ph', 'pH', '', 2],
  ['nitrogen', 'Nitrogênio (N)', 'mg/L', 0],
  ['phosphorus', 'Fósforo (P)', 'mg/L', 0],
  ['potassium', 'Potássio (K)', 'mg/L', 0],
  ['luminosity', 'Luminosidade', '%', 0],
];

// Colunas conhecidas do modelo (adaptador NFT e modo direto); as outras aparecem com o nome cru.
const RECEBIDO = {
  ce_ms_cm: ['CE da solução', 'mS/cm'], ph: ['pH', ''], N: ['Nitrogênio', 'mg/L'], P: ['Fósforo', 'mg/L'], K: ['Potássio', 'mg/L'],
  temp_solucao_c: ['Temp. da solução', '°C'], od_mg_l: ['O₂ dissolvido', 'mg/L'], nivel_reservatorio_pct: ['Nível do reservatório', '%'],
  temp_ar_c: ['Temp. do ar', '°C'], temp_max_c: ['Temp. máxima', '°C'], temp_min_c: ['Temp. mínima', '°C'],
  umidade_relativa_pct: ['Umidade do ar', '%'], vpd_kpa: ['VPD', 'kPa'], dli_mol_m2_d: ['Luz do dia (DLI)', 'mol/m²'],
  dias_apos_transplante: ['Dias após transplante', ''], fase: ['Fase', ''],
  pH: ['pH', ''], temperatura: ['Temperatura', '°C'], umidade: ['Umidade', '%'], luminosidade: ['Luminosidade', '%'],
};

const CLASSES = { 0: 'não fazer nada', 1: 'travar/corrigir excesso', 2: 'repor/corrigir falta', 3: 'proteger' };

/** Estado da conexão com a IA, a partir do ProvedorComFallback. */
export function estadoIA(prov) {
  if (!prov?.externo) return { estado: 'regras', texto: 'Cérebro da IA: regras do jogo' };
  const u = prov.ultima;
  if (!u) return { estado: 'conectando', texto: 'IA: conectando…' };
  if (u.erro && /HTTP 422/.test(u.erro)) {
    return { estado: 'naocobre', texto: `IA online · não treinada para ${u.snapshot.cultura.nome}: regras` };
  }
  if (u.erro) {
    const motivo = u.erro === 'timeout' ? 'sem resposta' : /fetch|network|Failed/i.test(u.erro) ? 'servidor desligado' : u.erro;
    return { estado: 'offline', texto: `IA DESLIGADA (${motivo}) · usando regras` };
  }
  const acao = AutonomousFarmAI.Translate(u.resposta.acao);
  const conf = (u.resposta.motivo || '').match(/\((\d+)%/);
  return { estado: 'online', texto: `IA ONLINE · ${acao}${conf ? ` ${conf[1]}%` : ''} · ${u.latenciaMs} ms · #${prov.respostas}` };
}

export class PainelIA {
  constructor(gm) {
    this.gm = gm;
    this.selo = $('txt-cerebro-ia');
    this.seloTexto = this.selo.querySelector('span');
    this.painel = document.createElement('section');
    this.painel.id = 'painel-ia-vivo';
    this.painel.className = 'painel moldura painel-escuro';
    this.painel.hidden = true;
    $('palco').appendChild(this.painel);
    this.selo.addEventListener('click', () => this.alternar());
    this.painel.addEventListener('click', () => this.alternar());
    this._chaveSelo = '';
    this._ultimaDesenhada = null;
    this._proximoDesenho = 0;
  }

  get aberto() { return !this.painel.hidden; }

  alternar() {
    this.painel.hidden = !this.painel.hidden;
    this._ultimaDesenhada = null;
  }

  atualizar() {
    const prov = this.gm.provedorIA;
    const st = estadoIA(prov);
    // A luz troca de brilho a cada resposta: pisca enquanto os dados estão chegando.
    const chave = `${st.estado}|${st.texto}|${(prov?.respostas ?? 0) % 2}`;
    if (chave !== this._chaveSelo) {
      this._chaveSelo = chave;
      this.selo.className = `cerebro-ia ${st.estado}${(prov?.respostas ?? 0) % 2 ? ' par' : ''}`;
      this.seloTexto.textContent = st.texto;
    }
    if (!this.aberto) return;
    const agora = performance.now();
    if (prov?.ultima === this._ultimaDesenhada && agora < this._proximoDesenho) return;
    this._ultimaDesenhada = prov?.ultima;
    this._proximoDesenho = agora + 250;
    this.painel.innerHTML = this.html(prov, st);
  }

  html(prov, st) {
    const cab = `<h2 class="faixa">IA AO VIVO <small>(tecla I ou clique para fechar)</small></h2>`;
    if (!prov?.externo) {
      return `${cab}<p class="ia-aviso">A estufa autônoma está usando as <b>regras do próprio jogo</b>: nenhum dado sai do
        jogo. Para ligar o modelo do grupo, abra o jogo pelo <b>iniciar_com_ia.bat</b>.</p>`;
    }
    const u = prov.ultima;
    const status = `<p class="ia-status ${st.estado}"><i class="led"></i> ${esc(st.texto.replace(/ · #\d+$/, ''))}
      <span>${esc(prov.url)} · ${prov.respostas} respostas · ${prov.falhas} falhas</span></p>`;
    if (!u) return `${cab}${status}<p class="ia-aviso">Esperando a primeira troca de dados…</p>`;

    const s = u.snapshot;
    const linhas = ENVIADO.map(([v, nome, un, casas]) => {
      const x = s.ambiente[v], f = s.cultura.faixas[v];
      const fora = x < f.min || x > f.max;
      return `<tr class="${fora ? 'fora' : ''}"><td>${nome}</td><td>${x.toFixed(casas)} ${un}</td><td>${f.min}–${f.max}</td></tr>`;
    }).join('');
    const extra = `<tr><td>Crescimento</td><td>${Math.round(s.planta.crescimento * 100)}%</td><td></td></tr>
      <tr><td>Umidade do ar lá fora</td><td>${s.clima.externo.umidadeAr.toFixed(0)}%</td><td></td></tr>
      <tr><td>Evento · sombrite</td><td colspan="2">${s.clima.evento ? esc(s.clima.evento.id) : 'nenhum'} · ${s.clima.sombraAtiva ? 'ativo' : 'não'}</td></tr>`;
    const enviado = `<div><h3>1. O jogo enviou</h3><p class="ia-sub">${esc(s.cultura.nome)} · estufa da IA · t=${s.tempo}s</p>
      <table><tr><th></th><th>valor</th><th>ideal</th></tr>${linhas}${extra}</table></div>`;

    let recebido, resposta;
    if (u.erro) {
      recebido = `<div><h3>2. O modelo recebeu</h3><p class="ia-aviso">${/422/.test(u.erro)
        ? `O servidor respondeu, mas o modelo não foi treinado para ${esc(s.cultura.nome)}.`
        : 'Nada: o servidor da IA não respondeu. A janela "IA do AgroLab" está aberta?'}</p></div>`;
      resposta = `<div><h3>3. Resposta</h3><p class="ia-aviso">Erro: ${esc(u.erro)}<br>A decisão veio das regras do jogo.</p></div>`;
    } else {
      const r = u.resposta;
      const entrada = r.entrada && typeof r.entrada === 'object'
        ? Object.entries(r.entrada).map(([k, v]) => {
          const [nome, un] = RECEBIDO[k] || [k, ''];
          const val = typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2)) : esc(v);
          return `<tr><td>${esc(nome)}</td><td>${val} ${un}</td></tr>`;
        }).join('')
        : '<tr><td colspan="2">(o servidor não devolveu as entradas)</td></tr>';
      recebido = `<div><h3>2. O modelo recebeu</h3><p class="ia-sub">depois da tradução do servidor</p><table>${entrada}</table></div>`;
      const conf = (r.motivo || '').match(/\((\d+)% de confiança\)/);
      resposta = `<div><h3>3. O modelo respondeu</h3>
        ${Number.isInteger(r.classe) ? `<p class="ia-grande">Classe ${r.classe}<br><small>${CLASSES[r.classe] ?? ''}</small></p>` : ''}
        <p class="ia-grande acao">${esc(AutonomousFarmAI.Translate(r.acao))}</p>
        ${conf ? `<p>Confiança: <b>${conf[1]}%</b></p>` : ''}
        <p class="ia-sub">${esc((r.motivo || '').replace(/ \(\d+% de confiança\)$/, ''))}</p>
        <p>Resposta em <b>${u.latenciaMs} ms</b>, há ${((Date.now() - u.quando) / 1000).toFixed(1)} s</p></div>`;
    }
    return `${cab}${status}<div class="ia-colunas">${enviado}${recebido}${resposta}</div>`;
  }
}
