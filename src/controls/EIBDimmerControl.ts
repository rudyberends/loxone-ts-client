import { DimmerControl } from './DimmerControl.js';

/**
 * An `EIBDimmer` (KNX/EIB dimmer). Behaves identically to a {@link DimmerControl}
 * — same `position`/`min`/`max`/`step` states and `on`/`off`/`{position}`
 * commands — so it simply reuses that wrapper under its own control type.
 */
export class EIBDimmerControl extends DimmerControl {
  static override readonly controlType = 'EIBDimmer';
}
