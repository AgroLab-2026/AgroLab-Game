@echo off
REM Semente da Evolucao COM a IA do grupo (Random Forest de morango do AgroLab-IA).
REM 1) instala o scikit-learn se faltar; 2) treina o modelo do grupo na primeira vez
REM    (com o dataset de morango que vem junto com o jogo, sem precisar de internet);
REM 3) abre o servidor da IA numa janela; 4) abre o jogo ja ligado a IA.
cd /d "%~dp0"

python -c "import sklearn, joblib, pandas" >nul 2>nul
if errorlevel 1 (
  echo Instalando as bibliotecas da IA ^(scikit-learn, joblib, pandas^)...
  python -m pip install -r ia-servidor\requirements.txt
)

if not exist "ia-servidor\modelo_equipe_morango.joblib" (
  echo Primeira vez: treinando o Random Forest de morango do grupo...
  python ia-servidor\treinar_modelo_equipe.py
)
if not exist "ia-servidor\modelo_equipe_morango.joblib" (
  echo.
  echo Nao consegui treinar o modelo do grupo. Veja a mensagem de erro acima.
  echo O jogo vai abrir mesmo assim, com a estufa autonoma usando as regras do jogo.
  pause
)

start "IA do AgroLab - NAO FECHE" cmd /k python ia-servidor\servidor_ia.py
set "JOGO_QUERY=?ia=http&iaUrl=http://127.0.0.1:5000/decidir"
call iniciar.bat
