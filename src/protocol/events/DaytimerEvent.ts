import { ensureReadable } from '../byteBounds.js';
import { Uuid } from '../messages/Uuid.js';
import { LoxoneEvent } from './LoxoneEvent.js';

/** A single daytimer entry. */
export interface DaytimerEntry {
  /** Mode number of this entry. */
  mode: number;
  /** Start time in minutes since midnight. */
  from: number;
  /** End time in minutes since midnight. */
  to: number;
  /** Whether the entry needs an activation trigger. */
  needActivate: number;
  /** The entry value (for analog daytimers). */
  value: number;
}

/**
 * A daytimer-state update.
 *
 * ```
 * typedef struct {
 *   PUUID uuid;
 *   double dDefValue;   // default value
 *   int nrEntries;
 *   // EvDataDaytimerEntry[nrEntries] follows (24 bytes each)
 * } PACKED EvDataDaytimer;
 * ```
 * For digital daytimers, an existing entry means "on"; absence means "off".
 */
export class DaytimerEvent extends LoxoneEvent {
  /** The default value of the daytimer. */
  readonly defaultValue: number;
  /** The active daytimer entries. */
  readonly entries: readonly DaytimerEntry[];
  private readonly _byteLength: number;

  private constructor(uuid: Uuid, defaultValue: number, entries: DaytimerEntry[], byteLength: number) {
    super(uuid);
    this.defaultValue = defaultValue;
    this.entries = entries;
    this._byteLength = byteLength;
  }

  private static readonly ENTRY_SIZE = 24;
  private static readonly HEADER_SIZE = Uuid.BYTE_LENGTH + 8 + 4; // uuid + defaultValue + nrEntries

  static parse(buffer: Buffer, offset: number): DaytimerEvent {
    ensureReadable(buffer, offset, DaytimerEvent.HEADER_SIZE, 'daytimer event header');
    let cursor = offset;
    const uuid = Uuid.fromBuffer(buffer, cursor);
    cursor += Uuid.BYTE_LENGTH;
    const defaultValue = buffer.readDoubleLE(cursor);
    cursor += 8;
    const count = buffer.readInt32LE(cursor);
    cursor += 4;
    // `count` is signed and untrusted: validate the whole entry span up front so
    // a corrupt (huge/negative) count can't trigger a big allocation or over-read.
    ensureReadable(buffer, cursor, count * DaytimerEvent.ENTRY_SIZE, 'daytimer entries');

    const entries: DaytimerEntry[] = [];
    for (let i = 0; i < count; i++) {
      entries.push({
        mode: buffer.readInt32LE(cursor),
        from: buffer.readInt32LE(cursor + 4),
        to: buffer.readInt32LE(cursor + 8),
        needActivate: buffer.readInt32LE(cursor + 12),
        value: buffer.readDoubleLE(cursor + 16),
      });
      cursor += DaytimerEvent.ENTRY_SIZE;
    }

    const byteLength = Uuid.BYTE_LENGTH + 8 + 4 + count * DaytimerEvent.ENTRY_SIZE;
    return new DaytimerEvent(uuid, defaultValue, entries, byteLength);
  }

  override get byteLength(): number {
    return this._byteLength;
  }

  override toString(): string {
    return `${this.toPath()} = daytimer(${this.entries.length} entries, default ${this.defaultValue})`;
  }
}
