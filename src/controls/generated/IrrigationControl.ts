import { ControlHandle } from '../ControlHandle.js';

const currentZoneLabelMap: Readonly<Record<number, 'off' | 'zone 1' | 'all active'>> = { [-1]: 'off', [0]: 'zone 1', [8]: 'all active' };

/** Controls an irrigation system with multiple zones and rain-based logic. (generated). */
export class IrrigationControl extends ControlHandle {
  static readonly controlType = 'Irrigation';

  /** Start irrigation ignoring expected rain and past rain amount. */
  async startForce(): Promise<void> {
    await this.send('startForce');
  }
  /** Start irrigation only when it has not rained enough and will not rain enough. */
  async start(): Promise<void> {
    await this.send('start');
  }
  /** Stops running irrigation. */
  async stop(): Promise<void> {
    await this.send('stop');
  }
  /** Set duration (in seconds) of one zone. */
  async setDuration(zoneId: number, duration: number): Promise<void> {
    await this.send(`setDuration/${Math.round(zoneId)}=${Math.round(duration)}`);
  }
  /** Activate a zone manually until stopped (0 = deactivate all, 9 = activate all). */
  async select(zoneId: number): Promise<void> {
    await this.send(`select/${Math.round(zoneId)}`);
  }
  /** Whether rain is currently active. */
  get rainActive(): boolean | undefined {
    return this.boolean('rainActive');
  }
  /** Expected precipitation amount. */
  get expectedPrecipitation(): number | undefined {
    return this.numeric('expectedPrecipitation');
  }
  /** Maximum precipitation parameter above which irrigation will not start automatically. */
  get maxExpectedPrecipitation(): number | undefined {
    return this.numeric('maxExpectedPrecipitation');
  }
  /** Current active zone (-1 = off, 0 = zone 1, ..., 8 = all active). */
  get currentZone(): number | undefined {
    return this.numeric('currentZone');
  }
  /** Current active zone (decoded label). */
  get currentZoneLabel(): ('off' | 'zone 1' | 'all active') | undefined {
    const v = this.numeric('currentZone');
    return v === undefined ? undefined : currentZoneLabelMap[v];
  }
  /** JSON array describing each used zone (id, name, duration, setByLogic). */
  get zones(): string | undefined {
    return this.text('zones');
  }
  /** JSON array describing each used zone (parsed JSON). */
  zonesJson<T = unknown>(): T | undefined {
    return this.control.getState('zones')?.json<T>();
  }
  /** Total seconds it was raining in the last 24 hours. */
  get rainTime(): number | undefined {
    return this.numeric('rainTime');
  }
}
