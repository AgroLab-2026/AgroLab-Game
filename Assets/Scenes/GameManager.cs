using UnityEngine;

/// <summary>
/// O MAESTRO. Avança o tempo de jogo e, a cada quadro, faz a planta do jogador
/// e a da IA crescerem, lê as teclas 1–4 (as 4 ações) e desenha um HUD de debug
/// com a comparação Jogador × IA. Conecta todos os sistemas em um lugar só.
///
/// É a peça que faltava: sem este script, ninguém chama Tick() e nada acontece.
/// </summary>
public class GameManager : MonoBehaviour
{
    [Header("Cultura em jogo (arraste o asset do Morango)")]
    public CropData crop;

    [Header("Referências de cena")]
    public PlantController       playerPlant;
    public AutonomousFarmAI      aiAI;
    public ResourceSystem        resources;
    public PlayerActionController playerActions;
    public WeatherEventSystem    weather;
    public BrunoDialogue         bruno;

    [Header("Tempo")]
    [Tooltip("Multiplicador do tempo de jogo (2 = passa 2x mais rápido).")]
    public float timeScale = 2f;

    // Estado físico-químico da bancada do JOGADOR. Uma única instância,
    // compartilhada por todos os sistemas (evita variáveis dessincronizadas).
    public EnvironmentState playerEnv = new EnvironmentState();

    // Mensagens temporárias para o HUD.
    private string _weatherMsg = "Tempo estável.";
    private string _alertMsg   = "";

    void Awake()
    {
        // Distribui a MESMA instância de ambiente e a cultura para todo mundo.
        playerActions.playerEnv = playerEnv;
        playerActions.resources = resources;
        weather.targetEnv       = playerEnv;

        playerPlant.crop = crop;
        bruno.crop       = crop;
        aiAI.crop        = crop;
        if (aiAI.aiPlant != null) aiAI.aiPlant.crop = crop;

        // Assina os eventos para alimentar o HUD.
        weather.OnEventStarted += (evt, desc) => _weatherMsg = desc;
        weather.OnEventEnded   += (evt)       => _weatherMsg = "Tempo estável.";
        resources.OnResourceDepleted += (recurso) => _alertMsg = $"Sem {recurso}!";
    }

    void Update()
    {
        float dt = Time.deltaTime * timeScale;

        // ---- Input do jogador: as 4 ações ----
        if (Input.GetKeyDown(KeyCode.Alpha1)) DoAction(FarmAction.DoNothing);
        if (Input.GetKeyDown(KeyCode.Alpha2)) DoAction(FarmAction.LockIrrigation);
        if (Input.GetKeyDown(KeyCode.Alpha3)) DoAction(FarmAction.Irrigate);
        if (Input.GetKeyDown(KeyCode.Alpha4)) DoAction(FarmAction.ProtectPlant);

        // ---- Avança o mundo ----
        playerPlant.Tick(playerEnv, dt);   // planta do jogador
        aiAI.Tick(playerEnv, dt);          // IA sente o mesmo clima e cultiva a dela
    }

    private void DoAction(FarmAction action)
    {
        bool ok = playerActions.Execute(action);
        _alertMsg = ok
            ? $"Você: {AutonomousFarmAI.Translate(action)}"
            : "Recurso insuficiente para essa ação!";
    }

    // HUD de debug rápido. Substitua por um Canvas de verdade depois (alto contraste
    // para a projeção na estufa de MDF). Por enquanto, é o que prova que funciona.
    void OnGUI()
    {
        GUI.skin.label.fontSize = 16;
        var style = new GUIStyle(GUI.skin.box) { alignment = TextAnchor.UpperLeft, fontSize = 14 };

        // Coluna do JOGADOR
        GUI.Box(new Rect(10, 10, 360, 250),
            $"<b>VOCÊ — {crop.cropName}</b>\n" +
            $"Saúde: {playerPlant.health:0}%   Crescimento: {(playerPlant.growthPoints / crop.growthPointsToHarvest):P0}\n" +
            $"────────────\n" +
            $"N {playerEnv.nitrogen:0}  P {playerEnv.phosphorus:0}  K {playerEnv.potassium:0}  pH {playerEnv.ph:0.0}\n" +
            $"Temp {playerEnv.airTemperature:0}°C  Umid {playerEnv.soilMoisture:0}%  Luz {playerEnv.luminosity:0}%\n" +
            $"────────────\n" +
            $"Água {resources.water:0}L  Fert {resources.nutrientStock:0}  Energia {resources.energy:0}\n" +
            $"Bruno: {bruno.GetContextualTip(playerEnv, playerPlant)}",
            style);

        // Coluna da IA
        GUI.Box(new Rect(380, 10, 360, 110),
            $"<b>ESTUFA AUTÔNOMA</b>\n────────────\n{aiAI.ScoreboardLine()}", style);

        // Clima + ação
        GUI.Box(new Rect(10, 270, 730, 60),
            $"<b>Clima:</b> {_weatherMsg}    {_alertMsg}\n" +
            $"Teclas → 1: Não fazer nada | 2: Travar irrigação | 3: Irrigar | 4: Proteger", style);
    }
}
