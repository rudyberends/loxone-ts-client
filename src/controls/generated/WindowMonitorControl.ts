import { ControlHandle } from '../ControlHandle.js';

/** A window and door monitor block that reports the open/closed/tilted/locked status of monitored windows and doors. (generated). */
export class WindowMonitorControl extends ControlHandle {
  static readonly controlType = 'WindowMonitor';

  /** Comma-separated string of bitmask values per monitored window/door (1=closed, 2=tilted, 4=open, 8=locked, 16=unlocked); position matches the windows array in details. */
  get windowStates(): string | undefined {
    return this.text('windowStates');
  }
  /** Comma-separated string of bitmask values per monitored window/door (parsed JSON). */
  windowStatesJson<T = unknown>(): T | undefined {
    return this.control.getState('windowStates')?.json<T>();
  }
  /** Number of monitored windows and doors that are open. */
  get numOpen(): number | undefined {
    return this.numeric('numOpen');
  }
  /** Number of monitored windows and doors that are closed. */
  get numClosed(): number | undefined {
    return this.numeric('numClosed');
  }
  /** Number of monitored windows and doors that are tilted. */
  get numTilted(): number | undefined {
    return this.numeric('numTilted');
  }
  /** Number of monitored windows and doors that are offline. */
  get numOffline(): number | undefined {
    return this.numeric('numOffline');
  }
  /** Number of monitored windows and doors that are locked. */
  get numLocked(): number | undefined {
    return this.numeric('numLocked');
  }
  /** Number of monitored windows and doors that are unlocked. */
  get numUnlocked(): number | undefined {
    return this.numeric('numUnlocked');
  }
}
