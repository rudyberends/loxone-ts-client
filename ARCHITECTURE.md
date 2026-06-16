# Architecture & roadmap

## Goal

The ultimate, fully type-safe Loxone client in TypeScript — written once, usable
everywhere it makes sense:

- as a **library** in Node apps (e.g. a Homebridge plugin);
- eventually in a **browser / webapp**;
- as a **standalone CLI** that needs nothing installed;
- and therefore wrappable from **PowerShell, Python, bash, …** (they shell out to the CLI).

The strategy is **one runtime-portable core with thin, runtime-specific edges**.

```
            ┌──────────────────────────────────────────────────────────┐
            │  loxone-ts-client — CORE (portable TypeScript)             │
            │  protocol · StructureModel · typed controls · rooms ·      │
            │  capabilities · client     [crypto + events behind a port] │
            └───────────┬───────────────────────────────┬───────────────┘
        Node backend (node:crypto)             Web backend (WebCrypto)
                │                                       │
   ┌────────────┴───────────┐            ┌──────────────┴──────────────┐
   │ Homebridge / Node apps │            │ webapp (browser, over wss)   │
   └────────────┬───────────┘            └──────────────────────────────┘
                │
        ┌───────┴────────┐    standalone binary (Node SEA / bun --compile)
        │  loxone CLI    │ ─────────────────────────────────────────────► PowerShell · Python · bash
        └────────────────┘    (no install; JSON in/out)
```

## Layers (inner → outer)

Each layer is exported and usable on its own.

| Layer | What | Key types |
| --- | --- | --- |
| **protocol** | wire framing & messages | `Uuid`, `MessageHeader`, `TextMessage`, `FileMessage`, `{Value,Text,Daytimer,Weather}Event` |
| **transport** | the socket + HTTP bootstrap | `WebSocketConnection` (framing + command queue), `HttpClient`, `CloudDns` |
| **auth** | token handshake + encryption | `Authenticator`, `TokenManager`, `CommandEncryption`, `SecuredCommands`, `hashing` |
| **structure** | the parsed `LoxAPP3.json` | `StructureModel`, `Control`, `State`, `Room`, `Category` |
| **controls** | typed wrappers per control type | `ControlHandle` + `SwitchControl`/`DimmerControl`/… (hand-written + generated) |
| **client** | the facade + high-level views | `LoxoneClient`, `items()`/`item()`, `RoomView` + capabilities |
| **cli** | the `loxone` command-line client | `src/cli.ts` (JSON one-shot + interactive shell) — **Node-only** |

The high-level surface (what most consumers use): `connect()` (auto-loads the
structure and starts the live stream) → `items()` / `item()` / `rooms` / `room()` →
typed getters, commands, and `onChange`/`onState` observation. See the README.

## Runtime portability

The library core is already **almost runtime-neutral**: it uses web-standard
globals (`fetch`, `WebSocket`) and has **zero runtime dependencies**. Only two
Node-isms remain in the core, plus one browser-platform constraint:

1. **`node:crypto`** (`auth/hashing.ts`, `auth/CommandEncryption.ts`) — the real lever.
   - **Hashing** (SHA-1/256 + HMAC) is needed for token auth on *every* runtime. It
     must move behind a small async crypto port with a Node backend (`node:crypto`)
     and a **WebCrypto** backend. WebCrypto is async, but the auth flow already is, so
     the ripple is contained.
   - **Command encryption** (RSA-PKCS1 + AES-256-CBC) — WebCrypto cannot do RSA-PKCS1
     *encryption*. But that app-layer encryption is only required on **non-TLS**
     connections; over `wss` (which a browser must use anyway) it is skipped. So
     encryption stays a Node-only capability and the browser relies on TLS. Not a blocker.
2. **`node:events`** (`utils/TypedEventEmitter`, the client's internal event stream) —
   replace with a tiny `EventTarget`-based emitter (trivial; bundlers also polyfill it).
3. **Browser security (not our code).** A browser cannot `fetch` the Miniserver
   (no CORS headers) and cannot do mixed content (`https://` → `ws://`). The fix is to
   route the HTTP bootstrap (`jdev/cfg/apiKey`, `getcertificate`) **over the WebSocket**
   (those are `jdev` commands too) and require `wss`. WebSocket is not CORS-restricted,
   so a webapp can then connect directly — provided the Miniserver presents a
   browser-trusted certificate; otherwise a webapp talks to the Miniserver through a
   Node backend running this same library.

`fs`/`os`/`path`/`readline` appear **only** in `src/cli.ts`, never in the library
entry — so importing the library in a browser bundle pulls in none of them.

## Distribution targets

| Target | Status | Notes |
| --- | --- | --- |
| Node library (Homebridge, services) | ✅ shipping | dual ESM + CJS, zero deps, Node ≥ 22 |
| Standalone CLI binary | ▢ planned | Node SEA (built-in) or `bun build --compile`; one file per OS, no install |
| PowerShell / Python / bash | ▢ via the binary | wrap the JSON CLI (`ConvertFrom-Json`, `json.loads`, `jq`) |
| Browser / webapp | ▢ planned | needs the crypto port + WS-only bootstrap + `wss`; data/model layer is usable today |
| Deno / Bun | ▢ falls out of the crypto port | both provide WebCrypto + `node:` compat |

## Design principles

- **Push intelligence into the library, keep it consumer-agnostic.** Generic Loxone
  intelligence (decoding, typed accessors, capability metadata, room semantics) lives
  in the core so every consumer benefits; framework-specific glue (e.g. HomeKit
  characteristic mapping) stays in the consumer.
- **Greenfield: no legacy or fallback.** Target the current protocol (V17.0 / Gen2);
  no backward-compat shims or old-firmware paths.
- **Zero runtime dependencies.** Built-in `WebSocket`/`fetch`/`node:crypto` only.
- **No `any` in the public surface; strict TypeScript throughout.**

## Roadmap

1. **Standalone CLI binary** — Node SEA / bun, so PowerShell/Python/bash users install nothing.
2. **Make the core runtime-portable** — crypto behind a port (Node + WebCrypto) and a
   portable event emitter. Unlocks browser, Deno and Bun without touching Node consumers.
3. **WS-only bootstrap + browser build** — route HTTP bootstrap over the WebSocket;
   publish a browser-targeted build; document the `wss`/certificate constraints.
4. **Consumer wrappers** — a thin PowerShell module (and example Python) over the CLI;
   migrate the Homebridge plugin onto the library as the reference integration.
