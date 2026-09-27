"""Servidor da IA do AgroLab: liga o modelo da frente de IA (Random Forest) ao jogo.

O jogo manda o estado da estufa autônoma em JSON (POST /decidir) e este servidor
responde {"acao", "motivo"} usando o modelo. Contrato completo em docs/contrato-ia.md.

Uso:  python ia-servidor/servidor_ia.py [config.json]
      (padrão: config_modelo.json, o Random Forest de alface NFT do grupo)
Depois abra o jogo com ?ia=http&iaUrl=http://localhost:5000/decidir
(o iniciar_com_ia.bat já faz tudo isso).

Culturas fora de config_modelo.json -> "culturas" respondem 422 e o jogo usa as
regras dele (fallback automático). O jogo também cai nas regras se este servidor
estiver desligado ou demorar mais de 800 ms.
"""
import json
import sys
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import joblib
import numpy as np

PASTA = Path(__file__).parent
ARQUIVO_CONFIG = Path(sys.argv[1]) if len(sys.argv) > 1 else PASTA / "config_modelo.json"
if not ARQUIVO_CONFIG.is_absolute() and not ARQUIVO_CONFIG.exists():
    ARQUIVO_CONFIG = PASTA / ARQUIVO_CONFIG.name
CONFIG = json.loads(ARQUIVO_CONFIG.read_text(encoding="utf-8"))
# "direto": as colunas do modelo são as 7 variáveis do jogo (config "colunas").
# "nft": o modelo de alface NFT do grupo, com o tradutor de adaptador_nft.py.
ADAPTADOR = CONFIG.get("adaptador", "direto")

ACOES = ["DoNothing", "LockIrrigation", "Irrigate", "ProtectPlant"]
NOMES_ACOES = {
    "DoNothing": "Não fazer nada",
    "LockIrrigation": "Travar irrigação",
    "Irrigate": "Irrigar",
    "ProtectPlant": "Proteger a planta",
}

# Apelidos aceitos para as colunas do modelo (se ele foi treinado com um DataFrame).
APELIDOS = {
    "nitrogen": ["n", "nitrogenio", "nitrogen"],
    "phosphorus": ["p", "fosforo", "phosphorus"],
    "potassium": ["k", "potassio", "potassium"],
    "ph": ["ph", "ph_solucao", "ph_da_solucao"],
    "airTemperature": ["temperatura", "temp", "temperatura_ar", "temperatura_do_ar", "temp_ar", "temperature"],
    "soilMoisture": ["umidade", "umidade_solo", "umidade_do_solo", "umidade_substrato", "umidade_do_substrato", "moisture"],
    "luminosity": ["luminosidade", "luz", "lux", "luminosity"],
}


def normalizar(texto):
    """'Umidade do Solo' -> 'umidade_do_solo' (sem acento, minúsculo)."""
    t = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode().lower().strip()
    return "".join(c if c.isalnum() else "_" for c in t).strip("_")


def variavel_da_coluna(coluna):
    n = normalizar(coluna)
    for variavel, apelidos in APELIDOS.items():
        if n in apelidos:
            return variavel
    for item in CONFIG["colunas"]:
        if normalizar(item["coluna"]) == n:
            return item["variavel"]
    raise ValueError(f"Não sei qual variável do jogo corresponde à coluna '{coluna}'. Ajuste config_modelo.json.")


def traduzir_rotulo(rotulo):
    """Saída do modelo (número ou texto) -> uma das 4 ações do jogo."""
    rotulos = {normalizar(k): v for k, v in CONFIG["rotulos"].items()}
    chave = normalizar(rotulo.item() if hasattr(rotulo, "item") else rotulo)
    if chave in rotulos:
        return rotulos[chave]
    if str(rotulo) in ACOES:
        return str(rotulo)
    raise ValueError(f"O modelo devolveu '{rotulo}', que não está em config_modelo.json -> rotulos.")


# ---------------------------------------------------------------- carrega o modelo
arquivo = PASTA / CONFIG["arquivo"]
if not arquivo.exists():
    treino = "treinar_modelo_equipe.py" if ADAPTADOR == "nft" else "treinar_modelo_exemplo.py"
    sys.exit(f"Modelo não encontrado: {arquivo}\nRode: python ia-servidor/{treino}\n"
             f"ou coloque o modelo na pasta ia-servidor e ajuste 'arquivo' em {ARQUIVO_CONFIG.name}.")
modelo = joblib.load(arquivo)

if ADAPTADOR == "nft":
    import adaptador_nft
    COLUNAS = list(getattr(modelo, "feature_names_in_", adaptador_nft.COLUNAS))
    faltando = set(COLUNAS) - set(adaptador_nft.COLUNAS)
    if faltando:
        sys.exit(f"O modelo usa colunas que o tradutor NFT não gera: {sorted(faltando)}")
    VARIAVEIS = ["(traduzidas por adaptador_nft.py)"]
else:
    if hasattr(modelo, "feature_names_in_"):
        COLUNAS = list(modelo.feature_names_in_)
    else:
        COLUNAS = [c["coluna"] for c in CONFIG["colunas"]]
    VARIAVEIS = [variavel_da_coluna(c) for c in COLUNAS]
CULTURAS = set(CONFIG.get("culturas") or [])


def prever(linha):
    """Classe prevista e confiança (0-1) para uma linha na ordem de COLUNAS."""
    entrada = linha
    if hasattr(modelo, "feature_names_in_"):
        import pandas as pd  # só quando o modelo foi treinado com DataFrame
        entrada = pd.DataFrame(linha, columns=COLUNAS)
    previsto = modelo.predict(entrada)[0]
    confianca = float(np.max(modelo.predict_proba(entrada)[0])) if hasattr(modelo, "predict_proba") else None
    return previsto, confianca


def com_confianca(texto, confianca):
    return texto if confianca is None else f"{texto} ({confianca:.0%} de confiança)"


def decidir_nft(snapshot):
    x = adaptador_nft.traduzir_entrada(snapshot)
    previsto, confianca = prever([[x[c] for c in COLUNAS]])
    classe = int(previsto)
    causa = adaptador_nft.causa_provavel(x, classe)
    acao, nota = adaptador_nft.escolher_ferramenta(classe, causa, snapshot.get("clima", {}).get("sombraAtiva", False))
    texto = f"{CONFIG['nome']}: {adaptador_nft.CLASSES[classe]}"
    if classe:
        texto += f" — {causa}"
    if nota:
        texto += f"; {nota}"
    return 200, {"acao": acao, "motivo": com_confianca(texto, confianca), "classe": classe, "entrada": {
        c: x[c] for c in COLUNAS if not c.startswith(("fase_", "tolerancia_"))} | {"fase": x["_fase"]}}


def decidir(snapshot):
    cultura = snapshot["cultura"]["id"]
    if CULTURAS and cultura not in CULTURAS:
        return 422, {"erro": f"O modelo não foi treinado para {cultura}; o jogo usa as regras."}
    if ADAPTADOR == "nft":
        return decidir_nft(snapshot)
    amb = snapshot["ambiente"]
    previsto, confianca = prever([[float(amb[v]) for v in VARIAVEIS]])
    acao = traduzir_rotulo(previsto)
    return 200, {"acao": acao, "motivo": com_confianca(f"{CONFIG['nome']}: {NOMES_ACOES[acao]}", confianca)}


class Tratador(BaseHTTPRequestHandler):
    def _responder(self, status, corpo):
        dados = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Content-Length", str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def do_OPTIONS(self):  # pré-verificação de CORS do navegador
        self._responder(204, {})

    def do_GET(self):  # teste rápido: abra http://localhost:5000/ no navegador
        self._responder(200, {"ok": True, "modelo": CONFIG["nome"], "arquivo": CONFIG["arquivo"],
                              "adaptador": ADAPTADOR, "colunas": COLUNAS, "variaveis_do_jogo": VARIAVEIS, "culturas": sorted(CULTURAS)})

    def do_POST(self):
        if self.path.rstrip("/") != "/decidir":
            return self._responder(404, {"erro": "use POST /decidir"})
        try:
            tamanho = int(self.headers.get("Content-Length", 0))
            snapshot = json.loads(self.rfile.read(tamanho) or b"{}")
            status, corpo = decidir(snapshot)
        except Exception as erro:  # o jogo cai nas regras se algo der errado aqui
            status, corpo = 500, {"erro": str(erro)}
        self._responder(status, corpo)

    def log_message(self, formato, *args):  # silencia o log de cada requisição
        pass


if __name__ == "__main__":
    porta = int(CONFIG.get("porta", 5000))
    print(f"IA do AgroLab rodando em http://localhost:{porta}/decidir")
    print(f"Modelo: {CONFIG['nome']} ({arquivo.name}) · culturas: {', '.join(sorted(CULTURAS)) or 'todas'}")
    print(f"Colunas do modelo: {', '.join(COLUNAS)}")
    print("Deixe esta janela aberta enquanto joga.")
    try:
        servidor = ThreadingHTTPServer(("127.0.0.1", porta), Tratador)
    except OSError:
        sys.exit(f"A porta {porta} já está em uso: provavelmente outra janela 'IA do AgroLab' já está aberta. "
                 "Use essa janela ou feche-a antes de abrir outra.")
    servidor.serve_forever()
