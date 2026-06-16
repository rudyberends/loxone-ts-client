import { ensureReadable } from '../byteBounds.js';
import { Uuid } from '../messages/Uuid.js';
import { LoxoneEvent } from './LoxoneEvent.js';

/**
 * A value-state update: a UUID paired with a single 64-bit float. Always 24 bytes.
 *
 * ```
 * typedef struct { PUUID uuid; double dVal; } PACKED EvData;
 * ```
 */
export class ValueEvent extends LoxoneEvent {
  /** The numeric value of the state. */
  readonly value: number;

  private constructor(uuid: Uuid, value: number) {
    super(uuid);
    this.value = value;
  }

  static parse(buffer: Buffer, offset: number): ValueEvent {
    ensureReadable(buffer, offset, Uuid.BYTE_LENGTH + 8, 'value event');
    const uuid = Uuid.fromBuffer(buffer, offset);
    const value = buffer.readDoubleLE(offset + Uuid.BYTE_LENGTH);
    return new ValueEvent(uuid, value);
  }

  override get byteLength(): number {
    return Uuid.BYTE_LENGTH + 8; // 24
  }

  /** The value interpreted as a boolean (`!= 0`); for digital states. */
  get booleanValue(): boolean {
    return this.value !== 0;
  }

  /**
   * The value formatted with the owning control's display format (e.g. `"21.3°C"`),
   * when the structure is parsed and value-tracking is on; otherwise `undefined`.
   */
  get formatted(): string | undefined {
    return this.state?.formatted;
  }

  override toString(): string {
    return `${this.toPath()} = ${this.value}`;
  }
}
