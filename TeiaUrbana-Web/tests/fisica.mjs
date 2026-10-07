// Teste rápido de jogabilidade (sem capturas): simula 30 s de balanço em várias direções
// e mede quanto tempo o herói passa balançando/no ar versus preso em paredes ou no chão.
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  const req = createRequire(import.meta.url);
  ({ chromium } = req(join(execSync('npm root -g').toString().trim(), 'playwright')));
}
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = 8095;
const servidor = spawn(process.execPath, [join(RAIZ, 'servidor.mjs'), String(PORTA)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 500));
const nav = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await nav.newPage({ viewport: { width: 320, height: 200 } });
const erros = [];
pg.on('pageerror', (e) => erros.push(e.stack || String(e)));
await pg.goto(`http://localhost:${PORTA}/?teste=1`);
await pg.waitForFunction(() => window.jogoPronto, null, { timeout: 60000 });

const resultado = await pg.evaluate(() => {
  const j = window.jogo;
  const jog = j.jogador;
  const e = j.entrada;
  const total = {};
  let balancos0 = j.estatisticas.balancos, velSoma = 0, n = 0, velMax = 0;
  const rotas = [];
  for (let rota = 0; rota < 6; rota++) {
    const t = j.cidade.telhados.filter((r) => r.y > 40 && r.y < 90)[rota * 7];
    jog.posicionar(new jog.pos.constructor(t.x, t.y + 0.3, t.z));
    j.camJogo.yaw = rota * 1.1;
    j.avancar(0.2);
    e.baixo.add('KeyW');
    e.apertados.add('Space');
    j.avancar(0.35);
    e.baixo.add('ShiftLeft');
    const conta = {};
    for (let k = 0; k < 300; k++) {
      // a cada 1,2 s a câmera vira um pouco (como um jogador fazendo curvas)
      if (k % 72 === 0) j.camJogo.yaw += (Math.random() - 0.5) * 1.2;
      // solta e pega de novo a teia periodicamente
      if (k % 50 === 40) e.baixo.delete('ShiftLeft');
      if (k % 50 === 46) { e.baixo.add('ShiftLeft'); e.apertados.add('ShiftLeft'); }
      j.avancar(1 / 60);
      conta[jog.estado] = (conta[jog.estado] || 0) + 1;
      total[jog.estado] = (total[jog.estado] || 0) + 1;
      const v = jog.vel.length(); velSoma += v; n++; velMax = Math.max(velMax, v);
    }
    e.baixo.clear();
    rotas.push(conta);
  }
  return { total, rotas, balancos: j.estatisticas.balancos - balancos0, velMedia: (velSoma / n).toFixed(1), velMax: velMax.toFixed(1) };
});
console.log(JSON.stringify(resultado, null, 1));

// Missões: força cada tipo de crime e resolve "trapaceando" (teleporte + golpes automáticos)
const missoes = await pg.evaluate(() => {
  const j = window.jogo;
  const jog = j.jogador;
  const m = j.missoes;
  const log = [];
  const V = jog.pos.constructor;
  const resolverLuta = () => {
    for (let k = 0; k < 2400 && m.ativo; k++) {
      const alvo = j.inimigos.lista.find((e) => e.vivo && e.grupo === m.ativo.id);
      if (alvo && alvo.pos.distanceTo(jog.pos) > 6) { jog.posicionar(alvo.pos.clone().add(new V(2, 0.1, 0))); jog.estado = 'chao'; }
      if (k % 12 === 0) j.entrada.cliques.add('esq');
      jog.hp = jog.hpMax;
      j.avancar(1 / 60);
    }
  };
  // assalto
  m.sortearCrime('assalto');
  const a = m.ativo;
  jog.posicionar(a.pos.clone().add(new V(0, 0.1, 6)));
  resolverLuta();
  log.push(`assalto: ${m.ativo ? 'NÃO resolvido' : 'resolvido'} · crimes=${m.crimesResolvidos}`);
  // fuga: acerta teias no carro
  m.tProxCrime = 999;
  m.sortearCrime('fuga');
  const f = m.ativo;
  for (let k = 0; k < 6; k++) {
    j.inimigos.acertarTeia(f.carro);
    j.avancar(0.3);
  }
  j.avancar(1);
  log.push(`fuga: carro parado=${f.carro.parado} ocupantes=${j.inimigos.vivosDoGrupo(f.id).length}`);
  resolverLuta();
  log.push(`fuga: ${m.ativo ? 'NÃO resolvido' : 'resolvido'} · crimes=${m.crimesResolvidos}`);
  // resgate
  m.tProxCrime = 999;
  m.sortearCrime('resgate');
  const r = m.ativo;
  jog.posicionar(r.pos.clone().add(new V(-1.5, 0, 0)));
  j.avancar(0.5);
  log.push(`resgate: ${m.ativo ? 'NÃO resolvido' : 'resolvido'} · crimes=${m.crimesResolvidos} · nível=${m.nivel} xp=${m.xp}`);
  // desafio
  const d = m.desafios[0];
  jog.posicionar(d.inicio.clone().add(new V(0, 0.3, 0)));
  j.avancar(0.3);
  m.iniciarDesafio(d);
  j.avancar(3.2);
  for (const anel of d.aneis) { jog.posicionar(anel.clone().add(new V(0, -1.1, 0))); jog.vel.set(0, 0, 0); j.avancar(1 / 60); }
  log.push(`desafio: ${m.desafio ? 'em andamento' : 'concluído'} · recorde=${(m.recordes[d.id] || 0).toFixed(1)}s`);
  // cristal
  const c = m.cristais.find((x) => !x.pego);
  jog.posicionar(c.p.clone().add(new V(0, -1.4, 0)));
  j.avancar(0.1);
  log.push(`cristal: pego=${c.pego} total=${m.qtdColetados}`);
  return log;
});
console.log(missoes.join('\n'));
if (erros.length) { console.log('ERROS:\n' + erros.join('\n')); process.exitCode = 1; }
await nav.close();
servidor.kill();
