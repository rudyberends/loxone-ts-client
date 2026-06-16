import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';
import { clamp, ControlHandle } from '../ControlHandle.js';

const keyPadAuthTypeLabelMap: Readonly<Record<number, '2FA' | 'Code or Nfc' | 'Nfc' | 'Code' | 'OCPP'>> = { [0]: '2FA', [1]: 'Code or Nfc', [2]: 'Nfc', [3]: 'Code', [4]: 'OCPP' };

/** NFC Code Touch keypad managing access outputs, codes, history and NFC tag learning. (generated). */
export class NfcCodeTouchControl extends ControlHandle {
  static readonly controlType = 'NfcCodeTouch';

  /** Send an impulse to the specific output (1-6). */
  async output(outputNr: number): Promise<void> {
    await this.send(`output/${clamp(outputNr, 1, 6)}`);
  }
  /** Return a JSON array with history entry objects. */
  async history(): Promise<void> {
    await this.send('history');
  }
  /** Return a JSON array with code objects from this keypad. */
  async codes(): Promise<void> {
    await this.send('codes');
  }
  /** Create a new code with the given properties (type 0-2). */
  async codeCreate(name: string, code: string, type: number, outputs: number, standardOutput: number): Promise<void> {
    await this.send(`code/create/${encodeURIComponent(name)}/${encodeURIComponent(code)}/${clamp(type, 0, 2)}/${Math.round(outputs)}/${clamp(standardOutput, 1, 6)}`);
  }
  /** Create a new time-dependent code (type 2) with from/to UTC timestamps. */
  async codeCreateTimed(name: string, code: string, type: number, outputs: number, standardOutput: number, timeFrom: number, timeTo: number): Promise<void> {
    await this.send(`code/create/${encodeURIComponent(name)}/${encodeURIComponent(code)}/${clamp(type, 0, 2)}/${Math.round(outputs)}/${clamp(standardOutput, 1, 6)}/${Math.round(timeFrom)}/${Math.round(timeTo)}`);
  }
  /** Update the code identified by uuid with the given properties. */
  async codeUpdate(uuid: string, isActive: string, name: string, code: string, type: number, outputs: number, standardOutput: number): Promise<void> {
    await this.send(`code/update/${encodeURIComponent(uuid)}/${encodeURIComponent(isActive)}/${encodeURIComponent(name)}/${encodeURIComponent(code)}/${clamp(type, 0, 2)}/${Math.round(outputs)}/${clamp(standardOutput, 1, 6)}`);
  }
  /** Update the code identified by uuid including from/to UTC timestamps. */
  async codeUpdateTimed(uuid: string, isActive: string, name: string, code: string, type: number, outputs: number, standardOutput: number, timeFrom: number, timeTo: number): Promise<void> {
    await this.send(`code/update/${encodeURIComponent(uuid)}/${encodeURIComponent(isActive)}/${encodeURIComponent(name)}/${encodeURIComponent(code)}/${clamp(type, 0, 2)}/${Math.round(outputs)}/${clamp(standardOutput, 1, 6)}/${Math.round(timeFrom)}/${Math.round(timeTo)}`);
  }
  /** Activate the code identified by uuid. */
  async codeActivate(uuid: string): Promise<void> {
    await this.send(`code/activate/${encodeURIComponent(uuid)}`);
  }
  /** Deactivate the code identified by uuid. */
  async codeDeactivate(uuid: string): Promise<void> {
    await this.send(`code/deactivate/${encodeURIComponent(uuid)}`);
  }
  /** Delete the code identified by uuid. */
  async codeDelete(uuid: string): Promise<void> {
    await this.send(`code/delete/${encodeURIComponent(uuid)}`);
  }
  /** Start an NFC learn session (returns 423 if device cannot execute). */
  async nfcStartLearn(): Promise<void> {
    await this.send('nfc/startlearn');
  }
  /** Stop an NFC learn session. */
  async nfcStopLearn(): Promise<void> {
    await this.send('nfc/stoplearn');
  }
  /** Unix timestamp (ms) of the latest history entry, 0 if no history. */
  get historyDate(): number | undefined {
    return this.numeric('historyDate');
  }
  /** Unix timestamp (ms) of the latest history entry, 0 if no history. (as a Date). */
  get historyDateValue(): Date | undefined {
    const v = this.numeric('historyDate');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** Unix timestamp (ms) of the latest change of some code. */
  get codeDate(): number | undefined {
    return this.numeric('codeDate');
  }
  /** Unix timestamp (ms) of the latest change of some code. (as a Date). */
  get codeDateValue(): Date | undefined {
    const v = this.numeric('codeDate');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** Bitmap of device capability/state (bit0 offline, bit1 dummy, bit2 nfc unavailable). */
  get deviceState(): number | undefined {
    return this.numeric('deviceState');
  }
  /** JSON array of learned NFC tag objects. */
  get nfcLearnResult(): string | undefined {
    return this.text('nfcLearnResult');
  }
  /** JSON array of learned NFC tag objects (parsed JSON). */
  nfcLearnResultJson<T = unknown>(): T | undefined {
    return this.control.getState('nfcLearnResult')?.json<T>();
  }
  /** Authentication type (0 = 2FA, 1 = Code or Nfc, 2 = Nfc, 3 = Code, 4 = OCPP). */
  get keyPadAuthType(): number | undefined {
    return this.numeric('keyPadAuthType');
  }
  /** Authentication type (decoded label). */
  get keyPadAuthTypeLabel(): ('2FA' | 'Code or Nfc' | 'Nfc' | 'Code' | 'OCPP') | undefined {
    const v = this.numeric('keyPadAuthType');
    return v === undefined ? undefined : keyPadAuthTypeLabelMap[v];
  }
}
