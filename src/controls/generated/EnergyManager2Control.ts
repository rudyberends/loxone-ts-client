import { ControlHandle } from '../ControlHandle.js';

/** Energy Manager Gen. 2 managing loads against grid, storage and production power with configurable storage parameters. (generated). */
export class EnergyManager2Control extends ControlHandle {
  static readonly controlType = 'EnergyManager2';

  /** Check the inputs right now without waiting for any timeouts. */
  async manage(): Promise<void> {
    await this.send('manage');
  }
  /** Set the MinSoc parameter (only works when the input is not locked). */
  async setMinSoc(value: number): Promise<void> {
    await this.send(`setMinSoc/${value}`);
  }
  /** Set the MaxSpwr parameter (only works when the input is not locked). */
  async setMaxSpwr(value: number): Promise<void> {
    await this.send(`setMaxSpwr/${value}`);
  }
  /** Activate the given load until midnight. */
  async activateLoad(loadUuid: string): Promise<void> {
    await this.send(`${encodeURIComponent(loadUuid)}/activate`);
  }
  /** Deactivate the given load until midnight. */
  async deactivateLoad(loadUuid: string): Promise<void> {
    await this.send(`${encodeURIComponent(loadUuid)}/deactivate`);
  }
  /** Set the given load back to automatic mode. */
  async automaticLoad(loadUuid: string): Promise<void> {
    await this.send(`${encodeURIComponent(loadUuid)}/automatic`);
  }
  /** Reorder load priorities; comma-separated list of load uuids in priority order. */
  async order(uuidList: string): Promise<void> {
    await this.send(`order/${encodeURIComponent(uuidList)}`);
  }
  /** Return a JSON array with the title, description and unit of the energy storage settings (MinSoc, MaxSpwr). */
  async getStorageSettingDescriptions(): Promise<void> {
    await this.send('getStorageSettingDescriptions');
  }
  /** Value of input Gpwr (grid power) [kW]. */
  get gpwr(): number | undefined {
    return this.numeric('Gpwr');
  }
  /** Value of input Spwr (storage power) [kW]. */
  get spwr(): number | undefined {
    return this.numeric('Spwr');
  }
  /** Value of input Ppwr (production power) [kW]. */
  get ppwr(): number | undefined {
    return this.numeric('Ppwr');
  }
  /** Value of input Ssoc (storage state of charge) [%]. */
  get ssoc(): number | undefined {
    return this.numeric('Ssoc');
  }
  /** Value of parameter MinSoc (minimum storage state of charge) [%]. */
  get minSoc(): number | undefined {
    return this.numeric('MinSoc');
  }
  /** Value of parameter MaxSpwr (max storage power) [kW]. */
  get maxSpwr(): number | undefined {
    return this.numeric('MaxSpwr');
  }
  /** JSON array describing each used load (prio, id, name, uuid, icon, pwr, ppwr, hasActual, active, activatedManually, deactivatedManually, minimumActiveUntil, activeDueToDailyRuntime). */
  get loads(): string | undefined {
    return this.text('loads');
  }
  /** JSON array describing each used load (parsed JSON). */
  loadsJson<T = unknown>(): T | undefined {
    return this.control.getState('loads')?.json<T>();
  }
}
