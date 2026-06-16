import { clamp, ControlHandle } from '../ControlHandle.js';

const currentOpModeLabelMap: Readonly<Record<number, 'out of order' | 'automatic' | 'service mode'>> = { [0]: 'out of order', [1]: 'automatic', [2]: 'service mode' };
const currentTempModeLabelMap: Readonly<Record<number, 'off' | 'automatic' | 'manual cooling'>> = { [0]: 'off', [1]: 'automatic', [5]: 'manual cooling' };
const currentCycleLabelMap: Readonly<Record<number, 'none' | 'filter' | 'flushing' | 'circulate' | 'drain'>> = { [0]: 'none', [1]: 'filter', [2]: 'flushing', [3]: 'circulate', [4]: 'drain' };
const valvePositionLabelMap: Readonly<Record<number, 'moving' | 'filter' | 'backwash' | 'clearwash' | 'circulate' | 'closed' | 'drain' | 'relieve'>> = { [-1]: 'moving', [0]: 'filter', [1]: 'backwash', [2]: 'clearwash', [3]: 'circulate', [4]: 'closed', [5]: 'drain', [6]: 'relieve' };
const errorLabelMap: Readonly<Record<number, 'none' | 'error was present' | 'error currently present' | 'device offline'>> = { [0]: 'none', [1]: 'error was present', [2]: 'error currently present', [3]: 'device offline' };

/** Controls a pool system with an Aquastar air valve, cycles, cover, pump and temperature regulation. (generated). */
export class PoolControllerControl extends ControlHandle {
  static readonly controlType = 'PoolController';

  /** Closes the cover if one is connected. */
  async coverClose(): Promise<void> {
    await this.send('coverClose');
  }
  /** Opens the cover if one is connected. */
  async coverOpen(): Promise<void> {
    await this.send('coverOpen');
  }
  /** Activates the given operating mode (0 = out of order, 1 = automatic, 2 = service mode). */
  async operatingMode(opMode: number): Promise<void> {
    await this.send(`operatingMode/${Math.round(opMode)}`);
  }
  /** Activates the given temperature mode (0 = off, 1 = automatic, ..., 5 = manual cooling). */
  async tempMode(tempMode: number): Promise<void> {
    await this.send(`tempMode/${Math.round(tempMode)}`);
  }
  /** Sets eco mode (0 = off, 1 = on). */
  async eco(state: boolean): Promise<void> {
    await this.send(`eco/${state ? 1 : 0}`);
  }
  /** Sets the given target temperature. */
  async targetTemp(temperatur: number): Promise<void> {
    await this.send(`targetTemp/${temperatur}`);
  }
  /** Sets the swimming machine value (analog 0.0-1.0 or digital, depending on swimmingMachineType). */
  async swimmingMachine(value: number): Promise<void> {
    await this.send(`swimmingMachine/${value}`);
  }
  /** Starts the given cycle (1 = filter, 2 = flushing, 3 = circulate, 4 = drain) with the given durations in seconds. */
  async startCycle(cycleId: number, seconds1: number, seconds2: number): Promise<void> {
    await this.send(`startCycle/${Math.round(cycleId)}/${Math.round(seconds1)}/${Math.round(seconds2)}`);
  }
  /** Short for startCycle/1 (filter). */
  async filter(): Promise<void> {
    await this.send('filter');
  }
  /** Short for startCycle/2 (flushing). */
  async backwash(): Promise<void> {
    await this.send('backwash');
  }
  /** Short for startCycle/3 (circulate). */
  async circulate(): Promise<void> {
    await this.send('circulate');
  }
  /** Short for startCycle/4 (drain). */
  async drain(): Promise<void> {
    await this.send('drain');
  }
  /** Sets the valve position (0 = filter, 1 = backwash, 2 = clearwash, 3 = circulate, 4 = closed, 5 = drain). */
  async valvePos(position: number): Promise<void> {
    await this.send(`valvePos/${clamp(position, 0, 5)}`);
  }
  /** Activates or deactivates the pump (0 = off, 1 = on). */
  async pump(state: boolean): Promise<void> {
    await this.send(`pump/${state ? 1 : 0}`);
  }
  /** Opens or closes the drain valve (0 = open, 1 = close). */
  async drainValve(state: boolean): Promise<void> {
    await this.send(`drainValve/${state ? 1 : 0}`);
  }
  /** Pulse for reset (reset/1 activates "Out of order"). */
  async reset(): Promise<void> {
    await this.send('reset');
  }
  /** Disables or enables childlock (0 = off, 1 = on). */
  async disable(state: boolean): Promise<void> {
    await this.send(`disable/${state ? 1 : 0}`);
  }
  /** Sets the delay time in seconds (must be within delayBounds). */
  async delayTime(time: number): Promise<void> {
    await this.send(`delayTime/${Math.round(time)}`);
  }
  /** Sets the filter time in seconds (must be within filterBounds). */
  async filterTime(time: number): Promise<void> {
    await this.send(`filterTime/${Math.round(time)}`);
  }
  /** Sets the backwash time in seconds (must be within backwashBounds). */
  async backwashTime(time: number): Promise<void> {
    await this.send(`backwashTime/${Math.round(time)}`);
  }
  /** Sets the rinse time in seconds (must be within rinseBounds). */
  async rinseTime(time: number): Promise<void> {
    await this.send(`rinseTime/${Math.round(time)}`);
  }
  /** Sets the circulate time in seconds (must be within circulateBounds). */
  async circulateTime(time: number): Promise<void> {
    await this.send(`circulateTime/${Math.round(time)}`);
  }
  /** Sets the drain time in seconds. */
  async drainTime(time: number): Promise<void> {
    await this.send(`drainTime/${Math.round(time)}`);
  }
  /** Approves or disapproves heating (1 = approve, 0 = disapprove). */
  async approveHeating(value: boolean): Promise<void> {
    await this.send(`approveHeating/${value ? 1 : 0}`);
  }
  /** Approves or disapproves cooling (1 = approve, 0 = disapprove). */
  async approveCooling(value: boolean): Promise<void> {
    await this.send(`approveCooling/${value ? 1 : 0}`);
  }
  /** Cancels the delay. */
  async skipDelay(): Promise<void> {
    await this.send('skipDelay');
  }
  /** Acknowledges the current error. */
  async ackError(): Promise<void> {
    await this.send('ackError');
  }
  /** Current operating mode (0 = out of order, 1 = automatic, 2 = service mode). */
  get currentOpMode(): number | undefined {
    return this.numeric('currentOpMode');
  }
  /** Current operating mode (decoded label). */
  get currentOpModeLabel(): ('out of order' | 'automatic' | 'service mode') | undefined {
    const v = this.numeric('currentOpMode');
    return v === undefined ? undefined : currentOpModeLabelMap[v];
  }
  /** Current temperature mode (0 = off, 1 = automatic, ..., 5 = manual cooling). */
  get currentTempMode(): number | undefined {
    return this.numeric('currentTempMode');
  }
  /** Current temperature mode (decoded label). */
  get currentTempModeLabel(): ('off' | 'automatic' | 'manual cooling') | undefined {
    const v = this.numeric('currentTempMode');
    return v === undefined ? undefined : currentTempModeLabelMap[v];
  }
  /** The actual water temperature. */
  get tempActual(): number | undefined {
    return this.numeric('tempActual');
  }
  /** Whether the temperature regulation cycle is active. */
  get tempModeCycleActive(): boolean | undefined {
    return this.boolean('tempModeCycleActive');
  }
  /** The target temperature. */
  get tempTarget(): number | undefined {
    return this.numeric('tempTarget');
  }
  /** The actual water level. */
  get waterLevel(): number | undefined {
    return this.numeric('waterLevel');
  }
  /** The value of input AI1. */
  get custom1(): number | undefined {
    return this.numeric('custom1');
  }
  /** The value of input AI2. */
  get custom2(): number | undefined {
    return this.numeric('custom2');
  }
  /** Whether heating is approved (only used if hasHeating is true). */
  get heatingApproved(): boolean | undefined {
    return this.boolean('heatingApproved');
  }
  /** Whether cooling is approved (only used if hasCooling is true). */
  get coolingApproved(): boolean | undefined {
    return this.boolean('coolingApproved');
  }
  /** Whether eco mode is active. */
  get ecoActive(): boolean | undefined {
    return this.boolean('ecoActive');
  }
  /** Swimming machine value, digital or analog (see swimmingMachineType). */
  get swimmingMachineValue(): number | undefined {
    return this.numeric('swimmingMachine');
  }
  /** Analog value of the cover position (0.0 = open, 1.0 = closed). */
  get coverPosition(): number | undefined {
    return this.numeric('coverPosition');
  }
  /** Whether the cover is opening right now. */
  get coverOpening(): boolean | undefined {
    return this.boolean('coverOpening');
  }
  /** Whether the cover is closing right now. */
  get coverClosing(): boolean | undefined {
    return this.boolean('coverClosing');
  }
  /** Current active cycle (0 = none, 1 = filter, 2 = flushing, 3 = circulate, 4 = drain). */
  get currentCycle(): number | undefined {
    return this.numeric('currentCycle');
  }
  /** Current active cycle (decoded label). */
  get currentCycleLabel(): ('none' | 'filter' | 'flushing' | 'circulate' | 'drain') | undefined {
    const v = this.numeric('currentCycle');
    return v === undefined ? undefined : currentCycleLabelMap[v];
  }
  /** Remaining time of the active cycle in seconds. */
  get remainingTime(): number | undefined {
    return this.numeric('remainingTime');
  }
  /** Current valve position (-1 = moving, 0 = filter, 1 = backwash, 2 = clearwash, 3 = circulate, 4 = closed, 5 = drain, 6 = relieve). */
  get valvePosition(): number | undefined {
    return this.numeric('valvePosition');
  }
  /** Current valve position (decoded label). */
  get valvePositionLabel(): ('moving' | 'filter' | 'backwash' | 'clearwash' | 'circulate' | 'closed' | 'drain' | 'relieve') | undefined {
    const v = this.numeric('valvePosition');
    return v === undefined ? undefined : valvePositionLabelMap[v];
  }
  /** Whether the pump is active. */
  get pumpValue(): boolean | undefined {
    return this.boolean('pump');
  }
  /** Whether the drain valve is opened. */
  get drainValveValue(): boolean | undefined {
    return this.boolean('drainValve');
  }
  /** The time of the delay (within delayBounds). */
  get delayTimeValue(): number | undefined {
    return this.numeric('delayTime');
  }
  /** The time in seconds the "Filter" mode will be active (within filterBounds). */
  get filterTimeValue(): number | undefined {
    return this.numeric('filterTime');
  }
  /** The time in seconds the backwash mode will be active (within backwashBounds). */
  get backwashTimeValue(): number | undefined {
    return this.numeric('backwashTime');
  }
  /** The time in seconds the "Rinse" mode will be active (within rinseBounds). */
  get rinseTimeValue(): number | undefined {
    return this.numeric('rinseTime');
  }
  /** The time in seconds the "Circulate" mode will be active (within circulateBounds). */
  get circulateTimeValue(): number | undefined {
    return this.numeric('circulateTime');
  }
  /** The time in seconds the "Drain" mode will be active. */
  get drainTimeValue(): number | undefined {
    return this.numeric('drainTime');
  }
  /** Error status (0 = none, 1 = error was present, 2 = error currently present, 3 = device offline). */
  get error(): number | undefined {
    return this.numeric('error');
  }
  /** Error status (decoded label). */
  get errorLabel(): ('none' | 'error was present' | 'error currently present' | 'device offline') | undefined {
    const v = this.numeric('error');
    return v === undefined ? undefined : errorLabelMap[v];
  }
  /** Whether the current cycle can be aborted. */
  get cycleAbortable(): boolean | undefined {
    return this.boolean('cycleAbortable');
  }
}
