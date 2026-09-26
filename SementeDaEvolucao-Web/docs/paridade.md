# Paridade C# (Unity) → JavaScript

**Situação das fontes.** No repositório `AgroLab-Game` existe só o `Assets/Scenes/GameManager.cs`. Os outros 9 scripts
(`EnvironmentState`, `CropData`, `PlantController`, `ResourceSystem`, `PlayerActionController`,
`AutonomousFarmAI`, `BrunoDialogue`, `WeatherEventSystem`, `HUDController`) **não estão versionados**. Estão
só no PC de vocês (`C:\Users\siraj\...\SementeDaEvolucao`), que este ambiente de nuvem não acessa.

Por isso o porte seguiu esta ordem de autoridade:
1. `GameManager.cs` (código real) e o `HUDController` da Fase 2 (código colado no guia);
2. os PDFs `Documentation/Pilar_1..8` (API pública, efeitos e prioridades de cada script);
3. os guias `Fase_1..4` e `Guia_Implementacao_Unity.md` (valores padrão e faixas);
4. o que faltou foi **reconstruído** e marcado abaixo. Todo número está em `data/*.json`, para que vocês
   possam trocar pelos valores do C# **sem mexer no código**.

Legenda: ✅ fiel (há fonte) · 🔧 reconstruído (sem fonte; ajustar com o C#) · ➕ regra nova (decisão da conversa)

## EnvironmentState — `js/core/EnvironmentState.js`

| Regra | Status | Onde |
|---|---|---|
| 7 variáveis: `nitrogen, phosphorus, potassium, ph, airTemperature, soilMoisture, luminosity` | ✅ Pilar 1 | classe `EnvironmentState` |
| `enum FarmAction { DoNothing, LockIrrigation, Irrigate, ProtectPlant }` | ✅ Pilar 1 | `FarmAction` |
| `IdealRange.Contains(v)` | ✅ Pilar 1 | `IdealRange.Contains` |
| `IdealRange.Stress(v)` de 0 a 1 | ✅ API / 🔧 fórmula: distância fora da faixa ÷ largura da faixa, limitada a 1 | `IdealRange.Stress` |
| `Clone()` | ✅ Pilar 1 | `EnvironmentState.Clone` |
| `SuggestAction(crop)` | ✅ API / 🔧 ordem: calor ou luz > máx → Proteger; umidade > máx → Travar; umidade < mín ou N/P/K < mín → Irrigar; pH fora → Travar; senão Nada (mesma ordem de prioridade do Bruno, Pilar 7) | `EnvironmentState.SuggestAction` |

## CropData — `js/crops/CropData.js` + `data/culturas.json`

| Regra | Status | Onde |
|---|---|---|
| `cropName`, `descricaoEducativa`, `growthPointsToHarvest = 100` | ✅ Fase 1 | JSON |
| 7 faixas (`nitrogenRange` … `luminosityRange`) | ✅ Alface e Tomate (Fase 3) · ✅ pH e temperatura do Morango (Guia) · 🔧 demais faixas do Morango | JSON |
| `EvaluateConditions(env)` de 0 a 1 | ✅ API / 🔧 fórmula: `1 − média dos 7 Stress` | `CropData.EvaluateConditions` |
| Estágios de crescimento | ✅ o prompt pede **6**; os guias falam em 3–5 sprites. Usamos 6: Semente, Muda, Vegetativo, Floração, Frutificação, Colheita | `balanceamento.planta.estagios` |
| `produtividadeKg` (kg por bancada) | ➕ para o painel "Produtividade" da referência | JSON |

## PlantController — `js/crops/PlantController.js`

| Regra | Status | Onde |
|---|---|---|
| `health` (0–100), `growthPoints` | ✅ Pilar 3 | campos |
| `baseGrowthRate`, `maxHealthDecay` | ✅ nomes / 🔧 valores 0.83 e 5 (rebalanceados para fases de 1:30) | `balanceamento.planta` |
| `Tick(env, dt)`: cresce mais rápido com boas condições e perde saúde com as ruins | ✅ comportamento / 🔧 fórmula: `growth += baseGrowthRate · q³ · (0.5 + 0.5·health/100) · dt`; se `q < 0.9`, `health −= maxHealthDecay · (1−q) · dt`; se `q ≥ 0.95`, `health += healthRegenRate · dt` (valores em `balanceamento.planta`) | `PlantController.Tick` |
| Planta "acinzentada" quando a saúde cai | ✅ Pilar 3 | render: dessaturação proporcional à saúde |

## ResourceSystem — `js/resources/ResourceSystem.js`

| Regra | Status | Onde |
|---|---|---|
| `water`/`waterMax`, `nutrientStock`, `energy`/`energyMax = 100`, `energyRegenPerSecond = 3` | ✅ Pilar 4 (50 L e 20 doses) / 🔧 v2: 30 L e 10 doses, para a água pesar numa fase de 1:30 | `balanceamento.recursos` |
| Regeneração em segundos **reais** (o `Update` do Unity usa `Time.deltaTime`, sem o `timeScale` do GameManager) | 🔧 | `ResourceSystem.Tick(dtReal)` |
| `TrySpend(água, fert, energia)` devolve `false` se faltar | ✅ Pilar 4 | `ResourceSystem.TrySpend` |
| `RefillWater()` | ✅ API / 🔧 custa 15 de energia | `ResourceSystem.RefillWater` |
| `OnResourceDepleted` | ✅ Pilar 4 | evento `OnResourceDepleted` |

## PlayerActionController — `js/resources/PlayerActionController.js`

| Regra | Status | Onde |
|---|---|---|
| `Execute(FarmAction)` devolve `false` se faltar recurso | ✅ Pilar 5 | `Execute` |
| Irrigar: +umidade, +N/P/K, custa água + fertilizante + energia | ✅ efeito / 🔧 valores | `acoesJogador.Irrigate` |
| Travar: −umidade, corrige o pH, custa energia | ✅ efeito / 🔧 valores | `acoesJogador.LockIrrigation` |
| Proteger: −luz, −temperatura, custa energia | ✅ efeito / 🔧 como sombra de 30 s (ver `decisoes.md` #6) | `acoesJogador.ProtectPlant` |
| Não fazer nada: sem custo | ✅ | `acoesJogador.DoNothing` |

## AutonomousFarmAI — `js/ai/AutonomousFarmAI.js`

| Regra | Status | Onde |
|---|---|---|
| Simulação paralela com ambiente clonado e planta própria | ✅ Pilar 6 | `AutonomousFarmAI` |
| Escolhe a melhor das 4 ações via `SuggestAction` | ✅ Pilar 6 | provedor `regras` |
| Gasta menos água por irrigação que o jogador | ✅ Pilar 6 / 🔧 valores (2 L × 5 L) | `balanceamento.ia.acoes` |
| `Tick(clima, dt)`, `waterUsed`, `actionsTaken`, `lastAction`, `ScoreboardLine()` | ✅ Pilar 6 | mesmos nomes |
| `Translate(action)` (estático, usado pelo GameManager) | ✅ GameManager.cs | `AutonomousFarmAI.Translate` |
| Intervalo de decisão de 1 s de jogo | 🔧 | `ia.intervaloDecisao` |

## BrunoDialogue — `js/ai/BrunoDialogue.js` + `data/falas.json`

| Regra | Status | Onde |
|---|---|---|
| `GetContextualTip(env, planta)` | ✅ Pilar 7 | mesmo nome |
| Prioridade: saúde crítica → calor/luz → encharcado → seco → pH → elogio | ✅ Pilar 7 | `BrunoDialogue.GetContextualTip` |
| Nutrientes baixos (entre "seco" e "pH") | ➕ para cobrir N/P/K | idem |
| Textos das falas | 🔧 o roteiro original do C# não está no repo | `falas.json` |

## WeatherEventSystem — `js/systems/WeatherEventSystem.js`

| Regra | Status | Onde |
|---|---|---|
| Eventos: Onda de Calor, Praga, Chuva Intensa, Falha de Energia | ✅ Pilar 8 | `clima.eventos` |
| Efeitos: Calor (+temp, +luz); Chuva (−luz, +umidade); Praga (−pH, −N); Falha (−umidade) | ✅ Pilar 8 / 🔧 intensidades | idem |
| `minInterval`/`maxInterval`, `eventDuration` | ✅ Pilar 8 (25–50 s) / 🔧 v2: 18–32 s e 12 s, para caber 2–3 eventos em 1:30 | idem |
| Tempo em segundos reais (corrotina) | 🔧 | `Tick(dtReal)` |
| `OnEventStarted(evt, desc)` / `OnEventEnded(evt)` | ✅ GameManager.cs | eventos |
| Falha de energia bloqueia a regeneração de energia | ➕ | `bloqueiaRegeneracao` |

## GameManager — `js/core/GameManager.js`

| Regra | Status | Onde |
|---|---|---|
| Uma única instância de `playerEnv` compartilhada | ✅ GameManager.cs | construtor |
| `timeScale = 2` | ✅ | `gameManager.timeScale` |
| Teclas 1–4 → DoNothing, LockIrrigation, Irrigate, ProtectPlant | ✅ | `js/main.js` (entrada) → `GameManager.DoAction` |
| Mensagens de HUD: "Você: {ação}" / "Recurso insuficiente para essa ação!" / "Sem {recurso}!" / "Tempo estável." | ✅ | `DoAction`, eventos |
| `UI_Nada/UI_Travar/UI_Irrigar/UI_Proteger` (Fase 2) | ✅ | `GameManager.UI_*` |
| Clima externo separado (proteger só esfria quem protegeu) | ✅ Fase 4, Passo 4 | `systems/ClimateModel.js` |
| 5 fases de 1:30, vitória ao colher, 3 tentativas + game over, tecnologias que só ajudam, pontuação em % da IA, relatório | ➕ decisões da conversa (`decisoes.md` #15–#21) | `systems/ProgressionSystem.js`, `GameManager` |

## Ritmo

O Unity roda por quadro com `dt = Time.deltaTime · timeScale`. Aqui a lógica roda em **passo fixo de 60 Hz**
(`dt = 1/60 · timeScale`), que é o ritmo de um Unity a 60 FPS, e o desenho roda com `requestAnimationFrame`.
