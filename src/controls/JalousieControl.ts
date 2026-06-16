import { clamp, ControlHandle } from './ControlHandle.js';

/**
 * A `Jalousie` control (blinds / shutters / curtains).
 *
 * States: `up`, `down`, `position` (0 = fully up/open … 1 = fully down/closed),
 * `shadePosition` (slat angle, 0 = horizontal … 1 = vertical).
 * Commands: `FullUp`, `FullDown`, `up`/`UpOff`, `down`/`DownOff`, `stop`,
 * `shade`, `auto`/`NoAuto`, `manualPosition/{0..100}`, `manualLamelle/{0..100}`.
 */
export class JalousieControl extends ControlHandle {
  static readonly controlType = 'Jalousie';

  /** Moves fully up (open). */
  async fullUp(): Promise<void> {
    await this.send('FullUp');
  }

  /** Moves fully down (closed). */
  async fullDown(): Promise<void> {
    await this.send('FullDown');
  }

  /** Starts moving up (until `stop`/`upOff` or the end position). */
  async up(): Promise<void> {
    await this.send('up');
  }

  /** Stops an upward motion. */
  async upOff(): Promise<void> {
    await this.send('UpOff');
  }

  /** Starts moving down. */
  async down(): Promise<void> {
    await this.send('down');
  }

  /** Stops a downward motion. */
  async downOff(): Promise<void> {
    await this.send('DownOff');
  }

  /** Immediately stops, holding the current position. */
  async stop(): Promise<void> {
    await this.send('stop');
  }

  /** Moves to the configured shade position. */
  async shade(): Promise<void> {
    await this.send('shade');
  }

  /** Enables automatic mode (if supported). */
  async enableAuto(): Promise<void> {
    await this.send('auto');
  }

  /** Disables automatic mode (if supported). */
  async disableAuto(): Promise<void> {
    await this.send('NoAuto');
  }

  /** Moves to a position as a percentage: 0 = fully open, 100 = fully closed. */
  async setPosition(percent: number): Promise<void> {
    await this.send(`manualPosition/${clamp(percent, 0, 100)}`);
  }

  /** Rotates the slats as a percentage: 0 = horizontal, 100 = vertical. */
  async setSlats(percent: number): Promise<void> {
    await this.send(`manualLamelle/${clamp(percent, 0, 100)}`);
  }

  /** Current position, 0 (fully up/open) … 1 (fully down/closed). */
  get position(): number | undefined {
    return this.numeric('position');
  }

  /** Current position as a percentage, 0 … 100. */
  get positionPercent(): number | undefined {
    const p = this.position;
    return p === undefined ? undefined : Math.round(p * 100);
  }

  /** Current slat angle, 0 (horizontal) … 1 (vertical). */
  get slatsPosition(): number | undefined {
    return this.numeric('shadePosition');
  }

  /** Whether the jalousie is currently moving up. */
  get isMovingUp(): boolean | undefined {
    return this.boolean('up');
  }

  /** Whether the jalousie is currently moving down. */
  get isMovingDown(): boolean | undefined {
    return this.boolean('down');
  }
}
