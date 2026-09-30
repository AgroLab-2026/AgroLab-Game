// Controle de videogame (Gamepad API): PlayStation (DualSense do PS5, DualShock 4), Xbox (One,
// Series, 360) e genéricos no "mapeamento padrão" do navegador. Nenhum driver extra: Chrome e Edge
// reconhecem os controles por USB ou Bluetooth.
//
// O mapeamento padrão usa a POSIÇÃO do botão, igual nos dois controles:
//   índice   PlayStation   Xbox        posição
//   0        ✕             A           embaixo
//   1        ○             B           direita
//   2        □             X           esquerda
//   3        △             Y           em cima
//   4 / 5    L1 / R1       LB / RB     ombros
//   6 / 7    L2 / R2       LT / RT     gatilhos
//   8 / 9    CREATE / OPTIONS  View / Menu
//   10 / 11  L3 / R3       LS / RS     apertar os analógicos
//   12-15    direcional ↑ ↓ ← →
//   16       PS            Xbox
//   17       touchpad      (não existe)
// Por isso a mesma ação fica no mesmo lugar nos dois; só o símbolo mostrado muda.
export const BOTAO = {
  BAIXO_FACE: 0, DIREITA_FACE: 1, ESQUERDA_FACE: 2, CIMA_FACE: 3, L1: 4, R1: 5, L2: 6, R2: 7,
  SELECT: 8, START: 9, L3: 10, R3: 11, CIMA: 12, BAIXO: 13, ESQUERDA: 14, DIREITA: 15, CENTRAL: 16, TOUCHPAD: 17,
};

/** Símbolos de cada botão por família de controle. */
export const GLIFOS = {
  ps: {
    nome: 'PlayStation', [BOTAO.BAIXO_FACE]: '✕', [BOTAO.DIREITA_FACE]: '○', [BOTAO.ESQUERDA_FACE]: '□', [BOTAO.CIMA_FACE]: '△',
    [BOTAO.L1]: 'L1', [BOTAO.R1]: 'R1', [BOTAO.L2]: 'L2', [BOTAO.R2]: 'R2', [BOTAO.SELECT]: 'CREATE', [BOTAO.START]: 'OPTIONS',
    [BOTAO.R3]: 'R3', [BOTAO.TOUCHPAD]: 'touchpad',
  },
  xbox: {
    nome: 'Xbox', [BOTAO.BAIXO_FACE]: 'A', [BOTAO.DIREITA_FACE]: 'B', [BOTAO.ESQUERDA_FACE]: 'X', [BOTAO.CIMA_FACE]: 'Y',
    [BOTAO.L1]: 'LB', [BOTAO.R1]: 'RB', [BOTAO.L2]: 'LT', [BOTAO.R2]: 'RT', [BOTAO.SELECT]: 'View', [BOTAO.START]: 'Menu',
    [BOTAO.R3]: 'RS', [BOTAO.TOUCHPAD]: 'RS',
  },
};

export class Controle {
  /**
   * @param {(botao:number, controle:Gamepad) => void} aoApertar
   * @param {(info:{conectado:boolean, nome:string, tipo:'ps'|'xbox'|null}) => void} aoMudar
   *        conexão, desconexão ou troca do controle em uso (ex.: de um Xbox para um PS5)
   */
  constructor(aoApertar, aoMudar) {
    this.aoApertar = aoApertar;
    this.aoMudar = aoMudar;
    this.anterior = new Map(); // índice do controle -> botões apertados no quadro anterior
    this.conectado = null;     // Gamepad em uso (o último que apertou algo)
    this.tipo = null;          // 'ps' | 'xbox' do controle em uso
    addEventListener('gamepadconnected', (e) => this.usar(e.gamepad, true));
    addEventListener('gamepaddisconnected', (e) => {
      this.anterior.delete(e.gamepad.index);
      if (this.conectado?.index !== e.gamepad.index) return;
      const outro = [...(navigator.getGamepads?.() || [])].find((g) => g?.connected && g.index !== e.gamepad.index);
      this.conectado = null;
      this.tipo = null;
      if (outro) this.usar(outro, true);
      else this.aoMudar({ conectado: false, nome: Controle.nome(e.gamepad), tipo: null });
    });
  }

  /** Família do controle pelo id que o navegador informa (Sony = 054c, Microsoft = 045e). */
  static tipo(gp) {
    const id = gp?.id || '';
    if (/xbox|xinput|045e/i.test(id)) return 'xbox'; // antes: o Xbox também se chama "Wireless Controller"
    if (/054c|dualsense|dualshock|playstation|ps[345]\b/i.test(id)) return 'ps';
    return 'xbox'; // Xbox e a maioria dos genéricos (XInput) usam A/B/X/Y
  }

  static nome(gp) {
    const id = gp?.id || '';
    if (/dualsense|0ce6|0df2/i.test(id)) return 'DualSense (PS5)';
    if (Controle.tipo(gp) === 'ps') return 'Controle PlayStation';
    if (/xbox|xinput|045e/i.test(id)) return 'Controle Xbox';
    return 'Controle';
  }

  /** Passa a usar este controle (e avisa se a família mudou). */
  usar(gp, conectou = false) {
    const tipo = Controle.tipo(gp);
    const mudou = conectou || this.conectado?.index !== gp.index || this.tipo !== tipo;
    this.conectado = gp;
    this.tipo = tipo;
    if (mudou) this.aoMudar({ conectado: true, nome: Controle.nome(gp), tipo });
  }

  /** Símbolo do botão no controle em uso (PlayStation por padrão). */
  glifo(botao) { return GLIFOS[this.tipo || 'ps'][botao]; }

  /** Chamado a cada quadro. */
  atualizar() {
    const lista = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of lista) {
      if (!gp || !gp.connected) continue;
      const antes = this.anterior.get(gp.index) || [];
      const agora = gp.buttons.map((b) => b.pressed || b.value > 0.5);
      agora.forEach((apertado, i) => {
        if (apertado && !antes[i]) {
          if (this.conectado?.index !== gp.index) this.usar(gp);
          else this.conectado = gp; // o Chrome devolve um objeto novo a cada leitura
          this.aoApertar(i, gp);
        }
      });
      this.anterior.set(gp.index, agora);
    }
  }

  /** Vibração curta (se o navegador e o controle suportarem). */
  vibrar(forte = 0.3, fraco = 0.5, duracao = 90) {
    const act = this.conectado?.vibrationActuator;
    if (!act?.playEffect) return;
    act.playEffect('dual-rumble', { duration: duracao, strongMagnitude: forte, weakMagnitude: fraco }).catch(() => {});
  }
}
