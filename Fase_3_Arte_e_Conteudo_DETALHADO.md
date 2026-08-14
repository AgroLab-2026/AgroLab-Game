# FASE 3 — Arte e Conteúdo
### Documento passo a passo · nível iniciante absoluto

Até aqui o jogo funciona, mas com quadradinhos no lugar da arte. Nesta fase damos **identidade visual** ao jogo: os desenhos do morango crescendo, o cenário da estufa, o rosto do Sr. Bruno, os ícones — e ainda **dobramos o conteúdo** adicionando alface e tomate (sem escrever código).

> **Pré-requisito:** Fases 1 e 2 concluídas. Você não precisa saber desenhar para seguir: pode usar arte gratuita (bancos de sprites pixel art) ou encomendar da equipe. Este guia ensina a **colocar a arte no jogo**, seja qual for a origem.

---

## PARTE A — Conceitos novos desta fase

- **Sprite:** uma imagem 2D usada no jogo (um personagem, um tile de chão, um ícone). Todo PNG que você importa e configura como sprite vira um.
- **Pixels Per Unit (PPU):** quantos pixels da imagem equivalem a 1 "metro" do mundo do jogo. No nosso projeto o padrão é **16**. Já configuramos um script (Fase 0) que aplica isso automaticamente à arte colocada em `Art`.
- **Sprite Sheet (folha de sprites):** uma única imagem que contém **vários** sprites lado a lado (por exemplo, todos os tiles do cenário juntos). Precisamos **"fatiar"** (slice) para o Unity separar cada pedacinho.
- **Tileset e Tilemap:** o *tileset* é o conjunto de "azulejos" (tiles) do cenário; o *tilemap* é a grade onde você **pinta** esses azulejos para montar o mapa.
- **Tile Palette (paleta de tiles):** a "caixa de tintas" com seus tiles, de onde você escolhe o que pintar.

---

## PARTE B — Passo a passo da Fase 3

### Passo 1 — Colocar os sprites das 5 fases do morango

**Por quê:** substituir os quadrados temporários pelo morango de verdade, crescendo em etapas.

1. Tenha 5 imagens (PNG), uma por fase: **muda → vegetativo → floração → frutificação → colheita**. Se forem 16×16 pixels, melhor (combina com o PPU 16).
2. No **explorador de arquivos do seu computador**, copie os 5 PNGs.
3. No Unity, na janela **Project**, entre em `Assets/_Project/Art/Crops/Morango` e **cole** ali (ou arraste os arquivos de fora para dentro dessa pasta).
   - Como essa pasta está dentro de `Art`, o script de importação aplica sozinho: filtro **Point** (pixels nítidos, sem borrão) e sem compressão. Você não precisa configurar nada.
4. Confirme que estão como sprite: clique num deles; no Inspector, **Texture Type** deve estar `Sprite (2D and UI)`. (Se não estiver, mude para isso e clique **Apply**.)
5. Agora ligue-os à cultura: clique no asset `Morango` (em `ScriptableObjects`). No campo **Growth Stages**, **substitua** cada quadrado temporário pelo sprite real correspondente (arraste o sprite para o slot; ordem: muda no Element 0, colheita no último).

**✅ Como testar:** aperte **Play** e deixe o crescimento avançar. A planta deve **trocar de desenho** conforme a barra sobe.

---

### Passo 2 — Montar o cenário: tileset da estufa e bancada

**Por quê:** dar um chão e uma bancada bonitos no lugar do fundo vazio.

**2.1 — Importar e fatiar o tileset**
1. Coloque a imagem do tileset (a folha com todos os azulejos) em `Assets/_Project/Art/Tilesets` (arraste para dentro).
2. Clique nela. No Inspector:
   - **Sprite Mode:** mude de `Single` para `Multiple` (porque a imagem tem vários tiles).
   - Clique em **Apply**.
   - Clique no botão **Sprite Editor** (se ele pedir para instalar o pacote "2D Sprite", aceite).
3. Na janela **Sprite Editor** que abriu:
   - No canto superior esquerdo, abra o menu **Slice**.
   - Em **Type**, escolha `Grid By Cell Size`.
   - Em **Pixel Size**, coloque X = `16`, Y = `16` (o tamanho de cada tile).
   - Clique **Slice** e depois **Apply** (no topo direito). Feche a janela.
   *(Agora, ao clicar na setinha do tileset na Project, você vê os tiles separados.)*

**2.2 — Criar a paleta e pintar**
1. Abra a janela da paleta: `Window → 2D → Tile Palette`.
2. Nela, clique em **Create New Palette**, dê um nome (ex.: `PaletaEstufa`) e salve dentro de `Art/Tilesets`.
3. **Arraste o tileset fatiado** (o arquivo, da Project) para dentro da janela Tile Palette. Ele vai pedir onde salvar os tiles — salve na mesma pasta. Agora a paleta mostra seus azulejos.
4. Na Hierarchy, você já deve ter os Tilemaps criados na Fase 0 (`Tilemap_Ground`, etc.). Se não tiver, crie: `GameObject → 2D Object → Tilemap → Rectangular`.
5. Na janela Tile Palette, **selecione um tile** (clicando nele) e escolha a ferramenta de **pincel** (ícone de pincel no topo da paleta). Depois, **na janela Scene, pinte** clicando/arrastando sobre a grade. Assim você desenha o chão.

**2.3 — Colisão (paredes e obstáculos)**
1. Selecione o `Tilemap_Collision` (a camada onde ficam pedras, cercas, água).
2. **Add Component → Tilemap Collider 2D.**
3. **Add Component → Composite Collider 2D.** Ao adicionar, ele traz junto um **Rigidbody 2D**.
4. No **Rigidbody 2D**, mude **Body Type** para `Static`.
5. No **Tilemap Collider 2D**, marque a caixinha **Used By Composite**.
   *(Isso junta todas as colisões numa só, mais leve e sem "brechas".)*

**✅ Como testar:** na aba Scene/Game, a estufa aparece desenhada. Se tiver personagem, ele não atravessa os obstáculos.

---

### Passo 3 — O rosto do Sr. Bruno

**Por quê:** dar um retrato ao tutor, deixando o diálogo mais humano.

1. Coloque a imagem do retrato do Bruno em `Assets/_Project/Art/UI`.
2. Confirme que é um sprite (Inspector → Texture Type = `Sprite (2D and UI)` → Apply).
3. Na Hierarchy, encontre o `imgBruno` (dentro da `CaixaBruno`, criada na Fase 2). Selecione-o.
4. No Inspector, no componente **Image**, campo **Source Image**, clique na bolinha à direita e escolha o retrato (ou arraste o sprite para o campo).

**✅ Como testar:** dê Play — a caixa de diálogo mostra o rosto do Bruno ao lado da fala.

---

### Passo 4 — Ícones das ações e dos recursos

**Por quê:** um ícone comunica mais rápido que uma palavra — importante numa projeção.

1. Tenha 7 ícones (PNG): 4 de ação (não fazer nada, travar, irrigar, proteger) e 3 de recurso (água, fertilizante, energia).
2. Coloque-os em `Assets/_Project/Art/UI` e confirme que são sprites.
3. Para os **botões**: dentro de cada botão (Fase 2), você pode adicionar `GameObject → UI → Image`, posicioná-la e definir o **Source Image** com o ícone da ação.
4. Para os **recursos**: crie pequenas Images ao lado do `txtRecursos`, cada uma com seu ícone.
5. Desenhe/escolha ícones de **alto contraste** (silhueta clara sobre fundo escuro) — eles precisam ser lidos de longe na estufa.

**✅ Como testar:** os botões e os recursos ficam reconhecíveis num relance.

---

### Passo 5 — Adicionar alface crespa e tomate (sem código!)

**Por quê:** mostrar a força do design orientado a dados — culturas novas são só **arquivos**, não programação.

1. Na Project, entre em `Assets/_Project/ScriptableObjects`.
2. Botão direito → `Create → Semente da Evolução → Cultura`. Renomeie para `AlfaceCrespa`.
3. Repita para criar `Tomate`.
4. Clique em `AlfaceCrespa` e preencha as faixas (valores iniciais sugeridos — **peça à equipe de IA para validar** com a pesquisa):

   **Alface crespa (clima ameno):**
   - Temperature Range: min `15`, max `22`
   - Ph Range: min `5.8`, max `6.2`
   - Moisture Range: min `60`, max `80`
   - Luminosity Range: min `50`, max `70`
   - Nitrogen `120`–`180` · Phosphorus `40`–`55` · Potassium `180`–`230`

5. Clique em `Tomate` e preencha:

   **Tomate (clima quente, exige potássio):**
   - Temperature Range: min `21`, max `27`
   - Ph Range: min `5.5`, max `6.8`
   - Moisture Range: min `55`, max `70`
   - Luminosity Range: min `70`, max `90`
   - Nitrogen `130`–`190` · Phosphorus `40`–`60` · Potassium `250`–`320`

6. Preencha o **Growth Stages** de cada uma com os sprites das fases dela.
7. Para **jogar** com outra cultura: selecione o `GameManager` na Hierarchy e, no campo **Crop**, arraste `AlfaceCrespa` ou `Tomate` no lugar do `Morango`.

**✅ Como testar:** troque a cultura no GameManager, dê Play, e note que **todas as regras mudam** (temperatura ideal, cores dos sensores, dicas do Bruno) — sem tocar em nenhuma linha de código.

---

## PARTE C — Onde conseguir arte (se você não desenha)

- Bancos de pixel art gratuitos costumam ter tilesets de fazenda/estufa e plantas.
- Você pode encomendar da frente de arte da equipe, entregando este documento como referência do que é preciso (5 fases por cultura, tiles 16×16, ícones de alto contraste).
- Enquanto a arte final não chega, os quadrados temporários **não impedem** as Fases 1, 2 e 4 de avançarem.

---

## PARTE D — Checklist final da Fase 3

- [ ] 5 sprites do morango importados e ligados no Growth Stages
- [ ] Tileset importado, fatiado (16×16) e paleta criada
- [ ] Cenário pintado no Tilemap
- [ ] Colisão configurada (Tilemap + Composite Collider + Rigidbody Static)
- [ ] Retrato do Bruno ligado ao `imgBruno`
- [ ] Ícones de ação e recurso no lugar
- [ ] Assets `AlfaceCrespa` e `Tomate` criados e preenchidos
- [ ] Trocar a cultura no GameManager muda o jogo inteiro

Com o visual pronto, seguimos para a **Fase 4**, onde o jogo é afinado, integrado ao hardware e validado com pessoas reais.
