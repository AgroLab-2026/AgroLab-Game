// Ponto de entrada: carrega os dados, cria o GameManager (simulação), o
// WorldRenderer (canvas) e o HUD (DOM), e roda o laço:
// lógica em passo fixo de 60 Hz + desenho com requestAnimationFrame.
import { GameManager, EstadoJogo } from './core/GameManager.js';
import { FarmAction } from './core/EnvironmentState.js';
import { criarProvedorIA } from './ai/IAProvider.js';
import { AutonomousFarmAI } from './ai/AutonomousFarmAI.js';
import { WorldRenderer } from './render/WorldRenderer.js';
import { registrarMolduras } from './render/Molduras.js';
import { criarRng } from './render/Pixel.js';
import { HUDController } from './ui/HUDController.js';
import { TelasFase } from './ui/TelasFase.js';
import { Debug } from './ui/Debug.js';
import { vistaHud, vistaMundo } from './ui/Vistas.js';
import { ajustarEscala } from './ui/Escala.js';

const carregar = async (f) => (await fetch(`data/${f}`)).json();
const [culturas, balanceamento, progressao, falas, iaPadrao] = await Promise.all(
  ['culturas.json', 'balanceamento.json', 'progressao.json', 'falas.json', 'ia.json'].map(carregar));

// Configuração pela URL: ?ia=mock|http|regras&iaUrl=&mockAcoes=&fase=&cultura=&semente=&debug=1
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
const ajustar = () => ajustarEscala(palco);
addEventListener('resize', ajustar);
ajustar();

const gm = new GameManager({ culturas, balanceamento, progressao, falas }, {
  provedorIA: criarProvedorIA(configIA),
  rng: semente ? criarRng(Number(semente)) : Math.random,
});
const mundo = new WorldRenderer(document.getElementById('mundo'));
const hud = new HUDController();
const telas = new TelasFase();
const debug = new Debug(gm);
if (url.get('debug') === '1') debug.alternar();

// ------------------------------------------------------------ eventos do jogo → interface
gm.OnAcao.on((quem, acao, ok) => {
  if (!ok || acao === 'Refill' || acao === FarmAction.DoNothing) return;
  mundo.animarAcao(quem === 'ia' ? 'ia' : 'jogador', acao);
  if (quem === 'ia' && gm.progressao.tem('painelDados')) hud.toast(`IA: ${AutonomousFarmAI.Translate(acao)} — ${gm.aiAI.lastReason}`, false, 2200);
  if (quem === 'automacao') hud.toast(`Automação: ${AutonomousFarmAI.Translate(acao)}`);
  if (quem === 'assistente') hud.toast(`IA assistente: ${AutonomousFarmAI.Translate(acao)}`);
});
gm.OnMensagem.on((texto, ruim) => hud.toast(texto, ruim));
gm.OnFaseTerminou.on((rel) => {
  telas.relatorio(gm, rel,
    (fase) => { if (fase) gm.IniciarFase(fase); else gm.ProximaFase(); abrirIntroducao(); },
    () => { gm.RepetirFase(); abrirIntroducao(); });
});

let emIntroducao = false;
function abrirIntroducao() {
  emIntroducao = true;
  telas.introducao(gm,
    () => { emIntroducao = false; },
    (idCultura) => { gm.RepetirFase(idCultura); abrirIntroducao(); });
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
  else if (tecla === 'p' || e.code === 'Space') { gm.AlternarPausa(); hud.toast(gm.estado === EstadoJogo.Pausado ? 'Pausado (P para continuar)' : 'Continuando'); e.preventDefault(); }
  else if (tecla === 'b') document.getElementById('bruno-fala').classList.toggle('minimizado');
});

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
document.addEventListener('visibilitychange', () => { anterior = performance.now(); acumulado = 0; });

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
    debug.quadro();
  }
  requestAnimationFrame(quadro);
}
requestAnimationFrame(quadro);

// Acesso pelo console para testes e apresentações: window.jogo.gm
window.jogo = { gm, mundo, hud, telas };
