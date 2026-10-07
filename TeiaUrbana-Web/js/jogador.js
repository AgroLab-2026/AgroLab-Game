// Controlador do herói: corrida/parkour, salto, balanço na teia com física de pêndulo,
// escalada de paredes, zip até bordas (lançamento), combate corpo a corpo, teia e esquiva.
import * as THREE from '../vendor/three.module.min.js';
import { criarHeroi } from './heroi.js';
import { Poses } from './modelo.js';
import { clamp, damp, dampAng, fatorDamp, lerp } from './util.js';

const V = () => new THREE.Vector3();
const CIMA = new THREE.Vector3(0, 1, 0);
const HW = 0.32;      // meia largura do corpo
const ALT = 1.75;     // altura do corpo
const G = 32;
const CORRER = 11;
const SPRINT = 21;

export class Jogador {
  constructor(ctx) {
    this.ctx = ctx;
    const { raiz, j, anim } = criarHeroi();
    this.modelo = raiz;
    this.j = j;
    this.anim = anim;
    this.pivo = new THREE.Group();
    this.pivo.add(raiz);
    raiz.position.y = -0.95;
    ctx.cena.add(this.pivo);

    this.pos = V();
    this.vel = V();
    this.estado = 'ar';
    this.facing = 0;
    this.hpMax = 100;
    this.hp = 100;
    this.foco = 0;
    this.focoMax = 3;
    this.dano = 1;
    this.contatos = { chao: false, parede: null, caixaChao: null };
    this.tmp = [];
    this.tempoNoAr = 0;
    this.desdeSoltar = 1;
    this.ladoTeia = 'D';
    this.fio = null;
    this.fio2 = null;
    this.ancora = V();
    this.comp = 20;
    this.tBalanco = 0;
    this.parede = null;
    this.fase = 0;
    this.acao = null;
    this.combo = 0;
    this.tCombo = 0;
    this.contadorCombo = 0;
    this.tFlip = -1;
    this.empoleirado = 0;
    this.janelaLanc = 0;
    this.lancarBuffer = 0;
    this.zipAlvo = null;
    this.alvoZipVisivel = null;
    this.cooldownTeia = 0;
    this.emCombate = false;
    this.lento = 0;
    this.qOri = new THREE.Quaternion();
    this.tempo = 0;
    this.velAntes = V();
    this.passoAnterior = 0;
    this.distPercorrida = 0;
    this.morto = false;
  }

  get invulneravel() { return (this.acao && (this.acao.tipo === 'esquiva' || this.acao.tipo === 'finalizar')) || this.estado === 'zip'; }

  posicionar(p, facing = 0) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.facing = facing;
    this.estado = 'ar';
    this.acao = null;
    this.soltarFios();
  }

  // ------------------------------------------------------------------ colisão
  moverEColidir(dt) {
    const ct = this.contatos;
    ct.chao = false; ct.parede = null; ct.caixaChao = null;
    const passos = Math.max(1, Math.ceil((this.vel.length() * dt) / 0.4));
    const h = dt / passos;
    for (let s = 0; s < passos; s++) {
      for (const eixo of ['x', 'z', 'y']) {
        const d = this.vel[eixo] * h;
        if (d === 0) continue;
        this.pos[eixo] += d;
        this.resolverEixo(eixo, d, ct);
      }
    }
    const cid = this.ctx.cidade;
    if (cid.dentroDaIlha(this.pos.x, this.pos.z) && this.pos.y < 0) {
      this.pos.y = 0;
      if (this.vel.y < 0) this.vel.y = 0;
      ct.chao = true;
    }
  }

  resolverEixo(eixo, d, ct) {
    const p = this.pos;
    const lista = this.ctx.cidade.consultar(p.x - HW, p.z - HW, p.x + HW, p.z + HW, this.tmp);
    for (const c of lista) {
      if (p.x + HW <= c.min.x || p.x - HW >= c.max.x || p.z + HW <= c.min.z || p.z - HW >= c.max.z) continue;
      if (p.y + ALT <= c.min.y || p.y >= c.max.y) continue;
      if (eixo === 'y') {
        if (d < 0) { p.y = c.max.y; if (this.vel.y < 0) this.vel.y = 0; ct.chao = true; ct.caixaChao = c; }
        else { p.y = c.min.y - ALT; if (this.vel.y > 0) this.vel.y = 0; }
      } else {
        const degrau = c.max.y - p.y;
        if (degrau > 0 && degrau <= 0.6 && this.estado !== 'parede') { p.y = c.max.y; ct.chao = true; ct.caixaChao = c; continue; }
        const n = V();
        if (eixo === 'x') {
          if (d > 0) { p.x = c.min.x - HW; n.set(-1, 0, 0); } else { p.x = c.max.x + HW; n.set(1, 0, 0); }
          this.vel.x = 0;
        } else {
          if (d > 0) { p.z = c.min.z - HW; n.set(0, 0, -1); } else { p.z = c.max.z + HW; n.set(0, 0, 1); }
          this.vel.z = 0;
        }
        if (!ct.parede || c.max.y - c.min.y > ct.parede.caixa.max.y - ct.parede.caixa.min.y) ct.parede = { n, caixa: c };
      }
    }
  }

  // ------------------------------------------------------------------ entrada → direção no mundo
  dirEntrada() {
    const [x, y] = this.ctx.entrada.mover();
    const cam = this.ctx.camJogo;
    const d = cam.frente().multiplyScalar(y).addScaledVector(cam.direita(), x);
    return d;
  }

  // ------------------------------------------------------------------ atualização
  atualizar(dt) {
    const e = this.ctx.entrada;
    this.tempo += dt;
    this.desdeSoltar += dt;
    this.cooldownTeia = Math.max(0, this.cooldownTeia - dt);
    this.tCombo = Math.max(0, this.tCombo - dt);
    if (this.tCombo <= 0) this.contadorCombo = 0;
    this.lancarBuffer = Math.max(0, this.lancarBuffer - dt);
    this.empoleirado = Math.max(0, this.empoleirado - dt);
    this.janelaLanc = Math.max(0, this.janelaLanc - dt);
    if (this.morto) { this.atualizarModelo(dt); return; }

    // Alvo de zip/lançamento (mostrado na mira)
    this.alvoZipVisivel = this.estado !== 'zip' && this.estado !== 'balanco' ? this.calcularAlvoZip() : null;

    // Ações de combate (podem ocorrer em qualquer estado exceto zip)
    if (this.estado !== 'zip') {
      if (e.apertou('esquivar')) this.esquivar();
      else if (e.apertou('finalizar')) this.finalizar();
      else if (e.apertou('curar')) this.curar();
      else if (e.apertou('atacar')) this.atacar();
      else if (e.apertou('teia')) this.atirarTeia();
    }
    if (e.apertou('zip') && this.alvoZipVisivel && (!this.acao || this.acao.tipo === 'golpe')) this.iniciarZip(this.alvoZipVisivel);

    this.velAntes.copy(this.vel);
    if (this.acao) this.atualizarAcao(dt);

    switch (this.estado) {
      case 'chao': this.atualizarChao(dt); break;
      case 'ar': this.atualizarAr(dt); break;
      case 'balanco': this.atualizarBalanco(dt); break;
      case 'parede': this.atualizarParede(dt); break;
      case 'zip': this.atualizarZip(dt); break;
      default: break;
    }

    // Caiu no mar: volta para um telhado
    if (this.pos.y < -1.6) {
      this.ctx.hud.aviso('Você caiu no rio! De volta à cidade.');
      this.ctx.respawnPerto(this.pos);
    }
    this.distPercorrida += this.vel.length() * dt;
    this.atualizarModelo(dt);
  }

  // ------------------------------------------------------------------ chão
  atualizarChao(dt) {
    const e = this.ctx.entrada;
    const inp = this.dirEntrada();
    const sprint = e.segurando('balancar');
    const travado = this.acao && ['golpe', 'finalizar', 'pouso', 'atingido', 'curar'].includes(this.acao.tipo);
    const vmax = travado ? 0 : (sprint ? SPRINT : CORRER);
    const alvoX = inp.x * vmax, alvoZ = inp.z * vmax;
    if (!this.acao || this.acao.tipo !== 'esquiva') {
      const k = fatorDamp(inp.lengthSq() > 0.01 ? 10 : 14, dt);
      this.vel.x += (alvoX - this.vel.x) * k;
      this.vel.z += (alvoZ - this.vel.z) * k;
    }
    this.vel.y -= G * dt;
    this.moverEColidir(dt);

    if (!this.contatos.chao) {
      // saiu da borda (ou foi lançado)
      this.estado = 'ar';
      this.tempoNoAr = 0;
    } else if (this.contatos.parede && sprint && inp.dot(this.contatos.parede.n) < -0.5) {
      this.entrarParede(this.contatos.parede, true);
      return;
    }

    if (e.apertou('pular') && !travado) {
      if (this.janelaLanc > 0) { this.lancamento(); return; }
      const hv = Math.hypot(this.vel.x, this.vel.z);
      this.vel.y = hv > 15 ? 15.5 : 13;
      this.estado = 'ar';
      this.tempoNoAr = 0;
      this.ctx.audio.tocar('passo', 2);
    }
    const hv = Math.hypot(this.vel.x, this.vel.z);
    if (hv > 0.6 && (!this.acao || this.acao.tipo !== 'golpe')) this.facing = dampAng(this.facing, Math.atan2(this.vel.x, this.vel.z), 14, dt);
    this.fase += hv * dt * (sprint ? 0.62 : 0.85);
    const passo = Math.floor(this.fase / Math.PI);
    if (passo !== this.passoAnterior && hv > 2) { this.passoAnterior = passo; this.ctx.audio.tocar('passo', sprint ? 1 : 0.6); }
  }

  // ------------------------------------------------------------------ ar
  atualizarAr(dt) {
    const e = this.ctx.entrada;
    this.tempoNoAr += dt;
    const inp = this.dirEntrada();
    // controle aéreo: empurra na direção desejada sem matar o impulso
    const acc = 16;
    this.vel.x += inp.x * acc * dt;
    this.vel.z += inp.z * acc * dt;
    const hv = Math.hypot(this.vel.x, this.vel.z);
    const limite = Math.max(SPRINT, hv);
    if (hv > limite) { this.vel.x *= limite / hv; this.vel.z *= limite / hv; }
    let g = G;
    if (this.acao && this.acao.tipo === 'golpe') { g = 6; this.vel.y = Math.max(this.vel.y, -3); }
    this.vel.y = Math.max(this.vel.y - g * dt, -70);
    const vt = this.vel.length();
    if (vt > 72) this.vel.multiplyScalar(72 / vt);
    this.moverEColidir(dt);

    if (this.contatos.parede) {
      const c = this.contatos.parede.caixa;
      const alto = c.max.y - this.pos.y > 2.2;
      const indo = this.velAntes.dot(this.contatos.parede.n) < -2 || inp.dot(this.contatos.parede.n) < -0.4;
      if (alto && indo && (!this.acao || this.acao.tipo !== 'golpe')) { this.entrarParede(this.contatos.parede, false); return; }
    }
    if (this.contatos.chao) { this.pousar(); return; }

    if (hv > 1) this.facing = dampAng(this.facing, Math.atan2(this.vel.x, this.vel.z), 6, dt);

    // Balançar: aperta (ou segura) o botão de teia no ar
    const quer = e.apertou('balancar') || (e.segurando('balancar') && this.desdeSoltar > 0.28 && this.vel.y < 6);
    if (quer && this.tempoNoAr > 0.08 && !(this.acao && this.acao.tipo !== 'esquiva')) this.iniciarBalanco();
  }

  pousar() {
    const vy = this.velAntes.y;
    this.estado = 'chao';
    this.soltarFios();
    if (vy < -30) {
      this.acao = { tipo: 'pouso', t: 0, dur: 0.42 };
      this.vel.x *= 0.2; this.vel.z *= 0.2;
      this.ctx.efeitos.poeira(this.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 26, 9);
      this.ctx.efeitos.onda(this.pos, 9, '#ffffff');
      this.ctx.camJogo.sacudir(0.6);
      this.ctx.audio.tocar('pouso');
      this.ctx.inimigos?.ondaDeChoque(this.pos, 5);
    } else if (vy < -12) {
      this.ctx.efeitos.poeira(this.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 8, 4);
      this.ctx.audio.tocar('pouso', 0.4);
    }
  }

  // ------------------------------------------------------------------ balanço
  acharAncora() {
    const cid = this.ctx.cidade;
    const inp = this.dirEntrada();
    const hv = V().set(this.vel.x, 0, this.vel.z);
    let dir;
    if (inp.lengthSq() > 0.05) dir = inp.clone().normalize().multiplyScalar(0.65).add(hv.lengthSq() > 9 ? hv.clone().normalize().multiplyScalar(0.35) : V());
    else if (hv.lengthSq() > 9) dir = hv.clone();
    else dir = this.ctx.camJogo.frente();
    dir.y = 0; dir.normalize();
    const lado = V().set(-dir.z, 0, dir.x);
    const p = this.pos;
    const desejado = p.clone().addScaledVector(dir, 24);
    desejado.y = p.y + 26;
    const lista = cid.consultar(desejado.x - 50, desejado.z - 50, desejado.x + 50, desejado.z + 50, []);
    let melhor = null, nota = Infinity;
    const q = V(), nFace = V();
    for (const c of lista) {
      if (c.tipo === 'calcada') continue;
      const yA = Math.min(c.max.y - 0.2, p.y + 34);
      if (yA < p.y + 7) continue;
      q.set(clamp(desejado.x, c.min.x, c.max.x), yA, clamp(desejado.z, c.min.z, c.max.z));
      const dentro = q.x > c.min.x && q.x < c.max.x && q.z > c.min.z && q.z < c.max.z;
      nFace.set(0, 0, 0);
      if (dentro) {
        // projeta na face voltada para o jogador
        let melhorFace = Infinity, escolha = null;
        const faces = [];
        if (p.x <= c.min.x) faces.push(['x', c.min.x, -1]);
        if (p.x >= c.max.x) faces.push(['x', c.max.x, 1]);
        if (p.z <= c.min.z) faces.push(['z', c.min.z, -1]);
        if (p.z >= c.max.z) faces.push(['z', c.max.z, 1]);
        if (!faces.length) continue;
        for (const f of faces) { const dd = Math.abs(q[f[0]] - f[1]); if (dd < melhorFace) { melhorFace = dd; escolha = f; } }
        q[escolha[0]] = escolha[1];
        nFace[escolha[0]] = escolha[2];
      } else {
        const ex = desejado.x - q.x, ez = desejado.z - q.z;
        if (Math.abs(ex) >= Math.abs(ez)) nFace.x = Math.sign(ex); else nFace.z = Math.sign(ez);
      }
      // a teia "pega" um pouco à frente da fachada: o arco não raspa na parede
      const anc = q.clone().addScaledVector(nFace, 2.5);
      const d = anc.distanceTo(p);
      if (d < 9 || d > 72) continue;
      const avanco = (anc.x - p.x) * dir.x + (anc.z - p.z) * dir.z;
      if (avanco < -4) continue;
      const lateral = Math.abs((anc.x - p.x) * lado.x + (anc.z - p.z) * lado.z);
      let s = anc.distanceTo(desejado) + Math.max(0, -avanco) * 3 + Math.max(0, 14 - (anc.y - p.y)) * 1.5;
      // fachada de frente para o jogador = prédio no caminho
      if (nFace.dot(dir) < -0.5) s += 18 + Math.max(0, 40 - avanco) * 0.6;
      // gosta de pontos ao lado da rua, nem colados nem longe demais
      if (lateral < 4) s += (4 - lateral) * 2; else if (lateral > 22) s += (lateral - 22) * 1.2;
      if (s < nota) { nota = s; melhor = anc; melhor.visual = q.clone(); }
    }
    return melhor;
  }

  iniciarBalanco() {
    const anc = this.acharAncora();
    if (!anc) {
      if (this.ctx.entrada.apertou('balancar')) this.ctx.hud.dica('Sem prédios por perto para prender a teia!');
      return false;
    }
    this.estado = 'balanco';
    this.ancora.copy(anc);
    this.ancoraVisual = anc.visual || anc.clone();
    const d = anc.distanceTo(this.pos);
    this.comp = d * 0.97;
    this.compMin = Math.max(10, d * 0.78);
    this.tBalanco = 0;
    this.ladoTeia = this.ladoTeia === 'D' ? 'E' : 'D';
    this.soltarFios();
    this.fio = this.ctx.efeitos.pegarFio();
    this.fio.reservado = true;
    this.ctx.audio.tocar('thwip');
    if (Math.random() < 0.25) this.ctx.efeitos.onoma('THWIP!', this.ancoraVisual, 'thwip', 0.8);
    // Pequeno empurrão para frente ao prender a teia
    const hv = V().set(this.vel.x, 0, this.vel.z);
    if (hv.length() < 10) {
      const f = anc.clone().sub(this.pos); f.y = 0; f.normalize();
      this.vel.addScaledVector(f, 6);
    }
    this.ctx.estatisticas.balancos++;
    return true;
  }

  atualizarBalanco(dt) {
    const e = this.ctx.entrada;
    this.tBalanco += dt;
    const inp = this.dirEntrada();
    const radial = this.pos.clone().sub(this.ancora);
    let L = radial.length();
    radial.divideScalar(L || 1);

    // Direção de controle tangente à corda
    const tang = inp.clone().addScaledVector(radial, -inp.dot(radial));
    this.vel.addScaledVector(tang, 20 * dt);
    // Mantém energia: pequeno impulso ao longo do movimento
    const sp = this.vel.length();
    if (sp > 1 && sp < 46) this.vel.addScaledVector(this.vel.clone().normalize(), 7 * dt);
    if (sp > 58) this.vel.multiplyScalar(58 / sp);
    this.vel.y -= G * dt;

    // Enrola a corda nos primeiros instantes (acelera o arco)
    if (this.tBalanco < 0.6) this.comp = Math.max(this.compMin, this.comp - 9 * dt);
    // Nunca deixa o arco raspar no chão
    const soloSob = Math.max(0, this.ctx.cidade.alturaSolo(this.pos.x, this.pos.z, this.pos.y));
    this.comp = Math.min(this.comp, this.ancora.y - soloSob - 2.6);

    this.moverEColidir(dt);
    const r2 = this.pos.clone().sub(this.ancora);
    L = r2.length();
    if (L > this.comp) {
      r2.divideScalar(L);
      this.pos.copy(this.ancora).addScaledVector(r2, this.comp);
      const vr = this.vel.dot(r2);
      if (vr > 0) this.vel.addScaledVector(r2, -vr);
    }

    // Visual do fio: sai da mão e estica em 0,1 s
    const mao = this.maoMundo(this.ladoTeia);
    this.fio.definir(mao, this.ancoraVisual, Math.min(1, this.tBalanco / 0.09), Math.max(0, 0.25 - this.tBalanco) * 1.2, 0.03);

    if (this.contatos.parede && this.contatos.parede.caixa.max.y - this.pos.y > 2.2) { this.entrarParede(this.contatos.parede, false); return; }
    if (this.contatos.chao) { this.pousar(); return; }
    if (e.apertou('pular')) { this.soltar(true); return; }
    if (!e.segurando('balancar')) { this.soltar(false); return; }
    // Passou do ponto alto do arco: solta sozinho para manter o fluxo
    if (this.pos.y > this.ancora.y - 4 || this.tBalanco > 4.5) { this.soltar(false); return; }
    const hv = Math.hypot(this.vel.x, this.vel.z);
    if (hv > 1) this.facing = Math.atan2(this.vel.x, this.vel.z);
  }

  soltar(impulso) {
    this.estado = 'ar';
    this.tempoNoAr = 0.2;
    this.desdeSoltar = 0;
    this.soltarFios();
    const hv = V().set(this.vel.x, 0, this.vel.z);
    const f = hv.lengthSq() > 1 ? hv.normalize() : this.ctx.camJogo.frente();
    if (impulso) {
      this.vel.y = Math.max(this.vel.y, 0) + 12;
      this.vel.addScaledVector(f, 6);
      this.tFlip = 0;
      this.ctx.audio.tocar('lancar', 0.7);
    } else if (this.vel.y > -2) {
      this.vel.y += 3;
      this.vel.addScaledVector(f, 2);
    }
    this.ctx.audio.tocar('soltar');
  }

  soltarFios() {
    if (this.fio) { this.fio.ativo = false; this.fio.reservado = false; this.fio = null; }
    if (this.fio2) { this.fio2.ativo = false; this.fio2.reservado = false; this.fio2 = null; }
  }

  maoMundo(lado) {
    this.pivo.updateMatrixWorld(true);
    return new THREE.Vector3(0, -0.06, 0).applyMatrix4(this.j['mao' + lado].matrixWorld);
  }

  // ------------------------------------------------------------------ parede
  entrarParede(contato, correndo) {
    this.estado = 'parede';
    this.soltarFios();
    this.parede = { n: contato.n.clone(), caixa: contato.caixa };
    const hv = Math.hypot(this.velAntes.x, this.velAntes.z);
    // Converte o impulso em corrida parede acima
    this.impulsoParede = Math.min(26, Math.max(correndo ? 14 : 0, hv * 0.75 + Math.max(0, this.velAntes.y) * 0.5));
    this.vel.set(0, 0, 0);
    this.ctx.audio.tocar('passo', 1.5);
  }

  atualizarParede(dt) {
    const e = this.ctx.entrada;
    const { n } = this.parede;
    let c = this.parede.caixa;
    const t = V().set(-n.z, 0, n.x);
    const inp = this.dirEntrada();
    let sobe = inp.dot(n) * -1;
    let lado = inp.dot(t);
    if (inp.lengthSq() < 0.01) { sobe = 0; lado = 0; }
    // olhando para cima com W, sobe mesmo se a câmera estiver de lado
    const rapido = e.segurando('balancar');
    const vs = rapido ? 17 : 8.5;
    this.impulsoParede = Math.max(0, this.impulsoParede - 22 * dt);
    const alvoY = Math.max(sobe * vs, this.impulsoParede);
    const alvoT = lado * vs;
    const k = fatorDamp(12, dt);
    this.vel.y += (alvoY - this.vel.y) * k;
    const vt = this.vel.dot(t);
    const novoVt = vt + (alvoT - vt) * k;
    this.vel.set(t.x * novoVt, this.vel.y, t.z * novoVt);
    this.pos.addScaledVector(this.vel, dt);
    // Gruda na face
    if (n.x > 0.5) this.pos.x = c.max.x + HW; else if (n.x < -0.5) this.pos.x = c.min.x - HW;
    else if (n.z > 0.5) this.pos.z = c.max.z + HW; else this.pos.z = c.min.z - HW;

    // Saiu da borda lateral? procura uma caixa vizinha; senão, solta.
    const ax = Math.abs(t.x) > 0.5 ? 'x' : 'z';
    if (this.pos[ax] < c.min[ax] - 0.1 || this.pos[ax] > c.max[ax] + 0.1) {
      const sonda = this.pos.clone().addScaledVector(n, -0.6);
      const viz = this.ctx.cidade.consultar(sonda.x - 0.05, sonda.z - 0.05, sonda.x + 0.05, sonda.z + 0.05, []).find((b) => b.tipo !== 'calcada' && b.max.y > this.pos.y + 1 && b.min.y <= this.pos.y + 0.5);
      if (viz) { this.parede.caixa = viz; c = viz; } else { this.estado = 'ar'; this.tempoNoAr = 0; this.vel.addScaledVector(n, 2); return; }
    }
    // Chegou no topo: salta por cima da borda
    if (this.pos.y + 1.3 > c.max.y) {
      this.estado = 'ar';
      this.tempoNoAr = 0;
      this.pos.y = Math.max(this.pos.y, c.max.y - 1.2);
      this.vel.set(-n.x * 5.5, Math.max(9, this.vel.y * 0.5), -n.z * 5.5);
      if (this.vel.y > 14) this.tFlip = 0;
      this.ctx.audio.tocar('passo', 2);
      return;
    }
    // Desceu até o chão
    const solo = this.ctx.cidade.alturaSolo(this.pos.x + n.x * 0.5, this.pos.z + n.z * 0.5, this.pos.y);
    if (this.pos.y <= solo + 0.02 && this.vel.y <= 0) {
      this.pos.y = solo;
      this.estado = 'chao';
      this.pos.addScaledVector(n, 0.05);
      return;
    }
    if (this.pos.y < solo) this.pos.y = solo;
    if (e.apertou('pular')) {
      const f = this.ctx.camJogo.frente();
      this.vel.copy(n).multiplyScalar(11).addScaledVector(f, 5);
      this.vel.y = 10;
      this.estado = 'ar';
      this.tempoNoAr = 0.1;
      this.tFlip = 0;
      this.ctx.audio.tocar('lancar', 0.5);
      return;
    }
    if (e.apertou('balancar')) {
      this.vel.copy(n).multiplyScalar(9);
      this.vel.y = 6;
      this.estado = 'ar';
      this.tempoNoAr = 0.1;
      this.iniciarBalanco();
      return;
    }
    this.fase += (Math.abs(this.vel.y) + Math.abs(novoVt)) * dt * 1.2;
  }

  // ------------------------------------------------------------------ zip / lançamento
  calcularAlvoZip() {
    const cam = this.ctx.camJogo.cam;
    const dir = V();
    cam.getWorldDirection(dir);
    const hit = this.ctx.cidade.raycast(cam.position, dir, 160, true);
    if (!hit || !hit.caixa) return null;
    const c = hit.caixa;
    let p;
    if (hit.normal.y > 0.5) p = hit.ponto.clone();
    else {
      p = hit.ponto.clone().addScaledVector(hit.normal, -0.45);
      p.y = c.max.y;
    }
    // Se houver outro bloco por cima do ponto (andar recuado, caixa d'água), sobe até o topo dele
    for (let k = 0; k < 4; k++) {
      const em = this.ctx.cidade.consultar(p.x - 0.01, p.z - 0.01, p.x + 0.01, p.z + 0.01, []).find((b) =>
        p.x > b.min.x && p.x < b.max.x && p.z > b.min.z && p.z < b.max.z && b.min.y <= p.y + 0.1 && b.max.y > p.y + 0.01);
      if (!em) break;
      p.y = em.max.y;
    }
    if (p.distanceTo(this.pos) > 110 || p.distanceTo(this.pos) < 4) return null;
    p.normalBorda = hit.normal.y > 0.5 ? null : hit.normal.clone();
    return p;
  }

  iniciarZip(alvo) {
    this.estado = 'zip';
    this.zipAlvo = alvo.clone();
    this.tZip = 0;
    this.acao = null;
    this.soltarFios();
    this.fio = this.ctx.efeitos.pegarFio(); this.fio.reservado = true;
    this.fio2 = this.ctx.efeitos.pegarFio(); this.fio2.reservado = true;
    this.ctx.audio.tocar('thwip');
    this.ctx.audio.tocar('thwip', 0.6);
    this.lancarBuffer = 0;
  }

  atualizarZip(dt) {
    this.tZip += dt;
    const dir = this.zipAlvo.clone().add(new THREE.Vector3(0, 0.05, 0)).sub(this.pos);
    const d = dir.length();
    dir.divideScalar(d || 1);
    const vel = Math.min(62, 18 + this.tZip * 110);
    this.vel.copy(dir).multiplyScalar(vel);
    this.facing = Math.atan2(dir.x, dir.z);
    if (this.ctx.entrada.apertou('pular')) this.lancarBuffer = 0.4;
    for (const [fio, lado] of [[this.fio, 'E'], [this.fio2, 'D']]) {
      if (fio) fio.definir(this.maoMundo(lado), this.zipAlvo, Math.min(1, this.tZip / 0.08), 0, 0.028);
    }
    if (d <= vel * dt + 0.3 || this.tZip > 4) {
      this.pos.copy(this.zipAlvo);
      this.soltarFios();
      this.estado = 'chao';
      this.vel.set(0, 0, 0);
      this.empoleirado = 2.5;
      this.janelaLanc = 0.45;
      this.ctx.audio.tocar('pouso', 0.35);
      if (this.lancarBuffer > 0) this.lancamento();
      return;
    }
    this.pos.addScaledVector(this.vel, dt);
  }

  lancamento() {
    const f = this.ctx.camJogo.frente();
    this.vel.copy(f).multiplyScalar(24);
    this.vel.y = 22;
    this.estado = 'ar';
    this.tempoNoAr = 0.1;
    this.tFlip = 0;
    this.janelaLanc = 0;
    this.empoleirado = 0;
    this.ctx.audio.tocar('lancar');
    this.ctx.efeitos.onda(this.pos, 4, '#bff4ff', 0.3);
    this.ctx.efeitos.onoma('ZOOM!', this.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 'zoom', 0.9);
  }

  // ------------------------------------------------------------------ combate
  atacar() {
    if (this.acao && ['golpe', 'finalizar', 'pouso', 'curar'].includes(this.acao.tipo) && this.acao.t < this.acao.dur * 0.6) {
      this.acao.fila = true;
      return;
    }
    if (this.estado === 'balanco') this.soltar(false);
    if (this.estado === 'parede') { this.estado = 'ar'; this.vel.copy(this.parede.n).multiplyScalar(4); }
    const ini = this.ctx.inimigos;
    const dir = this.dirEntrada();
    if (dir.lengthSq() < 0.01) dir.copy(this.ctx.camJogo.frente());
    const alvo = ini ? ini.alvoAtaque(this.pos, dir, 14) : null;
    this.combo = this.tCombo > 0 ? (this.combo + 1) % 4 : 0;
    this.tCombo = 0.9;
    if (alvo && alvo.pos.distanceTo(this.pos) > 2.4) {
      this.acao = { tipo: 'investida', t: 0, dur: 0.45, alvo };
      this.ctx.audio.tocar('esquiva', 0.5);
    } else {
      this.acao = { tipo: 'golpe', t: 0, dur: this.combo === 3 ? 0.42 : 0.3, alvo, golpe: this.combo, acertou: false };
    }
  }

  esquivar() {
    if (this.estado === 'balanco') { this.soltar(false); }
    if (this.estado === 'parede' || this.estado === 'zip') return;
    let dir = this.dirEntrada();
    if (dir.lengthSq() < 0.01) dir = this.ctx.camJogo.frente().multiplyScalar(-1);
    dir.normalize();
    this.acao = { tipo: 'esquiva', t: 0, dur: 0.38, dir };
    this.vel.x = dir.x * 15; this.vel.z = dir.z * 15;
    if (this.estado === 'chao') this.vel.y = 4;
    this.ctx.audio.tocar('esquiva');
    this.tFlip = -1;
  }

  // Chamado pelos inimigos quando um ataque chega
  tentarAcertar(dano, origem, tipo = 'soco') {
    if (this.morto) return 'nada';
    if (this.acao && this.acao.tipo === 'esquiva') {
      if (this.acao.t < 0.24) { this.ctx.aoEsquivaPerfeita(origem); return 'perfeita'; }
      return 'esquivou';
    }
    if (this.invulneravel) return 'esquivou';
    this.hp -= dano;
    this.ctx.estatisticas.danoRecebido += dano;
    this.ctx.camJogo.sacudir(0.45);
    this.ctx.audio.tocar('dano');
    this.ctx.hud.levouDano();
    this.contadorCombo = 0;
    const emp = this.pos.clone().sub(origem); emp.y = 0; emp.normalize();
    if (tipo !== 'tiro') { this.vel.x = emp.x * 9; this.vel.z = emp.z * 9; this.vel.y = 4; this.estado = 'ar'; }
    this.acao = { tipo: 'atingido', t: 0, dur: 0.4 };
    if (this.estado === 'balanco') this.soltar(false);
    if (this.hp <= 0) { this.hp = 0; this.ctx.aoMorrer(); }
    return 'acertou';
  }

  atirarTeia() {
    if (this.cooldownTeia > 0) return;
    this.cooldownTeia = 0.3;
    const cam = this.ctx.camJogo;
    const dirOlhar = V(); cam.cam.getWorldDirection(dirOlhar);
    const alvo = this.ctx.inimigos?.alvoTeia(this.pos, cam.cam.position, dirOlhar, 32);
    let ponto;
    if (alvo) ponto = alvo.centro();
    else {
      const hit = this.ctx.cidade.raycast(cam.cam.position, dirOlhar, 60, true);
      ponto = hit ? hit.ponto : cam.cam.position.clone().addScaledVector(dirOlhar, 40);
    }
    const lado = this.ladoTeia = this.ladoTeia === 'D' ? 'E' : 'D';
    const fio = this.ctx.efeitos.pegarFio();
    fio.reservado = true;
    this.acao = this.acao && this.acao.tipo === 'golpe' ? this.acao : { tipo: 'teia', t: 0, dur: 0.28, lado, ponto, alvo, fio, acertou: false };
    if (this.acao.tipo !== 'teia') { fio.reservado = false; return; }
    this.ctx.audio.tocar('thwip', 0.8);
    if (this.estado === 'ar') this.vel.y = Math.max(this.vel.y, 1);
  }

  finalizar() {
    if (this.foco < 1) { this.ctx.hud.dica('Encha a barra de FOCO acertando golpes para usar a finalização (F).'); return; }
    const alvo = this.ctx.inimigos?.alvoAtaque(this.pos, this.ctx.camJogo.frente(), 10, true);
    if (!alvo) { this.ctx.hud.dica('Chegue perto de um inimigo para finalizar.'); return; }
    this.foco -= 1;
    this.acao = { tipo: 'finalizar', t: 0, dur: 0.75, alvo, acertou: false };
    this.ctx.lento(0.7, 0.25);
    this.ctx.camJogo.cinematico = 0.8;
    this.ctx.camJogo.focoCine.copy(alvo.pos);
    this.ctx.audio.tocar('lancar');
  }

  curar() {
    if (this.foco < 1 || this.hp >= this.hpMax) { if (this.hp < this.hpMax) this.ctx.hud.dica('Precisa de 1 barra de FOCO para se curar (R).'); return; }
    this.foco -= 1;
    this.hp = Math.min(this.hpMax, this.hp + 45);
    this.acao = { tipo: 'curar', t: 0, dur: 0.5 };
    this.ctx.efeitos.emitir(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 30, { vel: 4, cor: '#7dffb0', tam: 0.4, vida: 0.8, grav: -6 });
    this.ctx.audio.tocar('coleta', 0.6);
  }

  ganharFoco(q) { this.foco = Math.min(this.focoMax, this.foco + q); }

  atualizarAcao(dt) {
    const a = this.acao;
    a.t += dt;
    const ini = this.ctx.inimigos;
    if (a.tipo === 'investida') {
      const alvo = a.alvo;
      if (!alvo || !alvo.vivo) { this.acao = null; return; }
      const d = alvo.pos.clone().sub(this.pos); d.y = 0;
      const dist = d.length();
      d.normalize();
      this.facing = Math.atan2(d.x, d.z);
      this.vel.x = d.x * 26; this.vel.z = d.z * 26;
      if (this.estado === 'ar') this.vel.y = (alvo.pos.y + 0.2 - this.pos.y) * 6;
      if (dist < 1.9 || a.t > a.dur) {
        this.vel.x = this.vel.z = 0;
        this.acao = { tipo: 'golpe', t: 0, dur: this.combo === 3 ? 0.42 : 0.3, alvo, golpe: this.combo, acertou: false };
      }
      return;
    }
    if (a.tipo === 'golpe') {
      if (a.alvo && a.alvo.vivo) {
        const d = a.alvo.pos.clone().sub(this.pos);
        this.facing = dampAng(this.facing, Math.atan2(d.x, d.z), 25, dt);
      }
      if (!a.acertou && a.t > a.dur * 0.35) {
        a.acertou = true;
        const frente = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
        const ponto = this.pos.clone().addScaledVector(frente, 1.1).add(new THREE.Vector3(0, 1.2, 0));
        const acertos = ini ? ini.golpeEmArea(ponto, 1.9, this.dano * (a.golpe === 3 ? 2 : 1), a.golpe === 3 ? 'lancar' : 'soco', frente, a.alvo) : 0;
        if (acertos > 0) {
          this.contadorCombo += acertos;
          this.tCombo = 1.6;
          this.ganharFoco(0.11 * acertos);
          this.ctx.audio.tocar(a.golpe === 2 ? 'chute' : 'soco');
          this.ctx.efeitos.faiscas(ponto);
          const txt = ['POW!', 'BAM!', 'WHAM!', 'KAPOW!'][a.golpe];
          if (a.golpe === 3 || Math.random() < 0.45) this.ctx.efeitos.onoma(txt, ponto, 'pow', a.golpe === 3 ? 1.3 : 0.9);
          this.ctx.camJogo.sacudir(a.golpe === 3 ? 0.35 : 0.15);
          this.ctx.parada(a.golpe === 3 ? 0.08 : 0.04);
        } else this.ctx.audio.tocar('esquiva', 0.25);
      }
      if (a.t >= a.dur) {
        const fila = a.fila;
        this.acao = null;
        if (fila) this.atacar();
      }
      return;
    }
    if (a.tipo === 'teia') {
      const mao = this.maoMundo(a.lado);
      const destino = a.alvo && a.alvo.vivo ? a.alvo.centro() : a.ponto;
      const ext = Math.min(1, a.t / 0.12);
      a.fio.definir(mao, destino, ext, 0.15 * (1 - ext), 0.025);
      if (ext >= 1 && !a.acertou) {
        a.acertou = true;
        if (a.alvo && a.alvo.vivo) {
          ini.acertarTeia(a.alvo, this.pos);
          this.ganharFoco(0.06);
          this.ctx.audio.tocar('teiaAcerta');
          this.ctx.efeitos.emitir(destino, 12, { vel: 4, cor: '#ffffff', tam: 0.5, vida: 0.4 });
        } else {
          this.ctx.efeitos.emitir(destino, 6, { vel: 2, cor: '#ffffff', tam: 0.6, vida: 0.5 });
          this.ctx.aoTeiaNoPonto?.(destino);
        }
      }
      if (a.t >= a.dur) { a.fio.ativo = false; a.fio.reservado = false; this.acao = null; }
      return;
    }
    if (a.tipo === 'finalizar') {
      const alvo = a.alvo;
      if (alvo && alvo.vivo && a.t < 0.25) {
        const d = alvo.pos.clone().sub(this.pos); d.y = 0;
        const dist = d.length(); d.normalize();
        this.facing = Math.atan2(d.x, d.z);
        if (dist > 1.6) this.pos.addScaledVector(d, Math.min(dist - 1.5, 30 * dt));
      }
      if (!a.acertou && a.t > 0.3) {
        a.acertou = true;
        if (alvo && alvo.vivo) ini.finalizar(alvo, this.pos);
        this.ctx.efeitos.onoma('KRAK!', alvo.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), 'krak', 1.6);
        this.ctx.efeitos.onda(alvo.pos, 7, '#ffd23d', 0.5);
        this.ctx.efeitos.faiscas(alvo.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), '#ffd23d');
        this.ctx.camJogo.sacudir(0.7);
        this.ctx.audio.tocar('finalizar');
        this.ctx.parada(0.12);
      }
      if (a.t >= a.dur) this.acao = null;
      return;
    }
    if (a.tipo === 'esquiva') {
      const k = 1 - a.t / a.dur;
      this.vel.x = a.dir.x * 15 * k; this.vel.z = a.dir.z * 15 * k;
    }
    if (a.t >= a.dur) this.acao = null;
  }

  // ------------------------------------------------------------------ visual
  atualizarModelo(dt) {
    const an = this.anim;
    an.zerar();
    const a = this.acao;
    const est = this.estado;
    const hv = Math.hypot(this.vel.x, this.vel.z);
    let velAnim = 16;

    if (this.morto) Poses.caido(an);
    else if (a && a.tipo === 'golpe') { Poses.soco(an, a.golpe, a.t / a.dur); velAnim = 30; }
    else if (a && a.tipo === 'investida') { Poses.zip(an); an.set('coxaE', -0.9); an.set('joelhoE', 1.4); }
    else if (a && a.tipo === 'finalizar') { Poses.soco(an, a.t < 0.3 ? 3 : 2, (a.t % 0.3) / 0.3); velAnim = 30; }
    else if (a && a.tipo === 'atingido') Poses.atingido(an, a.t / a.dur);
    else if (a && a.tipo === 'esquiva') Poses.salto(an, 1);
    else if (a && a.tipo === 'pouso') Poses.pouso(an);
    else if (a && a.tipo === 'curar') Poses.agachado(an, this.tempo);
    else if (est === 'chao') {
      if (hv < 0.6) { if (this.empoleirado > 0) Poses.agachado(an, this.tempo); else Poses.parado(an, this.tempo); }
      else Poses.correr(an, this.fase, Math.min(1, hv / CORRER), clamp((hv - CORRER) / (SPRINT - CORRER), 0, 1));
      velAnim = 14;
    } else if (est === 'ar') {
      if (this.vel.y > 3 || this.tFlip >= 0) Poses.salto(an, this.vel.y);
      else if (this.vel.y < -24) Poses.mergulho(an, this.tempo);
      else Poses.queda(an, this.tempo);
      velAnim = 8;
    } else if (est === 'balanco') {
      const r = this.pos.clone().sub(this.ancora);
      const f = new THREE.Vector3(this.vel.x, 0, this.vel.z).normalize();
      const fase = clamp(r.dot(f) / Math.max(1, this.comp), -1, 1);
      Poses.balanco(an, fase, this.ladoTeia);
      velAnim = 10;
    } else if (est === 'parede') {
      Poses.parede(an, this.fase, clamp(this.vel.length() / 6, 0, 1));
    } else if (est === 'zip') Poses.zip(an);

    an.aplicar(dt, velAnim);
    const alvos = { E: null, D: null };
    if (!this.morto) {
      if (est === 'balanco') alvos[this.ladoTeia] = this.ancoraVisual;
      if (est === 'zip') { alvos.E = this.zipAlvo; alvos.D = this.zipAlvo; }
      if (a && a.tipo === 'teia') alvos[a.lado] = a.alvo && a.alvo.vivo ? a.alvo.centro() : a.ponto;
    }
    for (const lado of ['E', 'D']) {
      if (alvos[lado]) an.apontarBraco(lado, alvos[lado], 1, dt, this.pivo);
      else an.soltarBraco(lado, dt);
    }

    // Orientação do corpo
    const q = new THREE.Quaternion();
    const m = new THREE.Matrix4();
    const frente = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    let up = CIMA.clone();
    let fwd = frente.clone();
    if (est === 'balanco') {
      up = this.ancora.clone().sub(this.pos).normalize();
      const v = this.vel.clone();
      fwd = v.addScaledVector(up, -v.dot(up));
      if (fwd.lengthSq() < 1e-3) fwd = frente.clone();
      fwd.normalize();
    } else if (est === 'parede') {
      const n = this.parede.n;
      fwd = n.clone().negate();
      const mv = this.vel.clone().addScaledVector(n, -this.vel.dot(n));
      up = mv.lengthSq() > 4 ? mv.normalize() : CIMA.clone();
      if (up.y < -0.3) up = CIMA.clone();
    } else if (est === 'ar' && !(a && a.tipo === 'esquiva')) {
      const inclin = clamp(-this.vel.y / 40, -0.25, 1.1);
      fwd = frente.clone().multiplyScalar(Math.cos(inclin)).add(new THREE.Vector3(0, -Math.sin(inclin), 0));
      up = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3().crossVectors(CIMA, fwd)).normalize();
      if (this.vel.y < -24) { // mergulho: cabeça para baixo
        const k = clamp((-this.vel.y - 24) / 20, 0, 1);
        const mergulho = new THREE.Vector3(0, -1, 0).lerp(frente, 0.35).normalize();
        up = up.lerp(mergulho, k).normalize();
        fwd = new THREE.Vector3().crossVectors(new THREE.Vector3().crossVectors(up, frente), up).normalize();
        if (fwd.lengthSq() < 0.5) fwd = frente.clone();
      }
    } else if (est === 'zip') {
      fwd = this.zipAlvo.clone().sub(this.pos).normalize();
      up = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3().crossVectors(CIMA, fwd)).normalize();
      if (up.lengthSq() < 0.5) up = CIMA.clone();
    }
    const x = new THREE.Vector3().crossVectors(up, fwd).normalize();
    fwd = new THREE.Vector3().crossVectors(x, up).normalize();
    m.makeBasis(x, up, fwd);
    q.setFromRotationMatrix(m);

    // Mortal (flip) e rolamento
    if (this.tFlip >= 0) {
      this.tFlip += dt;
      const k = clamp(this.tFlip / 0.62, 0, 1);
      const giro = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (1 - Math.pow(1 - k, 3)) * Math.PI * 2);
      q.multiply(giro);
      if (k >= 1) this.tFlip = -1;
    }
    if (a && a.tipo === 'esquiva') {
      const k = a.t / a.dur;
      const local = new THREE.Vector3(a.dir.x, 0, a.dir.z);
      const eixo = new THREE.Vector3().crossVectors(CIMA, local).normalize();
      if (eixo.lengthSq() > 0.5) {
        q.premultiply(new THREE.Quaternion().setFromAxisAngle(eixo, k * Math.PI * 2));
      }
    }
    const veloc = est === 'balanco' || est === 'parede' ? 12 : 16;
    this.qOri.slerp(q, fatorDamp(veloc, dt));
    if (a && a.tipo === 'esquiva') this.qOri.copy(q);
    this.pivo.quaternion.copy(this.qOri);
    const centro = this.pos.clone();
    if (est === 'parede') centro.y += 0.9; else centro.y += 0.95;
    this.pivo.position.copy(centro);
  }

  centro() { return this.pos.clone().add(new THREE.Vector3(0, 1.1, 0)); }
}

export { lerp, damp };
