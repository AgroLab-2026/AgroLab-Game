# Especificação visual — Semente da Evolução (web)

Fonte: `referencia/referencia.jpg` (1024 × 682 px, proporção ~3:2).
Todas as medidas abaixo estão em **pixels da referência** e em **% da largura/altura**.
O palco HTML do jogo usa exatamente esse sistema de coordenadas (1024 × 682) e é
escalado inteiro para caber na tela.

## 1. Regiões

| Região | x | y | largura | altura | % (x, y, l, a) |
|---|---|---|---|---|---|
| Placa de título "ESTUFA INTELIGENTE" | 4 | 4 | 293 | 74 | 0.4, 0.6, 28.6, 10.9 |
| Painel OBJETIVO | 5 | 88 | 178 | 87 | 0.5, 12.9, 17.4, 12.8 |
| Painel RECURSOS | 5 | 186 | 165 | 144 | 0.5, 27.3, 16.1, 21.1 |
| Painel FERRAMENTAS INICIAIS | 5 | 342 | 165 | 170 | 0.5, 50.1, 16.1, 24.9 |
| Lousa CLIMA ATUAL | 370 | 45 | 135 | 92 | 36.1, 6.6, 13.2, 13.5 |
| Lousa PREVISÃO | 510 | 45 | 115 | 92 | 49.8, 6.6, 11.2, 13.5 |
| Painel CONTROLE DA ESTUFA | 793 | 5 | 229 | 198 | 77.4, 0.7, 22.4, 29.0 |
| Painel TECNOLOGIAS IA | 793 | 203 | 229 | 145 | 77.4, 29.8, 22.4, 21.3 |
| Painel COMPARE E APRENDA! | 738 | 355 | 284 | 237 | 72.1, 52.1, 27.7, 34.8 |
| Painel EVENTO ATUAL | 718 | 596 | 304 | 86 | 70.1, 87.4, 29.7, 12.6 |
| Retrato do Sr. Bruno | 22 | 505 | 195 | 175 | 2.1, 74.0, 19.0, 25.7 |
| Caixa de fala do Sr. Bruno | 222 | 503 | 414 | 177 | 21.7, 73.8, 40.4, 26.0 |
| Mundo: estufa rústica (jogador) | ~180 | 0 | ~330 | ~500 | 17.6, 0, 32.2, 73.3 |
| Mundo: estufa high-tech (IA) | ~510 | 0 | ~280 | ~500 | 49.8, 0, 27.3, 73.3 |

O **mundo** ocupa a tela inteira por trás dos painéis (folhagem escura nas bordas). A
estufa fica no centro: a metade esquerda é rústica (terra, madeira, vidro velho) e a
metade direita é tecnológica (piso de azulejo azul-claro, estantes hidropônicas, robôs).
Uma divisória vertical em x ≈ 510 separa as duas.

## 2. Paleta (amostrada dos pixels)

| Uso | Hex |
|---|---|
| Madeira escura (moldura externa) | `#633617` |
| Madeira média (moldura) | `#b25e1e` |
| Madeira clara (realce da moldura) | `#e39a4a` |
| Pergaminho (fundo de painel) | `#e4a653` / `#dd9f48` |
| Pergaminho claro (placa do título) | `#e7b97b` |
| Faixa de cabeçalho marrom | `#6d380c` / `#5b2d09` |
| Faixa de cabeçalho verde (OBJETIVO) | `#3f6b2a` |
| Texto escuro | `#260900` |
| Texto claro em cabeçalho | `#f6e3b4` |
| Lousa (clima/previsão) | `#2b3d24` com borda `#624e29` |
| Card VOCÊ | `#16261a`, título `#9ccf6a` |
| Card IA AUTÔNOMA | `#132c44`, título `#7fc4f0` |
| Célula de tecnologia | `#23190d` |
| Valor ruim (vermelho) | `#e2553a` |
| Valor bom (verde) | `#8fd14f` |
| Valor azul | `#4f8fd0` |
| Estrela | `#f6c945` |
| Terra do canteiro | `#8d561d` / `#834e1a` |
| Piso de pedra | `#644d24` |
| Piso azulejo (IA) | `#aad8ef` / `#a7d5ed` |
| Estrutura das estantes | `#999a9e` |
| Folhagem (fundo) | `#1c3a17` → `#0b1a0a` |

As cores do HUD estão em variáveis CSS em `css/estilo.css` (`:root`).

## 3. Tipografia

- Toda a tipografia é **pixel art sem serifa**. Usamos **Pixelify Sans** (licença OFL), carregada do Google Fonts, com `monospace` de reserva.
- Título: ~30 px, caixa-alta, marrom quase preto. Subtítulo: ~13 px em caixa-alta, entre dois raminhos.
- Cabeçalhos de painel: ~13 px em caixa-alta, texto claro sobre faixa marrom ou verde.
- Corpo: ~11–12 px, marrom-escuro sobre pergaminho, ou claro sobre fundo escuro.

## 4. Molduras

- Moldura de madeira em 3 tons, com cantos marcados por **pinos dourados**. É gerada em pixel art por código (`js/render/Molduras.js`) e aplicada com `border-image` (9-slice).
- Os cabeçalhos são faixas com as pontas cortadas em chanfro.
- As lousas têm moldura de madeira fina e fundo verde-escuro.
- Os cards de comparação têm borda arredondada fina (verde para VOCÊ, azul para a IA).

## 5. Elementos do HUD (comportamento)

| Elemento | Conteúdo real no jogo |
|---|---|
| OBJETIVO | Objetivo da fase atual |
| RECURSOS | Água %, Energia %, Nutrientes % (estoque de fertilizante), Mão de obra, Automação (IA) |
| FERRAMENTAS INICIAIS | As 4 ações + reabastecer água, clicáveis e com atalho de tecla |
| CLIMA ATUAL | Condição, temperatura e umidade externas |
| PREVISÃO | Próximo evento (vago sem tecnologia; exato com o Painel de Dados) |
| CONTROLE DA ESTUFA (Manual vs IA) | 5 barras: temperatura, umidade, luz, pH, nutrientes. Marcador do jogador sobre a faixa ideal, com o marcador da IA ao lado |
| TECNOLOGIAS IA | 6 tecnologias. Bloqueadas mostram cadeado; cada fase libera uma |
| COMPARE E APRENDA! | Canteiro do jogador × IA, estrelas, saúde, produtividade, consumo de água, eficiência energética |
| EVENTO ATUAL | Evento climático ativo ou próximo, com contagem regressiva |
| Sr. Bruno | Retrato + dica contextual (roteiro do BrunoDialogue) |

## 6. Estilo do mundo

- Pixel art top-down no estilo Stardew Valley, com contornos escuros, sombreamento em 2–3 tons e luz vinda de cima à esquerda.
- O mundo é desenhado num buffer de **512 × 341** (metade da referência) e escalado por fator inteiro. Cada pixel de arte equivale a 2 px da referência.
