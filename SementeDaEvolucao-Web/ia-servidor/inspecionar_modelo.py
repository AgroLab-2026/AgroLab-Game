"""Mostra o que há dentro de um modelo treinado, para ligá-lo ao jogo.

Uso (no PC onde está o modelo):
    python ia-servidor/inspecionar_modelo.py "C:\\Users\\siraj\\Downloads\\Modelos"
    python ia-servidor/inspecionar_modelo.py "C:\\...\\Modelos\\modelo_alface.joblib"

Com uma pasta, inspeciona todos os .joblib/.pkl/.pickle/.sav dela. Copie a saída e
mande para a equipe do jogo: ela diz as colunas, a ordem e as classes do modelo.
"""
import pickle
import sys
from pathlib import Path

EXTENSOES = {".joblib", ".pkl", ".pickle", ".sav"}


def carregar(caminho):
    try:
        import joblib
        return joblib.load(caminho)
    except Exception:
        with open(caminho, "rb") as f:
            return pickle.load(f)


def descrever(caminho):
    print("=" * 70)
    print(f"Arquivo: {caminho.name}  ({caminho.stat().st_size / 1024:.0f} KB)")
    try:
        modelo = carregar(caminho)
    except Exception as erro:
        print(f"  Não consegui abrir: {erro}")
        return
    print(f"  Tipo: {type(modelo).__module__}.{type(modelo).__name__}")
    # Pipelines: mostra as etapas e olha o último estimador.
    if hasattr(modelo, "steps"):
        print(f"  Pipeline: {' -> '.join(nome for nome, _ in modelo.steps)}")
    alvo = modelo.steps[-1][1] if hasattr(modelo, "steps") else modelo
    for atributo in ("feature_names_in_", "n_features_in_", "classes_", "n_estimators", "max_depth"):
        valor = getattr(modelo, atributo, None)
        if valor is None:
            valor = getattr(alvo, atributo, None)
        if valor is not None:
            print(f"  {atributo}: {list(valor) if hasattr(valor, '__iter__') and not isinstance(valor, str) else valor}")
    versao = getattr(modelo, "__getstate__", lambda: {})().get("_sklearn_version") if hasattr(modelo, "__getstate__") else None
    if versao:
        print(f"  Treinado com scikit-learn {versao}")
    if isinstance(modelo, dict):
        print(f"  É um dicionário com as chaves: {list(modelo.keys())}")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    alvo = Path(sys.argv[1])
    arquivos = sorted(p for p in alvo.iterdir() if p.suffix.lower() in EXTENSOES) if alvo.is_dir() else [alvo]
    if not arquivos:
        sys.exit(f"Nenhum modelo (.joblib/.pkl/.pickle/.sav) em {alvo}")
    try:
        import sklearn
        print(f"scikit-learn instalado neste PC: {sklearn.__version__}")
    except ImportError:
        print("scikit-learn NÃO está instalado neste PC (python -m pip install scikit-learn joblib)")
    for caminho in arquivos:
        descrever(caminho)


if __name__ == "__main__":
    main()
