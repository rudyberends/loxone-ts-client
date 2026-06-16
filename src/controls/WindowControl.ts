import { clamp, ControlHandle } from './ControlHandle.js';

/**
 * A `Window` control (motorised window).
 * States: `position` (0 = closed … 1 = open), `direction` (-1 closing, 0 idle, 1 opening).
 * Commands: `fullopen`, `fullclose`, `moveToPosition/{0..100}`, `slightlyOpen`, `stop`,
 * and jog mode `open/on`·`open/off`·`close/on`·`close/off`.
 */
export class WindowControl extends ControlHandle {
  static readonly controlType = 'Window';

  async fullOpen(): Promise<void> {
    await this.send('fullopen');
  }
  async fullClose(): Promise<void> {
    await this.send('fullclose');
  }
  async stop(): Promise<void> {
    await this.send('stop');
  }
  /** Moves to a partially open position. */
  async slightlyOpen(): Promise<void> {
    await this.send('slightlyOpen');
  }
  /** Moves to a position as a percentage: 0 = closed, 100 = fully open. */
  async setPosition(percent: number): Promise<void> {
    await this.send(`moveToPosition/${clamp(percent, 0, 100)}`);
  }

  /** Position, 0 (closed) … 1 (open). */
  get position(): number | undefined {
    return this.numeric('position');
  }
  /** Position as a percentage open, 0 … 100. */
  get positionPercent(): number | undefined {
    const p = this.position;
    return p === undefined ? undefined : Math.round(p * 100);
  }
  /** Movement: -1 closing, 0 idle, 1 opening. */
  get movement(): number | undefined {
    return this.numeric('direction');
  }
}
