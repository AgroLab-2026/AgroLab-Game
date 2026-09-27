# Ligando o modelo de IA do grupo ao jogo

A estufa autônoma do jogo pergunta a cada meio segundo "o que devo fazer agora?". Este servidor responde usando
o **Random Forest** da frente de IA. Se ele estiver desligado, demorar ou não cobrir a cultura, o jogo usa as
regras dele sozinho, sem travar.

## Rodar (Windows)

Dois cliques em **`iniciar_com_ia.bat`** (na pasta `SementeDaEvolucao-Web`). Ele:
1. instala `scikit-learn`, `joblib` e `pandas` se faltarem;
2. treina um **modelo provisório** de alface se o modelo configurado não existir;
3. abre a janela **"IA do AgroLab"** (deixe aberta);
4. abre o jogo já ligado à IA.

No jogo, o painel **COMPARE E APRENDA!** mostra quem está decidindo: em azul, "IA: Random Forest … · Irrigar (95%)"
quando é o modelo; em cinza, "regras do jogo" quando é o fallback. O relatório de fim de fase conta quantas decisões
vieram do modelo.

Para conferir o servidor sozinho, abra http://localhost:5000/ no navegador: ele mostra o modelo carregado, as colunas
e a qual variável do jogo cada coluna foi ligada.

## Trocar pelo modelo de vocês

1. Salve o modelo treinado com joblib (ou pickle):
   ```python
   import joblib
   joblib.dump(modelo, "modelo_alface.joblib")
   ```
2. Copie o arquivo para esta pasta (`ia-servidor/`).
3. Em `config_modelo.json`, ajuste:
   - `"arquivo"`: o nome do arquivo (ex.: `"modelo_alface.joblib"`);
   - `"nome"`: como aparece no jogo (ex.: `"Random Forest do AgroLab (alface)"`);
   - `"colunas"`: **a mesma ordem de colunas usada no treino** e a variável do jogo de cada uma. Se vocês treinaram
     com um DataFrame do pandas, o servidor lê os nomes das colunas do próprio modelo e reconhece nomes como `N`,
     `nitrogenio`, `pH`, `temperatura`, `umidade`, `umidade_solo`, `luminosidade`, `luz`;
   - `"rotulos"`: o que o modelo devolve → a ação do jogo. Já aceita `0`–`3` e textos como `irrigar`,
     `travar_irrigacao`, `proteger`, `nao_fazer_nada` (confiram se a numeração de vocês é a mesma!);
   - `"culturas"`: as culturas que o modelo cobre (`"AlfaceCrespa"`, `"Morango"`, `"Tomate"`).
4. Rode o `iniciar_com_ia.bat` de novo.

**Versão do scikit-learn:** um modelo salvo numa versão pode dar aviso ou erro em outra. Se acontecer, instalem no PC
do jogo a mesma versão usada no treino: `python -m pip install scikit-learn==X.Y.Z`.

## Unidades que o jogo envia

| Variável do jogo | Unidade | Faixa ideal da alface no jogo |
|---|---|---|
| `nitrogen` (N) | mg/L | 120–180 |
| `phosphorus` (P) | mg/L | 40–55 |
| `potassium` (K) | mg/L | 180–230 |
| `ph` | pH | 5,8–6,2 |
| `airTemperature` | °C | 15–22 |
| `soilMoisture` | % | 60–80 |
| `luminosity` | % | 50–70 |

Se o modelo de vocês usa outras unidades ou escalas (por exemplo, luminosidade em lux ou umidade de 0 a 1), me digam:
dá para converter no servidor antes de chamar o modelo.

## Dados para treino

`gerar_dados.mjs` gera situações da estufa a partir do simulador do jogo, com a ação que as regras tomariam:

```
node ia-servidor/gerar_dados.mjs AlfaceCrespa 6000
```

O arquivo `dados_simulados_alfacecrespa.csv` (colunas `N,P,K,pH,temperatura,umidade,luminosidade,acao`) já está
na pasta. Ele pode complementar os dados de vocês, mas lembrem que ele ensina o modelo a imitar as regras do jogo.
O ideal é treinar com os dados da pesquisa de vocês.
