/**
 * A small end-to-end test client for a real Loxone Miniserver.
 *
 * It connects, prints the Miniserver info, loads and summarises the structure
 * file, streams live state updates for a few seconds, optionally sends one
 * control command, and disconnects cleanly.
 *
 * Run it (no build needed — uses tsx):
 *
 *   LOXONE_HOST=192.168.1.10 LOXONE_USER=me LOXONE_PASS=secret npm run example
 *
 * or with positional args:
 *
 *   npm run example -- 192.168.1.10 me secret
 *
 * Optional environment variables:
 *   LOXONE_TLS=true            use wss/https (needs a Gen-2 MS + matching hostname)
 *   LOXONE_LOG_LEVEL=debug     trace | debug | info | warn | error   (default: info)
 *   LOXONE_WATCH_SECONDS=15    how long to stream live updates        (default: 15)
 *   LOXONE_CONTROL=<uuid>      a control UUID to send a command to    (optional)
 *   LOXONE_COMMAND=pulse       command to send to LOXONE_CONTROL       (default: pulse)
 */
import { ConsoleLogger, LoxoneClient, type LogLevel } from '../src/index.js';

const LOG_LEVELS: readonly LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

function parseLogLevel(value: string | undefined): LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value ?? '') ? (value as LogLevel) : 'info';
}

const host = process.env.LOXONE_HOST ?? process.argv[2];
const username = process.env.LOXONE_USER ?? process.argv[3];
const password = process.env.LOXONE_PASS ?? process.argv[4];

if (!host || !username || !password) {
  console.error(
    [
      'Missing connection details.',
      '',
      'Usage:',
      '  LOXONE_HOST=ip:port LOXONE_USER=user LOXONE_PASS=pass npm run example',
      '  npm run example -- <ip:port> <user> <pass>',
      '',
      'See the header of examples/testclient.ts for all options.',
    ].join('\n'),
  );
  process.exit(1);
}

const useTls = process.env.LOXONE_TLS === 'true';
const watchSeconds = Number(process.env.LOXONE_WATCH_SECONDS ?? 15);
const controlUuid = process.env.LOXONE_CONTROL;
const controlCommand = process.env.LOXONE_COMMAND ?? 'pulse';
// Optional comma-separated state UUIDs to subscribe to (otherwise: the firehose).
const watchUuids = (process.env.LOXONE_WATCH ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const client = new LoxoneClient(host, username, password, {
  useTls,
  logger: new ConsoleLogger(parseLogLevel(process.env.LOXONE_LOG_LEVEL)),
  // Fail fast for a test run instead of retrying in the background.
  autoReconnect: false,
  // Opt out of auto-start so we can attach the firehose before the initial burst.
  enableUpdatesOnConnect: false,
});

client.on('stateChanged', (state) => console.log(`  [state] ${state}`));
client.on('error', (error) => console.error(`  [error] ${error.message}`));
client.on('outOfService', () => console.warn('  [out-of-service] Miniserver is going down'));
client.on('tokenChanged', (info) => console.log(`  [token] changed (valid until ${info.validUntil.toISOString()})`));
client.once('statesSettled', () => console.log('  [statesSettled] initial snapshot complete'));

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let shuttingDown = false;
async function shutdown(code: number): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await client.disconnect();
  } catch (error) {
    console.error(`Error during disconnect: ${(error as Error).message}`);
  }
  process.exit(code);
}
process.on('SIGINT', () => void shutdown(0));

async function main(): Promise<void> {
  console.log(`\n=== Connecting to ${host} (TLS: ${useTls}) ===`);
  await client.connect();

  const info = client.apiInfo;
  console.log(`\n=== Miniserver ===`);
  console.log(`  serial:   ${info?.serialNumber}`);
  console.log(`  firmware: ${info?.version}`);
  console.log(`  local:    ${info?.local}`);
  console.log(`  slots:    ${info?.hasEventSlots}`);

  console.log(`\n=== Structure ===`);
  // connect() loaded the structure automatically (loadStructureOnConnect).
  const structure = client.structure!;
  console.log(`  name:        ${structure.msInfo.msName}`);
  console.log(`  lastModified ${structure.lastModified}`);
  console.log(`  rooms:       ${structure.rooms.size}`);
  console.log(`  categories:  ${structure.categories.size}`);
  console.log(`  controls:    ${structure.controls.size}`);
  console.log(`  states:      ${structure.statesByUuid.size}`);

  console.log(`\n  Sample controls:`);
  let shown = 0;
  for (const control of structure.controls.values()) {
    if (control.parent) continue; // skip sub-controls in the sample
    console.log(`    - [${control.type}] ${control.room?.name ?? '-'} / ${control.name}  (${control.uuid})`);
    if (++shown >= 10) break;
  }

  console.log(`\n=== Live updates (${watchSeconds}s, ${watchUuids.length ? `watching ${watchUuids.length}` : 'firehose'}) ===`);
  let changeCount = 0;
  const onChange = (label: string) => (change: { state: string | undefined; value: number | string; item: { name: string } }) => {
    changeCount++;
    console.log(`  [${label}] ${change.item.name}.${change.state ?? '?'} = ${change.value}`);
  };
  if (watchUuids.length > 0) {
    // subscribe to specific state UUIDs at the item level
    for (const uuid of watchUuids) client.item(uuid)?.onChange(onChange('item'), { emitCurrent: false });
  } else {
    // the change-level firehose
    client.onAnyChange(onChange('any'));
  }
  await client.enableUpdates();
  await sleep(watchSeconds * 1000);
  console.log(`\n  Received ${changeCount} state changes.`);

  // Read-only demonstration of the navigation + typed-wrapper + value ergonomics.
  console.log(`\n=== Typed ergonomics (read-only) ===`);
  const byType = (t: string): number => structure.getControlsByType(t).length;
  console.log(
    `  counts: Switch=${byType('Switch')} Dimmer=${byType('Dimmer')} Jalousie=${byType('Jalousie')} LightControllerV2=${byType('LightControllerV2')}`,
  );
  const firstSwitch = structure.getControlsByType('Switch')[0];
  if (firstSwitch) {
    console.log(`  asSwitch("${firstSwitch.name}").isOn = ${client.asSwitch(firstSwitch)?.isOn}`);
  }
  const firstJalousie = structure.getControlsByType('Jalousie')[0];
  if (firstJalousie) {
    console.log(`  asJalousie("${firstJalousie.name}").positionPercent = ${client.asJalousie(firstJalousie)?.positionPercent}`);
  }
  const firstAnalog = structure.getControlsByType('InfoOnlyAnalog')[0];
  const analogState = firstAnalog?.states[0];
  if (firstAnalog && analogState) {
    console.log(`  ${firstAnalog.name}.${analogState.name} = ${analogState.formatted} (raw ${analogState.numericValue})`);
  }
  const sunset = structure.getGlobalState('sunset');
  if (sunset) console.log(`  globalState sunset = ${sunset.numericValue}`);

  // subscribe() delivers the current value immediately, then live changes.
  if (firstSwitch) {
    const off = client.subscribe(firstSwitch, (e) => console.log(`  [subscribe] ${e.toPath()} = ${'value' in e ? e.value : e.text}`));
    off();
  }

  // wrap() picks the right typed handle by control type.
  const firstDimmer = structure.getControlsByType('Dimmer')[0];
  if (firstDimmer) console.log(`  wrap("${firstDimmer.name}") -> ${client.wrap(firstDimmer)?.constructor.name} (position ${client.asDimmer(firstDimmer)?.position})`);
  const firstRoom = structure.getControlsByType('IRoomControllerV2')[0];
  if (firstRoom) {
    const rc = client.asRoomController(firstRoom);
    console.log(`  asRoomController("${firstRoom.name}") temp=${rc?.temperature} target=${rc?.targetTemperature} mode=${rc?.mode}`);
  }

  if (controlUuid) {
    console.log(`\n=== Control: ${controlUuid} -> "${controlCommand}" ===`);
    const response = await client.control(controlUuid, controlCommand);
    console.log(`  response code=${response.code} value=${String(response.value)}`);
  }

  console.log(`\n=== Done; disconnecting ===`);
  await shutdown(0);
}

main().catch(async (error: unknown) => {
  console.error(`\nFatal: ${(error as Error).message}`);
  console.error((error as Error).stack);
  await shutdown(1);
});
