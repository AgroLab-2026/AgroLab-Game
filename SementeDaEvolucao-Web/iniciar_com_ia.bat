@echo off
REM Semente da Evolucao COM a IA do grupo (Random Forest).
REM 1) instala o scikit-learn se faltar; 2) treina o modelo provisorio se nao houver modelo;
REM 3) abre o servidor da IA numa janela; 4) abre o jogo ja ligado a IA.
cd /d "%~dp0"

python -c "import sklearn, joblib, pandas" >nul 2>nul
if errorlevel 1 (
  echo Instalando as bibliotecas da IA ^(scikit-learn, joblib, pandas^)...
  python -m pip install -r ia-servidor\requirements.txt
)

for /f "usebackq delims=" %%A in (`python -c "import json;print(json.load(open('ia-servidor/config_modelo.json',encoding='utf-8'))['arquivo'])"`) do set MODELO=%%A
if not exist "ia-servidor\%MODELO%" (
  echo Modelo "%MODELO%" nao encontrado: treinando o modelo PROVISORIO de alface...
  python ia-servidor\treinar_modelo_exemplo.py
)

start "IA do AgroLab - NAO FECHE" cmd /k python ia-servidor\servidor_ia.py
set "JOGO_QUERY=?ia=http&iaUrl=http://localhost:5000/decidir"
call iniciar.bat
