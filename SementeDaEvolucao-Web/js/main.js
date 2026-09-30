// Ponto de entrada: carrega os dados, cria o GameManager (simulação), o
// WorldRenderer (canvas) e o HUD (DOM), e roda o laço:
// lógica em passo fixo de 60 Hz + desenho com requestAnimationFrame.
import { GameManager, EstadoJogo } from './core/GameManager.js';
import { FarmAction } from './core/EnvironmentState.js';
import { criarProvedorIA } from './ai/IAProvider.js';
import { GeradorFalasHttp } from './ai/provedores/falasHttp.js';
import { AutonomousFarmAI } from './ai/AutonomousFarmAI.js';
import { WorldRenderer } from './render/WorldRenderer.js';
import { registrarMolduras } from './render/Molduras.js';
import { criarRng } from './render/Pixel.js';
import { HUDController } from './ui/HUDController.js';
import { TelasFase } from './ui/TelasFase.js';
import { Debug } from './ui/Debug.js';
import { PainelIA } from './ui/PainelIA.js';
import { TerminalIA } from './ui/TerminalIA.js';
import { Controle, BOTAO } from './input/Controle.js';
import { vistaHud, vistaMundo } from './ui/Vistas.js';
import { ajustarEscala } from './ui/Escala.js';
import { Sons } from './audio/Sons.js';
import { iconeUrl } from './render/Icones.js';

const carregar = async (f) => (await fetch(`data/${f}`)).json();
const [culturas, balanceamento, progressao, falas, iaPadrao] = await Promise.all(
  ['culturas.json', 'balanceamento.json', 'progressao.json', 'falas.json', 'ia.json'].map(carregar));

// Configuração pela URL: ?ia=mock|http|regras&iaUrl=&mockAcoes=&falasUrl=&fase=&cultura=&semente=&debug=1&intro=0
const url = new URLSearchParams(location.search);
const configIA = {
  ia: url.get('ia') || iaPadrao.ia,
  iaUrl: url.get('iaUrl') ?? iaPadrao.iaUrl,
  mockAcoes: url.get('mockAcoes') ?? iaPadrao.mockAcoes,
  timeoutMs: Number(url.get('timeoutMs') || iaPadrao.timeoutMs),
};
const semente = url.get('semente');

registrarMolduras();
const palco = document.getElementById('palco');
let terminal = null; // barra lateral da IA, criada junto com o jogo
const ajustar = () => ajustarEscala(palco, terminal?.el);
addEventListener('resize', ajustar);
ajustar();

const gm = new GameManager({ culturas, balanceamento, progressao, falas }, {
  provedorIA: criarProvedorIA(configIA),
  rng: semente ? criarRng(Number(semente)) : Math.random,
  geradorFalas: (url.get('falasUrl') || iaPadrao.falasUrl) ? new GeradorFalasHttp(url.get('falasUrl') || iaPadrao.falasUrl) : null,
});
const mundo = new WorldRenderer(document.getElementById('mundo'));
const hud = new HUDController();
const telas = new TelasFase();
const debug = new Debug(gm);
const painelIA = new PainelIA(gm);
// Terminal da IA: aparece sozinho quando o jogo abre ligado à IA externa (iniciar_com_ia.bat).
terminal = new TerminalIA(gm, {
  visivel: url.has('terminal') ? url.get('terminal') !== '0' : configIA.ia === 'http',
  intervalo: Number(url.get('terminalIntervalo') || iaPadrao.terminalIntervalo || 3),
});
ajustar();
const sons = new Sons();

// ------------------------------------------------------------ sons
// O navegador só libera o áudio depois de um gesto (tecla ou clique).
const liberarAudio = () => sons.iniciar();
for (const ev of ['keydown', 'keyup', 'pointerdown', 'click', 'touchend']) addEventListener(ev, liberarAudio, { capture: true });

const btnSom = document.getElementById('btn-som');
function atualizarBotaoSom() {
  btnSom.classList.toggle('mudo', sons.mudo);
  btnSom.querySelector('img').src = iconeUrl(sons.mudo ? 'somDesligado' : 'somLigado');
  btnSom.title = sons.mudo ? 'Som desligado (tecla M)' : 'Som ligado (tecla M)';
}
function alternarSom() { sons.iniciar(); sons.alternarMudo(); atualizarBotaoSom(); if (!sons.mudo) sons.clique(); }
btnSom.addEventListener('click', alternarSom);
atualizarBotaoSom();

const SOM_ACAO = {
  Irrigate: () => sons.irrigar(), LockIrrigation: () => sons.travar(), ProtectPlant: () => sons.proteger(),
  DoNothing: () => sons.aguardar(), Refill: () => sons.encher(),
};
gm.OnAcao.on((quem, acao, ok) => {
  if (quem === 'ia') { if (ok) sons.robo(); return; }
  if (!ok) sons.erro(); else SOM_ACAO[acao]?.();
});
gm.OnGasto.on((g) => {
  if (g.energia) sons.energia();
  const r = gm.resources;
  if (r.energy / r.energyMax < 0.2 || r.water / r.waterMax < 0.2) sons.alertaRecurso();
});
gm.weather.OnEventStarted.on((evt) => {
  if (evt === 'HeatWave') sons.calor();
  else if (evt === 'HeavyRain') sons.iniciarChuva();
  else if (evt === 'Pest') sons.praga();
  else if (evt === 'PowerFailure') sons.faltaLuz();
});
gm.weather.OnEventEnded.on((evt) => {
  if (evt === 'HeavyRain') sons.pararChuva();
  else if (evt === 'PowerFailure') sons.voltaLuz();
});
gm.OnFaseIniciada.on(() => sons.pararChuva());
gm.OnFaseTerminou.on((rel) => {
  sons.pararChuva();
  if (rel.motivo === 'tempo') sons.tempoAcabou();
  const tocar = { vitoriaFinal: () => sons.vitoriaFinal(), gameOver: () => sons.gameOver(), proxima: () => sons.vitoria(), tentarDeNovo: () => sons.derrota() }[rel.proximoPasso];
  setTimeout(() => tocar?.(), rel.motivo === 'tempo' ? 650 : 0);
});
if (url.get('debug') === '1') debug.alternar();

// ------------------------------------------------------------ eventos do jogo → interface
gm.OnAcao.on((quem, acao, ok) => {
  // Só o jogador move o fazendeiro; a IA move os robôs da estufa dela.
  if (!ok || acao === 'Refill' || acao === FarmAction.DoNothing) return;
  mundo.animarAcao(quem === 'ia' ? 'ia' : 'jogador', acao);
  if (quem === 'ia' && gm.progressao.tem('painelDados')) hud.toast(`IA: ${AutonomousFarmAI.Translate(acao)} — ${gm.aiAI.lastReason}`, false, 2200);
});
// Falhas (falta de recurso, tanque cheio) e "aguardar" viram aviso; gastos viram números.
gm.OnMensagem.on((texto, ruim) => { if (ruim || texto.includes('aguardar')) hud.toast(texto, ruim); });
gm.OnGasto.on((g) => {
  hud.mostrarGasto(g);
  const partes = [];
  if (g.agua) partes.push(`−${g.agua} L de água`);
  if (g.aguaGanha) partes.push(`+${Math.round(g.aguaGanha)} L no tanque`);
  if (g.energia) partes.push(`−${+g.energia.toFixed(1)} de energia`);
  if (g.fertilizante) partes.push(`−${g.fertilizante} de fertilizante`);
  const nome = g.acao === 'Refill' ? 'Encher água' : AutonomousFarmAI.Translate(g.acao);
  hud.toast(`${nome}: ${partes.join(' · ')}`);
});
gm.OnFaseTerminou.on((rel) => {
  telas.resultado(gm, rel, {
    proxima: () => { gm.ProximaFase(); abrirIntroducao(); },
    tentarDeNovo: () => { gm.TentarDeNovo(); abrirIntroducao(); },
    novoJogo: () => { gm.NovoJogo(); abrirIntroducao(); },
  });
});

// Botão "Testar som" da introdução: toca três notas e diz o que está acontecendo.
telas.aoTestarSom = () => {
  sons.iniciar();
  sons.teste();
  return new Promise((r) => setTimeout(() => r(sons.situacao), 250));
};

let emIntroducao = false;
function abrirIntroducao() {
  emIntroducao = true;
  telas.introducao(gm,
    () => { emIntroducao = false; sons.clique(); },
    (idCultura) => { gm.TrocarCultura(idCultura); abrirIntroducao(); });
}

// Fase inicial pela URL (útil para apresentar uma fase específica).
const faseUrl = Number(url.get('fase'));
if (faseUrl || url.get('cultura')) gm.IniciarFase(faseUrl || 1, url.get('cultura') || undefined);
if (url.get('intro') !== '0') abrirIntroducao();

// ------------------------------------------------------------ entrada
const TECLAS = { 1: FarmAction.DoNothing, 2: FarmAction.LockIrrigation, 3: FarmAction.Irrigate, 4: FarmAction.ProtectPlant };

function agir(acao) {
  if (telas.aberta) return;
  if (acao === 'Refill') gm.Refill();
  else gm.DoAction(acao);
  hud.destacarFerramenta(acao);
}

addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.code === 'Backquote' || e.key === '`') { debug.alternar(); e.preventDefault(); return; }
  if (e.key === 'Enter' && telas.confirmar()) { e.preventDefault(); return; }
  if (telas.aberta) return;
  const tecla = e.key.toLowerCase();
  if (TECLAS[tecla]) { agir(TECLAS[tecla]); e.preventDefault(); }
  else if (tecla === 'r') agir('Refill');
  else if (tecla === 'p' || e.code === 'Space') { pausar(); e.preventDefault(); }
  else if (tecla === 'b') alternarBruno();
  else if (tecla === 'm') alternarSom();
  else if (tecla === 'i') painelIA.alternar();
  else if (tecla === 't') alternarTerminal();
  else if (tecla === 'f') {
    // Tela cheia para o projetor (F11 fica livre para o navegador).
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
});

function pausar() {
  gm.AlternarPausa();
  sons.suspender(gm.estado === EstadoJogo.Pausado);
  hud.toast(gm.estado === EstadoJogo.Pausado
    ? `Pausado (${controle.conectado ? controle.glifo(BOTAO.START) : 'P'} para continuar)` : 'Continuando');
}
const alternarBruno = () => document.getElementById('bruno-fala').classList.toggle('minimizado');
function alternarTerminal() { terminal.alternar(); ajustar(); }

// ------------------------------------------------------------ controle (PlayStation e Xbox)
// Mesma posição nos dois controles (Controle.js); os símbolos na tela se adaptam ao que está em uso.
//   ✕/A irrigar · ○/B travar · △/Y proteger · □/X encher água · L1/LB aguardar
//   OPTIONS/Menu pausa · ✕/A ou OPTIONS/Menu confirmam as telas de fase · R1/RB terminal da IA
//   touchpad ou R3/RS painel IA AO VIVO · CREATE/View som · R2/RT próxima fala · L2/LT minimizar a fala
const BOTOES_ACAO = {
  [BOTAO.BAIXO_FACE]: FarmAction.Irrigate, [BOTAO.DIREITA_FACE]: FarmAction.LockIrrigation,
  [BOTAO.CIMA_FACE]: FarmAction.ProtectPlant, [BOTAO.ESQUERDA_FACE]: 'Refill', [BOTAO.L1]: FarmAction.DoNothing,
};
const controle = new Controle((botao) => {
  sons.iniciar(); // tenta liberar o áudio (alguns navegadores só liberam com clique ou tecla)
  if (telas.aberta) {
    if (botao === BOTAO.BAIXO_FACE || botao === BOTAO.START) telas.confirmar();
    return;
  }
  if (botao in BOTOES_ACAO) agir(BOTOES_ACAO[botao]);
  else if (botao === BOTAO.START) pausar();
  else if (botao === BOTAO.R1) alternarTerminal();
  else if (botao === BOTAO.TOUCHPAD || botao === BOTAO.R3) painelIA.alternar();
  else if (botao === BOTAO.SELECT) alternarSom();
  else if (botao === BOTAO.R2) gm.bruno.Proxima();
  else if (botao === BOTAO.L2) alternarBruno();
}, ({ conectado, nome, tipo }) => {
  document.body.classList.toggle('com-controle', conectado);
  document.body.classList.toggle('controle-ps', tipo === 'ps');
  document.body.classList.toggle('controle-xbox', tipo === 'xbox');
  if (!conectado) { hud.toast(`${nome} desconectado`); return; }
  const g = (b) => controle.glifo(b);
  hud.toast(`${nome} conectado! ${g(BOTAO.BAIXO_FACE)} irrigar · ${g(BOTAO.DIREITA_FACE)} travar · ` +
    `${g(BOTAO.CIMA_FACE)} proteger · ${g(BOTAO.ESQUERDA_FACE)} água · ${g(BOTAO.START)} pausa`);
  controle.vibrar(0.2, 0.4, 150);
});
gm.OnAcao.on((quem, _acao, ok) => { if (quem === 'jogador' && ok === false) controle.vibrar(0.6, 0.6, 180); });
gm.OnFaseTerminou.on((rel) => controle.vibrar(rel.venceu ? 0.2 : 0.8, 0.6, rel.venceu ? 200 : 450));

for (const btn of document.querySelectorAll('.lista-ferramentas button')) {
  btn.addEventListener('click', () => agir(btn.dataset.acao));
}
document.getElementById('btn-fechar-bruno').addEventListener('click', () => document.getElementById('bruno-fala').classList.toggle('minimizado'));
document.getElementById('btn-proxima-fala').addEventListener('click', () => gm.bruno.Proxima());

// ------------------------------------------------------------ laço
const PASSO = 1 / balanceamento.gameManager.passoFixoHz;
let acumulado = 0;
let anterior = performance.now();
let tempoAnimacao = 0;

// Aba oculta: não acumula tempo (o jogo "pausa" e não dá um salto ao voltar).
document.addEventListener('visibilitychange', () => { anterior = performance.now(); acumulado = 0; sons.suspender(document.hidden); });

// Cronômetro: tique nos últimos 10 segundos.
let ultimoSegundo = null;

function quadro(agora) {
  const dt = Math.min(0.25, (agora - anterior) / 1000);
  anterior = agora;
  if (!document.hidden) {
    if (!telas.aberta && !emIntroducao) {
      acumulado += dt;
      while (acumulado >= PASSO) { gm.Step(PASSO); acumulado -= PASSO; }
    }
    tempoAnimacao += gm.estado === EstadoJogo.Pausado ? 0 : dt;
    mundo.desenhar(vistaMundo(gm, tempoAnimacao), dt);
    hud.atualizar(vistaHud(gm));
    painelIA.atualizar();
    terminal.atualizar(dt);
    controle.atualizar();
    const seg = Math.ceil(gm.tempoRestante);
    if (gm.estado === EstadoJogo.Jogando && seg !== ultimoSegundo && seg <= 10 && seg > 0) sons.relogio(seg);
    ultimoSegundo = seg;
    debug.quadro();
  }
  requestAnimationFrame(quadro);
}
requestAnimationFrame(quadro);

// Acesso pelo console para testes e apresentações: window.jogo.gm
window.jogo = { gm, mundo, hud, telas, sons, painelIA, terminal };
