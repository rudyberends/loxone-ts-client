import { ControlHandle } from '../ControlHandle.js';

/** Virtual input controlled with up/down (right/left) buttons or an analog value. (generated). */
export class UpDownLeftRightControl extends ControlHandle {
  static readonly controlType = 'UpDownLeftRight';

  /** Activates the up/right output. */
  async upOn(): Promise<void> {
    await this.send('UpOn');
  }
  /** Deactivates the up/right output. */
  async upOff(): Promise<void> {
    await this.send('UpOff');
  }
  /** Impulse on up/right output (since Config 8.0). */
  async pulseUp(): Promise<void> {
    await this.send('PulseUp');
  }
  /** Activates the down/left output. */
  async downOn(): Promise<void> {
    await this.send('DownOn');
  }
  /** Deactivates the down/left output. */
  async downOff(): Promise<void> {
    await this.send('DownOff');
  }
  /** Impulse on down/left output (since Config 8.0). */
  async pulseDown(): Promise<void> {
    await this.send('PulseDown');
  }
  /** Sets the value for the analog virtual input (between min and max). */
  async setValue(value: number): Promise<void> {
    await this.send(`${value}`);
  }
  /** The current value of the analog virtual input. */
  get value(): number | undefined {
    return this.numeric('value');
  }
  /** Indicates an invalid value of the virtual input. */
  get error(): boolean | undefined {
    return this.boolean('error');
  }
}
