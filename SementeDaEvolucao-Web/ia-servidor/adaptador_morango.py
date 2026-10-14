"""Tradutor entre a estufa do jogo e o modelo de morango da frente de IA.

O Random Forest do grupo (AgroLab-IA/morango/agrolab_morango_modelo.ipynb) foi treinado com
morango/agrolab_morango_dataset.csv (estufa semi-hidropônica, um registro por dia), com 15 entradas:

    temp_ar_media, temp_ar_max, temp_ar_min, umidade_ar_media, radiacao_PAR, chuva_mm,
    h_calor_extremo, h_umid_alta, pH, N_mgL, P_mgL, K_mgL, temp_substrato, umidade_solo,
    luminosidade_lux

e devolve uma de 4 ações: "Ideal", "Irrigar", "Proteger" ou "Travar Irrigação".

O jogo mede 7 variáveis com as faixas ideais do morango no jogo. Este módulo faz duas traduções:

1. ENTRADA (estufa do jogo -> 15 colunas). Cada variável é posicionada dentro da faixa ideal do
   jogo (0 = no mínimo, 1 = no máximo) e levada para a mesma posição entre os limites que o
   gerador do grupo usa para rotular (classificar_acao em agrolab_morango_simulacao.ipynb). Assim,
   "fora da faixa" no jogo vira "fora da faixa" para o modelo:
     - umidade do substrato -> umidade_solo   (mínimo do jogo = 60 %: irrigar; máximo = 85 %: travar)
     - N, P, K              -> N_mgL, P_mgL, K_mgL (mínimos de 160, 28 e 220 mg/L, os de "repor")
     - pH                   -> pH (faixa do jogo -> 5,3-6,3, os limites de correção)
     - temperatura          -> temp_ar_media; a máxima do dia é a média + 6,1 °C (média do dataset),
                               e o máximo do jogo vira 30 °C de máxima (o limite de "proteger");
                               horas acima de 30 °C, mínima e substrato saem dela, como no gerador
     - luminosidade         -> luminosidade_lux e radiacao_PAR (a estufa deixa passar ~70 %)
     - umidade do ar externa e chuva (evento Chuva Intensa) -> umidade_ar_media, h_umid_alta, chuva_mm

2. SAÍDA (ação do modelo -> ferramenta do jogo). A ação é a decisão do modelo. A ferramenta que a
   executa depende da causa, identificada pelas mesmas regras de prioridade do gerador:
     Ideal             -> Aguardar
     Irrigar           -> Irrigar (água + nutrientes); se a causa for pH alto -> Travar irrigação,
                          que é a ferramenta que corrige o pH no jogo
     Travar Irrigação  -> Travar irrigação (substrato encharcado ou pH baixo); se a causa for
                          excesso de N/K -> Aguardar, sem fertirrigar (o excesso some com o consumo)
     Proteger          -> Proteger (sombrite); se o sombrite já estiver ativo -> Aguardar
"""

COLUNAS = [
    "temp_ar_media", "temp_ar_max", "temp_ar_min", "umidade_ar_media", "radiacao_PAR", "chuva_mm",
    "h_calor_extremo", "h_umid_alta", "pH", "N_mgL", "P_mgL", "K_mgL", "temp_substrato",
    "umidade_solo", "luminosidade_lux",
]

# Limites do gerador do grupo (classificar_acao).
UMID_MIN, UMID_MAX = 60.0, 85.0
N_MIN, N_MAX = 160.0, 250.0
K_MIN, K_MAX = 220.0, 380.0
P_MIN = 28.0
PH_BAIXO, PH_ALTO = 5.3, 6.3
T_MAX_CALOR = 30.0
T_MIN_FRIO = 5.0
LUX_MAX = 1400.0

# Relações médias do dataset (agrolab_morango_dataset.csv).
AMPLITUDE_MAX = 6.05      # temp_ar_max - temp_ar_media
AMPLITUDE_MIN = 4.73      # temp_ar_media - temp_ar_min
SUBSTRATO_ABAIXO = 2.55   # temp_ar_media - temp_substrato
TRANSMISSAO_LUZ = 0.70    # luminosidade_lux / radiacao_PAR
T_MEDIA_IDEAL_MIN = 18.0  # média do dia no mínimo da faixa do jogo
LUX_Q1, LUX_Q3 = 244.0, 426.0
P_IDEAL_MAX = 60.0

NOMES = {
    "Ideal": "não fazer nada",
    "Irrigar": "irrigar",
    "Proteger": "proteger",
    "Travar Irrigação": "travar irrigação",
}


def _posicao(valor, faixa):
    """0 no mínimo da faixa ideal do jogo, 1 no máximo (extrapola fora dela)."""
    largura = (faixa["max"] - faixa["min"]) or 1.0
    return (valor - faixa["min"]) / largura


def _entre(p, a, b):
    return a + p * (b - a)


def traduzir_entrada(snapshot):
    """Snapshot do jogo -> dicionário com as 15 colunas do modelo de morango."""
    amb = snapshot["ambiente"]
    faixas = snapshot["cultura"]["faixas"]
    pos = {v: _posicao(amb[v], faixas[v]) for v in faixas}
    clima = snapshot.get("clima", {}) or {}
    evento = (clima.get("evento") or {}).get("id")

    t_media = _entre(pos["airTemperature"], T_MEDIA_IDEAL_MIN, T_MAX_CALOR - AMPLITUDE_MAX)
    t_max = t_media + AMPLITUDE_MAX
    lux = max(20.0, _entre(pos["luminosity"], LUX_Q1, LUX_Q3))
    ur = float((clima.get("externo") or {}).get("umidadeAr", 72))

    return {
        "temp_ar_media": round(t_media, 1),
        "temp_ar_max": round(t_max, 1),
        "temp_ar_min": round(t_media - AMPLITUDE_MIN, 1),
        "umidade_ar_media": round(ur, 1),
        "radiacao_PAR": round(lux / TRANSMISSAO_LUZ, 1),
        "chuva_mm": 15.0 if evento == "HeavyRain" else 0.0,
        "h_calor_extremo": int(max(0, min(12, round((t_max - T_MAX_CALOR) * 1.2)))),
        "h_umid_alta": int(max(0, min(12, round((ur - 75) / 2)))),
        "pH": round(_entre(pos["ph"], PH_BAIXO, PH_ALTO), 2),
        "N_mgL": round(_entre(pos["nitrogen"], N_MIN, N_MAX), 1),
        "P_mgL": round(_entre(pos["phosphorus"], P_MIN, P_IDEAL_MAX), 1),
        "K_mgL": round(_entre(pos["potassium"], K_MIN, K_MAX), 1),
        "temp_substrato": round(t_media - SUBSTRATO_ABAIXO, 1),
        "umidade_solo": round(max(0.0, min(100.0, _entre(pos["soilMoisture"], UMID_MIN, UMID_MAX))), 1),
        "luminosidade_lux": round(lux, 1),
    }


def interpretar(x, rotulo):
    """Ação do modelo -> (nome em português, causa provável pelas regras do gerador)."""
    rotulo = str(rotulo)
    if rotulo == "Proteger":
        if x["temp_ar_min"] < T_MIN_FRIO:
            causa = "frio"
        elif x["luminosidade_lux"] > LUX_MAX:
            causa = "luz forte"
        else:
            causa = "calor"
    elif rotulo == "Travar Irrigação":
        if x["umidade_solo"] > UMID_MAX:
            causa = "substrato encharcado"
        elif x["N_mgL"] > N_MAX or x["K_mgL"] > K_MAX:
            causa = "nutrientes em excesso"
        elif x["pH"] < PH_BAIXO:
            causa = "pH baixo"
        else:
            causa = "excesso"
    elif rotulo == "Irrigar":
        if x["umidade_solo"] < UMID_MIN:
            causa = "substrato seco"
        elif x["N_mgL"] < N_MIN or x["K_mgL"] < K_MIN or x["P_mgL"] < P_MIN:
            causa = "faltam nutrientes"
        elif x["pH"] > PH_ALTO:
            causa = "pH alto"
        else:
            causa = "falta"
    else:
        causa = "tudo no ideal"
    return NOMES.get(rotulo, rotulo), causa


def escolher_ferramenta(rotulo, causa, sombra_ativa):
    """Ação do modelo + causa -> uma das 4 ações do jogo (e um complemento para o texto)."""
    rotulo = str(rotulo)
    if rotulo == "Proteger":
        return ("DoNothing", "sombrite já ativo") if sombra_ativa else ("ProtectPlant", "")
    if rotulo == "Travar Irrigação":
        return ("DoNothing", "sem fertirrigar agora") if causa == "nutrientes em excesso" else ("LockIrrigation", "")
    if rotulo == "Irrigar":
        return ("LockIrrigation", "o jogo corrige o pH ao travar") if causa == "pH alto" else ("Irrigate", "")
    return "DoNothing", ""


def resumo(x):
    """Linha curta com o que o modelo viu (janela do servidor e terminal do jogo)."""
    return (f"substrato {x['umidade_solo']:.0f}% | N {x['N_mgL']:.0f} K {x['K_mgL']:.0f} | "
            f"T máx {x['temp_ar_max']:.1f}°C ({x['h_calor_extremo']} h >30°C) | luz {x['luminosidade_lux']:.0f}")
