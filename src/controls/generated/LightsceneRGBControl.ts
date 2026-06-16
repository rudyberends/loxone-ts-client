import { ControlHandle } from '../ControlHandle.js';

/** RGB lighting controller exposing color scenes. (generated). */
export class LightsceneRGBControl extends ControlHandle {
  static readonly controlType = 'LightsceneRGB';

  /** Enable lightscene 0 (All off). */
  async off(): Promise<void> {
    await this.send('off');
  }
  /** All on. */
  async on(): Promise<void> {
    await this.send('on');
  }
  /** Activate the given scene. */
  async activateScene(sceneNumber: number): Promise<void> {
    await this.send(`${Math.round(sceneNumber)}`);
  }
  /** Override the selected scene with the new selected color (does not create a new scene). */
  async learnScene(sceneNumber: number): Promise<void> {
    await this.send(`${Math.round(sceneNumber)}/learn`);
  }
  /** The current active scene number. */
  get activeScene(): number | undefined {
    return this.numeric('activeScene');
  }
  /** The current color as a string, e.g. hsv(0, 100, 100). */
  get color(): string | undefined {
    return this.text('color');
  }
}
