import type { LoxoneEvent } from '../protocol/events/LoxoneEvent.js';
import { TextEvent } from '../protocol/events/TextEvent.js';
import { ValueEvent } from '../protocol/events/ValueEvent.js';
import type { Control } from './Control.js';
import { formatLoxoneValue } from './format.js';

/**
 * A named state of a control (e.g. `active`, `position`, `temperature`), linked
 * to the state UUID that carries its live value in the event tables.
 */
export class State {
  /** The most recent event received for this state, when value-tracking is enabled. */
  latestEvent: LoxoneEvent | undefined;

  constructor(
    /** The state UUID string (matches incoming events; same naming as `Control.uuid`). */
    readonly uuid: string,
    /** The state name as defined in the control (e.g. `active`). */
    readonly name: string,
    /** The control this state belongs to. */
    readonly control: Control,
  ) {}

  /** The current numeric value, if the latest event was a value event. */
  get numericValue(): number | undefined {
    return this.latestEvent instanceof ValueEvent ? this.latestEvent.value : undefined;
  }

  /** The current text value, if the latest event was a text event. */
  get textValue(): string | undefined {
    return this.latestEvent instanceof TextEvent ? this.latestEvent.text : undefined;
  }

  /**
   * The current text value parsed as JSON, narrowed to `T`. Many Loxone text
   * states carry JSON (e.g. `iconAndColor`, `jLocked`). Returns `undefined` if
   * there is no value or it isn't valid JSON.
   */
  json<T = unknown>(): T | undefined {
    const text = this.textValue;
    if (!text) return undefined;
    try {
      return JSON.parse(text) as T;
    } catch {
      return undefined;
    }
  }

  /** The current value interpreted as a boolean (`!= 0`); for digital states. */
  get booleanValue(): boolean | undefined {
    const n = this.numericValue;
    return n === undefined ? undefined : n !== 0;
  }

  /** When the latest value was received. */
  get updatedAt(): Date | undefined {
    return this.latestEvent?.receivedAt;
  }

  /**
   * The current value formatted with the control's display format (e.g.
   * `"21.3°C"`); falls back to the text value, then the raw number.
   */
  get formatted(): string | undefined {
    const text = this.textValue;
    if (text !== undefined) return text;
    const num = this.numericValue;
    if (num === undefined) return undefined;
    const format = this.control.details['format'];
    return formatLoxoneValue(num, typeof format === 'string' ? format : undefined);
  }

  toString(): string {
    return `${this.control.name}.${this.name}`;
  }
}
