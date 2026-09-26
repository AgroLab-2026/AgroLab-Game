// Telas entre fases: introdução, vitória, derrota ("a derrota que ensina"),
// game over (as 3 vidas do jogo acabaram) e vitória final (5 fases concluídas).
import { iconeUrl } from '../render/Icones.js';
import { AutonomousFarmAI } from '../ai/AutonomousFarmAI.js';
import { mmss } from './Vistas.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ico = (nome, cls = 'ico') => `<img class="${cls}" src="${iconeUrl(nome)}" alt="">`;

const NOMES_VAR = {
  soilMoisture: 'Umidade do substrato', airTemperature: 'Temperatura do ar', luminosity: 'Luminosidade',
  nitrogen: 'Nitrogênio (N)', phosphorus: 'Fósforo (P)', potassium: 'Potássio (K)', ph: 'pH da solução',
};
const DICA_VAR = {
  soilMoisture: 'Irrigue (3) quando o substrato secar e trave a irrigação (2) quando encharcar.',
  airTemperature: 'Nas ondas de calor, use Proteger (4) logo no começo.',
  luminosity: 'Luz demais também estressa: Proteger (4) coloca o sombrite.',
  nitrogen: 'A irrigação (3) leva a solução nutritiva e repõe o nitrogênio.',
  phosphorus: 'A irrigação (3) leva a solução nutritiva e repõe o fósforo.',
  potassium: 'A irrigação (3) leva a solução nutritiva e repõe o potássio.',
  ph: 'Travar a irrigação (2) ajuda a corrigir o pH da solução.',
};

export class TelasFase {
  constructor() {
    this.overlay = document.getElementById('overlay-fase');
    this.conteudo = document.getElementById('conteudo-fase');
    this.aoConfirmar = null;
  }

  get aberta() { return !this.overlay.classList.contains('escondido'); }

  fechar() { this.overlay.classList.add('escondido'); this.aoConfirmar = null; }

  abrir(html, botoes, classe = '') {
    this.conteudo.innerHTML = html;
    this.overlay.querySelector('.janela').className = `janela moldura ${classe}`;
    const caixa = document.createElement('div');
    caixa.className = 'botoes';
    for (const b of botoes) {
      const el = document.createElement('button');
      el.textContent = b.texto;
      if (b.secundario) el.className = 'secundario';
      el.addEventListener('click', () => { this.fechar(); b.acao(); });
      caixa.appendChild(el);
    }
    this.conteudo.appendChild(caixa);
    this.aoConfirmar = botoes.find((b) => b.principal)?.acao ?? null;
    this.overlay.classList.remove('escondido');
    caixa.querySelector('button:not(.secundario)')?.focus();
  }

  /** Enter confirma o botão principal. */
  confirmar() {
    if (!this.aberta || !this.aoConfirmar) return false;
    const f = this.aoConfirmar;
    this.fechar();
    f();
    return true;
  }

  coracoes(restantes, total) {
    let h = '';
    for (let i = 0; i < total; i++) h += ico(i < restantes ? 'coracao' : 'coracaoVazio', 'coracao');
    return `<span class="coracoes">${h}</span>`;
  }

  custosHtml(gm) {
    const linha = (acao, icone, nome, tecla) => {
      const c = gm.CustoDe(acao);
      const partes = [];
      if (c.agua) partes.push(`${ico('agua')}−${c.agua} L`);
      if (c.energia) partes.push(`${ico('energia')}−${+c.energia.toFixed(1)}`);
      if (c.fertilizante) partes.push(`${ico('nutrientes')}−${c.fertilizante}`);
      if (acao === 'Refill') partes.push(`${ico('agua')}enche o tanque`);
      return `<tr><td>${ico(icone)} <b>${tecla}</b> ${nome}</td><td>${partes.join(' ') || 'grátis'}</td></tr>`;
    };
    const sombra = Math.round((gm.bal.acoesJogador.ProtectPlant.efeito.sombraSegundos * gm.playerActions.duracaoSombra) / gm.timeScale);
    return `<table class="tabela custos-tabela">
      ${linha('Irrigate', 'regador', 'Irrigar', '3')}
      ${linha('LockIrrigation', 'valvula', 'Travar irrigação', '2')}
      ${linha('ProtectPlant', 'proteger', `Proteger (sombra por ${sombra} s)`, '4')}
      ${linha('DoNothing', 'aguardar', 'Aguardar', '1')}
      ${linha('Refill', 'balde', 'Encher água', 'R')}
    </table>`;
  }

  introducao(gm, aoComecar, aoTrocarCultura) {
    const p = gm.progressao, fase = p.dadosFase;
    const novas = p.novasNestaFase;
    const culturas = Object.values(gm.crops);
    const html = `
      <h2 class="faixa">FASE ${p.faseAtual} DE ${p.ultimaFase} · ${esc(fase.titulo.toUpperCase())}</h2>
      <div class="intro-topo">
        <div><b>Vidas:</b> ${this.coracoes(p.vidas, p.vidasMax)} <b>${p.vidas} de ${p.vidasMax}</b> <span class="pequeno">(para o jogo todo)</span></div>
        <div>${ico('relogio')} <b>Tempo: ${mmss(gm.tempoLimite)}</b></div>
      </div>
      <p><b>Cultura:</b> ${esc(gm.crop.cropName)}. ${esc(gm.crop.descricaoEducativa)}</p>
      <p class="meta"><b>Para vencer:</b> colha antes do tempo acabar. <b>Você perde uma vida</b> se a planta morrer ou o tempo acabar
      e repete a fase. Sem vidas, é game over e o jogo recomeça da fase 1.
      Mantenha as barras do CONTROLE DA ESTUFA na faixa verde: planta bem cuidada cresce mais rápido.</p>
      ${novas.map((t) => `<div class="tec-liberada">${ico(t.icone)}<div><b>Nova tecnologia: ${esc(t.nome)}</b><br>${esc(t.efeito)}</div></div>`).join('')}
      <p><b>Quanto custa cada ação</b> (a energia recarrega sozinha, +${gm.resources.energyRegenPerSecond} por segundo):</p>
      ${this.custosHtml(gm)}
      <p class="pequeno">Controles: teclas 1–4 e R, ou clique nas ferramentas · P pausa · F tela cheia · Enter confirma.
      Trocar cultura: ${culturas.map((c) => `<button class="botao-madeira mini" data-cultura="${c.id}"${c.id === gm.crop.id ? ' disabled' : ''}>${esc(c.cropName)}</button>`).join(' ')}</p>`;
    this.abrir(html, [{ texto: 'Começar ▶', principal: true, acao: aoComecar }]);
    for (const b of this.conteudo.querySelectorAll('[data-cultura]')) {
      b.addEventListener('click', () => { this.fechar(); aoTrocarCultura(b.dataset.cultura); });
    }
  }

  tabelaComparacao(rel) {
    const j = rel.jogador, ia = rel.ia;
    const linha = (rot, a, b, fmt) => `<tr><td>${rot}</td><td class="col-voce">${fmt(a)}</td><td class="col-ia">${fmt(b)}</td></tr>`;
    const pct = (v) => `${v.toFixed(0)}%`, un = (u) => (v) => `${v.toFixed(0)}${u}`;
    return `<table class="tabela">
      <tr><th></th><th class="col-voce">Você</th><th class="col-ia">IA autônoma</th></tr>
      ${linha('Crescimento (colheita)', Math.floor(j.crescimento * 100), Math.floor(ia.crescimento * 100), pct)}
      ${linha('Saúde média da planta', j.saudeMedia, ia.saudeMedia, pct)}
      ${linha('Água gasta', j.agua, ia.agua, un(' L'))}
      ${linha('Energia gasta', j.energia, ia.energia, un(''))}
      ${linha('Fertilizante gasto', j.fertilizante, ia.fertilizante, (v) => `${+v.toFixed(1)} doses`)}
      ${linha('Ações realizadas', j.acoes, ia.acoes, un(''))}
    </table>`;
  }

  tabelaGastos(rel) {
    const nomes = { Irrigate: 'Irrigar', LockIrrigation: 'Travar irrigação', ProtectPlant: 'Proteger', Refill: 'Encher água' };
    const linhas = Object.entries(rel.gastos).map(([a, g]) => `<tr><td>${nomes[a] ?? a} × ${g.vezes}</td>
      <td>${g.agua ? `${ico('agua')}${g.agua.toFixed(0)} L ` : ''}${g.energia ? `${ico('energia')}${g.energia.toFixed(0)} ` : ''}${g.fertilizante ? `${ico('nutrientes')}${+g.fertilizante.toFixed(1)}` : ''}</td></tr>`);
    if (!linhas.length) return '<p>Você não fez nenhuma ação nesta tentativa.</p>';
    return `<p><b>Seus gastos por ação:</b></p><table class="tabela custos-tabela">${linhas.join('')}</table>`;
  }

  oQueDeuErrado(rel, gm) {
    const itens = Object.entries(rel.foraDaFaixa).filter(([, s]) => s >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const lista = itens.map(([v, s]) => `<li><b>${NOMES_VAR[v]}</b> ficou fora da faixa ideal por ${Math.round(s)} s. ${DICA_VAR[v]}</li>`);
    const perdidos = rel.momentosPerdidos.slice(0, 2).map((m) =>
      `<li>Em ${mmss(m.tempo / gm.timeScale)} a IA fez <b>${esc(AutonomousFarmAI.Translate(m.acao))}</b> e você não: ${esc(m.motivo)}</li>`);
    if (!lista.length && !perdidos.length) return '';
    return `<p><b>O que deu errado:</b></p><ul>${lista.join('')}${perdidos.join('')}</ul>`;
  }

  evolucao(rel) {
    const barras = rel.historico.map((h, i) => {
      const atual = i === rel.historico.length - 1;
      return `<div class="${atual ? 'atual' : ''} ${h.venceu ? 'venceu' : 'perdeu'}" style="height:${Math.max(14, h.eficiencia * 0.6)}px"
        title="Fase ${h.fase} · tentativa ${h.tentativa} · ${esc(h.cultura)}">F${h.fase}${h.venceu ? '✔' : '✘'}<br>${h.eficiencia}%</div>`;
    }).join('');
    return `<p><b>Sua evolução</b> (% da eficiência da IA em cada tentativa):</p><div class="barra-evolucao">${barras}</div>`;
  }

  /** Decide qual tela mostrar pelo resultado da fase. */
  resultado(gm, rel, acoes) {
    if (rel.proximoPasso === 'vitoriaFinal') return this.vitoriaFinal(gm, rel, acoes);
    if (rel.proximoPasso === 'gameOver') return this.gameOver(gm, rel, acoes);
    if (rel.venceu) return this.vitoria(gm, rel, acoes);
    return this.derrota(gm, rel, acoes);
  }

  vitoria(gm, rel, acoes) {
    const html = `
      <h2 class="faixa faixa-verde-centro">FASE ${rel.fase} CONCLUÍDA! · ${esc(rel.titulo.toUpperCase())}</h2>
      <div class="grande vitoria-txt">Você colheu ${esc(rel.cultura.toLowerCase())} em ${mmss(rel.tempoReal)}!</div>
      <p class="centro">Comparado à estufa autônoma, você chegou a <b>${rel.eficiencia}%</b> da eficiência da IA.</p>
      ${this.tabelaComparacao(rel)}
      ${this.tabelaGastos(rel)}
      ${rel.tecnologiasLiberadas.map((t) => `<div class="tec-liberada">${ico(t.icone)}<div><b>Tecnologia liberada: ${esc(t.nome)}</b><br>${esc(t.efeito)}</div></div>`).join('')}
      <p><i>Sr. Bruno: "${esc(gm.falas.vitoria[(rel.fase - 1) % gm.falas.vitoria.length])}"</i></p>`;
    this.abrir(html, [{ texto: `Ir para a fase ${rel.fase + 1} ▶`, principal: true, acao: acoes.proxima }], 'tela-vitoria');
  }

  derrota(gm, rel, acoes) {
    const titulo = rel.motivo === 'morreu' ? 'SUA PLANTA MORREU' : 'O TEMPO ACABOU';
    const restantes = rel.vidas;
    const html = `
      <h2 class="faixa">${titulo} · FASE ${rel.fase}</h2>
      <div class="grande derrota-txt">A colheita chegou a ${Math.floor(rel.jogador.crescimento * 100)}%</div>
      <p class="centro">Você perdeu uma vida. Vidas restantes: ${this.coracoes(restantes, rel.vidasMax)} <b>${restantes}</b></p>
      ${this.oQueDeuErrado(rel, gm)}
      ${this.tabelaComparacao(rel)}
      ${this.tabelaGastos(rel)}
      <p><i>Sr. Bruno: "${esc(gm.falas.derrota[Math.max(0, rel.vidasMax - 1 - restantes) % gm.falas.derrota.length])}"</i></p>`;
    this.abrir(html, [{ texto: `Tentar a fase ${rel.fase} de novo (${restantes} ${restantes === 1 ? 'vida' : 'vidas'}) ▶`, principal: true, acao: acoes.tentarDeNovo }], 'tela-derrota');
  }

  gameOver(gm, rel, acoes) {
    const html = `
      <h2 class="faixa">GAME OVER</h2>
      <div class="grande gameover-txt">GAME OVER</div>
      <p class="centro">Acabaram as ${rel.vidasMax} vidas. Você chegou até a fase ${rel.fase} de ${rel.ultimaFase} (${esc(rel.titulo)}).</p>
      ${this.oQueDeuErrado(rel, gm)}
      ${this.evolucao(rel)}
      <p><i>Sr. Bruno: "${esc(gm.falas.gameOver)}"</i></p>`;
    this.abrir(html, [{ texto: 'Recomeçar do início ▶', principal: true, acao: acoes.novoJogo }], 'tela-gameover');
  }

  vitoriaFinal(gm, rel, acoes) {
    const html = `
      <h2 class="faixa faixa-verde-centro">VOCÊ CONCLUIU AS ${rel.ultimaFase} FASES!</h2>
      <div class="grande vitoria-txt">A tecnologia é aliada do agricultor</div>
      <p class="centro">Na parceria com a IA você colheu em ${mmss(rel.tempoReal)} e chegou a <b>${rel.eficiencia}%</b> da eficiência da estufa autônoma.</p>
      ${this.tabelaComparacao(rel)}
      ${this.evolucao(rel)}
      <p><i>Sr. Bruno: "${esc(gm.falas.vitoriaFinal)}"</i></p>`;
    this.abrir(html, [{ texto: 'Jogar de novo ▶', principal: true, acao: acoes.novoJogo }], 'tela-vitoria');
  }
}
