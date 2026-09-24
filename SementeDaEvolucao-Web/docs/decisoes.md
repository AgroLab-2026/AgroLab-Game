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
4. **Fonte.** Pixelify Sans (licença OFL) carregada do Google Fonts, com `monospace` de reserva. Para rodar 100%
   offline na estufa, basta copiar o arquivo `.woff2` para `fonts/`. Não fiz isso porque o prompt proíbe baixar
   assets; peço autorização.
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
9. **Fases e tecnologias** (decisão da conversa): 7 fases, cada uma libera uma tecnologia do painel TECNOLOGIAS IA;
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
14. **Intervalo de decisão da IA** de 1 s de jogo. O fazendeiro "atento" do teste (reage a cada 4 s reais) fica em
    ~69 % da IA; quem não faz nada perde a planta; na fase 7, com a IA assistente, sobe para ~88 %.
