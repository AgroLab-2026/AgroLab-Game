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
      'barra-agua': $('barra-agua'), 'barra-energia': $('barra-energia'), 'barra-nutrientes': $('barra-nutrientes'),
      energiaRegen: $('rec-energia-regen'),
      lousaFase: $('lousa-fase'), faseTitulo: $('txt-fase'), faseTempo: $('txt-tempo'), tentativas: $('tentativas'),
      barraColheita: $('barra-colheita'), txtColheita: $('txt-colheita'),
    };
    this.botoes = {};
    for (const btn of raiz.querySelectorAll('.lista-ferramentas button')) {
      this.botoes[btn.dataset.acao] = {
        btn, custos: btn.querySelector('.custos'), selo: btn.querySelector('.selo'), uso: btn.querySelector('.uso i'),
      };
    }
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

    for (const [chave, cls] of [['agua', 'agua'], ['energia', 'energia'], ['nutrientes', 'fertilizante']]) {
      const d = h.recursos[chave];
      this.set(e[chave], 'text', d.txt);
      this.set(e[chave], 'class', d.frac <= 0.2 ? 'ruim' : '');
      this.set(e[`barra-${chave}`], 'width', `${(d.frac * 100).toFixed(1)}%`);
      this.set(e[`barra-${chave}`], 'class', d.frac <= 0.2 ? 'baixo' : cls);
    }
    this.set(e.energiaRegen, 'text', h.recursos.energia.regen);
    this.set(e.mao, 'text', h.recursos.mao);
    this.set(e.automacao, 'text', h.recursos.automacao);

    // Lousa da fase: tempo, tentativas e colheita.
    this.set(e.faseTitulo, 'text', h.fase.titulo);
    this.set(e.faseTempo, 'text', h.fase.tempo);
    this.set(e.lousaFase, 'class', `lousa moldura-lousa ${h.fase.urgencia}`);
    this.set(e.barraColheita, 'width', `${(h.fase.colheita * 100).toFixed(1)}%`);
    this.set(e.txtColheita, 'text', `${Math.floor(h.fase.colheita * 100)}%`);
    const chaveT = `${h.fase.tentativasRestantes}/${h.fase.tentativasPorFase}`;
    if (e.tentativas.dataset.chave !== chaveT) {
      e.tentativas.dataset.chave = chaveT;
      e.tentativas.title = `Tentativas restantes nesta fase: ${chaveT}`;
      e.tentativas.innerHTML = '';
      for (let i = 0; i < h.fase.tentativasPorFase; i++) {
        const img = document.createElement('img');
        img.src = iconeUrl(i < h.fase.tentativasRestantes ? 'coracao' : 'coracaoVazio');
        e.tentativas.appendChild(img);
      }
    }

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

    this.ferramentas(h.ferramentas);
  }

  /** Custos de cada ferramenta e seus estados (falta recurso, em uso, alerta, IA sugere). */
  ferramentas(f) {
    for (const [acao, d] of Object.entries(f)) {
      const b = this.botoes[acao];
      if (!b) continue;
      const chave = JSON.stringify([d.custo, d.falta, d.aguaGanha]);
      if (b.custos.dataset.chave !== chave) {
        b.custos.dataset.chave = chave;
        b.custos.innerHTML = '';
        const item = (icone, txt, falta) => {
          const sp = document.createElement('span');
          if (falta) sp.className = 'falta';
          if (icone) { const img = document.createElement('img'); img.src = iconeUrl(icone); sp.appendChild(img); }
          sp.appendChild(document.createTextNode(txt));
          b.custos.appendChild(sp);
        };
        const c = d.custo;
        if (acao === 'Refill') {
          item('energia', `−${c.energia}`, d.falta.includes('energia'));
          item('agua', d.aguaGanha > 0 ? `+${d.aguaGanha} L` : 'cheio', false);
        } else if (!c.agua && !c.fertilizante && !c.energia) {
          const sp = document.createElement('span'); sp.className = 'gratis'; sp.textContent = 'grátis · só observa';
          b.custos.appendChild(sp);
        } else {
          if (c.agua) item('agua', `−${c.agua} L`, d.falta.includes('agua'));
          if (c.energia) item('energia', `−${+c.energia.toFixed(1)}`, d.falta.includes('energia'));
          if (c.fertilizante) item('nutrientes', `−${c.fertilizante}`, d.falta.includes('fertilizante'));
        }
        b.btn.title = d.falta.length ? `Falta: ${d.falta.join(', ')}` : '';
      }
      const cl = b.btn.classList;
      if (cl.contains('sem-recurso') !== d.falta.length > 0) cl.toggle('sem-recurso', d.falta.length > 0);
      if (cl.contains('em-uso') !== !!d.emUso) cl.toggle('em-uso', !!d.emUso);
      if (cl.contains('sugerido') !== d.sugerido) cl.toggle('sugerido', d.sugerido);
      if (cl.contains('alerta') !== d.alerta) cl.toggle('alerta', d.alerta);
      const selo = d.sugerido ? 'IA sugere' : d.alerta ? 'sensor!' : '';
      this.set(b.selo, 'text', selo);
      if (d.emUso) b.uso.style.width = `${(d.emUso * 100).toFixed(1)}%`;
      const nome = b.btn.querySelector('.nome');
      const rotulo = acao === 'ProtectPlant' && d.emUsoTxt ? `Protegendo · ${d.emUsoTxt}` : nome.dataset.original ?? nome.textContent;
      nome.dataset.original ??= nome.textContent;
      this.set(nome, 'text', rotulo);
      if (b.btn.disabled !== d.desabilitado) b.btn.disabled = d.desabilitado;
    }
  }

  /** Mostra o gasto de uma ação: números subindo nas linhas de recurso. */
  mostrarGasto(g) {
    const flutuar = (idLinha, txt, ganho = false) => {
      const li = document.getElementById(idLinha);
      if (!li) return;
      const d = document.createElement('span');
      d.className = `delta${ganho ? ' ganho' : ''}`;
      d.textContent = txt;
      li.appendChild(d);
      li.classList.remove('gastou'); void li.offsetWidth; if (!ganho) li.classList.add('gastou');
      setTimeout(() => d.remove(), 1500);
    };
    if (g.agua) flutuar('linha-agua', `−${g.agua} L`);
    if (g.aguaGanha) flutuar('linha-agua', `+${Math.round(g.aguaGanha)} L`, true);
    if (g.energia) flutuar('linha-energia', `−${+g.energia.toFixed(1)}`);
    if (g.fertilizante) flutuar('linha-fertilizante', `−${g.fertilizante}`);
  }

  comparar(cmp) {
    const lado = (pref, d) => {
      this.set($(`${pref}-saude`), 'text', `${d.saude}%`);
      this.set($(`${pref}-saude`), 'class', d.saude >= 70 ? (pref === 'ia' ? 'azul' : 'bom') : d.saude >= 40 ? 'medio' : 'ruim');
      this.set($(`${pref}-prod`), 'text', `${d.crescimento}%`);
      this.set($(`${pref}-prod`), 'class', pref === 'ia' ? 'azul' : 'bom');
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
