import { ControlHandle } from '../ControlHandle.js';

/** Central object that controls multiple Alarm controls at once. (generated). */
export class CentralAlarmControl extends ControlHandle {
  static readonly controlType = 'CentralAlarm';

  /** Arms all referenced alarm controls. */
  async on(): Promise<void> {
    await this.send('on');
  }
  /** Disarms all referenced alarm controls. */
  async off(): Promise<void> {
    await this.send('off');
  }
  /** Acknowledge (quit) the alarm on all referenced controls. */
  async quit(): Promise<void> {
    await this.send('quit');
  }
  /** Delayed-arms all referenced alarm controls. */
  async delayedOn(): Promise<void> {
    await this.send('delayedon');
  }
  /** Selectively controls specific objects by comma-separated ids; command is one of on, off, quit, delayedon. */
  async selectedControls(ids: string, command: string): Promise<void> {
    await this.send(`selectedcontrols/${encodeURIComponent(ids)}/${encodeURIComponent(command)}`);
  }
}
