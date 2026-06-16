import { clamp, ControlHandle } from '../ControlHandle.js';

/** Sauna controller (optionally with evaporator) controlling temperature, humidity, fan, drying and modes. (generated). */
export class SaunaControl extends ControlHandle {
  static readonly controlType = 'Sauna';

  /** Turns the sauna on. */
  async on(): Promise<void> {
    await this.send('on');
  }
  /** Turns the sauna off right away (no airing/drying phase). */
  async off(): Promise<void> {
    await this.send('off');
  }
  /** Turns the fan off. */
  async fanOff(): Promise<void> {
    await this.send('fanoff');
  }
  /** Turns the fan on, only works if the sauna is active. */
  async fanOn(): Promise<void> {
    await this.send('fanon');
  }
  /** Sets the target temperature (for manual mode). */
  async temp(target: number): Promise<void> {
    await this.send(`temp/${target}`);
  }
  /** Sets the target humidity (hasVaporizer only). */
  async humidity(target: number): Promise<void> {
    await this.send(`humidity/${target}`);
  }
  /** Sets the sauna mode (see mode state for values). */
  async mode(modeNr: number): Promise<void> {
    await this.send(`mode/${clamp(modeNr, 0, 6)}`);
  }
  /** Cycles through the sauna activity states (off -> on -> drying -> airing -> off). */
  async pulse(): Promise<void> {
    await this.send('pulse');
  }
  /** Starts the sand timer, counting down from timerTotal. */
  async startTimer(): Promise<void> {
    await this.send('starttimer');
  }
  /** Turns the sauna on and sets the target temperature. */
  async onTemp(target: number): Promise<void> {
    await this.send(`ontemp/${target}`);
  }
  /** Whether the sauna is active (not power). */
  get active(): boolean | undefined {
    return this.boolean('active');
  }
  /** Whether it is currently heating up. */
  get power(): boolean | undefined {
    return this.boolean('power');
  }
  /** The actual temperature inside the sauna. */
  get tempActual(): number | undefined {
    return this.numeric('tempActual');
  }
  /** The actual temperature provided by the bench sensor. */
  get tempBench(): number | undefined {
    return this.numeric('tempBench');
  }
  /** The current target temperature. */
  get tempTarget(): number | undefined {
    return this.numeric('tempTarget');
  }
  /** Whether the fan is on (indicates airing phase if drying is on too). */
  get fan(): boolean | undefined {
    return this.boolean('fan');
  }
  /** Whether the drying phase is on. */
  get drying(): boolean | undefined {
    return this.boolean('drying');
  }
  /** Active if door is closed (only valid if hasDoorSensor is true). */
  get doorClosed(): boolean | undefined {
    return this.boolean('doorClosed');
  }
  /** Forwards the state of the presence input of the block. */
  get presence(): boolean | undefined {
    return this.boolean('presence');
  }
  /** Digital indicator for a sauna error. */
  get error(): boolean | undefined {
    return this.boolean('error');
  }
  /** Which error occurred (0 no error, 1 too hot). */
  get saunaError(): number | undefined {
    return this.numeric('saunaError');
  }
  /** Seconds left of the sauna timer. */
  get timer(): number | undefined {
    return this.numeric('timer');
  }
  /** Total number of seconds of the sauna timer. */
  get timerTotal(): number | undefined {
    return this.numeric('timerTotal');
  }
  /** Active if the evaporator runs out of water (evaporator only). */
  get lessWater(): boolean | undefined {
    return this.boolean('lessWater');
  }
  /** Actual humidity inside the sauna (evaporator only). */
  get humidityActual(): number | undefined {
    return this.numeric('humidityActual');
  }
  /** Target humidity inside the sauna (evaporator only). */
  get humidityTarget(): number | undefined {
    return this.numeric('humidityTarget');
  }
  /** Current sauna mode (0 Off, 1 Finnish manual, 2 Humidity manual, 3 Finnish automatic, 4 Herbal, 5 Soft steam, 6 Warm air; evaporator only). */
  get modeValue(): number | undefined {
    return this.numeric('mode');
  }
}
