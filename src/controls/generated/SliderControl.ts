import { ControlHandle } from '../ControlHandle.js';

/** Virtual input slider with a single numeric value between min and max. (generated). */
export class SliderControl extends ControlHandle {
  static readonly controlType = 'Slider';

  /** Set the slider value (between configured min and max). */
  async setValue(value: number): Promise<void> {
    await this.send(`${value}`);
  }
  /** The current value of the slider. */
  get value(): number | undefined {
    return this.numeric('value');
  }
  /** Indicates an invalid value of the slider. */
  get error(): boolean | undefined {
    return this.boolean('error');
  }
}
