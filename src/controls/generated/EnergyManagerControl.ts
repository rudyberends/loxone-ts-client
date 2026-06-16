import { ControlHandle } from '../ControlHandle.js';

/** Energy Manager that activates and triggers configured loads based on available power. (generated). */
export class EnergyManagerControl extends ControlHandle {
  static readonly controlType = 'EnergyManager';

  /** Start an output for its minimum time, or start activation, for the load with the given id. */
  async trigger(id: number): Promise<void> {
    await this.send(`trigger/${Math.round(id)}`);
  }
  /** Permanently switch on the load with the given id. */
  async turnOn(id: number): Promise<void> {
    await this.send(`turnOn/${Math.round(id)}`);
  }
  /** Turn off the load with the given id; overrides input until next change on input. */
  async turnOff(id: number): Promise<void> {
    await this.send(`turnOff/${Math.round(id)}`);
  }
  /** Value of input AIp (current power). */
  get currentPower(): number | undefined {
    return this.numeric('currentPower');
  }
  /** Value of input AIb (current battery). */
  get currentBat(): number | undefined {
    return this.numeric('currentBat');
  }
  /** JSON array describing each used load (id, isActive, isPreparing, activeUntil, isWaitingforActivation, isPermanentOn). */
  get loads(): string | undefined {
    return this.text('loads');
  }
  /** JSON array describing each used load (parsed JSON). */
  loadsJson<T = unknown>(): T | undefined {
    return this.control.getState('loads')?.json<T>();
  }
}
