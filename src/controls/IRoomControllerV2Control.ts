import { ControlHandle } from './ControlHandle.js';

/** `activeMode` values of an Intelligent Room Controller V2. */
export enum RoomControllerMode {
  Economy = 0,
  Comfort = 1,
  BuildingProtection = 2,
  Manual = 3,
  Off = 4,
}

/**
 * An `IRoomControllerV2` control (intelligent room controller / climate).
 *
 * States: `tempActual`, `tempTarget`, `comfortTemperature`, `activeMode`
 * ({@link RoomControllerMode}), `operatingMode`.
 * Commands: `setComfortTemperature/{t}`, `setManualTemperature/{t}`,
 * `setOperatingMode/{m}`, `override/{modeId}/[until]/[temp]`.
 */
export class IRoomControllerV2Control extends ControlHandle {
  static readonly controlType = 'IRoomControllerV2';

  /** Current measured temperature. */
  get temperature(): number | undefined {
    return this.numeric('tempActual');
  }
  /** Current target temperature. */
  get targetTemperature(): number | undefined {
    return this.numeric('tempTarget');
  }
  /** Configured comfort temperature. */
  get comfortTemperature(): number | undefined {
    return this.numeric('comfortTemperature');
  }
  /** Active mode (see {@link RoomControllerMode}). */
  get mode(): RoomControllerMode | undefined {
    return this.numeric('activeMode');
  }
  /** Operating mode (0–5 automatic/manual heating/cooling; -1 off). */
  get operatingMode(): number | undefined {
    return this.numeric('operatingMode');
  }

  /** Sets the comfort (heating) temperature. */
  async setComfortTemperature(temp: number): Promise<void> {
    await this.send(`setComfortTemperature/${temp}`);
  }
  /** Sets the manual target temperature. */
  async setManualTemperature(temp: number): Promise<void> {
    await this.send(`setManualTemperature/${temp}`);
  }
  /** Sets the operating mode (see `operatingMode`). */
  async setOperatingMode(mode: number): Promise<void> {
    await this.send(`setOperatingMode/${mode}`);
  }
  /**
   * Starts an override timer for a mode (command `override/{modeId}/[until]/[temp]`).
   * @param until End in seconds since 2009-01-01 UTC; omit for indefinite.
   * @param temp Optional target temperature. The command is positional, so when a
   *   temp is given without an `until` an empty `until` segment is sent to keep
   *   temp in the correct (third) position.
   */
  async override(modeId: number, until?: number, temp?: number): Promise<void> {
    if (temp !== undefined) {
      await this.send(`override/${modeId}/${until ?? ''}/${temp}`);
    } else if (until !== undefined) {
      await this.send(`override/${modeId}/${until}`);
    } else {
      await this.send(`override/${modeId}`);
    }
  }
}
