import { Authenticator } from './auth/Authenticator.js';
import type { TokenInfo } from './auth/TokenManager.js';
import type { LoxoneClientEvents } from './client/ClientEvents.js';
import { type LoxoneClientOptions, resolveOptions, type ResolvedClientOptions } from './client/ClientOptions.js';
import { ClientState } from './client/ClientState.js';
import { LoxoneCommandError, LoxoneStateError, LoxoneUnsupportedVersionError } from './errors.js';
import type { Logger } from './logging/Logger.js';
import type { DaytimerEvent } from './protocol/events/DaytimerEvent.js';
import type { LoxoneEvent } from './protocol/events/LoxoneEvent.js';
import { TextEvent } from './protocol/events/TextEvent.js';
import { ValueEvent } from './protocol/events/ValueEvent.js';
import type { WeatherEvent } from './protocol/events/WeatherEvent.js';
import type { FileMessage } from './protocol/messages/FileMessage.js';
import type { TextMessage } from './protocol/messages/TextMessage.js';
import { Uuid } from './protocol/messages/Uuid.js';
import { type MiniserverApiInfo, HttpClient } from './transport/HttpClient.js';
import { WebSocketConnection } from './transport/WebSocketConnection.js';
import { Control } from './structure/Control.js';
import { State } from './structure/State.js';
import { StructureModel } from './structure/StructureModel.js';
import type { Room } from './structure/Room.js';
import { type ControlHistoryEntry, parseControlHistory } from './structure/history.js';
import {
  decodeBinaryStatistics,
  parseStatisticInfo,
  type StatisticGroupInfo,
  type StatisticPoint,
  type StatisticQuery,
  toUnixSeconds,
} from './structure/statistics.js';
import { RoomView } from './client/RoomView.js';
import {
  type ControlChange,
  type ControlCommandExecutor,
  type ControlHandle,
  GenericControl,
  makeControlChange,
} from './controls/ControlHandle.js';
import { SwitchControl } from './controls/SwitchControl.js';
import { DimmerControl } from './controls/DimmerControl.js';
import { EIBDimmerControl } from './controls/EIBDimmerControl.js';
import { JalousieControl } from './controls/JalousieControl.js';
import { LightControllerV2Control } from './controls/LightControllerV2Control.js';
import { GateControl } from './controls/GateControl.js';
import { WindowControl } from './controls/WindowControl.js';
import { PushbuttonControl } from './controls/PushbuttonControl.js';
import { ColorPickerV2Control } from './controls/ColorPickerV2Control.js';
import { IRoomControllerV2Control } from './controls/IRoomControllerV2Control.js';
import { InfoOnlyAnalogControl, InfoOnlyDigitalControl, InfoOnlyTextControl } from './controls/InfoControls.js';
import { TrackerControl } from './controls/TrackerControl.js';
import { TextStateControl } from './controls/TextStateControl.js';
import { CONTROL_WRAPPERS } from './controls/registry.js';
import { GENERATED_ACCESSORS, type GeneratedControlAccessors } from './controls/generated/accessors.js';
import type { LoxoneStructureFile } from './structure/types.js';
import { TypedEventEmitter } from './utils/TypedEventEmitter.js';
import { EventEmitter } from 'node:events';

const MIN_SUPPORTED_VERSION = '11.2';
const KEEPALIVE_TIMEOUT_MS = 5_000;

/** Something that can be watched/subscribed: a state UUID string, a {@link Uuid}, a {@link State}, or a {@link Control} (all its states). */
export type WatchTarget = string | Uuid | State | Control;

/**
 * High-level client for a Loxone Miniserver.
 *
 * Handles connecting, the encrypted token handshake, structure-file parsing,
 * live binary state updates, and sending (optionally visu-password-secured)
 * control commands — with optional keepalive and auto-reconnect.
 *
 * @example
 * ```ts
 * const client = new LoxoneClient('192.168.1.10', 'user', 'pass');
 * await client.connect();                 // structure loaded + live updates started
 * for (const item of client.itemsInRoom('Living Room')) {
 *   item.onChange((c) => console.log(`${item.name}.${c.state} = ${c.value}`));
 * }
 * await client.asSwitch('Lamp')?.on();
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- intentional: generated asX accessors are merged in (see end of file)
export class LoxoneClient extends TypedEventEmitter<LoxoneClientEvents> implements ControlCommandExecutor {
  private readonly options: ResolvedClientOptions;
  private readonly log: Logger;
  private readonly connection: WebSocketConnection;
  private readonly http: HttpClient;

  private auth: Authenticator | undefined;
  private _state: ClientState = ClientState.Disconnected;
  private _structure: StructureModel | undefined;
  private _apiInfo: MiniserverApiInfo | undefined;
  /** Typed handles cached by control UUID, so `item()`/`items()` return stable instances. */
  private readonly itemCache = new Map<string, ControlHandle>();
  /** RoomView instances cached by room UUID, so `room()`/`rooms` return stable instances. */
  private readonly roomCache = new Map<string, RoomView>();

  private useEncryption: boolean;
  private updatesEnabled = false;
  private intentionalDisconnect = false;
  private reconnecting = false;
  /** Whether the connection ever reached the ready state (gates auto-reconnect). */
  private wasReady = false;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private statesSettledFired = false;
  private currentReconnectDelay: number;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private lastToken: string | undefined;

  /** Internal value/text state-event stream (not part of the public event API). */
  private readonly stream = new EventEmitter();
  /** Active subscribe() entries, served by a single shared dispatcher. */
  private readonly subscriptions = new Set<{ uuids: Set<string>; listener: (event: ValueEvent | TextEvent) => void }>();
  private subscriptionDispatcherAttached = false;

  constructor(
    private readonly host: string,
    private readonly username: string,
    private readonly password: string,
    options: LoxoneClientOptions = {},
  ) {
    super();
    this.options = resolveOptions(options);
    this.log = this.options.logger;
    this.useEncryption = this.options.forceEncryption || !this.options.useTls;
    this.currentReconnectDelay = this.options.reconnectDelayMs;

    this.http = new HttpClient(host, this.options.useTls, this.options.fetchImpl);
    this.connection = new WebSocketConnection(host, this.options.useTls, this.log, this.options.commandTimeoutMs);
    this.wireConnection();
  }

  // --- public state -------------------------------------------------------

  /** Current lifecycle state. */
  get state(): ClientState {
    return this._state;
  }

  /** The parsed structure model, once {@link loadStructure} has been called. */
  get structure(): StructureModel | undefined {
    return this._structure;
  }

  /** Miniserver info from the `apiKey` reachability check, populated on connect. */
  get apiInfo(): MiniserverApiInfo | undefined {
    return this._apiInfo;
  }

  /** The current authentication token, if any. */
  get token(): string | undefined {
    return this.auth?.tokens.token;
  }

  /** Details of the current token, if any. */
  get tokenInfo(): TokenInfo | undefined {
    return this.auth?.tokens.info;
  }

  // --- connection lifecycle ----------------------------------------------

  /**
   * Connects, performs the encrypted token handshake, and becomes ready.
   *
   * An explicit `connect()` call **rejects** if it cannot reach the ready state,
   * regardless of `autoReconnect` — so `await client.connect()` is safe to rely
   * on. Automatic reconnection only applies to an *established* connection that
   * later drops (and those background attempts never throw).
   *
   * @param existingToken Optional previously-acquired token to authenticate with
   *   instead of using the password (falls back to password auth if rejected).
   */
  async connect(existingToken?: string): Promise<void> {
    return this.attemptConnect(existingToken, false);
  }

  /**
   * @param isReconnect Whether this attempt was started by the background
   *   reconnect timer (true) or by an explicit `connect()` call (false). Captured
   *   at entry so a `disconnected` event racing in mid-handshake can't flip the
   *   throw-vs-swallow decision.
   */
  private async attemptConnect(existingToken: string | undefined, isReconnect: boolean): Promise<void> {
    if (this._state === ClientState.Ready || this._state === ClientState.Connecting) {
      this.log.warn(`connect() ignored in state "${this._state}"`);
      return;
    }
    this.intentionalDisconnect = false;
    this.setState(isReconnect ? ClientState.Reconnecting : ClientState.Connecting);

    try {
      this._apiInfo = await this.checkReachability();

      await this.connection.connect();
      this.setState(ClientState.Connected);
      this.emit('connected');

      this.setState(ClientState.Authenticating);
      const userOnTokenChanged = this.options.auth.onTokenChanged;
      this.auth = new Authenticator(this.connection, this.http, this.username, this.password, this.log, {
        ...this.options.auth,
        onTokenChanged: (info) => {
          this.lastToken = info.token;
          // Isolate user code so a throwing callback/listener can't break auth.
          try {
            userOnTokenChanged?.(info);
            this.emit('tokenChanged', info);
          } catch (error) {
            this.log.error(`tokenChanged listener threw: ${(error as Error).message}`);
          }
        },
      });
      const tokenSource = existingToken ?? this.lastToken;
      const info = tokenSource ? await this.auth.authenticate(tokenSource) : await this.auth.authenticate();
      this.lastToken = info.token;
      this.emit('authenticated');
      if (info.unsecurePassword) {
        this.log.warn('The account password is considered weak; please change it in Loxone Config.');
      }

      if (this.options.keepAlive) {
        this.connection.startKeepAlive(this.options.keepAliveIntervalMs, KEEPALIVE_TIMEOUT_MS);
      }

      this.resetReconnectBackoff();

      // Load the structure as part of becoming ready, so `structure`/`items()`
      // are available the moment connect() resolves and 'ready' fires. The WS is
      // authenticated by now, so this works before the Ready state is set.
      if (this.options.loadStructureOnConnect && !this._structure) {
        await this.fetchStructure();
      }

      this.wasReady = true;
      this.setState(ClientState.Ready);
      this.emit('ready');

      // Start the live stream automatically (or resume it after a reconnect).
      if (this.updatesEnabled || this.options.enableUpdatesOnConnect) {
        await this.startUpdates();
      }
    } catch (error) {
      this.setState(ClientState.Error);
      if (isReconnect) {
        // A background reconnect attempt failed: surface it (if anyone is
        // listening) and schedule the next attempt; never throw here.
        this.emitError(error as Error);
        this.scheduleReconnect();
      } else {
        // An explicit connect() failed: reject so the caller can handle it.
        throw error;
      }
    }
  }

  /**
   * Disconnects the client.
   * @param preserveToken When true the token is kept (and reused on the next
   *   connect); otherwise it is killed on the Miniserver. Default false.
   */
  async disconnect(preserveToken = false): Promise<void> {
    this.intentionalDisconnect = true;
    this.wasReady = false;
    this.updatesEnabled = false;
    this.resetSettle();
    this.cancelReconnect();
    this.setState(ClientState.Disconnecting);

    this.auth?.tokens.clearRefresh();
    if (!preserveToken) {
      await this.auth?.tokens.killToken().catch(() => undefined);
      this.lastToken = undefined;
    }
    this.auth?.reset();
    this.connection.close('Disconnect requested by client');
    this.setState(ClientState.Disconnected);
  }

  private async checkReachability(): Promise<MiniserverApiInfo> {
    const info = await this.http.getApiInfo();
    this.log.info(`Miniserver ${info.serialNumber} firmware ${info.version} (TLS: ${this.options.useTls})`);
    if (!isVersionAtLeast(info.version, MIN_SUPPORTED_VERSION)) {
      throw new LoxoneUnsupportedVersionError(info.version, MIN_SUPPORTED_VERSION);
    }
    if (info.local === false) {
      this.log.debug('Miniserver reports this connection as non-local');
    }
    if (info.hasEventSlots === false) {
      this.log.warn('Miniserver reports no free event slots; live updates may be unavailable');
    }
    return info;
  }

  // --- structure ----------------------------------------------------------

  /**
   * Downloads and parses `LoxAPP3.json`, populating {@link structure}. Called
   * automatically during {@link connect} (unless `loadStructureOnConnect` is
   * `false`); call it manually only to force a reload after a config change.
   */
  async loadStructure(): Promise<StructureModel> {
    this.ensureReady('load the structure file');
    return this.fetchStructure();
  }

  /** Fetches + parses the structure without the ready-state guard (used during connect). */
  private async fetchStructure(): Promise<StructureModel> {
    const file = await this.connection.sendFileCommand('data/LoxAPP3.json');
    const raw = file.json<LoxoneStructureFile>();
    this._structure = StructureModel.parse(raw, this.log);
    this.itemCache.clear(); // handles from a previous structure are stale
    this.roomCache.clear();
    this.log.info(`Loaded structure file (lastModified ${this._structure.lastModified})`);
    return this._structure;
  }

  // --- live updates -------------------------------------------------------

  /**
   * Enables the live binary state stream (fed to `item.onChange`/`onState`,
   * `onAnyChange`, and `subscribe`), firing `statesSettled` once the initial
   * burst quiets down. Done automatically during {@link connect} unless
   * `enableUpdatesOnConnect` is `false`; call it manually only in that case.
   */
  async enableUpdates(): Promise<void> {
    this.ensureReady('enable updates');
    await this.startUpdates();
  }

  /** Sends `enablebinstatusupdate` and (re)arms the settle signal. Assumes the WS is ready. */
  private async startUpdates(): Promise<void> {
    this.updatesEnabled = true;
    this.resetSettle();
    await this.connection.sendCommand('jdev/sps/enablebinstatusupdate', { encrypt: false });
    this.scheduleSettle();
  }

  /** (Re)arms the debounced `statesSettled` signal; fires once per update session. */
  private scheduleSettle(): void {
    if (this.statesSettledFired) return;
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = undefined;
      this.statesSettledFired = true;
      this.emit('statesSettled');
    }, this.options.settleDebounceMs);
    if (typeof this.settleTimer.unref === 'function') this.settleTimer.unref();
  }

  private resetSettle(): void {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
      this.settleTimer = undefined;
    }
    this.statesSettledFired = false;
  }

  /**
   * Lower-level subscription primitive (most consumers use {@link item}().onChange
   * /onState instead). Invokes `listener` only for the given target's state(s);
   * accepts a state UUID string, a {@link Uuid}, a {@link State}, or a {@link
   * Control} (all of its states). A single shared dispatcher fans out, so many
   * subscriptions don't accumulate emitter listeners.
   *
   * By default the listener is invoked immediately with each state's current
   * (last-known) value (`emitCurrent`), then on every change. Returns an
   * unsubscribe function.
   */
  subscribe(
    target: WatchTarget | WatchTarget[],
    listener: (event: ValueEvent | TextEvent) => void,
    options: { emitCurrent?: boolean } = {},
  ): () => void {
    const uuids = new Set(this.resolveStateUuids(target));
    const entry = { uuids, listener };
    this.subscriptions.add(entry);
    this.ensureSubscriptionDispatcher();
    if (options.emitCurrent ?? true) this.emitCurrentValues(uuids, listener);
    return () => {
      this.subscriptions.delete(entry);
    };
  }

  /**
   * Observe EVERY state change across the whole Miniserver — the firehose, at the
   * change level. The listener gets a {@link ControlChange} (state name, raw
   * `value`, decoded `formatted`/`boolean`, the raw `event`, and the `item`) for
   * each value/text update of a control present in the structure. Returns an
   * unsubscribe function.
   */
  onAnyChange(listener: (change: ControlChange) => void): () => void {
    const handler = (event: ValueEvent | TextEvent): void => {
      const control = event.control;
      if (!control) return; // a state not present in the structure — skip
      try {
        listener(makeControlChange(event, this.item(control)!));
      } catch (error) {
        this.log.error(`onAnyChange listener threw: ${(error as Error).message}`);
      }
    };
    this.stream.on('value', handler);
    this.stream.on('text', handler);
    return () => {
      this.stream.off('value', handler);
      this.stream.off('text', handler);
    };
  }

  /** Synchronously delivers the last-known value for each given state, if any. */
  private emitCurrentValues(uuids: Iterable<string>, listener: (event: ValueEvent | TextEvent) => void): void {
    if (!this._structure) return;
    for (const uuid of uuids) {
      const event = this._structure.getStateByUuid(uuid)?.latestEvent;
      if (event instanceof ValueEvent || event instanceof TextEvent) this.safeInvoke(listener, event);
    }
  }

  /** Attaches the single value/text dispatcher that fans out to subscribe() entries. */
  private ensureSubscriptionDispatcher(): void {
    if (this.subscriptionDispatcherAttached) return;
    this.subscriptionDispatcherAttached = true;
    const dispatch = (event: ValueEvent | TextEvent): void => {
      for (const entry of this.subscriptions) {
        if (entry.uuids.has(event.uuid.value)) this.safeInvoke(entry.listener, event);
      }
    };
    this.stream.on('value', dispatch);
    this.stream.on('text', dispatch);
  }

  /** Invokes a subscriber listener, isolating a throw so it can't break the dispatch loop. */
  private safeInvoke(listener: (event: ValueEvent | TextEvent) => void, event: ValueEvent | TextEvent): void {
    try {
      listener(event);
    } catch (error) {
      this.log.error(`subscribe listener threw: ${(error as Error).message}`);
    }
  }

  /** Resolves watch targets (UUID string / Uuid / State / Control) to state UUID strings. */
  private resolveStateUuids(target: WatchTarget | WatchTarget[]): string[] {
    const targets = Array.isArray(target) ? target : [target];
    const out: string[] = [];
    for (const t of targets) {
      if (typeof t === 'string') out.push(t);
      else if (t instanceof Uuid) out.push(t.value);
      else if (t instanceof State) out.push(t.uuid);
      else if (t instanceof Control) out.push(...t.statesByUuid.keys());
    }
    return out;
  }

  // --- commands -----------------------------------------------------------

  /** Sends a raw text command and returns the response. */
  async sendCommand(command: string, options: { encrypt?: boolean; timeoutMs?: number } = {}): Promise<TextMessage> {
    this.ensureReady('send a command');
    return this.connection.sendCommand(command, {
      encrypt: options.encrypt ?? this.useEncryption,
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    });
  }

  /**
   * Downloads a file from the Miniserver — the escape hatch for anything not
   * wrapped, e.g. an icon (`"<uuid>.svg"` / `".png"`), statistics, or a data file.
   */
  async getFile(filename: string): Promise<FileMessage> {
    this.ensureReady('download a file');
    return this.connection.sendFileCommand(filename);
  }

  /**
   * Executes a control command (`jdev/sps/io/{uuid}/{command}`).
   * @param control The control UUID, a {@link Control}, or a {@link Uuid}.
   */
  async control(control: string | Uuid | Control, command: string): Promise<TextMessage> {
    this.ensureReady('control a device');
    const resolved = this.resolveControl(control);
    const uuid = resolved?.uuidAction ?? resolveControlUuid(control);
    if (!resolved && this._structure) {
      this.log.warn(`Control "${uuid}" is not in the structure file; the command may fail`);
    }
    const response = await this.connection.sendCommand(`jdev/sps/io/${uuid}/${command}`, {
      encrypt: this.useEncryption,
    });
    if (response.code !== undefined && response.code !== 200) {
      throw new LoxoneCommandError(`Control command failed`, { code: response.code, command: `${uuid}/${command}` });
    }
    return response;
  }

  /** Executes a visu-password-secured control command. */
  async securedControl(control: string | Uuid | Control, command: string, visuPassword: string): Promise<TextMessage> {
    this.ensureReady('control a secured device');
    if (!this.auth) throw new LoxoneStateError('Not authenticated');
    const uuid = this.resolveControl(control)?.uuidAction ?? resolveControlUuid(control);
    return this.auth.secured.sendSecuredCommand(uuid, command, visuPassword, {
      encrypt: this.useEncryption,
    });
  }

  /** Verifies a visualization password without triggering any control. */
  async checkVisuPassword(visuPassword: string): Promise<boolean> {
    this.ensureReady('check the visu password');
    if (!this.auth) throw new LoxoneStateError('Not authenticated');
    return this.auth.secured.checkVisuPassword(visuPassword, { encrypt: this.useEncryption });
  }

  // --- control features ---------------------------------------------------

  /**
   * Downloads an icon by its UUID. Defaults to SVG; pass `'png'` for raster.
   * (Text/SVG icons come back as text, PNGs as binary — check `FileMessage.isBinary`.)
   */
  async getIcon(iconUuid: string, ext: 'svg' | 'png' = 'svg'): Promise<FileMessage> {
    return this.getFile(`${iconUuid}.${ext}`);
  }

  /** Returns the plaintext control notes/help text for a control, if any. */
  async getControlNotes(control: string | Uuid | Control): Promise<string | undefined> {
    const response = await this.control(control, 'controlnotes');
    return response.asString();
  }

  /** Locks a control so it can't be operated (admin only). Optional human-readable reason. */
  async lockControl(control: string | Uuid | Control, reason?: string): Promise<TextMessage> {
    const command = reason ? `lockcontrol/1/${encodeURIComponent(reason)}` : 'lockcontrol/1';
    return this.control(control, command);
  }

  /** Unlocks a previously locked control (admin only). */
  async unlockControl(control: string | Uuid | Control): Promise<TextMessage> {
    return this.control(control, 'unlockcontrol');
  }

  // --- statistics & history ----------------------------------------------

  /**
   * Fetches a control's block history (`gethistory`) — insight into why the block
   * acted as it did, as delivered by the Miniserver. Only meaningful when
   * {@link Control.hasHistory} is true; other controls reject or return `[]`.
   * Equivalent to `client.item(control).history()`.
   */
  async getControlHistory(control: string | Uuid | Control): Promise<ControlHistoryEntry[]> {
    const response = await this.control(control, 'gethistory');
    return parseControlHistory(response.jsonValue());
  }

  /**
   * Returns the V2 statistic groups available for a control (`getStatisticInfo`)
   * — each group's id and the date its data starts. Use a group's `id` with
   * {@link getStatistic}. Returns `[]` for controls without V2 statistics.
   */
  async getStatisticInfo(control: string | Uuid | Control): Promise<StatisticGroupInfo[]> {
    this.ensureReady('read statistic info');
    const uuid = this.resolveControl(control)?.uuidAction ?? resolveControlUuid(control);
    const response = await this.sendCommand(`jdev/sps/getStatisticInfo/${uuid}`);
    return parseStatisticInfo(response.jsonValue());
  }

  /**
   * Downloads V2 statistic data for a control over a time range and decodes the
   * binary stream into {@link StatisticPoint}s (timestamps are Unix-UTC). When
   * `query.output` is omitted, every output of the group is returned per point,
   * in the group's datapoint order. See {@link StatisticQuery}.
   */
  async getStatistic(control: string | Uuid | Control, query: StatisticQuery): Promise<StatisticPoint[]> {
    this.ensureReady('download statistics');
    const resolved = this.resolveControl(control);
    const uuid = resolved?.uuidAction ?? resolveControlUuid(control);
    const mode = query.mode ?? 'raw';
    const from = toUnixSeconds(query.from);
    const to = toUnixSeconds(query.to);
    const path =
      `jdev/sps/getStatistic/${uuid}/${mode}/${from}/${to}/${query.unit}/${query.groupId}` +
      (query.output ? `/${query.output}` : '');
    const file = await this.getFile(path);
    const valueCount = query.output
      ? 1
      : (resolved?.statisticV2?.groups.find((g) => String(g.id) === String(query.groupId))?.dataPoints.length ?? 1);
    return decodeBinaryStatistics(file.buffer, valueCount, 'unix');
  }

  /**
   * Downloads legacy (V1) statistic data for a control (`binstatisticdata`) for a
   * month (`"YYYYMM"`) or day (`"YYYYMMDD"`) and decodes it. Each point carries
   * one value per output of the control's {@link Control.statistic} configuration,
   * in that order; timestamps are Miniserver-local (Loxone epoch).
   */
  async getStatisticV1(control: string | Uuid | Control, date: string): Promise<StatisticPoint[]> {
    this.ensureReady('download statistics');
    const resolved = this.resolveControl(control);
    const uuid = resolved?.uuidAction ?? resolveControlUuid(control);
    const valueCount = resolved?.statistic?.outputs.length ?? 1;
    const file = await this.getFile(`binstatisticdata/${uuid}/${date}`);
    return decodeBinaryStatistics(file.buffer, valueCount, 'loxone');
  }

  // --- typed control wrappers --------------------------------------------

  /**
   * Wraps a control in the typed handle for its `type` (e.g. a `Switch` → a
   * {@link SwitchControl}). For control types without a dedicated wrapper a
   * {@link GenericControl} is returned, so you always get a usable handle (with
   * `send`/`state`); returns `undefined` only when the control isn't found.
   * Narrow with `instanceof`, or use the typed `asX` accessors for a precise type.
   */
  wrap(target: string | Uuid | Control): ControlHandle | undefined {
    const control = this.resolveControl(target);
    if (!control) {
      this.warnMissingControl(target);
      return undefined;
    }
    const Ctor = CONTROL_WRAPPERS[control.type] ?? GenericControl;
    return new Ctor(control, this);
  }

  // --- items: the high-level, already-typed view over the structure --------

  /**
   * Returns the typed handle ("item") for a control, by UUID, name, {@link Uuid},
   * or {@link Control}. Like {@link wrap}, but the handle is cached per control,
   * so repeated calls return the same instance (stable identity for listeners).
   * Cleared when {@link loadStructure} runs.
   */
  item(target: string | Uuid | Control): ControlHandle | undefined {
    const control = this.resolveControl(target);
    if (!control) {
      this.warnMissingControl(target);
      return undefined;
    }
    let handle = this.itemCache.get(control.uuid);
    if (!handle) {
      const Ctor = CONTROL_WRAPPERS[control.type] ?? GenericControl;
      handle = new Ctor(control, this);
      this.itemCache.set(control.uuid, handle);
    }
    return handle;
  }

  /**
   * All items as typed handles — the structure, fully processed. By default only
   * top-level controls with a real type (sub-controls and non-visualised controls
   * are skipped). Optionally filter by `type`, `room`, and/or `category` (names,
   * case-insensitive), or set `includeSubControls` to include nested controls.
   */
  items(filter: {
    type?: string;
    room?: string;
    category?: string;
    includeSubControls?: boolean;
  } = {}): ControlHandle[] {
    if (!this._structure) return [];
    const type = filter.type?.toLowerCase();
    const room = filter.room?.toLowerCase();
    const category = filter.category?.toLowerCase();
    const out: ControlHandle[] = [];
    for (const control of this._structure.allControls) {
      if (!control.type) continue; // not visualised
      if (!filter.includeSubControls && control.parent) continue;
      if (type && control.type.toLowerCase() !== type) continue;
      if (room && control.room?.name.toLowerCase() !== room) continue;
      if (category && control.category?.name.toLowerCase() !== category) continue;
      const handle = this.item(control);
      if (handle) out.push(handle);
    }
    return out;
  }

  /** All items in a room (by room name, case-insensitive). */
  itemsInRoom(room: string): ControlHandle[] {
    return this.items({ room });
  }

  /** All items in a category (by category name, case-insensitive). */
  itemsInCategory(category: string): ControlHandle[] {
    return this.items({ category });
  }

  /** Items grouped by room name (controls without a room land under `"Unassigned"`). */
  itemsByRoom(): Map<string, ControlHandle[]> {
    return this.groupItems((h) => h.roomName ?? 'Unassigned');
  }

  /** Items grouped by category name (uncategorised controls land under `"Uncategorised"`). */
  itemsByCategory(): Map<string, ControlHandle[]> {
    return this.groupItems((h) => h.categoryName ?? 'Uncategorised');
  }

  private groupItems(key: (handle: ControlHandle) => string): Map<string, ControlHandle[]> {
    const groups = new Map<string, ControlHandle[]>();
    for (const handle of this.items()) {
      const k = key(handle);
      const bucket = groups.get(k);
      if (bucket) bucket.push(handle);
      else groups.set(k, [handle]);
    }
    return groups;
  }

  // --- rooms: semantic, navigable room views -------------------------------

  /** Every (real) room as a {@link RoomView} (items + derived capabilities). */
  get rooms(): RoomView[] {
    if (!this._structure) return [];
    return [...this._structure.rooms.values()]
      .filter((room) => room.uuid !== Uuid.EMPTY.value) // skip the synthetic "Unassigned" room
      .map((room) => this.roomView(room));
  }

  /** A single room by name (case-insensitive), or `undefined`. */
  room(name: string): RoomView | undefined {
    if (!this._structure) return undefined;
    const wanted = name.toLowerCase();
    const room = [...this._structure.rooms.values()].find((r) => r.name.toLowerCase() === wanted);
    return room ? this.roomView(room) : undefined;
  }

  private roomView(room: Room): RoomView {
    let view = this.roomCache.get(room.uuid);
    if (!view) {
      view = new RoomView(this, room);
      this.roomCache.set(room.uuid, view);
    }
    return view;
  }

  /** Returns a typed {@link SwitchControl} wrapper, or `undefined` if not found / wrong type. */
  asSwitch(target: string | Uuid | Control): SwitchControl | undefined {
    return this.wrapAs(target, SwitchControl);
  }
  /** Returns a typed {@link DimmerControl} wrapper, or `undefined`. */
  asDimmer(target: string | Uuid | Control): DimmerControl | undefined {
    return this.wrapAs(target, DimmerControl);
  }
  /** Returns a typed {@link EIBDimmerControl} (KNX/EIB dimmer) wrapper, or `undefined`. */
  asEIBDimmer(target: string | Uuid | Control): EIBDimmerControl | undefined {
    return this.wrapAs(target, EIBDimmerControl);
  }
  /** Returns a typed {@link JalousieControl} (blinds) wrapper, or `undefined`. */
  asJalousie(target: string | Uuid | Control): JalousieControl | undefined {
    return this.wrapAs(target, JalousieControl);
  }
  /** Returns a typed {@link LightControllerV2Control} wrapper, or `undefined`. */
  asLightController(target: string | Uuid | Control): LightControllerV2Control | undefined {
    return this.wrapAs(target, LightControllerV2Control);
  }
  /** Returns a typed {@link GateControl} wrapper, or `undefined`. */
  asGate(target: string | Uuid | Control): GateControl | undefined {
    return this.wrapAs(target, GateControl);
  }
  /** Returns a typed {@link WindowControl} wrapper, or `undefined`. */
  asWindow(target: string | Uuid | Control): WindowControl | undefined {
    return this.wrapAs(target, WindowControl);
  }
  /** Returns a typed {@link PushbuttonControl} wrapper, or `undefined`. */
  asPushbutton(target: string | Uuid | Control): PushbuttonControl | undefined {
    return this.wrapAs(target, PushbuttonControl);
  }
  /** Returns a typed {@link ColorPickerV2Control} wrapper, or `undefined`. */
  asColorPicker(target: string | Uuid | Control): ColorPickerV2Control | undefined {
    return this.wrapAs(target, ColorPickerV2Control);
  }
  /** Returns a typed {@link IRoomControllerV2Control} (climate) wrapper, or `undefined`. */
  asRoomController(target: string | Uuid | Control): IRoomControllerV2Control | undefined {
    return this.wrapAs(target, IRoomControllerV2Control);
  }
  /** Returns a typed {@link InfoOnlyAnalogControl} (read-only sensor) wrapper, or `undefined`. */
  asInfoAnalog(target: string | Uuid | Control): InfoOnlyAnalogControl | undefined {
    return this.wrapAs(target, InfoOnlyAnalogControl);
  }
  /** Returns a typed {@link InfoOnlyDigitalControl} (read-only sensor) wrapper, or `undefined`. */
  asInfoDigital(target: string | Uuid | Control): InfoOnlyDigitalControl | undefined {
    return this.wrapAs(target, InfoOnlyDigitalControl);
  }
  /** Returns a typed {@link InfoOnlyTextControl} (read-only sensor) wrapper, or `undefined`. */
  asInfoText(target: string | Uuid | Control): InfoOnlyTextControl | undefined {
    return this.wrapAs(target, InfoOnlyTextControl);
  }
  /** Returns a typed {@link TrackerControl} (parsed log entries) wrapper, or `undefined`. */
  asTracker(target: string | Uuid | Control): TrackerControl | undefined {
    return this.wrapAs(target, TrackerControl);
  }
  /** Returns a typed {@link TextStateControl} (status text + icon/colour) wrapper, or `undefined`. */
  asTextState(target: string | Uuid | Control): TextStateControl | undefined {
    return this.wrapAs(target, TextStateControl);
  }

  private resolveControl(target: string | Uuid | Control): Control | undefined {
    if (target instanceof Control) return target;
    if (target instanceof Uuid) return this._structure?.getControl(target.value);
    // A string is tried as a UUID first, then (case-insensitively) as a control name.
    return this._structure?.getControl(target) ?? this._structure?.getControlByName(target);
  }

  /**
   * Wraps a control in a specific typed handle, fully type-safe — the return type
   * is inferred from the wrapper class. Returns `undefined` (and logs) if the
   * control isn't found or isn't of that wrapper's type. This is the general,
   * type-safe primitive behind every `asX` accessor; use it for any wrapper,
   * including generated and custom ones: `client.wrapAs(uuid, AlarmControl)`.
   */
  wrapAs<T extends ControlHandle>(
    target: string | Uuid | Control,
    Ctor: { controlType: string; new (control: Control, executor: ControlCommandExecutor): T },
  ): T | undefined {
    const control = this.resolveControl(target);
    if (!control) {
      this.warnMissingControl(target);
      return undefined;
    }
    if (control.type !== Ctor.controlType) {
      this.log.warn(`Control "${control.name}" is a ${control.type}, not a ${Ctor.controlType}`);
      return undefined;
    }
    return new Ctor(control, this);
  }

  private warnMissingControl(target: string | Uuid | Control): void {
    const id = target instanceof Control ? target.uuid : target instanceof Uuid ? target.value : target;
    this.log.warn(`No control "${id}" in the structure${this._structure ? '' : ' (structure not loaded — call loadStructure())'}`);
  }

  // --- token operations ---------------------------------------------------

  /** Refreshes the current token, extending its lifespan. */
  async refreshToken(): Promise<TokenInfo> {
    if (!this.auth) throw new LoxoneStateError('Not authenticated');
    const info = await this.auth.tokens.refreshToken();
    this.lastToken = info.token;
    return info;
  }

  /** Checks whether the current (or supplied) token is still valid. */
  async checkToken(token?: string): Promise<boolean> {
    if (!this.auth) throw new LoxoneStateError('Not authenticated');
    return this.auth.tokens.checkToken(token);
  }

  // --- internals ----------------------------------------------------------

  private wireConnection(): void {
    this.connection.on('disconnected', (reason) => {
      this.emit('disconnected', reason);
      if (this._state !== ClientState.Error && this._state !== ClientState.Disconnecting) {
        this.setState(ClientState.Disconnected);
      }
      // Auto-reconnect only for an *established* connection that dropped — not for
      // a drop during the initial handshake (that path rejects connect() instead).
      if (!this.intentionalDisconnect && this.wasReady) this.scheduleReconnect();
    });
    this.connection.on('error', (error) => {
      this.log.error(`Connection error: ${error.message}`);
      this.emitError(error);
    });
    this.connection.on('outOfService', () => {
      this.log.warn('Miniserver is out of service (likely a firmware update)');
      this.emit('outOfService');
    });
    this.connection.on('textMessage', (message) => this.emit('message', message));

    this.connection.on('eventTableValues', (events) => this.dispatchEvents(events, 'value'));
    this.connection.on('eventTableText', (events) => this.dispatchEvents(events, 'text'));
    this.connection.on('eventTableDaytimer', (events) => this.dispatchEvents(events, 'daytimer'));
    this.connection.on('eventTableWeather', (events) => this.dispatchEvents(events, 'weather'));
  }

  private dispatchEvents(
    events: ValueEvent[] | TextEvent[] | DaytimerEvent[] | WeatherEvent[],
    channel: 'value' | 'text' | 'daytimer' | 'weather',
  ): void {
    for (const event of events) {
      // Enrich every event so latest values (and thus the typed getters) stay
      // current; subscribe()/onChange/onAnyChange filter on top.
      this.enrich(event);
      if (channel === 'value' || channel === 'text') {
        // Internal stream: consumed by subscribe()/onChange/onAnyChange, not public.
        this.stream.emit(channel, event);
      } else {
        // daytimer/weather are not covered by onChange, so they stay public events.
        this.emit(channel, event as never);
      }
    }
    // Each incoming table re-arms the "settled" debounce (only while live).
    if (this.updatesEnabled && this._state === ClientState.Ready) this.scheduleSettle();
  }

  private enrich(event: LoxoneEvent): void {
    if (!this._structure) return;
    const state = this._structure.getStateByUuid(event.uuid.value);
    if (!state) return;
    event.state = state;
    if (this.options.trackStateValues) state.latestEvent = event;
  }

  /** Emits `'error'` only when someone is listening, to avoid Node's unhandled-'error' crash. */
  private emitError(error: Error): void {
    if (this.listenerCount('error') > 0) this.emit('error', error);
  }

  private setState(state: ClientState): void {
    if (this._state === state) return;
    this._state = state;
    this.log.debug(`State → ${state}`);
    this.emit('stateChanged', state);
  }

  private ensureReady(action: string): void {
    if (this._state !== ClientState.Ready) {
      throw new LoxoneStateError(`Cannot ${action}: client is "${this._state}", not "ready"`);
    }
  }

  private scheduleReconnect(): void {
    if (!this.options.autoReconnect || this.intentionalDisconnect || this.reconnectTimer) return;
    this.reconnecting = true;
    const delay = this.currentReconnectDelay;
    this.currentReconnectDelay = Math.min(this.currentReconnectDelay * 2, this.options.maxReconnectDelayMs);
    this.log.info(`Reconnecting in ${Math.round(delay / 1000)}s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.attemptConnect(undefined, true).catch((error: Error) => this.log.error(`Reconnect failed: ${error.message}`));
    }, delay);
    if (typeof this.reconnectTimer.unref === 'function') this.reconnectTimer.unref();
  }

  private cancelReconnect(): void {
    this.reconnecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private resetReconnectBackoff(): void {
    this.reconnecting = false;
    this.currentReconnectDelay = this.options.reconnectDelayMs;
  }
}

// The generated typed `asX` accessors (asAlarm, asMeter, ...) are merged onto the
// client: the interface adds the precise return types, and the loop installs the
// implementations on the prototype (each delegates to the type-safe wrapAs).
/* eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging */
export interface LoxoneClient extends GeneratedControlAccessors {}

for (const [method, Ctor] of Object.entries(GENERATED_ACCESSORS)) {
  Object.defineProperty(LoxoneClient.prototype, method, {
    value(this: LoxoneClient, target: string | Uuid | Control): ControlHandle | undefined {
      return this.wrapAs(target, Ctor);
    },
    enumerable: false, // match normal class methods; don't leak into for...in
    writable: true,
    configurable: true,
  });
}

function resolveControlUuid(control: string | Uuid | Control): string {
  if (typeof control === 'string') return control;
  if (control instanceof Uuid) return control.value;
  return control.uuidAction;
}

/** Compares dotted version strings; returns true if `version >= minimum`. */
function isVersionAtLeast(version: string, minimum: string): boolean {
  const v = version.split('.').map((n) => parseInt(n, 10) || 0);
  const m = minimum.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(v.length, m.length); i++) {
    const a = v[i] ?? 0;
    const b = m[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}
