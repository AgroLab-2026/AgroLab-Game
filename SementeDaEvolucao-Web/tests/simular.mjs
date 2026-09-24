// Teste headless da simulação: node tests/simular.mjs
// Roda ciclos completos de cultivo sem navegador e confere as invariantes:
// nada de NaN, recursos dentro dos limites, culturas passando pelos 6 estágios,
// a IA vencendo o fazendeiro sozinho e o fallback da IA funcionando.
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
  if (gm.resources.water < 8) gm.Refill();
};

console.log('Semente da Evolução — teste headless\n');

for (const cultura of ['Morango', 'AlfaceCrespa', 'Tomate']) {
  console.log(`▶ ${cultura}: fazendeiro atento (reage a cada 4 s)`);
  const r = await jogarFase({ cultura, estrategia: atento });
  const { rel } = r;
  console.log(`  ${r.segundos.toFixed(0)} s reais · fim: ${rel.motivo} · eventos: ${[...r.eventos].join(', ') || 'nenhum'}`);
  console.log(`  você: saúde média ${rel.jogador.saudeMedia.toFixed(0)}%, ${rel.jogador.produtividade.toFixed(2)} kg, ${rel.jogador.agua.toFixed(0)} L, ${rel.jogador.energia.toFixed(0)} energia`);
  console.log(`  IA:   saúde média ${rel.ia.saudeMedia.toFixed(0)}%, ${rel.ia.produtividade.toFixed(2)} kg, ${rel.ia.agua.toFixed(0)} L, ${rel.ia.energia.toFixed(0)} energia`);
  console.log(`  eficiência: ${rel.eficiencia}% da IA · reações perdidas: ${rel.reacoesPerdidas}/${rel.reacoesIA}`);
  checar(r.estagiosIA.size === 6, `${cultura}: a IA passou por ${r.estagiosIA.size} estágios (esperado 6)`);
  checar(rel.ia.crescimento >= 1, `${cultura}: a IA não colheu`);
  checar(r.estagiosJogador.size >= 5, `${cultura}: o jogador atento passou por só ${r.estagiosJogador.size} estágios`);
  checar(rel.eficiencia < 100, `${cultura}: o fazendeiro sozinho não deveria vencer a IA (${rel.eficiencia}%)`);
  checar(rel.eficiencia > 30, `${cultura}: fazendeiro atento com eficiência baixa demais (${rel.eficiencia}%)`);
  checar(rel.ia.agua < rel.jogador.agua, `${cultura}: a IA deveria gastar menos água`);
}

console.log('\n▶ Morango: fazendeiro que não faz nada');
{
  const r = await jogarFase({ cultura: 'Morango', estrategia: nada });
  console.log(`  fim: ${r.rel.motivo} · saúde final ${r.rel.jogador.saude.toFixed(0)}% · eficiência ${r.rel.eficiencia}%`);
  checar(r.rel.eficiencia < 50, `quem não faz nada deveria ir mal (${r.rel.eficiencia}%)`);
}

console.log('\n▶ Fase 7 (parceria com a IA assistente) × fase 1');
{
  const f1 = await jogarFase({ fase: 1, cultura: 'Morango', estrategia: atento, reacao: 8 });
  const f7 = await jogarFase({ fase: 7, cultura: 'Morango', estrategia: atento, reacao: 8 });
  console.log(`  fase 1: ${f1.rel.eficiencia}% · fase 7: ${f7.rel.eficiencia}%`);
  checar(f7.rel.eficiencia > f1.rel.eficiencia, 'com a IA assistente o jogador deveria ir melhor que sozinho');
  checar(f7.gm.progressao.liberadas.size === 6, 'a fase 7 deveria ter as 6 tecnologias');
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
