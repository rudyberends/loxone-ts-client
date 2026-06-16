import { ControlHandle } from '../ControlHandle.js';

/** Central object controlling multiple Gate blocks at once. (generated). */
export class CentralGateControl extends ControlHandle {
  static readonly controlType = 'CentralGate';

  /** Open all controlled gates. */
  async open(): Promise<void> {
    await this.send('open');
  }
  /** Close all controlled gates. */
  async close(): Promise<void> {
    await this.send('close');
  }
  /** Stop movement of all controlled gates. */
  async stop(): Promise<void> {
    await this.send('stop');
  }
  /** Send a command to a comma-separated subset of controlled objects. */
  async selectedControls(ids: string, command: string): Promise<void> {
    await this.send(`selectedcontrols/${encodeURIComponent(ids)}/${encodeURIComponent(command)}`);
  }
}
