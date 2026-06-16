import type { Category } from './Category.js';
import type { Room } from './Room.js';
import type { State } from './State.js';
import type { ControlType, RawControl, StatisticConfig, StatisticV2Config } from './types.js';

/** Parsed lock status of a control (from its `jLocked` state). */
export interface LockStatus {
  /** Whether the control is currently locked (and thus can't be operated). */
  locked: boolean;
  /** Lock level: 0 = not locked, 1 = locked by visu, 2 = locked by logic. */
  level: 0 | 1 | 2;
  /** Human-readable reason for the lock, when provided. */
  reason: string | undefined;
}

const UNLOCKED: LockStatus = { locked: false, level: 0, reason: undefined };

/**
 * A control (actuator, sensor, or block function) from the structure file, with
 * its states, sub-controls, room and category resolved.
 */
export class Control {
  /** States keyed by name (e.g. `active`). */
  readonly statesByName = new Map<string, State>();
  /** States keyed by state UUID string. */
  readonly statesByUuid = new Map<string, State>();
  /** Direct sub-controls keyed by UUID. */
  readonly subControls = new Map<string, Control>();

  constructor(
    /** The control UUID (key in the structure file; equals `uuidAction`). */
    readonly uuid: string,
    /** The raw structure-file entry. */
    readonly raw: RawControl,
    /** The room this control belongs to, if any. */
    readonly room: Room | undefined,
    /** The category this control belongs to, if any. */
    readonly category: Category | undefined,
    /** The parent control, when this is a sub-control. */
    readonly parent: Control | undefined = undefined,
  ) {}

  /** Display name. */
  get name(): string {
    return this.raw.name;
  }

  /** Control type (e.g. `Switch`, `Jalousie`, `LightControllerV2`). */
  get type(): ControlType {
    return this.raw.type;
  }

  /** The action UUID used in control commands. */
  get uuidAction(): string {
    return this.raw.uuidAction;
  }

  /** Whether this control requires the visualisation password. */
  get isSecured(): boolean {
    return this.raw.isSecured === true;
  }

  /**
   * The parsed lock status from the control's `jLocked` state (an empty status
   * means "not locked"). Returns an unlocked status when the state is absent or
   * not yet known.
   */
  get lockStatus(): LockStatus {
    const text = this.getState('jLocked')?.textValue;
    if (!text) return UNLOCKED;
    try {
      const parsed = JSON.parse(text) as { locked?: number; reason?: string };
      const level = (parsed.locked ?? 0) as 0 | 1 | 2;
      return { locked: level !== 0, level, reason: parsed.reason };
    } catch {
      return UNLOCKED;
    }
  }

  /** Whether the control is currently locked (shorthand for `lockStatus.locked`). */
  get isLocked(): boolean {
    return this.lockStatus.locked;
  }

  /** Type-specific visualisation details. */
  get details(): Record<string, unknown> {
    return this.raw.details ?? {};
  }

  /**
   * The display format string for this control's value (e.g. `"%.1f°C"`), when
   * the control declares one in its details.
   */
  get format(): string | undefined {
    const format = this.details['format'];
    return typeof format === 'string' ? format : undefined;
  }

  /**
   * The measurement unit parsed from {@link format} (e.g. `"°C"`, `"Lx"`, `"%"`),
   * i.e. the literal text around the numeric placeholder. `undefined` if there
   * is no format or no unit text.
   */
  get unit(): string | undefined {
    const format = this.format;
    if (!format) return undefined;
    const stripped = format.replace(/<[^>]*>/g, ''); // drop any markup
    // The unit is the literal text after the (last) printf-style numeric
    // placeholder. Restricting the conversion to real specifiers — and never
    // matching the `%%` escape — avoids corrupting the surrounding text.
    const conversion = /%[-+ 0#]*[\d.]*[bdiouxXeEfFgGaAcs]/g;
    let unitStart = 0;
    let match: RegExpExecArray | null;
    while ((match = conversion.exec(stripped)) !== null) {
      unitStart = match.index + match[0].length;
    }
    const unit = stripped.slice(unitStart).replace(/%%/g, '%').trim();
    return unit.length > 0 ? unit : undefined;
  }

  /**
   * Best-effort sensor classification from {@link unit} (+ the name as a tie-breaker).
   * `°`/`Lx`/`W` are unambiguous. `%` is treated as **humidity** *unless* the name
   * signals another quantity that also uses `%` (power, valve, battery, level,
   * brightness, …) — so a "CV Vermogen" or "Klep stand" isn't mistaken for humidity.
   * A set-point/target is a configured value, not an ambient reading, so it is not a
   * temperature/humidity sensor. Returns `undefined` when it can't classify safely.
   */
  get sensorKind(): 'temperature' | 'humidity' | 'illuminance' | 'power' | undefined {
    const unit = this.unit?.toLowerCase();
    if (!unit) return undefined;
    const name = this.name.toLowerCase();
    const isSetpoint = /set\s?point|soll|streef/.test(name);
    if (unit.includes('°') || unit === 'k' || unit === '°k') return isSetpoint ? undefined : 'temperature';
    if (unit.includes('lx') || unit.includes('lux')) return 'illuminance';
    if (/^(m|k|mega|kilo)?w$/.test(unit) || unit === 'va' || unit === 'var') return 'power';
    if (unit === '%') {
      const notHumidity = /vermogen|power|klep|valve|set\s?point|soll|batterij|battery|niveau|\blevel\b|helderheid|\bdim/;
      return notHumidity.test(name) ? undefined : 'humidity';
    }
    return undefined;
  }

  /**
   * Legacy (V1) statistic configuration, when this control records statistics.
   * Drive a download with {@link ../LoxoneClient.LoxoneClient.getStatisticV1}.
   */
  get statistic(): StatisticConfig | undefined {
    return this.raw.statistic;
  }

  /**
   * Energy-flow-era (V2) statistic configuration, when this control supports it
   * (meters, energy-flow monitor). Drive a download with
   * {@link ../LoxoneClient.LoxoneClient.getStatistic}.
   */
  get statisticV2(): StatisticV2Config | undefined {
    return this.raw.statisticV2;
  }

  /** Whether this control records statistics under either handling (V1 or V2). */
  get hasStatistics(): boolean {
    return this.statistic !== undefined || this.statisticV2 !== undefined;
  }

  /**
   * Whether this control tracks a block history (`details.hasHistory`) — insight
   * into why the block acted as it did. Read it with
   * {@link ../LoxoneClient.LoxoneClient.getControlHistory}.
   */
  get hasHistory(): boolean {
    return this.details['hasHistory'] === true;
  }

  /** This control's own icon reference (href/UUID), when the structure provides one. */
  get defaultIcon(): string | undefined {
    return iconRef(this.raw['defaultIcon']);
  }

  /** The icon reference of this control's category, when available. */
  get categoryIcon(): string | undefined {
    return iconRef(this.category?.raw?.image);
  }

  /** All states of this control. */
  get states(): State[] {
    return [...this.statesByName.values()];
  }

  /** The names of every state on this control (including `[i]`-suffixed array states). */
  get stateNames(): string[] {
    return [...this.statesByName.keys()];
  }

  /** Looks up a state by its name. */
  getState(name: string): State | undefined {
    return this.statesByName.get(name);
  }

  /** Registers a state on this control (used by the parser). */
  addState(state: State): void {
    this.statesByName.set(state.name, state);
    this.statesByUuid.set(state.uuid, state);
  }

  /** Registers a sub-control (used by the parser). */
  addSubControl(control: Control): void {
    this.subControls.set(control.uuid, control);
  }

  toString(): string {
    return `${this.type}(${this.name})`;
  }
}

/** Normalises a Loxone icon reference (a string, or a `{ href }`/`{ uuid }` object) to a string. */
function iconRef(value: unknown): string | undefined {
  if (typeof value === 'string') return value.length > 0 ? value : undefined;
  if (value && typeof value === 'object') {
    const obj = value as { href?: unknown; uuid?: unknown };
    if (typeof obj.href === 'string' && obj.href.length > 0) return obj.href;
    if (typeof obj.uuid === 'string' && obj.uuid.length > 0) return obj.uuid;
  }
  return undefined;
}
