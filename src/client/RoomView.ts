import type { ControlHandle } from '../controls/ControlHandle.js';
import { DimmerControl } from '../controls/DimmerControl.js';
import { IRoomControllerV2Control } from '../controls/IRoomControllerV2Control.js';
import { IRoomControllerControl } from '../controls/generated/IRoomControllerControl.js';
import { InfoOnlyAnalogControl } from '../controls/InfoControls.js';
import { ColorPickerV2Control } from '../controls/ColorPickerV2Control.js';
import { LightControllerV2Control, type LightMood } from '../controls/LightControllerV2Control.js';
import { SwitchControl } from '../controls/SwitchControl.js';
import { AudioZoneV2Control } from '../controls/generated/AudioZoneV2Control.js';
import { PresenceDetectorControl } from '../controls/generated/PresenceDetectorControl.js';
import type { Control } from '../structure/Control.js';
import type { Room } from '../structure/Room.js';

/** The (read-only) live state of a room-level capability, with the item that provides it. */
export interface ReadableCapability<T> {
  /** Whether the room has a source for this capability. */
  readonly available: boolean;
  /** The primary item providing this capability, if any (transparency / escape hatch). */
  readonly source: ControlHandle | undefined;
  /** Every item contributing to this capability. */
  readonly sources: ControlHandle[];
  /** The current value, or `undefined` when unavailable / not yet known. */
  get(): T | undefined;
  /** Observe changes; the callback gets the fresh value. Returns an unsubscribe function. */
  onChange(listener: (value: T | undefined) => void): () => void;
}

/** A {@link ReadableCapability} that can also be driven. */
export interface WritableCapability<TGet, TSet = TGet> extends ReadableCapability<TGet> {
  set(value: TSet): Promise<void>;
}

/** A room's audio state (best-effort, from an AudioZoneV2). */
export interface RoomAudioState {
  playing: boolean;
  volume: number | undefined;
  power: boolean | undefined;
}
/** A room audio command (apply playing and/or volume). */
export interface RoomAudioCommand {
  playing?: boolean;
  volume?: number;
}

class Capability<TGet, TSet = TGet> implements WritableCapability<TGet, TSet> {
  constructor(
    readonly sources: ControlHandle[],
    private readonly reader: () => TGet | undefined,
    private readonly observed: Array<{ handle: ControlHandle; state: string }>,
    private readonly writer?: (value: TSet) => Promise<void>,
  ) {}

  get available(): boolean {
    return this.sources.length > 0;
  }
  get source(): ControlHandle | undefined {
    return this.sources[0];
  }
  get(): TGet | undefined {
    return this.available ? this.reader() : undefined;
  }
  onChange(listener: (value: TGet | undefined) => void): () => void {
    const offs = this.observed
      .filter(({ handle, state }) => handle.state(state) !== undefined)
      .map(({ handle, state }) => handle.onState(state, () => listener(this.get()), { emitCurrent: false }));
    return () => offs.forEach((off) => off());
  }
  async set(value: TSet): Promise<void> {
    if (this.writer) await this.writer(value);
  }
}

const NONE = new Capability<never>([], () => undefined, []);

/** Minimal client surface a RoomView needs (avoids a circular import). */
export interface RoomItemSource {
  itemsInRoom(room: string): ControlHandle[];
  /** Resolve a control (e.g. a light controller's sub-control output) to a typed handle. */
  item(control: Control): ControlHandle | undefined;
}

/**
 * A room's lighting: the individual lamps (each separately controllable) plus the
 * moods/scenes that set them all at once. Backed by the room's LightControllerV2(s)
 * — whose sub-controls are the lamps — and any standalone dimmers/switches.
 */
export class RoomLighting {
  constructor(
    private readonly controllers: LightControllerV2Control[],
    private readonly standalone: ControlHandle[],
    private readonly resolveSub: (control: Control) => ControlHandle | undefined,
  ) {}

  /** Whether the room has any lighting at all. */
  get available(): boolean {
    return this.controllers.length > 0 || this.standalone.length > 0;
  }

  /** The individual, separately-controllable lamps — the controller master dimmer is excluded. */
  get lights(): ControlHandle[] {
    const subs = this.controllers.flatMap((lc) => {
      const masterUuid = lc.masterDimmerUuid;
      return [...lc.control.subControls.values()]
        .filter((c) => c.uuidAction !== masterUuid) // the master dims all together, not a lamp
        .map((c) => this.resolveSub(c))
        .filter((h): h is ControlHandle => h !== undefined && isLamp(h));
    });
    return [...subs, ...this.standalone];
  }

  /** The controller master dimmers (each dims all of its circuits together). */
  get masters(): DimmerControl[] {
    return this.controllers
      .map((lc) => {
        const uuid = lc.masterDimmerUuid;
        const sub = uuid ? lc.control.subControls.get(uuid) : undefined;
        return sub ? this.resolveSub(sub) : undefined;
      })
      .filter((h): h is DimmerControl => h instanceof DimmerControl);
  }

  /** Overall brightness (%) from the master dimmer, if the room has one. */
  get brightness(): number | undefined {
    return this.masters[0]?.position;
  }

  /** True if any lamp (or a master dimmer) is on, falling back to the controller's active scene. */
  get isOn(): boolean | undefined {
    const all = [...this.lights, ...this.masters];
    if (all.length) return all.some(lampIsOn);
    // No readable lamps — use the controller's active scene (Loxone all-off mood is 778; 0 = off).
    const controller = this.controllers[0];
    if (controller) return (controller.activeMoods ?? []).some((id) => id !== 778 && id !== 0);
    return undefined;
  }

  /** The lighting scenes available in the room (from its light controller). */
  get moods(): LightMood[] {
    return this.controllers[0]?.moods ?? [];
  }

  /** The active scene, if a light controller is present. */
  get activeMood(): LightMood | undefined {
    return this.controllers[0]?.activeMood;
  }

  /** Applies a scene to the whole room by mood name (case-insensitive) or id. */
  async setMood(mood: string | number): Promise<void> {
    const lc = this.controllers[0];
    if (!lc) return;
    if (typeof mood === 'string') await lc.selectMoodByName(mood);
    else await lc.selectMood(mood);
  }

  /** Turns every lamp on. */
  async on(): Promise<void> {
    await Promise.all(this.lights.map((h) => (h instanceof DimmerControl ? h.on() : h instanceof SwitchControl ? h.set(true) : Promise.resolve())));
  }

  /** Turns the room's lighting off (scene-off on controllers + standalone lamps). */
  async off(): Promise<void> {
    await Promise.all([
      ...this.controllers.map((lc) => lc.allOff()),
      ...this.standalone.map((h) => (h instanceof DimmerControl ? h.off() : h instanceof SwitchControl ? h.set(false) : Promise.resolve())),
    ]);
  }

  /**
   * Sets the room brightness (%). Prefers the controller master dimmer(s) — which
   * dim all circuits together — and only falls back to setting each dimmable lamp
   * when the room has no master.
   */
  async setBrightness(percent: number): Promise<void> {
    const masters = this.masters;
    const targets = masters.length
      ? masters
      : this.lights.filter((h): h is DimmerControl => h instanceof DimmerControl);
    await Promise.all(targets.map((d) => d.setPosition(percent)));
  }

  /** Observe lighting changes (any lamp, or the active scene). */
  onChange(listener: () => void): () => void {
    const sub = (h: ControlHandle, state: string): (() => void) =>
      h.state(state) ? h.onState(state, () => listener(), { emitCurrent: false }) : () => {};
    const offs = [
      ...this.lights.map((h) => sub(h, h instanceof DimmerControl ? 'position' : 'active')),
      ...this.masters.map((m) => sub(m, 'position')),
      ...this.controllers.map((lc) => sub(lc, 'activeMoods')),
    ];
    return () => offs.forEach((off) => off());
  }
}

function isLamp(h: ControlHandle): boolean {
  return h instanceof DimmerControl || h instanceof SwitchControl || h instanceof ColorPickerV2Control;
}
function lampIsOn(h: ControlHandle): boolean {
  if (h instanceof DimmerControl) return (h.position ?? 0) > 0;
  if (h instanceof SwitchControl) return h.isOn === true;
  return false;
}

/**
 * A semantic, navigable view of a single room: its items plus best-effort
 * capability accessors (temperature, presence, lighting, audio, …) that the
 * library derives from the room's controls. Capabilities are heuristic — they
 * expose their {@link ReadableCapability.source} and degrade to `undefined` when
 * the room has no matching control; use {@link items} for precise access.
 */
export class RoomView {
  constructor(
    private readonly client: RoomItemSource,
    /** The underlying structure room. */
    readonly room: Room,
  ) {}

  /** Room display name. */
  get name(): string {
    return this.room.name;
  }
  /** Room UUID. */
  get uuid(): string {
    return this.room.uuid;
  }
  /** All typed item handles in this room. */
  get items(): ControlHandle[] {
    return this.client.itemsInRoom(this.room.name);
  }
  /** Items in this room of a given control type. */
  itemsOfType(type: string): ControlHandle[] {
    return this.items.filter((h) => h.type === type);
  }

  /**
   * Measured temperature (°C). A room thermostat (IRoomControllerV2 or v1) is
   * always preferred over a plain temperature sensor; only when the room has no
   * thermostat does it fall back to a `sensorKind === 'temperature'` sensor.
   */
  get temperature(): ReadableCapability<number> {
    const thermostat = this.items.find(
      (h) => h instanceof IRoomControllerV2Control || h instanceof IRoomControllerControl,
    );
    if (thermostat) {
      return new Capability([thermostat], () => thermostat.control.getState('tempActual')?.numericValue, [
        { handle: thermostat, state: 'tempActual' },
      ]);
    }
    const sensor = this.items.find(
      (h): h is InfoOnlyAnalogControl => h instanceof InfoOnlyAnalogControl && h.control.sensorKind === 'temperature',
    );
    return sensor ? new Capability([sensor], () => sensor.value, [{ handle: sensor, state: 'value' }]) : NONE;
  }

  /** Target temperature (°C) — readable and settable via the room controller. */
  get targetTemperature(): WritableCapability<number> {
    const irc = this.find(IRoomControllerV2Control);
    return irc
      ? new Capability(
          [irc],
          () => irc.targetTemperature,
          [{ handle: irc, state: 'tempTarget' }],
          (value: number) => irc.setComfortTemperature(value),
        )
      : NONE;
  }

  /** Relative humidity (%) — from a humidity sensor (a `%` sensor not signalling another quantity). */
  get humidity(): ReadableCapability<number> {
    const sensor = this.items.find(
      (h): h is InfoOnlyAnalogControl => h instanceof InfoOnlyAnalogControl && h.control.sensorKind === 'humidity',
    );
    return sensor ? new Capability([sensor], () => sensor.value, [{ handle: sensor, state: 'value' }]) : NONE;
  }

  /** Illuminance (Lx) — from an illuminance sensor. */
  get brightness(): ReadableCapability<number> {
    const sensor = this.items.find(
      (h): h is InfoOnlyAnalogControl => h instanceof InfoOnlyAnalogControl && h.control.sensorKind === 'illuminance',
    );
    return sensor ? new Capability([sensor], () => sensor.value, [{ handle: sensor, state: 'value' }]) : NONE;
  }

  /** Presence — true if any presence detector in the room is active. */
  get presence(): ReadableCapability<boolean> {
    const detectors = this.items.filter((h): h is PresenceDetectorControl => h instanceof PresenceDetectorControl);
    if (detectors.length === 0) return NONE;
    return new Capability(
      detectors,
      () => detectors.some((d) => d.active === true),
      detectors.map((d) => ({ handle: d, state: 'active' })),
    );
  }

  /**
   * Room lighting: the individual lamps (each separately controllable) plus the
   * moods/scenes that set them at once. See {@link RoomLighting}.
   */
  get lighting(): RoomLighting {
    const controllers = this.items.filter((h): h is LightControllerV2Control => h instanceof LightControllerV2Control);
    // Standalone lamps in the room (not owned by a controller): dimmers + lights-category switches.
    const standalone = this.items.filter(
      (h) => h instanceof DimmerControl || (h instanceof SwitchControl && h.control.category?.type === 'lights'),
    );
    return new RoomLighting(controllers, standalone, (control) => this.client.item(control));
  }

  /** The individual lamps in the room (shortcut for `lighting.lights`). */
  get lights(): ControlHandle[] {
    return this.lighting.lights;
  }

  /** Audio — from an AudioZoneV2: playing/volume/power, and play/pause + volume control. */
  get audio(): WritableCapability<RoomAudioState, RoomAudioCommand> {
    const zone = this.find(AudioZoneV2Control);
    if (!zone) return NONE as unknown as WritableCapability<RoomAudioState, RoomAudioCommand>;
    return new Capability<RoomAudioState, RoomAudioCommand>(
      [zone],
      () => ({ playing: zone.playState === 2, volume: zone.volume, power: zone.power }),
      [
        { handle: zone, state: 'playState' },
        { handle: zone, state: 'volume' },
        { handle: zone, state: 'power' },
      ],
      async (cmd: RoomAudioCommand) => {
        if (cmd.playing !== undefined) await (cmd.playing ? zone.play() : zone.pause());
        if (cmd.volume !== undefined) await zone.setVolume(cmd.volume);
      },
    );
  }

  private find<T extends ControlHandle>(Ctor: new (...args: never[]) => T): T | undefined {
    return this.items.find((h): h is T => h instanceof Ctor);
  }
}
