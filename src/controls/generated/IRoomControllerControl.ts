import { clamp, ControlHandle } from '../ControlHandle.js';

/** Intelligent Room Controller (v1) managing heating/cooling temperature modes, service modes and timers. (generated). */
export class IRoomControllerControl extends ControlHandle {
  static readonly controlType = 'IRoomController';

  /** Set the mode the IRoomController should work in (0-6). */
  async setMode(mode: number): Promise<void> {
    await this.send(`mode/${clamp(mode, 0, 6)}`);
  }
  /** Activate the service mode with an id from 0 to 4. */
  async setService(service: number): Promise<void> {
    await this.send(`service/${clamp(service, 0, 4)}`);
  }
  /** Start the timer with a temperature id and remaining seconds. */
  async startTimer(temperatureId: number, seconds: number): Promise<void> {
    await this.send(`starttimer/${clamp(temperatureId, 0, 7)}/${Math.round(seconds)}`);
  }
  /** Stop the timer. */
  async stopTimer(): Promise<void> {
    await this.send('stoptimer');
  }
  /** Change the value of a temperature with a temperature id and the new value. */
  async setTemp(temperatureId: number, value: number): Promise<void> {
    await this.send(`settemp/${clamp(temperatureId, 0, 7)}/${value}`);
  }
  /** The current target temperature. */
  get tempTarget(): number | undefined {
    return this.numeric('tempTarget');
  }
  /** The current temperature. */
  get tempActual(): number | undefined {
    return this.numeric('tempActual');
  }
  /** Error: large difference between target and actual, or out of protection bounds. */
  get error(): boolean | undefined {
    return this.boolean('error');
  }
  /** Information about the mode of the IRoomController (0-6). */
  get mode(): number | undefined {
    return this.numeric('mode');
  }
  /** The current service mode index (0-4). */
  get serviceMode(): number | undefined {
    return this.numeric('serviceMode');
  }
  /** The current heating temperature index of the temperatures. */
  get currHeatTempIx(): number | undefined {
    return this.numeric('currHeatTempIx');
  }
  /** The current cooling temperature index of the temperatures. */
  get currCoolTempIx(): number | undefined {
    return this.numeric('currCoolTempIx');
  }
  /** The remaining time of the timer. */
  get override(): number | undefined {
    return this.numeric('override');
  }
  /** Whether the window is currently opened. */
  get openWindow(): boolean | undefined {
    return this.boolean('openWindow');
  }
  /** The total time with which the timer was started. */
  get overrideTotal(): number | undefined {
    return this.numeric('overrideTotal');
  }
  /** Whether and how the user overrides with manual intervention (0-4). */
  get manualMode(): number | undefined {
    return this.numeric('manualMode');
  }
  /** Array of temperatures, indexed by the temperature ids from the details object. */
  get temperatures(): string | undefined {
    return this.text('temperatures');
  }
  /** Array of temperatures, indexed by the temperature ids from the details object (parsed JSON). */
  temperaturesJson<T = unknown>(): T | undefined {
    return this.control.getState('temperatures')?.json<T>();
  }
  /** While on, all outputs of the room controller remain off regardless of temperatures. */
  get stop(): boolean | undefined {
    return this.boolean('stop');
  }
}
