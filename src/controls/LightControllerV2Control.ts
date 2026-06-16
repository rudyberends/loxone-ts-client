import { LoxoneStateError } from '../errors.js';
import { ControlHandle } from './ControlHandle.js';

/** A mood as listed in a LightControllerV2 `moodList`. */
export interface LightMood {
  id: number | string;
  name: string;
  [key: string]: unknown;
}

/**
 * A `LightControllerV2` control (mood-based lighting).
 *
 * States: `activeMoods` (JSON array of active mood ids), `moodList` (JSON array
 * of moods). Commands: `changeTo/{moodId}` (mood 0 = all off), `addMood/{id}`,
 * `removeMood/{id}`, `plus`, `minus`.
 */
export class LightControllerV2Control extends ControlHandle {
  static readonly controlType = 'LightControllerV2';

  /** Activates a single mood, deactivating the others. Mood `0` is always "all off". */
  async selectMood(moodId: number | string): Promise<void> {
    await this.send(`changeTo/${moodId}`);
  }

  /**
   * Activates a mood by name (case-insensitive). Throws a {@link LoxoneStateError}
   * listing the available moods when no mood matches.
   */
  async selectMoodByName(name: string): Promise<void> {
    const mood = this.findMood(name);
    if (!mood) {
      const names = this.moods?.map((m) => m.name).join(', ') ?? '(mood list not received yet)';
      throw new LoxoneStateError(`No mood "${name}" on "${this.name}". Available: ${names}.`);
    }
    await this.selectMood(mood.id);
  }

  /** Turns all lights off (mood 0). */
  async allOff(): Promise<void> {
    await this.send('changeTo/0');
  }

  /** Mixes an additional mood in with the active ones. */
  async addMood(moodId: number | string): Promise<void> {
    await this.send(`addMood/${moodId}`);
  }

  /** Deactivates a single mood, leaving the others active. */
  async removeMood(moodId: number | string): Promise<void> {
    await this.send(`removeMood/${moodId}`);
  }

  /** Switches to the next mood. */
  async nextMood(): Promise<void> {
    await this.send('plus');
  }

  /** Switches to the previous mood. */
  async previousMood(): Promise<void> {
    await this.send('minus');
  }

  /** The currently active mood ids, parsed from the `activeMoods` state. */
  get activeMoods(): Array<number | string> | undefined {
    return parseJsonArray<number | string>(this.text('activeMoods'));
  }

  /** The available moods, parsed from the `moodList` state. */
  get moods(): LightMood[] | undefined {
    return parseJsonArray<LightMood>(this.text('moodList'));
  }

  /** The currently active moods resolved to their `{ id, name }` entries (by name, not just id). */
  get activeMoodList(): LightMood[] | undefined {
    const active = this.activeMoods;
    const all = this.moods;
    if (!active || !all) return undefined;
    const wanted = new Set(active.map(String));
    return all.filter((m) => wanted.has(String(m.id)));
  }

  /** The primary active mood (the first), or `undefined`. */
  get activeMood(): LightMood | undefined {
    return this.activeMoodList?.[0];
  }

  /** Looks up an available mood by name (case-insensitive). */
  findMood(name: string): LightMood | undefined {
    const wanted = name.toLowerCase();
    return this.moods?.find((m) => m.name.toLowerCase() === wanted);
  }

  /**
   * The `uuidAction` of this controller's master dimmer — the sub-control that
   * dims all circuits together (from `details.masterValue`). It is not an
   * individual lamp; callers should treat it as the controller's master.
   */
  get masterDimmerUuid(): string | undefined {
    const master = this.control.details['masterValue'];
    return typeof master === 'string' ? master : undefined;
  }
}

function parseJsonArray<T>(value: string | undefined): T[] | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : undefined;
  } catch {
    return undefined;
  }
}
