import { ControlHandle } from '../ControlHandle.js';

/** Legacy lighting controller managing numbered light scenes. (generated). */
export class LightControllerControl extends ControlHandle {
  static readonly controlType = 'LightController';

  /** Enables lightscene 0 (All off). */
  async off(): Promise<void> {
    await this.send('off');
  }
  /** Enables lightscene 9 (All on). */
  async on(): Promise<void> {
    await this.send('on');
  }
  /** Activates the given scene. */
  async activateScene(sceneNumber: number): Promise<void> {
    await this.send(`${Math.round(sceneNumber)}`);
  }
  /** Learns current output values to the scene, overriding/creating/renaming it. */
  async learnScene(sceneNumber: number, sceneName: string): Promise<void> {
    await this.send(`${Math.round(sceneNumber)}/learn/${encodeURIComponent(sceneName)}`);
  }
  /** Deletes the given scene. */
  async deleteScene(sceneNumber: number): Promise<void> {
    await this.send(`${Math.round(sceneNumber)}/delete`);
  }
  /** Changes to the next scene. */
  async plus(): Promise<void> {
    await this.send('plus');
  }
  /** Changes to the previous scene. */
  async minus(): Promise<void> {
    await this.send('minus');
  }
  /** The current active scene number. */
  get activeScene(): number | undefined {
    return this.numeric('activeScene');
  }
  /** JSON object listing available scenes (uuid, uuidIcon, text array). */
  get sceneList(): string | undefined {
    return this.text('sceneList');
  }
  /** JSON object listing available scenes (parsed JSON). */
  sceneListJson<T = unknown>(): T | undefined {
    return this.control.getState('sceneList')?.json<T>();
  }
}
