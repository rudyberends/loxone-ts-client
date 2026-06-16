import { ControlHandle } from '../ControlHandle.js';

const nextLevelLabelMap: Readonly<Record<number, 'Silent' | 'Acustic' | 'Optical' | 'Internal' | 'External' | 'Remote'>> = { [1]: 'Silent', [2]: 'Acustic', [3]: 'Optical', [4]: 'Internal', [5]: 'External', [6]: 'Remote' };
const levelLabelMap: Readonly<Record<number, 'Pre Alarm' | 'Main Alarm'>> = { [1]: 'Pre Alarm', [2]: 'Main Alarm' };

/** Fire/water alarm control with mute, confirm and service mode commands. (generated). */
export class SmokeAlarmControl extends ControlHandle {
  static readonly controlType = 'SmokeAlarm';

  /** Mutes the sirene. */
  async mute(): Promise<void> {
    await this.send('mute');
  }
  /** Acknowledge the alarm. */
  async confirm(): Promise<void> {
    await this.send('confirm');
  }
  /** Service mode: 0 = off, 1 = infinite, >1 = time in seconds until service mode stops. */
  async serviceMode(seconds: number): Promise<void> {
    await this.send(`servicemode/${Math.round(seconds)}`);
  }
  /** Starts a test alarm (available since 10.3). */
  async startDrill(): Promise<void> {
    await this.send('startDrill');
  }
  /** ID of the next alarm level (1=Silent, 2=Acustic, 3=Optical, 4=Internal, 5=External, 6=Remote). */
  get nextLevel(): number | undefined {
    return this.numeric('nextLevel');
  }
  /** ID of the next alarm level (decoded label). */
  get nextLevelLabel(): ('Silent' | 'Acustic' | 'Optical' | 'Internal' | 'External' | 'Remote') | undefined {
    const v = this.numeric('nextLevel');
    return v === undefined ? undefined : nextLevelLabelMap[v];
  }
  /** Delay of the next level in seconds (increments every second). */
  get nextLevelDelay(): number | undefined {
    return this.numeric('nextLevelDelay');
  }
  /** Total delay of the next level in seconds. */
  get nextLevelDelayTotal(): number | undefined {
    return this.numeric('nextLevelDelayTotal');
  }
  /** ID of the current alarm level (1=Pre Alarm, 2=Main Alarm). */
  get level(): number | undefined {
    return this.numeric('level');
  }
  /** ID of the current alarm level (decoded label). */
  get levelLabel(): ('Pre Alarm' | 'Main Alarm') | undefined {
    const v = this.numeric('level');
    return v === undefined ? undefined : levelLabelMap[v];
  }
  /** State of the acoustic alarm (0=not active, 1=active). */
  get acousticAlarm(): boolean | undefined {
    return this.boolean('acousticAlarm');
  }
  /** Whether a test alarm is active (0/1). */
  get testAlarm(): boolean | undefined {
    return this.boolean('testAlarm');
  }
  /** Bitmask of alarm causes (0x01=Smoke, 0x02=Water, 0x04=Temperature, 0x08=Arc Fault). */
  get alarmCause(): number | undefined {
    return this.numeric('alarmCause');
  }
  /** Timestamp when the alarm started. */
  get startTime(): number | undefined {
    return this.numeric('startTime');
  }
  /** Remaining seconds the service mode stays active (99999 = infinite). */
  get timeServiceMode(): number | undefined {
    return this.numeric('timeServiceMode');
  }
  /** Whether all alarm signals are disabled (by confirming alarm). */
  get areAlarmSignalsOff(): boolean | undefined {
    return this.boolean('areAlarmSignalsOff');
  }
}
