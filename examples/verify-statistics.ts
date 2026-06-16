/**
 * Live verification for the statistics, control-history and enriched-change work.
 *
 * Connects, finds controls that advertise statistics / history in the structure,
 * and exercises the real wire paths + binary decoding against the Miniserver.
 *
 *   npm run example:stats -- <ip:port> <user> <pass>
 *   LOXONE_HOST=ip LOXONE_USER=u LOXONE_PASS=p npx tsx examples/verify-statistics.ts
 */
import { ConsoleLogger, LoxoneClient, type Control } from '../src/index.js';

const host = process.env.LOXONE_HOST ?? process.argv[2];
const username = process.env.LOXONE_USER ?? process.argv[3];
const password = process.env.LOXONE_PASS ?? process.argv[4];
if (!host || !username || !password) {
  console.error('Usage: npx tsx examples/verify-statistics.ts <ip:port> <user> <pass>');
  process.exit(1);
}

const client = new LoxoneClient(host, username, password, {
  logger: new ConsoleLogger((process.env.LOXONE_LOG_LEVEL as 'info') ?? 'warn'),
});

function preview(c: Control): string {
  return `${c.name} [${c.type}] ${c.uuidAction}`;
}

async function main(): Promise<void> {
  await client.connect();
  const structure = client.structure!;
  const all = [...structure.controls.values()];

  const withHistory = all.filter((c) => c.hasHistory);
  const withV2 = all.filter((c) => c.statisticV2 !== undefined);
  const withV1 = all.filter((c) => c.statistic !== undefined);
  console.log(`\nControls: ${all.length} | hasHistory: ${withHistory.length} | statisticV2: ${withV2.length} | statistic(V1): ${withV1.length}\n`);

  // --- Control history ---------------------------------------------------
  if (withHistory[0]) {
    const c = withHistory[0];
    console.log(`HISTORY  ${preview(c)}`);
    try {
      const log = await client.getControlHistory(c);
      console.log(`  ${log.length} entries; newest:`);
      for (const e of log.slice(0, 3)) {
        console.log(`    ${e.timestamp.toISOString()}  ${e.what}  ← ${e.trigger ?? '-'} (${e.triggerType ?? '-'})  impacts=[${e.impacts.join(', ')}]`);
      }
    } catch (err) {
      console.log(`  getControlHistory failed: ${(err as Error).message}`);
    }
  } else {
    console.log('HISTORY  (no control advertises hasHistory)');
  }

  // --- V2 statistics -----------------------------------------------------
  if (withV2[0]) {
    const c = withV2[0];
    console.log(`\nSTAT V2  ${preview(c)}`);
    console.log(`  groups in structure: ${c.statisticV2!.groups.map((g) => `${g.id}(${g.dataPoints.map((d) => d.output).join('/')})`).join(', ')}`);
    try {
      const info = await client.getStatisticInfo(c);
      console.log(`  getStatisticInfo: ${JSON.stringify(info.map((g) => ({ id: g.id, since: g.activeSinceDate.toISOString() })))}`);
      const group = info[0] ?? { id: c.statisticV2!.groups[0]!.id };
      const to = new Date();
      const from = new Date(to.getTime() - 7 * 24 * 3600 * 1000); // last 7 days
      const points = await client.getStatistic(c, { groupId: group.id, from, to, unit: 'day', mode: 'diff' });
      console.log(`  getStatistic(diff, day, last 7d): ${points.length} points`);
      for (const p of points.slice(0, 5)) {
        console.log(`    ${p.timestamp.toISOString()}  [${p.values.map((v) => v.toFixed(3)).join(', ')}]`);
      }
    } catch (err) {
      console.log(`  V2 statistics failed: ${(err as Error).message}`);
    }
  } else {
    console.log('\nSTAT V2  (no control has statisticV2)');
  }

  // --- V1 statistics -----------------------------------------------------
  if (withV1[0]) {
    const c = withV1[0];
    const now = new Date();
    const month = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    console.log(`\nSTAT V1  ${preview(c)}  (${c.statistic!.outputs.length} outputs, month ${month})`);
    try {
      const points = await client.getStatisticV1(c, month);
      console.log(`  getStatisticV1: ${points.length} points`);
      for (const p of points.slice(0, 5)) {
        console.log(`    ${p.timestamp.toISOString()}  [${p.values.map((v) => v.toFixed(3)).join(', ')}]`);
      }
    } catch (err) {
      console.log(`  V1 statistics failed: ${(err as Error).message}`);
    }
  } else {
    console.log('\nSTAT V1  (no control has a V1 statistic)');
  }

  // --- Enriched change events -------------------------------------------
  console.log('\nCHANGE   sampling live updates for 4s (raw → formatted | boolean):');
  let n = 0;
  const off = client.onAnyChange((ch) => {
    if (n++ < 8) console.log(`    ${ch.item.name}.${ch.state} = ${JSON.stringify(ch.value)} → "${ch.formatted ?? ''}" | ${ch.boolean}`);
  });
  await new Promise((r) => setTimeout(r, 4000));
  off();

  await client.disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
