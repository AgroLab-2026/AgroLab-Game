# FASE 2 — HUD Real em Canvas (a interface do jogo)
### Documento passo a passo · nível iniciante absoluto

Nesta fase trocamos o painel de teste provisório por uma **interface de verdade**: números grandes, coloridos, legíveis de longe — porque o jogo será **projetado na parede de uma estufa de MDF** e visto à distância.

Esta é a **única fase com código novo**. Calma: você não precisa saber programar. Vou te dar o código pronto e ensinar **exatamente onde colar**.

> **Pré-requisito:** a Fase 1 concluída e funcionando. Se algum termo do Unity (Hierarchy, Inspector, componente, arrastar referência) parecer novo, leia a **Parte A do documento da Fase 1** primeiro.

---

## PARTE A — Conceitos novos desta fase (leia primeiro)

- **Canvas (tela de UI):** um objeto especial onde ficam **todos os elementos de interface** (textos, botões, barras). Tudo que é "HUD" mora dentro de um Canvas.
- **UI (interface do usuário):** os elementos com que o jogador interage ou lê: textos, botões, imagens, barras.
- **Panel (painel):** um retângulo de fundo que agrupa outros elementos. Serve para organizar e dar cor de fundo.
- **TextMeshPro (ou "TMP"):** o sistema moderno de **texto** do Unity. Quando você criar textos, eles serão "Text - TextMeshPro". Na primeira vez, o Unity pede para importar uns arquivos — a gente faz isso.
- **Slider:** originalmente um controle deslizante, mas nós vamos usá-lo travado, só como **barra de progresso** (crescimento e saúde).
- **Button (botão):** um elemento clicável. Vamos ligar cada botão a uma ação do jogo.
- **Editar um script:** abrir o arquivo `.cs` num editor de código (o Unity abre o **Visual Studio** ou o **VS Code** ao dar dois cliques no arquivo) e digitar/colar texto. Salvar com **Ctrl+S**. Ao voltar ao Unity, ele recompila sozinho.

---

## PARTE B — Passo a passo da Fase 2

### Passo 1 — Criar o Canvas e ativar o texto

**Por quê:** é a base onde toda a interface vai morar.

1. Menu `GameObject → UI → Canvas`. Isso cria **dois** objetos na Hierarchy: um `Canvas` e um `EventSystem` (o EventSystem é necessário para os botões funcionarem — não apague).
2. Se aparecer uma janelinha oferecendo **"Import TMP Essentials"**, clique em **Import**. Se não aparecer, faça manualmente: `Window → TextMeshPro → Import TMP Essential Resources`. Espere terminar.
3. Selecione o `Canvas` na Hierarchy. No Inspector, encontre o componente **Canvas Scaler** e configure:
   - **UI Scale Mode:** clique no menu e escolha `Scale With Screen Size`
   - **Reference Resolution:** X = `1920`, Y = `1080`
   - **Match:** arraste o controle para o meio (`0.5`)
   *(Isso faz a interface se ajustar ao tamanho da projeção.)*
4. Vamos dar um fundo escuro: `GameObject → UI → Panel`. Ele nasce dentro do Canvas. Renomeie para `FundoHUD`. No Inspector, no componente **Image**, clique no campo **Color** e escolha um tom bem escuro (ex.: um verde quase preto) com opacidade (**A**) alta.

**✅ O que você deve ver:** na aba **Game**, a tela toda fica escura.

---

### Passo 2 — Montar o painel do jogador

**Por quê:** é onde o jogador lê as 7 variáveis, a saúde, o crescimento e os recursos.

> **Dica de organização:** vamos criar vários textos. **O nome de cada um importa** — no Passo 7 ligamos cada nome ao código. Renomeie com cuidado, exatamente como escrito.

1. `GameObject → UI → Panel` → renomeie para `PainelJogador`. Posicione-o à esquerda (por enquanto pode deixar onde está; ajuste a posição depois arrastando na Scene ou pelo Rect Transform).
2. Agora crie os textos. Para **cada** um: `GameObject → UI → Text - TextMeshPro`, e renomeie. Crie estes 9:
   - `txtTituloJogador`
   - `txtN`, `txtP`, `txtK`, `txtPh`, `txtTemp`, `txtUmid`, `txtLuz`
   - `txtRecursos`
   *(Para escrever algo neles agora, é opcional: selecione, e no componente TextMeshProUGUI há um campo grande "Text" onde você digita. O jogo vai sobrescrever com os valores reais.)*
3. Aumente a fonte para leitura à distância: em cada texto, no componente TextMeshProUGUI, ache **Font Size** e coloque algo como `28` a `40`.
4. Crie as duas barras: para cada uma, `GameObject → UI → Slider`, e renomeie para `barGrowth` e `barHealth`. Em cada Slider:
   - Desmarque a caixinha **Interactable** (para o jogador não conseguir arrastar).
   - Em **Min Value** coloque `0` e **Max Value** coloque `1`.
   - *(Opcional, visual:* na Hierarchy, dentro do Slider há um objeto "Handle Slide Area" — pode desativá-lo desmarcando a caixinha no topo do Inspector, para some a bolinha.)*

**✅ O que você deve ver:** um painel à esquerda com vários textos e duas barrinhas.

---

### Passo 3 — Montar o painel da IA

**Por quê:** mostrar o desempenho da estufa autônoma para comparação.

1. `GameObject → UI → Panel` → renomeie para `PainelIA` (posicione à direita).
2. Dentro dele, crie **um** texto: `GameObject → UI → Text - TextMeshPro` → renomeie para `txtIA`. Aumente o Font Size também.

**✅ O que você deve ver:** um segundo painel, à direita, com um campo de texto.

---

### Passo 4 — Criar os 4 botões de ação

**Por quê:** além do teclado, o jogador poderá **clicar** para agir (essencial numa projeção com toque ou mouse).

1. Crie 4 botões. Para cada: `GameObject → UI → Button - TextMeshPro`. Renomeie assim:
   - `btnNada`, `btnTravar`, `btnIrrigar`, `btnProteger`
2. Cada botão tem um texto filho. Clique na setinha ao lado do botão na Hierarchy, selecione o "Text (TMP)" de dentro e escreva o nome da ação (ex.: "Proteger").

**✅ O que você deve ver:** quatro botões na tela. (Eles ainda não fazem nada — ligamos no Passo 7.)

---

### Passo 5 — Caixa de diálogo do Sr. Bruno

**Por quê:** é o canal do tutor, que transmite a mensagem educativa.

1. `GameObject → UI → Panel` → renomeie para `CaixaBruno` (rodapé).
2. Dentro dela, crie:
   - `GameObject → UI → Image` → renomeie para `imgBruno` (será o retrato).
   - `GameObject → UI → Text - TextMeshPro` → renomeie para `txtBruno`.

**✅ O que você deve ver:** uma caixa embaixo com espaço para retrato e fala.

---

### Passo 6 — Overlay de evento climático

**Por quê:** um aviso que **aparece** quando o clima ataca e **some** quando passa.

1. `GameObject → UI → Panel` → renomeie para `OverlayEvento` (centralizado).
2. Dentro: `GameObject → UI → Text - TextMeshPro` → renomeie para `txtEvento`.
3. **Importante:** selecione o `OverlayEvento` na Hierarchy e **desmarque a caixinha no canto superior esquerdo do Inspector** (ao lado do nome). Isso o **desativa** — ele fica escondido até um evento começar.

**✅ O que você deve ver:** o overlay some da tela (porque está desativado). Perfeito.

---

### Passo 7 — Ligar o HUD ao jogo (a parte de código)

Agora conectamos a interface aos números reais. Vamos: (A) criar um script novo, (B) fazer 5 pequenas edições no `GameManager`, (C) ligar tudo no Inspector.

#### 7A — Criar o script `HUDController`

1. Na janela **Project**, entre em `Assets/_Project/Scripts/Core`.
2. Botão direito → `Create → C# Script`. Renomeie **imediatamente** (enquanto o nome está editável) para `HUDController` (sem espaços; o nome do arquivo precisa bater com o nome da classe).
3. Dê **dois cliques** no `HUDController` para abrir o editor de código. Vai abrir o Visual Studio ou VS Code.
4. **Apague tudo** que estiver lá dentro e **cole** exatamente este conteúdo:

```csharp
using UnityEngine;
using UnityEngine.UI;
using TMPro;

// Lê o estado do jogo e mostra na interface do Canvas. Fica no objeto Canvas.
public class HUDController : MonoBehaviour
{
    [Header("Jogador - 7 variaveis")]
    public TMP_Text txtN, txtP, txtK, txtPh, txtTemp, txtUmid, txtLuz;
    [Header("Jogador - barras e recursos")]
    public Slider barGrowth, barHealth;
    public TMP_Text txtRecursos, txtTituloJogador;
    [Header("IA e Bruno")]
    public TMP_Text txtIA, txtBruno;
    [Header("Evento climatico")]
    public GameObject overlayEvento;
    public TMP_Text txtEvento;

    private readonly Color ok  = new Color(0.59f, 0.77f, 0.35f); // verde: na faixa
    private readonly Color bad = new Color(0.89f, 0.29f, 0.29f); // vermelho: fora

    public void UpdateHUD(GameManager gm)
    {
        var e = gm.playerEnv; var c = gm.crop;
        txtTituloJogador.text = "VOCE - " + c.cropName;

        SetVar(txtN,    "N",    e.nitrogen,       c.nitrogenRange.Contains(e.nitrogen));
        SetVar(txtP,    "P",    e.phosphorus,     c.phosphorusRange.Contains(e.phosphorus));
        SetVar(txtK,    "K",    e.potassium,      c.potassiumRange.Contains(e.potassium));
        SetVar(txtPh,   "pH",   e.ph,             c.phRange.Contains(e.ph));
        SetVar(txtTemp, "Temp", e.airTemperature, c.temperatureRange.Contains(e.airTemperature));
        SetVar(txtUmid, "Umid", e.soilMoisture,   c.moistureRange.Contains(e.soilMoisture));
        SetVar(txtLuz,  "Luz",  e.luminosity,     c.luminosityRange.Contains(e.luminosity));

        barGrowth.value = gm.playerPlant.growthPoints / c.growthPointsToHarvest;
        barHealth.value = gm.playerPlant.health / 100f;
        txtRecursos.text = "Agua " + gm.resources.water.ToString("0") + "L   Fert " +
            gm.resources.nutrientStock.ToString("0") + "   Energia " + gm.resources.energy.ToString("0");

        txtIA.text    = gm.aiAI.ScoreboardLine();
        txtBruno.text = "Sr. Bruno: " + gm.bruno.GetContextualTip(e, gm.playerPlant);
    }

    private void SetVar(TMP_Text t, string label, float value, bool inRange)
    {
        t.text = label + " " + value.ToString("0.#");
        t.color = inRange ? ok : bad;
    }

    public void ShowEvent(string desc) { overlayEvento.SetActive(true); txtEvento.text = desc; }
    public void HideEvent() { overlayEvento.SetActive(false); }
}
```

5. Salve com **Ctrl+S**. Volte ao Unity e espere compilar (círculo no canto inferior direito). O Console deve ficar sem erros.

#### 7B — Fazer 5 pequenas edições no `GameManager`

Dê dois cliques no `GameManager.cs` (em `Scripts/Core`) para abrir. Faça estas alterações:

1. **Adicionar o campo do HUD.** Encontre a linha `public BrunoDialogue bruno;` (na seção de referências). Logo **abaixo** dela, adicione uma linha nova:
   ```csharp
   public HUDController hud;
   ```
2. **Mandar o HUD atualizar.** Encontre o método `void Update()`. Na **última linha** dentro dele (logo depois de `aiAI.Tick(playerEnv, dt);`), adicione:
   ```csharp
   if (hud) hud.UpdateHUD(this);
   ```
3. **Ligar o clima ao overlay.** Dentro do método `Awake()`, encontre estas duas linhas:
   ```csharp
   weather.OnEventStarted += (evt, desc) => _weatherMsg = desc;
   weather.OnEventEnded   += (evt)       => _weatherMsg = "Tempo estável.";
   ```
   e **substitua** por estas:
   ```csharp
   weather.OnEventStarted += (evt, desc) => { _weatherMsg = desc; if (hud) hud.ShowEvent(desc); };
   weather.OnEventEnded   += (evt)       => { _weatherMsg = "Tempo estavel."; if (hud) hud.HideEvent(); };
   ```
4. **Apagar o painel de teste antigo.** Encontre o método inteiro que começa com `void OnGUI()` e **apague-o por completo** (desde `void OnGUI()` até a chave `}` que o fecha). Não precisamos mais do HUD provisório.
5. **Criar 4 comandos para os botões.** Logo antes da última chave `}` do arquivo (a que fecha a classe), cole:
   ```csharp
   public void UI_Nada()     { DoAction(FarmAction.DoNothing); }
   public void UI_Travar()   { DoAction(FarmAction.LockIrrigation); }
   public void UI_Irrigar()  { DoAction(FarmAction.Irrigate); }
   public void UI_Proteger() { DoAction(FarmAction.ProtectPlant); }
   ```
6. Salve (**Ctrl+S**) e volte ao Unity. Espere compilar; Console sem erros.

#### 7C — Conectar tudo no Inspector

1. Selecione o `Canvas` na Hierarchy → **Add Component → HUD Controller**.
2. O HUD Controller mostra vários campos vazios (txtN, txtP, barGrowth, etc.). **Arraste** cada elemento correspondente da Hierarchy para o seu campo:
   - `txtN` → campo **Txt N**, `txtP` → **Txt P**, e assim por diante para as 7 variáveis.
   - `barGrowth` → **Bar Growth**, `barHealth` → **Bar Health**.
   - `txtRecursos` → **Txt Recursos**, `txtTituloJogador` → **Txt Titulo Jogador**.
   - `txtIA` → **Txt IA**, `txtBruno` → **Txt Bruno**.
   - `OverlayEvento` → **Overlay Evento**, `txtEvento` → **Txt Evento**.
3. Selecione o `GameManager` → agora ele tem um campo novo **Hud**. Arraste o `Canvas` para lá.
4. **Ligar os botões.** Para **cada** botão (`btnNada`, `btnTravar`, `btnIrrigar`, `btnProteger`):
   - Selecione o botão. No Inspector, no componente **Button**, encontre a seção **On Click ()**.
   - Clique no **`+`** (adiciona uma linha).
   - No campo que diz "None (Object)", **arraste o `GameManager`** da Hierarchy.
   - No menu suspenso à direita (que diz "No Function"), escolha `GameManager → ` e a função certa:
     - `btnNada` → **UI_Nada**
     - `btnTravar` → **UI_Travar**
     - `btnIrrigar` → **UI_Irrigar**
     - `btnProteger` → **UI_Proteger**

**✅ Resultado final da Fase 2:** aperte **Play**. Você vê as 7 variáveis (verdes quando na faixa, vermelhas quando fora), as barras de crescimento e saúde se movendo, a linha da IA, a fala do Bruno atualizando, e ao clicar nos botões a ação acontece. Quando um evento de clima dispara, o overlay central aparece e some sozinho.

**⚠️ Erros comuns:**
- Vermelho citando `TMP_Text` ou `TMPro`: você não importou o TMP Essentials (Passo 1) — importe e recompile.
- Um texto não atualiza: você esqueceu de arrastá-lo para o campo certo no HUD Controller (Passo 7C-2).
- Botão não faz nada: faltou o `+` no On Click, ou escolheu a função errada (Passo 7C-4).
- `NullReferenceException`: algum campo do HUD Controller ou o campo Hud do GameManager ficou vazio.

---

## PARTE C — Checklist final da Fase 2

- [ ] Canvas criado, TMP importado, Canvas Scaler configurado (1920×1080)
- [ ] Painel do jogador com os 9 textos e as 2 barras, todos nomeados certo
- [ ] Painel da IA com `txtIA`
- [ ] 4 botões criados
- [ ] Caixa do Bruno (`imgBruno` + `txtBruno`)
- [ ] `OverlayEvento` criado e **desativado**
- [ ] Script `HUDController` criado e colado
- [ ] As 5 edições no `GameManager` feitas e salvas, sem erros
- [ ] Todos os campos do HUD Controller e o campo Hud preenchidos
- [ ] Os 4 botões ligados às funções UI_

Com tudo marcado, o jogo tem uma cara profissional e está pronto para receber a arte na **Fase 3**.
