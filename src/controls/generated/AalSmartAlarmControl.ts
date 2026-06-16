import { ControlHandle } from '../ControlHandle.js';

/** AAL Smart Alarm with confirm, disable and test-drill commands. (generated). */
export class AalSmartAlarmControl extends ControlHandle {
  static readonly controlType = 'AalSmartAlarm';

  /** Confirm a pending alarm. */
  async confirm(): Promise<void> {
    await this.send('confirm');
  }
  /** Disable the control for the given seconds; disable/0 re-enables the Smart Alarm. */
  async disable(seconds: number): Promise<void> {
    await this.send(`disable/${Math.round(seconds)}`);
  }
  /** Execute a test alarm. */
  async startDrill(): Promise<void> {
    await this.send('startDrill');
  }
  /** State of alarm: 0 no alarm, 1 immediate alarm, 2 delayed alarm. */
  get alarmLevel(): number | undefined {
    return this.numeric('alarmLevel');
  }
  /** String representing the last cause for an alarm. */
  get alarmCause(): string | undefined {
    return this.text('alarmCause');
  }
  /** Reset active; inputs are ignored so no alarms are executed. */
  get isLocked(): boolean | undefined {
    return this.boolean('isLocked');
  }
  /** Leave input is set; no alarms will be executed. */
  get isLeaveActive(): boolean | undefined {
    return this.boolean('isLeaveActive');
  }
  /** End time for the control to be disabled. */
  get disableEndTime(): number | undefined {
    return this.numeric('disableEndTime');
  }
}
