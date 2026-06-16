import { ControlHandle } from '../ControlHandle.js';

const deviceStateLabelMap: Readonly<Record<number, 'unknown' | 'ok' | 'rebooting' | 'initializing'>> = { [0]: 'unknown', [1]: 'ok', [2]: 'rebooting', [3]: 'initializing' };

/** Intercom v2 with bell state, answers, mute and video settings control. (generated). */
export class IntercomV2Control extends ControlHandle {
  static readonly controlType = 'IntercomV2';

  /** Answer the call, deactivating the bell. */
  async answer(): Promise<void> {
    await this.send('answer');
  }
  /** Play the answer at the given index. */
  async playTts(idx: number): Promise<void> {
    await this.send(`playTts/${Math.round(idx)}`);
  }
  /** Mute (1) or unmute (0) the Control Block. */
  async mute(value: boolean): Promise<void> {
    await this.send(`mute/${value ? 1 : 0}`);
  }
  /** Set internal and external framerate and resolution at once. */
  async setAllVideoSettings(framerateInternal: number, resolutionInternal: number, framerateExternal: number, resolutionExternal: number): Promise<void> {
    await this.send(`setallvideosettings/${Math.round(framerateInternal)}/${Math.round(resolutionInternal)}/${Math.round(framerateExternal)}/${Math.round(resolutionExternal)}`);
  }
  /** Set framerate and resolution for the internal (1) or external (0) stream. */
  async setVideoSettings(internal: boolean, framerate: number, resolution: number): Promise<void> {
    await this.send(`setvideosettings/${internal ? 1 : 0}/${Math.round(framerate)}/${Math.round(resolution)}`);
  }
  /** Set framerate for the internal (1) or external (0) stream. */
  async setFramerate(internal: boolean, framerate: number): Promise<void> {
    await this.send(`setframerate/${internal ? 1 : 0}/${Math.round(framerate)}`);
  }
  /** Set resolution for the internal (1) or external (0) stream. */
  async setResolution(internal: boolean, resolution: number): Promise<void> {
    await this.send(`setresolution/${internal ? 1 : 0}/${Math.round(resolution)}`);
  }
  /** Set the number of bell images to store. */
  async setNumberBellImages(numberBellImages: number): Promise<void> {
    await this.send(`setnumberbellimages/${Math.round(numberBellImages)}`);
  }
  /** Get the number of bell images stored. */
  async getNumberBellImages(): Promise<void> {
    await this.send('getnumberbellimages');
  }
  /** Whether the bell is ringing (0 = not ringing, 1 = ringing). */
  get bell(): boolean | undefined {
    return this.boolean('bell');
  }
  /** The resolved IP address of the device. */
  get address(): string | undefined {
    return this.text('address');
  }
  /** Array of answers. */
  get answers(): string | undefined {
    return this.text('answers');
  }
  /** Array of answers (parsed JSON). */
  answersJson<T = unknown>(): T | undefined {
    return this.control.getState('answers')?.json<T>();
  }
  /** Whether the Control Block is muted (Qb output). */
  get muted(): boolean | undefined {
    return this.boolean('muted');
  }
  /** Device state (0 = unknown, 1 = ok, 2 = rebooting, 3 = initializing). */
  get deviceState(): number | undefined {
    return this.numeric('deviceState');
  }
  /** Device state (decoded label). */
  get deviceStateLabel(): ('unknown' | 'ok' | 'rebooting' | 'initializing') | undefined {
    const v = this.numeric('deviceState');
    return v === undefined ? undefined : deviceStateLabelMap[v];
  }
  /** Internal video settings: 4-byte value, bytes 0-1 framerate, bytes 2-3 resolution. */
  get videoSettingsIntern(): number | undefined {
    return this.numeric('videoSettingsIntern');
  }
  /** External video settings: 4-byte value, bytes 0-1 framerate, bytes 2-3 resolution. */
  get videoSettingsExtern(): number | undefined {
    return this.numeric('videoSettingsExtern');
  }
}
