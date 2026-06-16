/**
 * Live verification of the generated-wrapper enrichment (enum labels, Date
 * pairings, JSON getters) against a real Miniserver. It connects, streams a
 * snapshot of live state, then for every control reflects over its typed
 * wrapper and prints any decoded label / Date / JSON value it can read.
 *
 *   npm run example:verify -- <ip:port> <user> <pass>
 */
import { ConsoleLogger, LoxoneClient } from '../src/index.js';

const host = process.argv[2];
const username = process.argv[3];
const password = process.argv[4];
if (!host || !username || !password) {
  console.error('usage: npm run example:verify -- <ip:port> <user> <pass>');
  process.exit(1);
}

const client = new LoxoneClient(host, username, password, {
  logger: new ConsoleLogger('warn'),
  autoReconnect: false,
});

/** Collect getter names + zero-arg methods declared above ControlHandle. */
function enrichedMembers(handle: object): { getters: string[]; methods: string[] } {
  const getters: string[] = [];
  const methods: string[] = [];
  let proto: object | null = Object.getPrototypeOf(handle);
  while (proto && proto.constructor?.name !== 'ControlHandle' && proto !== Object.prototype) {
    for (const [name, desc] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
      if (name === 'constructor') continue;
      if (typeof desc.get === 'function' && (name.endsWith('Label') || name.endsWith('Date'))) getters.push(name);
      if (typeof desc.value === 'function' && name.endsWith('Json')) methods.push(name);
    }
    proto = Object.getPrototypeOf(proto);
  }
  return { getters: [...new Set(getters)], methods: [...new Set(methods)] };
}

async function main(): Promise<void> {
  console.log(`\n=== Connecting to ${host} ===`);
  await client.connect(); // structure loaded + live updates started automatically
  const structure = client.structure!;
  console.log(`  ${structure.controls.size} controls, ${structure.statesByUuid.size} states`);

  console.log(`\n=== Streaming a 12s snapshot (firehose) ===`);
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 12_000);
    client.once('statesSettled', () => {
      clearTimeout(t);
      // give a moment for trailing text events after settle
      setTimeout(resolve, 1500);
    });
  });

  console.log(`\n=== Decoded enrichment from live data ===`);
  let labelHits = 0;
  let dateHits = 0;
  let jsonHits = 0;
  for (const control of structure.controls.values()) {
    const handle = client.wrap(control);
    if (!handle) continue;
    const { getters, methods } = enrichedMembers(handle);
    if (getters.length === 0 && methods.length === 0) continue;
    const bag = handle as unknown as Record<string, unknown>;
    const lines: string[] = [];
    for (const name of getters) {
      const value = bag[name];
      if (value === undefined) continue;
      if (name.endsWith('Label')) {
        const raw = bag[name.slice(0, -'Label'.length)];
        lines.push(`    ${name} = ${JSON.stringify(value)}  (raw ${String(raw)})`);
        labelHits++;
      } else {
        lines.push(`    ${name} = ${(value as Date).toISOString?.() ?? String(value)}`);
        dateHits++;
      }
    }
    for (const name of methods) {
      const value = (bag[name] as (() => unknown) | undefined)?.();
      if (value === undefined) continue;
      const json = JSON.stringify(value);
      lines.push(`    ${name}() = ${json.length > 90 ? json.slice(0, 90) + '…' : json}`);
      jsonHits++;
    }
    if (lines.length) {
      console.log(`  [${control.type}] ${control.name}`);
      console.log(lines.join('\n'));
    }
  }
  console.log(`\n  totals: ${labelHits} enum labels, ${dateHits} dates, ${jsonHits} json — decoded from live state.`);
  await client.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
