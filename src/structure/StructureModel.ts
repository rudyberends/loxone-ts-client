import type { Logger } from '../logging/Logger.js';
import { Uuid } from '../protocol/messages/Uuid.js';
import { Category } from './Category.js';
import { Control } from './Control.js';
import { Room } from './Room.js';
import { State } from './State.js';
import type { LoxoneStructureFile, MsInfo, RawControl, StateMap } from './types.js';

/** UUID used for the synthetic "unassigned" room/category. */
const UNASSIGNED_UUID = Uuid.EMPTY.value;
/** Control key for the synthetic control that holds the global states. */
const GLOBAL_STATES_UUID = 'globalStates';

/**
 * The parsed, navigable structure model: rooms, categories, controls (including
 * sub-controls) and a flat index of every state UUID for fast event enrichment.
 */
export class StructureModel {
  /** All controls (including sub-controls) keyed by UUID. */
  readonly controls = new Map<string, Control>();
  /** Every state keyed by its state UUID — used to enrich incoming events. */
  readonly statesByUuid = new Map<string, State>();
  /** Rooms keyed by UUID (includes a synthetic "Unassigned" room). */
  readonly rooms = new Map<string, Room>();
  /** Categories keyed by UUID. */
  readonly categories = new Map<string, Category>();

  private log: Logger | undefined;

  private constructor(
    /** The raw structure file. */
    readonly raw: LoxoneStructureFile,
  ) {}

  /** Timestamp of the last configuration change. */
  get lastModified(): string {
    return this.raw.lastModified;
  }

  /** Static Miniserver info. */
  get msInfo(): MsInfo {
    return this.raw.msInfo;
  }

  /** Global state UUIDs (sunrise/sunset/notifications/…), keyed by name. */
  get globalStates(): Record<string, string | string[] | undefined> {
    return this.raw.globalStates ?? {};
  }

  /** Weather-server configuration, if a Cloud Weather is configured. */
  get weatherServer(): Record<string, unknown> | undefined {
    return this.raw.weatherServer;
  }

  /**
   * Resolves a named global state (e.g. `"sunrise"`, `"sunset"`) to its {@link State}
   * so its live value can be read or watched like any other. Returns `undefined`
   * for list-valued globals or states not present in the event tables.
   */
  getGlobalState(name: string): State | undefined {
    const uuid = this.globalStates[name];
    return typeof uuid === 'string' ? this.statesByUuid.get(uuid) : undefined;
  }

  /** Looks up a control by UUID. */
  getControl(uuid: string): Control | undefined {
    return this.controls.get(uuid);
  }

  /** Looks up a state by its UUID (cf. {@link Control.getState} which looks up by name). */
  getStateByUuid(uuid: string): State | undefined {
    return this.statesByUuid.get(uuid);
  }

  /** All controls as an array (top-level and sub-controls). */
  get allControls(): Control[] {
    return [...this.controls.values()];
  }

  /** Returns every control matching `predicate`. */
  findControls(predicate: (control: Control) => boolean): Control[] {
    return this.allControls.filter(predicate);
  }

  /** Returns the first control matching `predicate`. */
  findControl(predicate: (control: Control) => boolean): Control | undefined {
    return this.allControls.find(predicate);
  }

  /**
   * Finds a control by (case-insensitive) name, optionally restricted to a room
   * (by `Room`, room UUID, or room name).
   */
  getControlByName(name: string, room?: Room | string): Control | undefined {
    const wanted = name.toLowerCase();
    if (room === undefined) {
      return this.findControl((c) => c.name.toLowerCase() === wanted);
    }
    // A room was specified: if it doesn't resolve to a known room, there is no match.
    const resolved = this.resolveRoom(room);
    if (!resolved) return undefined;
    return this.findControl((c) => c.name.toLowerCase() === wanted && c.room?.uuid === resolved.uuid);
  }

  /** Returns all controls of the given type (e.g. `"Switch"`). */
  getControlsByType(type: string): Control[] {
    return this.findControls((c) => c.type === type);
  }

  /** Returns the top-level controls in a room (by `Room`, room UUID, or room name). */
  getControlsInRoom(room: Room | string): Control[] {
    return this.resolveRoom(room)?.controls ?? [];
  }

  /** Returns the top-level controls in a category (by `Category`, category UUID, or name). */
  getControlsByCategory(category: Category | string): Control[] {
    return this.resolveCategory(category)?.controls ?? [];
  }

  /** Resolves a `Room`, room UUID, or room name to the `Room` instance. */
  resolveRoom(room: Room | string): Room | undefined {
    if (typeof room !== 'string') return room;
    if (this.rooms.has(room)) return this.rooms.get(room);
    const wanted = room.toLowerCase();
    return [...this.rooms.values()].find((r) => r.name.toLowerCase() === wanted);
  }

  /** Resolves a `Category`, category UUID, or category name to the `Category` instance. */
  resolveCategory(category: Category | string): Category | undefined {
    if (typeof category !== 'string') return category;
    if (this.categories.has(category)) return this.categories.get(category);
    const wanted = category.toLowerCase();
    return [...this.categories.values()].find((c) => c.name.toLowerCase() === wanted);
  }

  /** Parses a raw structure file into a {@link StructureModel}. */
  static parse(raw: LoxoneStructureFile, log?: Logger): StructureModel {
    const model = new StructureModel(raw);
    model.log = log;

    model.rooms.set(UNASSIGNED_UUID, new Room(UNASSIGNED_UUID, 'Unassigned'));
    for (const [uuid, room] of Object.entries(raw.rooms ?? {})) {
      model.rooms.set(uuid, new Room(uuid, room.name, room));
    }
    for (const [uuid, cat] of Object.entries(raw.cats ?? {})) {
      model.categories.set(uuid, new Category(uuid, cat.name, cat));
    }

    for (const [uuid, rawControl] of Object.entries(raw.controls ?? {})) {
      model.addControl(uuid, rawControl, undefined);
    }

    // Index the global states (sunrise/sunset/...) so their UUIDs are watchable
    // and readable, via a synthetic control. It is intentionally NOT added to the
    // controls map / room back-references, so it doesn't pollute enumeration.
    if (raw.globalStates) {
      const states: StateMap = {};
      for (const [name, value] of Object.entries(raw.globalStates)) {
        // Only string-valued globals are state UUIDs; arrays (e.g. favColors) are data.
        if (typeof value === 'string') states[name] = value;
      }
      const synthetic = new Control(
        GLOBAL_STATES_UUID,
        { name: 'Global States', type: 'GlobalStates', uuidAction: Uuid.EMPTY.value, states },
        model.rooms.get(UNASSIGNED_UUID),
        undefined,
      );
      model.attachStates(synthetic, states);
    }

    log?.debug(
      `Parsed structure: ${model.rooms.size} rooms, ${model.categories.size} categories, ` +
        `${model.controls.size} controls, ${model.statesByUuid.size} states`,
    );
    return model;
  }

  private addControl(uuid: string, raw: RawControl, parent: Control | undefined): Control {
    const room = raw.room ? this.rooms.get(raw.room) : this.rooms.get(UNASSIGNED_UUID);
    const category = raw.cat ? this.categories.get(raw.cat) : undefined;
    const control = new Control(uuid, raw, room, category, parent);
    this.controls.set(uuid, control);

    // Back-reference top-level controls from their room/category.
    if (!parent) {
      room?.controls.push(control);
      category?.controls.push(control);
    }

    this.attachStates(control, raw.states);

    for (const [subUuid, subRaw] of Object.entries(raw.subControls ?? {})) {
      const sub = this.addControl(subUuid, subRaw, control);
      control.addSubControl(sub);
    }
    return control;
  }

  private attachStates(control: Control, states: RawControl['states']): void {
    if (!states) return;
    for (const [name, value] of Object.entries(states)) {
      const uuids = Array.isArray(value) ? value : [value];
      uuids.forEach((stateUuid, index) => {
        if (typeof stateUuid !== 'string' || stateUuid.length === 0) return;
        try {
          Uuid.fromString(stateUuid); // validate shape only
        } catch {
          // Some state entries aren't UUIDs (e.g. literal config values); skip them
          // rather than failing the whole structure parse.
          this.log?.debug(`Skipping non-UUID state "${control.name}.${name}" = "${stateUuid}"`);
          return;
        }
        const stateName = uuids.length > 1 ? `${name}[${index}]` : name;
        const state = new State(stateUuid, stateName, control);
        control.addState(state);
        this.statesByUuid.set(stateUuid, state);
      });
    }
  }
}
