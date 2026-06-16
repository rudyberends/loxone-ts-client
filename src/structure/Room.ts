import type { Control } from './Control.js';
import type { RawRoom } from './types.js';

/** A room grouping controls by location. */
export class Room {
  /** Top-level controls located in this room (populated during parsing). */
  readonly controls: Control[] = [];

  constructor(
    /** Room UUID. */
    readonly uuid: string,
    /** Display name. */
    readonly name: string,
    /** The raw structure-file entry (`undefined` for the synthetic "unassigned" room). */
    readonly raw?: RawRoom,
  ) {}

  /** Icon UUID, if any. */
  get image(): string | undefined {
    return this.raw?.image;
  }

  toString(): string {
    return this.name;
  }
}
