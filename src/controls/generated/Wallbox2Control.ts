import { ControlHandle } from '../ControlHandle.js';

/** Generation 2 wallbox / car charger with charging modes and session info. (generated). */
export class Wallbox2Control extends ControlHandle {
  static readonly controlType = 'Wallbox2';

  /** Disable charging. */
  async allowOff(): Promise<void> {
    await this.send('allow/off');
  }
  /** Enable charging. */
  async allowOn(): Promise<void> {
    await this.send('allow/on');
  }
  /** Set limitation mode (1-5, or 99 for manual which reuses previous limit). */
  async setMode(value: number): Promise<void> {
    await this.send(`setmode/${Math.round(value)}`);
  }
  /** Set charging mode after unplugging (0 = keep current, 1-5; must not be 99). */
  async setModeUnplug(value: number): Promise<void> {
    await this.send(`modeUnplug/${Math.round(value)}`);
  }
  /** Update a charging mode's limit and uriEncoded name. */
  async updateMode(id: number, limitValue: number, name: string): Promise<void> {
    await this.send(`updateMode/${Math.round(id)}/${limitValue}/${encodeURIComponent(name)}`);
  }
  /** Set the manual charging limit, activating manual mode (99) if needed. */
  async manualLimit(value: number): Promise<void> {
    await this.send(`manualLimit/${value}`);
  }
  /** Vehicle is connected. */
  get connected(): boolean | undefined {
    return this.boolean('connected');
  }
  /** Charging is allowed / enabled. */
  get enabled(): boolean | undefined {
    return this.boolean('enabled');
  }
  /** Vehicle is currently charging. */
  get active(): boolean | undefined {
    return this.boolean('active');
  }
  /** Loadshedding is active. */
  get loadshed(): boolean | undefined {
    return this.boolean('loadshed');
  }
  /** Charging is paused while phase switching is active. */
  get phaseSwitching(): boolean | undefined {
    return this.boolean('phaseSwitching');
  }
  /** Current limitation mode (99 = manual). */
  get mode(): number | undefined {
    return this.numeric('mode');
  }
  /** Limitation value in kW. */
  get limit(): number | undefined {
    return this.numeric('limit');
  }
  /** Limitation mode after unplugging vehicle (0 = keep previous). */
  get modeUnplug(): number | undefined {
    return this.numeric('modeUnplug');
  }
  /** JSON object describing the current charging session. */
  get session(): string | undefined {
    return this.text('session');
  }
  /** JSON object describing the current charging session (parsed JSON). */
  sessionJson<T = unknown>(): T | undefined {
    return this.control.getState('session')?.json<T>();
  }
  /** Flag if priority is requested (in Wallbox Energy Manager). */
  get priority(): boolean | undefined {
    return this.boolean('priority');
  }
  /** Price per connected hour (-1337 = no price). */
  get pricePerHour(): number | undefined {
    return this.numeric('pricePerHour');
  }
  /** Current price per kWh (-1337 = no price). */
  get pricePerkWh(): number | undefined {
    return this.numeric('pricePerkWh');
  }
  /** Temporary limitation due to regional regulations (0 none, 1 blocked, 2 reduced, 3 above limit). */
  get temporaryLimitation(): number | undefined {
    return this.numeric('temporaryLimitation');
  }
}
