import { ControlHandle } from '../ControlHandle.js';

/** Stairwell light switch or comfort/multifunction switch with a deactivation countdown. (generated). */
export class TimedSwitchControl extends ControlHandle {
  static readonly controlType = 'TimedSwitch';

  /** Permanently activates the TimedSwitch; deactivationDelay changes to -1. */
  async on(): Promise<void> {
    await this.send('on');
  }
  /** Turns off the TimedSwitch; deactivationDelay changes to 0. */
  async off(): Promise<void> {
    await this.send('off');
  }
  /** Starts/restarts the countdown from deactivationDelayTotal, or turns off depending on mode. */
  async pulse(): Promise<void> {
    await this.send('pulse');
  }
  /** Seconds the output stays active when the timer is used. */
  get deactivationDelayTotal(): number | undefined {
    return this.numeric('deactivationDelayTotal');
  }
  /** Countdown until deactivation; 0 = off, -1 = permanently on, else counting down. */
  get deactivationDelay(): number | undefined {
    return this.numeric('deactivationDelay');
  }
}
