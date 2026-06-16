import { loxoneEpochToDate } from '../protocol/loxoneEpoch.js';

/** One decoded statistic datapoint: a timestamp and the recorded value(s). */
export interface StatisticPoint {
  /** When this datapoint was recorded. */
  timestamp: Date;
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
    points.push({
      timestamp: epoch === 'loxone' ? loxoneEpochToDate(ts) : new Date(ts * 1000),
      values,
    });
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
