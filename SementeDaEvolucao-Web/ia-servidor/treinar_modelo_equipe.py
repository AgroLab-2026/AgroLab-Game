"""Treina o Random Forest de morango da frente de IA exatamente como no notebook do grupo.

Reproduz AgroLab-IA/morango/agrolab_morango_modelo.ipynb: as 15 colunas do dataset (tudo menos data,
acao_label e acao_nome), separação treino/teste 80/20 estratificada com random_state=42 e
RandomForestClassifier(n_estimators=300, class_weight='balanced', random_state=42). A classe é o
nome da ação ("Ideal", "Irrigar", "Proteger", "Travar Irrigação"), na mesma ordem do LabelEncoder
do notebook. Com o dataset do grupo, a acurácia no teste é 0,918.

Uso:
    python ia-servidor/treinar_modelo_equipe.py [caminho/agrolab_morango_dataset.csv]

Sem caminho, usa o dataset de um clone do AgroLab-IA ao lado do AgroLab-Game (ou em Downloads,
Documentos), que é a versão mais nova; se não achar, usa a cópia que vem com o jogo
(ia-servidor/dados_equipe/). Não precisa de internet.
"""
import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split

PASTA = Path(__file__).resolve().parent
CONFIG = json.loads((PASTA / "config_modelo.json").read_text(encoding="utf-8"))
RELATIVO = Path("morango") / "agrolab_morango_dataset.csv"


def achar_dataset():
    if len(sys.argv) > 1:
        return Path(sys.argv[1])
    raiz_jogo = PASTA.parent.parent  # .../AgroLab-Game
    for base in (raiz_jogo.parent, Path.home() / "Downloads", Path.home() / "Documents", Path.home()):
        for nome in ("AgroLab-IA", "AgroLab-IA-main", "agrolab-ia"):
            if (base / nome / RELATIVO).exists():
                return base / nome / RELATIVO
    return PASTA / "dados_equipe" / "agrolab_morango_dataset.csv"


def main():
    caminho = achar_dataset()
    print(f"Lendo {caminho} ...")
    df = pd.read_csv(caminho, sep=";", decimal=",", encoding="utf-8-sig")

    # --- igual ao notebook (agrolab_morango_modelo.ipynb) ---
    X = df.drop(columns=["data", "acao_label", "acao_nome"])
    y = df["acao_nome"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.20, stratify=y, random_state=42)
    rf = RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42)
    print(f"Treinando com {len(X_tr)} dias de dados...")
    rf.fit(X_tr, y_tr)
    pred = rf.predict(X_te)
    print(f"Acurácia no teste: {accuracy_score(y_te, pred):.3f} · F1 macro: {f1_score(y_te, pred, average='macro'):.3f}")
    print(f"Classes: {', '.join(rf.classes_)}")

    destino = PASTA / CONFIG["arquivo"]
    joblib.dump(rf, destino, compress=3)
    print(f"Modelo salvo em {destino} ({destino.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
