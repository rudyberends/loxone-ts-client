import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';
import { ControlHandle } from '../ControlHandle.js';

const nextLevelLabelMap: Readonly<Record<number, 'Silent' | 'Acustic' | 'Optical' | 'Internal' | 'External' | 'Remote'>> = { [1]: 'Silent', [2]: 'Acustic', [3]: 'Optical', [4]: 'Internal', [5]: 'External', [6]: 'Remote' };
const levelLabelMap: Readonly<Record<number, 'Silent' | 'Acustic' | 'Optical' | 'Internal' | 'External' | 'Remote'>> = { [1]: 'Silent', [2]: 'Acustic', [3]: 'Optical', [4]: 'Internal', [5]: 'External', [6]: 'Remote' };

/** Burglar alarm control with arming, disarming and acknowledge. (generated). */
export class AlarmControl extends ControlHandle {
  static readonly controlType = 'Alarm';

  /** Arms the AlarmControl. */
  async on(): Promise<void> {
    await this.send('on');
  }
  /** Arms the AlarmControl; movement 0 = arm without movement, 1 = arm with movement. */
  async onWithMovement(movement: boolean): Promise<void> {
    await this.send(`on/${movement ? 1 : 0}`);
  }
  /** Arms the AlarmControl with the configured delay (parameter Da). */
  async delayedOn(): Promise<void> {
    await this.send('delayedon');
  }
  /** Delayed-arms the AlarmControl; movement 0 = without movement, 1 = with movement. */
  async delayedOnWithMovement(movement: boolean): Promise<void> {
    await this.send(`delayedon/${movement ? 1 : 0}`);
  }
  /** Disarms the AlarmControl. */
  async off(): Promise<void> {
    await this.send('off');
  }
  /** Acknowledge (quit) the alarm. */
  async quit(): Promise<void> {
    await this.send('quit');
  }
  /** Disable (0) or enable (1) movement detection. */
  async dismv(enable: boolean): Promise<void> {
    await this.send(`dismv/${enable ? 1 : 0}`);
  }
  /** Whether the AlarmControl is armed. */
  get armed(): boolean | undefined {
    return this.boolean('armed');
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
  /** Unix timestamp when the next alarm level goes off (0 = none). */
  get nextLevelAt(): number | undefined {
    return this.numeric('nextLevelAt');
  }
  /** Unix timestamp when the next alarm level goes off (0 = none). (as a Date). */
  get nextLevelDate(): Date | undefined {
    const v = this.numeric('nextLevelAt');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** Total delay of the next level in seconds. */
  get nextLevelDelayTotal(): number | undefined {
    return this.numeric('nextLevelDelayTotal');
  }
  /** ID of the current alarm level (1=Silent, 2=Acustic, 3=Optical, 4=Internal, 5=External, 6=Remote). */
  get level(): number | undefined {
    return this.numeric('level');
  }
  /** ID of the current alarm level (decoded label). */
  get levelLabel(): ('Silent' | 'Acustic' | 'Optical' | 'Internal' | 'External' | 'Remote') | undefined {
    const v = this.numeric('level');
    return v === undefined ? undefined : levelLabelMap[v];
  }
  /** Unix timestamp when the alarm is armed (0 = none). */
  get armedAt(): number | undefined {
    return this.numeric('armedAt');
  }
  /** Unix timestamp when the alarm is armed (0 = none). (as a Date). */
  get armedDate(): Date | undefined {
    const v = this.numeric('armedAt');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** Total delay of the alarm control being armed, in seconds. */
  get armedDelayTotal(): number | undefined {
    return this.numeric('armedDelayTotal');
  }
  /** Whether movement detection is disabled. */
  get disabledMove(): boolean | undefined {
    return this.boolean('disabledMove');
  }
  /** Timestamp when the alarm started. */
  get startTime(): number | undefined {
    return this.numeric('startTime');
  }
}
