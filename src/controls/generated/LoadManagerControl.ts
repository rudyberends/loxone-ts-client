import { ControlHandle } from '../ControlHandle.js';

/** Load Manager that locks loads to keep total power within configured overload/peak limits. (generated). */
export class LoadManagerControl extends ControlHandle {
  static readonly controlType = 'LoadManager';

  /** Current power in kW in Overload mode, average power in kW in Peak mode (two decimals). */
  get currentPower(): number | undefined {
    return this.numeric('currentPower');
  }
  /** Current power in kW in Peak Overload mode (two decimals). */
  get peakOverloadPower(): number | undefined {
    return this.numeric('peakOverloadPower');
  }
  /** Maximum technical power in kW from the block parameter in Peak Overload mode (two decimals). */
  get maxTp(): number | undefined {
    return this.numeric('maxTp');
  }
  /** Maximum power in kW (two decimals). */
  get maxPower(): number | undefined {
    return this.numeric('maxPower');
  }
  /** Remaining free power in kW (two decimals). */
  get availablePower(): number | undefined {
    return this.numeric('availablePower');
  }
  /** TRUE when maximum power is reached. */
  get maxPowerExceeded(): boolean | undefined {
    return this.boolean('maxPowerExceeded');
  }
  /** Bitmask of each locked load (1 = locked, first bit = first load). */
  get lockedLoads(): number | undefined {
    return this.numeric('lockedLoads');
  }
  /** Bitmask of each active load (1 = active, first bit = first load); only valid when load hasStatus is true. */
  get statusLoads(): number | undefined {
    return this.numeric('statusLoads');
  }
}
