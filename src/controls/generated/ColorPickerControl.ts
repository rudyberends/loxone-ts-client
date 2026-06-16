import { clamp, ControlHandle } from '../ControlHandle.js';

/** Color picker subcontrol of a LightController for RGB (HSV) or Lumitech colors. (generated). */
export class ColorPickerControl extends ControlHandle {
  static readonly controlType = 'ColorPicker';

  /** Enables the ColorPicker. */
  async on(): Promise<void> {
    await this.send('on');
  }
  /** Disables the ColorPicker. */
  async off(): Promise<void> {
    await this.send('off');
  }
  /** Sets a new HSV color. */
  async hsv(hue: number, saturation: number, value: number): Promise<void> {
    await this.send(`hsv(${clamp(hue, 0, 360)},${clamp(saturation, 0, 100)},${clamp(value, 0, 100)})`);
  }
  /** Sets a new color temperature (Lumitech pickers only). */
  async lumitech(brightness: number, kelvin: number): Promise<void> {
    await this.send(`lumitech(${clamp(brightness, 0, 100)},${Math.round(kelvin)})`);
  }
  /** Stores a favorite (index 1-4) as an HSV or Lumitech color string. */
  async setFavorite(favIndex: number, color: string): Promise<void> {
    await this.send(`setfav/${clamp(favIndex, 1, 4)}/${encodeURIComponent(color)}`);
  }
  /** Current color string, e.g. hsv(0,100,100) or lumitech(100,4483). */
  get color(): string | undefined {
    return this.text('color');
  }
  /** Array of favorite hsv or lumitech colors. */
  get favorites(): string | undefined {
    return this.text('favorites');
  }
  /** Array of favorite hsv or lumitech colors (parsed JSON). */
  favoritesJson<T = unknown>(): T | undefined {
    return this.control.getState('favorites')?.json<T>();
  }
}
