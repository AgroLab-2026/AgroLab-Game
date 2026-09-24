// Fase 1: tela estática fiel à referência (sem lógica de jogo).
import { WorldRenderer } from './render/WorldRenderer.js';
import { registrarMolduras } from './render/Molduras.js';
import { HUDController } from './ui/HUDController.js';
import { ajustarEscala } from './ui/Escala.js';

const culturas = await (await fetch('data/culturas.json')).json();

registrarMolduras();
const palco = document.getElementById('palco');
const ajustar = () => ajustarEscala(palco);
addEventListener('resize', ajustar);
ajustar();

const mundo = new WorldRenderer(document.getElementById('mundo'));
const hud = new HUDController();

const vista = {
  tempo: 0,
  evento: null,
  jogador: { visual: culturas.Morango.visual, estagio: 2, saude01: 0.55, sombra: 0 },
  ia: { visual: culturas.Morango.visual, estagio: 4, saude01: 1, sombra: 0 },
};

const barra = (id, icone, rotulo, valorTxt, classe, pos, ini, fim, posIa, cor) =>
  ({ id, icone, rotulo, valorTxt, classe, pos, idealIni: ini, idealFim: fim, posIa, cor, mostrarIa: true });

const estadoHud = {
  objetivo: 'Mantenha suas plantas saudáveis até o final do ciclo e aprenda a competir com a IA!',
  subtitulo: 'CULTIVE O FUTURO!',
  recursos: { agua: 20, energia: 15, nutrientes: 5, mao: 3, automacao: 'Ativa' },
  clima: { condicao: 'Ensolarado', icone: 'sol', temp: 28, umid: 65 },
  previsao: { texto: 'Chuva intensa esta tarde!', icone: 'nuvemChuva' },
  controle: [
    barra('temp', 'termometro', 'Temperatura do ar', '28°C', 'ruim', 0.47, 0.3, 0.4, 0.35, '#8a8e96'),
    barra('umid', 'gotaGrande', 'Umidade do substrato', '65%', 'azul', 0.72, 0.6, 0.75, 0.68, '#2a5f98'),
    barra('luz', 'lampada', 'Luminosidade', '53%', 'bom', 0.2, 0.55, 0.75, 0.62, '#e8c83a'),
    barra('ph', 'ph', 'pH da solução', '6.0', 'bom', 0.2, 0.18, 0.28, 0.22, '#3f8a5a'),
    barra('npk', 'nutrientes', 'Nutrientes (N·P·K)', '0%', 'bom', 0.22, 0.5, 0.8, 0.65, '#6aaa3a'),
  ],
  tecnologias: [
    { nome: 'Medidor de pH e EC', icone: 'medidor', estado: 'ativa', efeito: '' },
    { nome: 'Timer de Irrigação', icone: 'gotaGrande', estado: 'bloqueada', efeito: '' },
    { nome: 'Sensor de Umidade', icone: 'sensor', estado: 'bloqueada', efeito: '' },
    { nome: 'Sombrite Automático', icone: 'sombra', estado: 'bloqueada', efeito: '' },
    { nome: 'Painel de Dados', icone: 'painel', estado: 'bloqueada', efeito: '' },
    { nome: 'IA Assistente', icone: 'robo', estado: 'bloqueada', efeito: '' },
  ],
  comparar: {
    voce: { saude: 30, prod: 0.5, agua: 'Alto', aguaClasse: 'ruim', energia: 'Baixa', energiaClasse: 'ruim', estrelas: 1, visual: culturas.Morango.visual, estagio: 2, saude01: 0.5 },
    ia: { saude: 98, prod: 4.2, agua: 'Baixo', aguaClasse: 'bom', energia: 'Alta', energiaClasse: 'bom', estrelas: 5, visual: culturas.Morango.visual, estagio: 5, saude01: 1 },
    eficiencia: '12%',
  },
  evento: { ativo: false, nome: 'CHUVA INTENSA', desc: 'Uma forte chuva está chegando! A temperatura pode cair rapidamente.', icone: 'nuvemChuva', rotulo: 'Tempo para o evento', tempo: '02:15' },
  bruno: { texto: 'Olá, meu amigo! Sua situação parece difícil, mas não desanime. A IA é avançada, sim, mas com tempo e aprendizado, você pode superá-la. A tecnologia é uma ferramenta para todos! Comece gerenciando o que você tem com sabedoria. Use a ventilação manual para controlar a umidade, como eu disse antes. Cada pequeno passo conta.' },
};

let anterior = performance.now();
function quadro(agora) {
  const dt = Math.min(0.1, (agora - anterior) / 1000);
  anterior = agora;
  vista.tempo += dt;
  mundo.desenhar(vista, dt);
  hud.atualizar(estadoHud);
  requestAnimationFrame(quadro);
}
requestAnimationFrame(quadro);
