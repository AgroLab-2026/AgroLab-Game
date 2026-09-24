# Semente da Evolução — versão web

Serious game 2D top-down de agricultura de precisão (frente "Game" da iniciação científica AgroLab).
Você é um fazendeiro que desconfia da tecnologia e cuida de uma estufa ao lado de uma **estufa autônoma**
controlada por IA. Nas 7 fases você libera tecnologias, diminui a distância para a IA e, na última, trabalha
**junto** com ela.

HTML + CSS + JavaScript puro (ES modules), sem build e sem `node_modules`.

![Jogo × referência](docs/comparacao/final-lado-a-lado.png)

## Como rodar

**Windows:** dois cliques em `iniciar.bat`. Ele sobe o servidor local (Node ou Python) e abre o navegador em
`http://localhost:8080/`.

**Linux/macOS:** `./iniciar.sh`

**Manual:** `node servidor.mjs` (ou `python -m http.server 8080`) e abrir `http://localhost:8080/`.

> Abrir o `index.html` direto (duplo clique, `file://`) **não funciona**: navegadores bloqueiam ES modules fora de
> um servidor.

## Controles

| Tecla | Ação |
|---|---|
| 1 | Aguardar (não fazer nada) |
| 2 | Travar irrigação |
| 3 | Irrigar |
| 4 | Proteger a planta (sombrite por 30 s de jogo) |
| R | Encher o tanque de água |
| P / Espaço | Pausa |
| Enter | Confirmar (telas de fase) |
| F | Tela cheia (projetor) |
| B | Minimizar a fala do Sr. Bruno |
| ` (crase, ao lado do 1) | Modo debug: FPS, variáveis, velocidade 1×/2×/4×, disparar eventos, sobrepor a referência |

Também dá para clicar nas ferramentas do painel esquerdo. Um Arduino pode emular as teclas 1–4 como teclado USB.

## Parâmetros de URL

| Parâmetro | Exemplo | Efeito |
|---|---|---|
| `ia` | `?ia=mock` | Provedor de IA: `regras` (padrão), `mock` ou `http` |
| `iaUrl` | `?ia=http&iaUrl=http://localhost:5000/decidir` | Endpoint da IA de vocês |
| `mockAcoes` | `?ia=mock&mockAcoes=Irrigate,DoNothing` | Sequência fixa do mock |
| `falasUrl` | `?falasUrl=http://localhost:5000/fala` | Gerador externo das falas do Bruno |
| `fase` / `cultura` | `?fase=3&cultura=Tomate` | Começar numa fase/cultura (útil para apresentar) |
| `semente` | `?semente=42` | Clima reproduzível |
| `intro=0`, `debug=1` | | Pular a tela de introdução; abrir o debug |

## Teste headless

```
node tests/simular.mjs
```

Roda ciclos completos das 3 culturas sem navegador e confere: nenhum NaN, recursos dentro dos limites, as 6 fases
de crescimento, o fazendeiro sozinho nunca passando de 100 % da IA, a parceria (fase 7) melhor que a fase 1 e o
fallback dos provedores de IA (sem URL, timeout, resposta inválida, mock).

## Estrutura

```
index.html, css/estilo.css     HUD em HTML/CSS (palco 1024×682 = a referência)
data/                          balanceamento, culturas, fases/tecnologias, falas, config da IA (JSON)
js/core/                       GameManager, EnvironmentState          ┐
js/crops/                      CropData, PlantController              │ simulação: sem DOM/Canvas,
js/resources/                  ResourceSystem, PlayerActionController │ roda no Node
js/systems/                    WeatherEventSystem, ClimateModel,      │
                               ProgressionSystem                      │
js/ai/                         AutonomousFarmAI, BrunoDialogue,       │
                               IAProvider + provedores/               ┘
js/render/                     mundo em Canvas 512×341 (pixel art gerada por código)
js/ui/                         HUDController, Vistas, TelasFase, Debug, Escala
tests/simular.mjs              teste headless
docs/                          spec visual, paridade C#→JS, decisões, contrato da IA, assets pendentes, comparação
```

Os nomes das classes e métodos são os mesmos do C# (`Tick`, `Execute`, `TrySpend`, `SuggestAction`,
`EvaluateConditions`, `GetContextualTip`, `ScoreboardLine`...). Ver `docs/paridade.md`.

## Documentação

- `docs/spec-visual.md`: regiões, paleta, tipografia e molduras medidas da referência
- `docs/paridade.md`: cada regra do C# e onde ela está no JS (fiel, reconstruída ou nova)
- `docs/decisoes.md`: decisões assumidas durante o porte
- `docs/contrato-ia.md`: como ligar a IA de vocês
- `docs/assets-pendentes.md`: o que trocar por arte desenhada
- `docs/comparacao/`: capturas e diferenças em relação à referência

## Próximo passo: executável

Para gerar um `.exe` (sem navegador aparente, tela cheia no projetor), basta empacotar esta pasta com
**Electron** ou **Tauri**. O jogo já roda sem build, então o empacotamento é só um `main.js` do Electron
apontando para o `index.html`.
