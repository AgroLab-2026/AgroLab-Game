// Atividades do mundo aberto: crimes aleatórios (assalto, carro em fuga, resgate),
// desafios de anéis, cristais colecionáveis, XP/níveis e progresso salvo no navegador.
import * as THREE from '../vendor/three.module.min.js';
import { CAMADA_FX, criarRng, toon, formatarTempo } from './util.js';
import { geometriasCarro } from './trafego.js';
import { criarHumanoide, Animador, Poses } from './modelo.js';
import { N, QUADRA, MEIO } from './cidade.js';

const CHAVE = 'teiaUrbana.progresso.v1';
const TOTAL_CRISTAIS = 40;

function farol(cor) {
  const g = new THREE.CylinderGeometry(2.2, 2.2, 600, 12, 1, true);
  g.translate(0, 300, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
  m.layers.set(CAMADA_FX);
  m.frustumCulled = false;
  return m;
}

function carroMalha(corCorpo, policia = false) {
  const g = geometriasCarro();
  const grupo = new THREE.Group();
  const corpo = new THREE.Mesh(g.corpo, toon(corCorpo));
  const det = new THREE.Mesh(g.detalhes, toon('#ffffff', { vertexColors: true }));
  const luz = new THREE.Mesh(g.luzes, new THREE.MeshBasicMaterial({ vertexColors: true }));
  for (const m of [corpo, det]) { m.castShadow = true; }
  grupo.add(corpo, det, luz);
  if (policia) {
    const faixa = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.25, 2.4), toon('#ffffff'));
    faixa.position.y = 0.8;
    grupo.add(faixa);
    grupo.sirenes = [];
    for (const [x, c] of [[0.4, '#ff2a3a'], [-0.4, '#2a6bff']]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: c }));
      s.position.set(x, 2.02, -0.25);
      grupo.add(s);
      grupo.sirenes.push(s);
    }
  }
  return grupo;
}

// ------------------------------------------------------------------------- carro em fuga
class CarroFuga {
  constructor(ctx, pos, eixo) {
    this.ctx = ctx;
    this.malha = carroMalha('#2a2a33');
    const faixa = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 4.42), toon('#ff3355'));
    faixa.position.y = 1.13;
    this.malha.add(faixa);
    ctx.cena.add(this.malha);
    this.pos = pos.clone();
    this.pos.y = 0;
    // alinha ao eixo da rua
    const linha = (v) => -MEIO + Math.round((v + MEIO) / QUADRA) * QUADRA;
    this.eixo = eixo;
    if (eixo === 'z') this.pos.x = linha(this.pos.x); else this.pos.z = linha(this.pos.z);
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.vel = 0;
    this.velMax = 25;
    this.acertos = 0;
    this.precisa = 6;
    this.vivo = true;
    this.parado = false;
    this.yaw = 0;
    this.proxCruz = this.calcProxCruz();
    this.isCarro = true;
  }

  centro() { return this.pos.clone().add(new THREE.Vector3(0, 1.1, 0)); }

  calcProxCruz() {
    const s = this.eixo === 'x' ? this.pos.x : this.pos.z;
    const k = (s + MEIO) / QUADRA;
    const prox = this.dir > 0 ? Math.floor(k + 1e-3) + 1 : Math.ceil(k - 1e-3) - 1;
    return -MEIO + prox * QUADRA;
  }

  acertarTeia() {
    if (this.parado) return;
    this.acertos++;
    this.ctx.efeitos.onoma('THWAP!', this.centro(), 'thwip', 0.9);
    this.velMax = Math.max(12, this.velMax - 2);
    if (this.acertos >= this.precisa) {
      this.parado = true;
      this.vivo = false;
      this.ctx.efeitos.onoma('CRASH!', this.centro(), 'krak', 1.4);
      this.ctx.efeitos.faiscas(this.centro(), '#ffaa33');
      this.ctx.efeitos.poeira(this.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), 20, 6);
      this.ctx.audio.tocar('finalizar', 0.7);
      this.ctx.camJogo.sacudir(0.4);
    }
  }

  atualizar(dt) {
    if (this.parado) { this.vel = Math.max(0, this.vel - 30 * dt); }
    else this.vel = Math.min(this.velMax, this.vel + 14 * dt);
    const passo = this.vel * dt * this.dir;
    const s = this.eixo === 'x' ? 'x' : 'z';
    const antes = this.pos[s];
    this.pos[s] += passo;
    const cruzou = this.dir > 0 ? (antes < this.proxCruz && this.pos[s] >= this.proxCruz) : (antes > this.proxCruz && this.pos[s] <= this.proxCruz);
    if (cruzou && !this.parado) {
      // decide virar ou seguir; nunca sai da cidade
      this.pos[s] = this.proxCruz;
      const outro = s === 'x' ? 'z' : 'x';
      const opcoes = [];
      const pode = (eixo, dir) => { const v = this.pos[eixo] + dir * QUADRA; return v >= -MEIO - 1 && v <= MEIO + 1; };
      if (pode(s, this.dir)) opcoes.push([s, this.dir], [s, this.dir]);
      if (pode(outro, 1)) opcoes.push([outro, 1]);
      if (pode(outro, -1)) opcoes.push([outro, -1]);
      const [e, d] = opcoes[Math.floor(Math.random() * opcoes.length)];
      this.eixo = e; this.dir = d;
      this.proxCruz = this.calcProxCruz();
    }
    const alvoYaw = this.eixo === 'x' ? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (this.dir > 0 ? 0 : Math.PI);
    let dif = alvoYaw - this.yaw;
    while (dif > Math.PI) dif -= Math.PI * 2;
    while (dif < -Math.PI) dif += Math.PI * 2;
    this.yaw += dif * Math.min(1, dt * 10);
    // faixa da direita
    const lateral = this.eixo === 'x' ? new THREE.Vector3(0, 0, this.dir * 3.5) : new THREE.Vector3(-this.dir * 3.5, 0, 0);
    this.malha.position.copy(this.pos).add(lateral);
    this.malha.rotation.set(0, this.yaw, this.parado ? 0.04 : Math.sin(performance.now() * 0.02) * 0.01);
  }

  remover() { this.ctx.cena.remove(this.malha); }
}

// ------------------------------------------------------------------------- missões
export class Missoes {
  constructor(ctx) {
    this.ctx = ctx;
    this.rng = criarRng(99);
    this.xp = 0;
    this.nivel = 1;
    this.coletados = new Set();
    this.recordes = {};
    this.crimesResolvidos = 0;
    this.inimigosDerrotados = 0;
    this.tempoJogo = 0;
    this.carregar();

    this.ativo = null;
    this.tProxCrime = 20;
    this.grupoId = 0;
    this.desafio = null;

    this.criarCristais();
    this.criarDesafios();
  }

  // ----------------------------------------------------------- progresso
  carregar() {
    try {
      const d = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (!d) return;
      this.xp = d.xp || 0; this.nivel = d.nivel || 1;
      this.coletados = new Set(d.coletados || []);
      this.recordes = d.recordes || {};
      this.crimesResolvidos = d.crimes || 0;
      this.inimigosDerrotados = d.inimigos || 0;
      this.tempoJogo = d.tempo || 0;
    } catch { /* sem armazenamento */ }
  }

  salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({
        xp: this.xp, nivel: this.nivel, coletados: [...this.coletados], recordes: this.recordes,
        crimes: this.crimesResolvidos, inimigos: this.inimigosDerrotados, tempo: this.tempoJogo,
      }));
    } catch { /* sem armazenamento */ }
  }

  zerar() {
    try { localStorage.removeItem(CHAVE); } catch { /* nada */ }
  }

  xpNecessario() { return 150 + (this.nivel - 1) * 90; }

  ganharXp(q, motivo) {
    this.xp += q;
    this.ctx.hud.xpGanho(q, motivo);
    while (this.xp >= this.xpNecessario()) {
      this.xp -= this.xpNecessario();
      this.nivel++;
      this.aplicarNivel(true);
    }
    this.salvar();
  }

  aplicarNivel(anunciar) {
    const jog = this.ctx.jogador;
    jog.hpMax = 100 + (this.nivel - 1) * 10;
    jog.dano = 1 + Math.floor((this.nivel - 1) / 2) * 0.5;
    jog.focoMax = this.nivel >= 4 ? 4 : 3;
    if (anunciar) {
      jog.hp = jog.hpMax;
      const extra = this.nivel % 2 === 1 ? ' · Golpes mais fortes!' : '';
      const foco = this.nivel === 4 ? ' · +1 barra de FOCO!' : '';
      this.ctx.hud.banner(`NÍVEL ${this.nivel}!`, `Vida máxima ${jog.hpMax}${extra}${foco}`, 'nivel');
      this.ctx.audio.tocar('nivel');
    }
  }

  // ----------------------------------------------------------- cristais
  criarCristais() {
    const cid = this.ctx.cidade;
    const r = criarRng(4242);
    const pontos = [];
    const telhados = cid.telhados.filter((t) => !t.torre);
    const usados = new Set();
    while (pontos.length < TOTAL_CRISTAIS - 1) {
      const i = Math.floor(r() * telhados.length);
      if (usados.has(i)) continue;
      usados.add(i);
      const t = telhados[i];
      // alguns ficam no meio do telhado, outros na borda
      pontos.push(new THREE.Vector3(t.x + r.entre(-2, 2), t.y + 1.6, t.z + r.entre(-2, 2)));
    }
    if (cid.torre) pontos.push(new THREE.Vector3(cid.torre.x + 3, cid.torre.topo + 1.6, cid.torre.z + 3));
    this.cristais = pontos.map((p, i) => ({ p, id: i, pego: this.coletados.has(i) }));
    const geo = new THREE.OctahedronGeometry(0.7, 0);
    geo.scale(1, 1.5, 1);
    const mat = new THREE.MeshToonMaterial({ color: '#ffd84a', emissive: '#c77a00', emissiveIntensity: 0.9 });
    this.malhaCristais = new THREE.InstancedMesh(geo, mat, this.cristais.length);
    this.malhaCristais.frustumCulled = false;
    this.ctx.cena.add(this.malhaCristais);
    this.mCr = new THREE.Matrix4();
    this.atualizarCristais(0);
  }

  atualizarCristais(t) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t * 1.8, 0));
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (const c of this.cristais) {
      s.setScalar(c.pego ? 0 : 1);
      p.copy(c.p); p.y += Math.sin(t * 2 + c.id) * 0.25;
      this.mCr.compose(p, q, s);
      this.malhaCristais.setMatrixAt(c.id, this.mCr);
    }
    this.malhaCristais.instanceMatrix.needsUpdate = true;
  }

  get qtdColetados() { return this.cristais.filter((c) => c.pego).length; }

  // ----------------------------------------------------------- desafios de anéis
  criarDesafios() {
    const cid = this.ctx.cidade;
    const r = criarRng(777);
    const altos = cid.telhados.filter((t) => t.y > 45 && t.y < 140 && !t.torre);
    this.desafios = [];
    const nomes = ['Rota do Pôr do Sol', 'Corrida do Centro', 'Volta do Cais'];
    for (let k = 0; k < 3; k++) {
      let t;
      for (let tent = 0; tent < 50; tent++) {
        t = altos[Math.floor(r() * altos.length)];
        if (this.desafios.every((d) => Math.hypot(d.inicio.x - t.x, d.inicio.z - t.z) > 250)) break;
      }
      const inicio = new THREE.Vector3(t.x, t.y, t.z);
      const aneis = this.gerarRota(inicio, r);
      const f = farol('#33e1ff');
      f.position.copy(inicio);
      this.ctx.cena.add(f);
      let dist = 0;
      let ant = inicio;
      for (const a of aneis) { dist += a.distanceTo(ant); ant = a; }
      this.desafios.push({ id: `d${k}`, nome: nomes[k], inicio, aneis, farol: f, limite: Math.round(dist / 21 + 10) });
    }
    this.geoAnel = new THREE.TorusGeometry(6, 0.45, 8, 32);
  }

  gerarRota(inicio, r) {
    // anéis no meio das ruas (espaço aberto), subindo e descendo
    const linha = (v) => -MEIO + Math.round((v + MEIO) / QUADRA) * QUADRA;
    let x = linha(inicio.x), z = linha(inicio.z);
    let eixo = r() < 0.5 ? 'x' : 'z';
    let dir = r() < 0.5 ? 1 : -1;
    const aneis = [];
    let pos = { x, z };
    for (let i = 0; i < 12; i++) {
      const passos = r.int(1, 2);
      for (let p = 0; p < passos; p++) {
        let nv = pos[eixo] + dir * QUADRA;
        if (Math.abs(nv) > MEIO) { dir = -dir; nv = pos[eixo] + dir * QUADRA; }
        // anel no meio do quarteirão
        const meio = { ...pos };
        meio[eixo] = pos[eixo] + dir * QUADRA * 0.5;
        if (p === passos - 1) aneis.push(new THREE.Vector3(meio.x, r.entre(14, 48), meio.z));
        pos[eixo] = nv;
      }
      if (r() < 0.55) { eixo = eixo === 'x' ? 'z' : 'x'; dir = r() < 0.5 ? 1 : -1; if (Math.abs(pos[eixo] + dir * QUADRA) > MEIO) dir = -dir; }
    }
    return aneis;
  }

  iniciarDesafio(d) {
    this.cancelarAtivo(false);
    const aneis = d.aneis.map((p, i) => {
      const m = new THREE.Mesh(this.geoAnel, new THREE.MeshBasicMaterial({ color: '#33e1ff' }));
      m.position.copy(p);
      const prox = d.aneis[i + 1] || p.clone().add(p.clone().sub(d.aneis[i - 1] || d.inicio));
      const ant = i === 0 ? d.inicio : d.aneis[i - 1];
      const dir = prox.clone().sub(ant).setY(0).normalize();
      m.lookAt(p.clone().add(dir));
      this.ctx.cena.add(m);
      return m;
    });
    this.desafio = { d, aneis, idx: 0, t: -3, contagem: 3 };
    this.ctx.hud.banner(d.nome.toUpperCase(), 'Passe por todos os anéis antes do tempo acabar!', 'desafio');
    this.ctx.audio.tocar('missao');
  }

  atualizarDesafio(dt) {
    const ds = this.desafio;
    const jog = this.ctx.jogador;
    ds.t += dt;
    if (ds.t < 0) {
      const c = Math.ceil(-ds.t);
      if (c !== ds.contagem) { ds.contagem = c; this.ctx.audio.tocar('ui'); }
      this.ctx.hud.objetivo(ds.d.nome, `Comece em ${c}...`, null);
      if (jog.estado !== 'chao') ds.t = Math.max(ds.t, -0.01);
      return;
    }
    const restante = ds.d.limite - ds.t;
    this.ctx.hud.objetivo(ds.d.nome, `Anel ${ds.idx + 1} de ${ds.aneis.length}`, restante);
    ds.aneis.forEach((m, i) => {
      m.visible = i >= ds.idx && i < ds.idx + 3;
      m.material.color.set(i === ds.idx ? '#ffe14a' : '#33e1ff');
      if (i === ds.idx) m.scale.setScalar(1 + Math.sin(ds.t * 6) * 0.05);
    });
    const alvo = ds.aneis[ds.idx];
    this.alvoHud = { pos: alvo.position, cor: '#ffe14a', rotulo: 'ANEL' };
    if (jog.centro().distanceTo(alvo.position) < 6.6) {
      this.ctx.audio.tocar('anel');
      this.ctx.efeitos.emitir(alvo.position, 24, { vel: 10, cor: '#ffe14a', tam: 0.5, vida: 0.5 });
      ds.idx++;
      if (ds.idx >= ds.aneis.length) {
        const tempo = ds.t;
        const rec = this.recordes[ds.d.id];
        const novo = !rec || tempo < rec;
        if (novo) this.recordes[ds.d.id] = tempo;
        const medalha = tempo < ds.d.limite * 0.72 ? 'OURO' : tempo < ds.d.limite * 0.86 ? 'PRATA' : 'BRONZE';
        this.ctx.hud.banner('DESAFIO CONCLUÍDO!', `${formatarTempo(tempo)} · Medalha de ${medalha}${novo ? ' · NOVO RECORDE!' : ''}`, 'sucesso');
        this.ctx.audio.tocar('missao');
        this.limparDesafio();
        this.ganharXp(medalha === 'OURO' ? 220 : medalha === 'PRATA' ? 160 : 110, 'Desafio');
        return;
      }
    }
    if (restante <= 0) {
      this.ctx.hud.banner('TEMPO ESGOTADO', 'Tente de novo: o farol azul continua lá.', 'falha');
      this.ctx.audio.tocar('falha');
      this.limparDesafio();
    }
  }

  limparDesafio() {
    if (!this.desafio) return;
    for (const m of this.desafio.aneis) { this.ctx.cena.remove(m); m.material.dispose(); }
    this.desafio = null;
    this.alvoHud = null;
    this.ctx.hud.objetivo(null);
  }

  // ----------------------------------------------------------- crimes
  sortearCrime(forcado = null) {
    const jog = this.ctx.jogador;
    const cid = this.ctx.cidade;
    const tipos = this.crimesResolvidos < 1 ? ['assalto'] : ['assalto', 'assalto', 'fuga', 'resgate'];
    const tipo = forcado || tipos[Math.floor(Math.random() * tipos.length)];
    const id = ++this.grupoId;
    if (tipo === 'assalto') {
      const p = cid.pontoDeRua(Math.random, jog.pos, 110, 330);
      const n = Math.min(6, 3 + Math.floor(this.nivel / 2) + (Math.random() < 0.4 ? 1 : 0));
      const tipos2 = [];
      for (let k = 0; k < n; k++) {
        if (k >= 2 && this.nivel >= 2 && Math.random() < 0.35) tipos2.push('atirador');
        else if (k === n - 1 && this.nivel >= 3 && Math.random() < 0.6) tipos2.push('bruto');
        else tipos2.push('brigao');
      }
      tipos2.forEach((t, k) => {
        const a = (k / n) * Math.PI * 2;
        this.ctx.inimigos.criar(t, p.clone().add(new THREE.Vector3(Math.cos(a) * 3, 0, Math.sin(a) * 3)), id);
      });
      const viatura = carroMalha('#f4f4f4', true);
      const lado = p.eixoRua === 'z' ? new THREE.Vector3(5.5, 0, 6) : new THREE.Vector3(6, 0, 5.5);
      viatura.position.copy(p).add(lado);
      viatura.rotation.y = p.eixoRua === 'z' ? 0.4 : Math.PI / 2 + 0.4;
      this.ctx.cena.add(viatura);
      const f = farol('#ff3344'); f.position.copy(p); this.ctx.cena.add(f);
      this.ativo = { tipo, id, pos: p, farol: f, viatura, total: n, nome: 'ASSALTO EM ANDAMENTO', t: 0 };
      this.ctx.hud.banner('CRIME!', 'Assalto em andamento. Siga o farol vermelho.', 'crime');
    } else if (tipo === 'fuga') {
      const p = cid.pontoDeRua(Math.random, jog.pos, 90, 220);
      const carro = new CarroFuga(this.ctx, p, p.eixoRua);
      this.ctx.inimigos.extras = [carro];
      const f = farol('#b44dff'); this.ctx.cena.add(f);
      this.ativo = { tipo, id, carro, farol: f, t: 0, limite: 80, nome: 'CARRO EM FUGA' };
      this.ctx.hud.banner('PERSEGUIÇÃO!', 'Alcance o carro e acerte TEIAS nele (botão direito).', 'crime');
    } else {
      const candidatos = cid.telhados.filter((t) => t.y > 40 && t.y < 160 && !t.torre && Math.hypot(t.x - jog.pos.x, t.z - jog.pos.z) > 120 && Math.hypot(t.x - jog.pos.x, t.z - jog.pos.z) < 330);
      const t = candidatos[Math.floor(Math.random() * candidatos.length)] || cid.telhados[0];
      // civil pendurado na borda do telhado
      const borda = new THREE.Vector3(t.x0 - 0.3, t.y - 2.4, (t.z0 + t.z1) / 2);
      const { raiz, j } = criarHumanoide({ tronco: '#f2c94c', pernas: '#3f6fb5' });
      const anim = new Animador(j);
      raiz.position.copy(borda);
      raiz.rotation.y = Math.PI / 2;
      this.ctx.cena.add(raiz);
      const f = farol('#ff9a2e'); f.position.set(borda.x, 0, borda.z); this.ctx.cena.add(f);
      this.ativo = { tipo: 'resgate', id, civil: raiz, anim, pos: borda, farol: f, t: 0, limite: 45, nome: 'CIVIL EM PERIGO', teto: t };
      this.ctx.hud.banner('SOCORRO!', 'Alguém está pendurado num prédio. Chegue lá a tempo!', 'crime');
    }
    this.ctx.audio.tocar('missao');
  }

  atualizarCrime(dt) {
    const a = this.ativo;
    const jog = this.ctx.jogador;
    a.t += dt;
    const ini = this.ctx.inimigos;
    if (a.tipo === 'assalto') {
      const vivos = ini.vivosDoGrupo(a.id).length;
      const perto = jog.pos.distanceTo(a.pos) < 45;
      this.ctx.hud.objetivo(a.nome, perto ? `Derrote os bandidos: ${vivos} restante${vivos === 1 ? '' : 's'}` : `Vá até o farol vermelho (${Math.round(jog.pos.distanceTo(a.pos))} m)`, null);
      this.alvoHud = { pos: a.pos.clone().add(new THREE.Vector3(0, 1, 0)), cor: '#ff3344', rotulo: 'CRIME' };
      if (a.viatura) for (const [k, s] of a.viatura.sirenes.entries()) s.visible = Math.floor(a.t * 6 + k) % 2 === 0;
      this.sirene = { pos: a.pos };
      if (vivos === 0) this.concluirCrime(150 + a.total * 15);
    } else if (a.tipo === 'fuga') {
      const c = a.carro;
      c.atualizar(dt);
      a.farol.position.set(c.malha.position.x, 0, c.malha.position.z);
      this.alvoHud = { pos: c.centro(), cor: '#b44dff', rotulo: 'FUGA' };
      this.sirene = { pos: c.malha.position };
      if (!a.saiu && c.parado) {
        a.saiu = true;
        a.limite = Infinity;
        // bandidos saem do carro
        for (let k = 0; k < 2; k++) {
          const e = ini.criar(k === 0 && this.nivel >= 2 ? 'atirador' : 'brigao', c.malha.position.clone().add(new THREE.Vector3(k * 2 - 1, 0, 2.5)), a.id);
          e.alertar();
        }
      }
      if (a.saiu) {
        const vivos = ini.vivosDoGrupo(a.id).length;
        this.ctx.hud.objetivo(a.nome, `Carro parado! Derrote os ocupantes: ${vivos}`, null);
        if (vivos === 0) this.concluirCrime(260);
      } else {
        const dist = Math.round(jog.pos.distanceTo(c.pos));
        this.ctx.hud.objetivo(a.nome, `Teias no carro: ${c.acertos}/${c.precisa} · ${dist} m`, a.limite - a.t);
        if (dist < 32 && !a.dicaDada) { a.dicaDada = true; this.ctx.hud.dica('Mire no carro e use o botão direito (TEIA)!'); }
        if (a.t > a.limite) this.falharCrime('O carro fugiu!');
      }
    } else if (a.tipo === 'resgate') {
      a.anim.zerar();
      Poses.pendurado(a.anim, a.t);
      a.anim.aplicar(dt);
      const restante = a.limite - a.t;
      const dist = Math.round(jog.centro().distanceTo(a.pos));
      this.ctx.hud.objetivo(a.nome, `Chegue até a pessoa pendurada · ${dist} m`, restante);
      this.alvoHud = { pos: a.pos.clone().add(new THREE.Vector3(0, 1, 0)), cor: '#ff9a2e', rotulo: 'SOCORRO' };
      if (dist < 5) {
        a.civil.position.set(a.teto.x0 + 2.5, a.teto.y, (a.teto.z0 + a.teto.z1) / 2);
        this.ctx.efeitos.onoma('OBRIGADO!', a.civil.position.clone().add(new THREE.Vector3(0, 2, 0)), 'thwip', 1);
        this.concluirCrime(200);
      } else if (restante <= 0) this.falharCrime('Não deu tempo... os bombeiros fizeram o resgate.');
    }
  }

  concluirCrime(xp) {
    const a = this.ativo;
    this.crimesResolvidos++;
    this.ctx.hud.banner('CRIME RESOLVIDO!', `+${xp} XP`, 'sucesso');
    this.ctx.audio.tocar('missao');
    this.ganharXp(xp, 'Crime');
    this.limparCrime(a, true);
  }

  falharCrime(msg) {
    this.ctx.hud.banner('FALHOU', msg, 'falha');
    this.ctx.audio.tocar('falha');
    this.limparCrime(this.ativo, false);
  }

  limparCrime(a, sucesso) {
    if (!a) return;
    const cena = this.ctx.cena;
    if (a.farol) cena.remove(a.farol);
    const viatura = a.viatura;
    if (viatura) setTimeout(() => cena.remove(viatura), sucesso ? 6000 : 0);
    if (a.carro) { const c = a.carro; setTimeout(() => c.remover(), 5000); this.ctx.inimigos.extras = []; }
    if (a.civil) { const civ = a.civil; setTimeout(() => cena.remove(civ), 4000); }
    if (!sucesso) this.ctx.inimigos.limparGrupo(a.id);
    this.ativo = null;
    this.alvoHud = null;
    this.sirene = null;
    this.tProxCrime = 30 + Math.random() * 25;
    this.ctx.hud.objetivo(null);
  }

  cancelarAtivo(avisar = true) {
    if (this.ativo) { if (avisar) this.falharCrime('Missão abandonada.'); else this.limparCrime(this.ativo, false); }
  }

  aoDerrotarInimigo(e, como) {
    this.inimigosDerrotados++;
    this.ganharXp(e.cfg.xp + (como === 'finalizacao' ? 15 : 0), como === 'teia' ? 'Preso na teia' : como === 'finalizacao' ? 'Finalização' : 'Bandido');
  }

  // ----------------------------------------------------------- laço
  atualizar(dt, tempo) {
    const jog = this.ctx.jogador;
    this.tempoJogo += dt;
    this.sirene = null;
    if (!this.desafio) this.alvoHud = null;

    // cristais
    this.atualizarCristais(tempo);
    for (const c of this.cristais) {
      if (c.pego) continue;
      if (Math.abs(c.p.x - jog.pos.x) < 3 && Math.abs(c.p.z - jog.pos.z) < 3 && Math.abs(c.p.y - (jog.pos.y + 1)) < 3) {
        c.pego = true;
        this.coletados.add(c.id);
        this.ctx.audio.tocar('coleta');
        this.ctx.efeitos.emitir(c.p, 30, { vel: 8, cor: '#ffd84a', tam: 0.5, vida: 0.7 });
        const n = this.qtdColetados;
        this.ctx.hud.banner('CRISTAL DE AURORA', `${n} de ${this.cristais.length}`, 'coleta', 1.8);
        this.ganharXp(n % 10 === 0 ? 300 : 40, 'Cristal');
        if (n === this.cristais.length) this.ctx.hud.banner('TODOS OS CRISTAIS!', 'Nova Aurora agradece, TEIA!', 'nivel', 5);
      }
    }

    if (this.desafio) this.atualizarDesafio(dt);
    else if (this.ativo) this.atualizarCrime(dt);
    else {
      this.tProxCrime -= dt;
      if (this.tProxCrime <= 0) this.sortearCrime();
      // perto de um farol de desafio: oferecer início
      for (const d of this.desafios) {
        if (jog.pos.distanceTo(d.inicio) < 7) {
          const rec = this.recordes[d.id];
          this.ctx.hud.dica(`${d.nome}: aperte E para começar${rec ? ` (recorde ${formatarTempo(rec)})` : ''}`, 0.2);
          if (this.ctx.entrada.apertou('interagir')) this.iniciarDesafio(d);
        }
      }
    }
    if (this.desafio) for (const d of this.desafios) d.farol.visible = false;
    else for (const d of this.desafios) d.farol.visible = true;
    if (Math.floor(this.tempoJogo) % 15 === 0 && Math.floor(this.tempoJogo - dt) % 15 !== 0) this.salvar();
  }

  // Marcadores para o minimapa / mapa
  marcadores() {
    const lista = [];
    for (const d of this.desafios) lista.push({ x: d.inicio.x, z: d.inicio.z, cor: '#33e1ff', tipo: 'desafio' });
    if (this.ativo) {
      const p = this.ativo.tipo === 'fuga' ? this.ativo.carro.pos : this.ativo.pos;
      lista.push({ x: p.x, z: p.z, cor: this.ativo.tipo === 'fuga' ? '#b44dff' : this.ativo.tipo === 'resgate' ? '#ff9a2e' : '#ff3344', tipo: 'crime' });
    }
    if (this.desafio) { const a = this.desafio.aneis[this.desafio.idx]; if (a) lista.push({ x: a.position.x, z: a.position.z, cor: '#ffe14a', tipo: 'anel' }); }
    return lista;
  }
}

export { N };
