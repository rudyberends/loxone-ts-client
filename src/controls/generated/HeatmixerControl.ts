import { ControlHandle } from '../ControlHandle.js';

/** Mixing valve controller reporting target and actual temperatures of the mixing circuit. (generated). */
export class HeatmixerControl extends ControlHandle {
  static readonly controlType = 'Heatmixer';

  /** Temperature the controller currently aims for. */
  get tempTarget(): number | undefined {
    return this.numeric('tempTarget');
  }
  /** Actual temperature reported by the sensor attached to the input. */
  get tempActual(): number | undefined {
    return this.numeric('tempActual');
  }
}
