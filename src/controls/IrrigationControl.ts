import { IrrigationControl as GeneratedIrrigationControl } from './generated/IrrigationControl.js';

/** A single irrigation zone as listed in the `zones` state. */
export interface IrrigationZone {
  id: number;
  name: string;
  /** Configured run duration in seconds, when present. */
  duration?: number;
  [key: string]: unknown;
}

/**
 * An `Irrigation` control — the generated wrapper plus a typed {@link zoneList}
 * accessor that parses the `zones` JSON state into structured zones (the
 * generated `zones` getter returns the raw string, `zonesJson()` the untyped JSON).
 */
export class IrrigationControl extends GeneratedIrrigationControl {
  /** The configured zones, parsed from the `zones` JSON state. */
  get zoneList(): IrrigationZone[] | undefined {
    const zones = this.zonesJson<IrrigationZone[]>();
    return Array.isArray(zones) ? zones : undefined;
  }
}
