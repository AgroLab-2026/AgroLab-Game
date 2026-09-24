// Telas entre fases: introdução da fase e o relatório "a derrota que ensina".
import { iconeUrl } from '../render/Icones.js';
import { AutonomousFarmAI } from '../ai/AutonomousFarmAI.js';
import { mmss } from './Vistas.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class TelasFase {
  constructor() {
    this.overlay = document.getElementById('overlay-fase');
    this.conteudo = document.getElementById('conteudo-fase');
    this.aoConfirmar = null;
  }

  get aberta() { return !this.overlay.classList.contains('escondido'); }

  fechar() { this.overlay.classList.add('escondido'); this.aoConfirmar = null; }

  abrir(html, botoes) {
    this.conteudo.innerHTML = html;
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

  introducao(gm, aoComecar, aoTrocarCultura) {
    const p = gm.progressao, fase = p.dadosFase;
    const nova = p.faseAtual >= 2 ? p.tecnologias[p.faseAtual - 2] : null;
    const culturas = Object.values(gm.crops);
    const html = `
      <h2 class="faixa">FASE ${p.faseAtual} DE ${p.ultimaFase} · ${esc(fase.titulo.toUpperCase())}</h2>
      <p><b>Cultura:</b> ${esc(gm.crop.cropName)}. ${esc(gm.crop.descricaoEducativa)}</p>
      <p><b>Objetivo:</b> ${esc(fase.objetivo)}</p>
      ${nova ? `<div class="tec-liberada"><img src="${iconeUrl(nova.icone)}" alt=""><div><b>Nova tecnologia: ${esc(nova.nome)}</b><br>${esc(nova.efeito)}</div></div>` : ''}
      <p>Ao lado, a <b>estufa autônoma</b> cultiva a mesma planta, sob o mesmo clima. No fim, você vê quanto chegou perto dela.</p>
      <p><b>Controles:</b> 1 Aguardar · 2 Travar irrigação · 3 Irrigar · 4 Proteger · R Encher água · P Pausa · Enter Confirmar (ou clique nas ferramentas).</p>
      <p><b>Trocar cultura:</b> ${culturas.map((c) => `<button class="botao-madeira" data-cultura="${c.id}"${c.id === gm.crop.id ? ' disabled' : ''}>${esc(c.cropName)}</button>`).join(' ')}</p>`;
    this.abrir(html, [{ texto: 'Começar ▶', principal: true, acao: aoComecar }]);
    for (const b of this.conteudo.querySelectorAll('[data-cultura]')) {
      b.addEventListener('click', () => { this.fechar(); aoTrocarCultura(b.dataset.cultura); });
    }
  }

  relatorio(gm, rel, aoProxima, aoRepetir) {
    const j = rel.jogador, ia = rel.ia;
    const motivo = {
      colheu: 'Você colheu! Veja como foi em relação à estufa autônoma.',
      morreu: 'Sua planta não resistiu...',
      tempoIA: 'A estufa autônoma já colheu há um tempo, e a sua ainda não estava pronta.',
      tempoMaximo: 'O tempo do ciclo acabou.',
    }[rel.motivo];
    const linha = (rot, a, b, fmt, melhorMenor = false) => {
      const [va, vb] = [fmt(a), fmt(b)];
      const vence = melhorMenor ? b < a : b > a;
      return `<tr><td>${rot}</td><td class="col-voce">${va}</td><td class="col-ia">${vb}${vence ? ' ✔' : ''}</td></tr>`;
    };
    const kg = (v) => `${v.toFixed(2)} kg`, pct = (v) => `${v.toFixed(0)}%`, un = (u) => (v) => `${v.toFixed(0)} ${u}`;
    const perdidos = rel.momentosPerdidos.length
      ? `<p><b>Quando a IA reagiu e você não</b> (${rel.reacoesPerdidas} de ${rel.reacoesIA} reações):</p><ul>${rel.momentosPerdidos.map((m) =>
          `<li>${mmss(m.tempo / gm.timeScale)} · <b>${esc(AutonomousFarmAI.Translate(m.acao))}</b> — ${esc(m.motivo)}</li>`).join('')}</ul>`
      : `<p>Você reagiu a todas as ${rel.reacoesIA} situações em que a IA agiu. A diferença veio da precisão e do custo de cada ação.</p>`;
    const hist = rel.historico.map((h, i) => {
      const atual = i === rel.historico.length - 1;
      return `<div class="${atual ? 'atual' : ''}" style="height:${Math.max(12, h.eficiencia * 0.6)}px" title="Fase ${h.fase} · ${esc(h.cultura)}">${h.eficiencia}%</div>`;
    }).join('');
    const tec = rel.tecnologiaLiberada;
    const final = rel.fase >= gm.progressao.ultimaFase;
    const melhorSozinho = Math.max(0, ...rel.historico.filter((h) => h.fase < gm.progressao.ultimaFase).map((h) => h.eficiencia));
    const fala = gm.falas.fimDeFase[(rel.fase - 1) % gm.falas.fimDeFase.length];
    const html = `
      <h2 class="faixa">FIM DA FASE ${rel.fase} · ${esc(rel.titulo.toUpperCase())}</h2>
      <p>${esc(motivo)}</p>
      <div class="grande">Você chegou a ${rel.eficiencia}% da eficiência da IA</div>
      <table class="tabela">
        <tr><th></th><th class="col-voce">Você</th><th class="col-ia">IA autônoma</th></tr>
        ${linha('Saúde média da planta', j.saudeMedia, ia.saudeMedia, pct)}
        ${linha('Crescimento', j.crescimento * 100, ia.crescimento * 100, pct)}
        ${linha('Produtividade', j.produtividade, ia.produtividade, kg)}
        ${linha('Água gasta', j.agua, ia.agua, un('L'), true)}
        ${linha('Energia gasta', j.energia, ia.energia, un(''), true)}
        ${linha('Fertilizante gasto', j.fertilizante, ia.fertilizante, (v) => `${v.toFixed(1)} doses`, true)}
        ${linha('Ações realizadas', j.acoes, ia.acoes, un(''), true)}
      </table>
      ${perdidos}
      <p><b>Sua evolução:</b></p><div class="barra-evolucao">${hist}</div>
      ${final ? `<p><b>Parceria:</b> sozinho, seu melhor foi ${melhorSozinho}%. Com a IA trabalhando junto, ${rel.eficiencia}%. A tecnologia é aliada do agricultor.</p>` : ''}
      ${tec ? `<div class="tec-liberada"><img src="${iconeUrl(tec.icone)}" alt=""><div><b>Tecnologia liberada: ${esc(tec.nome)}</b><br>${esc(tec.efeito)}</div></div>` : ''}
      <p><i>Sr. Bruno: "${esc(fala)}"</i></p>`;
    const botoes = final
      ? [{ texto: 'Jogar a parceria de novo ▶', principal: true, acao: aoRepetir }, { texto: 'Recomeçar da fase 1', secundario: true, acao: () => aoProxima(1) }]
      : [{ texto: 'Próxima fase ▶', principal: true, acao: () => aoProxima() }, { texto: 'Repetir fase', secundario: true, acao: aoRepetir }];
    this.abrir(html, botoes);
  }
}
