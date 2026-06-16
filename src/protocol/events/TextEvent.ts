import { ensureReadable } from '../byteBounds.js';
import { Uuid } from '../messages/Uuid.js';
import { LoxoneEvent } from './LoxoneEvent.js';

/**
 * A text-state update.
 *
 * ```
 * typedef struct { // starts at a multiple of 4
 *   PUUID uuid;
 *   PUUID uuidIcon;            // icon UUID (used by the "Status" control)
 *   unsigned long textLength;  // 32-bit LE
 *   // text follows; padded with zero bytes to a multiple of 4
 * } PACKED EvDataText;
 * ```
 */
export class TextEvent extends LoxoneEvent {
  /** UUID of the associated icon (zero UUID when none). */
  readonly iconUuid: Uuid;
  /** The text value of the state. */
  readonly text: string;
  private readonly _byteLength: number;

  private constructor(uuid: Uuid, iconUuid: Uuid, text: string, byteLength: number) {
    super(uuid);
    this.iconUuid = iconUuid;
    this.text = text;
    this._byteLength = byteLength;
  }

  private static readonly HEADER_SIZE = Uuid.BYTE_LENGTH * 2 + 4; // 2 UUIDs + textLength

  static parse(buffer: Buffer, offset: number): TextEvent {
    ensureReadable(buffer, offset, TextEvent.HEADER_SIZE, 'text event header');
    let cursor = offset;
    const uuid = Uuid.fromBuffer(buffer, cursor);
    cursor += Uuid.BYTE_LENGTH;
    const iconUuid = Uuid.fromBuffer(buffer, cursor);
    cursor += Uuid.BYTE_LENGTH;
    const textLength = buffer.readUInt32LE(cursor);
    cursor += 4;
    // The wire value is untrusted: reject a length that runs past the buffer
    // instead of letting `toString` silently return a clamped, partial string.
    ensureReadable(buffer, cursor, textLength, 'text event payload');
    const text = buffer.toString('utf8', cursor, cursor + textLength);

    // The record is padded with zero bytes so the next record starts on a 4-byte boundary.
    const unpadded = TextEvent.HEADER_SIZE + textLength;
    const byteLength = Math.ceil(unpadded / 4) * 4;
    return new TextEvent(uuid, iconUuid, text, byteLength);
  }

  override get byteLength(): number {
    return this._byteLength;
  }

  /** The text parsed as JSON (narrowed to `T`); `undefined` if it isn't JSON. */
  json<T = unknown>(): T | undefined {
    if (!this.text) return undefined;
    try {
      return JSON.parse(this.text) as T;
    } catch {
      return undefined;
    }
  }

  override toString(): string {
    return `${this.toPath()} = ${this.text}`;
  }
}
