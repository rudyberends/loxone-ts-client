import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';
import { clamp, ControlHandle } from '../ControlHandle.js';

/** Climate controller coordinating heating and cooling demand of connected IRCv2 room controllers. (generated). */
export class ClimateControllerControl extends ControlHandle {
  static readonly controlType = 'ClimateController';

  /** Resets the maintenance counter. */
  async resetMaintenance(): Promise<void> {
    await this.send('resetMaintenance');
  }
  /** Activates or deactivates the service mode (see serviceMode state for values). */
  async setServiceMode(active: number): Promise<void> {
    await this.send(`setServiceMode/${Math.round(active)}`);
  }
  /** Activates the ventilator. */
  async ventilation(active: number): Promise<void> {
    await this.send(`ventilation/${Math.round(active)}`);
  }
  /** Activates the automatic mode (-1 Off, 0 Heating and cooling, 1 Heating, 2 Cooling). */
  async autoMode(mode: number): Promise<void> {
    await this.send(`autoMode/${clamp(mode, -1, 2)}`);
  }
  /** Sets the heating temperature boundary. */
  async setHeatingBoundary(temp: number): Promise<void> {
    await this.send(`setHeatingBoundary/${temp}`);
  }
  /** Sets the cooling temperature boundary. */
  async setCoolingBoundary(temp: number): Promise<void> {
    await this.send(`setCoolingBoundary/${temp}`);
  }
  /** Current active mode (0 None, 1 Heating, 2 Cooling, 3 Heating boost, 4 Cooling boost, 5 Service mode, 6 External Heater). */
  get currentMode(): number | undefined {
    return this.numeric('currentMode');
  }
  /** Configured automatic mode (-1 Off, 0 Heating and cooling, 1 Heating, 2 Cooling). */
  get autoModeValue(): number | undefined {
    return this.numeric('autoMode');
  }
  /** Current active automatic mode (0 like conditions, 1 like average temperature). */
  get currentAutomatic(): number | undefined {
    return this.numeric('currentAutomatic');
  }
  /** Information about the temperature boundaries (0 Not enough data, 1 Ok, 2 No data at all). */
  get temperatureBoundaryInfo(): number | undefined {
    return this.numeric('temperatureBoundaryInfo');
  }
  /** Temperature boundary for heating. */
  get heatingTempBoundary(): number | undefined {
    return this.numeric('heatingTempBoundary');
  }
  /** Temperature boundary for cooling. */
  get coolingTempBoundary(): number | undefined {
    return this.numeric('coolingTempBoundary');
  }
  /** The outdoor temperature (-1000 = no temperature available). */
  get actualOutdoorTemp(): number | undefined {
    return this.numeric('actualOutdoorTemp');
  }
  /** Calculated average temperature (-1000 = no 48h average available yet). */
  get averageOutdoorTemp(): number | undefined {
    return this.numeric('averageOutdoorTemp');
  }
  /** How the control is overwritten (0 Automatic, 1 Boost, 2 External Heater, 3 Stop, 4 Custom Info). */
  get overwriteReason(): number | undefined {
    return this.numeric('overwriteReason');
  }
  /** Name of the control connected to the currently active overwrite input. */
  get infoText(): string | undefined {
    return this.text('infoText');
  }
  /** Active service mode setting (0 Off, 1 Standby, 2 Heating On, 3 Cooling On, 4 Fan On). */
  get serviceMode(): number | undefined {
    return this.numeric('serviceMode');
  }
  /** Unix timestamp when the next maintenance must occur. */
  get nextMaintenance(): number | undefined {
    return this.numeric('nextMaintenance');
  }
  /** Unix timestamp when the next maintenance must occur. (as a Date). */
  get nextMaintenanceDate(): Date | undefined {
    const v = this.numeric('nextMaintenance');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** State of the ventilation output. */
  get ventilationValue(): number | undefined {
    return this.numeric('ventilation');
  }
  /** Bitmask state of EH/EC input (Bit 0 EH active, Bit 1 EC active). */
  get excessEnergy(): number | undefined {
    return this.numeric('excessEnergy');
  }
  /** Reason the control is not heating or cooling (0 not in standby, 1 no request, 2 demand below threshold, 3 mode prevented by outdoor temperature). */
  get standbyReason(): number | undefined {
    return this.numeric('standbyReason');
  }
}
