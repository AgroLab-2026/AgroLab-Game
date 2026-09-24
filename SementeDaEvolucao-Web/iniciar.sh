#!/bin/sh
# Semente da Evolução - sobe o servidor local e abre o jogo (Linux/macOS).
cd "$(dirname "$0")"
PORTA=${1:-8080}
URL="http://localhost:$PORTA/"
abrir() { (sleep 1; command -v xdg-open >/dev/null && xdg-open "$URL" || open "$URL") >/dev/null 2>&1 & }
if command -v node >/dev/null 2>&1; then abrir; exec node servidor.mjs "$PORTA"; fi
if command -v python3 >/dev/null 2>&1; then abrir; exec python3 -m http.server "$PORTA" --bind 127.0.0.1; fi
echo "Instale o Node.js ou o Python 3 e rode de novo."; exit 1
