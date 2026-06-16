import { ControlHandle } from '../ControlHandle.js';

/** Virtual text input that holds and updates a text value. (generated). */
export class TextInputControl extends ControlHandle {
  static readonly controlType = 'TextInput';

  /** Set the new value of the text input. */
  async setText(text: string): Promise<void> {
    await this.send(`${encodeURIComponent(text)}`);
  }
  /** TextEvent with the current text. */
  get textValue(): string | undefined {
    return this.text('text');
  }
}
