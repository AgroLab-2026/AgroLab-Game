"""Treina o Random Forest da frente de IA exatamente como no notebook do grupo.

Reproduz a Parte 11 de AgroLab-IA/alface/EDA_Alface.ipynb: mesmas 13 colunas numéricas + fase e
tolerância ao calor (get_dummies), mesma separação treino/teste (75/25, estratificada,
random_state=42) e mesmos hiperparâmetros. Com o dataset do grupo, a acurácia no teste é 0,985.

Uso:
    python ia-servidor/treinar_modelo_equipe.py [caminho/dataset_nft.csv]

Sem caminho, procura o dataset num clone do AgroLab-IA ao lado do AgroLab-Game (ou em Downloads);
se não achar, baixa do repositório do grupo no GitHub (42 MB, uma vez só; fica em ia-servidor/dados/).
"""
import json
import sys
import urllib.request
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split

PASTA = Path(__file__).resolve().parent
CONFIG = json.loads((PASTA / "config_modelo.json").read_text(encoding="utf-8"))
URL_DATASET = "https://raw.githubusercontent.com/AgroLab-2026/AgroLab-IA/main/alface/nft/dataset_nft.csv"
RELATIVO = Path("alface") / "nft" / "dataset_nft.csv"

FEATS = ["ce_ms_cm", "ph", "N", "temp_solucao_c", "od_mg_l", "nivel_reservatorio_pct",
         "temp_ar_c", "temp_max_c", "temp_min_c", "umidade_relativa_pct",
         "vpd_kpa", "dli_mol_m2_d", "dias_apos_transplante"]


def achar_dataset():
    if len(sys.argv) > 1:
        return Path(sys.argv[1])
    raiz_jogo = PASTA.parent.parent  # .../AgroLab-Game
    candidatos = [PASTA / "dados" / "dataset_nft.csv"]
    for base in (raiz_jogo.parent, Path.home() / "Downloads", Path.home() / "Documents", Path.home()):
        for nome in ("AgroLab-IA", "AgroLab-IA-main", "agrolab-ia"):
            candidatos.append(base / nome / RELATIVO)
    for c in candidatos:
        if c.exists():
            return c
    destino = PASTA / "dados" / "dataset_nft.csv"
    destino.parent.mkdir(exist_ok=True)
    print(f"Dataset do grupo não encontrado no PC. Baixando do GitHub (42 MB):\n  {URL_DATASET}")
    temporario = destino.with_suffix(".parcial")
    urllib.request.urlretrieve(URL_DATASET, temporario)
    temporario.replace(destino)
    return destino


def main():
    caminho = achar_dataset()
    print(f"Lendo {caminho} ...")
    nft = pd.read_csv(caminho)

    # --- igual ao notebook (EDA_Alface.ipynb, Parte 11) ---
    cat = pd.get_dummies(nft[["fase", "tolerancia_calor"]], drop_first=True)
    X = pd.concat([nft[FEATS], cat], axis=1)
    y = nft.classe_acao
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=.25, random_state=42, stratify=y)
    rf = RandomForestClassifier(n_estimators=120, max_depth=18, min_samples_leaf=5,
                                n_jobs=-1, random_state=42, class_weight="balanced")
    print(f"Treinando com {len(X_tr):,} linhas (pode levar 1 minuto)...")
    rf.fit(X_tr, y_tr)
    pred = rf.predict(X_te)
    print(f"Acurácia no teste: {accuracy_score(y_te, pred):.3f} · F1 macro: {f1_score(y_te, pred, average='macro'):.3f}")

    destino = PASTA / CONFIG["arquivo"]
    joblib.dump(rf, destino, compress=3)
    print(f"Modelo salvo em {destino} ({destino.stat().st_size / 1e6:.1f} MB)")
    print(f"Colunas: {', '.join(X.columns)}")


if __name__ == "__main__":
    main()
