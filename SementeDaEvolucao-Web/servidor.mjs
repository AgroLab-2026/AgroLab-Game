// Servidor estático mínimo (só Node, sem dependências).
// Uso: node servidor.mjs [porta]   →   http://localhost:8080
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORTA = Number(process.argv[2] || process.env.PORT || 8080);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let arquivo = normalize(join(RAIZ, caminho));
    if (!arquivo.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
    if ((await stat(arquivo).catch(() => null))?.isDirectory()) arquivo = join(arquivo, 'index.html');
    const dados = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(dados);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
  }
}).on('error', (erro) => {
  if (erro.code === 'EADDRINUSE') console.error(`A porta ${PORTA} já está em uso (o jogo já está aberto em outra janela?). Feche a outra janela ou use: node servidor.mjs 8081`);
  else console.error(erro);
  process.exit(1);
}).listen(PORTA, '127.0.0.1', () => {
  console.log(`Semente da Evolução rodando em http://localhost:${PORTA}  (deixe esta janela aberta enquanto joga)`);
});
