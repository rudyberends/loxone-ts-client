import { clamp, ControlHandle } from './ControlHandle.js';

/**
 * A `Dimmer` control.
 * States: `position`, `min`, `max`, `step`. Commands: `on`, `off`, `{position}`.
 */
export class DimmerControl extends ControlHandle {
  // Annotated as `string` (not the literal) so subtypes like EIBDimmerControl can
  // declare their own control type while reusing this wrapper's behaviour.
  static readonly controlType: string = 'Dimmer';

  /** Restores the last known position. */
  async on(): Promise<void> {
    await this.send('on');
  }

  /** Sets the position to 0 (off). */
  async off(): Promise<void> {
    await this.send('off');
  }

  /** Sets the dimmer position, clamped to the control's `[min, max]` (default `[0, 100]`). */
  async setPosition(value: number): Promise<void> {
    await this.send(String(clamp(value, this.min ?? 0, this.max ?? 100)));
  }

  /** Current position. */
  get position(): number | undefined {
    return this.numeric('position');
  }

  /** Configured minimum position. */
  get min(): number | undefined {
    return this.numeric('min');
  }

  /** Configured maximum position. */
  get max(): number | undefined {
    return this.numeric('max');
  }

  /** Configured step size. */
  get step(): number | undefined {
    return this.numeric('step');
  }
}
