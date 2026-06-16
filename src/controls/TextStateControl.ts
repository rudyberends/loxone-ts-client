import { ControlHandle } from './ControlHandle.js';

/** Parsed `iconAndColor` payload of a status text state. */
export interface IconAndColor {
  /** Icon path/UUID, e.g. `"IconsFilled/onnoff-circle.svg"`. */
  icon: string;
  /** Display colour, e.g. `"#69C350"`. */
  color: string;
}

/**
 * A `TextState` ("Status") control. Exposes the display text and the parsed
 * icon/colour rather than the raw JSON string.
 * States: `textAndIcon` (display text), `iconAndColor` (JSON `{icon, color}`).
 */
export class TextStateControl extends ControlHandle {
  static readonly controlType = 'TextState';

  /** The current display text (e.g. `"Standby"`, `"0Lx"`). */
  get displayText(): string | undefined {
    return this.control.getState('textAndIcon')?.textValue;
  }

  /** The parsed icon + colour, or `undefined` when not set / not JSON. */
  get iconAndColor(): IconAndColor | undefined {
    return this.control.getState('iconAndColor')?.json<IconAndColor>();
  }
}
