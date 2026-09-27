"""Servidor da IA do AgroLab: liga o modelo da frente de IA (Random Forest) ao jogo.

O jogo manda o estado da estufa autônoma em JSON (POST /decidir) e este servidor
responde {"acao", "motivo"} usando o modelo. Contrato completo em docs/contrato-ia.md.

Uso:  python ia-servidor/servidor_ia.py
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
CONFIG = json.loads((PASTA / "config_modelo.json").read_text(encoding="utf-8"))

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
    sys.exit(f"Modelo não encontrado: {arquivo}\nRode: python ia-servidor/treinar_modelo_exemplo.py (modelo provisório)\n"
             f"ou coloque o modelo do grupo na pasta ia-servidor e ajuste 'arquivo' em config_modelo.json.")
modelo = joblib.load(arquivo)

if hasattr(modelo, "feature_names_in_"):
    COLUNAS = list(modelo.feature_names_in_)
else:
    COLUNAS = [c["coluna"] for c in CONFIG["colunas"]]
VARIAVEIS = [variavel_da_coluna(c) for c in COLUNAS]
CULTURAS = set(CONFIG.get("culturas") or [])


def decidir(snapshot):
    cultura = snapshot["cultura"]["id"]
    if CULTURAS and cultura not in CULTURAS:
        return 422, {"erro": f"O modelo não foi treinado para {cultura}; o jogo usa as regras."}
    amb = snapshot["ambiente"]
    linha = [[float(amb[v]) for v in VARIAVEIS]]
    entrada = linha
    if hasattr(modelo, "feature_names_in_"):
        import pandas as pd  # só quando o modelo foi treinado com DataFrame
        entrada = pd.DataFrame(linha, columns=COLUNAS)
    previsto = modelo.predict(entrada)[0]
    acao = traduzir_rotulo(previsto)
    motivo = f"{CONFIG['nome']}: {NOMES_ACOES[acao]}"
    if hasattr(modelo, "predict_proba"):
        confianca = float(np.max(modelo.predict_proba(entrada)[0]))
        motivo += f" ({confianca:.0%} de confiança)"
    return 200, {"acao": acao, "motivo": motivo}


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
                              "colunas": COLUNAS, "variaveis_do_jogo": VARIAVEIS, "culturas": sorted(CULTURAS)})

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
    ThreadingHTTPServer(("127.0.0.1", porta), Tratador).serve_forever()
