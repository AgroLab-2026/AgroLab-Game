// Compara, no simulador do jogo, a estufa autônoma guiada pelo modelo (servidor_ia.py) e pelas
// regras do jogo. Suba o servidor antes: python ia-servidor/servidor_ia.py
// Uso: node ia-servidor/avaliar_no_jogo.mjs [partidas]
import { readFileSync } from 'node:fs';
import { GameManager } from '../js/core/GameManager.js';
import { criarProvedorIA } from '../js/ai/IAProvider.js';
import { FarmAction } from '../js/core/EnvironmentState.js';
import { criarRng } from '../js/render/Pixel.js';

const partidas = Number(process.argv[2] || 8);
const ler = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const dados = { culturas: ler('culturas.json'), balanceamento: ler('balanceamento.json'), progressao: ler('progressao.json'), falas: ler('falas.json') };
const esperar = () => new Promise((r) => setTimeout(r, 1));

async function jogar(ia, semente) {
  const provedorIA = criarProvedorIA(ia === 'modelo'
    ? { ia: 'http', iaUrl: 'http://localhost:5000/decidir', timeoutMs: 800 } : { ia: 'regras' });
  const gm = new GameManager(dados, { rng: criarRng(semente), provedorIA });
  gm.IniciarFase(1 + (semente % 5), 'AlfaceCrespa');
  const motivos = {};
  gm.aiAI.OnAction.on((_, m) => { const k = m.replace(/ \(\d+% de confiança\)$/, ''); motivos[k] = (motivos[k] || 0) + 1; });
  // O jogador reage a cada 6 s, só para a fase ter a duração normal. Cada partida espera a
  // resposta do servidor antes de seguir, então o tempo de rede não conta.
  for (let passo = 1; gm.estado === 'jogando' && passo < 60 * 60 * 3; passo++) {
    gm.Step(1 / 60);
    while (gm.aiAI._pendente) await esperar();
    if (passo % 360 === 0) {
      const a = gm.playerEnv.SuggestAction(gm.crop);
      if (a !== FarmAction.DoNothing) gm.DoAction(a);
      if (gm.resources.water < 6) gm.Refill();
    }
  }
  const ai = gm.aiAI;
  return { saude: ai.aiPlant.health, crescimento: ai.aiPlant.progresso, morta: ai.aiPlant.morta, agua: ai.waterUsed, energia: ai.energyUsed, decisoes: ai.decisoes, motivos };
}

for (const ia of ['regras', 'modelo']) {
  const rs = [];
  for (let s = 1; s <= partidas; s++) rs.push(await jogar(ia, s));
  const media = (f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  console.log(`\n${ia === 'modelo' ? 'MODELO (servidor_ia.py)' : 'REGRAS DO JOGO'} · ${partidas} partidas de alface`);
  console.log(`  saúde média ${media((r) => r.saude).toFixed(1)}% · crescimento ${(100 * media((r) => r.crescimento)).toFixed(0)}% · ` +
    `plantas mortas ${rs.filter((r) => r.morta).length} · água ${media((r) => r.agua).toFixed(1)} L · energia ${media((r) => r.energia).toFixed(0)}`);
  if (ia === 'modelo') {
    const doModelo = rs.reduce((a, r) => a + r.decisoes.modelo, 0), total = rs.reduce((a, r) => a + r.decisoes.modelo + r.decisoes.regras, 0);
    console.log(`  decisões do modelo: ${doModelo} de ${total}${doModelo < total ? ' (o resto caiu nas regras: servidor desligado ou lento?)' : ''}`);
  }
  const todos = {};
  for (const r of rs) for (const [k, v] of Object.entries(r.motivos)) todos[k] = (todos[k] || 0) + v;
  for (const [k, v] of Object.entries(todos).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${String(v).padStart(4)} × ${k}`);
}
