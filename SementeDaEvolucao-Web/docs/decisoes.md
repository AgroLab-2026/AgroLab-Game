# Decisões assumidas

Registro das decisões tomadas sem consultar a equipe, por não bloquearem o trabalho. Cada uma pode ser revista.

1. **Local do projeto.** O prompt pedia `C:\Users\siraj\OneDrive\Documents\SementeDaEvolucao-Web`, mas este trabalho
   rodou num ambiente de nuvem, sem acesso ao seu PC. O projeto web ficou em `SementeDaEvolucao-Web/`, dentro do
   repositório `AgroLab-Game`, no branch `claude/hydroponic-farm-game-bj8q2r`. Para usar no Windows, é só copiar
   essa pasta.
2. **Scripts C# ausentes.** Só o `GameManager.cs` está no repositório. As regras vieram dos PDFs dos Pilares e dos
   guias das Fases; o que faltou foi reconstruído e está marcado em `paridade.md`. Todos os números ficam em `data/`.
3. **Assets ausentes.** As pastas `Art/Sunnyside`, `_Generated` e `Greenhouse` não estão no repositório. **Toda a arte
   é pixel art gerada por código** (`js/render/`): cenário, plantas, fazendeiro, robôs, molduras, ícones e o retrato do
   Sr. Bruno. Com isso não há nenhuma arte do Stardew Valley no projeto. Para trocar por arte desenhada, ver
   `assets-pendentes.md`.
4. **Fonte.** ~~Pixelify Sans~~ → **Nunito** (licença OFL), arredondada e simples, a pedido da equipe (v2). Vem do
   Google Fonts; sem internet cai na Trebuchet MS / Segoe UI, que têm largura parecida e mantêm o layout. Para
   rodar 100 % offline com a Nunito, basta copiar o `.woff2` para `fonts/` (peço autorização).
5. **Escala.** Palco de 1024 × 682 (a proporção da referência), com o mundo desenhado a 512 × 341 e escalado por um
   **fator inteiro** (2×, 3×…). O HUD acompanha a mesma escala. Numa tela 16:9 sobram faixas laterais, preenchidas
   com folhagem.
6. **Proteger vira sombra temporária.** Com o clima externo da Fase 4 (Passo 4), a temperatura e a luz da bancada
   relaxam em direção ao clima externo. Uma redução pontual seria apagada no tick seguinte, então Proteger aplica uma
   sombra de 30 s de jogo (−6 °C, −30 % de luz).
7. **6 estágios** de crescimento, como pede o prompt (os guias falam em 3–5).
8. **Controle na estufa.** Não sei ainda se será teclado, controle, touch ou Arduino. O jogo aceita **teclado**
   (1–4, R, P) e **mouse** (clique nas ferramentas). Um Arduino pode emular as teclas 1–4 como um teclado USB, sem
   mudar o código.
9. **Fases e tecnologias** (decisão da conversa; *substituída na v2, ver #15*): 7 fases, cada uma libera uma tecnologia do painel TECNOLOGIAS IA;
   a 7ª é a parceria fazendeiro + IA. Ver `data/progressao.json`.
10. **Pontuação** em "% da eficiência da IA" (decisão da conversa): 50 % produtividade, 25 % água por kg e 25 % energia
    por kg, cada razão limitada a 100 %. Não há trava artificial: a IA vence por reagir a cada segundo e gastar menos
    por ação.
11. **Rótulos do HUD.** A referência repete "Ajuste Manual de Ventilação" em várias barras e usa nomes em inglês nas
    tecnologias. Esses textos parecem ser erros da imagem gerada. Usamos os nomes reais das variáveis e das
    tecnologias, em português.
12. **Ferramentas iniciais.** Os itens da referência (Rake, Axe, Hoe, Seeds) viraram as ferramentas que o jogo usa de
    verdade: Irrigar, Travar irrigação, Proteger, Aguardar e Reabastecer água, com os mesmos ícones de ferramenta.
13. **Clima base centrado na cultura.** Com o clima fixo em 22 °C e 65 % de luz, o tomate (21–27 °C, 70–90 % de luz)
    ficava cronicamente fora da faixa, e nenhuma das 4 ações aquece ou ilumina. O teste headless mostrou o
    tomate morrendo sem culpa do jogador. Agora o clima externo oscila ao redor do centro da faixa da cultura (a
    estufa é montada para ela), e os eventos continuam empurrando as variáveis para fora.
14. **Intervalo de decisão da IA** de 1 s de jogo (*números de balanceamento substituídos na v2, ver #20*). O fazendeiro "atento" do teste (reage a cada 4 s reais) fica em
    ~69 % da IA; quem não faz nada perde a planta; na fase 7, com a IA assistente, sobe para ~88 %.

## v2 — pedidos da equipe (depois de jogar a primeira versão)

15. **5 fases** (eram 7). As tecnologias chegam em grupos: fase 2 medidor; 3 timer; 4 sensor + sombrite; 5 painel
    de dados + IA assistente (`data/progressao.json`).
16. **1:30 por fase** (tempo real, `fase.tempoLimiteReal`), com cronômetro na lousa "FASE N DE 5".
17. **Dá para vencer.** Vitória = colher antes do tempo acabar. Derrota = a planta morre ou o tempo acaba. Só avança
    quem vence; ~~3 tentativas por fase~~ (*v3: 3 vidas para o jogo inteiro, ver #22*) e, depois, **game over** → recomeça da fase 1. A
    comparação com a IA continua (% da eficiência), mas como aprendizado, não como condição de derrota.
18. **Nada age sozinho na estufa do jogador.** Antes, o sensor de umidade, o sombrite e a IA assistente agiam por
    conta própria (e o fazendeiro andava sozinho). Agora as tecnologias só **medem, avisam, sugerem ou barateiam**:
    o sensor faz o botão certo piscar; o sombrite reforçado dura o dobro e custa metade; a IA assistente marca o
    botão "IA sugere". Só a estufa autônoma (a rival) age sozinha.
19. **Gastos visíveis.** Cada ferramenta mostra o custo (água, energia, fertilizante) e risca o recurso que falta;
    os recursos têm barra e valor absoluto (ex.: 25/30 L); cada ação faz subir o valor gasto ao lado do recurso e um
    aviso com o custo; Proteger mostra a sombra restante; os cards de comparação mostram litros e energia usados;
    o relatório lista os gastos por ação.
20. **Rebalanceamento** (varredura com o teste headless, 18 partidas por perfil): evaporação 0,4/s, consumo de
    nutrientes 0,3/0,1/0,35, crescimento `0,83 · q³ · (0,5 + 0,5·saúde)`, perda de saúde 5·(1−q), tanque de 30 L,
    10 doses de fertilizante, eventos a cada 18–32 s por 12 s. Resultado: quem fica parado perde sempre (não passa de
    ~70 % da colheita); quem reage a cada 20 s vence ~55 % das vezes; a cada 12–15 s, ~85 %; a cada 9 s ou menos,
    sempre, colhendo em ~65 s.
21. **Regras da IA com sombra ativa.** Quando a sombra já está ativa, o provedor `regras` passa para a próxima
    prioridade (ex.: irrigar) em vez de responder "aguardar".

## v3 — mais pressão e vidas para o jogo inteiro

22. **3 vidas para o jogo inteiro** (antes eram 3 tentativas por fase). Cada derrota gasta uma vida e repete a mesma
    fase; vencer não devolve vida; sem vidas, game over e recomeço da fase 1 (`progressao.json → vidas`). Pensado para
    o evento: cada visitante joga com 3 vidas.
23. **Sombrite não gela a estufa.** A sombra corta o excesso de calor e de luz, mas não leva a temperatura nem a luz
    abaixo do centro da faixa da cultura. Antes, o Sombrite Reforçado (duração dobrada) deixava o morango frio e
    escuro depois da onda de calor, e até o jogador atento perdia na fase 4.
24. **Mais pressão** (varredura com 8 partidas × 5 fases por perfil): evaporação 0,46/s, eventos a cada 15–28 s,
    energia recarrega 2,5/s, crescimento 0,78. Resultado: parado nunca vence; reagindo a cada 20 s, ~37 %; 15 s,
    ~65 %; 12 s, ~78 %; 9 s, ~93 %; 6 s, 100 %. Quem vence colhe em ~70–74 s (pouca folga no 1:30).

## v4 — efeitos sonoros

25. **Sons sintetizados por código** (`js/audio/Sons.js`, Web Audio API), sem nenhum arquivo de áudio: funcionam offline
    e não têm problema de direitos autorais. Irrigar (jato de água e gotas), travar (registro metálico), proteger
    (tecido do sombrite), encher água (balde borbulhando), gasto de energia (faísca), alerta de água/energia baixa,
    ação negada, bipe dos robôs da IA, onda de calor (zumbido e cigarras), chuva contínua com trovão, praga (insetos),
    falta de luz e volta da energia, tique do cronômetro nos últimos 10 s (mais agudo nos 5 finais), alarme de tempo
    esgotado, e músicas curtas de vitória, derrota, game over e vitória final. Tecla **M** ou o botão ao lado do
    título liga/desliga (a escolha fica salva no navegador). O áudio começa no primeiro clique ou tecla, porque o
    navegador bloqueia som antes disso, e pausa junto com o jogo.
26. **Som mais alto e diagnóstico.** Os sons sintetizados saíam em ~10 % do volume máximo (baixo demais em alto-falante
    de notebook). Agora passam por um compressor com ganho final (picos entre 20 % e 75 %, sem distorcer). O áudio é
    liberado em qualquer clique, toque ou tecla, e a introdução tem o botão **Testar som**, que toca três notas e diz
    se o som está desligado no jogo, bloqueado pelo navegador ou funcionando.

## v5 — 1 minuto, energia escassa, ferramentas reordenadas, frutos fiéis

27. **Fase de 1 minuto** (`fase.tempoLimiteReal = 60`).
28. **Energia escassa:** recarga caiu de 2,5 para **1 por segundo**; custos subiram: irrigar 20, travar 12, proteger 18,
    encher água 20 (o timer e o sombrite continuam cortando pela metade).
29. **Mais difícil** (varredura 8 partidas × 5 fases): reagindo a cada 6 s vence ~90 %; 9 s, ~70 %; 12 s, ~60 %;
    15 s, ~35 %; 20 s, ~22 %; parado, nunca. Quem vence colhe em ~52 s. Números: crescimento 1,05, evaporação 0,56/s,
    eventos a cada 11–20 s.
30. **Ferramentas reordenadas, sem IA assistente:** uma por fase — 1 medidor de pH, 2 timer de irrigação, 3 sensor de
    umidade, 4 sombrite reforçado, 5 painel de dados. A estufa autônoma (a rival) continua.
31. **Frutos fiéis e visíveis:** o estágio "Colheita" (frutos maduros) passou a começar em 78 % do crescimento; antes só
    aparecia no instante da colheita e o jogador nunca via morangos vermelhos. Morango redesenhado (vermelho, formato de
    coração, sementes e cálice); tomate redondo com brilho e cálice em estrela, amadurecendo verde → laranja → vermelho.

## v6 — integração com a IA do grupo

32. **Ponte Python para o Random Forest** (`ia-servidor/`): servidor só com a biblioteca padrão + scikit-learn/joblib,
    com CORS, que traduz o snapshot do jogo para as colunas do modelo (`config_modelo.json`, com reconhecimento de
    nomes como `N`, `temperatura`, `umidade_solo`) e os rótulos do modelo para as 4 ações. Culturas que o modelo não
    cobre respondem 422 e o jogo usa as regras. Modelo **provisório** de alface treinado com dados do simulador
    (`gerar_dados.mjs`) até a equipe colocar o modelo real. `iniciar_com_ia.bat` sobe tudo. O HUD e o relatório
    mostram quando a decisão veio do modelo.
33. **O Random Forest do grupo no jogo.** O repositório AgroLab-IA não tem o modelo salvo, então
    `treinar_modelo_equipe.py` refaz o treino da Parte 11 do `EDA_Alface.ipynb` (dataset NFT, mesmas colunas,
    separação e hiperparâmetros; acurácia 0,985 como no notebook). Ele é treinado no PC do jogo, e não vai para o Git,
    porque o arquivo depende da versão do scikit-learn. O `adaptador_nft.py` traduz as 7 variáveis do jogo para as 17
    colunas do modelo, pela posição dentro das faixas, e a classe 0–3 para a ferramenta certa do jogo. Com CE alta, o
    modelo manda aguardar sem fertirrigar, porque o "Travar" do jogo drena o substrato. Com pH baixo, manda travar,
    que é a ferramenta que corrige o pH. No simulador, o modelo cuida da alface tão bem quanto as regras: saúde 98 %
    contra 97 %, com um pouco menos de água e energia. O modelo provisório virou o plano B (`config_provisorio.json`).
34. **Prova de que a IA está funcionando.** Selo com luz no painel COMPARE E APRENDA!: verde e piscando a cada
    resposta, amarelo quando o modelo não cobre a cultura, vermelho quando o servidor está desligado. A tecla **I**
    abre o painel IA AO VIVO: o que o jogo enviou, o que o modelo recebeu depois da tradução e a resposta, com a
    latência. A janela do servidor escreve uma linha por decisão.
35. **Terminal da IA e ritmo mais lento.** O jogo pede cerca de 2 decisões por segundo, rápido demais para ler.
    A janela do servidor e o novo terminal da barra lateral (tecla T) mostram só a decisão mais recente a cada 3 s,
    avisando quantas ficaram de fora. O terminal fica fora do palco e ocupa a faixa lateral que sobra nas telas 16:9
    (384 px em 1920×1080, 342 px em 1366×768), sem diminuir o jogo. Em telas mais estreitas, o jogo encolhe um pouco
    para dar lugar a ele. A escala do palco passou a aceitar escala fracionária quando a inteira deixaria o jogo
    muito menor que a tela.
