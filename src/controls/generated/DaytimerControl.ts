import { ControlHandle } from '../ControlHandle.js';

/** Daytimer schedule control with analog or digital output, modes and overrides. (generated). */
export class DaytimerControl extends ControlHandle {
  static readonly controlType = 'Daytimer';

  /** Activates the new value if an entry needs activation. */
  async pulse(): Promise<void> {
    await this.send('pulse');
  }
  /** Changes the default value in the analog daytimer. */
  async setDefault(value: number): Promise<void> {
    await this.send(`default/${value}`);
  }
  /** Starts the timer with a new value for the given duration in seconds. */
  async startOverride(value: number, howLongInSecs: number): Promise<void> {
    await this.send(`startOverride/${value}/${Math.round(howLongInSecs)}`);
  }
  /** Stops the override timer. */
  async stopOverride(): Promise<void> {
    await this.send('stopOverride');
  }
  /** Changes entries of the daytimer; each entry is mode;fromMin;toMin;needsActivation;valueOfEntry. */
  async set(numberOfEntries: number, entries: string): Promise<void> {
    await this.send(`set/${Math.round(numberOfEntries)}/${encodeURIComponent(entries)}`);
  }
  /** Sets the operating modes list sorted by priority with all weekdays 3-9 at the end. */
  async modeslist(list: string): Promise<void> {
    await this.send(`modeslist/${encodeURIComponent(list)}`);
  }
  /** All available modes in a proprietary list format. */
  get modeList(): string | undefined {
    return this.text('modeList');
  }
  /** Current operating mode of the daytimer. */
  get mode(): number | undefined {
    return this.numeric('mode');
  }
  /** The remaining time of the override. */
  get override(): number | undefined {
    return this.numeric('override');
  }
  /** Current value: 0 or 1 for digital, a numeric value for analog. */
  get value(): number | undefined {
    return this.numeric('value');
  }
  /** Daytimer events with entries plus a default value (analog only). */
  get entriesAndDefaultValue(): string | undefined {
    return this.text('entriesAndDefaultValue');
  }
  /** Active as long as the reset input of the daytimer is active. */
  get resetActive(): boolean | undefined {
    return this.boolean('resetActive');
  }
  /** Only available if the control needs to be activated. */
  get needsActivation(): boolean | undefined {
    return this.boolean('needsActivation');
  }
}
