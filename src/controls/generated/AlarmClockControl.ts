import { loxoneEpochToDate } from '../../protocol/loxoneEpoch.js';
import { clamp, ControlHandle } from '../ControlHandle.js';

const deviceStateLabelMap: Readonly<Record<number, 'none' | 'offline' | 'online'>> = { [0]: 'none', [1]: 'offline', [2]: 'online' };

/** Alarm clock control with entries, wake-alarm sound and nightlight settings. (generated). */
export class AlarmClockControl extends ControlHandle {
  static readonly controlType = 'AlarmClock';

  /** Snoozes the current active entry. */
  async snooze(): Promise<void> {
    await this.send('snooze');
  }
  /** Dismisses the current active entry. */
  async dismiss(): Promise<void> {
    await this.send('dismiss');
  }
  /** Creates or overrides an entry (alarmTime in seconds since midnight; modes list for non-nightlight entries, daily flag for nightlight entries). */
  async putEntry(entryID: number, name: string, alarmTime: number, isActive: boolean, modesOrDaily: string): Promise<void> {
    await this.send(`entryList/put/${Math.round(entryID)}/${encodeURIComponent(name)}/${Math.round(alarmTime)}/${isActive ? 1 : 0}/${encodeURIComponent(modesOrDaily)}`);
  }
  /** Deletes the entry with the given entryID. */
  async deleteEntry(entryID: number): Promise<void> {
    await this.send(`entryList/delete/${Math.round(entryID)}`);
  }
  /** Sets the prepare duration in seconds. */
  async setPrepDuration(seconds: number): Promise<void> {
    await this.send(`setPrepDuration/${Math.round(seconds)}`);
  }
  /** Sets the ringing duration in seconds. */
  async setRingDuration(seconds: number): Promise<void> {
    await this.send(`setRingDuration/${Math.round(seconds)}`);
  }
  /** Sets the snoozing duration in seconds (minimum 60). */
  async setSnoozeDuration(seconds: number): Promise<void> {
    await this.send(`setSnoozeDuration/${Math.round(seconds)}`);
  }
  /** Sets whether the nightlight buzzer should be used (1) or not (0). */
  async setBeepOn(enable: boolean): Promise<void> {
    await this.send(`setBeepOn/${enable ? 1 : 0}`);
  }
  /** Sets the nightlight display brightness when inactive (0-100). */
  async setBrightnessInactive(brightness: number): Promise<void> {
    await this.send(`setBrightnessInactive/${clamp(brightness, 0, 100)}`);
  }
  /** Sets the nightlight display brightness when active (0-100). */
  async setBrightnessActive(brightness: number): Promise<void> {
    await this.send(`setBrightnessActive/${clamp(brightness, 0, 100)}`);
  }
  /** Sets the wake alarm sound by ID from details.wakeAlarmSounds. */
  async setWakeAlarmSound(soundId: number): Promise<void> {
    await this.send(`setWakeAlarmSound/${Math.round(soundId)}`);
  }
  /** Sets the wake alarm volume. */
  async setWakeAlarmVolume(volume: number): Promise<void> {
    await this.send(`setWakeAlarmVolume/${Math.round(volume)}`);
  }
  /** Enables (1) or disables (0) sloping wake alarm volume. */
  async setWakeAlarmSlopingOn(enable: boolean): Promise<void> {
    await this.send(`setWakeAlarmSlopingOn/${enable ? 1 : 0}`);
  }
  /** Whether the AlarmClock is enabled. */
  get isEnabled(): boolean | undefined {
    return this.boolean('isEnabled');
  }
  /** Whether an entry is currently ringing. */
  get isAlarmActive(): boolean | undefined {
    return this.boolean('isAlarmActive');
  }
  /** Whether the user needs to confirm the entry. */
  get confirmationNeeded(): boolean | undefined {
    return this.boolean('confirmationNeeded');
  }
  /** Object with all alarm clock entries. */
  get entryList(): string | undefined {
    return this.text('entryList');
  }
  /** Object with all alarm clock entries (parsed JSON). */
  entryListJson<T = unknown>(): T | undefined {
    return this.control.getState('entryList')?.json<T>();
  }
  /** JSON with wake alarm sound, volume and isSloping settings. */
  get wakeAlarmSoundSettings(): string | undefined {
    return this.text('wakeAlarmSoundSettings');
  }
  /** JSON with wake alarm sound, volume and isSloping settings (parsed JSON). */
  wakeAlarmSoundSettingsJson<T = unknown>(): T | undefined {
    return this.control.getState('wakeAlarmSoundSettings')?.json<T>();
  }
  /** entryID of the current entry (-1 if none). */
  get currentEntry(): number | undefined {
    return this.numeric('currentEntry');
  }
  /** entryID of the next entry (-1 if none). */
  get nextEntry(): number | undefined {
    return this.numeric('nextEntry');
  }
  /** Operating mode (3-9) of the next entry. */
  get nextEntryMode(): number | undefined {
    return this.numeric('nextEntryMode');
  }
  /** Countdown in seconds until ringing snoozes again. */
  get ringingTime(): number | undefined {
    return this.numeric('ringingTime');
  }
  /** Duration the AlarmClock is ringing. */
  get ringDuration(): number | undefined {
    return this.numeric('ringDuration');
  }
  /** Preparation time in seconds. */
  get prepareDuration(): number | undefined {
    return this.numeric('prepareDuration');
  }
  /** Seconds until snoozing ends. */
  get snoozeTime(): number | undefined {
    return this.numeric('snoozeTime');
  }
  /** Duration of snoozing in seconds. */
  get snoozeDuration(): number | undefined {
    return this.numeric('snoozeDuration');
  }
  /** Date of next entry in seconds since 1.1.2009. */
  get nextEntryTime(): number | undefined {
    return this.numeric('nextEntryTime');
  }
  /** Date of next entry in seconds since 1.1.2009. (as a Date). */
  get nextEntryDate(): Date | undefined {
    const v = this.numeric('nextEntryTime');
    // <= 0 is the Loxone "no timer / none" sentinel, not a real timestamp.
    return v === undefined || v <= 0 ? undefined : loxoneEpochToDate(v);
  }
  /** Touch Nightlight state (0=none, 1=offline, 2=online). */
  get deviceState(): number | undefined {
    return this.numeric('deviceState');
  }
  /** Touch Nightlight state (decoded label). */
  get deviceStateLabel(): ('none' | 'offline' | 'online') | undefined {
    const v = this.numeric('deviceState');
    return v === undefined ? undefined : deviceStateLabelMap[v];
  }
  /** JSON of nightlight settings (beepUsed, brightInactive, brightActive). */
  get deviceSettings(): string | undefined {
    return this.text('deviceSettings');
  }
  /** JSON of nightlight settings (parsed JSON). */
  deviceSettingsJson<T = unknown>(): T | undefined {
    return this.control.getState('deviceSettings')?.json<T>();
  }
}
