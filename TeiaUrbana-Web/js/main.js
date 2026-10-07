// TEIA URBANA — ponto de entrada: monta o mundo, liga os sistemas e roda o laço principal.
import * as THREE from '../vendor/three.module.min.js';
import { Cidade } from './cidade.js';
import { Ambiente } from './ambiente.js';
import { PosProcesso } from './pos.js';
import { Entrada } from './entrada.js';
import { Audio } from './audio.js';
import { Efeitos } from './efeitos.js';
import { CameraJogo } from './camera.js';
import { Jogador } from './jogador.js';
import { Inimigos } from './inimigos.js';
import { Trafego } from './trafego.js';
import { Missoes } from './missoes.js';
import { Hud } from './hud.js';
import { clamp, damp } from './util.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const MODO_TESTE = params.has('teste');

function mostrarErro(e) {
  const el = $('#erro');
  el.style.display = 'block';
  el.textContent = `Ops! Algo deu errado:\n${e && e.stack ? e.stack : e}`;
  console.error(e);
}
addEventListener('error', (e) => mostrarErro(e.error || e.message));

// ------------------------------------------------------------------ configurações
const CONFIG_CHAVE = 'teiaUrbana.config.v1';
const config = { qualidade: 'media', sensibilidade: 1, inverterY: false, musica: 0.55, efeitos: 0.9 };
try { Object.assign(config, JSON.parse(localStorage.getItem(CONFIG_CHAVE) || '{}')); } catch { /* sem armazenamento */ }
const salvarConfig = () => { try { localStorage.setItem(CONFIG_CHAVE, JSON.stringify(config)); } catch { /* nada */ } };

// ------------------------------------------------------------------ renderer e mundo
const canvas = $('#jogo');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  $('#carregando').innerHTML = '<p>Seu navegador não conseguiu iniciar o WebGL.<br>Atualize o navegador ou ative a aceleração por hardware.</p>';
  throw e;
}
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;

const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.3, 4000);
const uniformsCidade = { uNoite: { value: 0 }, uCeuH: { value: new THREE.Color() }, uCeuT: { value: new THREE.Color() }, uTempo: { value: 0 } };

const cidade = new Cidade(cena, uniformsCidade);
const ambiente = new Ambiente(cena, uniformsCidade);
if (params.has('hora')) ambiente.hora = Number(params.get('hora'));
const pos = new PosProcesso(renderer);
const entrada = new Entrada(canvas);
const audio = new Audio();

const ctx = {
  cena, camera, cidade, entrada, audio, ambiente,
  estatisticas: { balancos: 0, danoRecebido: 0 },
  escalaTempo: 1, lentoT: 0, paradaT: 0,
};
window.jogo = ctx;
ctx.efeitos = new Efeitos(cena, camera, $('#onomas'));
ctx.camJogo = new CameraJogo(camera, cidade);
ctx.hud = new Hud(ctx);
ctx.jogador = new Jogador(ctx);
ctx.inimigos = new Inimigos(ctx);
ctx.trafego = new Trafego(cena);
ctx.missoes = new Missoes(ctx);
ctx.missoes.aplicarNivel(false);
ctx.jogador.hp = ctx.jogador.hpMax;

const jog = ctx.jogador;

// ------------------------------------------------------------------ callbacks de jogo
ctx.lento = (dur, escala) => { ctx.lentoT = Math.max(ctx.lentoT, dur); ctx.lentoEscala = escala; };
ctx.parada = (seg) => { ctx.paradaT = Math.max(ctx.paradaT, seg); };
ctx.aoDerrotarInimigo = (e, como) => ctx.missoes.aoDerrotarInimigo(e, como);
ctx.aoEsquivaPerfeita = (origem) => {
  ctx.lento(0.9, 0.3);
  ctx.audio.tocar('lento');
  ctx.efeitos.onoma('ESQUIVA!', jog.centro().add(new THREE.Vector3(0, 0.8, 0)), 'zoom', 1);
  jog.ganharFoco(0.25);
  tutorial('esquiva');
};

function melhorTelhado(perto, yMin = 30, yMax = 90) {
  let melhor = null, d = Infinity;
  for (const t of cidade.telhados) {
    if (t.torre || t.y < yMin || t.y > yMax || t.x1 - t.x0 < 8 || t.z1 - t.z0 < 8) continue;
    const dd = Math.hypot(t.x - perto.x, t.z - perto.z);
    if (dd < d) { d = dd; melhor = t; }
  }
  return melhor || cidade.telhados[0];
}

ctx.respawnPerto = (p) => {
  const alvo = new THREE.Vector3(THREE.MathUtils.clamp(p.x, -380, 380), 0, THREE.MathUtils.clamp(p.z, -380, 380));
  const t = melhorTelhado(alvo, 20, 120);
  jog.posicionar(new THREE.Vector3(t.x, t.y + 0.5, t.z), jog.facing);
};

ctx.aoMorrer = () => {
  if (jog.morto) return;
  jog.morto = true;
  jog.soltarFios();
  ctx.hud.banner('NOCAUTE!', 'TEIA vai se recuperar num telhado próximo...', 'falha', 2.5);
  ctx.audio.tocar('falha');
  ctx.lento(1.2, 0.35);
  setTimeout(() => {
    ctx.missoes.cancelarAtivo(false);
    for (const e of [...ctx.inimigos.lista]) e.remover();
    ctx.inimigos.lista.length = 0;
    ctx.inimigos.fichas = 0;
    jog.morto = false;
    jog.hp = jog.hpMax;
    jog.foco = 0;
    ctx.respawnPerto(jog.pos);
  }, 2600);
};

// ------------------------------------------------------------------ tutorial
const feitos = new Set();
function tutorial(evento) {
  if (feitos.has(evento)) return;
  feitos.add(evento);
  const h = ctx.hud;
  const msgs = {
    inicio: 'Pule do prédio com ESPAÇO e SEGURE SHIFT no ar para balançar na teia. W/A/S/D direcionam.',
    balanco: 'Solte SHIFT para largar a teia. ESPAÇO durante o balanço = salto com impulso!',
    balancos: 'Mire numa borda (losango ciano na tela) e aperte Q para o ZIP. ESPAÇO ao chegar = LANÇAMENTO.',
    zip: 'Corra contra uma parede segurando SHIFT para escalar. M abre o mapa da cidade.',
    combate: 'Clique = soco (combo de 4) · Botão direito = teia · C = esquiva no (!) · F = finalização · R = cura',
    esquiva: 'Esquiva perfeita! Desviar no último instante deixa o tempo lento e enche o FOCO.',
  };
  if (msgs[evento]) h.dica(msgs[evento], 7);
}

// ------------------------------------------------------------------ qualidade
function aplicarQualidade() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const q = config.qualidade;
  const pr = q === 'baixa' ? Math.min(dpr, 1) * 0.7 : q === 'media' ? Math.min(dpr, 1.25) : Math.min(dpr, 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  pos.redimensionar(innerWidth, innerHeight, pr);
  const tam = q === 'baixa' ? 1024 : q === 'media' ? 2048 : 4096;
  const sol = ambiente.sol;
  if (sol.shadow.mapSize.x !== tam) {
    sol.shadow.mapSize.set(tam, tam);
    if (sol.shadow.map) { sol.shadow.map.dispose(); sol.shadow.map = null; }
  }
  renderer.shadowMap.enabled = q !== 'baixa';
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  ctx.efeitos.redimensionar(innerHeight * pr);
  entrada.sensibilidade = config.sensibilidade;
  entrada.inverterY = config.inverterY;
  audio.setVolumes(config.musica, config.efeitos);
}
addEventListener('resize', aplicarQualidade);
aplicarQualidade();

// ------------------------------------------------------------------ estados de tela
let estado = 'menu';
const telas = { menu: $('#menu'), pausa: $('#pausa'), controles: $('#tela-controles'), opcoes: $('#tela-opcoes') };
let telaAnterior = 'menu';

function mostrarTela(nome) {
  for (const [k, el] of Object.entries(telas)) el.classList.toggle('visivel', k === nome);
  $('#hud').classList.toggle('oculto', !iniciado || nome === 'menu');
}

function posicionarInicio() {
  const torre = cidade.torre;
  const t = melhorTelhado(new THREE.Vector3(torre.x - 20, 0, torre.z + 150), 45, 95);
  jog.posicionar(new THREE.Vector3(t.x, t.y + 0.2, t.z));
  jog.estado = 'chao';
  jog.empoleirado = 4;
  const d = new THREE.Vector3(torre.x - t.x, 0, torre.z - t.z);
  jog.facing = Math.atan2(d.x, d.z);
  ctx.camJogo.yaw = jog.facing;
  ctx.camJogo.pitch = 0.12;
}

let iniciado = false;
function jogar() {
  audio.iniciar();
  audio.setVolumes(config.musica, config.efeitos);
  if (!iniciado) {
    iniciado = true;
    posicionarInicio();
    ctx.hud.banner('NOVA AURORA', 'A cidade precisa de você, TEIA.', 'nivel', 3.5);
    setTimeout(() => tutorial('inicio'), 1500);
  }
  estado = 'jogando';
  mostrarTela(null);
  if (!MODO_TESTE) entrada.travar();
}

function pausar() {
  if (estado !== 'jogando') return;
  estado = 'pausado';
  entrada.soltar();
  atualizarEstatisticas();
  mostrarTela('pausa');
}

function atualizarEstatisticas() {
  const m = ctx.missoes;
  $('#estatisticas').innerHTML = `
    <div><b>${m.nivel}</b><span>nível</span></div>
    <div><b>${m.crimesResolvidos}</b><span>crimes resolvidos</span></div>
    <div><b>${m.inimigosDerrotados}</b><span>bandidos detidos</span></div>
    <div><b>${m.qtdColetados}/${m.cristais.length}</b><span>cristais</span></div>
    <div><b>${(jog.distPercorrida / 1000).toFixed(1)} km</b><span>percorridos agora</span></div>
    <div><b>${Math.floor(m.tempoJogo / 60)} min</b><span>de jogo</span></div>`;
}

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && estado === 'jogando' && !MODO_TESTE) { ctx.hud.alternarMapa(false); pausar(); }
});
canvas.addEventListener('click', () => { if (estado === 'jogando' && !MODO_TESTE) entrada.travar(); });

const temSave = ctx.missoes.xp > 0 || ctx.missoes.nivel > 1 || ctx.missoes.coletados.size > 0;
$('#btn-jogar').textContent = temSave ? 'CONTINUAR' : 'JOGAR';
$('#btn-novo').style.display = temSave ? '' : 'none';
$('#btn-jogar').onclick = () => { audio.iniciar(); audio.tocar('ui'); jogar(); };
$('#btn-novo').onclick = () => {
  if (!confirm('Apagar o progresso salvo e começar do zero?')) return;
  ctx.missoes.zerar();
  location.reload();
};
for (const b of document.querySelectorAll('[data-tela]')) {
  b.onclick = () => {
    audio.iniciar(); audio.tocar('ui');
    const alvo = b.dataset.tela;
    if (alvo === 'voltar') { mostrarTela(telaAnterior); return; }
    telaAnterior = estado === 'menu' ? 'menu' : 'pausa';
    mostrarTela(alvo);
  };
}
$('#btn-continuar').onclick = () => { audio.tocar('ui'); jogar(); };
$('#btn-menu').onclick = () => { ctx.missoes.salvar(); location.reload(); };

// Opções
const selQ = $('#opt-qualidade'), rngS = $('#opt-sens'), chkY = $('#opt-inverter'), rngM = $('#opt-musica'), rngE = $('#opt-efeitos');
selQ.value = config.qualidade; rngS.value = config.sensibilidade; chkY.checked = config.inverterY; rngM.value = config.musica; rngE.value = config.efeitos;
const lerOpcoes = () => {
  config.qualidade = selQ.value; config.sensibilidade = Number(rngS.value); config.inverterY = chkY.checked;
  config.musica = Number(rngM.value); config.efeitos = Number(rngE.value);
  salvarConfig(); aplicarQualidade();
};
for (const el of [selQ, rngS, chkY, rngM, rngE]) el.addEventListener('input', lerOpcoes);

// ------------------------------------------------------------------ laço
const relogio = new THREE.Clock();
let tempo = 0;
let orbita = 0;
let fpsAcum = 0, fpsN = 0, fpsMostrado = 60;

function quadro() {
  requestAnimationFrame(quadro);
  try {
    passo();
  } catch (e) {
    mostrarErro(e);
    throw e;
  }
}

function passo() {
  const bruto = relogio.getDelta();
  fpsAcum += bruto; fpsN++;
  if (fpsAcum > 0.5) { fpsMostrado = Math.round(fpsN / fpsAcum); fpsAcum = 0; fpsN = 0; $('#fps').textContent = `${fpsMostrado} fps`; }
  atualizarJogo(Math.min(bruto, 1 / 20));
  pos.renderizar(cena, camera);
  // Sugere qualidade baixa se o computador estiver sofrendo
  if (estado === 'jogando' && config.qualidade !== 'baixa' && !avisouLento) {
    medidaLenta = fpsMostrado < 26 ? medidaLenta + bruto : 0;
    if (medidaLenta > 6) { avisouLento = true; ctx.hud.dica('O jogo está lento? Aperte ESC → OPÇÕES → Qualidade gráfica: Baixa.', 8); }
  }
}
let medidaLenta = 0, avisouLento = MODO_TESTE;

// Para testes automatizados: avança a simulação sem renderizar.
ctx.avancar = (seg, dt = 1 / 60) => { for (let t = 0; t < seg; t += dt) atualizarJogo(dt); };

function atualizarJogo(dtReal) {
  tempo += dtReal;
  entrada.lerControle();
  const u = pos.uniforms;

  if (estado === 'jogando') {
    if (entrada.apertou('pausa')) { pausar(); entrada.fimDoQuadro(); return; }
    if (entrada.apertou('mapa')) ctx.hud.alternarMapa();
    if (entrada.apertou('hora')) { ambiente.avancar(3); ctx.hud.dica(`Hora: ${Math.floor(ambiente.hora)}h${String(Math.floor((ambiente.hora % 1) * 60)).padStart(2, '0')}`, 1.5); }
    if (entrada.apertou('som')) ctx.hud.dica(audio.alternar() ? 'Som ligado' : 'Som desligado', 1.5);

    // câmera lenta e "hit-stop"
    if (ctx.lentoT > 0) ctx.lentoT -= dtReal;
    const alvoEscala = ctx.lentoT > 0 ? ctx.lentoEscala : 1;
    ctx.escalaTempo = damp(ctx.escalaTempo, alvoEscala, 12, dtReal);
    let dt = dtReal * ctx.escalaTempo;
    if (ctx.paradaT > 0) { ctx.paradaT -= dtReal; dt *= 0.05; }

    const estadoAntes = jog.estado;
    jog.atualizar(dt);
    if (jog.estado === 'balanco' && estadoAntes !== 'balanco') { tutorial('balanco'); if (ctx.estatisticas.balancos >= 4) tutorial('balancos'); }
    if (jog.estado === 'zip' && estadoAntes !== 'zip') setTimeout(() => tutorial('zip'), 2500);
    if (jog.emCombate) tutorial('combate');
    ctx.inimigos.atualizar(dt);
    ctx.missoes.atualizar(dt, tempo);
    ctx.trafego.atualizar(dt);
    ctx.camJogo.atualizar(dtReal, jog, entrada);
    ambiente.atualizar(dt, jog.pos);
    ctx.efeitos.atualizar(dt, dtReal);
    ctx.hud.atualizar(dtReal);

    const vel = jog.vel.length();
    const sir = ctx.missoes.sirene;
    let sirene = null;
    if (sir) {
      const d = sir.pos.clone().sub(camera.position);
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      const direita = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
      sirene = { dist: d.length(), pan: d.normalize().dot(direita) };
    }
    audio.intensidade = damp(audio.intensidade, jog.emCombate ? 1 : clamp((vel - 15) / 30, 0, 0.7), 1.5, dtReal);
    audio.atualizar(dtReal, vel, sirene);

    u.uVel.value = damp(u.uVel.value, clamp((vel - 30) / 28, 0, 1), 4, dtReal);
    u.uDano.value = Math.max(ctx.hud.danoT * 0.8, (1 - jog.hp / jog.hpMax) > 0.7 ? 0.25 + Math.sin(tempo * 6) * 0.1 : 0);
    ctx.hud.danoT = Math.max(0, ctx.hud.danoT - dtReal * 2.5);
    u.uFoco.value = jog.foco >= 1 ? 0.5 + Math.sin(tempo * 4) * 0.25 : 0;
    u.uLento.value = damp(u.uLento.value, ctx.lentoT > 0 ? 1 : 0, 8, dtReal);
  } else {
    // Modo vitrine: câmera orbitando a torre no menu/pausa
    if (estado === 'menu') {
      orbita += dtReal * 0.05;
      const t = cidade.torre;
      camera.position.set(t.x + Math.cos(orbita) * 260, 120 + Math.sin(orbita * 0.7) * 30, t.z + Math.sin(orbita) * 260);
      camera.lookAt(t.x, 140, t.z);
      camera.fov = 60; camera.updateProjectionMatrix();
      ambiente.atualizar(dtReal * 0.2, camera.position);
      ctx.trafego.atualizar(dtReal);
      jog.pivo.visible = false;
    } else jog.pivo.visible = true;
    u.uVel.value = 0; u.uDano.value = 0; u.uLento.value = 0; u.uFoco.value = 0;
    if (estado === 'pausado' && entrada.apertou('pausa')) jogar();
    ctx.efeitos.atualizar(0, dtReal);
  }
  if (estado === 'jogando') jog.pivo.visible = true;
  u.uTempo.value = tempo;
  entrada.fimDoQuadro();
}

// ------------------------------------------------------------------ início
$('#carregando').style.display = 'none';
mostrarTela('menu');
if (MODO_TESTE) {
  jogar();
  window.jogoPronto = true;
}
requestAnimationFrame(quadro);
