# Comparação visual

| Arquivo | O que mostra |
|---|---|
| `final-lado-a-lado.png` | Referência (esquerda) × jogo no meio de um ciclo (direita), ambos em 1024 × 682 |
| `final-1024x682.png` | O jogo na resolução da referência |
| `final-1920x1080.png` | O jogo em Full HD: o mundo escala 3× exato; as faixas laterais são folhagem |
| `onda-de-calor.png` | Evento climático com o sombrite ativo nas duas estufas |
| `relatorio-fim-de-fase.png` | O relatório "a derrota que ensina" |
| `fase1-lado-a-lado.png` | A primeira versão da tela estática (histórico) |
| `v2-jogando.png` | v2: lousa da fase (tempo, tentativas, colheita), custos nas ferramentas, "Protegendo · 14 s" |
| `v2-ia-sugere.png` | v2, fase 5: todas as tecnologias e o botão marcado "IA sugere" |
| `v2-vitoria.png` / `v2-derrota.png` / `v2-game-over.png` | v2: telas de vitória, derrota ("o que deu errado") e game over |
| `v2-chapeu-chico-bento.png` | Chapéu de palha desfiado, estilo Chico Bento, no fazendeiro e no Sr. Bruno |

Nas capturas `final-*`, a fonte Pixelify Sans não carregou (falha de rede deste ambiente), então aparece a fonte
de reserva. Com internet, ou com a fonte copiada para o projeto, o texto fica em pixel art, como em
`onda-de-calor.png`.

## Mesma composição

Placa de título no canto superior esquerdo; OBJETIVO, RECURSOS e FERRAMENTAS na coluna esquerda; lousas de CLIMA
ATUAL e PREVISÃO no topo central; estufa rústica (jogador) à esquerda e estufa high-tech (IA) à direita, separadas
por uma divisória branca; CONTROLE DA ESTUFA, TECNOLOGIAS IA, COMPARE E APRENDA! e EVENTO ATUAL na coluna direita;
retrato e fala do Sr. Bruno no rodapé. Mesmas posições (±2 px), paleta amostrada da imagem, molduras de madeira com
pinos dourados e fontes em caixa-alta nos cabeçalhos.

## Diferenças restantes

| Diferença | Por quê |
|---|---|
| Detalhe da arte do mundo: a referência tem mais folhagem, trepadeiras e objetos, com sombreamento mais rico | A referência é uma ilustração gerada por IA, com detalhe "infinito". Toda a nossa arte é gerada por código, porque os assets do Unity não estão no repo. Com os sprites do Sunnyside ou arte da equipe (ver `assets-pendentes.md`) a diferença diminui |
| Rótulos do CONTROLE DA ESTUFA e das TECNOLOGIAS | A referência repete "Ajuste Manual de Ventilação" e usa nomes em inglês. Usamos as variáveis e tecnologias reais do jogo, em português (`decisoes.md` #11) |
| FERRAMENTAS: Irrigar, Travar, Proteger, Aguardar, Encher água em vez de Irrigação, Energia, Rake, Axe, Hoe, Seeds | São as ações que existem nas regras do C# (`decisoes.md` #12) |
| Barras do CONTROLE mostram "??" em pH e N·P·K na fase 1 | Regra de progressão: sem o Medidor de pH (tecnologia da fase 2) o fazendeiro não sabe esses valores |
| EVENTO ATUAL mostra "TEMPO ESTÁVEL" até o evento começar | O nome do próximo evento só aparece com o Painel de Dados (fase 6); antes, só a contagem |
| Plantas das prateleiras da IA menores que na referência | Mantivemos a mesma escala de pixel do canteiro do jogador (comparação justa entre as duas estufas) |
| Retrato do Bruno mais simples | Desenhado por código (64 × 58). O `bruno_face.png` do projeto Unity pode substituí-lo |
| Tipografia | Pixelify Sans é a fonte livre mais próxima; a da referência não é identificável |
