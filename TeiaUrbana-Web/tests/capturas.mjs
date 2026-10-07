// Teste de fumaça no Chromium headless: carrega o jogo, executa um roteiro de ações
// (balançar, zip, combate) e salva capturas de tela. Uso: node tests/capturas.mjs [pasta-saida]
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// Playwright local ou global (npm i -g playwright)
let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  const req = createRequire(import.meta.url);
  ({ chromium } = req(join(execSync('npm root -g').toString().trim(), 'playwright')));
}

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = resolve(process.argv[2] || join(RAIZ, 'tests', 'saida'));
mkdirSync(SAIDA, { recursive: true });
const PORTA = 8093;

const servidor = spawn(process.execPath, [join(RAIZ, 'servidor.mjs'), String(PORTA)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const navegador = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
const erros = [];
pagina.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erros.push(`[${m.type()}] ${m.text()}`); });
pagina.on('pageerror', (e) => erros.push(`[pageerror] ${e.stack || e}`));

const hora = process.env.HORA ? `&hora=${process.env.HORA}` : '';
await pagina.goto(`http://localhost:${PORTA}/?teste=1${hora}`);
await pagina.waitForFunction(() => window.jogoPronto, null, { timeout: 60000 });
const espera = (ms) => pagina.waitForTimeout(ms);
const foto = async (nome) => { await pagina.screenshot({ path: join(SAIDA, `${nome}.png`) }); console.log('captura', nome); };
const estado = () => pagina.evaluate(() => {
  const j = window.jogo.jogador;
  return { estado: j.estado, pos: j.pos.toArray().map((v) => +v.toFixed(1)), vel: +j.vel.length().toFixed(1), hp: j.hp, fps: document.querySelector('#fps').textContent };
});

const avancar = (seg) => pagina.evaluate((s) => window.jogo.avancar(s), seg);
await avancar(1);
await foto('01-inicio');
console.log('início', await estado());

// 1) Pular do prédio e balançar segurando SHIFT
await pagina.keyboard.down('KeyW');
await pagina.keyboard.press('Space');
await avancar(0.4);
await pagina.keyboard.down('ShiftLeft');
let maxVel = 0;
const estados = new Set();
for (let i = 0; i < 16; i++) {
  await avancar(0.25);
  const e = await estado();
  estados.add(e.estado);
  maxVel = Math.max(maxVel, e.vel);
  if (i === 5) await foto('02-balanco');
  if (i === 11) await foto('03-balanco2');
}
console.log('balanço → estados:', [...estados].join(','), 'vel. máx:', maxVel, 'balanços:', await pagina.evaluate(() => window.jogo.estatisticas.balancos));
await pagina.keyboard.up('ShiftLeft');
await avancar(0.3);
await foto('04-queda');
await pagina.keyboard.up('KeyW');
await avancar(3);
console.log('depois de cair', await estado());

// 2) Zip: mira numa borda e aperta Q
const alvoZip = await pagina.evaluate(() => {
  const j = window.jogo;
  const t = j.cidade.telhados.filter((r) => r.y > 30 && r.y < 70)[3];
  j.jogador.posicionar(new j.jogador.pos.constructor(t.x, t.y + 0.2, t.z));
  j.avancar(0.5);
  // procura uma direção com alvo de zip
  for (let a = 0; a < 64; a++) {
    j.camJogo.yaw = (a / 64) * Math.PI * 2; j.camJogo.pitch = -0.05;
    j.avancar(1 / 60);
    if (j.jogador.alvoZipVisivel && j.jogador.alvoZipVisivel.distanceTo(j.jogador.pos) > 20) return j.jogador.alvoZipVisivel.toArray().map((v) => +v.toFixed(1));
  }
  return null;
});
console.log('alvo do zip:', alvoZip);
if (alvoZip) {
  await foto('05-mira-zip');
  await pagina.keyboard.press('KeyQ');
  await avancar(0.3);
  await foto('06-zip');
  await avancar(2);
  console.log('após zip', await estado());
  await pagina.keyboard.press('Space');
  await avancar(0.6);
  console.log('após lançamento', await estado());
}

// 3) Escalada: corre contra uma parede segurando SHIFT
const parede = await pagina.evaluate(() => {
  const j = window.jogo;
  const c = j.cidade.colisores.find((b) => b.tipo === 'predio' && b.max.y > 60 && b.min.y < 1);
  const V = j.jogador.pos.constructor;
  j.jogador.posicionar(new V(c.min.x - 6, 0.3, (c.min.z + c.max.z) / 2));
  j.camJogo.yaw = Math.PI / 2; j.camJogo.pitch = 0.1;
  j.avancar(0.3);
  return { topo: c.max.y };
});
await pagina.keyboard.down('KeyW');
await pagina.keyboard.down('ShiftLeft');
const alturas = [];
for (let i = 0; i < 10; i++) { await avancar(0.4); const e = await estado(); alturas.push(`${e.estado}:${e.pos[1]}`); if (i === 3) await foto('07-parede'); }
await pagina.keyboard.up('ShiftLeft');
await pagina.keyboard.up('KeyW');
console.log('escalada (topo', parede.topo.toFixed(0), '):', alturas.join(' '));

// 4) Combate na rua
await pagina.evaluate(() => {
  const j = window.jogo;
  const p = j.cidade.pontoDeRua(Math.random, j.jogador.pos, 0, 300);
  j.jogador.posicionar(p.clone().setY(0.1));
  j.avancar(0.3);
  for (let k = 0; k < 4; k++) j.inimigos.criar(k === 3 ? 'atirador' : 'brigao', p.clone().add({ x: 4 + k * 1.5, y: 0, z: 3 - k }), 999).alertar();
  const e0 = j.inimigos.lista[0];
  j.camJogo.yaw = Math.atan2(e0.pos.x - p.x, e0.pos.z - p.z);
  j.avancar(1.0);
});
for (let i = 0; i < 10; i++) { await pagina.mouse.click(640, 360); await avancar(0.18); }
await foto('08-combate');
await pagina.mouse.click(640, 360, { button: 'right' });
await avancar(0.1);
await foto('09-teia');
await avancar(0.5);
for (let i = 0; i < 12; i++) { await pagina.mouse.click(640, 360); await avancar(0.2); }
console.log('combate:', await pagina.evaluate(() => ({ vivos: window.jogo.inimigos.lista.filter((e) => e.vivo).length, xp: window.jogo.missoes.xp, foco: window.jogo.jogador.foco.toFixed(2), hp: window.jogo.jogador.hp })));

// 5) Noite e vista aérea
await pagina.evaluate(() => { window.jogo.ambiente.hora = 21; window.jogo.avancar(0.1); });
await foto('10-noite');
await pagina.evaluate(() => {
  const j = window.jogo;
  j.jogador.posicionar(j.jogador.pos.clone().set(j.cidade.torre.x + 40, 200, j.cidade.torre.z + 160));
  j.ambiente.hora = 17.6;
  j.camJogo.pitch = 0.35;
  j.avancar(0.2);
});
await foto('11-aereo');

console.log('\n--- console ---');
console.log(erros.slice(0, 40).join('\n') || '(sem erros)');
await navegador.close();
servidor.kill();
