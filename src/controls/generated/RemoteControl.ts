import { clamp, ControlHandle } from '../ControlHandle.js';

/** Media controller remote with mode selection, power and transport/navigation buttons. (generated). */
export class RemoteControl extends ControlHandle {
  static readonly controlType = 'Remote';

  /** Enable the mode with the given ID (cannot select mode 0 - use reset). */
  async setMode(modeID: number): Promise<void> {
    await this.send(`mode/${Math.round(modeID)}`);
  }
  /** Enable the AQp (Power) output. */
  async on(): Promise<void> {
    await this.send('on');
  }
  /** Disable the AQp (Power) output. */
  async off(): Promise<void> {
    await this.send('off');
  }
  /** Press the Mute button. */
  async mute(): Promise<void> {
    await this.send('mute');
  }
  /** Press the Play button. */
  async play(): Promise<void> {
    await this.send('play');
  }
  /** Press the Pause button. */
  async pause(): Promise<void> {
    await this.send('pause');
  }
  /** Press the Stop button. */
  async stop(): Promise<void> {
    await this.send('stop');
  }
  /** Press the Rewind button. */
  async rewind(): Promise<void> {
    await this.send('rewind');
  }
  /** Press the Previous button. */
  async previous(): Promise<void> {
    await this.send('previous');
  }
  /** Press the Next button. */
  async next(): Promise<void> {
    await this.send('next');
  }
  /** Press the Forward button. */
  async forward(): Promise<void> {
    await this.send('forward');
  }
  /** Press the Menu button. */
  async menu(): Promise<void> {
    await this.send('menu');
  }
  /** Press the Info button. */
  async info(): Promise<void> {
    await this.send('info');
  }
  /** Press the Exit button. */
  async exit(): Promise<void> {
    await this.send('exit');
  }
  /** Press the Guide button. */
  async guide(): Promise<void> {
    await this.send('guide');
  }
  /** Press the Volume Plus button. */
  async volPlus(): Promise<void> {
    await this.send('volplus');
  }
  /** Press the Volume Minus button. */
  async volMinus(): Promise<void> {
    await this.send('volminus');
  }
  /** Release the Volume Plus button. */
  async volPlusOff(): Promise<void> {
    await this.send('volplusoff');
  }
  /** Release the Volume Minus button. */
  async volMinusOff(): Promise<void> {
    await this.send('volminusoff');
  }
  /** Press the Program Plus button. */
  async prgPlus(): Promise<void> {
    await this.send('prgplus');
  }
  /** Press the Program Minus button. */
  async prgMinus(): Promise<void> {
    await this.send('prgminus');
  }
  /** Release the Program Plus button. */
  async prgPlusOff(): Promise<void> {
    await this.send('prgplusoff');
  }
  /** Release the Program Minus button. */
  async prgMinusOff(): Promise<void> {
    await this.send('prgminusoff');
  }
  /** Press the Return button. */
  async return(): Promise<void> {
    await this.send('return');
  }
  /** Press the Red button. */
  async btnRed(): Promise<void> {
    await this.send('btnred');
  }
  /** Press the Blue button. */
  async btnBlue(): Promise<void> {
    await this.send('btnblue');
  }
  /** Press the Yellow button. */
  async btnYellow(): Promise<void> {
    await this.send('btnyellow');
  }
  /** Press the Green button. */
  async btnGreen(): Promise<void> {
    await this.send('btngreen');
  }
  /** Press the D-Pad OK button. */
  async dirOk(): Promise<void> {
    await this.send('dirok');
  }
  /** Press the D-Pad Up button. */
  async dirUp(): Promise<void> {
    await this.send('dirup');
  }
  /** Release the D-Pad Up button. */
  async dirUpOff(): Promise<void> {
    await this.send('dirupoff');
  }
  /** Press the D-Pad Down button. */
  async dirDown(): Promise<void> {
    await this.send('dirdown');
  }
  /** Release the D-Pad Down button. */
  async dirDownOff(): Promise<void> {
    await this.send('dirdownoff');
  }
  /** Press the D-Pad Left button. */
  async dirLeft(): Promise<void> {
    await this.send('dirleft');
  }
  /** Release the D-Pad Left button. */
  async dirLeftOff(): Promise<void> {
    await this.send('dirleftoff');
  }
  /** Press the D-Pad Right button. */
  async dirRight(): Promise<void> {
    await this.send('dirright');
  }
  /** Release the D-Pad Right button. */
  async dirRightOff(): Promise<void> {
    await this.send('dirrightoff');
  }
  /** Send a single digit number x (0-9), e.g. num1. */
  async num(x: number): Promise<void> {
    await this.send(`num${clamp(x, 0, 9)}`);
  }
  /** Send any positive number x, e.g. number/18. */
  async number(x: number): Promise<void> {
    await this.send(`number/${Math.round(x)}`);
  }
  /** Turn off all devices of the current mode and change to mode 0 (since Miniserver 8.0). */
  async reset(): Promise<void> {
    await this.send('reset');
  }
  /** The timeout in milliseconds. */
  get timeout(): number | undefined {
    return this.numeric('timeout');
  }
  /** The key for the current mode (0 means no mode selected = all off). */
  get mode(): number | undefined {
    return this.numeric('mode');
  }
  /** True while the Miniserver is sending mode-switch or power-on commands (since Config 8.0). */
  get active(): boolean | undefined {
    return this.boolean('active');
  }
}
