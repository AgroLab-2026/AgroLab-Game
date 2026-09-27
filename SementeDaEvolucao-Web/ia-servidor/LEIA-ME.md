# Ligando o modelo de IA do grupo ao jogo

A estufa autônoma do jogo pergunta a cada meio segundo "o que devo fazer agora?". Este servidor responde com o
**Random Forest de alface NFT** da frente de IA ([AgroLab-IA](https://github.com/AgroLab-2026/AgroLab-IA),
`alface/EDA_Alface.ipynb`, Parte 11). Se ele estiver desligado, demorar ou não cobrir a cultura (morango e tomate),
o jogo usa as regras dele sozinho, sem travar.

## Rodar (Windows)

Dois cliques em **`iniciar_com_ia.bat`** (na pasta `SementeDaEvolucao-Web`). Ele:
1. instala `scikit-learn`, `joblib` e `pandas` se faltarem;
2. na primeira vez, **treina o modelo do grupo** (`treinar_modelo_equipe.py`, ~1 minuto). O dataset
   `alface/nft/dataset_nft.csv` é procurado num clone do AgroLab-IA ao lado do AgroLab-Game, em Downloads ou em
   Documentos; se não estiver no PC, é baixado do GitHub do grupo (42 MB, uma vez só). **Rodem uma vez antes do
   evento**, com internet;
3. abre a janela **"IA do AgroLab"** (deixe aberta);
4. abre o jogo já ligado à IA.

Sem o dataset e sem internet, ele usa o **modelo provisório** (`config_provisorio.json`), treinado com dados do
simulador do jogo.

No jogo, o painel **COMPARE E APRENDA!** mostra quem decide: em azul, "IA: Random Forest do AgroLab · repor/corrigir
falta — água baixa (97%)" quando é o modelo; em cinza, "regras do jogo" quando é o fallback. O relatório de fim de
fase conta quantas decisões vieram do modelo. Em http://localhost:5000/ dá para ver o modelo carregado e as colunas.

## Por que retreinar em vez de usar o arquivo do notebook

O notebook não salva o modelo, e um `.joblib` só abre com a mesma versão do scikit-learn usada para salvá-lo. Por
isso o `treinar_modelo_equipe.py` refaz o treino **exatamente como no notebook**: mesmas colunas, mesma separação
75/25 estratificada com `random_state=42`, mesmos hiperparâmetros (`n_estimators=120, max_depth=18,
min_samples_leaf=5, class_weight='balanced'`). O resultado é o mesmo modelo: **acurácia 0,985 e F1 macro 0,983**,
iguais aos do notebook. Se o grupo mudar o notebook, basta repetir a mudança nesse script.

## Como o jogo conversa com o modelo (`adaptador_nft.py`)

O modelo foi treinado com 17 colunas de uma bancada NFT real (CE, O₂ dissolvido, nível do reservatório, DLI…), e o
jogo mede 7 variáveis com as faixas ideais do jogo. O tradutor coloca cada variável na **mesma posição relativa**
dentro das faixas que o gerador do grupo usa para rotular (`gerar_dataset_nft.py`). Assim, "fora da faixa" no jogo
vira "fora da faixa" para o modelo:

| No jogo | Para o modelo | Âncoras |
|---|---|---|
| N, P, K (faixa da cultura) | `ce_ms_cm` e `N` | faixa do jogo → alvo de CE da fase (muda 0,5–0,8 … pleno 1,2–2,0 mS/cm); falta de qualquer nutriente puxa para baixo; N pela solução Furlani (196 mg/L em CE 2,0) |
| umidade do substrato | `nivel_reservatorio_pct` | mínimo do jogo = 30 % (limite de repor água), máximo = 100 % |
| pH | `ph` | faixa do jogo → 5,5–6,8 (limites de correção do gerador) |
| temperatura do ar | `temp_ar_c`, `temp_max_c`, `temp_min_c` | 15 °C → 15 °C, máximo do jogo → 24 °C (pendoamento da cultivar padrão); máx./mín. ±5,6 °C (média do dataset) |
| crescimento da planta | `dias_apos_transplante`, `fase_*` | 0–100 % → dia 1–45 |
| umidade do ar externa | `umidade_relativa_pct`, `vpd_kpa` | +5 pontos da estufa, como no gerador |
| luminosidade | `dli_mol_m2_d` | 0,4 × luz % |
| (não existe no jogo) | `temp_solucao_c`, `od_mg_l`, `tolerancia_calor_tolerante` | calculados como no gerador, bomba funcionando, cultivar padrão |

A **classe** que o modelo devolve é a decisão. A ferramenta que a executa depende da causa, identificada pelas
mesmas regras de prioridade do gerador:

| Classe do modelo | Ferramenta no jogo |
|---|---|
| 0 não fazer nada | Aguardar |
| 1 travar/corrigir excesso | pH alto → **Travar irrigação** (é a ferramenta que corrige o pH no jogo). CE alta → **Aguardar** sem fertirrigar: o "Travar" do jogo drena o substrato, e o excesso some com o consumo da planta |
| 2 repor/corrigir falta | água ou nutrientes → **Irrigar**; pH baixo → **Travar irrigação** |
| 3 proteger | **Proteger** (sombrite); se o sombrite já estiver ativo → Aguardar |

## Resultado no jogo

`node ia-servidor/avaliar_no_jogo.mjs` (com o servidor rodando) joga 8 fases de alface com cada cérebro:

| Cérebro da estufa autônoma | Saúde média | Plantas mortas | Água | Energia |
|---|---|---|---|---|
| Regras do jogo | 96,9 % | 0 | 11,8 L | 34 |
| **Random Forest do grupo** | **98,1 %** | 0 | 11,0 L | 33 |

**Limitações para declarar** (e ideias para o próximo modelo):
- O modelo não conhece **substrato encharcado**: no NFT não existe excesso de água, só reservatório baixo. Na Chuva
  Intensa, a estufa do modelo não trava a irrigação.
- Ele não olha a **luz** para proteger (o gerador rotula "proteger" só por temperatura, solução quente e O₂). No jogo,
  a onda de calor sobe as duas juntas, então isso quase não aparece.
- As âncoras da tradução são escolhas nossas, descritas acima e em `adaptador_nft.py`.

## Usar outro modelo

- **Outro modelo com as mesmas 17 colunas** (ex.: o grupo retreinou): salve com `joblib.dump(modelo, "arquivo.joblib")`,
  copie para esta pasta e troque `"arquivo"` em `config_modelo.json`.
- **Um modelo com as 7 variáveis do jogo** (N, P, K, pH, temperatura, umidade, luminosidade): use
  `"adaptador": "direto"`, como em `config_provisorio.json`, com `"colunas"` (a ordem do treino) e `"rotulos"`
  (o que o modelo devolve → a ação do jogo). Rodar com outra configuração:
  `python ia-servidor/servidor_ia.py config_provisorio.json`.
- **Morango e tomate**: quando houver modelos, acrescentem a cultura em `"culturas"` (hoje só `AlfaceCrespa`).

`inspecionar_modelo.py` mostra as colunas, as classes e a versão do scikit-learn de qualquer modelo salvo.

**Versão do scikit-learn:** um modelo salvo numa versão pode dar aviso ou erro em outra. Por isso o modelo é
treinado no próprio PC do jogo, e não vai para o Git.

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

## Modelo provisório (plano B)

`gerar_dados.mjs` gera situações da estufa a partir do simulador do jogo, com a ação que as regras tomariam
(`dados_simulados_alfacecrespa.csv`, colunas `N,P,K,pH,temperatura,umidade,luminosidade,acao`), e
`treinar_modelo_exemplo.py` treina com elas o modelo provisório. Ele só imita as regras do jogo: serve para o jogo
funcionar se o modelo do grupo não puder ser treinado.
