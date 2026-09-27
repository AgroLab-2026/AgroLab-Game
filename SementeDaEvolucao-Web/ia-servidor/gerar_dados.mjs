// Gera um CSV de treino a partir do simulador do jogo: situações variadas da
// estufa (as 7 variáveis) com a ação que as regras do AutonomousFarmAI tomariam.
// Uso: node ia-servidor/gerar_dados.mjs [Cultura] [linhas]
//   ex.: node ia-servidor/gerar_dados.mjs AlfaceCrespa 6000
import { readFileSync, writeFileSync } from 'node:fs';
import { GameManager } from '../js/core/GameManager.js';
import { FarmAction, VARIAVEIS } from '../js/core/EnvironmentState.js';
import { criarRng } from '../js/render/Pixel.js';

const cultura = process.argv[2] || 'AlfaceCrespa';
const linhas = Number(process.argv[3] || 6000);
const ler = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const dados = { culturas: ler('culturas.json'), balanceamento: ler('balanceamento.json'), progressao: ler('progressao.json'), falas: ler('falas.json') };

const NOMES = { nitrogen: 'N', phosphorus: 'P', potassium: 'K', ph: 'pH', airTemperature: 'temperatura', soilMoisture: 'umidade', luminosity: 'luminosidade' };
const ROTULO = { [FarmAction.DoNothing]: 'nao_fazer_nada', [FarmAction.LockIrrigation]: 'travar_irrigacao', [FarmAction.Irrigate]: 'irrigar', [FarmAction.ProtectPlant]: 'proteger' };

const rng = criarRng(2026);
const saida = [[...VARIAVEIS.map((v) => NOMES[v]), 'acao'].join(',')];
let partida = 0;
while (saida.length <= linhas) {
  // Partidas com jogadores de ritmos diferentes, para cobrir situações boas e ruins.
  const gm = new GameManager(dados, { rng: criarRng(1000 + partida) });
  gm.IniciarFase(1, cultura);
  const reacao = [0, 3, 6, 12, 20][partida % 5];
  for (let passo = 1; passo <= 60 * 60 && gm.estado === 'jogando'; passo++) {
    gm.Step(1 / 60);
    if (passo % 30 !== 0) continue;
    if (reacao && (passo / 60) % reacao < 0.5) {
      const a = gm.playerEnv.SuggestAction(gm.crop);
      if (a !== FarmAction.DoNothing) gm.DoAction(a);
      if (gm.resources.water < 6) gm.Refill();
    }
    // Pequeno ruído de sensor, como nas leituras reais.
    const env = gm.playerEnv.Clone();
    for (const v of VARIAVEIS) env[v] *= 1 + (rng() - 0.5) * 0.04;
    const acao = env.SuggestAction(gm.crop);
    saida.push([...VARIAVEIS.map((v) => env[v].toFixed(v === 'ph' ? 2 : 1)), ROTULO[acao]].join(','));
    if (saida.length > linhas) break;
  }
  partida++;
}
const arquivo = new URL(`./dados_simulados_${cultura.toLowerCase()}.csv`, import.meta.url);
writeFileSync(arquivo, saida.join('\n') + '\n');
console.log(`${saida.length - 1} linhas de ${cultura} em ${arquivo.pathname}`);
