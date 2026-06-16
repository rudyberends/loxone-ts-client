import { ControlHandle } from '../ControlHandle.js';

/** Central object for collectively controlling multiple audio zones. (generated). */
export class CentralAudioZoneControl extends ControlHandle {
  static readonly controlType = 'CentralAudioZone';

  /** Start playback on the controlled audio zones. */
  async play(): Promise<void> {
    await this.send('play');
  }
  /** Pause playback on the controlled audio zones. */
  async pause(): Promise<void> {
    await this.send('pause');
  }
  /** Increase the volume on the controlled audio zones. */
  async volUp(): Promise<void> {
    await this.send('volup');
  }
  /** Decrease the volume on the controlled audio zones. */
  async volDown(): Promise<void> {
    await this.send('voldown');
  }
}
