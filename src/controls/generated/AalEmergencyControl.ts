import { ControlHandle } from '../ControlHandle.js';

/** AAL emergency alarm that can be triggered, quit and temporarily disabled. (generated). */
export class AalEmergencyControl extends ControlHandle {
  static readonly controlType = 'AalEmergency';

  /** Trigger an alarm from the app. */
  async trigger(): Promise<void> {
    await this.send('trigger');
  }
  /** Quit an active alarm. */
  async quit(): Promise<void> {
    await this.send('quit');
  }
  /** Disable the control for the given time in seconds; 0 starts it again. */
  async disable(timespan: number): Promise<void> {
    await this.send(`disable/${Math.round(timespan)}`);
  }
  /** 0 normal/waiting, 1 alarm triggered, 2 reset asserted/shut down, 3 temporarily disabled. */
  get status(): number | undefined {
    return this.numeric('status');
  }
  /** Unix end time when the control will start to operate again. */
  get disableEndTime(): number | undefined {
    return this.numeric('disableEndTime');
  }
  /** Text state with the active reset input when the control is in reset. */
  get resetActive(): string | undefined {
    return this.text('resetActive');
  }
}
