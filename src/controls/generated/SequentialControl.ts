import { ControlHandle } from '../ControlHandle.js';

/** Sequential controller that triggers configured sequences. (generated). */
export class SequentialControl extends ControlHandle {
  static readonly controlType = 'Sequential';

  /** Activates the sequence with the given id; id 0 stops any currently active sequence. */
  async triggerSequence(sequenceId: number): Promise<void> {
    await this.send(`triggerSequence/${Math.round(sequenceId)}`);
  }
  /** Id of the currently active sequence; 0 = no sequence active. */
  get activeSequence(): number | undefined {
    return this.numeric('activeSequence');
  }
}
