import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';
import { clamp, ControlHandle } from '../ControlHandle.js';

/** US-style HVAC controller managing multi-stage heating, cooling, emergency heat, fan and ventilation. (generated). */
export class ClimateControllerUSControl extends ControlHandle {
  static readonly controlType = 'ClimateControllerUS';

  /** Sets ventilation (0 automatic based on demand, 1 activates ventilator and opens all vents). */
  async ventilation(active: number): Promise<void> {
    await this.send(`ventilation/${Math.round(active)}`);
  }
  /** Starts the ventilation timer until the given time (0 stops, -1 always on). */
  async startVentilationTimer(secondsSince2009Until: number): Promise<void> {
    await this.send(`startVentilationTimer/${Math.round(secondsSince2009Until)}`);
  }
  /** Sets the mode (0 Off, 1 Heating and cooling, 2 Heating, 3 Cooling). */
  async setMode(mode: number): Promise<void> {
    await this.send(`setMode/${clamp(mode, 0, 3)}`);
  }
  /** Sets a timed mode (until = seconds since 2009, 0 stops, -1 endless; modeend = mode after timer elapses). */
  async startModeTimer(mode: number, until: number, modeend: number): Promise<void> {
    await this.send(`startmodetimer/${clamp(mode, 0, 3)}/${Math.round(until)}/${clamp(modeend, 0, 3)}`);
  }
  /** If activated emergency heat is used for heating. */
  async useEmergency(active: boolean): Promise<void> {
    await this.send(`useEmergency/${active ? 1 : 0}`);
  }
  /** Activates emergency input until the given time (0 stops, -1 always on). */
  async startEmergencyTimer(secondsSince2009Until: number): Promise<void> {
    await this.send(`startEmergencyTimer/${Math.round(secondsSince2009Until)}`);
  }
  /** Sets the minimum temperature to allow cooling. */
  async setMinimumTempCooling(temp: number): Promise<void> {
    await this.send(`setMinimumTempCooling/${temp}`);
  }
  /** Sets the maximum temperature to allow heating. */
  async setMaximumTempHeating(temp: number): Promise<void> {
    await this.send(`setMaximumTempHeating/${temp}`);
  }
  /** Activates or deactivates the service mode (since 15.1; see serviceMode state). */
  async setServiceMode(active: number): Promise<void> {
    await this.send(`setServiceMode/${Math.round(active)}`);
  }
  /** Configured mode (0 Off, 1 Heating and cooling, 2 Heating, 3 Cooling). */
  get mode(): number | undefined {
    return this.numeric('mode');
  }
  /** Bitmask of the current active status (heating/cooling stages, switching and delay flags). */
  get currentStatus(): number | undefined {
    return this.numeric('currentStatus');
  }
  /** Seconds since 2009 until the fan timer runs (-1 until manual, 0 auto). */
  get fanTimerUntil(): number | undefined {
    return this.numeric('fanTimerUntil');
  }
  /** Seconds since 2009 until the fan timer runs (-1 until manual, 0 auto). (as a Date). */
  get fanTimerUntilDate(): Date | undefined {
    const v = this.numeric('fanTimerUntil');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** Seconds since 2009 until the mode override runs (-1 no end, 0 no timer). */
  get modeTimerUntil(): number | undefined {
    return this.numeric('modeTimerUntil');
  }
  /** Seconds since 2009 until the mode override runs (-1 no end, 0 no timer). (as a Date). */
  get modeTimerUntilDate(): Date | undefined {
    const v = this.numeric('modeTimerUntil');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** Seconds since 2009 until emergency heating is used (-1 until deactivated, 0 not used). */
  get emergencyTimerUntil(): number | undefined {
    return this.numeric('emergencyTimerUntil');
  }
  /** Seconds since 2009 until emergency heating is used (-1 until deactivated, 0 not used). (as a Date). */
  get emergencyTimerUntilDate(): Date | undefined {
    const v = this.numeric('emergencyTimerUntil');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** Current status of the fan output. */
  get fan(): number | undefined {
    return this.numeric('fan');
  }
  /** State of the emergency input or value set via app when nothing is connected. */
  get emergencyOverride(): number | undefined {
    return this.numeric('emergencyOverride');
  }
  /** Current humidity in %. */
  get humidity(): number | undefined {
    return this.numeric('humidity');
  }
  /** The outdoor temperature (-1000 = no temperature available). */
  get actualOutdoorTemp(): number | undefined {
    return this.numeric('actualOutdoorTemp');
  }
  /** Minimum temperature to be able to cool. */
  get minimumTempCooling(): number | undefined {
    return this.numeric('minimumTempCooling');
  }
  /** Maximum temperature to be able to heat. */
  get maximumTempHeating(): number | undefined {
    return this.numeric('maximumTempHeating');
  }
  /** Optional lower bound for minimumTempCooling (HVAC USA, ctype 510). */
  get protectionTemp(): number | undefined {
    return this.numeric('protectionTemp');
  }
  /** Minimum demand in percent (0-100) to start heating or cooling. */
  get threshold(): number | undefined {
    return this.numeric('threshold');
  }
  /** Cooling demand of all room controllers in percent (0-100). */
  get demandCool(): number | undefined {
    return this.numeric('demandCool');
  }
  /** Heating demand of all room controllers in percent (0-100). */
  get demandHeat(): number | undefined {
    return this.numeric('demandHeat');
  }
  /** Bitmask state of EH/EC input (Bit 1 EH active, Bit 2 EC active; since V15.1). */
  get excessEnergy(): number | undefined {
    return this.numeric('ExcessEnergy');
  }
  /** Currently active heating/cooling stage (0 Off, 1 First, 2 Second). */
  get stage(): number | undefined {
    return this.numeric('stage');
  }
  /** Active service mode setting (0 Off, 1 Standby, 2 Heating On, 3 Cooling On, 4 Fan On). */
  get serviceMode(): number | undefined {
    return this.numeric('serviceMode');
  }
  /** Information about used outdoor temperature (0 Not enough data, 1 Ok, 2 No data at all; since V15.1). */
  get outdoorTempInfo(): number | undefined {
    return this.numeric('outdoorTempInfo');
  }
  /** Which outdoor temperature source is used (0 not used, 1 48h average, 2 system variable, 3 current; since V15.1). */
  get outdoorTempMode(): number | undefined {
    return this.numeric('outdoorTempMode');
  }
}
