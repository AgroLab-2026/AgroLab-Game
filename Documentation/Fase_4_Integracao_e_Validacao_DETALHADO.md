# FASE 4 — Integração, Balanceamento e Validação
### Documento passo a passo · nível iniciante absoluto

O jogo já funciona e tem cara. Nesta fase final ele fica **bom, justo, com som, rodando dentro da estufa física** e — o mais importante — **comprovadamente educativo**. Alguns passos aqui são de "ajuste fino" (mexer em números e testar); outros envolvem pequenas mudanças de código, sempre com o passo a passo.

> **Pré-requisito:** Fases 1, 2 e 3 concluídas. Reserve tempo: esta fase é feita de **testar → ajustar → testar de novo**, várias vezes.

---

## PARTE A — Conceitos novos desta fase

- **Balanceamento:** ajustar os números do jogo (velocidade, custos, dificuldade) até a experiência ficar boa — nem fácil demais, nem impossível.
- **Ajustar durante o Play:** você pode mudar valores no Inspector **enquanto o jogo roda** para testar na hora. ⚠️ **Esses valores voltam ao normal quando você para o Play.** Sempre **anote** os que gostou e reaplique com o jogo parado.
- **Build:** transformar o projeto num programa executável (um `.exe` no Windows) que roda **fora** do Unity — é o que você leva para o projetor da estufa.
- **Playtest:** sentar pessoas de verdade para jogar e observar, para descobrir o que funciona e o que confunde.

---

## PARTE B — Passo a passo da Fase 4

### Passo 1 — Alimentar o jogo com os dados da frente de IA

**Por quê:** o jogo precisa refletir a realidade agronômica que a equipe de Inteligência pesquisou (o morango é a prova de conceito).

1. Peça à equipe de IA os **valores médios reais** do morango: faixas de N, P, K, pH, temperatura, umidade e luz.
2. No asset `Morango` (em `ScriptableObjects`), ajuste as faixas para **casar** com esses dados.
3. Defina o **cenário de partida**: selecione o `GameManager`, encontre a seção **Player Env** (o estado inicial do ambiente) e ajuste os valores iniciais (nitrogênio, pH, temperatura, etc.) para o ponto de partida que a pesquisa indicar.
   *(Se a seção Player Env não aparecer expandida no Inspector, clique na setinha ao lado do nome para abrir.)*
4. Combine com a equipe a intensidade dos eventos de clima, para que empurrem as variáveis de forma coerente com o que acontece de verdade numa estufa.

**✅ Resultado:** os números do jogo têm base científica, não são inventados.

---

### Passo 2 — Balancear o ritmo (o "tempero" do jogo)

**Por quê:** achar o ponto em que o jogador consegue acompanhar a IA com esforço, mas erra se relaxar.

Faça assim, em ciclos:

1. Aperte **Play**.
2. **Durante** o jogo, selecione objetos e ajuste estes valores, observando o efeito na hora:
   - `GameManager` → **Time Scale**: a velocidade geral do tempo. Muito rápido cansa; muito lento entedia.
   - Selecione `PlantaJogador` → no **Plant Controller**:
     - **Base Growth Rate**: quão rápido a planta cresce em condições boas.
     - **Max Health Decay**: quão duro é o castigo quando as condições estão ruins.
   - Selecione `Sistemas` → no **Player Action Controller** e no **Resource System**: os custos de água/energia e os estoques iniciais.
   - No **Weather Event System**: **Min/Max Interval** (de quanto em quanto tempo vêm os eventos) e **Event Duration** (quanto duram).
3. Achou uma combinação boa? **Anote os valores num papel.**
4. **Pare o Play.** Reaplique os valores anotados (agora eles ficam salvos).
5. Repita até o jogo ficar gostoso e desafiador.

**✅ Resultado:** uma partida que prende a atenção e ensina pelo desafio.

---

### Passo 3 — Adicionar som (opcional, mas recomendado)

**Por quê:** som ambiente e retorno sonoro deixam o jogo vivo e dão feedback às ações.

**3.1 — Som ambiente (fácil)**
1. Coloque um arquivo de áudio (ex.: som de estufa/natureza em loop) em `Assets/_Project/Audio`.
2. `GameObject → Create Empty` → renomeie para `AudioAmbiente`.
3. **Add Component → Audio Source.** No componente:
   - Arraste seu clipe para o campo **AudioClip**.
   - Marque **Loop** e **Play On Awake**.

**3.2 — Sons de ação e evento (um pouco mais avançado)**
Este passo mexe em código. Se preferir, deixe para depois.
1. Crie um script `GameAudio` (na Project: `Create → C# Script`, nome `GameAudio`, dentro de `Scripts/Core`). Cole:

```csharp
using UnityEngine;

// Toca sons quando o clima muda. Coloque num objeto com um Audio Source.
public class GameAudio : MonoBehaviour
{
    public WeatherEventSystem weather;
    public AudioSource source;
    public AudioClip somEvento;

    void Start()
    {
        if (weather != null)
            weather.OnEventStarted += (evt, desc) => { if (source && somEvento) source.PlayOneShot(somEvento); };
    }
}
```
2. No objeto `AudioAmbiente` (ou num novo objeto com Audio Source), **Add Component → Game Audio**, e arraste: o `Sistemas` para **Weather**, o próprio Audio Source para **Source**, e um clipe curto para **Som Evento**.

**✅ Resultado:** o jogo tem trilha e avisos sonoros.

---

### Passo 4 — Refinar o modelo climático (refinamento avançado)

**Por quê:** hoje, por simplicidade, o clima e a proteção do jogador mexem no mesmo ambiente, e a IA acaba "sentindo" a proteção do jogador. Este ajuste torna a comparação **fisicamente honesta**: quando você protege sua planta, só a **sua** estufa esfria.

> Este passo é o mais técnico do projeto. Se você é iniciante, sugiro fazê-lo **por último** ou com ajuda. Ele não impede nada dos demais.

**A ideia:** criar um "clima externo" separado, que atinge todo mundo por igual, enquanto cada estufa aplica sua própria proteção em cima disso.

Roteiro do ajuste (peça ajuda se travar):
1. No `GameManager`, crie um segundo ambiente só para o clima externo:
   ```csharp
   public EnvironmentState ambienteExterno = new EnvironmentState();
   ```
2. Em `Awake()`, faça o clima atingir esse ambiente externo, e não o do jogador:
   ```csharp
   weather.targetEnv = ambienteExterno;
   ```
3. A cada tick (no `Update`), copie a temperatura e a luz do ambiente externo para o do jogador **antes** de aplicar as ações — assim o clima chega igual para os dois, e a ação de proteger reduz só o lado de quem protegeu.
4. Ajuste o `AutonomousFarmAI` para ler o `ambienteExterno` como clima base.

*(Se preferir, me chame para eu te entregar essa versão do código já pronta e comentada.)*

**✅ Resultado:** proteger a planta beneficia só quem protegeu; a comparação com a IA fica justa.

---

### Passo 5 — Rodar dentro da estufa física (projeção)

**Por quê:** o destino do jogo é ser projetado na parede de fundo da estufa de MDF.

1. Descubra a **resolução nativa do projetor** (ex.: 1920×1080 ou 1280×720).
2. No Unity: `Edit → Project Settings → Player`. Abra **Resolution and Presentation** e defina o modo de tela (ex.: **Fullscreen Window**) e a resolução alvo.
3. Faça o **Build**: `File → Build Settings`. Se a sua cena não estiver na lista "Scenes In Build", clique **Add Open Scenes**. Depois clique **Build**, escolha uma pasta e espere gerar o executável.
4. Leve o executável para o computador ligado ao projetor. Rode e **teste no ambiente real**, com a iluminação que a estufa terá durante o uso.
5. Ajustes finos:
   - Se a imagem sair torta na parede, use o **keystone** (ajuste de distorção) do próprio projetor.
   - Se algo ficar difícil de ler projetado, **aumente as fontes** e reforce o contraste (volte ao HUD na Fase 2). É comum precisar.

**✅ Resultado:** a interface legível e bem enquadrada dentro da estufa.

---

### Passo 6 — Playtest educativo (o teste que mais importa)

**Por quê:** o objetivo do projeto não é só divertir, é **ensinar** agricultura de precisão. Aqui você comprova isso.

1. Convide pessoas que **não** conhecem o projeto (colegas, visitantes).
2. Deixe cada uma jogar **sem você ajudar**. Fique observando e anotando:
   - Ela entende o que cada uma das **4 ações** faz?
   - Percebe a ligação entre as **7 variáveis** e a saúde da planta?
   - A comparação com a IA a faz **mudar de estratégia**?
   - No fim, ela consegue **explicar** por que a tecnologia ajudou a IA a ser mais eficiente?
3. Ao terminar, pergunte o que confundiu e o que ficou claro.
4. **Priorize os pontos de confusão** e volte às fases correspondentes para corrigir (ex.: um texto confuso → Fase 2; um evento injusto → Passo 2 desta fase).
5. Repita com mais pessoas até a mensagem passar de forma consistente.

**✅ Resultado final do projeto:** evidência de que quem joga **sai sabendo mais** sobre agricultura de precisão — exatamente a missão do *Semente da Evolução*.

---

## PARTE C — Checklist final da Fase 4

- [ ] Dados reais da frente de IA aplicados ao morango e ao cenário inicial
- [ ] Ritmo balanceado (valores anotados e reaplicados com o Play parado)
- [ ] Som ambiente (e, se fez, sons de evento) funcionando
- [ ] (Avançado) Modelo climático refinado, comparação justa
- [ ] Build gerado e testado no projetor, dentro da estufa
- [ ] Playtest feito com pessoas reais, feedback coletado e aplicado

Com esta fase concluída, o projeto está **completo de ponta a ponta**: um jogo educativo, jogável, bonito, integrado ao hardware e validado com o público. 🌱

*(Travou em algum passo? Me chame citando a fase e o número — ex.: "Fase 4, passo 4" — que a gente resolve junto.)*
