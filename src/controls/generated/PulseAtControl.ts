import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';
import { ControlHandle } from '../ControlHandle.js';

/** Pulse At control that emits a pulse at a configured time or one-time date. (generated). */
export class PulseAtControl extends ControlHandle {
  static readonly controlType = 'PulseAt';

  /** Sets the pulse time (seconds since midnight). */
  async setTime(time: number): Promise<void> {
    await this.send(`setTime/${Math.round(time)}`);
  }
  /** Sets a fixed one-time pulse date (seconds since 2009); 0 makes the pulse recur daily. */
  async setOneTimePulse(date: number): Promise<void> {
    await this.send(`setOneTimePulse/${Math.round(date)}`);
  }
  /** Sets the pulse duration in seconds. */
  async setPulseDuration(duration: number): Promise<void> {
    await this.send(`setPulseDuration/${Math.round(duration)}`);
  }
  /** Triggers a pulse. */
  async pulse(): Promise<void> {
    await this.send('pulse');
  }
  /** Sets the pulse type to one of the types available in the control details. */
  async setType(typeId: number): Promise<void> {
    await this.send(`setType/${Math.round(typeId)}`);
  }
  /** True if the output on Q is 1. */
  get isActive(): boolean | undefined {
    return this.boolean('isActive');
  }
  /** Pulse start time in seconds since midnight. */
  get startTime(): number | undefined {
    return this.numeric('startTime');
  }
  /** Fixed date for a one-time pulse in seconds since 2009, if set. */
  get oneTimePulseDate(): number | undefined {
    return this.numeric('oneTimePulseDate');
  }
  /** Fixed date for a one-time pulse in seconds since 2009, if set. (as a Date). */
  get oneTimePulseDateValue(): Date | undefined {
    const v = this.numeric('oneTimePulseDate');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** Pulse duration in seconds. */
  get pulseDuration(): number | undefined {
    return this.numeric('pulseDuration');
  }
  /** Currently used pulse type. */
  get typeValue(): number | undefined {
    return this.numeric('type');
  }
}
