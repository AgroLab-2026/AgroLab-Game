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

  const novas = new Set(prog.novasNestaFase.map((t) => t.id));
  const tecnologias = prog.tecnologias.map((t) => ({
    nome: t.nome, icone: t.icone, efeito: t.efeito,
    estado: prog.tem(t.id) ? (novas.has(t.id) ? 'ativa nova' : 'ativa') : 'bloqueada',
  }));

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
    ? { texto: `${evento.nome} agora!`, icone: ICONE_EVENTO[evento.id] }
    : painel
      ? { texto: `${gm.bal.clima.eventos[gm.weather.proximo].nome} em ${mmss(gm.weather.tempoParaProximo)}`, icone: ICONE_EVENTO[gm.weather.proximo] }
      : { texto: PREVISAO_VAGA[gm.weather.proximo], icone: ICONE_EVENTO[gm.weather.proximo] };

  return {
    tituloObjetivo: `OBJETIVO · FASE ${prog.faseAtual}`,
    objetivo: fase.objetivo,
    subtitulo: 'CULTIVE O FUTURO!',
    recursos: {
      agua: { txt: `${Math.floor(r.water)}/${r.waterMax} L`, frac: r.water / r.waterMax },
      energia: { txt: `${Math.floor(r.energy)}/${r.energyMax}`, frac: r.energy / r.energyMax, regen: r.regeneracaoBloqueada ? 'sem luz!' : `+${r.energyRegenPerSecond}/s` },
      nutrientes: { txt: `${Math.floor(r.nutrientStock)}/${r.nutrientMax}`, frac: r.nutrientStock / r.nutrientMax },
      mao: `${gm.maoDeObra} tarefa${gm.maoDeObra === 1 ? '' : 's'}`,
      automacao: `${prog.liberadas.size}/${prog.tecnologias.length}`,
    },
    fase: {
      titulo: `FASE ${prog.faseAtual} DE ${prog.ultimaFase}`,
      tempo: mmss(gm.tempoRestante),
      urgencia: gm.tempoRestante <= 10 ? 'urgente' : gm.tempoRestante <= 25 ? 'pouco-tempo' : '',
      vidas: prog.vidas,
      vidasMax: prog.vidasMax,
      colheita: gm.playerPlant.progresso,
    },
    ferramentas: ferramentas(gm),
    clima: { condicao: ext.condicao, icone: iconeClima, temp: Math.round(ext.airTemperature), umid: Math.round(ext.umidadeAr) },
    previsao,
    controle,
    tecnologias,
    comparar: {
      voce: {
        saude: Math.round(gm.playerPlant.health), crescimento: Math.round(gm.playerPlant.progresso * 100),
        agua: `${r.aguaGasta.toFixed(0)} L`, aguaClasse: r.aguaGasta > ia.waterUsed * 1.8 + 2 ? 'ruim' : r.aguaGasta > ia.waterUsed * 1.2 + 1 ? 'medio' : 'bom',
        energia: r.energiaGasta.toFixed(0), energiaClasse: r.energiaGasta > ia.energyUsed * 2.5 + 5 ? 'ruim' : r.energiaGasta > ia.energyUsed * 1.5 + 3 ? 'medio' : 'bom',
        estrelas: estrelas(gm.playerPlant.health),
        visual: crop.visual, estagio: gm.playerPlant.estagio, saude01: gm.playerPlant.health / 100,
      },
      ia: {
        saude: Math.round(ia.aiPlant.health), crescimento: Math.round(ia.aiPlant.progresso * 100),
        agua: `${ia.waterUsed.toFixed(0)} L`, aguaClasse: 'azul', energia: ia.energyUsed.toFixed(0), energiaClasse: 'azul',
        estrelas: estrelas(ia.aiPlant.health),
        visual: crop.visual, estagio: ia.aiPlant.estagio, saude01: ia.aiPlant.health / 100,
      },
      // No comecinho (quase nada crescido) a razão não diz nada: mostra um traço.
      eficiencia: ia.aiPlant.progresso < 0.05 ? '—' : `${pontuacao.eficiencia}%`,
    },
    evento: eventoVista,
    bruno: { texto: gm.bruno.GetContextualTip(e, gm.playerPlant, gm.tempoReal) },
    iaUltima: `${AutonomousFarmAI.Translate(ia.lastAction)}: ${ia.lastReason}`,
  };
}

/**
 * Estado de cada ferramenta: custo (com descontos), o que falta, se está em uso
 * (sombra ativa), se o sensor pede, se a IA assistente sugere.
 */
function ferramentas(gm) {
  const jogando = gm.estado === 'jogando';
  const sugestao = gm.progressao.tem('iaAssistente') ? gm.sugestaoIA?.acao : null;
  const alerta = gm.alertaSensor;
  const sombra = gm.estufaJogador.sombra, total = gm.estufaJogador.sombraTotal || 1;
  const r = {};
  for (const acao of ['Irrigate', 'LockIrrigation', 'ProtectPlant', 'DoNothing', 'Refill']) {
    const custo = gm.CustoDe(acao);
    const pode = gm.PodePagar(acao);
    r[acao] = {
      custo, falta: pode.falta, desabilitado: !jogando,
      aguaGanha: acao === 'Refill' ? Math.round(gm.resources.waterMax - gm.resources.water) : 0,
      emUso: acao === 'ProtectPlant' && sombra > 0 ? sombra / total : 0,
      emUsoTxt: acao === 'ProtectPlant' && sombra > 0 ? `${Math.ceil(sombra / gm.timeScale)} s` : '',
      sugerido: jogando && sugestao === acao && acao !== 'DoNothing',
      alerta: jogando && alerta === acao,
    };
  }
  return r;
}

export function vistaMundo(gm, tempoAnimacao) {
  return {
    tempo: tempoAnimacao,
    evento: gm.weather.eventoAtual,
    jogador: { visual: gm.crop.visual, estagio: gm.playerPlant.estagio, saude01: gm.playerPlant.health / 100, sombra: gm.estufaJogador.sombra },
    ia: { visual: gm.crop.visual, estagio: gm.aiAI.aiPlant.estagio, saude01: gm.aiAI.aiPlant.health / 100, sombra: gm.aiAI.estufa.sombra },
  };
}
