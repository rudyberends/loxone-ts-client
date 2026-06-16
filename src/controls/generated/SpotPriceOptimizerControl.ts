import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';
import { ControlHandle } from '../ControlHandle.js';

/** Spot Price Optimizer that schedules an output around the cheapest energy price windows. (generated). */
export class SpotPriceOptimizerControl extends ControlHandle {
  static readonly controlType = 'SpotPriceOptimizer';

  /** Cancel the active cycle. */
  async cancel(): Promise<void> {
    await this.send('cancel');
  }
  /** Start a new cycle with the given demand and period (in hours); demand may be 0 when set by logic. */
  async start(demand: number, period: number): Promise<void> {
    await this.send(`start/${demand}/${period}`);
  }
  /** Returns the currently available forecast objects as a JSON array. */
  async getForecasts(): Promise<void> {
    await this.send('getForecasts');
  }
  /** Finds the cheapest forecast objects for the given cycle and demand (in hours) as a JSON array. */
  async getCheapestForecasts(demand: number, period: number): Promise<void> {
    await this.send(`getCheapestForecasts/${demand}/${period}`);
  }
  /** Returns the saved time (seconds since midnight) when data for the selected market is available. */
  async getNextDayCheckTime(): Promise<void> {
    await this.send('getNextDayCheckTime');
  }
  /** Whether the output is currently active. */
  get active(): boolean | undefined {
    return this.boolean('active');
  }
  /** Current price/value. */
  get current(): number | undefined {
    return this.numeric('current');
  }
  /** Value of the demand parameter. */
  get demand(): number | undefined {
    return this.numeric('demand');
  }
  /** Value of the period parameter. */
  get period(): number | undefined {
    return this.numeric('period');
  }
  /** Minimum continuous duration the output must remain active once turned on. */
  get minRuntime(): number | undefined {
    return this.numeric('minRuntime');
  }
  /** Price above which it is always considered very high. */
  get manualMax(): number | undefined {
    return this.numeric('manualMax');
  }
  /** Timestamp of forecasts; re-request forecasts when it changes. */
  get forecastsTimestamp(): number | undefined {
    return this.numeric('forecastsTimestamp');
  }
  /** Start of the current cycle [seconds since 2009 UTC, rounded to hours]. */
  get cycleFrom(): number | undefined {
    return this.numeric('cycleFrom');
  }
  /** Start of the current cycle [seconds since 2009 UTC, rounded to hours]. (as a Date). */
  get cycleFromDate(): Date | undefined {
    const v = this.numeric('cycleFrom');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** End of the current cycle [seconds since 2009 UTC, rounded to hours]. */
  get cycleUntil(): number | undefined {
    return this.numeric('cycleUntil');
  }
  /** End of the current cycle [seconds since 2009 UTC, rounded to hours]. (as a Date). */
  get cycleUntilDate(): Date | undefined {
    const v = this.numeric('cycleUntil');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
}
