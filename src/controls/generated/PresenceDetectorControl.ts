import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';
import { ControlHandle } from '../ControlHandle.js';

/** Represents a presence detector with overrun timing and manual override. (generated). */
export class PresenceDetectorControl extends ControlHandle {
  static readonly controlType = 'PresenceDetector';

  /** Sets the value for the virtual input (between min and max). */
  async setValue(value: number): Promise<void> {
    await this.send(`${value}`);
  }
  /** Sets the overrun time. */
  async setTime(value: number): Promise<void> {
    await this.send(`time/${Math.round(value)}`);
  }
  /** Sets presence on for the given duration. */
  async presence(value: number): Promise<void> {
    await this.send(`presence/${Math.round(value)}`);
  }
  /** Turns presence off for the given duration. */
  async deactivate(value: number): Promise<void> {
    await this.send(`deactivate/${Math.round(value)}`);
  }
  /** Timestamp in seconds since 2009 of when presence became active. */
  get activeSince(): number | undefined {
    return this.numeric('activeSince');
  }
  /** Timestamp in seconds since 2009 of when presence became active. (as a Date). */
  get activeSinceDate(): Date | undefined {
    const v = this.numeric('activeSince');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** Presence state. */
  get active(): boolean | undefined {
    return this.boolean('active');
  }
  /** Locked state. */
  get locked(): boolean | undefined {
    return this.boolean('locked');
  }
  /** Reason why the presence detector is locked. */
  get infoText(): string | undefined {
    return this.text('infoText');
  }
  /** Current overrun time (TH). */
  get time(): number | undefined {
    return this.numeric('time');
  }
}
