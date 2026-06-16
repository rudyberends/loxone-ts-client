import { ControlHandle } from './ControlHandle.js';

/**
 * A `Switch` control (Virtual Input switch / push button).
 * States: `active`. Commands: `on`, `off`.
 */
export class SwitchControl extends ControlHandle {
  static readonly controlType = 'Switch';

  /** Turns the switch on. */
  async on(): Promise<void> {
    await this.send('on');
  }

  /** Turns the switch off. */
  async off(): Promise<void> {
    await this.send('off');
  }

  /** Sets the switch to the given state. */
  async set(on: boolean): Promise<void> {
    await this.send(on ? 'on' : 'off');
  }

  /** The current on/off state, or `undefined` if not yet known. */
  get isOn(): boolean | undefined {
    return this.boolean('active');
  }
}
