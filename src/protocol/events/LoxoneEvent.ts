import type { Control } from '../../structure/Control.js';
import type { Room } from '../../structure/Room.js';
import type { State } from '../../structure/State.js';
import type { Uuid } from '../messages/Uuid.js';

/**
 * Base class for all state-update events parsed from the binary event tables.
 *
 * Events are parsed as pure data. When the structure file has been parsed, the
 * client enriches each event by setting {@link state}, giving access to the
 * owning control, room and state name via convenience getters.
 */
export abstract class LoxoneEvent {
  /** The state UUID this event updates. */
  readonly uuid: Uuid;
  /** When this event was received by the client. */
  readonly receivedAt: Date;
  /** The resolved structure state, set by the client after structure parsing. */
  state: State | undefined;

  protected constructor(uuid: Uuid) {
    this.uuid = uuid;
    this.receivedAt = new Date();
  }

  /** Total number of bytes this event occupies in the event table. */
  abstract get byteLength(): number;

  /** The control this event's state belongs to (once the structure is parsed). */
  get control(): Control | undefined {
    return this.state?.control;
  }

  /** The room of the control this event belongs to. */
  get room(): Room | undefined {
    return this.state?.control.room;
  }

  /** The name of the state this event updates (e.g. `active`), if resolved. */
  get stateName(): string | undefined {
    return this.state?.name;
  }

  /** A human-readable `room/control/state` path, falling back to the UUID. */
  toPath(): string {
    const state = this.state;
    if (!state) return this.uuid.value;
    const control = state.control;
    const room = control.room?.name ?? 'Unassigned';
    const controlPath = control.parent ? `${control.parent.name}/${control.name}` : control.name;
    return `${room}/${controlPath}/${state.name}`;
  }
}

/** A constructor signature for event parsers used by the event-table reader. */
export type EventParser<T extends LoxoneEvent> = (buffer: Buffer, offset: number) => T;
