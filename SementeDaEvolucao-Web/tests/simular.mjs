// Teste headless da simulação: node tests/simular.mjs
// Roda partidas completas sem navegador e confere as invariantes (nada de NaN,
// recursos dentro dos limites, fases de até 1:30, os 6 estágios) e o
// balanceamento: quem joga atento vence, quem fica parado perde, nada age
// sozinho na estufa do jogador, 3 vidas no jogo e game over, fallback da IA.
import { readFileSync } from 'node:fs';
import { GameManager, EstadoJogo } from '../js/core/GameManager.js';
import { FarmAction, VARIAVEIS } from '../js/core/EnvironmentState.js';
import { criarRng } from '../js/render/Pixel.js';
import { ProvedorComFallback, criarProvedorIA } from '../js/ai/IAProvider.js';
import { ProvedorRegras } from '../js/ai/provedores/regras.js';

const ler = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const dados = { culturas: ler('culturas.json'), balanceamento: ler('balanceamento.json'), progressao: ler('progressao.json'), falas: ler('falas.json') };

let falhas = 0, verificacoes = 0;
function checar(cond, msg) {
  verificacoes++;
  if (!cond) { falhas++; console.error(`  ✗ ${msg}`); }
}
const esperarMicrotarefas = () => new Promise((r) => setImmediate(r));

/**
 * Joga uma fase inteira com uma estratégia de jogador.
 * estrategia(gm) é chamada a cada `reacao` segundos reais.
 */
async function jogarFase({ fase = 1, cultura, estrategia, reacao = 4, semente = 42, provedorIA }) {
  const gm = new GameManager(dados, { rng: criarRng(semente), provedorIA });
  gm.IniciarFase(fase, cultura);
  const dt = 1 / dados.balanceamento.gameManager.passoFixoHz;
  const estagiosJogador = new Set(), estagiosIA = new Set();
  let passos = 0, proxima = reacao, eventos = new Set();
  gm.weather.OnEventStarted.on((e) => eventos.add(e));
  while (gm.estado === EstadoJogo.Jogando && passos < 60 * 60 * 20) {
    gm.Step(dt);
    passos++;
    if (passos % 60 === 0) {
      await esperarMicrotarefas();
      const t = passos / 60;
      // Invariantes, uma vez por segundo real.
      for (const v of VARIAVEIS) {
        checar(Number.isFinite(gm.playerEnv[v]), `jogador.${v} não é finito (t=${t})`);
        checar(Number.isFinite(gm.aiAI.aiEnv[v]), `ia.${v} não é finito (t=${t})`);
      }
      const r = gm.resources;
      checar(r.water >= 0 && r.water <= r.waterMax, `água fora dos limites: ${r.water}`);
      checar(r.energy >= 0 && r.energy <= r.energyMax, `energia fora dos limites: ${r.energy}`);
      checar(r.nutrientStock >= 0 && r.nutrientStock <= r.nutrientMax, `fertilizante fora dos limites: ${r.nutrientStock}`);
      checar(gm.playerPlant.health >= 0 && gm.playerPlant.health <= 100, 'saúde do jogador fora de 0..100');
      checar(gm.aiAI.aiPlant.health >= 0 && gm.aiAI.aiPlant.health <= 100, 'saúde da IA fora de 0..100');
      if (t >= proxima) { proxima += reacao; estrategia(gm); }
    }
    estagiosJogador.add(gm.playerPlant.estagio);
    estagiosIA.add(gm.aiAI.aiPlant.estagio);
  }
  return { gm, rel: gm.relatorio, estagiosJogador, estagiosIA, segundos: passos / 60, eventos };
}

const nada = () => {};
/** Fazendeiro atento: faz o que a situação pede, mas só a cada `reacao` segundos. */
const atento = (gm) => {
  const a = gm.playerEnv.SuggestAction(gm.crop);
  if (a !== FarmAction.DoNothing) gm.DoAction(a);
  if (gm.resources.water < 6) gm.Refill();
};
/** Afobado: irriga sem olhar, toda vez. */
const afobado = (gm) => { if (!gm.DoAction(FarmAction.Irrigate)) gm.Refill(); };

const CULTURAS = ['AlfaceCrespa', 'Morango', 'Tomate'];
const resumo = (r) => `${r.rel.venceu ? 'VENCEU' : 'perdeu'} (${r.rel.motivo}) em ${r.segundos.toFixed(0)} s · saúde média ${r.rel.jogador.saudeMedia.toFixed(0)}% · ` +
  `crescimento ${(r.rel.jogador.crescimento * 100).toFixed(0)}% · ${r.rel.jogador.agua.toFixed(0)} L · ${r.rel.jogador.energia.toFixed(0)} energia · ${r.rel.eficiencia}% da IA`;

console.log('Semente da Evolução — teste headless (fases de 1:30)\n');

for (const cultura of CULTURAS) {
  console.log(`▶ ${cultura}`);
  const r = await jogarFase({ cultura, estrategia: atento, reacao: 4 });
  console.log(`  atento (4 s):      ${resumo(r)}`);
  checar(r.rel.venceu, `${cultura}: o jogador atento deveria vencer`);
  checar(r.segundos <= 90.1, `${cultura}: a fase deveria durar no máximo 1:30 (${r.segundos} s)`);
  checar(r.estagiosJogador.size === 6, `${cultura}: o jogador atento passou por ${r.estagiosJogador.size} estágios (esperado 6)`);
  checar(r.estagiosIA.size >= 5, `${cultura}: a IA passou por só ${r.estagiosIA.size} estágios`);
  checar(r.rel.eficiencia < 100, `${cultura}: o fazendeiro sozinho não deveria superar a IA (${r.rel.eficiencia}%)`);
  checar(r.rel.ia.agua < r.rel.jogador.agua, `${cultura}: a IA deveria gastar menos água`);

  let vitoriasCalmo = 0;
  for (const semente of [1, 2, 3, 4, 5]) {
    const c = await jogarFase({ cultura, estrategia: atento, reacao: 9, semente });
    if (c.rel.venceu) vitoriasCalmo++;
    if (semente === 1) console.log(`  calmo (9 s):       ${resumo(c)}`);
  }
  console.log(`  calmo venceu ${vitoriasCalmo}/5`);
  checar(vitoriasCalmo >= 4, `${cultura}: quem reage a cada 9 s deveria vencer quase sempre (${vitoriasCalmo}/5)`);

  let vitoriasParado = 0;
  for (const semente of [1, 2, 3, 4, 5]) {
    const p = await jogarFase({ cultura, estrategia: nada, semente });
    if (p.rel.venceu) vitoriasParado++;
    if (semente === 1) console.log(`  parado:            ${resumo(p)}`);
    checar(p.gm.acoesJogador.length === 0 && p.gm.resources.aguaGasta === 0, `${cultura}: nada pode agir na estufa de quem está parado`);
  }
  checar(vitoriasParado === 0, `${cultura}: quem não faz nada deveria perder (${vitoriasParado}/5 vitórias)`);

  const a = await jogarFase({ cultura, estrategia: afobado, reacao: 2 });
  console.log(`  afobado (2 s):     ${resumo(a)}`);
  checar(!a.rel.venceu, `${cultura}: irrigar sem parar deveria perder`);
}

console.log('\n▶ Fase 5 (IA assistente só sugere)');
{
  const r = await jogarFase({ fase: 5, cultura: 'Tomate', estrategia: nada });
  checar(r.gm.acoesJogador.length === 0 && r.gm.resources.energiaGasta === 0, 'a IA assistente não pode agir sozinha na estufa do jogador');
  checar(r.gm.sugestaoIA !== null || r.gm.estado === EstadoJogo.FimDeFase, 'a IA assistente deveria sugerir ações');
  const segue = (gm) => { const s = gm.sugestaoIA; if (s && s.acao !== FarmAction.DoNothing) gm.DoAction(s.acao); if (gm.resources.water < 6) gm.Refill(); };
  const r2 = await jogarFase({ fase: 5, cultura: 'Tomate', estrategia: segue, reacao: 4 });
  console.log(`  seguindo a IA:     ${resumo(r2)}`);
  checar(r2.rel.venceu, 'seguir as sugestões da IA deveria vencer');
  checar(r2.gm.progressao.liberadas.size === 6, 'a fase 5 deveria ter as 6 tecnologias');
}

console.log('\n▶ Vidas (3 para o jogo inteiro) e game over');
{
  const gm = new GameManager(dados, { rng: criarRng(9) });
  checar(gm.progressao.ultimaFase === 5, 'o jogo deveria ter 5 fases');
  checar(gm.progressao.vidas === 3, 'o jogo começa com 3 vidas');
  const perder = () => { while (gm.estado === EstadoJogo.Jogando) gm.Step(1 / 60); return gm.relatorio; };
  const vencer = () => { gm.playerPlant.growthPoints = gm.crop.growthPointsToHarvest; gm.Step(1 / 60); return gm.relatorio; };
  let rel = perder();
  checar(!rel.venceu && rel.proximoPasso === 'tentarDeNovo' && rel.vidas === 2, `1ª derrota → perde 1 vida e repete (${rel.proximoPasso}, vidas ${rel.vidas})`);
  gm.ProximaFase();
  checar(gm.progressao.faseAtual === 1, 'não pode avançar de fase sem vencer');
  gm.TentarDeNovo(); rel = vencer();
  checar(rel.venceu && rel.proximoPasso === 'proxima' && rel.vidas === 2, 'vencer não devolve nem gasta vida');
  gm.ProximaFase();
  checar(gm.progressao.faseAtual === 2 && gm.progressao.vidas === 2, 'as vidas continuam na fase seguinte (são do jogo, não da fase)');
  rel = perder();
  checar(rel.proximoPasso === 'tentarDeNovo' && rel.vidas === 1, '2ª derrota (em outra fase) → última vida');
  gm.TentarDeNovo(); rel = perder();
  checar(rel.proximoPasso === 'gameOver' && rel.vidas === 0, `3ª derrota → game over (${rel.proximoPasso})`);
  gm.NovoJogo();
  checar(gm.progressao.faseAtual === 1 && gm.progressao.vidas === 3 && gm.progressao.historico.length === 0, 'novo jogo volta à fase 1 com 3 vidas');
  gm.IniciarFase(5); rel = vencer();
  checar(rel.proximoPasso === 'vitoriaFinal', 'vencer a fase 5 é a vitória final');
}

console.log('\n▶ Sombrite não gela a estufa depois do calor');
{
  const gm = new GameManager(dados, { rng: criarRng(4) });
  gm.IniciarFase(4, 'Morango');
  gm.DoAction(FarmAction.ProtectPlant);
  for (let i = 0; i < 60 * 25; i++) gm.Step(1 / 60);
  checar(gm.playerEnv.airTemperature >= gm.crop.temperatureRange.min - 0.5, `com sombra e sem calor, a temperatura não deveria cair abaixo da faixa (${gm.playerEnv.airTemperature.toFixed(1)} °C)`);
  checar(gm.playerEnv.luminosity >= gm.crop.luminosityRange.min - 1, `com sombra e sem calor, a luz não deveria cair abaixo da faixa (${gm.playerEnv.luminosity.toFixed(0)}%)`);
}

console.log('\n▶ Provedores de IA e fallback');
{
  const http = criarProvedorIA({ ia: 'http', iaUrl: '', timeoutMs: 100 });
  const gm = new GameManager(dados, { rng: criarRng(1), provedorIA: http });
  const snap = { versao: 1, tempo: 0, cultura: { id: 'Morango', nome: 'Morango', faixas: Object.fromEntries(VARIAVEIS.map((v) => [v, gm.crop.faixaDe(v)])) },
    ambiente: { ...gm.playerEnv.toJSON(), soilMoisture: 40 }, planta: { estagio: 0, saude: 100, crescimento: 0 }, recursos: null,
    clima: { externo: {}, evento: null, sombraAtiva: false } };
  const r1 = await http.decidir(snap);
  checar(r1.acao === FarmAction.Irrigate && /fallback/.test(r1.fonte), `http sem URL deveria cair nas regras (${JSON.stringify(r1)})`);

  const lento = new ProvedorComFallback({ nome: 'lento', decidir: () => new Promise((res) => setTimeout(() => res({ acao: 'DoNothing' }), 500)) }, new ProvedorRegras(), 50);
  const r2 = await lento.decidir(snap);
  checar(r2.acao === FarmAction.Irrigate && /timeout/.test(r2.fonte), `provedor lento deveria dar timeout (${JSON.stringify(r2)})`);

  const invalido = new ProvedorComFallback({ nome: 'invalido', decidir: async () => ({ acao: 'Dançar' }) }, new ProvedorRegras(), 50);
  const r3 = await invalido.decidir(snap);
  checar(r3.acao === FarmAction.Irrigate && /inválida/.test(r3.fonte), 'resposta inválida deveria cair nas regras');

  const mock = criarProvedorIA({ ia: 'mock', mockAcoes: 'ProtectPlant' });
  const r4 = await mock.decidir(snap);
  checar(r4.acao === FarmAction.ProtectPlant && r4.fonte === 'mock', 'mock deveria devolver a ação fixa');
  checar(JSON.parse(JSON.stringify(snap)).ambiente.soilMoisture === 40, 'snapshot deveria ser serializável em JSON');

  // A partida inteira com o mock continua funcionando (trocar provedor não quebra nada).
  const rm = await jogarFase({ cultura: 'Tomate', estrategia: atento, provedorIA: criarProvedorIA({ ia: 'mock' }) });
  checar(Number.isFinite(rm.rel.eficiencia), 'partida com provedor mock deveria terminar com pontuação válida');
  console.log(`  http sem URL → ${r1.fonte}\n  lento → ${r2.fonte}\n  inválido → ${r3.fonte}\n  mock → ${r4.acao}`);
}

console.log(`\n${verificacoes} verificações, ${falhas} falha(s).`);
process.exit(falhas ? 1 : 0);
