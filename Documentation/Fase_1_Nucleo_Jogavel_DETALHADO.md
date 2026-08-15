# FASE 1 — Núcleo Jogável
### Documento passo a passo · nível iniciante absoluto

Este documento parte do princípio de que **você nunca usou o Unity**. Cada clique é explicado. Leia a Parte A uma vez com calma; depois siga a Parte B na ordem, sem pular.

Ao final desta fase você vai **apertar o botão Play e ver duas plantas crescendo lado a lado** — a sua e a da inteligência artificial — reagindo a eventos de clima, com as teclas do teclado executando ações. É o coração do jogo funcionando.

---

## PARTE A — O Unity por dentro (leia se você é iniciante)

Quando você abre o Unity, a tela é dividida em **janelas**. Você não precisa decorar nada agora; volte aqui sempre que aparecer um nome estranho.

### As 6 janelas que importam

- **Hierarchy (Hierarquia)** — normalmente à **esquerda**. É a **lista de tudo que existe na cena atual**. Cada linha é um objeto. Pense nela como o "índice" do que está montado.
- **Scene (Cena)** — a janela grande no **centro**. É onde você **vê e move** os objetos como um editor. É a sua bancada de trabalho.
- **Game (Jogo)** — uma aba ao lado de "Scene". Mostra **como o jogador vai ver** quando você apertar Play. Você alterna entre "Scene" e "Game" clicando nas abas no topo dessa janela.
- **Inspector** — à **direita**. Mostra **todas as propriedades do objeto que você selecionou** na Hierarchy. É aqui que você digita valores e liga peças. Se nada estiver selecionado, ele fica vazio.
- **Project (Projeto)** — normalmente **embaixo**. É o **explorador de arquivos** do seu projeto: pastas, scripts, imagens, sons. Tudo que existe no disco aparece aqui.
- **Console** — uma aba embaixo (ou abra em `Window → General → Console`). Mostra **mensagens e, principalmente, ERROS em vermelho**. Sempre que algo não funcionar, olhe aqui primeiro.

### 6 palavras que você vai ouvir o tempo todo

- **GameObject (objeto)** — qualquer "coisa" na cena. Sozinho, é só uma caixa vazia. Ele ganha função quando recebe **componentes**.
- **Component (componente)** — uma "peça de comportamento" que você encaixa num objeto. Exemplos: *Sprite Renderer* faz o objeto **mostrar uma imagem**; *Plant Controller* (nosso script) faz o objeto **crescer**. Um objeto pode ter vários componentes empilhados.
- **Script** — um componente que **alguém programou**. Nossos 10 arquivos `.cs` são scripts. Você não vai escrever código nesta fase, só encaixá-los.
- **Asset** — qualquer arquivo dentro da janela Project (um script, uma imagem, um som).
- **ScriptableObject** — um tipo especial de asset que **guarda dados**. No nosso caso, a cultura "Morango" será um ScriptableObject: um arquivinho com as regras do morango.
- **Play (▶)** — o botão de triângulo no **topo central** da tela. Ao clicar, o jogo **roda de verdade** dentro do editor. Clique de novo para parar. ⚠️ Mudanças feitas **durante** o Play são desfeitas quando você para — teste à vontade, mas anote o que quiser manter.

### 4 ações manuais que você vai repetir muito

1. **Selecionar um objeto:** clique nele na **Hierarchy**. O Inspector à direita se enche com as propriedades dele.
2. **Criar um objeto vazio:** menu do topo `GameObject → Create Empty`. Ele aparece na Hierarchy com o nome "GameObject".
3. **Renomear:** clique no objeto na Hierarchy e aperte **F2** (ou dê dois cliques lentos no nome). Digite o novo nome e Enter.
4. **Adicionar um componente:** selecione o objeto, role o Inspector até o fim e clique no botão **Add Component**. Digite o nome do componente e clique nele na lista.
5. **Arrastar uma referência:** alguns campos no Inspector são "vazios" esperando um objeto. Você **clica e segura** um objeto (da Hierarchy ou do Project) e **solta** em cima do campo. É assim que ligamos as peças.

Pronto. Com isso você já consegue seguir tudo abaixo.

---

## PARTE B — Passo a passo da Fase 1

> **Pré-requisitos:** a Fase 0 (Fundação) concluída — projeto criado, câmera Pixel Perfect configurada, pastas prontas. Os 10 arquivos `.cs` baixados. A cena `Estufa.unity` aberta (dê dois cliques nela na pasta `Scenes` dentro do Project).

### Passo 1 — Colocar os 10 scripts nas pastas certas

**Por quê:** o Unity precisa "enxergar" os scripts organizados, e um deles (`PixelArtImportSettings`) **só funciona** dentro de uma pasta chamada `Editor`.

1. Na janela **Project**, clique nas pastas até chegar em `Assets/_Project/Scripts`. Você deve ver as subpastas `Core`, `Crops`, `Resources`, `AI`, `Systems` e `Editor` (criadas na Fase 0).
2. Localize os 10 arquivos `.cs` (se você os baixou, arraste-os de fora do Unity direto para dentro da pasta certa na janela Project, ou copie-os pelo explorador de arquivos do seu sistema).
3. Distribua exatamente assim (clique e arraste cada um para sua subpasta):
   - **Core:** `EnvironmentState.cs`, `GameManager.cs`
   - **Crops:** `CropData.cs`, `PlantController.cs`
   - **Resources:** `ResourceSystem.cs`, `PlayerActionController.cs`
   - **AI:** `AutonomousFarmAI.cs`, `BrunoDialogue.cs`
   - **Systems:** `WeatherEventSystem.cs`
   - **Editor:** `PixelArtImportSettings.cs`  ⚠️ *este obrigatoriamente aqui*
4. Depois de mover, o Unity vai **compilar** (processar os scripts). No canto **inferior direito** aparece um pequeno círculo girando. **Espere ele sumir.**
5. Abra a janela **Console** (aba embaixo, ou `Window → General → Console`).

**✅ O que você deve ver:** o Console **sem nenhuma linha vermelha**. Linhas cinzas ou amarelas (avisos) tudo bem; vermelho, não.

**⚠️ Se aparecer vermelho** mencionando `AssetPostprocessor` ou `UnityEditor`: o arquivo `PixelArtImportSettings.cs` **não está** na pasta `Editor`. Arraste-o para lá e espere recompilar.

---

### Passo 2 — Criar o "Morango" (a cultura)

**Por quê:** o jogo precisa saber as regras do morango (temperatura ideal, pH ideal, etc.). Guardamos isso num arquivo especial.

1. Na janela **Project**, clique na pasta `Assets/_Project/ScriptableObjects` para entrar nela.
2. **Clique com o botão direito** numa área vazia dessa pasta → no menu, vá em `Create → Semente da Evolução → Cultura`.
   *(Esse item de menu existe porque programamos o `CropData` para criá-lo.)*
3. Um novo arquivo aparece, já com o nome em modo de edição. Digite `Morango` e aperte Enter.
4. **Clique** no arquivo `Morango`. O **Inspector** (direita) mostra os campos dele:
   - **Crop Name:** apague e escreva `Morango`.
   - **Descricao Educativa:** já vem um texto; pode manter.
   - **Growth Points To Harvest:** deixe `100`.
   - As **faixas ideais** (Nitrogen Range, Ph Range, Temperature Range, etc.) já vêm preenchidas com valores do morango. Não precisa mexer agora.
5. **Growth Stages** (os desenhos das fases de crescimento). Como talvez você ainda não tenha arte, vamos criar quadrados temporários:
   - Na Project, entre em `Assets/_Project/Art/Crops/Morango`.
   - Botão direito → `Create → 2D → Sprites → Square`. Repita **5 vezes** (5 quadrados).
   - Volte a clicar no asset `Morango`. No campo **Growth Stages**, clique na setinha para expandir, mude **Size** para `5` e **arraste** cada quadrado para os slots (Element 0, 1, 2...).

**✅ O que você deve ver:** o asset `Morango` selecionado, com "Crop Name = Morango" e 5 sprites no campo Growth Stages.

---

### Passo 3 — Criar a planta do jogador

**Por quê:** este é o objeto que vai aparecer na cena e crescer conforme suas decisões.

1. Menu `GameObject → Create Empty`. Um objeto "GameObject" aparece na Hierarchy.
2. Renomeie para `PlantaJogador` (clique nele, F2, digite, Enter).
3. Com ele selecionado, no **Inspector**, encontre **Transform → Position** e digite: X = `-3`, Y = `0`, Z = `0`. (Isso o joga para a esquerda.)
4. Ainda no Inspector, clique em **Add Component**, digite `Sprite Renderer`, clique nele.
   - No componente Sprite Renderer que apareceu, encontre **Sorting Layer** e escolha `Objects`.
   - No campo **Sprite**, clique na bolinha à direita e escolha um dos quadrados que você criou (só para ele não ficar invisível; o jogo troca sozinho depois).
5. Clique em **Add Component** de novo, digite `Plant Controller`, clique nele.
   - **Deixe o campo Crop vazio.** Nosso maestro (Passo 6) preenche automaticamente.

**✅ O que você deve ver:** na janela **Scene**, um quadradinho à esquerda do centro.

---

### Passo 4 — Criar a estufa autônoma (a IA)

**Por quê:** a IA cultiva uma **cópia** da planta com o manejo "perfeito". É contra ela que o jogador se compara.

1. `GameObject → Create Empty` → renomeie para `EstufaAutonoma`.
2. `GameObject → Create Empty` de novo → renomeie para `PlantaIA`.
3. Na Hierarchy, **arraste `PlantaIA` para cima de `EstufaAutonoma`** e solte. Agora `PlantaIA` fica "dentro" (indentado) de `EstufaAutonoma` — ela virou **filha**.
4. Selecione `PlantaIA`:
   - **Position:** X = `3`, Y = `0`, Z = `0` (joga para a direita).
   - **Add Component → Sprite Renderer** (Sorting Layer `Objects`, e escolha um sprite quadrado).
   - **Add Component → Plant Controller** (Crop vazio).
5. Selecione `EstufaAutonoma` → **Add Component → Autonomous Farm AI**.
   - No campo **Ai Plant** desse componente, **arraste** o objeto `PlantaIA` da Hierarchy para lá.

**✅ O que você deve ver:** na Scene, **dois** quadradinhos — um à esquerda (jogador) e um à direita (IA).

---

### Passo 5 — Criar os sistemas de apoio

**Por quê:** são as "engrenagens" de recursos, ações do jogador, clima e o tutor Bruno.

1. `GameObject → Create Empty` → renomeie para `Sistemas`. Com ele selecionado, adicione **três** componentes (repita Add Component para cada):
   - `Resource System` (deixe os valores padrão: água 50, fertilizante 20, energia 100)
   - `Player Action Controller` (não preencha nada)
   - `Weather Event System` (não preencha o campo Target Env ainda)
2. `GameObject → Create Empty` → renomeie para `Bruno`. Adicione o componente `Bruno Dialogue`.

**✅ O que você deve ver:** na Hierarchy, os objetos `Sistemas` e `Bruno`. No Console, nenhum erro vermelho.

---

### Passo 6 — Configurar o GameManager (o maestro)

**Por quê:** este objeto é o **cérebro** que faz o tempo passar e conecta todas as peças. Sem ele, nada se mexe.

1. `GameObject → Create Empty` → renomeie para `GameManager`.
2. Selecione-o → **Add Component → Game Manager**.
3. O componente Game Manager tem vários campos vazios. Vamos **arrastar** um objeto para cada, assim:

   | Campo no Inspector | O que arrastar (da Hierarchy/Project) |
   |---|---|
   | **Crop** | o asset `Morango` (da janela Project) |
   | **Player Plant** | `PlantaJogador` |
   | **Ai AI** | `EstufaAutonoma` |
   | **Resources** | `Sistemas` |
   | **Player Actions** | `Sistemas` |
   | **Weather** | `Sistemas` |
   | **Bruno** | `Bruno` |

   *(Sim, `Sistemas` entra em três campos diferentes — está certo. Aqueles três componentes estão todos naquele objeto.)*
4. Encontre o campo **Time Scale** e coloque `2` (deixa o tempo do jogo 2× mais rápido, ótimo para testar).

**✅ O que você deve ver:** os **7 campos preenchidos**, nenhum escrito `None (…)`.

**⚠️ Se algum ficar como `None`:** você não soltou o objeto certo no campo. Arraste de novo, com calma.

---

### Passo 7 — Rodar e testar o jogo

**Por quê:** hora de ver tudo funcionando junto.

1. Aperte o botão **Play (▶)** no topo central. A janela muda para a aba **Game**.
2. No canto da tela aparece um painel de texto (um HUD provisório de teste). Ele mostra, à esquerda, a **sua** estufa (saúde, crescimento, as 7 variáveis, recursos e uma dica do Sr. Bruno) e, à direita, a **estufa autônoma**.
3. Use as teclas do teclado:
   - **1** = não fazer nada
   - **2** = travar irrigação
   - **3** = irrigar
   - **4** = proteger a planta
4. Espere de 20 a 50 segundos: uma mensagem de **evento climático** aparece (ex.: "Onda de calor!"). Observe a IA reagir na hora, enquanto você decide o que fazer.
5. Observe a **barra de crescimento** subindo e a diferença de **água gasta** entre você e a IA.
6. Aperte **Play (▶)** de novo para **parar**.

**✅ Resultado final da Fase 1:** o loop roda, os eventos aparecem e a comparação Jogador × IA acontece. **Parabéns — o jogo está vivo.**

**⚠️ Se as teclas 1–4 não fizerem nada:** o projeto está usando o novo sistema de entrada. Vá em `Edit → Project Settings → Player`, abra **Other Settings**, procure **Active Input Handling** e mude para **Both**. O Unity vai reiniciar; depois teste de novo.

**⚠️ Se aparecer `NullReferenceException` no Console ao dar Play:** algum campo do GameManager (Passo 6) ficou vazio. Pare o Play, revise a tabela e preencha.

---

## PARTE C — Checklist final da Fase 1

- [ ] Os 10 scripts nas subpastas certas, Console sem erros
- [ ] Asset `Morango` criado, com nome e 5 sprites
- [ ] `PlantaJogador` na cena (com Sprite Renderer + Plant Controller)
- [ ] `EstufaAutonoma` + `PlantaIA` + Autonomous Farm AI ligados
- [ ] `Sistemas` (3 componentes) e `Bruno` criados
- [ ] `GameManager` com os 7 campos preenchidos e Time Scale = 2
- [ ] Play roda, teclas 1–4 funcionam, evento climático aparece

Quando todos estiverem marcados, você está pronto para a **Fase 2 (o HUD de verdade)**.
