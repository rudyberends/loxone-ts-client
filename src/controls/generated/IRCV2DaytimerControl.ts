import { ControlHandle } from '../ControlHandle.js';

/** Intelligent Room Controller v2 daytimer; analog entries identify the target temperature. (generated). */
export class IRCV2DaytimerControl extends ControlHandle {
  static readonly controlType = 'IRCV2Daytimer';

  /** Sets the calendar entries. */
  async set(entries: string): Promise<void> {
    await this.send(`set/${encodeURIComponent(entries)}`);
  }
  /** Sets the operating modes list. */
  async modeslist(list: string): Promise<void> {
    await this.send(`modeslist/${encodeURIComponent(list)}`);
  }
  /** All available modes in a proprietary list format (inherited from Daytimer). */
  get modeList(): string | undefined {
    return this.text('modeList');
  }
  /** Current operating mode of the daytimer (inherited from Daytimer). */
  get mode(): number | undefined {
    return this.numeric('mode');
  }
  /** The remaining time of the override (inherited from Daytimer). */
  get override(): number | undefined {
    return this.numeric('override');
  }
  /** Current analog value encoding the target temperature/mode (inherited from Daytimer). */
  get value(): number | undefined {
    return this.numeric('value');
  }
  /** Daytimer events with entries plus a default value (inherited from Daytimer). */
  get entriesAndDefaultValue(): string | undefined {
    return this.text('entriesAndDefaultValue');
  }
  /** Active as long as the reset input of the daytimer is active (inherited from Daytimer). */
  get resetActive(): boolean | undefined {
    return this.boolean('resetActive');
  }
  /** Only available if the control needs to be activated (inherited from Daytimer). */
  get needsActivation(): boolean | undefined {
    return this.boolean('needsActivation');
  }
}
