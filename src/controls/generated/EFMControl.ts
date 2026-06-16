import { ControlHandle } from '../ControlHandle.js';

/** Energy Flow Monitor showing live and accumulated grid, storage, production and load values across a node tree. (generated). */
export class EFMControl extends ControlHandle {
  static readonly controlType = 'EFM';

  /** Return per-node output values (key=nodeUuid) for the given viewType (actual/day/week/month/year/lifetime); nodeUuidList is semicolon-separated. */
  async getNodeValue(viewType: string, nodeUuidList: string): Promise<void> {
    await this.send(`getNodeValue/${encodeURIComponent(viewType)}/${encodeURIComponent(nodeUuidList)}`);
  }
  /** Return EFM-calculated aggregate values for the given viewType (actual/day/week/month/year/lifetime). */
  async get(viewType: string): Promise<void> {
    await this.send(`get/${encodeURIComponent(viewType)}`);
  }
  /** Current production power (unit defined in block settings). */
  get ppwr(): number | undefined {
    return this.numeric('Ppwr');
  }
  /** Current grid power (unit defined in block settings). */
  get gpwr(): number | undefined {
    return this.numeric('Gpwr');
  }
  /** Current storage power (unit defined in block settings). */
  get spwr(): number | undefined {
    return this.numeric('Spwr');
  }
  /** Price export per kWh. */
  get pre(): number | undefined {
    return this.numeric('Pre');
  }
  /** Price import per kWh. */
  get pri(): number | undefined {
    return this.numeric('Pri');
  }
  /** CO2 factor (kg/kWh). */
  get co2(): number | undefined {
    return this.numeric('CO2');
  }
}
