"""Treina um Random Forest PROVISÓRIO para a alface, no mesmo formato do modelo do grupo.

Serve para testar a integração enquanto o modelo de verdade não é colocado na pasta.
Uso: python ia-servidor/treinar_modelo_exemplo.py
Gera: ia-servidor/modelo_provisorio_alface.joblib
"""
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

PASTA = Path(__file__).parent
dados = pd.read_csv(PASTA / "dados_simulados_alfacecrespa.csv")
X = dados[["N", "P", "K", "pH", "temperatura", "umidade", "luminosidade"]]
y = dados["acao"]

X_treino, X_teste, y_treino, y_teste = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
modelo = RandomForestClassifier(n_estimators=120, max_depth=12, random_state=42, n_jobs=-1)
modelo.fit(X_treino, y_treino)
print(f"Acurácia no teste: {modelo.score(X_teste, y_teste):.1%}")

joblib.dump(modelo, PASTA / "modelo_provisorio_alface.joblib")
print("Modelo salvo em ia-servidor/modelo_provisorio_alface.joblib")
