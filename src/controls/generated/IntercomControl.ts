import { ControlHandle } from '../ControlHandle.js';

/** Door Controller intercom with bell state and bell-event history. (generated). */
export class IntercomControl extends ControlHandle {
  static readonly controlType = 'Intercom';

  /** Answer the call, deactivating the bell. */
  async answer(): Promise<void> {
    await this.send('answer');
  }
  /** Whether the bell is ringing (0 = not ringing, 1 = ringing). */
  get bell(): boolean | undefined {
    return this.boolean('bell');
  }
  /** Pipe-separated YYYYMMDDHHMMSS timestamps of unanswered bell activity. */
  get lastBellEvents(): string | undefined {
    return this.text('lastBellEvents');
  }
  /** Loxone Intercoms only - currently installed firmware versions. */
  get version(): string | undefined {
    return this.text('version');
  }
  /** Timestamp (YYYYMMDDHHMMSS) when ringing started. */
  get lastBellTimestamp(): string | undefined {
    return this.text('lastBellTimestamp');
  }
}
