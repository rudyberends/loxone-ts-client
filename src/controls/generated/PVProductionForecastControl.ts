import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';
import { ControlHandle } from '../ControlHandle.js';

/** PV Production Forecast predicting solar energy production over upcoming periods. (generated). */
export class PVProductionForecastControl extends ControlHandle {
  static readonly controlType = 'PVProductionForecast';

  /** Returns current hourly predictions as a JSON array (24 entries per day for today/tomorrow/after). */
  async getForecasts(): Promise<void> {
    await this.send('getForecasts');
  }
  /** Value of the period parameter [h]. */
  get inputperiod(): number | undefined {
    return this.numeric('inputperiod');
  }
  /** Predicted production for the given period of time [kWh]. */
  get period(): number | undefined {
    return this.numeric('period');
  }
  /** Predicted production for today [kWh]. */
  get today(): number | undefined {
    return this.numeric('today');
  }
  /** Predicted production for tomorrow [kWh]. */
  get tomorrow(): number | undefined {
    return this.numeric('tomorrow');
  }
  /** Predicted production for the day after tomorrow [kWh]. */
  get after(): number | undefined {
    return this.numeric('after');
  }
  /** False if block locked by off input or on errors (fetching data, subscription expired, etc.). */
  get ready(): boolean | undefined {
    return this.boolean('ready');
  }
  /** Timestamp of predictions [seconds since 2009]. */
  get timestamp(): number | undefined {
    return this.numeric('timestamp');
  }
  /** Timestamp of predictions [seconds since 2009]. (as a Date). */
  get timestampDate(): Date | undefined {
    const v = this.numeric('timestamp');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** Start timestamp of the current prediction hour [seconds since 2009]. */
  get cycleFrom(): number | undefined {
    return this.numeric('cycleFrom');
  }
  /** Start timestamp of the current prediction hour [seconds since 2009]. (as a Date). */
  get cycleFromDate(): Date | undefined {
    const v = this.numeric('cycleFrom');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** End timestamp of the current prediction hour [seconds since 2009]. */
  get cycleUntil(): number | undefined {
    return this.numeric('cycleUntil');
  }
  /** End timestamp of the current prediction hour [seconds since 2009]. (as a Date). */
  get cycleUntilDate(): Date | undefined {
    const v = this.numeric('cycleUntil');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** Bitmask of errors (x=WeatherServiceError, y=InternetError). */
  get errorInfo(): number | undefined {
    return this.numeric('errorInfo');
  }
}
