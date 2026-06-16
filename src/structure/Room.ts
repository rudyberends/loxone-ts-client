import type { Control } from './Control.js';
import { RoomType, type RawRoom, type RoomTypeName } from './types.js';

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

  /**
   * The raw room function code (`0`/absent = unspecified). See {@link RoomType}
   * for the known values; use {@link typeName} for a semantic label.
   */
  get type(): number | undefined {
    return typeof this.raw?.type === 'number' ? this.raw.type : undefined;
  }

  /**
   * The room's function as a stable semantic label (per Loxone's `RoomType`
   * enum), or `undefined` when unspecified/unknown.
   */
  get typeName(): RoomTypeName | undefined {
    switch (this.type) {
      case RoomType.Bedroom:
        return 'bedroom';
      case RoomType.CommonRoom:
        return 'commonRoom';
      case RoomType.StagingArea:
        return 'stagingArea';
      case RoomType.Central:
        return 'central';
      default:
        return undefined;
    }
  }

  toString(): string {
    return this.name;
  }
}
