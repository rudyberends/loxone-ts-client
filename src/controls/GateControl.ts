import { ControlHandle } from './ControlHandle.js';

/**
 * A `Gate` control (garage door / gate).
 * States: `position` (0 = closed … 1 = open), `active` (-1 closing, 0 idle, 1 opening).
 * Commands: `open`, `close`, `stop`, `forceOpen`, `forceClose`, `PartiallyOpen`.
 */
export class GateControl extends ControlHandle {
  static readonly controlType = 'Gate';

  async open(): Promise<void> {
    await this.send('open');
  }
  async close(): Promise<void> {
    await this.send('close');
  }
  async stop(): Promise<void> {
    await this.send('stop');
  }
  /** Stops a moving gate, then opens it. */
  async forceOpen(): Promise<void> {
    await this.send('forceOpen');
  }
  /** Stops a moving gate, then closes it. */
  async forceClose(): Promise<void> {
    await this.send('forceClose');
  }
  /** Moves to the configured partially-open position. */
  async partiallyOpen(): Promise<void> {
    await this.send('PartiallyOpen');
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
  /** True once fully open. */
  get isOpen(): boolean | undefined {
    const p = this.position;
    return p === undefined ? undefined : p >= 1;
  }
  /** True once fully closed. */
  get isClosed(): boolean | undefined {
    const p = this.position;
    return p === undefined ? undefined : p <= 0;
  }
  /** Movement: -1 closing, 0 idle, 1 opening. */
  get movement(): number | undefined {
    return this.numeric('active');
  }
}
