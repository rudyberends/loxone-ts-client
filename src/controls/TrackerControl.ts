import { ControlHandle } from './ControlHandle.js';

/** A single parsed Tracker log entry. */
export interface TrackerEntry {
  /** The leading timestamp as the Miniserver sent it (`"YYYY-MM-DD HH:MM:SS"`, local wall-clock), if present. */
  timestamp: string | undefined;
  /** The entry text, with internal line breaks collapsed to spaces. */
  message: string;
  /** The individual lines of the entry (the timestamp prefix removed from the first). */
  lines: string[];
}

const TIMESTAMP = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s*([\s\S]*)$/;

/**
 * Parses a Tracker `entries` string into structured entries.
 *
 * Per the spec, entries are separated by `"|"` and a `\x14` byte marks a new line
 * within an entry. Each entry usually starts with a `YYYY-MM-DD HH:MM:SS` timestamp.
 */
export function parseTrackerEntries(text: string | undefined): TrackerEntry[] {
  if (!text) return [];
  return text
    .split('|')
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const rawLines = entry.split('\x14');
      const match = TIMESTAMP.exec(rawLines[0] ?? '');
      const firstLine = match ? match[2]! : (rawLines[0] ?? '');
      const lines = [firstLine, ...rawLines.slice(1)].map((l) => l.trim()).filter((l) => l.length > 0);
      return { timestamp: match ? match[1] : undefined, message: lines.join(' '), lines };
    });
}

/**
 * A `Tracker` control (event log). Its `entries` text state is a `|`-separated,
 * `\x14`-newline log — exposed here already parsed into {@link TrackerEntry}s.
 */
export class TrackerControl extends ControlHandle {
  static readonly controlType = 'Tracker';

  /** The parsed log entries (most recent typically last). */
  get entries(): TrackerEntry[] {
    return parseTrackerEntries(this.control.getState('entries')?.textValue);
  }

  /** The raw, unparsed `entries` string. */
  get raw(): string | undefined {
    return this.control.getState('entries')?.textValue;
  }
}
