import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';
import { ControlHandle } from '../ControlHandle.js';

const activeAlarmTypeLabelMap: Readonly<Record<number, 'Inactive' | 'Acknowledged' | 'Alarm' | 'Urgent' | 'EMS'>> = { [0]: 'Inactive', [1]: 'Acknowledged', [2]: 'Alarm', [4]: 'Urgent', [8]: 'EMS' };

/** Alarm sequence (chain) control reporting active and next alarm steps. (generated). */
export class AlarmChainControl extends ControlHandle {
  static readonly controlType = 'AlarmChain';

  /** Acknowledge (quit) the alarm. */
  async quit(): Promise<void> {
    await this.send('quit');
  }
  /** Bitmap of the active alarm type (0=Inactive, 1=Acknowledged, 2=Alarm, 4=Urgent, 8=EMS). */
  get activeAlarmType(): number | undefined {
    return this.numeric('activeAlarmType');
  }
  /** Bitmap of the active alarm type (decoded label). */
  get activeAlarmTypeLabel(): ('Inactive' | 'Acknowledged' | 'Alarm' | 'Urgent' | 'EMS') | undefined {
    const v = this.numeric('activeAlarmType');
    return v === undefined ? undefined : activeAlarmTypeLabelMap[v];
  }
  /** Seconds since 2009 when the next level escalates (null if none). */
  get nextAlarmLevelAt(): number | undefined {
    return this.numeric('nextAlarmLevelAt');
  }
  /** Seconds since 2009 when the next level escalates (null if none). (as a Date). */
  get nextAlarmLevelDate(): Date | undefined {
    const v = this.numeric('nextAlarmLevelAt');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** JSON array (0-2 elements) describing the currently active alarm sequence. */
  get activeAlarmText(): string | undefined {
    return this.text('activeAlarmText');
  }
  /** JSON array (parsed JSON). */
  activeAlarmTextJson<T = unknown>(): T | undefined {
    return this.control.getState('activeAlarmText')?.json<T>();
  }
  /** Text describing the next alarm sequence (empty if none). */
  get nextAlarmText(): string | undefined {
    return this.text('nextAlarmText');
  }
  /** How many iterations have already been made. */
  get iterationCount(): number | undefined {
    return this.numeric('iterationCount');
  }
}
