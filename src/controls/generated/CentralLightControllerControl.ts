import { ControlHandle } from '../ControlHandle.js';

/** Central object controlling multiple LightControllerV2 blocks at once. (generated). */
export class CentralLightControllerControl extends ControlHandle {
  static readonly controlType = 'CentralLightController';

  /** Switch all controlled light controllers on. */
  async on(): Promise<void> {
    await this.send('on');
  }
  /** Reset all controlled light controllers. */
  async reset(): Promise<void> {
    await this.send('reset');
  }
  /** Set moods per controller, format uuidLightController1:moodId1,uuidLightController2:moodId2,... */
  async setMoods(moods: string): Promise<void> {
    await this.send(`setMoods/${encodeURIComponent(moods)}`);
  }
  /** Send a command to a comma-separated subset of controlled objects. */
  async selectedControls(ids: string, command: string): Promise<void> {
    await this.send(`selectedcontrols/${encodeURIComponent(ids)}/${encodeURIComponent(command)}`);
  }
}
