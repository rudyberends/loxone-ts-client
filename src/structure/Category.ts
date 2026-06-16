import type { Control } from './Control.js';
import type { RawCategory } from './types.js';

/** A category grouping controls logically (e.g. lights, shading, media). */
export class Category {
  /** Top-level controls in this category (populated during parsing). */
  readonly controls: Control[] = [];

  constructor(
    /** Category UUID. */
    readonly uuid: string,
    /** Display name. */
    readonly name: string,
    /** The raw structure-file entry. */
    readonly raw?: RawCategory,
  ) {}

  /** Semantic type, e.g. `lights`, `shading`, `media`, `indoortemperature`. */
  get type(): string | undefined {
    return this.raw?.type;
  }

  toString(): string {
    return this.name;
  }
}
