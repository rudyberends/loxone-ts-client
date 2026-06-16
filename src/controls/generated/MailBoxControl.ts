import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';
import { ControlHandle } from '../ControlHandle.js';

/** MailBox (Paketsafe) reporting packet/mail reception with notification disabling. (generated). */
export class MailBoxControl extends ControlHandle {
  static readonly controlType = 'MailBox';

  /** Confirm receipt of a packet. */
  async confirmPacket(): Promise<void> {
    await this.send('confirmPacket');
  }
  /** Confirm receipt of mail. */
  async confirmMail(): Promise<void> {
    await this.send('confirmMail');
  }
  /** Disable notifications for the given number of seconds (0 cancels the timer). */
  async disableNotifications(seconds: number): Promise<void> {
    await this.send(`disableNotifications/${Math.round(seconds)}`);
  }
  /** State of the notifications disabled input. */
  get notificationsDisabledInput(): boolean | undefined {
    return this.boolean('notificationsDisabledInput');
  }
  /** Whether a packet has been received. */
  get packetReceived(): boolean | undefined {
    return this.boolean('packetReceived');
  }
  /** Whether mail has been received. */
  get mailReceived(): boolean | undefined {
    return this.boolean('mailReceived');
  }
  /** UTC timestamp (seconds since 2009) until which notifications are disabled. */
  get disableEndTime(): number | undefined {
    return this.numeric('disableEndTime');
  }
  /** UTC timestamp (seconds since 2009) until which notifications are disabled. (as a Date). */
  get disableEndDate(): Date | undefined {
    const v = this.numeric('disableEndTime');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
}
