import { describe, expect, it } from 'vitest';
import { makeControlChange } from '../src/controls/ControlHandle.js';
import { GenericControl } from '../src/controls/ControlHandle.js';
import type { ControlCommandExecutor } from '../src/controls/ControlHandle.js';
import { TextEvent } from '../src/protocol/events/TextEvent.js';
import { ValueEvent } from '../src/protocol/events/ValueEvent.js';
import { TextMessage } from '../src/protocol/messages/TextMessage.js';
import { LOXONE_EPOCH_MS } from '../src/protocol/loxoneEpoch.js';
import { Uuid } from '../src/protocol/messages/Uuid.js';
import { parseControlHistory } from '../src/structure/history.js';
import { decodeBinaryStatistics, parseStatisticInfo, toUnixSeconds } from '../src/structure/statistics.js';
import { StructureModel } from '../src/structure/StructureModel.js';
import type { LoxoneStructureFile } from '../src/structure/types.js';

const ids = {
  temp: 'cccc0000-0000-0000-0000000000000201',
  digital: 'cccc0000-0000-0000-0000000000000202',
  meter: 'cccc0000-0000-0000-0000000000000203',
};
const st = {
  temp: 'dddd0000-0000-0000-0000000000000201',
  digital: 'dddd0000-0000-0000-0000000000000202',
};

const FIXTURE: LoxoneStructureFile = {
  lastModified: 'x',
  msInfo: {},
  rooms: {},
  cats: {},
  controls: {
    [ids.temp]: {
      name: 'Temp',
      type: 'InfoOnlyAnalog',
      uuidAction: ids.temp,
      details: { format: '%.1f°C' },
      states: { value: st.temp },
    },
    [ids.digital]: { name: 'Pump', type: 'InfoOnlyDigital', uuidAction: ids.digital, states: { active: st.digital } },
    [ids.meter]: {
      name: 'Grid',
      type: 'Meter',
      uuidAction: ids.meter,
      states: {},
      statistic: {
        frequency: 1,
        outputs: [
          { id: 0, name: 'A' },
          { id: 1, name: 'B' },
        ],
      },
      statisticV2: {
        groups: [
          {
            id: 1,
            mode: 1,
            dataPoints: [
              { title: 'Import', output: 'total' },
              { title: 'Export', output: 'totalNeg' },
            ],
          },
        ],
      },
    },
  },
};
const model = StructureModel.parse(FIXTURE);

/** Builds a binstatistic record stream: [ts uint32 LE][value f64 LE × valueCount]. */
function statBuf(records: Array<[number, number[]]>, valueCount: number): Buffer {
  const stride = 4 + valueCount * 8;
  const buf = Buffer.alloc(records.length * stride);
  records.forEach(([ts, values], r) => {
    const base = r * stride;
    buf.writeUInt32LE(ts >>> 0, base);
    values.forEach((v, i) => buf.writeDoubleLE(v, base + 4 + i * 8));
  });
  return buf;
}

function valueEvent(stateUuid: string, value: number): ValueEvent {
  const uuid = Uuid.fromString(stateUuid).toBuffer();
  const val = Buffer.alloc(8);
  val.writeDoubleLE(value, 0);
  return ValueEvent.parse(Buffer.concat([uuid, val]), 0);
}

function textEvent(stateUuid: string, text: string): TextEvent {
  const uuid = Uuid.fromString(stateUuid).toBuffer();
  const icon = Uuid.EMPTY.toBuffer();
  const len = Buffer.alloc(4);
  len.writeUInt32LE(Buffer.byteLength(text), 0);
  const body = Buffer.concat([uuid, icon, len, Buffer.from(text, 'utf8')]);
  const pad = (4 - (body.length % 4)) % 4;
  return TextEvent.parse(pad ? Buffer.concat([body, Buffer.alloc(pad)]) : body, 0);
}

const noopExec: ControlCommandExecutor = { control: () => Promise.resolve(new TextMessage('{}')) };

describe('decodeBinaryStatistics', () => {
  it('decodes V2 (unix epoch) single-output records', () => {
    const points = decodeBinaryStatistics(
      statBuf(
        [
          [1661983200, [3.2]],
          [1661983262, [-6.5]],
        ],
        1,
      ),
      1,
      'unix',
    );
    expect(points).toHaveLength(2);
    expect(points[0]!.timestamp.getTime()).toBe(1661983200 * 1000);
    expect(points[0]!.values).toEqual([3.2]);
    expect(points[1]!.values).toEqual([-6.5]);
  });

  it('decodes multiple outputs per record in order', () => {
    const points = decodeBinaryStatistics(statBuf([[100, [1.5, 2.5]]], 2), 2, 'unix');
    expect(points[0]!.values).toEqual([1.5, 2.5]);
  });

  it('decodes V1 timestamps against the Loxone epoch (2009)', () => {
    const points = decodeBinaryStatistics(statBuf([[0, [42]]], 1), 1, 'loxone');
    expect(points[0]!.timestamp.getTime()).toBe(LOXONE_EPOCH_MS);
  });

  it('ignores a trailing partial record', () => {
    const full = statBuf(
      [
        [10, [1]],
        [20, [2]],
      ],
      1,
    );
    const truncated = full.subarray(0, full.length - 3); // chop the last value short
    const points = decodeBinaryStatistics(truncated, 1, 'unix');
    expect(points).toHaveLength(1);
    expect(points[0]!.values).toEqual([1]);
  });

  it('rejects a non-positive value count', () => {
    expect(() => decodeBinaryStatistics(Buffer.alloc(0), 0, 'unix')).toThrow(RangeError);
  });

  it('decodes V1 with the value count taken from the control statistic outputs', () => {
    const meter = model.getControl(ids.meter)!;
    expect(meter.statistic!.outputs).toHaveLength(2);
    const points = decodeBinaryStatistics(statBuf([[5, [7, 8]]], 2), meter.statistic!.outputs.length, 'loxone');
    expect(points[0]!.values).toEqual([7, 8]);
  });
});

describe('parseStatisticInfo', () => {
  it('parses group infos and derives the activeSince date', () => {
    const groups = parseStatisticInfo([
      { id: 2, activeSince: 1661990400 },
      { id: 1, activeSince: 1661990400 },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ id: 2, activeSince: 1661990400 });
    expect(groups[0]!.activeSinceDate.getTime()).toBe(1661990400 * 1000);
  });
  it('returns [] for non-array input', () => {
    expect(parseStatisticInfo(undefined)).toEqual([]);
    expect(parseStatisticInfo('nope')).toEqual([]);
  });
});

describe('parseControlHistory', () => {
  it('parses entries with impacts, trigger and timestamps', () => {
    const entries = parseControlHistory([
      {
        ts: 1661990400,
        what: 'Lights off',
        trigger: 'Input off',
        impacts: ['Mood 0'],
        triggerType: 'control',
        triggerUuid: 'u1',
      },
      { ts: 1661990500, what: 'Lights on', triggerType: 'user' },
    ]);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      what: 'Lights off',
      trigger: 'Input off',
      impacts: ['Mood 0'],
      triggerType: 'control',
      triggerUuid: 'u1',
    });
    expect(entries[0]!.timestamp.getTime()).toBe(1661990400 * 1000);
    expect(entries[1]!.impacts).toEqual([]);
    expect(entries[1]!.trigger).toBeUndefined();
  });
  it('returns [] for non-array input and tolerates junk entries', () => {
    expect(parseControlHistory(null)).toEqual([]);
    expect(parseControlHistory([{}])).toEqual([
      {
        ts: 0,
        timestamp: new Date(0),
        what: '',
        trigger: undefined,
        impacts: [],
        triggerType: undefined,
        triggerUuid: undefined,
      },
    ]);
  });
});

describe('Control statistic/history flags', () => {
  it('exposes typed statistic/statisticV2 + hasStatistics/hasHistory', () => {
    const meter = model.getControl(ids.meter)!;
    expect(meter.statistic?.frequency).toBe(1);
    expect(meter.statisticV2?.groups[0]?.dataPoints).toHaveLength(2);
    expect(meter.hasStatistics).toBe(true);
    expect(meter.hasHistory).toBe(false);
    expect(model.getControl(ids.temp)!.hasStatistics).toBe(false);
  });
});

describe('makeControlChange enrichment', () => {
  it('adds formatted + boolean for value events', () => {
    const temp = model.getControl(ids.temp)!;
    const state = temp.getState('value')!;
    const event = valueEvent(st.temp, 21.3);
    event.state = state;
    state.latestEvent = event; // mirror dispatch: enrich() sets this before listeners run
    const change = makeControlChange(event, new GenericControl(temp, noopExec));
    expect(change).toMatchObject({ state: 'value', value: 21.3, boolean: true });
    expect(change.formatted).toBe('21.3°C');
  });

  it('boolean reflects 0 for digital-off and is undefined for text', () => {
    const pump = model.getControl(ids.digital)!;
    const offState = pump.getState('active')!;
    const offEvent = valueEvent(st.digital, 0);
    offEvent.state = offState;
    offState.latestEvent = offEvent;
    expect(makeControlChange(offEvent, new GenericControl(pump, noopExec)).boolean).toBe(false);

    const temp = model.getControl(ids.temp)!;
    const tState = temp.getState('value')!;
    const tEvent = textEvent(st.temp, 'hello');
    tEvent.state = tState;
    tState.latestEvent = tEvent;
    const change = makeControlChange(tEvent, new GenericControl(temp, noopExec));
    expect(change.value).toBe('hello');
    expect(change.boolean).toBeUndefined();
    expect(change.formatted).toBe('hello');
  });
});

describe('toUnixSeconds', () => {
  it('passes through numbers and floors dates', () => {
    expect(toUnixSeconds(1661990400)).toBe(1661990400);
    expect(toUnixSeconds(new Date(1661990400_500))).toBe(1661990400);
  });
});
