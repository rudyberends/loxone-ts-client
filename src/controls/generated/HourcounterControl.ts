import { ControlHandle } from '../ControlHandle.js';

const stateUnitLabelMap: Readonly<Record<number, 'seconds' | 'minutes' | 'hours' | 'days'>> = { [0]: 'seconds', [1]: 'minutes', [2]: 'hours', [3]: 'days' };

/** Maintenance counter tracking active runtime and remaining time until next maintenance. (generated). */
export class HourcounterControl extends ControlHandle {
  static readonly controlType = 'Hourcounter';

  /** Resets remaining to maintenanceInterval and overdue/overdueSince to 0. */
  async reset(): Promise<void> {
    await this.send('reset');
  }
  /** Like reset, but also sets total and lastActivation to 0. */
  async resetAll(): Promise<void> {
    await this.send('resetAll');
  }
  /** Total number of seconds the counter has been active so far. */
  get total(): number | undefined {
    return this.numeric('total');
  }
  /** Seconds left until the next maintenance is required; 0 if required or overdue. */
  get remaining(): number | undefined {
    return this.numeric('remaining');
  }
  /** Timestamp (seconds) when the counter was last activated. */
  get lastActivation(): number | undefined {
    return this.numeric('lastActivation');
  }
  /** 0 if not overdue, otherwise maintenance is required. */
  get overdue(): boolean | undefined {
    return this.boolean('overdue');
  }
  /** Seconds until the next maintenance. */
  get maintenanceInterval(): number | undefined {
    return this.numeric('maintenanceInterval');
  }
  /** Desired UI output unit: 0=seconds, 1=minutes, 2=hours, 3=days (values remain in seconds). */
  get stateUnit(): number | undefined {
    return this.numeric('stateUnit');
  }
  /** Desired UI output unit: 0=seconds, 1=minutes, 2=hours, 3=days (decoded label). */
  get stateUnitLabel(): ('seconds' | 'minutes' | 'hours' | 'days') | undefined {
    const v = this.numeric('stateUnit');
    return v === undefined ? undefined : stateUnitLabelMap[v];
  }
  /** Whether the counter is currently active. */
  get active(): boolean | undefined {
    return this.boolean('active');
  }
  /** Seconds since the maintenance interval was exceeded; 0 if not required yet. */
  get overdueSince(): number | undefined {
    return this.numeric('overdueSince');
  }
}
