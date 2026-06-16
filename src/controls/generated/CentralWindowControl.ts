import { clamp, ControlHandle } from '../ControlHandle.js';

/** Central object controlling multiple Window blocks at once. (generated). */
export class CentralWindowControl extends ControlHandle {
  static readonly controlType = 'CentralWindow';

  /** Toggle all controlled windows. */
  async toggle(): Promise<void> {
    await this.send('toggle');
  }
  /** Open all controlled windows completely. */
  async fullOpen(): Promise<void> {
    await this.send('fullopen');
  }
  /** Close all controlled windows completely. */
  async fullClose(): Promise<void> {
    await this.send('fullclose');
  }
  /** Move all controlled windows to a position (0 = fully closed, 100 = fully open). */
  async moveToPosition(position: number): Promise<void> {
    await this.send(`moveToPosition/${clamp(position, 0, 100)}`);
  }
  /** Start/stop opening windows in jog mode (state = on/off). */
  async open(state: string): Promise<void> {
    await this.send(`open/${encodeURIComponent(state)}`);
  }
  /** Start/stop closing windows in jog mode (state = on/off). */
  async close(state: string): Promise<void> {
    await this.send(`close/${encodeURIComponent(state)}`);
  }
  /** Move all controlled windows to a partially open position. */
  async slightlyOpen(): Promise<void> {
    await this.send('slightlyOpen');
  }
  /** Activate protection on all controlled windows. */
  async protection(): Promise<void> {
    await this.send('protection');
  }
  /** Stop movement of all controlled windows. */
  async stop(): Promise<void> {
    await this.send('stop');
  }
  /** Send a command to a comma-separated subset of controlled objects. */
  async selectedControls(ids: string, command: string): Promise<void> {
    await this.send(`selectedcontrols/${encodeURIComponent(ids)}/${encodeURIComponent(command)}`);
  }
}
