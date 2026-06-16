import { clamp, ControlHandle } from '../ControlHandle.js';

/** Loxone Music Server zone (Gen. 2) playback, volume and presence control. (generated). */
export class AudioZoneV2Control extends ControlHandle {
  static readonly controlType = 'AudioZoneV2';

  /** Increase the volume by one step. */
  async volUp(): Promise<void> {
    await this.send('volUp');
  }
  /** Decrease the volume by one step. */
  async volDown(): Promise<void> {
    await this.send('volDown');
  }
  /** Set the zone volume. */
  async setVolume(value: number): Promise<void> {
    await this.send(`volume/${clamp(value, 0, 100)}`);
  }
  /** Speak the given text via text-to-speech. */
  async tts(text: string): Promise<void> {
    await this.send(`tts/${encodeURIComponent(text)}`);
  }
  /** Play the zone favorite with the given id. */
  async playZoneFav(id: number): Promise<void> {
    await this.send(`playZoneFav/${Math.round(id)}`);
  }
  /** Skip to the previous track. */
  async prev(): Promise<void> {
    await this.send('prev');
  }
  /** Skip to the next track. */
  async next(): Promise<void> {
    await this.send('next');
  }
  /** Start playback, turning the client on if needed. */
  async play(): Promise<void> {
    await this.send('play');
  }
  /** Pause playback. */
  async pause(): Promise<void> {
    await this.send('Pause');
  }
  /** Enable (1) or disable (0) bluetooth; errors if set by logic. */
  async bluetooth(enabled: boolean): Promise<void> {
    await this.send(`bluetooth/${enabled ? 1 : 0}`);
  }
  /** Reset all bluetooth pairings. */
  async resetBluetoothPairings(): Promise<void> {
    await this.send('resetbluetoothpairings');
  }
  /** Enable or disable presence functionality (on/off). */
  async presence(state: string): Promise<void> {
    await this.send(`presence/${encodeURIComponent(state)}`);
  }
  /** Music Server state (-5 rebooting, -2 unreachable, -1 unknown, 0 offline, 1 initializing, 2 online). */
  get serverState(): number | undefined {
    return this.numeric('serverState');
  }
  /** Playback state (-1 unknown, 0 stopped, 1 paused, 2 playing). */
  get playState(): number | undefined {
    return this.numeric('playState');
  }
  /** Client state (-5 rebooting, -4 updating, -2 unreachable, 0 offline, 1 initializing, 2 online). */
  get clientState(): number | undefined {
    return this.numeric('clientState');
  }
  /** Whether the client power is active. */
  get power(): boolean | undefined {
    return this.boolean('power');
  }
  /** Size of a single volume step. */
  get volumeStep(): number | undefined {
    return this.numeric('volumeStep');
  }
  /** Current default volume. */
  get defaultVolume(): number | undefined {
    return this.numeric('defaultVolume');
  }
  /** Current volume. */
  get volume(): number | undefined {
    return this.numeric('volume');
  }
  /** Current volume for Alarm events. */
  get alarmVolume(): number | undefined {
    return this.numeric('alarmVolume');
  }
  /** Current volume for Bell events. */
  get bellVolume(): number | undefined {
    return this.numeric('bellVolume');
  }
  /** Current volume for Buzzer events. */
  get buzzerVolume(): number | undefined {
    return this.numeric('buzzerVolume');
  }
  /** Current volume for TTS events. */
  get ttsVolume(): number | undefined {
    return this.numeric('ttsVolume');
  }
  /** Current maximum volume. */
  get maxVolume(): number | undefined {
    return this.numeric('maxVolume');
  }
  /** Presence simulation start time. */
  get presenceFrom(): number | undefined {
    return this.numeric('presenceFrom');
  }
  /** Presence simulation end time. */
  get presenceTo(): number | undefined {
    return this.numeric('presenceTo');
  }
  /** Status of the reset input. */
  get isLocked(): boolean | undefined {
    return this.boolean('isLocked');
  }
  /** Whether the bluetooth parameter is on/off. */
  get bluetoothValue(): boolean | undefined {
    return this.boolean('bluetooth');
  }
}
