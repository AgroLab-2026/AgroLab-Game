"""Tradutor entre a estufa do jogo e o modelo de alface NFT da frente de IA.

O Random Forest do grupo (AgroLab-IA/alface/EDA_Alface.ipynb, Parte 11) foi treinado com o
dataset hidropônico NFT (alface/nft/dataset_nft.csv), com 17 entradas:

    ce_ms_cm, ph, N, temp_solucao_c, od_mg_l, nivel_reservatorio_pct, temp_ar_c, temp_max_c,
    temp_min_c, umidade_relativa_pct, vpd_kpa, dli_mol_m2_d, dias_apos_transplante,
    fase_crescimento, fase_desenvolvimento, fase_muda, tolerancia_calor_tolerante

O jogo mede outras coisas (N, P, K, pH, temperatura, umidade do substrato e luz, cada uma com a
faixa ideal da cultura no jogo). Este módulo faz duas traduções:

1. ENTRADA (estufa do jogo -> 17 colunas). Cada variável é posicionada dentro da faixa ideal do
   jogo (0 = no mínimo, 1 = no máximo) e levada para a mesma posição nas faixas que o gerador do
   grupo usa para rotular (gerar_dataset_nft.py). Assim "fora da faixa" no jogo vira "fora da
   faixa" para o modelo:
     - N, P, K                -> CE da solução (alvo da fase: muda 0,5-0,8 ... pleno 1,2-2,0 mS/cm)
                                 e N pela solução Furlani (196 mg/L em CE 2,0);
     - umidade do substrato   -> nível do reservatório (mínimo da faixa = 30 %, o limite de repor);
     - pH                     -> pH da solução (faixa do jogo -> 5,5-6,8, os limites do gerador);
     - temperatura            -> temperatura do ar (máximo do jogo = 24 °C, limite de pendoamento da
                                 cultivar padrão); máx./mín. do dia = ±5,6 °C (média do dataset);
     - crescimento da planta  -> dias após o transplante (0-45) e fase;
     - umidade do ar externa  -> umidade relativa (+5 pontos da estufa, como no gerador) e VPD;
     - luz                    -> DLI (mol/m²/dia);
     - solução e O2           -> calculados como no gerador (a bomba funciona normalmente).

2. SAÍDA (classe 0-3 -> ferramenta do jogo). A classe é a decisão do modelo. A ferramenta que a
   executa depende da causa, que é identificada pelas mesmas regras de prioridade do gerador:
     0 não fazer nada          -> Aguardar
     1 travar/corrigir excesso -> se for pH alto: Travar irrigação (a ferramenta que corrige o pH);
                                  se for CE alta: Aguardar, sem fertirrigar (o Travar do jogo
                                  drena o substrato, e o excesso de nutrientes some com o consumo)
     2 repor/corrigir falta    -> Irrigar (água + nutrientes); se a falta for de pH -> Travar
                                  irrigação, que é a ferramenta que corrige o pH no jogo
     3 proteger                -> Proteger (sombrite); se a sombra já estiver ativa -> Aguardar
"""
import math

# Constantes do gerador do grupo (alface/gerar_dataset_nft.py).
CE_POR_FASE = {
    "muda": (0.5, 0.8),
    "crescimento": (0.8, 1.2),
    "desenvolvimento": (1.2, 2.0),
    "colheita": (1.2, 2.0),
}
CE_FORCA_PLENA = 2.0
N_FURLANI = 196.0
PH_BAIXO, PH_ALTO = 5.5, 6.8          # abaixo/acima: corrigir
RESERV_MINIMO = 30.0                  # % do reservatório: abaixo, repor água
T_PENDOAMENTO = 24.0                  # cultivar padrão (Grand Rapids, Simpson)
T_BASE = 15.0                         # mínimo da faixa de temperatura da alface
AMPLITUDE_DIA = 5.6                   # temp_max - temp_ar média do dataset
T_CALOR_AGUDO, T_FRIO = 32.0, 7.0
TSOL_CRITICA, OD_CRITICO = 27.0, 4.0
ESTUFA_UR_OFFSET = 5.0
AERACAO_NORMAL = 0.84                 # média do gerador (0,70-0,98)
DIAS_CICLO = 45

COLUNAS = [
    "ce_ms_cm", "ph", "N", "temp_solucao_c", "od_mg_l", "nivel_reservatorio_pct",
    "temp_ar_c", "temp_max_c", "temp_min_c", "umidade_relativa_pct", "vpd_kpa",
    "dli_mol_m2_d", "dias_apos_transplante", "fase_crescimento", "fase_desenvolvimento",
    "fase_muda", "tolerancia_calor_tolerante",
]

CLASSES = {
    0: "não fazer nada",
    1: "travar/corrigir excesso",
    2: "repor/corrigir falta",
    3: "proteger",
}


def _posicao(valor, faixa):
    """0 no mínimo da faixa ideal do jogo, 1 no máximo (extrapola fora dela)."""
    largura = (faixa["max"] - faixa["min"]) or 1.0
    return (valor - faixa["min"]) / largura


def _fase(dias):
    if dias <= 10:
        return "muda"
    if dias <= 25:
        return "crescimento"
    if dias <= 40:
        return "desenvolvimento"
    return "colheita"


def _od_saturacao(t):
    return 14.652 - 0.41022 * t + 0.007991 * t ** 2 - 0.000077774 * t ** 3


def traduzir_entrada(snapshot):
    """Snapshot do jogo -> dicionário com as 17 colunas do modelo do grupo."""
    amb = snapshot["ambiente"]
    faixas = snapshot["cultura"]["faixas"]
    pos = {v: _posicao(amb[v], faixas[v]) for v in faixas}

    crescimento = float(snapshot.get("planta", {}).get("crescimento", 0.5))
    dias = max(1, min(DIAS_CICLO, round(1 + crescimento * (DIAS_CICLO - 1))))
    fase = _fase(dias)
    ce_min, ce_max = CE_POR_FASE[fase]

    # CE = concentração total da solução. Falta de qualquer nutriente puxa para baixo; sem falta,
    # o excesso do mais alto puxa para cima; dentro da faixa, a média.
    nutrientes = [pos["nitrogen"], pos["phosphorus"], pos["potassium"]]
    if min(nutrientes) < 0:
        p_ce = min(nutrientes)
    elif max(nutrientes) > 1:
        p_ce = max(nutrientes)
    else:
        p_ce = sum(nutrientes) / 3
    ce = max(0.1, ce_min + p_ce * (ce_max - ce_min))
    n = N_FURLANI * ce / CE_FORCA_PLENA

    ph = PH_BAIXO + pos["ph"] * (PH_ALTO - PH_BAIXO)
    nivel = min(100.0, max(0.0, RESERV_MINIMO + pos["soilMoisture"] * (100.0 - RESERV_MINIMO)))

    temp = T_BASE + pos["airTemperature"] * (T_PENDOAMENTO - T_BASE)
    temp_sol = 0.55 * temp + 0.45 * 21.0
    od = max(0.5, _od_saturacao(temp_sol) * AERACAO_NORMAL)

    externo = snapshot.get("clima", {}).get("externo", {})
    ur = min(100.0, max(0.0, float(externo.get("umidadeAr", 77)) + ESTUFA_UR_OFFSET))
    es = 0.6108 * math.exp(17.27 * temp / (temp + 237.3))
    vpd = max(0.0, es * (1 - ur / 100))
    dli = min(46.0, max(2.7, 0.4 * float(amb["luminosity"])))

    return {
        "ce_ms_cm": round(ce, 2), "ph": round(ph, 2), "N": round(n, 1),
        "temp_solucao_c": round(temp_sol, 1), "od_mg_l": round(od, 2),
        "nivel_reservatorio_pct": round(nivel, 1),
        "temp_ar_c": round(temp, 1), "temp_max_c": round(temp + AMPLITUDE_DIA, 1),
        "temp_min_c": round(temp - AMPLITUDE_DIA, 1),
        "umidade_relativa_pct": round(ur, 1), "vpd_kpa": round(vpd, 2), "dli_mol_m2_d": round(dli, 1),
        "dias_apos_transplante": dias,
        "fase_crescimento": fase == "crescimento", "fase_desenvolvimento": fase == "desenvolvimento",
        "fase_muda": fase == "muda", "tolerancia_calor_tolerante": False,
        "_fase": fase, "_ce_alvo": (ce_min, ce_max),
    }


def causa_provavel(x, classe):
    """Qual regra do gerador explica a classe (só para escolher a ferramenta e o texto)."""
    ce_min, ce_max = x["_ce_alvo"]
    if classe == 3:
        if x["temp_min_c"] < T_FRIO:
            return "frio"
        if x["temp_solucao_c"] > TSOL_CRITICA:
            return "solução quente"
        if x["od_mg_l"] < OD_CRITICO:
            return "pouco oxigênio"
        return "calor"
    if classe == 1:
        return "CE alta" if x["ce_ms_cm"] > ce_max else "pH alto" if x["ph"] > PH_ALTO else "excesso"
    if classe == 2:
        if x["ce_ms_cm"] < ce_min:
            return "CE baixa"
        if x["nivel_reservatorio_pct"] < RESERV_MINIMO:
            return "água baixa"
        if x["ph"] < PH_BAIXO:
            return "pH baixo"
        return "falta"
    return "tudo no ideal"


def escolher_ferramenta(classe, causa, sombra_ativa):
    """Classe do modelo + causa -> uma das 4 ações do jogo (e um complemento para o texto)."""
    if classe == 3:
        return ("DoNothing", "sombrite já ativo") if sombra_ativa else ("ProtectPlant", "")
    if classe == 1:
        # Travar do jogo drena o substrato e corrige o pH. Para CE alta, "travar a fertirrigação"
        # no jogo é simplesmente não irrigar agora (a planta consome o excesso).
        return ("DoNothing", "sem fertirrigar agora") if causa == "CE alta" else ("LockIrrigation", "")
    if classe == 2:
        return ("LockIrrigation", "o jogo corrige o pH ao travar") if causa == "pH baixo" else ("Irrigate", "")
    return "DoNothing", ""
