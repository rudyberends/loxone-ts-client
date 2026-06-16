import { ControlHandle } from '../ControlHandle.js';

/** Push-button +/- virtual input that selects a numeric value between min and max. (generated). */
export class ValueSelectorControl extends ControlHandle {
  static readonly controlType = 'ValueSelector';

  /** Set the virtual input value (between configured min and max). */
  async setValue(value: number): Promise<void> {
    await this.send(`${value}`);
  }
  /** The minimum value. */
  get min(): number | undefined {
    return this.numeric('min');
  }
  /** The maximum value. */
  get max(): number | undefined {
    return this.numeric('max');
  }
  /** The step to the next value when pressing up/down/left/right. */
  get step(): number | undefined {
    return this.numeric('step');
  }
  /** The current value of the virtual input. */
  get value(): number | undefined {
    return this.numeric('value');
  }
}
