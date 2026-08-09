# Semente da Evolução — Guia de Implementação no Unity

Do projeto vazio até um protótipo jogável onde você compara sua estufa com a estufa autônoma. Siga na ordem. Cada bloco termina num **✅ checkpoint** para confirmar que deu certo antes de seguir.

---

## 0. Pré-requisitos

- **Unity 6 (6000.x LTS)** ou Unity 2022 LTS. Use o template **2D (URP)** — o URP nos dá as luzes 2D que vão sustentar o clima e o dia/noite mais à frente.
- Os **10 scripts** já gerados:
  `PixelArtImportSettings`, `EnvironmentState`, `CropData`, `PlantController`, `ResourceSystem`, `PlayerActionController`, `AutonomousFarmAI`, `BrunoDialogue`, `WeatherEventSystem`, `GameManager`.

---

## 1. Estrutura de pastas e colocação dos scripts

Crie esta estrutura dentro de `Assets/` e distribua os arquivos:

```
Assets/_Project/
├── Art/Crops/Morango/        (sprites das fases — por ora pode usar quadrados coloridos)
├── ScriptableObjects/
└── Scripts/
    ├── Editor/   → PixelArtImportSettings.cs   ⚠️ TEM que ficar numa pasta "Editor"
    ├── Core/     → EnvironmentState.cs, GameManager.cs
    ├── Crops/    → CropData.cs, PlantController.cs
    ├── Resources/→ ResourceSystem.cs, PlayerActionController.cs
    ├── AI/       → AutonomousFarmAI.cs, BrunoDialogue.cs
    └── Systems/  → WeatherEventSystem.cs
```

**✅ Checkpoint:** volte ao Unity e espere a compilação. No canto inferior direito não pode haver erros vermelhos. Se houver, veja a seção *Solução de problemas* no fim.

---

## 2. Cena e câmera (Pixel Perfect)

1. `File → New Scene` → salve como `Estufa.unity` em `Scenes/`.
2. Selecione a **Main Camera** → `Add Component → Pixel Perfect Camera`.
3. Configure: **Assets Pixels Per Unit = 16**, **Reference Resolution = 320 × 180**, **Pixel Snapping = ligado**, **Crop Frame = Pillarbox**.
4. `Project Settings → Graphics`: **Transparency Sort Mode = Custom Axis**, **Sort Axis = (0, 1, 0)**. (É o que faz o top-down ter profundidade correta.)

**✅ Checkpoint:** a câmera está ortográfica e o jogo enquadra ~20 tiles de largura.

---

## 3. Criar o asset da cultura (Morango)

1. Menu `Assets → Create → Semente da Evolução → Cultura`. Renomeie para `Morango`.
2. Salve em `ScriptableObjects/`.
3. No Inspector, os valores já vêm pré-preenchidos com as faixas do morango (pH 5.5–6.5, temp 18–24 °C etc.). Confira contra a pesquisa da frente de IA e ajuste se quiser.
4. **Growth Stages:** arraste de 3 a 5 sprites na ordem muda → vegetativo → floração → frutificação → colheita. *Ainda não tem arte?* Crie sprites temporários: clique direito em `Art/Crops/Morango` → `Create → Sprite → Square` cinco vezes e use-os como placeholder.

**✅ Checkpoint:** o asset `Morango` existe e tem ao menos 1 sprite em *Growth Stages*.

---

## 4. Montar a planta do JOGADOR

1. Na Hierarchy: `Create Empty`, renomeie para `PlantaJogador`.
2. `Add Component → Sprite Renderer`. Defina o **Sorting Layer = Objects**.
3. `Add Component → Plant Controller`. Deixe o campo *Crop* vazio (o GameManager preenche).

**✅ Checkpoint:** `PlantaJogador` aparece na cena (mesmo que como um quadrado).

---

## 5. Montar a ESTUFA AUTÔNOMA (a IA)

1. `Create Empty`, renomeie para `EstufaAutonoma`.
2. Como filho dela, crie outro objeto `PlantaIA` com **Sprite Renderer** (Sorting Layer = Objects) e **Plant Controller** — é a planta-clone que a IA cultiva. Posicione-a à direita, separada da do jogador.
3. No objeto `EstufaAutonoma`: `Add Component → Autonomous Farm AI`. Arraste `PlantaIA` para o campo **Ai Plant**.

**✅ Checkpoint:** você tem duas plantas visíveis lado a lado na cena.

---

## 6. Adicionar os sistemas

Crie um objeto vazio `Sistemas` e adicione nele estes três componentes:

- **Resource System** — deixe os valores padrão (50 L de água, 20 doses, 100 de energia).
- **Player Action Controller** — não preencha nada agora (o GameManager conecta).
- **Weather Event System** — não preencha *Target Env* agora (idem).

Crie outro objeto vazio `Bruno` e adicione **Bruno Dialogue**.

**✅ Checkpoint:** nenhum erro no Console; os componentes aparecem com seus campos.

---

## 7. O maestro: GameManager

1. `Create Empty`, renomeie para `GameManager`. Adicione o componente **Game Manager**.
2. Arraste para os campos do Inspector:
   - **Crop** → o asset `Morango`
   - **Player Plant** → `PlantaJogador`
   - **Ai AI** → `EstufaAutonoma`
   - **Resources** → o objeto `Sistemas` (componente Resource System)
   - **Player Actions** → `Sistemas` (Player Action Controller)
   - **Weather** → `Sistemas` (Weather Event System)
   - **Bruno** → `Bruno`
3. Deixe **Time Scale = 2** para testar mais rápido.

> O GameManager, no `Awake()`, distribui automaticamente a cultura e o ambiente compartilhado para todos os outros sistemas. Por isso os campos *Crop*, *Player Env*, *Target Env* nos outros scripts podem ficar vazios.

**✅ Checkpoint:** todos os 7 campos do GameManager estão preenchidos (sem `None`).

---

## 8. Rodar e testar

1. Aperte **Play**.
2. No canto da tela aparece o HUD de debug: à esquerda sua estufa (saúde, as 7 variáveis, recursos e a dica do Bruno); à direita a estufa autônoma.
3. Use o teclado:
   - **1** — Não fazer nada
   - **2** — Travar irrigação
   - **3** — Irrigar
   - **4** — Proteger a planta
4. Espere alguns segundos: um **evento climático** vai disparar (ex: "Onda de calor!"). Observe a IA reagir na hora enquanto você decide o que fazer com seus recursos limitados.

**✅ Checkpoint final:** a barra de crescimento sobe, eventos aparecem, e você vê a diferença de água gasta entre você e a IA. **Isso é o loop educativo funcionando.**

---

## 9. Solução de problemas comuns

- **Erro "PixelArtImportSettings" / AssetPostprocessor:** o arquivo não está numa pasta chamada exatamente `Editor`. Mova-o.
- **As teclas 1–4 não respondem:** você está no novo Input System. Vá em `Project Settings → Player → Active Input Handling` e mude para **Both** (ou *Input Manager (Old)*).
- **Planta invisível:** o Sprite Renderer está sem sprite, ou o *Sorting Layer* está atrás do fundo. Confira o passo 4.
- **`NullReferenceException` no GameManager:** algum campo do Inspector ficou como `None`. Reveja o passo 7.
- **Sprites borrados:** a textura não passou pelo PixelArtImportSettings (não está em `Assets/_Project/Art/`) — selecione-a e force *Filter Mode = Point, Compression = None*.

---

## 10. Próximos passos (depois que o protótipo rodar)

1. **HUD de verdade:** trocar o `OnGUI` por um Canvas com alto contraste, pensado para ser **projetado na estufa de MDF** (fontes grandes, cores fortes, legível a distância).
2. **Arte das fases do morango:** substituir os placeholders pelos sprites pixel art reais.
3. **Alface crespa e tomate:** criar mais dois assets `CropData` — zero código novo, só dados.
4. **Refino do modelo:** desacoplar o "clima externo" do ambiente do jogador, para a IA reagir ao tempo bruto e não ao seu ambiente já protegido (hoje é uma simplificação proposital do protótipo).
5. **Integração com a frente de IA/Hardware:** alimentar o `EnvironmentState` com os dados simulados (e, no futuro, sensores reais da estufa).

---

*Dúvida em qualquer passo? Volte aqui que a gente destrava junto.*
