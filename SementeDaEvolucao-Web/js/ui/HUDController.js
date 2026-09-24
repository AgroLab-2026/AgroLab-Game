// HUDController: lê a "vista" do HUD (dados prontos, montados pelo GameManager)
// e escreve no DOM. Equivalente ao HUDController.cs da Fase 2.
import { iconeUrl } from '../render/Icones.js';
import { desenharPlanta } from '../render/Plantas.js';
import { desenharRetratoBruno } from '../render/Personagens.js';
import { ret, elipse, px } from '../render/Pixel.js';

const $ = (id) => document.getElementById(id);

export class HUDController {
  constructor(raiz = document) {
    this.raiz = raiz;
    // Ícones declarados no HTML via data-icone.
    for (const img of raiz.querySelectorAll('img[data-icone]')) img.src = iconeUrl(img.dataset.icone);

    this.el = {
      objetivo: $('txt-objetivo'), subtitulo: $('txt-subtitulo'), tituloObjetivo: $('txt-titulo-objetivo'),
      agua: $('rec-agua'), energia: $('rec-energia'), nutrientes: $('rec-nutrientes'), mao: $('rec-mao'), automacao: $('rec-automacao'),
      icoClima: $('ico-clima'), condicao: $('txt-condicao'), tempExt: $('txt-temp-ext'), umidExt: $('txt-umid-ext'),
      icoPrev: $('ico-previsao'), previsao: $('txt-previsao'),
      controle: $('lista-controle'), tecs: $('grade-tecnologias'),
      cvVoce: $('cv-voce'), cvIa: $('cv-ia'), estrelasVoce: $('estrelas-voce'), estrelasIa: $('estrelas-ia'),
      eficiencia: $('txt-eficiencia'),
      painelEvento: $('painel-evento'), icoEvento: $('ico-evento'), eventoNome: $('txt-evento-nome'), eventoDesc: $('txt-evento-desc'),
      eventoRotulo: $('txt-evento-rotulo'), eventoTempo: $('txt-evento-tempo'),
      bruno: $('txt-bruno'), cvBruno: $('cv-bruno'), falaBox: $('bruno-fala'),
      toast: $('toast'),
    };
    this.linhasControle = [];
    this.celulasTec = [];
    this._cache = new Map();
    this._toastAte = 0;
    this._brunoTexto = '';
    this._digitado = 0;
  }

  /** Só troca o texto/atributo quando muda (evita retrabalho de layout a 60 FPS). */
  set(el, prop, valor) {
    const chave = el;
    let c = this._cache.get(chave);
    if (!c) { c = {}; this._cache.set(chave, c); }
    if (c[prop] === valor) return;
    c[prop] = valor;
    if (prop === 'text') el.textContent = valor;
    else if (prop === 'class') el.className = valor;
    else if (prop === 'src') el.src = valor;
    else if (prop === 'width') el.style.width = valor;
    else if (prop === 'left') el.style.left = valor;
  }

  montarControle(linhas) {
    this.el.controle.innerHTML = '';
    this.linhasControle = linhas.map((l) => {
      const li = document.createElement('li');
      li.innerHTML = `<img alt=""><span class="rotulo"></span><span class="valor"></span>
        <div class="barra"><div class="ideal"></div><div class="preenche"></div><div class="marcador-ia"></div><div class="botao"></div></div>`;
      li.querySelector('img').src = iconeUrl(l.icone);
      this.el.controle.appendChild(li);
      return {
        rotulo: li.querySelector('.rotulo'), valor: li.querySelector('.valor'),
        ideal: li.querySelector('.ideal'), preenche: li.querySelector('.preenche'),
        botao: li.querySelector('.botao'), ia: li.querySelector('.marcador-ia'), id: l.id,
      };
    });
  }

  montarTecnologias(tecs) {
    this.el.tecs.innerHTML = '';
    this.celulasTec = tecs.map((t) => {
      const d = document.createElement('div');
      d.className = 'tec bloqueada';
      d.innerHTML = '<img alt=""><span></span>';
      d.title = t.efeito;
      this.el.tecs.appendChild(d);
      return { d, img: d.querySelector('img'), span: d.querySelector('span'), t };
    });
  }

  atualizar(h) {
    const e = this.el;
    this.set(e.objetivo, 'text', h.objetivo);
    if (h.tituloObjetivo) this.set(e.tituloObjetivo, 'text', h.tituloObjetivo);
    this.set(e.subtitulo, 'text', h.subtitulo);

    this.set(e.agua, 'text', `${h.recursos.agua}%`);
    this.set(e.agua, 'class', h.recursos.agua <= 20 ? 'ruim' : '');
    this.set(e.energia, 'text', `${h.recursos.energia}%`);
    this.set(e.energia, 'class', h.recursos.energia <= 20 ? 'ruim' : '');
    this.set(e.nutrientes, 'text', `${h.recursos.nutrientes}%`);
    this.set(e.nutrientes, 'class', h.recursos.nutrientes <= 20 ? 'ruim' : '');
    this.set(e.mao, 'text', String(h.recursos.mao));
    this.set(e.automacao, 'text', h.recursos.automacao);

    this.set(e.icoClima, 'src', iconeUrl(h.clima.icone));
    this.set(e.condicao, 'text', h.clima.condicao);
    this.set(e.tempExt, 'text', `${h.clima.temp}°C`);
    this.set(e.umidExt, 'text', `${h.clima.umid}%`);
    this.set(e.icoPrev, 'src', iconeUrl(h.previsao.icone));
    this.set(e.previsao, 'text', h.previsao.texto);

    if (this.linhasControle.length !== h.controle.length) this.montarControle(h.controle);
    h.controle.forEach((l, i) => {
      const r = this.linhasControle[i];
      this.set(r.rotulo, 'text', l.rotulo);
      this.set(r.valor, 'text', l.valorTxt);
      this.set(r.valor, 'class', `valor ${l.classe}`);
      this.set(r.ideal, 'left', `${(l.idealIni * 100).toFixed(1)}%`);
      this.set(r.ideal, 'width', `${((l.idealFim - l.idealIni) * 100).toFixed(1)}%`);
      this.set(r.preenche, 'width', `${(l.pos * 100).toFixed(1)}%`);
      r.preenche.style.background = l.cor;
      this.set(r.botao, 'left', `${(l.pos * 100).toFixed(1)}%`);
      this.set(r.ia, 'left', `${(l.posIa * 100).toFixed(1)}%`);
      r.botao.style.display = l.oculto ? 'none' : '';
      r.ia.style.display = l.mostrarIa ? '' : 'none';
    });

    if (this.celulasTec.length !== h.tecnologias.length) this.montarTecnologias(h.tecnologias);
    h.tecnologias.forEach((t, i) => {
      const c = this.celulasTec[i];
      this.set(c.span, 'text', t.nome);
      this.set(c.img, 'src', iconeUrl(t.estado === 'bloqueada' ? 'cadeado' : t.icone));
      this.set(c.d, 'class', `tec ${t.estado}`);
    });

    this.comparar(h.comparar);

    this.set(e.painelEvento, 'class', `painel moldura${h.evento.ativo ? ' ativo' : ''}`);
    this.set(e.icoEvento, 'src', iconeUrl(h.evento.icone));
    this.set(e.eventoNome, 'text', h.evento.nome);
    this.set(e.eventoDesc, 'text', h.evento.desc);
    this.set(e.eventoRotulo, 'text', h.evento.rotulo);
    this.set(e.eventoTempo, 'text', h.evento.tempo);

    this.fala(h.bruno);

    for (const btn of this.raiz.querySelectorAll('.lista-ferramentas button')) {
      const des = !!(h.acoesDesabilitadas && h.acoesDesabilitadas[btn.dataset.acao]);
      if (btn.disabled !== des) btn.disabled = des;
    }
  }

  comparar(cmp) {
    const lado = (pref, d) => {
      this.set($(`${pref}-saude`), 'text', `${d.saude}%`);
      this.set($(`${pref}-saude`), 'class', d.saude >= 70 ? (pref === 'ia' ? 'azul' : 'bom') : d.saude >= 40 ? 'medio' : 'ruim');
      this.set($(`${pref}-prod`), 'text', `${d.prod.toFixed(1)}kg`);
      this.set($(`${pref}-prod`), 'class', 'bom');
      this.set($(`${pref}-agua`), 'text', d.agua);
      this.set($(`${pref}-agua`), 'class', d.aguaClasse);
      this.set($(`${pref}-energia`), 'text', d.energia);
      this.set($(`${pref}-energia`), 'class', d.energiaClasse);
    };
    lado('voce', cmp.voce);
    lado('ia', cmp.ia);
    this.estrelas(this.el.estrelasVoce, cmp.voce.estrelas, true);
    this.estrelas(this.el.estrelasIa, cmp.ia.estrelas, false);
    this.set(this.el.eficiencia, 'text', cmp.eficiencia);
    const chaveV = `${cmp.voce.estagio}|${Math.round(cmp.voce.saude01 * 20)}|${cmp.voce.visual.forma}`;
    const chaveI = `${cmp.ia.estagio}|${Math.round(cmp.ia.saude01 * 20)}|${cmp.ia.visual.forma}`;
    if (this._canteiroV !== chaveV) { this._canteiroV = chaveV; this.canteiro(this.el.cvVoce, cmp.voce); }
    if (this._canteiroI !== chaveI) { this._canteiroI = chaveI; this.canteiro(this.el.cvIa, cmp.ia); }
  }

  estrelas(el, n, jogador) {
    const chave = `${n}|${jogador}`;
    if (el.dataset.chave === chave) return;
    el.dataset.chave = chave;
    el.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const img = document.createElement('img');
      img.src = iconeUrl(i < n ? (jogador && n <= 1 ? 'estrelaVermelha' : 'estrela') : 'estrelaVazia');
      el.appendChild(img);
    }
  }

  /** Canteiro elevado de tijolos (como os cards da referência), com 3 plantas. */
  canteiro(cv, d) {
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, cv.width, cv.height);
    ret(c, 4, 20, 48, 12, '#2a1a10');
    ret(c, 5, 20, 46, 10, '#4a3020');
    for (let x = 5; x < 51; x += 5) ret(c, x, 26, 1, 4, '#2a1a10');
    ret(c, 5, 25, 46, 1, '#2a1a10');
    ret(c, 7, 18, 42, 5, '#5a3418');
    for (let i = 0; i < 20; i++) px(c, 8 + ((i * 7) % 40), 19 + (i % 3), '#3e2210');
    const pos = [[16, 22], [28, 21], [40, 22]];
    pos.forEach(([x, y], i) => desenharPlanta(c, x, y, d.visual, d.estagio, d.saude01, 11 + i, 0));
  }

  /** Efeito de máquina de escrever na fala do Bruno + boca mexendo. */
  fala(b) {
    if (b.texto !== this._brunoTexto) {
      this._brunoTexto = b.texto;
      this._digitado = 0;
    }
    const alvo = this._brunoTexto.length;
    if (this._digitado < alvo) {
      this._digitado = Math.min(alvo, this._digitado + 2);
      this.el.bruno.textContent = this._brunoTexto.slice(0, this._digitado);
    }
    const falando = this._digitado < alvo && Math.floor(performance.now() / 120) % 2 === 0;
    const piscar = Math.floor(performance.now() / 150) % 30 === 0;
    const chave = `${falando}|${piscar}`;
    if (this._retrato !== chave) {
      this._retrato = chave;
      const c = this.el.cvBruno.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(desenharRetratoBruno(falando, piscar), 0, 0);
    }
  }

  toast(msg, ruim = false, ms = 1800) {
    const t = this.el.toast;
    t.textContent = msg;
    t.className = `visivel${ruim ? ' ruim' : ''}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.className = ''; }, ms);
  }

  destacarFerramenta(acao) {
    const btn = this.raiz.querySelector(`.lista-ferramentas button[data-acao="${acao}"]`);
    if (!btn) return;
    btn.classList.add('ativo');
    setTimeout(() => btn.classList.remove('ativo'), 250);
  }
}
