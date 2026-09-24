// Monta as "vistas" (dados prontos para exibir) a partir do GameManager.
// Fica na camada de UI: formatação, rótulos e cores não pertencem à simulação.
import { AutonomousFarmAI } from '../ai/AutonomousFarmAI.js';

export function mmss(seg) {
  const s = Math.max(0, Math.ceil(seg));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const PREVISAO_VAGA = {
  HeatWave: 'Dia quente pela frente...',
  HeavyRain: 'Chuva intensa esta tarde!',
  Pest: 'Tempo abafado: cuidado com pragas.',
  PowerFailure: 'Rede elétrica instável hoje.',
};
const ICONE_EVENTO = { HeatWave: 'sol', HeavyRain: 'nuvemChuva', Pest: 'inseto', PowerFailure: 'energia' };

/** Posição 0..1 de um valor numa escala [a, b]. */
const pos = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));

function linhaControle(id, icone, rotulo, valor, faixa, escala, fmt, cor, valorIa, oculto, azulNaFaixa = false) {
  const dentro = valor >= faixa.min && valor <= faixa.max;
  return {
    id, icone, rotulo, cor, oculto,
    valorTxt: oculto ? '??' : fmt(valor),
    classe: oculto ? 'oculto' : dentro ? (azulNaFaixa ? 'azul' : 'bom') : 'ruim',
    pos: oculto ? 0 : pos(valor, escala[0], escala[1]),
    idealIni: pos(faixa.min, escala[0], escala[1]),
    idealFim: pos(faixa.max, escala[0], escala[1]),
    posIa: pos(valorIa, escala[0], escala[1]),
    mostrarIa: !oculto,
  };
}

/** Índice de nutrientes: média de N, P e K em % do centro da faixa. */
function indiceNpk(env, crop) {
  return ((env.nitrogen / crop.nitrogenRange.centro + env.phosphorus / crop.phosphorusRange.centro + env.potassium / crop.potassiumRange.centro) / 3) * 100;
}
function faixaNpk(crop) {
  const r = (f) => [f.min / f.centro, f.max / f.centro];
  const [n, p, k] = [r(crop.nitrogenRange), r(crop.phosphorusRange), r(crop.potassiumRange)];
  return { min: (Math.max(n[0], p[0], k[0])) * 100, max: (Math.min(n[1], p[1], k[1])) * 100 };
}

function rotuloAgua(razao) {
  if (razao <= 1.3) return ['Baixo', 'bom'];
  if (razao <= 2.2) return ['Médio', 'medio'];
  return ['Alto', 'ruim'];
}
function rotuloEnergia(razao) {
  if (razao <= 1.5) return ['Alta', 'bom'];
  if (razao <= 3) return ['Média', 'medio'];
  return ['Baixa', 'ruim'];
}

export function vistaHud(gm) {
  const crop = gm.crop, e = gm.playerEnv, ia = gm.aiAI, r = gm.resources, prog = gm.progressao;
  const medidor = prog.tem('medidorPh');
  const painel = prog.tem('painelDados');
  const evento = gm.evento;
  const fase = prog.dadosFase;

  const controle = [
    linhaControle('temp', 'termometro', 'Temperatura do ar', e.airTemperature, crop.temperatureRange, [5, 45], (v) => `${v.toFixed(0)}°C`,
      e.airTemperature > crop.temperatureRange.max ? '#d9432b' : '#8a8e96', ia.aiEnv.airTemperature, false),
    linhaControle('umid', 'gotaGrande', 'Umidade do substrato', e.soilMoisture, crop.moistureRange, [0, 100], (v) => `${v.toFixed(0)}%`,
      '#2a5f98', ia.aiEnv.soilMoisture, false, true),
    linhaControle('luz', 'lampada', 'Luminosidade', e.luminosity, crop.luminosityRange, [0, 100], (v) => `${v.toFixed(0)}%`,
      '#e8c83a', ia.aiEnv.luminosity, false),
    linhaControle('ph', 'ph', 'pH da solução', e.ph, crop.phRange, [4, 8], (v) => v.toFixed(1),
      '#8a5ab8', ia.aiEnv.ph, !medidor),
    linhaControle('npk', 'nutrientes', 'Nutrientes (N·P·K)', indiceNpk(e, crop), faixaNpk(crop), [0, 200], (v) => `${v.toFixed(0)}%`,
      '#5fae3a', indiceNpk(ia.aiEnv, crop), !medidor),
  ];

  const novaTec = prog.faseAtual >= 2 ? prog.tecnologias[prog.faseAtual - 2]?.id : null;
  const tecnologias = prog.tecnologias.map((t) => ({
    nome: t.nome, icone: t.icone, efeito: t.efeito,
    estado: prog.tem(t.id) ? (t.id === novaTec ? 'ativa nova' : 'ativa') : 'bloqueada',
  }));

  const auto = ['sensorUmidade', 'sombrite'].filter((id) => prog.tem(id)).length;
  const automacao = prog.tem('iaAssistente') ? 'Ativa' : auto ? `Parcial (${auto})` : 'Inativa';

  // Comparação: consumo por ponto de crescimento, relativo à IA.
  const pJ = Math.max(0.05, gm.playerPlant.progresso), pI = Math.max(0.05, ia.aiPlant.progresso);
  const aguaRazao = (r.aguaGasta / pJ) / Math.max(0.5, ia.waterUsed / pI);
  const energiaRazao = (r.energiaGasta / pJ) / Math.max(0.5, ia.energyUsed / pI);
  const [aguaTxt, aguaClasse] = r.aguaGasta < 1 ? ['Baixo', 'bom'] : rotuloAgua(aguaRazao);
  const [energiaTxt, energiaClasse] = r.energiaGasta < 1 ? ['Alta', 'bom'] : rotuloEnergia(energiaRazao);
  const estrelas = (h) => Math.max(0, Math.min(5, Math.round(h / 20)));
  const pontuacao = gm.Pontuacao();

  let eventoVista;
  if (evento) {
    eventoVista = { ativo: true, nome: evento.nome.toUpperCase(), desc: evento.descricao, icone: ICONE_EVENTO[evento.id], rotulo: 'Termina em', tempo: mmss(evento.restante) };
  } else {
    const prox = gm.weather.proximo, dados = gm.bal.clima.eventos[prox];
    eventoVista = painel
      ? { ativo: false, nome: `PRÓXIMO: ${dados.nome.toUpperCase()}`, desc: dados.descricao, icone: ICONE_EVENTO[prox], rotulo: 'Tempo para o evento', tempo: mmss(gm.weather.tempoParaProximo) }
      : { ativo: false, nome: 'TEMPO ESTÁVEL', desc: 'Nenhum evento agora. O clima pode mudar a qualquer momento!', icone: 'nuvem', rotulo: 'Tempo para o evento', tempo: mmss(gm.weather.tempoParaProximo) };
  }

  const ext = gm.clima.ambienteExterno;
  const iconeClima = evento ? ICONE_EVENTO[evento.id] : ext.condicao === 'Nublado' ? 'nuvem' : 'sol';
  const previsao = evento
    ? { texto: `${evento.nome} agora! Aguente firme.`, icone: ICONE_EVENTO[evento.id] }
    : painel
      ? { texto: `${gm.bal.clima.eventos[gm.weather.proximo].nome} em ${mmss(gm.weather.tempoParaProximo)}`, icone: ICONE_EVENTO[gm.weather.proximo] }
      : { texto: PREVISAO_VAGA[gm.weather.proximo], icone: ICONE_EVENTO[gm.weather.proximo] };

  return {
    tituloObjetivo: `OBJETIVO · FASE ${prog.faseAtual}`,
    objetivo: fase.objetivo,
    subtitulo: 'CULTIVE O FUTURO!',
    recursos: {
      agua: Math.round((r.water / r.waterMax) * 100),
      energia: Math.round((r.energy / r.energyMax) * 100),
      nutrientes: Math.round((r.nutrientStock / r.nutrientMax) * 100),
      mao: gm.maoDeObra,
      automacao,
    },
    clima: { condicao: ext.condicao, icone: iconeClima, temp: Math.round(ext.airTemperature), umid: Math.round(ext.umidadeAr) },
    previsao,
    controle,
    tecnologias,
    comparar: {
      voce: {
        saude: Math.round(gm.playerPlant.health), prod: gm.produtividade(gm.playerPlant),
        agua: aguaTxt, aguaClasse, energia: energiaTxt, energiaClasse, estrelas: estrelas(gm.playerPlant.health),
        visual: crop.visual, estagio: gm.playerPlant.estagio, saude01: gm.playerPlant.health / 100,
      },
      ia: {
        saude: Math.round(ia.aiPlant.health), prod: gm.produtividade(ia.aiPlant),
        agua: 'Baixo', aguaClasse: 'bom', energia: 'Alta', energiaClasse: 'bom', estrelas: estrelas(ia.aiPlant.health),
        visual: crop.visual, estagio: ia.aiPlant.estagio, saude01: ia.aiPlant.health / 100,
      },
      // No comecinho (quase nada crescido) a razão não diz nada: mostra um traço.
      eficiencia: ia.aiPlant.progresso < 0.05 ? '—' : `${pontuacao.eficiencia}%`,
    },
    evento: eventoVista,
    bruno: { texto: gm.bruno.GetContextualTip(e, gm.playerPlant, gm.tempoReal) },
    acoesDesabilitadas: gm.estado !== 'jogando' ? { Irrigate: true, LockIrrigation: true, ProtectPlant: true, DoNothing: true, Refill: true } : null,
    iaUltima: `${AutonomousFarmAI.Translate(ia.lastAction)}: ${ia.lastReason}`,
  };
}

export function vistaMundo(gm, tempoAnimacao) {
  return {
    tempo: tempoAnimacao,
    evento: gm.weather.eventoAtual,
    jogador: { visual: gm.crop.visual, estagio: gm.playerPlant.estagio, saude01: gm.playerPlant.health / 100, sombra: gm.estufaJogador.sombra },
    ia: { visual: gm.crop.visual, estagio: gm.aiAI.aiPlant.estagio, saude01: gm.aiAI.aiPlant.health / 100, sombra: gm.aiAI.estufa.sombra },
  };
}
