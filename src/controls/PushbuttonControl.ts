import { ControlHandle } from './ControlHandle.js';

/**
 * A `Pushbutton` control (virtual input pushbutton / scene).
 * State: `active`. Commands: `pulse`, `on`, `off`.
 */
export class PushbuttonControl extends ControlHandle {
  static readonly controlType = 'Pushbutton';

  /** Brief tap (preferred for momentary buttons). */
  async pulse(): Promise<void> {
    await this.send('pulse');
  }
  /** Press and hold (until `off`). */
  async on(): Promise<void> {
    await this.send('on');
  }
  /** Release a held button. */
  async off(): Promise<void> {
    await this.send('off');
  }

  /** The current state, if known. */
  get isActive(): boolean | undefined {
    return this.boolean('active');
  }
}
