import { ControlHandle } from '../ControlHandle.js';

/** Utility meter tracking actual power/flow and accumulated energy totals. (generated). */
export class MeterControl extends ControlHandle {
  static readonly controlType = 'Meter';

  /** Resets all values to 0. */
  async reset(): Promise<void> {
    await this.send('reset');
  }
  /** Current power or flow value. */
  get actual(): number | undefined {
    return this.numeric('actual');
  }
  /** Accumulated meter total. */
  get total(): number | undefined {
    return this.numeric('total');
  }
  /** Accumulated negative total (only if type is not unidirectional). */
  get totalNeg(): number | undefined {
    return this.numeric('totalNeg');
  }
  /** Stored amount (only if type is storage). */
  get storage(): number | undefined {
    return this.numeric('storage');
  }
  /** Meter reading today. */
  get totalDay(): number | undefined {
    return this.numeric('totalDay');
  }
  /** Meter reading this week. */
  get totalWeek(): number | undefined {
    return this.numeric('totalWeek');
  }
  /** Meter reading this month. */
  get totalMonth(): number | undefined {
    return this.numeric('totalMonth');
  }
  /** Meter reading this year. */
  get totalYear(): number | undefined {
    return this.numeric('totalYear');
  }
  /** Negative meter reading today (non-unidirectional only). */
  get totalNegDay(): number | undefined {
    return this.numeric('totalNegDay');
  }
  /** Negative meter reading this week (non-unidirectional only). */
  get totalNegWeek(): number | undefined {
    return this.numeric('totalNegWeek');
  }
  /** Negative meter reading this month (non-unidirectional only). */
  get totalNegMonth(): number | undefined {
    return this.numeric('totalNegMonth');
  }
  /** Negative meter reading this year (non-unidirectional only). */
  get totalNegYear(): number | undefined {
    return this.numeric('totalNegYear');
  }
}
