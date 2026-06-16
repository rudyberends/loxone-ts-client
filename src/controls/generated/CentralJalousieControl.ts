import { ControlHandle } from '../ControlHandle.js';

/** Central object controlling multiple Jalousie blocks at once. (generated). */
export class CentralJalousieControl extends ControlHandle {
  static readonly controlType = 'CentralJalousie';

  /** Move all controlled jalousies fully up. */
  async fullUp(): Promise<void> {
    await this.send('FullUp');
  }
  /** Move all controlled jalousies fully down. */
  async fullDown(): Promise<void> {
    await this.send('FullDown');
  }
  /** Move all controlled jalousies to the shade position. */
  async shade(): Promise<void> {
    await this.send('shade');
  }
  /** Enable automatic mode on all controlled jalousies. */
  async auto(): Promise<void> {
    await this.send('auto');
  }
  /** Disable automatic mode on all controlled jalousies. */
  async noAuto(): Promise<void> {
    await this.send('NoAuto');
  }
  /** Stop movement of all controlled jalousies. */
  async stop(): Promise<void> {
    await this.send('stop');
  }
  /** Send a command to a comma-separated subset of controlled objects. */
  async selectedControls(ids: string, command: string): Promise<void> {
    await this.send(`selectedcontrols/${encodeURIComponent(ids)}/${encodeURIComponent(command)}`);
  }
}
