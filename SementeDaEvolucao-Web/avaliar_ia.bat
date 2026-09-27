@echo off
REM Compara a estufa autonoma com o modelo do grupo e com as regras do jogo (8 fases de alface).
REM Abra antes o iniciar_com_ia.bat (a janela "IA do AgroLab" precisa estar aberta).
cd /d "%~dp0"
node ia-servidor\avaliar_no_jogo.mjs
echo.
pause
