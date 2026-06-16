import { clamp, ControlHandle } from '../ControlHandle.js';

const deviceStateLabelMap: Readonly<Record<number, 'Running' | 'Offline' | 'Turned off' | 'Error' | 'Device Asleep'>> = { [0]: 'Running', [1]: 'Offline', [2]: 'Turned off', [3]: 'Error', [4]: 'Device Asleep' };

/** A Touch & Grill cooking thermometer control exposing sensor temperatures, targets, alarms and a timer. (generated). */
export class SteakThermoControl extends ControlHandle {
  static readonly controlType = 'SteakThermo';

  /** Quits all ongoing alarms. */
  async quitAlarm(): Promise<void> {
    await this.send('quitAlarm');
  }
  /** Sets the target temperature and name for a sensor (sensorIndex 0 = left/yellow, 1 = right/green). */
  async setSensor(sensorIndex: number, targetTemp: number, sensorName: string): Promise<void> {
    await this.send(`setSensor/${clamp(sensorIndex, 0, 1)}/${targetTemp}/${encodeURIComponent(sensorName)}`);
  }
  /** Enables (1) or disables (0) keeping the display on while running on battery. */
  async setDisplayAlwaysOnBat(on: boolean): Promise<void> {
    await this.send(`setDisplayAlwaysOnBat/${on ? 1 : 0}`);
  }
  /** Enables (1) or disables (0) keeping the display on while connected to power. */
  async setDisplayAlwaysOnDc(on: boolean): Promise<void> {
    await this.send(`setDisplayAlwaysOnDc/${on ? 1 : 0}`);
  }
  /** Sets the control at the given index in the availableControls state as active. */
  async setActive(index: number): Promise<void> {
    await this.send(`setActive/${Math.round(index)}`);
  }
  /** Sets this control as the active control. */
  async setThisActive(): Promise<void> {
    await this.send('setThisActive');
  }
  /** Sets the timer duration in seconds. */
  async setTimerDuration(duration: number): Promise<void> {
    await this.send(`setTimerDuration/${Math.round(duration)}`);
  }
  /** Starts the timer with the defined duration. */
  async startTimer(): Promise<void> {
    await this.send('startTimer');
  }
  /** Stops the timer. */
  async stopTimer(): Promise<void> {
    await this.send('stopTimer');
  }
  /** Enables (1) or disables (0) the touch protection of the device. */
  async setTouchProtection(on: boolean): Promise<void> {
    await this.send(`setTouchProtection/${on ? 1 : 0}`);
  }
  /** Sets the display brightness in percent (0-100), available since 10.3. */
  async setDisplayBrightness(brightness: number): Promise<void> {
    await this.send(`setDisplayBrightness/${clamp(brightness, 0, 100)}`);
  }
  /** JSON array TextEvent of the sensor temperatures, from left to right. */
  get currentTemperatures(): string | undefined {
    return this.text('currentTemperatures');
  }
  /** JSON array TextEvent of the sensor temperatures, from left to right (parsed JSON). */
  currentTemperaturesJson<T = unknown>(): T | undefined {
    return this.control.getState('currentTemperatures')?.json<T>();
  }
  /** Temperature of the yellow (left) sensor. */
  get temperatureYellow(): number | undefined {
    return this.numeric('temperatureYellow');
  }
  /** Temperature of the green (right) sensor. */
  get temperatureGreen(): number | undefined {
    return this.numeric('temperatureGreen');
  }
  /** JSON array TextEvent with name, connected and target for each sensor (index 0 = left/yellow, 1 = right/green). */
  get sensorInfo(): string | undefined {
    return this.text('sensorInfo');
  }
  /** JSON array TextEvent with name, connected and target for each sensor (parsed JSON). */
  sensorInfoJson<T = unknown>(): T | undefined {
    return this.control.getState('sensorInfo')?.json<T>();
  }
  /** Target temperature of the yellow (left) sensor. */
  get targetYellow(): number | undefined {
    return this.numeric('targetYellow');
  }
  /** Target temperature of the green (right) sensor. */
  get targetGreen(): number | undefined {
    return this.numeric('targetGreen');
  }
  /** JSON array TextEvent describing per-sensor alarms with text, time (seconds since 2009) and ringing flag. */
  get sensorAlarms(): string | undefined {
    return this.text('sensorAlarms');
  }
  /** JSON array TextEvent describing per-sensor alarms with text, time (parsed JSON). */
  sensorAlarmsJson<T = unknown>(): T | undefined {
    return this.control.getState('sensorAlarms')?.json<T>();
  }
  /** Whether the yellow sensor has an active alarm. */
  get yellowAlarmActive(): boolean | undefined {
    return this.boolean('yellowAlarmActive');
  }
  /** Whether the green sensor has an active alarm. */
  get greenAlarmActive(): boolean | undefined {
    return this.boolean('greenAlarmActive');
  }
  /** Text of the currently active alarm (empty string if no alarm is active). */
  get activeAlarmText(): string | undefined {
    return this.text('activeAlarmText');
  }
  /** Remaining time of the timer in seconds. */
  get timerRemaining(): number | undefined {
    return this.numeric('timerRemaining');
  }
  /** JSON TextEvent with active flag and duration (seconds) of the timer. */
  get timerInfo(): string | undefined {
    return this.text('timerInfo');
  }
  /** JSON TextEvent with active flag and duration (parsed JSON). */
  timerInfoJson<T = unknown>(): T | undefined {
    return this.control.getState('timerInfo')?.json<T>();
  }
  /** JSON TextEvent describing the timer alarm with text, time (seconds since 2009) and ringing flag. */
  get timerAlarm(): string | undefined {
    return this.text('timerAlarm');
  }
  /** JSON TextEvent describing the timer alarm with text, time (parsed JSON). */
  timerAlarmJson<T = unknown>(): T | undefined {
    return this.control.getState('timerAlarm')?.json<T>();
  }
  /** Whether a timer alarm is active. */
  get timerAlarmActive(): boolean | undefined {
    return this.boolean('timerAlarmActive');
  }
  /** Current device state (0=Running, 1=Offline, 2=Turned off, 3=Error, 4=Device Asleep). */
  get deviceState(): number | undefined {
    return this.numeric('deviceState');
  }
  /** Current device state (decoded label). */
  get deviceStateLabel(): ('Running' | 'Offline' | 'Turned off' | 'Error' | 'Device Asleep') | undefined {
    const v = this.numeric('deviceState');
    return v === undefined ? undefined : deviceStateLabelMap[v];
  }
  /** Whether the display stays on while the device runs on battery. */
  get displayAlwaysOnBat(): boolean | undefined {
    return this.boolean('displayAlwaysOnBat');
  }
  /** Whether the display stays on while the device is connected to power. */
  get displayAlwaysOnDc(): boolean | undefined {
    return this.boolean('displayAlwaysOnDc');
  }
  /** JSON array TextEvent of the controls (name and uuid) this device has been assigned to. */
  get availableControls(): string | undefined {
    return this.text('availableControls');
  }
  /** JSON array TextEvent of the controls (parsed JSON). */
  availableControlsJson<T = unknown>(): T | undefined {
    return this.control.getState('availableControls')?.json<T>();
  }
  /** Index into the availableControls state of the currently active control. */
  get activeControl(): number | undefined {
    return this.numeric('activeControl');
  }
  /** Whether this particular control is the active control. */
  get isActive(): boolean | undefined {
    return this.boolean('isActive');
  }
  /** Whether the touch protection of the device is active. */
  get touchProtection(): boolean | undefined {
    return this.boolean('touchProtection');
  }
  /** Display brightness in percent (0-100), available since 10.3. */
  get displayBrightness(): number | undefined {
    return this.numeric('displayBrightness');
  }
  /** Power mode of the device (1=DC powered, 2=battery powered), available since 10.2.1.16. */
  get powerMode(): number | undefined {
    return this.numeric('powerMode');
  }
  /** Battery state of charge in percent (0-100), available since 10.2.1.16. */
  get batteryStateOfCharge(): number | undefined {
    return this.numeric('batteryStateOfCharge');
  }
}
