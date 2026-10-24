# Ligando o modelo de IA do grupo ao jogo

A estufa autônoma do jogo pergunta a cada meio segundo "o que devo fazer agora?". Este servidor responde com o
**Random Forest de morango** da frente de IA ([AgroLab-IA](https://github.com/AgroLab-2026/AgroLab-IA),
`morango/agrolab_morango_modelo.ipynb`). O jogo tem alface, morango e tomate: nas fases de
**morango (2 e 5)** quem decide é o modelo; nas de **alface (1 e 4)** e **tomate (3)** o jogo usa as próprias regras
até existir um modelo para elas. Se o servidor estiver desligado ou demorar, o jogo também usa as regras, sem travar.

## Rodar (Windows)

Dois cliques em **`iniciar_com_ia.bat`** (na pasta `SementeDaEvolucao-Web`). Ele:
1. instala `scikit-learn`, `joblib` e `pandas` se faltarem;
2. na primeira vez, **treina o modelo do grupo** (`treinar_modelo_equipe.py`, alguns segundos). Usa o dataset
   `morango/agrolab_morango_dataset.csv` de um clone do AgroLab-IA ao lado do AgroLab-Game (ou em Downloads,
   Documentos), que é a versão mais nova; se não achar, usa a cópia que vem com o jogo
   (`ia-servidor/dados_equipe/`). **Não precisa de internet**;
3. abre a janela **"IA do AgroLab"** (deixe aberta);
4. abre o jogo já ligado à IA.

Se o grupo atualizar o dataset, apaguem `ia-servidor/modelo_equipe_morango.joblib` para o modelo ser treinado de
novo.

## Como saber se a IA está rodando e recebendo os dados

1. **No jogo, o selo embaixo do painel COMPARE E APRENDA!**
   - 🟢 `IA ONLINE · Irrigar 97% · 15 ms · #52`: o modelo está respondendo. A luz pisca a cada resposta, e o
     número (#52) conta as respostas;
   - 🟡 `IA online · não treinada para Tomate: regras`: o servidor está ligado, mas o modelo não cobre essa cultura;
   - 🟡 `IA LENTA (3,0 s por decisão) · usando regras`: o servidor responde, mas demora mais que o limite do jogo
     (2,5 s). A estufa usa as regras enquanto isso e volta para o modelo sozinha quando ele ficar rápido;
   - 🔴 `IA DESLIGADA · abra o iniciar_com_ia.bat`: o jogo não encontrou o servidor (a janela "IA do AgroLab" foi
     fechada, deu erro ao abrir ou ainda está treinando). O jogo testa de novo a cada 4 s;
   - ⚪ `Cérebro da IA: regras do jogo`: o jogo foi aberto sem a IA (pelo `iniciar.bat` comum).
2. **Tecla I (ou clique no selo): painel IA AO VIVO.** Três colunas atualizadas a cada decisão: **1. o que o jogo
   enviou** (a estufa da IA, com o que está fora da faixa em vermelho), **2. o que o modelo recebeu** (as colunas
   depois da tradução: umidade do substrato, N e K, temperatura máxima, horas de calor…) e **3. o que ele respondeu** (ação, confiança e
   tempo de resposta). Mexa na estufa ou espere um evento e veja os números mudarem.
3. **Terminal da IA, na barra lateral do jogo (tecla T).** Abre sozinho pelo `iniciar_com_ia.bat`. Parece um
   terminal: a cada 3 s digita a decisão mais recente, com o que o jogo enviou (valores fora da faixa em vermelho),
   o que o modelo viu e a resposta, além do início de cada fase, dos eventos de clima e da conexão caindo ou
   voltando. O "+5" diz quantas decisões aconteceram entre uma mensagem e outra. É um monitor pequeno à direita do
   jogo (até 250 px de largura e 60 % da altura do jogo), sem diminuir o jogo numa tela 16:9.
4. **Na janela "IA do AgroLab"**: a mesma decisão mais recente a cada 3 s, com o que chegou do jogo, o que o modelo
   viu e a resposta. Se as mensagens param, o jogo não está mais pedindo decisões. O ritmo é ajustável:
   `"intervalo_log_segundos"` em `config_modelo.json` (janela) e `"terminalIntervalo"` em `data/ia.json` (jogo).
5. **No relatório de fim de fase**: quantas decisões vieram do modelo.

Em http://127.0.0.1:5000/ dá para ver o modelo carregado e as colunas.

## Se aparecer "IA DESLIGADA" ou "IA LENTA"

1. Olhe a janela **"IA do AgroLab"**. Ao abrir, ela mostra `Tempo de uma decisão neste PC: 9 ms`. Depois, a cada
   3 s, mostra a última decisão com o tempo dela entre colchetes (`[13 ms]`).
   - **A janela não existe ou fechou sozinha:** abra o `iniciar_com_ia.bat` de novo e leia a mensagem de erro.
   - **Ela ainda está treinando** (só na primeira vez, alguns segundos): espere terminar; o jogo reconecta sozinho.
   - **O tempo passa de 500 ms** (`(LENTO!)`): feche programas pesados. O limite do jogo é `timeoutMs` em
     `data/ia.json` (2 500 ms).
2. Abra http://127.0.0.1:5000/ no navegador: deve aparecer `{"ok": true, ...}`.
3. Atualizou o projeto (`git pull`)? **Feche a janela "IA do AgroLab" antiga** e abra o `iniciar_com_ia.bat` de
   novo: o servidor só usa o código novo depois de reiniciado.

## Por que retreinar em vez de usar o arquivo do notebook

O notebook não salva o modelo, e um `.joblib` só abre com a mesma versão do scikit-learn usada para salvá-lo. Por
isso o `treinar_modelo_equipe.py` refaz o treino **exatamente como no notebook**: as mesmas 15 colunas, separação
80/20 estratificada com `random_state=42` e `RandomForestClassifier(n_estimators=300, class_weight='balanced',
random_state=42)`. O resultado é o mesmo modelo: **acurácia 0,918 e F1 macro 0,902**, iguais aos do notebook. As
classes são os nomes das ações (`Ideal`, `Irrigar`, `Proteger`, `Travar Irrigação`), na mesma ordem do
`LabelEncoder` do notebook. Se o grupo mudar o notebook, basta repetir a mudança nesse script.

## Como o jogo conversa com o modelo (`adaptador_morango.py`)

O modelo foi treinado com 15 colunas diárias de uma estufa semi-hidropônica (médias e máximas do dia, horas de
calor, radiação, chuva…), e o jogo mede 7 variáveis com as faixas ideais do morango no jogo. O tradutor coloca cada
variável na **mesma posição relativa** dentro dos limites que o gerador do grupo usa para rotular
(`classificar_acao` em `agrolab_morango_simulacao.ipynb`). Assim, "fora da faixa" no jogo vira "fora da faixa"
para o modelo:

| No jogo | Para o modelo | Âncoras |
|---|---|---|
| umidade do substrato (60–75 %) | `umidade_solo` | mínimo do jogo = 60 % (irrigar), máximo = 85 % (travar) |
| N, P, K | `N_mgL`, `P_mgL`, `K_mgL` | mínimos do jogo = 160, 28 e 220 mg/L (os limites de "repor"); máximos = 250, 60 e 380 |
| pH | `pH` | faixa do jogo → 5,3–6,3 (limites de correção do gerador) |
| temperatura do ar (18–24 °C) | `temp_ar_media`, `temp_ar_max`, `temp_ar_min`, `h_calor_extremo`, `temp_substrato` | mínimo do jogo = 18 °C de média; máximo do jogo = 30 °C de máxima (o limite de "proteger"). Máxima = média + 6,1 °C, mínima = média − 4,7 °C, substrato = média − 2,6 °C (médias do dataset); horas acima de 30 °C ≈ 1,2 por grau acima |
| luminosidade | `luminosidade_lux`, `radiacao_PAR` | faixa do jogo → 244–426 (quartis do dataset); PAR = lux ÷ 0,7 (o filme da estufa deixa passar ~70 %) |
| umidade do ar externa | `umidade_ar_media`, `h_umid_alta` | o valor do jogo; horas acima de 85 % ≈ (umidade − 75) ÷ 2 |
| evento Chuva Intensa | `chuva_mm` | 15 mm durante a chuva, 0 no resto |

A **ação** que o modelo devolve é a decisão. A ferramenta que a executa depende da causa, identificada pelas mesmas
regras de prioridade do gerador:

| Ação do modelo | Ferramenta no jogo |
|---|---|
| Ideal | Aguardar |
| Irrigar | falta de água ou de nutrientes → **Irrigar**; pH alto → **Travar irrigação** (é a ferramenta que corrige o pH no jogo) |
| Travar Irrigação | substrato encharcado ou pH baixo → **Travar irrigação**; excesso de N/K → **Aguardar** sem fertirrigar (o excesso some com o consumo) |
| Proteger | **Proteger** (sombrite); se o sombrite já estiver ativo → Aguardar |

## Resultado no jogo

`node ia-servidor/avaliar_no_jogo.mjs` (com o servidor rodando) joga 10 fases de morango com cada cérebro:

| Cérebro da estufa autônoma | Saúde média | Plantas mortas | Água | Energia |
|---|---|---|---|---|
| Regras do jogo | 97,5 % | 0 | 14,0 L | 40 |
| **Random Forest do grupo** | **90,2 %** | 0 | 14,0 L | 37 |

Todas as decisões vieram do modelo. Ele irriga quando o substrato seca ou falta nitrogênio, protege no calor e
trava a irrigação com o substrato encharcado (na Chuva Intensa).

**Limitações para declarar** (e ideias para o próximo modelo):
- O modelo **não corrige o pH**: no dataset, o pH fica sempre entre 5,5 e 6,2, então ele nunca viu pH fora da
  faixa. Por isso a saúde média fica um pouco abaixo das regras do jogo.
- Ele também quase não reage a **fósforo, potássio e luz**: no dataset eles quase nunca saem da faixa.
- São só 365 dias de dados (292 no treino): as classes `Irrigar` e `Travar Irrigação` têm poucos exemplos.
- As âncoras da tradução são escolhas nossas, descritas acima e em `adaptador_morango.py`.

## Usar outro modelo

- **Outro modelo de morango com as mesmas 15 colunas** (ex.: o grupo retreinou): salve com
  `joblib.dump(modelo, "arquivo.joblib")`, copie para esta pasta e troque `"arquivo"` em `config_modelo.json`.
- **Um modelo de tomate:** crie um `adaptador_tomate.py` com as mesmas funções do de morango (`COLUNAS`,
  `traduzir_entrada`, `interpretar`, `escolher_ferramenta`, `resumo`) e um `config` com `"adaptador": "tomate"`.
- **Um modelo com as 7 variáveis do jogo** (N, P, K, pH, temperatura, umidade, luminosidade): use
  `"adaptador": "direto"` com `"colunas"` (a ordem do treino e a variável do jogo de cada uma) e `"rotulos"` (o que o
  modelo devolve → a ação do jogo). Rodar com outra configuração: `python ia-servidor/servidor_ia.py outro.json`.
  `gerar_dados.mjs` gera dados desse formato a partir do simulador do jogo.

`inspecionar_modelo.py` mostra as colunas, as classes e a versão do scikit-learn de qualquer modelo salvo.

**Versão do scikit-learn:** um modelo salvo numa versão pode dar aviso ou erro em outra. Por isso o modelo é
treinado no próprio PC do jogo, e não vai para o Git.

## Unidades que o jogo envia

| Variável do jogo | Unidade | Faixa ideal do morango no jogo |
|---|---|---|
| `nitrogen` (N) | mg/L | 120–170 |
| `phosphorus` (P) | mg/L | 40–60 |
| `potassium` (K) | mg/L | 180–250 |
| `ph` | pH | 5,5–6,5 |
| `airTemperature` | °C | 18–24 |
| `soilMoisture` | % | 60–75 |
| `luminosity` | % | 55–75 |
