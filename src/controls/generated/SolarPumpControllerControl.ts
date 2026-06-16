import { ControlHandle } from '../ControlHandle.js';

/** Thermal solar controller tracking collector and buffer temperatures and pump logic state. (generated). */
export class SolarPumpControllerControl extends ControlHandle {
  static readonly controlType = 'SolarPumpController';

  /** Temperature of buffer 0. */
  get bufferTemp0(): number | undefined {
    return this.numeric('bufferTemp0');
  }
  /** Temperature of buffer 1. */
  get bufferTemp1(): number | undefined {
    return this.numeric('bufferTemp1');
  }
  /** Temperature of buffer 2. */
  get bufferTemp2(): number | undefined {
    return this.numeric('bufferTemp2');
  }
  /** Temperature of buffer 3. */
  get bufferTemp3(): number | undefined {
    return this.numeric('bufferTemp3');
  }
  /** Temperature of buffer 4. */
  get bufferTemp4(): number | undefined {
    return this.numeric('bufferTemp4');
  }
  /** State of buffer 0 (0 Waiting, 1 Heating, 2 Cooling, 3 OK). */
  get bufferState0(): number | undefined {
    return this.numeric('bufferState0');
  }
  /** State of buffer 1 (0 Waiting, 1 Heating, 2 Cooling, 3 OK). */
  get bufferState1(): number | undefined {
    return this.numeric('bufferState1');
  }
  /** State of buffer 2 (0 Waiting, 1 Heating, 2 Cooling, 3 OK). */
  get bufferState2(): number | undefined {
    return this.numeric('bufferState2');
  }
  /** State of buffer 3 (0 Waiting, 1 Heating, 2 Cooling, 3 OK). */
  get bufferState3(): number | undefined {
    return this.numeric('bufferState3');
  }
  /** State of buffer 4 (0 Waiting, 1 Heating, 2 Cooling, 3 OK). */
  get bufferState4(): number | undefined {
    return this.numeric('bufferState4');
  }
  /** Whether the control is overwritten by logic. */
  get logicOverride(): boolean | undefined {
    return this.boolean('logicOverride');
  }
  /** Temperature of the collector. */
  get collectorTemp(): number | undefined {
    return this.numeric('collectorTemp');
  }
  /** Whether heat overload is reached. */
  get heatOverload(): boolean | undefined {
    return this.boolean('heatOverload');
  }
}
