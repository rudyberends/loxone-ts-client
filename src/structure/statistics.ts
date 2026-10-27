import { loxoneEpochToDate } from '../protocol/loxoneEpoch.js';

/** One decoded statistic datapoint: a timestamp and the recorded value(s). */
export interface StatisticPoint {
  /** When this datapoint was recorded. */
  timestamp: Date;
  /** {@link timestamp} as integer Unix seconds — cheaper to store or serialize than the `Date`. */
  ts: number;
  /** The recorded value(s), one per output, in stream/request order. */
  values: number[];
}

/** A V2 statistic group as reported by `getStatisticInfo`. */
export interface StatisticGroupInfo {
  /** Group id — pass it as `groupId` to {@link StatisticQuery}. */
  id: number;
  /** Unix-UTC timestamp since when data is available. */
  activeSince: number;
  /** {@link activeSince} as a `Date`. */
  activeSinceDate: Date;
}

/** How a V2 statistic series is aggregated per returned datapoint. */
export type StatisticUnit = 'all' | 'hour' | 'day' | 'month' | 'year';

/** How a V2 statistic series is read: raw recorded values, or per-unit diffs. */
export type StatisticMode = 'raw' | 'diff';

/** The parameters of a V2 `getStatistic` request. */
export interface StatisticQuery {
  /** Which statistic group to read (see {@link StatisticGroupInfo.id}). */
  groupId: number | string;
  /** Start of the range (a `Date`, or Unix-UTC seconds); inclusive. */
  from: Date | number;
  /** End of the range (a `Date`, or Unix-UTC seconds); inclusive. */
  to: Date | number;
  /** Aggregation per returned datapoint. */
  unit: StatisticUnit;
  /** Read mode; defaults to `'raw'`. */
  mode?: StatisticMode;
  /** Optional single output name; omit to return every output of the group. */
  output?: string;
}

/**
 * The parameters of a {@link ../LoxoneClient.LoxoneClient.getStatistics} request,
 * which reads V1 or V2 statistics through one shape. The V2-only fields are
 * ignored when the V1 handling is used.
 */
export interface StatisticsRequest {
  /** Start of the range (a `Date`, or Unix seconds); inclusive. */
  from: Date | number;
  /** End of the range (a `Date`, or Unix seconds); inclusive. */
  to: Date | number;
  /**
   * Which handling to read. Defaults to V2 when the control has a `statisticV2`
   * configuration, else V1.
   */
  version?: 'v1' | 'v2';
  /** V2: the statistic group; defaults to the control's first `statisticV2` group. */
  groupId?: number | string;
  /** V2: aggregation per returned datapoint; defaults to `'all'`. */
  unit?: StatisticUnit;
  /** V2: read mode; defaults to `'raw'`. */
  mode?: StatisticMode;
  /** V2: optional single output name; omit to return every output of the group. */
  output?: string;
}

/** A {@link StatisticPoint} reduced for storage or transfer — see {@link compactStatistics}. */
export interface CompactStatisticPoint {
  /** Unix seconds. */
  ts: number;
  /** The recorded value(s), in the same order as {@link StatisticPoint.values}. */
  v: number[];
}

/** Options for {@link compactStatistics}. */
export interface CompactStatisticsOptions {
  /**
   * Round each value to this many decimals. When omitted, values are only cleaned
   * of float conversion artefacts (rounded to 15 significant digits, so
   * `25.259999999999998` becomes `25.26`).
   */
  decimals?: number;
}

/**
 * Reduces statistic points to `{ ts, v }` records with Unix-second timestamps and
 * cleaned values — a fraction of the JSON size of the `Date`-based points for long
 * series.
 */
export function compactStatistics(
  points: readonly StatisticPoint[],
  options: CompactStatisticsOptions = {},
): CompactStatisticPoint[] {
  const { decimals } = options;
  if (decimals !== undefined && (!Number.isInteger(decimals) || decimals < 0 || decimals > 100)) {
    throw new RangeError(`decimals must be an integer between 0 and 100, got ${decimals}`);
  }
  const clean = decimals === undefined ? cleanFloat : (v: number) => Number(v.toFixed(decimals));
  return points.map((p) => ({ ts: p.ts, v: p.values.map(clean) }));
}

/** Drops float conversion artefacts by rounding to 15 significant digits. */
function cleanFloat(value: number): number {
  return Number.isFinite(value) ? Number(value.toPrecision(15)) : value;
}

/** Formats the month of `date` as a V1 statistic file date (`"YYYYMM"`, UTC components). */
export function toStatisticMonth(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Every V1 month (`"YYYYMM"`) touched by the range `from`–`to`, oldest first. */
export function statisticMonthsBetween(from: Date, to: Date): string[] {
  const months: string[] = [];
  for (let i = monthIndex(from), end = monthIndex(to); i <= end; i++) months.push(toStatisticMonth(monthStart(i)));
  return months;
}

/** Months since year 0 — makes month arithmetic plain integer arithmetic. */
export function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

/** The first instant (UTC) of the month with the given {@link monthIndex}. */
export function monthStart(index: number): Date {
  return new Date(Date.UTC(Math.floor(index / 12), index % 12, 1));
}

/** Coerces a `Date` or a number to integer Unix-UTC seconds. */
export function toUnixSeconds(value: Date | number): number {
  return Math.floor(typeof value === 'number' ? value : value.getTime() / 1000);
}

/**
 * Decodes a Loxone binary statistic stream: repeating fixed-width records of
 * `[ts: uint32 LE][value: float64 LE] × valueCount`. The timestamp epoch differs
 * by handling — V1 (`binstatisticdata`) counts seconds since the Loxone epoch
 * (2009, Miniserver-local time); V2 (`getStatistic`) uses Unix-UTC seconds.
 *
 * `valueCount` is the number of outputs per record: for V1 it is the length of
 * the control's `statistic.outputs`; for V2 it is `1` when a single output was
 * requested, else the group's datapoint count.
 */
export function decodeBinaryStatistics(
  bytes: Uint8Array,
  valueCount: number,
  epoch: 'loxone' | 'unix',
): StatisticPoint[] {
  if (!Number.isInteger(valueCount) || valueCount < 1) {
    throw new RangeError(`valueCount must be a positive integer, got ${valueCount}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const stride = 4 + valueCount * 8;
  const points: StatisticPoint[] = [];
  for (let offset = 0; offset + stride <= view.byteLength; offset += stride) {
    const ts = view.getUint32(offset, true);
    const values = new Array<number>(valueCount);
    for (let i = 0; i < valueCount; i++) {
      values[i] = view.getFloat64(offset + 4 + i * 8, true);
    }
    const timestamp = epoch === 'loxone' ? loxoneEpochToDate(ts) : new Date(ts * 1000);
    points.push({ timestamp, ts: timestamp.getTime() / 1000, values });
  }
  return points;
}

/** Parses the JSON array returned by `getStatisticInfo` into typed group infos. */
export function parseStatisticInfo(raw: unknown): StatisticGroupInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const o = (entry ?? {}) as { id?: unknown; activeSince?: unknown };
    const id = typeof o.id === 'number' ? o.id : Number(o.id);
    const activeSince = typeof o.activeSince === 'number' ? o.activeSince : 0;
    return { id, activeSince, activeSinceDate: new Date(activeSince * 1000) };
  });
}
