@echo off
REM Semente da Evolucao - sobe o servidor local e abre o jogo no navegador.
REM Usa o Node se estiver instalado; senao, o Python.
cd /d "%~dp0"
set PORTA=8080
where node >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORTA%/"
  node servidor.mjs %PORTA%
  goto :fim
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORTA%/"
  python -m http.server %PORTA% --bind 127.0.0.1
  goto :fim
)
echo Nao encontrei Node.js nem Python instalados.
echo Instale o Node.js (https://nodejs.org) ou o Python (https://python.org) e rode de novo.
pause
:fim
