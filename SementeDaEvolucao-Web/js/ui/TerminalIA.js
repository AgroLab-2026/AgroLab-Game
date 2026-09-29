// Barra lateral "terminal" com os dados da IA: o que o jogo enviou, o que o modelo viu e o que
// respondeu, digitado aos poucos como num terminal. Fica fora do palco (não é escalado com ele):
// ocupa a faixa lateral da tela, e o Escala.js reserva o espaço. Tecla T mostra/esconde.
// Para dar tempo de ler, mostra só a decisão mais recente a cada `intervalo` segundos
// (data/ia.json -> terminalIntervalo); mudanças de estado (conexão, fase, eventos) saem na hora.
import { AutonomousFarmAI } from '../ai/AutonomousFarmAI.js';
import { estadoIA } from './PainelIA.js';

const CHAVE = 'semente.terminal';
const MAX_LINHAS = 220;
const CARACTERES_POR_SEGUNDO = 180;
const CLASSES = { 0: 'não fazer nada', 1: 'travar/corrigir excesso', 2: 'repor/corrigir falta', 3: 'proteger' };

const n = (x, casas = 0) => (typeof x === 'number' ? x.toFixed(casas) : '?');

export class TerminalIA {
  /**
   * @param {GameManager} gm
   * @param {{ visivel: boolean, intervalo: number }} opcoes
   */
  constructor(gm, { visivel = false, intervalo = 3 } = {}) {
    this.gm = gm;
    this.intervalo = intervalo;
    this.el = document.createElement('aside');
    this.el.id = 'terminal-ia';
    this.el.innerHTML = `
      <header><b>agrolab-ia</b> <span class="t-dim">— terminal da IA</span>
        <div class="t-status"><i class="led"></i><span></span></div></header>
      <div class="t-corpo" role="log" aria-live="off"></div>
      <footer>T esconde · decisão mais recente a cada ${intervalo} s</footer>`;
    document.body.appendChild(this.el);
    this.corpo = this.el.querySelector('.t-corpo');
    this.status = this.el.querySelector('.t-status');
    this.statusTexto = this.status.querySelector('span');

    let salvo = null;
    try { salvo = localStorage.getItem(CHAVE); } catch { /* sem localStorage */ }
    this.visivel = salvo === null ? visivel : salvo === '1';
    this.el.hidden = !this.visivel;

    this.fila = [];          // linhas esperando para serem digitadas: [{ classe, texto }...]
    this.digitando = null;   // { spans, segmentos, i, pos }
    this._credito = 0;
    this._ultimoBloco = -Infinity;
    this._ultimaTroca = null;
    this._ultimasDecisoes = 0;
    this._estado = '';
    this._chaveStatus = '';

    this.linha([['t-dim', 'AgroLab IA · Semente da Evolução']]);
    this.linha([['t-dim', 'aguardando os dados da estufa autônoma...']]);
    gm.OnFaseIniciada.on((fase) => this.cabecalhoFase(fase));
    if (gm.crop) this.cabecalhoFase(gm.progressao.dadosFase); // a fase 1 já começou no construtor do jogo
    gm.weather.OnEventStarted.on((evt) => {
      const nome = gm.bal.clima.eventos[evt]?.nome ?? evt;
      this.linha([['t-alerta', `! evento: ${nome}`]]);
    });
    gm.OnFaseTerminou.on((rel) => {
      const d = rel.ia?.decisoes || {};
      const fim = rel.venceu ? 'você colheu' : rel.motivo === 'morreu' ? 'sua planta morreu' : 'o tempo acabou';
      this.linha([['t-titulo', `-- fim da fase: ${fim} --`]]);
      this.linha([['t-dim', `decisões da IA: ${(d.modelo || 0) + (d.regras || 0)} · do modelo: ${d.modelo || 0}`]]);
    });
  }

  cabecalhoFase(fase) {
    this.linha([]);
    this.linha([['t-titulo', `== FASE ${fase.numero ?? this.gm.progressao.faseAtual} · ${this.gm.crop.cropName} ==`]]);
    this.linha([['t-dim', fase.titulo || '']]);
    this._ultimoBloco = -Infinity;
    // Respostas que ainda chegarem da fase anterior não aparecem depois deste cabeçalho.
    this._inicioFase = Date.now();
    this._ultimaTroca = null;
  }

  alternar() {
    this.visivel = !this.visivel;
    this.el.hidden = !this.visivel;
    try { localStorage.setItem(CHAVE, this.visivel ? '1' : '0'); } catch { /* ignora */ }
    if (this.visivel) this.descarregar();
  }

  /** Enfileira uma linha: lista de [classeCss, texto]. */
  linha(segmentos) {
    this.fila.push(segmentos);
  }

  /** Chamado a cada quadro. */
  atualizar(dt) {
    const prov = this.gm.provedorIA;
    const st = estadoIA(prov);

    const chave = `${st.estado}|${prov?.respostas ?? 0}`;
    if (chave !== this._chaveStatus) {
      this._chaveStatus = chave;
      this.status.className = `t-status ${st.estado}${(prov?.respostas ?? 0) % 2 ? ' par' : ''}`;
      this.statusTexto.textContent = prov?.externo
        ? `${st.estado === 'online' ? 'ONLINE' : st.estado === 'naocobre' ? 'ONLINE · cultura fora do modelo' : st.estado === 'offline' ? 'DESLIGADA' : 'conectando'} · #${prov.respostas}${prov.ultima && !prov.ultima.erro ? ` · ${prov.ultima.latenciaMs} ms` : ''}`
        : 'regras do jogo (sem IA externa)';
    }

    // Mudanças de estado saem na hora.
    if (st.estado !== this._estado) {
      this._estado = st.estado;
      if (st.estado === 'online') this.linha([['t-ok', `conectado ao modelo em ${prov.url}`]]);
      else if (st.estado === 'offline') this.linha([['t-erro', `${st.texto} do jogo. A janela "IA do AgroLab" está aberta?`]]);
      else if (st.estado === 'naocobre') this.linha([['t-alerta', `modelo não treinado para ${prov.ultima.snapshot.cultura.nome} -> regras do jogo`]]);
      else if (st.estado === 'regras') this.linha([['t-dim', 'jogo aberto sem a IA externa: a estufa usa as regras do jogo']]);
    }

    const agora = performance.now() / 1000;
    if (agora - this._ultimoBloco >= this.intervalo) {
      const bloco = prov?.externo ? this.blocoExterno(prov, st) : this.blocoRegras();
      if (bloco) {
        this._ultimoBloco = agora;
        for (const l of bloco) this.linha(l);
      }
    }
    this.digitar(dt);
  }

  /** Bloco com a troca mais recente com o servidor da IA (ou null se não houve troca nova). */
  blocoExterno(prov, st) {
    const u = prov.ultima;
    if (!u || u === this._ultimaTroca || st.estado !== 'online') return null;
    if (u.quando < (this._inicioFase ?? 0) || u.snapshot.cultura.id !== this.gm.crop.id) return null;
    const puladas = this._ultimaTroca ? prov.respostas - this._respostasNoUltimo - 1 : 0;
    this._ultimaTroca = u;
    this._respostasNoUltimo = prov.respostas;
    const s = u.snapshot, r = u.resposta;
    const linhas = [
      [],
      [['t-dim', `[${hora()}] `], ['t-num', `#${prov.respostas}`], ['', ` ${s.cultura.nome} · t=${n(s.tempo)}s`],
        ...(puladas > 0 ? [['t-dim', ` (+${puladas} decisões)`]] : [])],
      [['t-envio', '> jogo enviou']],
      ...this.linhasAmbiente(s.ambiente, s.cultura.faixas),
    ];
    const e = r.entrada;
    if (e && typeof e === 'object') {
      linhas.push([['t-recebido', '< modelo viu']]);
      if ('ce_ms_cm' in e) {
        linhas.push([['', `  CE ${n(e.ce_ms_cm, 2)}  reserv ${n(e.nivel_reservatorio_pct)}%  pH ${n(e.ph, 2)}`]]);
        linhas.push([['', `  ar ${n(e.temp_ar_c, 1)}°C  O2 ${n(e.od_mg_l, 1)}  fase ${e.fase ?? '?'}`]]);
      } else {
        linhas.push([['', `  ${Object.entries(e).map(([k, v]) => `${k} ${typeof v === 'number' ? n(v, 1) : v}`).join('  ')}`]]);
      }
    }
    const conf = (r.motivo || '').match(/\((\d+)% de confiança\)/);
    const causa = (r.motivo || '').replace(/ \(\d+% de confiança\)$/, '').split(': ').slice(1).join(': ');
    linhas.push([['t-resposta', `= ${Number.isInteger(r.classe) ? `classe ${r.classe} · ` : ''}${causa || CLASSES[r.classe] || ''}`]]);
    linhas.push([['t-acao', `  ${AutonomousFarmAI.Translate(r.acao).toUpperCase()}`],
      ['t-dim', `${conf ? `  ${conf[1]}%` : ''}  ${u.latenciaMs} ms`]]);
    return linhas;
  }

  /** Sem IA externa: mostra a decisão das regras do jogo, no mesmo formato. */
  blocoRegras() {
    const ia = this.gm.aiAI;
    const total = ia.decisoes.modelo + ia.decisoes.regras;
    if (!ia.aiEnv || total === this._ultimasDecisoes) return null;
    this._ultimasDecisoes = total;
    const faixas = {};
    for (const v of Object.keys(ia.aiEnv.toJSON())) faixas[v] = this.gm.crop.faixaDe(v);
    return [
      [],
      [['t-dim', `[${hora()}] `], ['t-num', `#${total}`], ['', ` ${this.gm.crop.cropName}`]],
      [['t-envio', '> estufa da IA']],
      ...this.linhasAmbiente(ia.aiEnv.toJSON(), faixas),
      [['t-resposta', `= regras: ${ia.lastReason}`]],
      [['t-acao', `  ${AutonomousFarmAI.Translate(ia.lastAction).toUpperCase()}`]],
    ];
  }

  linhasAmbiente(a, f) {
    const v = (chave, texto) => [a[chave] < f[chave].min || a[chave] > f[chave].max ? 't-fora' : '', texto];
    return [
      [['', '  '], v('airTemperature', `T ${n(a.airTemperature, 1)}°C`), ['', '  '], v('soilMoisture', `subst ${n(a.soilMoisture)}%`),
        ['', '  '], v('ph', `pH ${n(a.ph, 2)}`)],
      [['', '  '], v('nitrogen', `N ${n(a.nitrogen)}`), ['', '  '], v('phosphorus', `P ${n(a.phosphorus)}`), ['', '  '],
        v('potassium', `K ${n(a.potassium)}`), ['', '  '], v('luminosity', `luz ${n(a.luminosity)}%`)],
    ];
  }

  /** Efeito de digitação: escreve alguns caracteres por quadro. */
  digitar(dt) {
    if (!this.visivel) { this.descarregar(); return; }
    // Fila grande (ex.: voltou de uma tela de fase): escreve de uma vez.
    if (this.fila.length > 40) this.descarregar();
    this._credito += dt * CARACTERES_POR_SEGUNDO;
    while (this._credito >= 1) {
      if (!this.digitando) {
        const seg = this.fila.shift();
        if (!seg) { this._credito = 0; return; }
        this.digitando = this.novaLinha(seg);
      }
      const d = this.digitando;
      if (d.i >= d.segmentos.length) { this.digitando = null; continue; }
      const texto = d.segmentos[d.i][1];
      const passo = Math.min(Math.floor(this._credito), texto.length - d.pos);
      d.spans[d.i].textContent += texto.slice(d.pos, d.pos + passo);
      d.pos += passo;
      this._credito -= Math.max(1, passo);
      if (d.pos >= texto.length) { d.i++; d.pos = 0; }
      this.corpo.scrollTop = this.corpo.scrollHeight;
    }
  }

  /** Escreve tudo o que está na fila sem animação. */
  descarregar() {
    if (this.digitando) {
      const d = this.digitando;
      for (let i = d.i; i < d.segmentos.length; i++) d.spans[i].textContent = d.segmentos[i][1];
      this.digitando = null;
    }
    for (const seg of this.fila.splice(0)) {
      const d = this.novaLinha(seg);
      d.segmentos.forEach(([, t], i) => { d.spans[i].textContent = t; });
    }
  }

  novaLinha(segmentos) {
    const div = document.createElement('div');
    div.className = 't-linha';
    const spans = segmentos.map(([classe]) => {
      const s = document.createElement('span');
      if (classe) s.className = classe;
      div.appendChild(s);
      return s;
    });
    if (!segmentos.length) div.textContent = ' ';
    this.corpo.appendChild(div);
    while (this.corpo.childElementCount > MAX_LINHAS) this.corpo.firstElementChild.remove();
    this.corpo.scrollTop = this.corpo.scrollHeight;
    return { spans, segmentos, i: 0, pos: 0 };
  }
}

function hora() {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}
