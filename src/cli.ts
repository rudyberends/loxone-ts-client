#!/usr/bin/env node
/**
 * `loxone` — a small JSON command-line client over {@link LoxoneClient}.
 *
 * Connection comes from flags (`--host --user --pass [--tls]`) or the env vars
 * `LOXONE_HOST` / `LOXONE_USER` / `LOXONE_PASS` / `LOXONE_TLS`. The acquired token
 * is cached (and reused) under `~/.loxone-ts-client/` to speed up the next call.
 *
 * Every command prints JSON to stdout and exits non-zero on error — built to be
 * wrapped (PowerShell `ConvertFrom-Json`, `jq`, etc.).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { LoxoneClient } from './LoxoneClient.js';
import { discoverMiniservers, identifyMiniserver } from './discovery/discovery.js';
import { completeLine, SHELL_CAPABILITIES, tokenize } from './cliComplete.js';
import { DimmerControl } from './controls/DimmerControl.js';
import { GateControl } from './controls/GateControl.js';
import { JalousieControl } from './controls/JalousieControl.js';
import { SwitchControl } from './controls/SwitchControl.js';
import type { ControlHandle } from './controls/ControlHandle.js';
import type { RoomView } from './client/RoomView.js';

type Flags = Record<string, string | boolean>;

function parseArgs(argv: string[]): { positionals: string[]; flags: Flags } {
  const positionals: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

function str(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function fail(message: string): never {
  process.stderr.write(`${JSON.stringify({ error: message })}\n`);
  process.exit(1);
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

// --- colour (TTY only) ----------------------------------------------------

const TTY = process.stdout.isTTY === true;
const paint = (code: string, text: string): string => (TTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const dim = (s: string): string => paint('2', s);
const bold = (s: string): string => paint('1', s);
const green = (s: string): string => paint('32', s);
const yellow = (s: string): string => paint('33', s);
const cyan = (s: string): string => paint('36', s);

// --- token cache ----------------------------------------------------------

const CACHE_DIR = join(homedir(), '.loxone-ts-client');
const tokenFile = (host: string): string => join(CACHE_DIR, `token-${host.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);

function readToken(host: string): string | undefined {
  try {
    return (JSON.parse(readFileSync(tokenFile(host), 'utf8')) as { token?: string }).token;
  } catch {
    return undefined;
  }
}
function saveToken(host: string, token: string | undefined): void {
  if (!token) return;
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(tokenFile(host), JSON.stringify({ token }), { mode: 0o600 });
  } catch {
    /* a cache write failure must not break the command */
  }
}

// --- connection -----------------------------------------------------------

async function connect(flags: Flags): Promise<{ client: LoxoneClient; host: string }> {
  const host = str(flags.host) ?? process.env.LOXONE_HOST;
  const user = str(flags.user) ?? process.env.LOXONE_USER;
  const pass = str(flags.pass) ?? process.env.LOXONE_PASS;
  const tls = flags.tls === true || flags.tls === 'true' || process.env.LOXONE_TLS === 'true';
  if (!host || !user || !pass) {
    fail('missing connection details — pass --host --user --pass or set LOXONE_HOST/LOXONE_USER/LOXONE_PASS');
  }
  const client = new LoxoneClient(host, user, pass, { useTls: tls, autoReconnect: false });
  try {
    await client.connect(readToken(host));
  } catch (error) {
    fail(`connect failed: ${(error as Error).message}`);
  }
  saveToken(host, client.token);
  return { client, host };
}

/** Resolves once the initial state burst has settled (so values are present), capped by a timeout. */
function awaitSettle(client: LoxoneClient, ms = 5000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    client.once('statesSettled', () => {
      clearTimeout(timer);
      setTimeout(resolve, 300); // let trailing text events land
    });
  });
}

// --- value views ----------------------------------------------------------

function itemSummary(h: ControlHandle): Record<string, unknown> {
  return { name: h.name, type: h.type, room: h.roomName, category: h.categoryName, uuid: h.uuid };
}

function itemDetail(h: ControlHandle): Record<string, unknown> {
  const states: Record<string, unknown> = {};
  for (const state of h.control.states) {
    states[state.name] = {
      value: state.numericValue ?? state.textValue,
      formatted: state.formatted,
      updatedAt: state.updatedAt?.toISOString(),
    };
  }
  return { ...itemSummary(h), states };
}

function roomSummary(room: RoomView): Record<string, unknown> {
  return {
    name: room.name,
    items: room.items.length,
    temperature: room.temperature.get(),
    humidity: room.humidity.get(),
    brightness: room.brightness.get(),
    presence: room.presence.get(),
    lighting: {
      isOn: room.lighting.isOn,
      brightness: room.lighting.brightness,
      activeMood: room.lighting.activeMood?.name,
      moods: room.lighting.moods.map((m) => m.name),
      lights: room.lighting.lights.map((l) => l.name),
    },
    audio: room.audio.get(),
  };
}

// --- set dispatch ---------------------------------------------------------

async function applySet(client: LoxoneClient, handle: ControlHandle, value: string): Promise<unknown> {
  const v = value.toLowerCase();
  const num = Number(value);
  if (handle instanceof SwitchControl) {
    if (v === 'on' || v === 'off') {
      await handle.set(v === 'on');
      return { ok: true, sent: v };
    }
    if (v === 'toggle') {
      await handle.set(handle.isOn !== true);
      return { ok: true, sent: 'toggle' };
    }
  }
  if (handle instanceof DimmerControl) {
    if (v === 'on' || v === 'off') {
      await (v === 'on' ? handle.on() : handle.off());
      return { ok: true, sent: v };
    }
    if (!Number.isNaN(num)) {
      await handle.setPosition(num);
      return { ok: true, sent: `position ${num}` };
    }
  }
  if (handle instanceof JalousieControl) {
    if (v === 'up') {
      await handle.fullUp();
      return { ok: true, sent: 'up' };
    }
    if (v === 'down') {
      await handle.fullDown();
      return { ok: true, sent: 'down' };
    }
    if (v === 'stop') {
      await handle.stop();
      return { ok: true, sent: 'stop' };
    }
    if (!Number.isNaN(num)) {
      await handle.setPosition(num);
      return { ok: true, sent: `position ${num}` };
    }
  }
  if (handle instanceof GateControl) {
    if (v === 'open') {
      await handle.open();
      return { ok: true, sent: 'open' };
    }
    if (v === 'close') {
      await handle.close();
      return { ok: true, sent: 'close' };
    }
  }
  // fallback: treat the value as a raw command
  const response = await client.control(handle.control, value);
  return { ok: response.ok, code: response.code, sent: value };
}

// --- commands -------------------------------------------------------------

interface HelpEntry {
  syntax: string;
  summary: string;
  // 'capability' entries are shown only inside a room context / via `help <cap>`,
  // not in the general command overview (use `room <name> <cap>` otherwise).
  group: 'query' | 'control' | 'session' | 'capability';
  detail?: string[];
}

const HELP: Record<string, HelpEntry> = {
  rooms: { syntax: 'rooms', summary: 'list rooms with temperature / light / presence', group: 'query' },
  items: { syntax: 'items [--room R] [--type T]', summary: 'list items (typed handles)', group: 'query' },
  get: { syntax: 'get <name|uuid>', summary: 'show an item and its live states', group: 'query' },
  set: {
    syntax: 'set <name|uuid> <value>',
    summary: 'control an item',
    group: 'control',
    detail: [
      'value: on | off | toggle | <0-100> | up | down | stop | open | close | <raw command>',
      'examples:  set "Bureau Lamp" on   ·   set Spots 40   ·   set Garage open',
    ],
  },
  room: {
    syntax: 'room <name> [capability] [value]',
    summary: 'read or drive a room capability',
    group: 'control',
    detail: [
      'capabilities: temperature · humidity · presence · brightness · lighting · audio',
      'examples:  room Woonkamer temperature   ·   room Werkkamer lighting off',
      '           room Werkkamer lighting mood "Aanwezig"   ·   room Werkkamer audio play',
    ],
  },
  lighting: {
    syntax: 'lighting [on|off|mood <name>|<0-100>]',
    summary: 'room lighting + scenes (read: isOn, brightness, activeMood, moods, lights)',
    group: 'capability',
    detail: ['examples:  lighting   ·   lighting off   ·   lighting mood "Aanwezig"   ·   lighting 40'],
  },
  watch: {
    syntax: 'watch [--room R] [--type T]',
    summary: 'stream live changes (Enter stops it)',
    group: 'query',
    detail: ['--seconds N caps a one-shot `loxone watch`; in the shell press Enter to stop'],
  },
  use: {
    syntax: 'use [room]',
    summary: 'set a room context (then drop the room from commands); "use" with no room clears it',
    group: 'session',
  },
  help: { syntax: 'help [command]', summary: 'this overview, or details for one command', group: 'session' },
  exit: { syntax: 'exit', summary: 'leave the session', group: 'session' },
  discover: {
    syntax: 'discover [--seconds N]',
    summary: 'find Miniservers on the local network (no connection needed)',
    group: 'session',
    detail: ['LAN-only (UDP broadcast does not cross subnets/VLANs); default listen 3s'],
  },
  identify: {
    syntax: 'identify <host>',
    summary: "probe a known host for its Miniserver identity (serial/firmware/name), no auth",
    group: 'session',
  },
};

/** Builds the help text — context-aware (a room context surfaces the capability shortcuts). */
function renderHelp(opts: { room?: string | undefined; interactive: boolean }, topic?: string): string {
  if (topic) {
    const entry = HELP[topic];
    if (!entry) return `${yellow('no help for')} "${topic}" — try "help"`;
    return [bold(entry.syntax), `  ${entry.summary}`, ...(entry.detail ?? []).map((d) => `  ${dim(d)}`)].join('\n');
  }

  const lines: string[] = [];
  const row = (e: HelpEntry): string => `  ${cyan(e.syntax.padEnd(34))} ${e.summary}`;

  if (opts.room) {
    lines.push(bold(`Context: ${opts.room}`) + dim('  (capabilities below act on this room; "use" alone clears it)'));
    for (const cap of SHELL_CAPABILITIES) {
      const e = HELP[cap] ?? { syntax: cap, summary: `read/control the room ${cap}` };
      lines.push(`  ${cyan(e.syntax.padEnd(34))} ${e.summary}`);
    }
    lines.push('');
  } else if (!opts.interactive) {
    lines.push(`${bold('loxone')} <command> ${dim('[--host H --user U --pass P | env LOXONE_*] [--tls]')}`);
    lines.push(`  ${cyan('shell'.padEnd(34))} interactive session: connect once, then query/control`);
    lines.push('');
  }

  for (const group of ['query', 'control', 'session'] as const) {
    const entries = Object.values(HELP).filter((e) => e.group === group);
    if (entries.length === 0) continue;
    lines.push(bold(group[0]!.toUpperCase() + group.slice(1)));
    for (const e of entries) lines.push(row(e));
    lines.push('');
  }
  lines.push(dim('Tab completes commands and room/item names. "help <command>" for details.'));
  return lines.join('\n');
}

/** Runs a single query/control command against an already-connected client, returning data. */
async function runCommand(client: LoxoneClient, positionals: string[], flags: Flags): Promise<unknown> {
  const command = positionals[0];
  switch (command) {
    case 'rooms':
      return client.rooms.map(roomSummary);
    case 'items':
      return client
        .items({
          ...(str(flags.room) !== undefined ? { room: str(flags.room)! } : {}),
          ...(str(flags.type) !== undefined ? { type: str(flags.type)! } : {}),
        })
        .map(itemSummary);
    case 'get': {
      const id = positionals[1];
      if (!id) throw new Error('usage: get <name|uuid>');
      const handle = client.item(id);
      if (!handle) throw new Error(`no item "${id}"`);
      return itemDetail(handle);
    }
    case 'set': {
      const id = positionals[1];
      const value = positionals.slice(2).join(' ');
      if (!id || !value) throw new Error('usage: set <name|uuid> <value>');
      const handle = client.item(id);
      if (!handle) throw new Error(`no item "${id}"`);
      return applySet(client, handle, value);
    }
    case 'room': {
      const name = positionals[1];
      if (!name) throw new Error('usage: room <name> [capability] [value]');
      const room = client.room(name);
      if (!room) throw new Error(`no room "${name}"`);
      return runRoom(room, positionals[2], positionals.slice(3).join(' '));
    }
    default:
      throw new Error(`unknown command "${command ?? ''}" — try "help"`);
  }
}

async function main(): Promise<void> {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const command = positionals[0];

  if (!command || command === 'help' || flags.help) {
    process.stdout.write(`${renderHelp({ interactive: false }, positionals[1])}\n`);
    return;
  }

  // Discovery runs without a connection (and without credentials).
  if (command === 'discover') {
    const seconds = Number(str(flags.seconds) ?? '3');
    print(await discoverMiniservers({ timeoutMs: Math.max(0, seconds) * 1000 }));
    return;
  }
  if (command === 'identify') {
    const host = positionals[1] ?? str(flags.host);
    if (!host) fail('identify needs a host:  loxone identify <ip[:port]>');
    print((await identifyMiniserver(host)) ?? null);
    return;
  }

  const { client } = await connect(flags);

  if (command === 'shell' || command === 'repl') {
    await awaitSettle(client);
    await shell(client); // runs until the user exits (then disconnects + exits)
    return;
  }
  if (command === 'watch') {
    await awaitSettle(client);
    attachWatch(client, flags);
    const seconds = Number(str(flags.seconds) ?? '0');
    const shutdown = (): void => void client.disconnect(true).then(() => process.exit(0));
    process.on('SIGINT', shutdown);
    if (seconds > 0) setTimeout(shutdown, seconds * 1000);
    return; // keep streaming
  }

  try {
    await awaitSettle(client);
    print(await runCommand(client, positionals, flags));
  } catch (error) {
    await client.disconnect(true).catch(() => undefined);
    fail((error as Error).message);
  }
  await client.disconnect(true).catch(() => undefined); // keep the token for reuse
  process.exit(0);
}

async function runRoom(room: RoomView, capability: string | undefined, value: string): Promise<unknown> {
  if (!capability) return roomSummary(room);
  switch (capability) {
    case 'temperature':
      if (value) {
        await room.targetTemperature.set(Number(value));
        return { ok: true };
      }
      return { value: room.temperature.get() };
    case 'humidity':
      return { value: room.humidity.get() };
    case 'brightness':
      if (value) {
        await room.lighting.setBrightness(Number(value));
        return { ok: true };
      }
      return { value: room.brightness.get() };
    case 'presence':
      return { value: room.presence.get() };
    case 'audio':
      if (value === 'play' || value === 'pause') {
        await room.audio.set({ playing: value === 'play' });
        return { ok: true };
      }
      if (value) {
        await room.audio.set({ volume: Number(value) });
        return { ok: true };
      }
      return { value: room.audio.get() };
    case 'lighting': {
      const v = value.toLowerCase();
      if (v === 'on') {
        await room.lighting.on();
        return { ok: true };
      }
      if (v === 'off') {
        await room.lighting.off();
        return { ok: true };
      }
      if (v.startsWith('mood ')) {
        await room.lighting.setMood(value.slice(5));
        return { ok: true };
      }
      if (value && !Number.isNaN(Number(value))) {
        await room.lighting.setBrightness(Number(value));
        return { ok: true };
      }
      return {
        isOn: room.lighting.isOn,
        brightness: room.lighting.brightness,
        activeMood: room.lighting.activeMood?.name,
        moods: room.lighting.moods.map((m) => m.name),
        lights: room.lighting.lights.map((l) => ({ name: l.name, type: l.type })),
      };
    }
    default:
      throw new Error(`unknown capability "${capability}"`);
  }
}

/** Registers live-change listeners (whole-Miniserver or filtered) printing NDJSON; returns a disposer. */
function attachWatch(client: LoxoneClient, flags: Flags): () => void {
  const room = str(flags.room);
  const type = str(flags.type);
  const onChange = (change: { state: string | undefined; value: number | string; item: ControlHandle }): void => {
    process.stdout.write(
      `${JSON.stringify({
        time: new Date().toISOString(),
        room: change.item.roomName,
        item: change.item.name,
        type: change.item.type,
        state: change.state,
        value: change.value,
      })}\n`,
    );
  };
  if (room !== undefined || type !== undefined) {
    const offs = client
      .items({ ...(room !== undefined ? { room } : {}), ...(type !== undefined ? { type } : {}) })
      .map((item) => item.onChange((c) => onChange(c), { emitCurrent: false }));
    return () => offs.forEach((off) => off());
  }
  return client.onAnyChange(onChange);
}

// --- interactive shell ----------------------------------------------------

/** Renders a command result for the interactive prompt (compact for lists, JSON otherwise). */
function formatRepl(command: string, data: unknown, json: boolean): string {
  if (json || data === undefined) return JSON.stringify(data, null, 2);
  if (command === 'rooms' && Array.isArray(data)) {
    return data
      .map((r) => {
        const room = r as ReturnType<typeof roomSummary>;
        const light = (room.lighting as { isOn?: boolean; activeMood?: string }) ?? {};
        const bits = [
          room.temperature !== undefined ? `${room.temperature as number}°C` : null,
          light.isOn ? green(`light:${light.activeMood ?? 'on'}`) : dim('light:off'),
          room.presence === true ? yellow('presence') : null,
        ].filter(Boolean);
        return `${bold(String(room.name).padEnd(22))} ${bits.join('  ')}`;
      })
      .join('\n');
  }
  if (command === 'items' && Array.isArray(data)) {
    return data.map((i) => `${dim(`[${(i as { type: string }).type}]`)} ${(i as { name: string }).name}`).join('\n');
  }
  return JSON.stringify(data, null, 2);
}

async function shell(client: LoxoneClient): Promise<void> {
  const context: { room: string | undefined } = { room: undefined };
  const promptText = (): string => `${cyan('loxone')}${context.room ? cyan(`[${context.room}]`) : ''}${cyan('> ')}`;

  const completer = (line: string): [string[], string] =>
    completeLine(line, {
      rooms: client.rooms.map((r) => r.name),
      items: client.items().map((i) => i.name),
      types: [...new Set(client.items().map((i) => i.type))],
      inRoom: context.room !== undefined,
    });

  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: promptText(), completer });
  const name = client.structure?.msInfo.msName ?? client.apiInfo?.serialNumber ?? 'Miniserver';
  process.stdout.write(
    `${bold(`Connected to ${name}`)} — ${client.rooms.length} rooms, ${client.items().length} items. ` +
      `Type a command, ${dim('"help"')}, or ${dim('"exit"')}. ${dim('Tab completes; "use <room>" sets a context.')}\n`,
  );

  let stopWatch: (() => void) | null = null;
  const queue: string[] = [];
  let draining = false;

  // Handle one line; returns true to keep the session open, false to exit.
  async function handle(line: string): Promise<boolean> {
    let tokens = tokenize(line.trim());
    if (tokens.length === 0) return true;
    let command = tokens[0]!;

    if (command === 'exit' || command === 'quit') return false;
    if (command === 'help') {
      process.stdout.write(`${renderHelp({ room: context.room, interactive: true }, tokens[1])}\n`);
      return true;
    }
    if (command === 'use') {
      const target = tokens[1];
      if (!target) {
        context.room = undefined;
      } else {
        const room = client.room(target);
        if (!room) {
          process.stdout.write(`error: no room "${target}"\n`);
        } else {
          context.room = room.name;
        }
      }
      rl.setPrompt(promptText());
      return true;
    }

    // Apply the room context: bare capabilities resolve against it, and
    // items/watch are scoped to it unless an explicit --room is given.
    if (context.room) {
      if ((SHELL_CAPABILITIES as readonly string[]).includes(command)) {
        tokens = ['room', context.room, ...tokens];
        command = 'room';
      } else if ((command === 'items' || command === 'watch') && !tokens.includes('--room')) {
        tokens = [...tokens, '--room', context.room];
      }
    }

    if (command === 'watch') {
      stopWatch = attachWatch(client, parseArgs(tokens.slice(1)).flags);
      process.stdout.write(dim('(streaming — press Enter to stop)\n'));
      return true;
    }
    try {
      const { positionals, flags } = parseArgs(tokens);
      process.stdout.write(`${formatRepl(positionals[0] ?? command, await runCommand(client, positionals, flags), flags.json === true)}\n`);
    } catch (error) {
      process.stdout.write(`${yellow('error')}: ${(error as Error).message}\n`);
    }
    return true;
  }

  // Process lines strictly one at a time so async commands finish in order
  // (and piped/scripted input works the same as typing).
  async function drain(): Promise<void> {
    if (draining) return;
    draining = true;
    while (queue.length > 0) {
      const line = queue.shift()!;
      if (stopWatch) {
        // A line while streaming just stops the watch (it isn't run as a command).
        stopWatch();
        stopWatch = null;
        process.stdout.write('(stopped)\n');
        continue;
      }
      if (!(await handle(line))) {
        rl.close();
        return;
      }
    }
    draining = false;
    if (!stopWatch) rl.prompt(); // a live watch owns the prompt until stopped
  }

  rl.on('line', (line) => {
    queue.push(line);
    void drain();
  });
  rl.on('close', () => void client.disconnect(true).then(() => process.exit(0)));

  rl.prompt();
  await new Promise<void>(() => {}); // keep main() awaiting until the process exits
}

void main();
