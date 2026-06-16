import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';
import { clamp, ControlHandle } from '../ControlHandle.js';

const temperatureSupportLabelMap: Readonly<Record<number, 'cooling' | 'none' | 'heating'>> = { [-1]: 'cooling', [0]: 'none', [1]: 'heating' };

/** Controls a ventilation unit with speed, modes and timer profiles. (generated). */
export class VentilationControl extends ControlHandle {
  static readonly controlType = 'Ventilation';

  /** Start a timer with the given interval (seconds), speed (0-100), mode id and timer profile index (-1 for manual). */
  async setTimer(interval: number, speed: number, modeId: number, timerProfileIdx: number): Promise<void> {
    await this.send(`setTimer/${Math.round(interval)}/${clamp(speed, 0, 100)}/${Math.round(modeId)}/${Math.round(timerProfileIdx)}`);
  }
  /** Stops any currently running timer and returns to automatic mode. */
  async stopTimer(): Promise<void> {
    await this.send('setTimer/0');
  }
  /** Sets the minimal ventilation intensity if no one is present. */
  async setAbsenceMin(value: number): Promise<void> {
    await this.send(`setAbsenceMin/${clamp(value, 0, 100)}`);
  }
  /** Sets the maximal ventilation intensity if no one is present. */
  async setAbsenceMax(value: number): Promise<void> {
    await this.send(`setAbsenceMax/${clamp(value, 0, 100)}`);
  }
  /** Sets the minimal ventilation intensity if someone is present. */
  async setPresenceMin(value: number): Promise<void> {
    await this.send(`setPresenceMin/${clamp(value, 0, 100)}`);
  }
  /** Sets the maximal ventilation intensity if someone is present. */
  async setPresenceMax(value: number): Promise<void> {
    await this.send(`setPresenceMax/${clamp(value, 0, 100)}`);
  }
  /** Acknowledges the "filter change" message. */
  async ackFilterChange(): Promise<void> {
    await this.send('ackFilterChange');
  }
  /** ID for the current ventilation reason (0 = basic, 1 = increased, 4 = stop, etc.). */
  get ventReason(): number | undefined {
    return this.numeric('ventReason');
  }
  /** Temperature support state (-1 = cooling, 0 = none, 1 = heating). */
  get temperatureSupport(): number | undefined {
    return this.numeric('temperatureSupport');
  }
  /** Temperature support state (decoded label). */
  get temperatureSupportLabel(): ('cooling' | 'none' | 'heating') | undefined {
    const v = this.numeric('temperatureSupport');
    return v === undefined ? undefined : temperatureSupportLabelMap[v];
  }
  /** Index of the current active timer profile (-1 manual, -2 none, -3 changing settings). */
  get activeTimerProfile(): number | undefined {
    return this.numeric('activeTimerProfile');
  }
  /** Name of the connected logic if the stop ("St") input is active. */
  get stoppedBy(): string | undefined {
    return this.text('stoppedBy');
  }
  /** Unix timestamp until which a timer is active (0 if no timer active). */
  get overwriteUntil(): number | undefined {
    return this.numeric('overwriteUntil');
  }
  /** Unix timestamp until which a timer is active (0 if no timer active). (as a Date). */
  get overwriteUntilDate(): Date | undefined {
    const v = this.numeric('overwriteUntil');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** TextEvent that can be interpreted as JSON describing the current control state. */
  get controlInfo(): string | undefined {
    return this.text('controlInfo');
  }
  /** TextEvent that can be interpreted as JSON describing the current control state (parsed JSON). */
  controlInfoJson<T = unknown>(): T | undefined {
    return this.control.getState('controlInfo')?.json<T>();
  }
  /** Value in % representing the speed of the ventilation. */
  get speed(): number | undefined {
    return this.numeric('speed');
  }
  /** ID of the current active mode defined in the details modes object. */
  get mode(): number | undefined {
    return this.numeric('mode');
  }
  /** Minimal percentual value of the ventilation if someone is present. */
  get presenceMin(): number | undefined {
    return this.numeric('presenceMin');
  }
  /** Maximal percentual value of the ventilation if someone is present. */
  get presenceMax(): number | undefined {
    return this.numeric('presenceMax');
  }
  /** Minimal percentual value of the ventilation if no one is present. */
  get absenceMin(): number | undefined {
    return this.numeric('absenceMin');
  }
  /** Maximal percentual value of the ventilation if no one is present. */
  get absenceMax(): number | undefined {
    return this.numeric('absenceMax');
  }
  /** Value of the indoor humidity sensor. */
  get humidityIndoor(): number | undefined {
    return this.numeric('humidityIndoor');
  }
  /** Whether presence is active. */
  get presence(): boolean | undefined {
    return this.boolean('presence');
  }
  /** Temperature at which frost protection becomes active. */
  get frostTemp(): number | undefined {
    return this.numeric('frostTemp');
  }
  /** The max humidity set (in %). */
  get humidityMax(): number | undefined {
    return this.numeric('humidityMax');
  }
  /** The max air quality set (in ppm). */
  get airQualityMax(): number | undefined {
    return this.numeric('airQualityMax');
  }
  /** The current air quality (in ppm). */
  get airQualityIndoor(): number | undefined {
    return this.numeric('airQualityIndoor');
  }
  /** The current indoor temperature. */
  get temperatureIndoor(): number | undefined {
    return this.numeric('temperatureIndoor');
  }
  /** The current outdoor temperature. */
  get temperatureOutdoor(): number | undefined {
    return this.numeric('temperatureOutdoor');
  }
  /** The current target temperature. */
  get temperatureTarget(): number | undefined {
    return this.numeric('temperatureTarget');
  }
}
