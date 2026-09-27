@echo off
REM Semente da Evolucao COM a IA do grupo (Random Forest de alface NFT do AgroLab-IA).
REM 1) instala o scikit-learn se faltar; 2) treina o modelo do grupo na primeira vez
REM    (usa o dataset do AgroLab-IA; se nao achar no PC, baixa do GitHub);
REM 3) abre o servidor da IA numa janela; 4) abre o jogo ja ligado a IA.
cd /d "%~dp0"

python -c "import sklearn, joblib, pandas" >nul 2>nul
if errorlevel 1 (
  echo Instalando as bibliotecas da IA ^(scikit-learn, joblib, pandas^)...
  python -m pip install -r ia-servidor\requirements.txt
)

set "CONFIG_IA=config_modelo.json"
if not exist "ia-servidor\modelo_equipe_alface_nft.joblib" (
  echo Primeira vez: treinando o Random Forest do grupo ^(alface NFT^)...
  python ia-servidor\treinar_modelo_equipe.py
)
if not exist "ia-servidor\modelo_equipe_alface_nft.joblib" (
  echo.
  echo Nao consegui treinar o modelo do grupo ^(sem o dataset no PC e sem internet?^).
  echo Usando o modelo PROVISORIO, treinado com dados do simulador do jogo.
  set "CONFIG_IA=config_provisorio.json"
  if not exist "ia-servidor\modelo_provisorio_alface.joblib" python ia-servidor\treinar_modelo_exemplo.py
)

start "IA do AgroLab - NAO FECHE" cmd /k python ia-servidor\servidor_ia.py %CONFIG_IA%
set "JOGO_QUERY=?ia=http&iaUrl=http://localhost:5000/decidir"
call iniciar.bat
