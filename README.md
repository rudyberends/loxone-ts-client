# loxone-ts-client

A fully type-safe TypeScript client for communicating with **Loxone Miniservers** over HTTP and WebSocket — designed to drop cleanly into any project.

It implements the core Loxone communication protocol (V17.0): the encrypted token handshake, application-layer command encryption, live binary state updates, control commands, visualization-password–secured commands, and decoded statistics & control history — plus a fully typed model of the `LoxAPP3.json` structure file. (See [Not yet implemented](#not-yet-implemented) for the protocol features that aren't wrapped yet.)

## Features

- **Token / JWT authentication** — `getkey2` → password hashing (SHA-1 / SHA-256, honouring the Miniserver's `hashAlg`) → HMAC → `getjwt` → `authwithtoken`, with check / refresh / kill and automatic refresh before expiry.
- **Application-layer encryption** — RSA session-key exchange + AES-256-CBC command encryption (required for Gen-1 / non-TLS, optional over WSS). Supports `enc` and `fenc` (encrypted responses) with automatic salt rotation.
- **Live state updates** — binary message-header framing and parsing of all four event tables (value, text, daytimer, weather), automatically enriched with the owning control / room / state.
- **Control commands** — `jdev/sps/io/...` plus visu-password **secured commands** (`jdev/sps/ios/...`).
- **Statistics & history** — typed `statistic` (V1) / `statisticV2` configs, plus downloads that **decode** the binary statistic streams into `{ timestamp, values }` points and the block history (`gethistory`) into typed entries.
- **Typed structure file** — no `any` in the public surface. `LoxAPP3.json` is parsed into a navigable `StructureModel` of rooms, categories, controls (with sub-controls) and states. Type-specific `details` are exposed as `Record<string, unknown>` rather than per-type-modelled.
- **Robust connection handling** — keepalive, automatic reconnect with exponential backoff, and token reuse across reconnects.
- **Zero dependencies** — uses Node's built-in `WebSocket`, `fetch`, and `node:crypto`; nothing to install transitively. Silent by default; plug in your own `Logger` (or the bundled `ConsoleLogger`).
- **TLS, CloudDNS & Remote Connect** — `wss://`/`https://`, plus a Cloud DNS resolver for discovering a Miniserver's external address.
- **Dual ESM + CommonJS** builds with complete type declarations.

## Requirements

- Node.js ≥ 22 (uses the global `WebSocket` and `fetch`, and `node:crypto`).
- A Loxone Miniserver with firmware ≥ 11.2.

## Installation

```sh
npm install loxone-ts-client
```

## Quick start

```ts
import { LoxoneClient, ConsoleLogger } from 'loxone-ts-client';

const client = new LoxoneClient('192.168.1.10', 'username', 'password', {
  logger: new ConsoleLogger('info'), // optional; silent by default
});

await client.connect();          // reachability check + key exchange + token auth,
                                 // structure download/parse, and the live stream — all done

// Work with ready-to-use, typed items — no UUIDs, no manual parsing
for (const [room, items] of client.itemsByRoom()) {
  for (const item of items) {
    console.log(`${room} · ${item.type} · ${item.name}`);
    // observe an item: the listener gets the changed state + value,
    // and the item's typed getters already reflect it
    item.onChange((change) => console.log(`  ${item.name}.${change.state} = ${change.value}`));
  }
}

// Control a device through its typed handle
await client.asDimmer('Ceiling Light')?.setPosition(80);

// Later
await client.disconnect();       // kills the token and closes the socket
```

## Discovery

Find Miniservers on the local network (handy for a setup/config UI, so users pick
one instead of typing an IP) — no connection or credentials required:

```ts
import { discoverMiniservers, identifyMiniserver } from 'loxone-ts-client';

const found = await discoverMiniservers({ timeoutMs: 3000 });
// [{ name, host, port, address, serial, firmwareVersion, configDate, type, hwId }, …]
for (const ms of found) console.log(`${ms.name} @ ${ms.address} (fw ${ms.firmwareVersion})`);

const client = new LoxoneClient(found[0]!.address, user, pass);

// Or probe one known host (works across routed networks, unlike broadcast):
const ms = await identifyMiniserver('192.168.1.10');   // → DiscoveredMiniserver | undefined
```

It sends the UDP `0x00` probe to port 7070 and reads the `LoxLIVE:` reply on 7071.
This is **best-effort and LAN-only**: UDP broadcast does not cross subnets/VLANs or
reach a different network segment (so it won't find a Miniserver behind a router or
on a separate IoT VLAN — keep a manual host entry as the fallback). The packet
format is reverse-engineered, not part of Loxone's documented protocol. Node-only
(uses `node:dgram`). The `loxone discover` / `loxone identify <host>` CLI commands
wrap both.

## Connecting

```ts
const client = new LoxoneClient(host, username, password, options);
```

`host` is `ip:port` or `hostname:port`. Key `options` (all optional):

| Option | Default | Description |
| --- | --- | --- |
| `useTls` | `false` | Use `wss://`/`https://`. Requires a Gen-2 Miniserver and a hostname matching its certificate. |
| `logger` | silent | A `Logger` implementation (see [Logging](#logging)). |
| `keepAlive` | `true` | Send periodic keepalives (Miniserver closes idle sockets after ~5 min). |
| `autoReconnect` | `true` | Reconnect with exponential backoff after an unexpected drop. |
| `forceEncryption` | `false` | Force command encryption even over TLS. |
| `commandTimeoutMs` | `15000` | Per-command response timeout. |
| `trackStateValues` | `true` | Keep the latest event on each `State`. |
| `loadStructureOnConnect` | `true` | Download + parse `LoxAPP3.json` during `connect()`. Set `false` if you only send commands by UUID. |
| `enableUpdatesOnConnect` | `true` | Start the live state stream during `connect()`. Set `false` to start it yourself with `enableUpdates()`. |
| `auth` | — | Token options: `permission`, `clientUuid`, `clientInfo`, `autoRefresh`. |

### Token reuse

By default a new token is acquired on connect and killed on disconnect. To persist a token (e.g. across restarts):

```ts
await client.connect();
const token = client.token;            // store this securely
await client.disconnect(true);         // `true` = keep the token alive

// Later — reuse it (falls back to password auth if the token was rejected)
await client.connect(token);
```

Provide a stable `auth.clientUuid` so the Miniserver can track and reuse this client's tokens, and listen for `tokenChanged` to persist the token across **automatic** refreshes (which happen inside the client, not just on connect):

```ts
new LoxoneClient(host, user, pass, {
  auth: { clientUuid: '098802e1-02b4-603c-ffffeee000d80cfd', clientInfo: 'My Service' },
});
client.on('tokenChanged', (info) => save(info.token)); // fires on acquire + auto-refresh
```

### Knowing the snapshot is in

Once the live stream starts (automatically on `connect()`), the Miniserver streams the current value of every state, then goes quiet. `statesSettled` fires when that burst settles — the moment a plugin has a complete picture — and again after each auto-reconnect re-sync:

```ts
client.on('statesSettled', () => refreshAccessories());
```

## Structure file

`connect()` downloads and parses `LoxAPP3.json` for you (unless
`loadStructureOnConnect: false`), so the parsed model is ready on `client.structure`.
Call `loadStructure()` yourself only to force a reload after a config change.

```ts
const structure = client.structure!;    // ready after connect()

structure.lastModified;                 // configuration timestamp
structure.msInfo.msName;                // typed msInfo
structure.rooms;                        // Map<uuid, Room>
structure.categories;                   // Map<uuid, Category>
structure.controls;                     // Map<uuid, Control> (includes sub-controls)

const control = structure.getControl('0f869a02-0367-3105-ffffb2f8baf0a3e6');
control?.type;                          // 'Switch' | 'Dimmer' | ... (typed, open union)
control?.room?.name;
control?.getState('active');            // the State for live value lookups
```

## Live updates & events

`connect()` starts the live binary stream for you (unless `enableUpdatesOnConnect:
false`, in which case call `enableUpdates()` yourself). State changes are observed
at the **item** level (see below), not via a raw event firehose. The client's own
(lifecycle) events are:

| Event | Payload | When |
| --- | --- | --- |
| `connected` / `authenticated` / `ready` | — | Lifecycle. |
| `statesSettled` | — | Fired once after the live stream starts when the initial state burst has quieted (a full snapshot is in). |
| `tokenChanged` | `TokenInfo` | The token was acquired/refreshed — persist it for reuse after a restart. |
| `disconnected` | `reason: string` | Connection lost. |
| `stateChanged` | `ClientState` | Lifecycle state transition. |
| `error` | `Error` | A `LoxoneError` subclass. |
| `outOfService` | — | Miniserver going down (e.g. firmware update). |
| `daytimer` / `weather` | `DaytimerEvent` / `WeatherEvent` | Low-level: the two specialised tables not surfaced by `onChange`. |

### Observing items

The Loxone protocol has no per-item subscription: enabling updates streams *all*
states at once. This library turns that into observation **on the item itself** —
you react to the object, and its typed getters already reflect the new value:

```ts
const lamp = client.item('Ceiling Light')!;

// fires on any state change of this item; `emitCurrent` replays the current value first
const off = lamp.onChange((change) => {
  console.log(`${change.state} = ${change.value}`);   // raw: e.g. "active = 1"
  console.log(change.formatted);                       // decoded: e.g. "21.3°C" (or the text value)
  console.log(change.boolean);                         // true/false for digital states
  console.log(lamp.isOn);                              // the handle is already up to date
});
off();                                                 // stop observing

lamp.onState('active', (c) => updateUi(c.value));      // a single named state (throws on a typo)
```

Every `change` carries both the **raw** `value` (number/string) and the **decoded**
`formatted` (the display-formatted string a UI would show) and `boolean` (`!= 0`,
for digital states) — so a listener rarely needs to re-derive them. For a
whole-Miniserver firehose at the change level:

```ts
client.onAnyChange((change) => {
  // change = { state, value, formatted, boolean, event, item } for every value/text update
  console.log(`${change.item.roomName} · ${change.item.name}.${change.state} = ${change.formatted}`);
});
```

Lower-level `client.subscribe(target, cb, { emitCurrent })` (target = UUID / `Uuid` /
`State` / `Control`) is still available as an escape hatch. State values are tracked
internally regardless, so `state.latestEvent` and the typed getters stay current.

## Finding items & controls

Top-level, ready-to-use **typed handles**, globally / by room / by category:

```ts
client.items();                          // all items as typed handles
client.items({ type: 'Dimmer' });        // filtered
client.itemsInRoom('Living Room');       // by room
client.itemsInCategory('Lighting');      // by category
client.itemsByRoom();                    // Map<roomName, ControlHandle[]>
client.itemsByCategory();                // Map<categoryName, ControlHandle[]>
client.item('Ceiling Light');            // one handle (by UUID or name), cached

item.name; item.type; item.roomName; item.categoryName;   // self-describing
```

Or navigate the raw structure model (returns `Control`, not handles):

```ts
structure.getControlByName('Ceiling Light');             // by name
structure.getControlByName('Ceiling Light', 'Bedroom');  // disambiguated by room
structure.getControlsByType('Switch');                   // all switches
structure.getControlsInRoom('Living Room');              // by room (Room | uuid | name)
structure.getControlsByCategory('Lighting');             // by category
structure.findControls((c) => c.type === 'Jalousie');    // arbitrary predicate
room.controls; category.controls;                        // back-references
```

## Typed controls

Instead of raw command strings, wrap a control in a typed handle. Use a typed
`asX` accessor (returns `undefined` if the UUID is unknown or the type doesn't
match), or `wrap()` to get the right handle for whatever type a control is:

```ts
await client.asSwitch(uuid)?.on();
await client.asDimmer(uuid)?.setPosition(50);            // clamped to the dimmer's min/max
await client.asJalousie(uuid)?.fullDown();
await client.asGate(uuid)?.open();
await client.asWindow(uuid)?.setPosition(50);
await client.asColorPicker(uuid)?.setRgb(120, 100, 80);
await client.asRoomController(uuid)?.setComfortTemperature(21.5);
await client.asLightController(uuid)?.selectMood(3);

const sw = client.asSwitch('Ceiling Light' /* or a Control */);
sw?.isOn;                                                // boolean | undefined
client.asGate(uuid)?.positionPercent;                    // 0..100
client.asInfoAnalog(uuid)?.formatted;                    // "21.3°C"

// Every control type has a typed asX accessor (autocomplete client.as…):
await client.asAlarm(uuid)?.on();
client.asMeter(uuid)?.actual;
await client.asVentilation(uuid)?.setMode(2);

// Type-safe for any (incl. custom) wrapper class — return type inferred from Ctor:
import { AlarmControl } from 'loxone-ts-client';
client.wrapAs(uuid, AlarmControl)?.quit();

// Or type-driven: returns the matching handle (GenericControl for unknown types)
const handle = client.wrap(controlOrUuid);
if (handle instanceof SwitchControl) await handle.on();
```

> [!IMPORTANT]
> **State getters can be `undefined` until the first event arrives.** `isOn`,
> `position`, `formatted`, … return `undefined` when the value isn't known yet
> (right after `connect()`, before the live stream has delivered that state).
> So `if (item.isOn)` is a **false negative** while the state is unknown — it is
> not the same as "off". Distinguish the three cases explicitly:
>
> ```ts
> if (sw.isOn === true)  { /* on */ }
> else if (sw.isOn === false) { /* off */ }
> else { /* not known yet — wait for onChange or read again later */ }
> ```
>
> Reads reflect the **last value from the live stream**, not an optimistic local
> write: right after `await sw.on()`, `sw.isOn` may still be the old value until
> the Miniserver echoes the change back (typically within milliseconds — observe
> it via `onChange`).

Accessors named `asX` exist for **every** control type (hand-tuned + generated);
`wrapAs(target, Ctor)` is the generic, fully-typed primitive behind them.

Wrapper command methods resolve to `Promise<void>` and **throw** on a non-200
response — `await sw.on()` either succeeds or throws a `LoxoneCommandError`. When
you need the raw response, use the `handle.send(command)` escape hatch (returns a
`TextMessage`) or `client.control(...)`.

**Every control type has a typed wrapper and a typed `asX` accessor** (~74
types). The high-traffic types (`Switch`, `Dimmer`, `Jalousie`, `Gate`, `Window`,
`Pushbutton`, `ColorPickerV2`, `LightControllerV2`, `IRoomControllerV2`,
`InfoOnly*`, `Tracker`, `TextState`) are hand-tuned with richer ergonomics —
e.g. `asTracker(uuid).entries` parses the `|`/`\x14` log into
`{ timestamp, message, lines }[]`, and `asTextState(uuid)` exposes `displayText`
+ a parsed `iconAndColor`. The rest (Alarm, AudioZoneV2, Ventilation, Meter,
Daytimer, …) are generated from the protocol spec and reached via their `asX`
accessor or `wrapAs(uuid, Ctor)` (both return the precise type); `wrap()` returns
the matching handle as the base `ControlHandle` — narrow with `instanceof`.
Unknown/newer types fall back to a `GenericControl` (with `send()` + `state()`),
so nothing is ever a dead end.

Generated wrappers are **decoded, not raw**: where the protocol spec describes a
state as an enum, a timestamp, or a JSON payload, the codegen emits typed getters
alongside the raw value — so you rarely touch the wire format directly:

```ts
const alarm = client.asAlarm(uuid)!;
alarm.nextLevel;       // 4                     (raw code)
alarm.nextLevelLabel;  // 'Internal'            (typed union, decoded from the code)
alarm.armedDate;       // Date | undefined      (Loxone epoch → Date)
```

Across the generated set this is **12** controls with enum-label getters
(`…Label`), **13** with `Date` getters (`…Date`), and **23** JSON-state parsers —
all covered by tests.

## Reading current values

State values are tracked internally, so you can read the latest value synchronously
(typed) without wiring an event handler:

```ts
const state = structure.getControl(uuid)?.getState('active');
state?.numericValue;   // number  | undefined
state?.booleanValue;   // boolean | undefined  (digital states)
state?.textValue;      // string  | undefined
state?.formatted;      // e.g. "21.3°C" using the control's display format
state?.updatedAt;      // Date    | undefined
state?.json<{ icon: string; color: string }>();  // parse a JSON text state (e.g. iconAndColor)
```

Many Loxone text states carry JSON or status payloads rather than display text.
`state.json<T>()` parses them (returns `undefined` for non-JSON). The universal
**lock status** (the `jLocked` state every control can carry) is parsed for you:

```ts
const control = structure.getControl(uuid)!;
control.isLocked;     // boolean
control.lockStatus;   // { locked, level: 0|1|2, reason }  (level 1 = by visu, 2 = by logic)
```

## Sending raw commands

For control types without a typed wrapper, send commands directly:

```ts
// Generic control command — jdev/sps/io/{uuid}/{command}
await client.control(controlUuid, 'on');
await client.control(structure.getControl(uuid)!, 'pulse');   // Control or Uuid accepted

// Any other command / file
const res = await client.sendCommand('jdev/sps/LoxAPPversion3');
const icon = await client.getFile(`${iconUuid}.svg`);
```

## Other control features

```ts
await client.getIcon(iconUuid);                  // FileMessage (svg/png)
await client.getControlNotes(control);           // plaintext help/notes, if any
await client.lockControl(control, 'maintenance');// admin only
await client.unlockControl(control);

structure.getGlobalState('sunset');              // a watchable State for sunrise/sunset/…
structure.weatherServer;                         // weather-server config (if Cloud Weather is set up)
```

### Secured commands (visualization password)

```ts
await client.securedControl(controlUuid, 'on', visuPassword);
const valid = await client.checkVisuPassword(visuPassword);
```

## Statistics & history

Controls advertise these in the structure — `control.hasStatistics`,
`control.hasHistory`, `control.statistic` (legacy V1), `control.statisticV2`
(energy-flow era) — and the client downloads + **decodes** them, so you get typed
data points instead of a raw binary blob.

```ts
const meter = client.item('Grid Meter')!.control;

// Block history — why a control acted as it did (newest entries as delivered).
const log = await client.getControlHistory(meter);          // or: client.item(uuid).getHistory()
for (const e of log) console.log(e.timestamp, e.what, '←', e.trigger, e.triggerType);

// V2 statistics (meters / energy-flow monitor): discover groups, then read a range.
const [group] = await client.getStatisticInfo(meter);       // [{ id, activeSince, activeSinceDate }]
const points = await client.getStatistic(meter, {
  groupId: group.id,
  from: new Date('2026-06-01'),                              // Date or Unix-UTC seconds
  to: new Date('2026-06-15'),
  unit: 'day',                                               // all | hour | day | month | year
  mode: 'diff',                                              // 'raw' (default) or 'diff'
  // output: 'total',                                        // omit to get every output of the group
});
// points: { timestamp: Date, values: number[] }[]  — values in the group's datapoint order

// Legacy (V1) statistics — one binary file per month ("YYYYMM") or day ("YYYYMMDD").
const v1 = await client.getStatisticV1(meter, '202606');     // values per control.statistic.outputs
```

`decodeBinaryStatistics(bytes, valueCount, epoch)` is exported too, if you fetch a
binary stream yourself. Timestamps differ by handling: V1 is Miniserver-local
(Loxone epoch), V2 is Unix-UTC — the client picks the right one for you.

## Logging

The library logs nothing unless you provide a logger. Implement the small `Logger` interface to bridge to your stack:

```ts
import type { Logger } from 'loxone-ts-client';

const logger: Logger = {
  trace: (m, ...a) => myLog.trace(m, ...a),
  debug: (m, ...a) => myLog.debug(m, ...a),
  info:  (m, ...a) => myLog.info(m, ...a),
  warn:  (m, ...a) => myLog.warn(m, ...a),
  error: (m, ...a) => myLog.error(m, ...a),
};

new LoxoneClient(host, user, pass, { logger });
```

Or use the bundled `ConsoleLogger`:

```ts
import { ConsoleLogger } from 'loxone-ts-client';
new LoxoneClient(host, user, pass, { logger: new ConsoleLogger('debug') });
```

## Error handling

All thrown errors extend `LoxoneError`:

```ts
import { LoxoneError, LoxoneCommandError, LoxoneTimeoutError } from 'loxone-ts-client';

try {
  await client.control(uuid, 'on');
} catch (e) {
  if (e instanceof LoxoneTimeoutError) { /* no response in time */ }
  else if (e instanceof LoxoneCommandError) { console.error(e.code, e.command); }
  else if (e instanceof LoxoneError) { /* connection/auth/protocol/state */ }
}
```

Subclasses: `LoxoneConnectionError`, `LoxoneAuthenticationError`, `LoxoneCommandError`, `LoxoneTimeoutError`, `LoxoneUnsupportedVersionError`, `LoxoneProtocolError`, `LoxoneStateError`. The library never calls `process.exit`.

## External access (CloudDNS / Remote Connect)

```ts
import { CloudDns, buildTlsHostname } from 'loxone-ts-client';

const result = await new CloudDns().resolve(serialNumber);
const host = buildTlsHostname(result.ipPortHttps ?? result.ipPort!, serialNumber);
const client = new LoxoneClient(host, user, pass, { useTls: true });
```

## Not yet implemented

The transport, auth, structure, live-update, control, statistics, history and
weather layers are complete (every documented control type has a typed wrapper).
What remains out of scope:

- The separate **Audioserver / Music Server** websocket sub-protocol — this
  client talks to the Miniserver; audio zones are reachable as controls, but the
  dedicated audio-server connection is its own protocol.
- The **autopilot** generator API (`weatherServer.autopilot`), which Loxone does
  not publicly document.

The escape hatches `client.getFile(path)` and `client.sendCommand(cmd)` reach
anything not yet wrapped.

## Architecture

The package is layered so individual pieces can be reused on their own (each is exported):

```
LoxoneClient                       facade: lifecycle, events, commands
├─ transport/  HttpClient · CloudDns · WebSocketConnection (framing + command queue)
├─ auth/       Authenticator · TokenManager · CommandEncryption · SecuredCommands · hashing
├─ protocol/   Uuid · MessageHeader · TextMessage · FileMessage · {Value,Text,Daytimer,Weather}Event
├─ controls/   ControlHandle + typed wrappers (Switch · Dimmer · … hand-written + generated)
└─ structure/  StructureModel · Control · State · Room · Category · LoxAPP3 types
```

On top sit the high-level views — `items()`/`item()`, `RoomView` + capabilities — and
the `loxone` CLI. The longer-term design (one runtime-portable core with thin edges for
Node / browser / a standalone binary, and the roadmap toward it) is written up in
[ARCHITECTURE.md](ARCHITECTURE.md).

## Try it against your Miniserver

A ready-to-run test client lives in [`examples/testclient.ts`](examples/testclient.ts). It
connects, prints the Miniserver info, summarises the structure file, streams live updates
for a few seconds, and optionally sends one command — no build step required:

```sh
LOXONE_HOST=192.168.1.10 LOXONE_USER=me LOXONE_PASS=secret npm run example
# or:  npm run example -- 192.168.1.10 me secret
```

Useful env vars: `LOXONE_TLS=true`, `LOXONE_LOG_LEVEL=debug`, `LOXONE_WATCH_SECONDS=30`,
`LOXONE_CONTROL=<uuid>` + `LOXONE_COMMAND=on`.

## Command-line client (`loxone`)

The package ships a `loxone` CLI. Connection comes from `--host --user --pass [--tls]`
or the `LOXONE_HOST` / `LOXONE_USER` / `LOXONE_PASS` env vars; the token is cached
under `~/.loxone-ts-client/` so repeat calls authenticate fast.

### Standalone binary (no Node required)

`npm run build:binary` produces a self-contained executable (`dist/loxone`, via Node's
[SEA](https://nodejs.org/api/single-executable-applications.html)) that runs with **no
Node install** — drop it on `PATH` and call it from anything (PowerShell, Python, bash).
(macOS needs the copied binary re-signed; see `scripts/build-binary.mjs`.)

### Interactive shell

`loxone shell` connects **once** and drops you at a prompt — query and control with the
connection (and live state) kept warm between commands:

It has coloured output, **Tab-completion** (commands, room/item names, capabilities),
and a `use <room>` context so you can drop the room from each command:

```text
$ loxone shell
Connected to Project 2813 — 20 rooms, 138 items. Type a command, "help", or "exit".
loxone> rooms
Woonkamer              19.1°C  light:off  presence
Werkkamer              19.4°C  light:Aanwezig
…
loxone> use Werkkamer
loxone[Werkkamer]> temperature          # bare capability → this room
{ "value": 19.4 }
loxone[Werkkamer]> lighting off
{ "ok": true }
loxone[Werkkamer]> watch                 # scoped to Werkkamer; press Enter to stop
loxone[Werkkamer]> exit
```

### One-shot (JSON)

Each command also runs standalone, printing JSON to stdout (exit non-zero on error) —
handy for scripts, `jq`, cron, or wrapping from PowerShell/bash.

```sh
loxone rooms                                   # rooms + derived capabilities
loxone items --room Woonkamer --type Dimmer    # typed items
loxone get "Bureau Lamp"                        # an item + its current states
loxone set "Bureau Lamp" 80                     # on | off | toggle | <0-100> | up/down/stop | open/close | <raw>
loxone room Werkkamer lighting                  # { isOn, brightness, activeMood, moods, lights }
loxone room Werkkamer lighting off              # off | on | "mood Aanwezig" | <brightness>
loxone room Woonkamer temperature               # a capability value
loxone watch --room Woonkamer                   # live changes as NDJSON
```

Each command outputs JSON to stdout and exits non-zero on error, so it pipes
straight into other tools:

```sh
loxone items --type Switch | jq '.[].name'
```

```powershell
loxone room Werkkamer lighting | ConvertFrom-Json | Select isOn, activeMood
```

During development run it without building via `npm run cli -- <args>`.

## Protocol reference

The library is implemented against Loxone's official V17.0 documentation. Plain-text
extracts of those specs — plus a map from each topic to the code that implements it —
live in [`docs/protocol/`](docs/protocol/).

## License

MIT © Rudy Berends
