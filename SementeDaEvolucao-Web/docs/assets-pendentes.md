# Assets pendentes

Os assets do projeto Unity (`Art/Sunnyside`, `Art/Crops`, `Art/Tiles`, `Art/_Generated`, `Art/Greenhouse`) **não
estão no repositório**. Por isso, tudo abaixo é desenhado por código, em pixel art, com o mesmo tamanho, forma e
paleta da referência. Para trocar por arte desenhada à mão, substitua a função indicada por um `drawImage` de
um PNG com o tamanho listado.

| Asset | Onde é desenhado hoje | Tamanho (px de arte) | Substituir por |
|---|---|---|---|
| Cenário da estufa (piso, paredes, vidro, canteiro, estante, máquinas) | `js/render/Cenario.js` → `desenharCenario()` | 512 × 341 | Tileset 16×16 (Sunnyside/Tiles) montado no Tiled ou um PNG de fundo **sem HUD** |
| Culturas: 6 estágios × 3 culturas | `js/render/Plantas.js` → `desenharPlanta()` | ~12 × 20 por planta | `Art/Crops/<Cultura>/estagio_0..5.png` |
| Fazendeiro (4 quadros de caminhada) | `js/render/Personagens.js` → `spritesFazendeiro()` | 20 × 23 | Sunnyside (fazendeiro) |
| Robôs da estufa autônoma | `js/render/Personagens.js` → `spritesRobo()` | 16 × 16 | Arte própria |
| Retrato do Sr. Bruno | `js/render/Personagens.js` → `desenharRetratoBruno()` | 64 × 58 | `_Generated/bruno_face.png` |
| Molduras de madeira (9-slice) | `js/render/Molduras.js` | 12 × 12, fatia de 4 | `_Generated/wood_frame.png` / `wood_frame_btn.png` via `border-image` |
| Ícones do HUD (26) | `js/render/Icones.js` | ~12 × 12 | PNGs 16×16 |
| Telas de abertura | não usadas ainda | — | `_Generated/splash_0..4.png` |
| Fonte Pixelify Sans | Google Fonts (`index.html`) | — | Copiar o `.woff2` (licença OFL) para `fonts/` e trocar o `<link>` por `@font-face`, para rodar 100 % offline |

**Arte do Stardew Valley (`Greenhouse/`):** não foi usada em lugar nenhum. O cenário é todo original. Se quiserem
usá-la no protótipo, o único ponto de troca é `desenharCenario()`. Ela não pode ir para a versão apresentada nem
publicada.

**Fonte:** neste ambiente de nuvem o Google Fonts falhou algumas vezes (`ERR_TOO_MANY_RETRIES`). Nessas vezes o
jogo usou a fonte de reserva (Trebuchet/Verdana), que funciona mas perde o estilo pixel. Na estufa, sem
internet, vai acontecer o mesmo. **Recomendo autorizar copiar a fonte para o projeto.**
