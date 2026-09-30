// Controle de videogame (Gamepad API): DualSense do PS5, DualShock 4, Xbox e genéricos no
// "mapeamento padrão" do navegador. Lê os botões a cada quadro e avisa só quando um botão
// acaba de ser apertado. Nenhum driver extra: o Chrome/Edge reconhecem o DualSense por USB ou
// Bluetooth.
//
// Índices do mapeamento padrão (DualSense):
//   0 ✕   1 ○   2 □   3 △   4 L1   5 R1   6 L2   7 R2   8 Create   9 Options
//   10 L3  11 R3  12 ↑  13 ↓  14 ←  15 →   16 PS  17 touchpad
export const BOTAO = {
  X: 0, CIRCULO: 1, QUADRADO: 2, TRIANGULO: 3, L1: 4, R1: 5, L2: 6, R2: 7,
  CREATE: 8, OPTIONS: 9, L3: 10, R3: 11, CIMA: 12, BAIXO: 13, ESQUERDA: 14, DIREITA: 15, PS: 16, TOUCHPAD: 17,
};

export class Controle {
  /**
   * @param {(botao:number, controle:Gamepad) => void} aoApertar
   * @param {(conectado:boolean, nome:string) => void} aoConectar
   */
  constructor(aoApertar, aoConectar) {
    this.aoApertar = aoApertar;
    this.aoConectar = aoConectar;
    this.anterior = new Map(); // índice do controle -> botões apertados no quadro anterior
    this.conectado = null;     // Gamepad em uso (o último que apertou algo)
    addEventListener('gamepadconnected', (e) => this.aoConectar(true, Controle.nome(e.gamepad)));
    addEventListener('gamepaddisconnected', (e) => {
      this.anterior.delete(e.gamepad.index);
      if (this.conectado?.index === e.gamepad.index) this.conectado = null;
      this.aoConectar(false, Controle.nome(e.gamepad));
    });
  }

  /** Nome amigável a partir do id que o navegador informa. */
  static nome(gp) {
    const id = gp?.id || '';
    if (/dualsense|0ce6|0df2/i.test(id)) return 'DualSense (PS5)';
    if (/dualshock|054c/i.test(id)) return 'Controle PlayStation';
    if (/xbox|xinput|045e/i.test(id)) return 'Controle Xbox';
    return 'Controle';
  }

  /** Chamado a cada quadro. */
  atualizar() {
    const lista = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of lista) {
      if (!gp || !gp.connected) continue;
      const antes = this.anterior.get(gp.index) || [];
      const agora = gp.buttons.map((b) => b.pressed || b.value > 0.5);
      agora.forEach((apertado, i) => {
        if (apertado && !antes[i]) {
          this.conectado = gp;
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
