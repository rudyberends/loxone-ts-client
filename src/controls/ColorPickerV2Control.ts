import { clamp, ControlHandle } from './ControlHandle.js';

/** A parsed color from a ColorPicker state. */
export type LoxoneColor =
  | { kind: 'hsv'; hue: number; saturation: number; brightness: number }
  | { kind: 'temp'; brightness: number; kelvin: number }
  | { kind: 'raw'; value: string };

/**
 * A `ColorPickerV2` control (RGB / tunable-white lighting).
 * State: `color` (text, e.g. `"hsv(0,100,100)"` or `"temp(100,4483)"`).
 * Commands: `hsv(h,s,v)`, `temp(brightness,kelvin)`, `daylight(brightness)`, `setBrightness/{v}`.
 */
export class ColorPickerV2Control extends ControlHandle {
  static readonly controlType = 'ColorPickerV2';

  /** Sets an RGB colour: hue 0–360, saturation 0–100, brightness/value 0–100. */
  async setRgb(hue: number, saturation: number, brightness: number): Promise<void> {
    await this.send(`hsv(${Math.round(hue)},${clamp(saturation, 0, 100)},${clamp(brightness, 0, 100)})`);
  }

  /** Sets a tunable-white colour: brightness 0–100, colour temperature in Kelvin. */
  async setTemperature(brightness: number, kelvin: number): Promise<void> {
    await this.send(`temp(${clamp(brightness, 0, 100)},${Math.round(kelvin)})`);
  }

  /** Sets the daylight-following brightness 0–100. */
  async setDaylight(brightness: number): Promise<void> {
    await this.send(`daylight(${clamp(brightness, 0, 100)})`);
  }

  /** Updates only the brightness 0–100. */
  async setBrightness(brightness: number): Promise<void> {
    await this.send(`setBrightness/${clamp(brightness, 0, 100)}`);
  }

  /** The raw color state string (e.g. `"hsv(0,100,100)"`). */
  get raw(): string | undefined {
    return this.text('color');
  }

  /** The current colour parsed into HSV / temperature / raw. */
  get color(): LoxoneColor | undefined {
    return parseColor(this.raw);
  }
}

function parseColor(value: string | undefined): LoxoneColor | undefined {
  if (!value) return undefined;
  const hsv = /^hsv\((\d+),(\d+),(\d+)\)$/.exec(value);
  if (hsv) return { kind: 'hsv', hue: +hsv[1]!, saturation: +hsv[2]!, brightness: +hsv[3]! };
  const temp = /^temp\((\d+),(\d+)\)$/.exec(value);
  if (temp) return { kind: 'temp', brightness: +temp[1]!, kelvin: +temp[2]! };
  return { kind: 'raw', value };
}
