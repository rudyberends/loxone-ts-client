import { LoxoneStateError } from '../errors.js';
import type { TextEvent } from '../protocol/events/TextEvent.js';
import { ValueEvent } from '../protocol/events/ValueEvent.js';
import type { TextMessage } from '../protocol/messages/TextMessage.js';
import type { Uuid } from '../protocol/messages/Uuid.js';
import type { Category } from '../structure/Category.js';
import type { Control } from '../structure/Control.js';
import { type ControlHistoryEntry, parseControlHistory } from '../structure/history.js';
import type { Room } from '../structure/Room.js';
import type { State } from '../structure/State.js';

/**
 * The capability a control wrapper needs to act on the Miniserver.
 * {@link ../LoxoneClient.LoxoneClient} implements it (via `control()` and
 * `subscribe()`), so wrappers don't depend on the whole client.
 */
export interface ControlCommandExecutor {
  control(target: string | Uuid | Control, command: string): Promise<TextMessage>;
  /**
   * Optional state-subscription channel, supplied by LoxoneClient so a handle can
   * observe its own changes (see {@link ControlHandle.onChange}/`onState`).
   */
  subscribe?(
    target: Control | State,
    listener: (event: ValueEvent | TextEvent) => void,
    options?: { emitCurrent?: boolean },
  ): () => void;
}

/** A change to one of a control's states, delivered to `onChange`/`onState`. */
export interface ControlChange {
  /** The control-relative state name that changed (e.g. `position`, `active`). */
  state: string | undefined;
  /** The new value: a number for value states, a string for text states. */
  value: number | string;
  /**
   * The value formatted with the control's display format (e.g. `"21.3°C"`), or
   * the text value for text states — the decoded representation a UI would show,
   * so a listener needn't re-derive it from {@link value}.
   */
  formatted: string | undefined;
  /** The value as a boolean (`!= 0`) for value states; `undefined` for text states. */
  boolean: boolean | undefined;
  /** The raw typed event. */
  event: ValueEvent | TextEvent;
  /** The item whose state changed — its typed getters now reflect the new value. */
  item: ControlHandle;
}

/**
 * Builds the enriched {@link ControlChange} delivered to `onChange`/`onState`/
 * `onAnyChange`. Centralised so every observation path surfaces the same decoded
 * fields (`formatted`, `boolean`) rather than just the raw value.
 */
export function makeControlChange(event: ValueEvent | TextEvent, item: ControlHandle): ControlChange {
  const isValue = event instanceof ValueEvent;
  return {
    state: event.stateName,
    value: isValue ? event.value : event.text,
    formatted: event.state?.formatted,
    boolean: isValue ? event.value !== 0 : undefined,
    event,
    item,
  };
}

/**
 * Base class for typed, ergonomic wrappers around a {@link Control}. Subclasses
 * expose named commands (e.g. `on()`, `setPosition()`) and typed value getters
 * that read from the control's live state, instead of raw command strings.
 */
export abstract class ControlHandle {
  constructor(
    /** The underlying structure control. */
    readonly control: Control,
    /** Used to send commands. */
    protected readonly executor: ControlCommandExecutor,
  ) {}

  /** The action UUID used in commands. */
  get uuid(): string {
    return this.control.uuidAction;
  }

  /** Display name. */
  get name(): string {
    return this.control.name;
  }

  /** Control type. */
  get type(): string {
    return this.control.type;
  }

  /** The room this control belongs to, if any. */
  get room(): Room | undefined {
    return this.control.room;
  }

  /** The name of the room this control belongs to, if any. */
  get roomName(): string | undefined {
    return this.control.room?.name;
  }

  /** The category this control belongs to, if any. */
  get category(): Category | undefined {
    return this.control.category;
  }

  /** The name of the category this control belongs to, if any. */
  get categoryName(): string | undefined {
    return this.control.category?.name;
  }

  /** Sends a raw command to this control (escape hatch for unwrapped commands). */
  send(command: string): Promise<TextMessage> {
    return this.executor.control(this.control, command);
  }

  /** The named {@link State} of this control (for `client.watch`/`subscribe`). */
  state(name: string): State | undefined {
    return this.control.getState(name);
  }

  /**
   * Like {@link state}, but throws a descriptive {@link LoxoneStateError} when the
   * state is absent — listing the control's actual state names (including the
   * `[i]`-suffixed names of array-valued states). Use this to fail loud at
   * wiring time instead of silently producing a binding that never updates.
   */
  requireState(name: string): State {
    const state = this.control.getState(name);
    if (!state) {
      const available = this.control.stateNames;
      throw new LoxoneStateError(
        `Control "${this.control.name}" (${this.control.type}) has no state "${name}". ` +
          `Available: ${available.length ? available.join(', ') : '(none)'}.`,
      );
    }
    return state;
  }

  /**
   * Observe this item: `listener` runs whenever ANY of its states changes, with
   * the changed state's name + value. The handle's typed getters already reflect
   * the new value, so a listener typically just re-reads them. By default the
   * current value of each state is replayed immediately (`emitCurrent`). Returns
   * an unsubscribe function; the underlying watch is reference-counted.
   */
  onChange(listener: (change: ControlChange) => void, options?: { emitCurrent?: boolean }): () => void {
    return this.observe(this.control, listener, options);
  }

  /**
   * Observe a single named state of this item (e.g. `onState('position', …)`).
   * Throws via {@link requireState} if the state does not exist, so a typo fails
   * loud at wiring time.
   */
  onState(name: string, listener: (change: ControlChange) => void, options?: { emitCurrent?: boolean }): () => void {
    return this.observe(this.requireState(name), listener, options);
  }

  private observe(
    target: Control | State,
    listener: (change: ControlChange) => void,
    options?: { emitCurrent?: boolean },
  ): () => void {
    if (!this.executor.subscribe) {
      throw new LoxoneStateError(
        `Cannot observe "${this.control.name}": this handle was created without a subscription channel ` +
          `(use a handle from client.item()/items()/wrap(), not a bare wrapper).`,
      );
    }
    return this.executor.subscribe(
      target,
      (event) => listener(makeControlChange(event, this)),
      options,
    );
  }

  /**
   * Fetches this control's block history (`gethistory`) — why the block acted as
   * it did, as delivered by the Miniserver. Only meaningful when
   * {@link Control.hasHistory} is true; other controls reject or return `[]`.
   * (Named `getHistory` to avoid clashing with controls that have a `history`
   * command of their own, e.g. the NFC Code Touch keypad.)
   */
  async getHistory(): Promise<ControlHistoryEntry[]> {
    const response = await this.send('gethistory');
    return parseControlHistory(response.jsonValue());
  }

  protected numeric(name: string): number | undefined {
    return this.control.getState(name)?.numericValue;
  }

  protected boolean(name: string): boolean | undefined {
    return this.control.getState(name)?.booleanValue;
  }

  protected text(name: string): string | undefined {
    return this.control.getState(name)?.textValue;
  }
}

/**
 * Fallback wrapper for control types without a dedicated class. Exposes the base
 * {@link ControlHandle} surface (`send`, `state`, name/type/uuid) so any control
 * can still be driven and read generically.
 */
export class GenericControl extends ControlHandle {
  static readonly controlType = '*';
}

/** Clamps `value` into the inclusive `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
