@echo off
REM Semente da Evolucao - sobe o servidor local e abre o jogo no navegador.
REM Tenta, nesta ordem: Node.js, Python e PowerShell (que ja vem no Windows).
REM IMPORTANTE: deixe esta janela aberta enquanto joga. Fechar = desligar o jogo.
title Semente da Evolucao - NAO FECHE ESTA JANELA enquanto estiver jogando
cd /d "%~dp0"
set PORTA=8080

if not exist "index.html" (
  echo Nao encontrei o index.html nesta pasta.
  echo Rode o iniciar.bat de dentro da pasta SementeDaEvolucao-Web, depois de EXTRAIR o ZIP.
  goto fim
)

where node >nul 2>nul
if not errorlevel 1 goto usar_node
python -c "import sys" >nul 2>nul
if not errorlevel 1 goto usar_python
goto usar_powershell

:usar_node
echo Iniciando o jogo com o Node.js...
call :abrir_navegador
node servidor.mjs %PORTA%
goto fim

:usar_python
echo Iniciando o jogo com o Python...
call :abrir_navegador
python -m http.server %PORTA% --bind 127.0.0.1
goto fim

:usar_powershell
echo Node.js e Python nao encontrados. Iniciando o jogo com o PowerShell do Windows...
call :abrir_navegador
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1" -Porta %PORTA%
goto fim

:abrir_navegador
REM Espera 2 segundos o servidor subir antes de abrir o navegador.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORTA%/%JOGO_QUERY%'"
exit /b

:fim
echo.
echo O servidor parou. Se apareceu algum erro acima, tire um print desta janela.
pause
