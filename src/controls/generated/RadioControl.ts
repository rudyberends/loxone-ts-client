import { clamp, ControlHandle } from '../ControlHandle.js';

/** Radio buttons control selecting one of up to 16 mutually exclusive outputs. (generated). */
export class RadioControl extends ControlHandle {
  static readonly controlType = 'Radio';

  /** Deselect the currently selected output, setting activeOutput to 0. */
  async reset(): Promise<void> {
    await this.send('reset');
  }
  /** Activate the output with the given ID (1 for the first output). */
  async select(id: number): Promise<void> {
    await this.send(`${clamp(id, 1, 16)}`);
  }
  /** Select the next output (respects the Sk0 parameter). */
  async next(): Promise<void> {
    await this.send('next');
  }
  /** Select the previous output (respects the Sk0 parameter). */
  async prev(): Promise<void> {
    await this.send('prev');
  }
  /** ID of the currently active output; 0 means none selected (All Off). */
  get activeOutput(): number | undefined {
    return this.numeric('activeOutput');
  }
}
