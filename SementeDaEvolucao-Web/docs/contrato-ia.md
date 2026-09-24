# Contrato da IA

O jogo conversa com qualquer IA por **uma única função**:

```js
decidir(snapshot) → Promise<{ acao, motivo }>
```

- `snapshot`: o estado de uma estufa, serializável em JSON (formato abaixo).
- `acao`: uma das 4 ações: `"DoNothing"`, `"LockIrrigation"`, `"Irrigate"` ou `"ProtectPlant"`.
- `motivo`: texto curto em português, mostrado ao jogador (com o Painel de Dados e no relatório de fim de fase).

A IA de vocês **não precisa** simular nada: basta olhar o snapshot e escolher a ação.
A simulação (crescimento, clima, custos) continua no jogo.

## Provedores

| `?ia=` | Arquivo | O que faz |
|---|---|---|
| `regras` (padrão) | `js/ai/provedores/regras.js` | Porte do `AutonomousFarmAI.cs`: `EnvironmentState.SuggestAction` pelas faixas da cultura |
| `mock` | `js/ai/provedores/mock.js` | Respostas fixas. `&mockAcoes=Irrigate,DoNothing` define a sequência |
| `http` | `js/ai/provedores/http.js` | `POST` do snapshot para `iaUrl`, esperando `{ acao, motivo }` |

Configuração padrão em `data/ia.json`. A URL sobrescreve:
`index.html?ia=http&iaUrl=http://localhost:5000/decidir&timeoutMs=800`

Todo provedor passa pelo `ProvedorComFallback` (`js/ai/IAProvider.js`):
- **timeout** (padrão 800 ms): se a IA demorar, a decisão vem das `regras`;
- **erro de rede/HTTP** ou **resposta inválida** (ação fora das 4): também cai nas `regras`;
- o campo `fonte` diz de onde veio a decisão (ex.: `regras (fallback: timeout)`), e aparece no modo debug.

O jogo **nunca trava** esperando a IA: a decisão é assíncrona e aplicada no tick seguinte à resposta.
Trocar o provedor não exige mudar nenhum outro módulo (o teste headless joga uma partida inteira com o `mock`).

**Chaves de API nunca ficam no frontend.** Se a IA usar um serviço pago, o `iaUrl` deve apontar para um
servidor de vocês que guarda a chave e repassa a chamada.

## Snapshot (entrada)

Exemplo real, gerado pelo jogo durante uma Onda de Calor (Morango):

```json
{
  "versao": 1,
  "tempo": 20,
  "cultura": {
    "id": "Morango",
    "nome": "Morango",
    "faixas": {
      "nitrogen":       { "min": 120, "max": 170 },
      "phosphorus":     { "min": 40,  "max": 60 },
      "potassium":      { "min": 180, "max": 250 },
      "ph":             { "min": 5.5, "max": 6.5 },
      "airTemperature": { "min": 18,  "max": 24 },
      "soilMoisture":   { "min": 60,  "max": 75 },
      "luminosity":     { "min": 55,  "max": 75 }
    }
  },
  "ambiente": {
    "nitrogen": 143.4, "phosphorus": 49.5, "potassium": 213.2, "ph": 6.04,
    "airTemperature": 30.35, "soilMoisture": 63.9, "luminosity": 88.94
  },
  "planta": { "estagio": 0, "saude": 86.9, "crescimento": 0.052 },
  "recursos": { "agua": 0, "fertilizante": 0, "energia": 0 },
  "clima": {
    "externo": { "airTemperature": 32.2, "luminosity": 94, "umidadeAr": 44, "condicao": "Calor extremo" },
    "evento": { "id": "HeatWave", "restante": 5 },
    "sombraAtiva": false
  }
}
```

| Campo | Significado |
|---|---|
| `versao` | Versão do contrato (hoje `1`) |
| `tempo` | Segundos de jogo desde o início da fase |
| `cultura.faixas` | Faixa ideal de cada uma das 7 variáveis |
| `ambiente` | As 7 variáveis da bancada: N, P, K (mg/L), pH, temperatura do ar (°C), umidade do substrato (%), luminosidade (%) |
| `planta.estagio` | 0 Semente · 1 Muda · 2 Vegetativo · 3 Floração · 4 Frutificação · 5 Colheita |
| `planta.saude` | 0–100 |
| `planta.crescimento` | 0–1 (1 = pronta para colher) |
| `recursos` | Estufa autônoma: consumo acumulado. IA assistente (fase 7): quanto o jogador ainda tem |
| `clima.externo` | Clima fora da estufa (o mesmo para as duas estufas) |
| `clima.evento` | Evento ativo (`HeatWave`, `HeavyRain`, `Pest`, `PowerFailure`) e segundos reais restantes, ou `null` |
| `clima.sombraAtiva` | Se a proteção (sombrite) já está ativa nesta estufa |

## Resposta (saída)

```json
{ "acao": "ProtectPlant", "motivo": "Temperatura 30.4 °C acima do máximo (24 °C)." }
```

Outros exemplos:

```json
{ "acao": "Irrigate", "motivo": "Substrato seco: 57% (mín. 60%)." }
{ "acao": "LockIrrigation", "motivo": "pH 6.71 fora da faixa 5.5–6.5." }
{ "acao": "DoNothing", "motivo": "Tudo dentro da faixa ideal." }
```

## Onde a IA é usada

1. **Estufa autônoma** (`AutonomousFarmAI`): pede uma decisão a cada 1 s de jogo (`ia.intervaloDecisao`).
2. **IA assistente** (fase 7): pede decisões para a estufa **do jogador**, a cada 2 s de jogo, gastando os
   recursos dele com a tabela de precisão da IA.

## Falas do Sr. Bruno (gerador externo, opcional)

Hoje as falas vêm do roteiro `data/falas.json`, escolhido pela prioridade do `BrunoDialogue.cs`. Para usar um
gerador externo, configure `falasUrl` em `data/ia.json` (ou `?falasUrl=`). O jogo envia:

```json
{
  "categoria": "calorLuz",
  "cultura": "Morango",
  "ambiente": { "nitrogen": 143.4, "phosphorus": 49.5, "potassium": 213.2, "ph": 6.04, "airTemperature": 30.35, "soilMoisture": 63.9, "luminosity": 88.94 },
  "saude": 86.9,
  "falaRoteiro": "Está quente demais para morango! Proteja a planta (tecla 4) antes que ela queime."
}
```

e espera `{ "fala": "texto até 280 caracteres" }`. As categorias são `saudeCritica`, `calorLuz`, `encharcado`,
`seco`, `nutrientes`, `ph`, `semMedidor` e `otimo`. Enquanto a resposta não chega, ou se falhar, vale o roteiro.

## Exemplo mínimo de servidor (Python, para testar)

```python
# pip install flask
from flask import Flask, request, jsonify
app = Flask(__name__)

@app.post("/decidir")
def decidir():
    s = request.get_json()
    a, f = s["ambiente"], s["cultura"]["faixas"]
    if a["airTemperature"] > f["airTemperature"]["max"]:
        return jsonify(acao="ProtectPlant", motivo="Calor acima da faixa.")
    if a["soilMoisture"] < f["soilMoisture"]["min"]:
        return jsonify(acao="Irrigate", motivo="Substrato seco.")
    return jsonify(acao="DoNothing", motivo="Tudo ok.")

@app.after_request
def cors(r):
    r.headers["Access-Control-Allow-Origin"] = "*"
    r.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return r

app.run(port=5000)
```

Depois, abra o jogo com `?ia=http&iaUrl=http://localhost:5000/decidir`.
