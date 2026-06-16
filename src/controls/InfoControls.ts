import { ControlHandle } from './ControlHandle.js';

/**
 * An `InfoOnlyAnalog` control (read-only analog virtual state).
 * State: `value`; `details.format` describes its display format.
 */
export class InfoOnlyAnalogControl extends ControlHandle {
  static readonly controlType = 'InfoOnlyAnalog';

  /** The current numeric value. */
  get value(): number | undefined {
    return this.numeric('value');
  }
  /** The current value formatted with the control's display format (e.g. `"21.3°C"`). */
  get formatted(): string | undefined {
    return this.state('value')?.formatted;
  }
}

/**
 * An `InfoOnlyDigital` control (read-only digital virtual state).
 * State: `active`; `details.text.on`/`off` hold the configured labels.
 */
export class InfoOnlyDigitalControl extends ControlHandle {
  static readonly controlType = 'InfoOnlyDigital';

  /** The current boolean value. */
  get isActive(): boolean | undefined {
    return this.boolean('active');
  }
  /** The configured label for the current state (`details.text.on`/`off`), if any. */
  get label(): string | undefined {
    const active = this.isActive;
    if (active === undefined) return undefined;
    const text = this.control.details['text'];
    if (text && typeof text === 'object') {
      const value = (text as Record<string, unknown>)[active ? 'on' : 'off'];
      if (typeof value === 'string') return value;
    }
    return undefined;
  }
}

/**
 * An `InfoOnlyText` control (read-only text virtual state).
 * State: `text`.
 */
export class InfoOnlyTextControl extends ControlHandle {
  static readonly controlType = 'InfoOnlyText';

  /** The current text value. */
  get value(): string | undefined {
    return this.text('text');
  }
}
