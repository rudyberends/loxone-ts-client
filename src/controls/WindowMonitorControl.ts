import { WindowMonitorControl as GeneratedWindowMonitorControl } from './generated/WindowMonitorControl.js';

/** A single window/door monitored by a WindowMonitor, with its status decoded. */
export interface MonitoredWindow {
  /** Position in the monitor (matches the `windowStates` order and `details.windows`). */
  index: number;
  /** Display name from the structure file, when available. */
  name: string | undefined;
  /** Raw bitmask value for this window. */
  raw: number;
  closed: boolean;
  tilted: boolean;
  open: boolean;
  locked: boolean;
  unlocked: boolean;
}

const WINDOW_BITS = { closed: 1, tilted: 2, open: 4, locked: 8, unlocked: 16 } as const;

/**
 * A `WindowMonitor` block — the generated wrapper plus decoded views over its
 * monitored windows/doors. A WindowMonitor aggregates many windows into one
 * control; {@link windowStatuses} splits the `windowStates` bitmask string into a
 * structured per-window status so consumers don't reimplement the bit decoding.
 */
export class WindowMonitorControl extends GeneratedWindowMonitorControl {
  /** Names of the monitored windows/doors, in index order, from `details.windows`. */
  get windows(): string[] | undefined {
    const windows = this.control.details['windows'];
    if (!windows || typeof windows !== 'object') return undefined;
    const list = (Array.isArray(windows) ? windows : Object.values(windows)) as unknown[];
    return list.map((w) =>
      w && typeof w === 'object' && typeof (w as { name?: unknown }).name === 'string'
        ? (w as { name: string }).name
        : '',
    );
  }

  /**
   * Decoded status of each monitored window/door, parsed from the `windowStates`
   * bitmask string (1=closed, 2=tilted, 4=open, 8=locked, 16=unlocked).
   */
  get windowStatuses(): MonitoredWindow[] | undefined {
    const raw = this.windowStates;
    if (raw === undefined) return undefined;
    const names = this.windows;
    return raw.split(',').map((entry, index) => {
      const value = Number(entry.trim());
      const bits = Number.isNaN(value) ? 0 : value;
      return {
        index,
        name: names?.[index] || undefined,
        raw: bits,
        closed: (bits & WINDOW_BITS.closed) !== 0,
        tilted: (bits & WINDOW_BITS.tilted) !== 0,
        open: (bits & WINDOW_BITS.open) !== 0,
        locked: (bits & WINDOW_BITS.locked) !== 0,
        unlocked: (bits & WINDOW_BITS.unlocked) !== 0,
      };
    });
  }
}
