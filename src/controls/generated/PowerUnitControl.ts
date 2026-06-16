import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';
import { ControlHandle } from '../ControlHandle.js';

/** Power Supply & Backup unit reporting output power, fuse states, battery and device status. (generated). */
export class PowerUnitControl extends ControlHandle {
  static readonly controlType = 'PowerUnit';

  /** Total output power of the device (kW). */
  get outputPower(): number | undefined {
    return this.numeric('outputPower');
  }
  /** Power of output 1 (kW); outputs CP1-CP7 are reported per fuse. */
  get cp1(): number | undefined {
    return this.numeric('CP1');
  }
  /** Bitmask of all blown fuses (bit 1 = fuse for output 1, ...). */
  get fuse(): number | undefined {
    return this.numeric('fuse');
  }
  /** Unix timestamp for end of supply time in backup mode; 0 if unknown/not applicable. */
  get supplyTimeRemaining(): number | undefined {
    return this.numeric('supplyTimeRemaining');
  }
  /** Unix timestamp for end of supply time in backup mode; 0 if unknown/not applicable. (as a Date). */
  get supplyTimeRemainingDate(): Date | undefined {
    const v = this.numeric('supplyTimeRemaining');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** State of charge of the attached battery 0-100 (%). */
  get batteryStateOfCharge(): number | undefined {
    return this.numeric('batteryStateOfCharge');
  }
  /** Bitmask of additional device states (backup mode, overcurrent, battery missing/empty/test/service/defective, overheating). */
  get deviceInfo(): number | undefined {
    return this.numeric('deviceInfo');
  }
}
