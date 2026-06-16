import { clamp, ControlHandle } from '../ControlHandle.js';

/** Loxone Music Server zone (Gen. 1) playback and volume control. (generated). */
export class AudioZoneControl extends ControlHandle {
  static readonly controlType = 'AudioZone';

  /** Set the zone volume. */
  async setVolume(newVolume: number): Promise<void> {
    await this.send(`volume/${clamp(newVolume, 0, 100)}`);
  }
  /** Increase or decrease the current volume by a step (e.g. 3 or -3). */
  async volumeStep(step: number): Promise<void> {
    await this.send(`volstep/${Math.round(step)}`);
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
    await this.send('pause');
  }
  /** Seek to a position in the current track (seconds). */
  async setProgress(seconds: number): Promise<void> {
    await this.send(`progress/${Math.round(seconds)}`);
  }
  /** Toggle the shuffle state on/off. */
  async shuffle(): Promise<void> {
    await this.send('shuffle');
  }
  /** Set repeat mode (0 = off, 1 = repeat list, 3 = repeat track). */
  async setRepeat(repeatState: number): Promise<void> {
    await this.send(`repeat/${Math.round(repeatState)}`);
  }
  /** Turn the client on and start playing right away. */
  async on(): Promise<void> {
    await this.send('on');
  }
  /** Turn the client off. */
  async off(): Promise<void> {
    await this.send('off');
  }
  /** Wake the Music Server from standby. */
  async serverPowerOn(): Promise<void> {
    await this.send('svpower/on');
  }
  /** Send the Music Server into standby. */
  async serverPowerOff(): Promise<void> {
    await this.send('svpower/off');
  }
  /** Play the corresponding zone-favorite (1-8). */
  async source(sourceNumber: number): Promise<void> {
    await this.send(`source/${clamp(sourceNumber, 1, 8)}`);
  }
  /** Enable (1) or disable (0) Spotify Connect on the Musicserver. */
  async enableSpotifyConnect(enabled: boolean): Promise<void> {
    await this.send(`enablespotifyconnect/${enabled ? 1 : 0}`);
  }
  /** Enable (1) or disable (0) AirPlay on the Musicserver. */
  async enableAirPlay(enabled: boolean): Promise<void> {
    await this.send(`enableairplay/${enabled ? 1 : 0}`);
  }
  /** Set the minimum volume for Alarm events. */
  async setAlarmVolume(volume: number): Promise<void> {
    await this.send(`alarmvolume/${clamp(volume, 0, 100)}`);
  }
  /** Set the minimum volume for Bell events. */
  async setBellVolume(volume: number): Promise<void> {
    await this.send(`bellvolume/${clamp(volume, 0, 100)}`);
  }
  /** Set the minimum volume for Buzzer events. */
  async setBuzzerVolume(volume: number): Promise<void> {
    await this.send(`buzzervolume/${clamp(volume, 0, 100)}`);
  }
  /** Set the minimum volume for TTS output. */
  async setTtsVolume(volume: number): Promise<void> {
    await this.send(`ttsvolume/${clamp(volume, 0, 100)}`);
  }
  /** Set the default volume. */
  async setDefaultVolume(volume: number): Promise<void> {
    await this.send(`defaultvolume/${clamp(volume, 0, 100)}`);
  }
  /** Set equalizer settings (comma-separated values) for this zone. */
  async setEqualizerSettings(settings: string): Promise<void> {
    await this.send(`equalizersettings/${encodeURIComponent(settings)}`);
  }
  /** Set the master volume for grouped zones. */
  async setMasterVolume(volume: number): Promise<void> {
    await this.send(`mastervolume/${clamp(volume, 0, 100)}`);
  }
  /** Music Server state (-3 invalid, -2 unreachable, -1 unknown, 0 offline, 1 initializing, 2 online). */
  get serverState(): number | undefined {
    return this.numeric('serverState');
  }
  /** Playback state (-1 unknown, 0 stopped, 1 paused, 2 playing). */
  get playState(): number | undefined {
    return this.numeric('playState');
  }
  /** UPNP client state (0 offline, 1 initializing, 2 online). */
  get clientState(): number | undefined {
    return this.numeric('clientState');
  }
  /** Whether the client power is active. */
  get power(): boolean | undefined {
    return this.boolean('power');
  }
  /** Current volume. */
  get volume(): number | undefined {
    return this.numeric('volume');
  }
  /** Current maximum volume. */
  get maxVolume(): number | undefined {
    return this.numeric('maxVolume');
  }
  /** Size of a single volume step. */
  get volumeStepValue(): number | undefined {
    return this.numeric('volumeStep');
  }
  /** Shuffle state (0 off, 1 on). */
  get shuffleValue(): boolean | undefined {
    return this.boolean('shuffle');
  }
  /** JSON containing all zone-favorites. */
  get sourceList(): string | undefined {
    return this.text('sourceList');
  }
  /** JSON containing all zone-favorites (parsed JSON). */
  sourceListJson<T = unknown>(): T | undefined {
    return this.control.getState('sourceList')?.json<T>();
  }
  /** Repeat mode (-1 unknown, 0 off, 1 repeat all, 3 repeat current item). */
  get repeat(): number | undefined {
    return this.numeric('repeat');
  }
  /** Current song name. */
  get songName(): string | undefined {
    return this.text('songName');
  }
  /** Total track length in seconds, -1 if unknown (stream). */
  get duration(): number | undefined {
    return this.numeric('duration');
  }
  /** Current position in the track, updated every 10 seconds. */
  get progress(): number | undefined {
    return this.numeric('progress');
  }
  /** Current album. */
  get album(): string | undefined {
    return this.text('album');
  }
  /** Current artist. */
  get artist(): string | undefined {
    return this.text('artist');
  }
  /** Current station. */
  get station(): string | undefined {
    return this.text('station');
  }
  /** Current genre. */
  get genre(): string | undefined {
    return this.text('genre');
  }
  /** Path to an image representing the current item. */
  get cover(): string | undefined {
    return this.text('cover');
  }
  /** Currently selected source identifier (integer). */
  get sourceValue(): number | undefined {
    return this.numeric('source');
  }
  /** Current song index in the audio queue. */
  get queueIndex(): number | undefined {
    return this.numeric('queueIndex');
  }
  /** Whether AirPlay is enabled on the Musicserver. */
  get enableAirPlayValue(): boolean | undefined {
    return this.boolean('enableAirPlay');
  }
  /** Whether Spotify Connect is enabled on the Musicserver. */
  get enableSpotifyConnectValue(): boolean | undefined {
    return this.boolean('enableSpotifyConnect');
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
  /** Current default volume. */
  get defaultVolume(): number | undefined {
    return this.numeric('defaultVolume');
  }
  /** Equalizer settings (comma-separated list). */
  get equalizerSettings(): string | undefined {
    return this.text('equalizerSettings');
  }
  /** Master volume for grouped zones. */
  get masterVolume(): number | undefined {
    return this.numeric('mastervolume');
  }
}
