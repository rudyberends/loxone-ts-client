import { describe, expect, it } from 'vitest';
import { loxoneEpochToDate, LOXONE_EPOCH_MS } from '../src/protocol/loxoneEpoch.js';
import { StructureModel } from '../src/structure/StructureModel.js';
import type { LoxoneStructureFile } from '../src/structure/types.js';

describe('loxoneEpochToDate', () => {
  it('treats 0 as 2009-01-01T00:00:00Z', () => {
    expect(loxoneEpochToDate(0).toISOString()).toBe('2009-01-01T00:00:00.000Z');
    expect(LOXONE_EPOCH_MS).toBe(Date.UTC(2009, 0, 1));
  });
  it('adds seconds', () => {
    expect(loxoneEpochToDate(60).getTime()).toBe(LOXONE_EPOCH_MS + 60_000);
  });
});

const SUNSET = '0a0a0a0a-0000-0000-0000000000000001';

const FIXTURE: LoxoneStructureFile = {
  lastModified: 'x',
  msInfo: {},
  globalStates: { sunset: SUNSET, favColors: ['c1', 'c2'] },
  rooms: {},
  cats: {},
  weatherServer: { states: { actual: 'w1' } },
  controls: {},
};

describe('global-state accessors', () => {
  const model = StructureModel.parse(FIXTURE);

  it('exposes globalStates and weatherServer', () => {
    expect(model.globalStates.sunset).toBe(SUNSET);
    expect(model.weatherServer).toEqual({ states: { actual: 'w1' } });
  });

  it('registers string-valued globals as resolvable States', () => {
    const sunset = model.getGlobalState('sunset');
    expect(sunset?.uuid).toBe(SUNSET);
    expect(sunset?.control.type).toBe('GlobalStates');
    // and it's in the flat state index so events enrich it
    expect(model.getStateByUuid(SUNSET)).toBe(sunset);
  });

  it('returns undefined for list-valued or unknown globals', () => {
    expect(model.getGlobalState('favColors')).toBeUndefined();
    expect(model.getGlobalState('nope')).toBeUndefined();
  });

  it('does not pollute control enumeration with the synthetic control', () => {
    expect(model.getControlsByType('GlobalStates')).toHaveLength(0);
    expect(model.allControls.some((c) => c.type === 'GlobalStates')).toBe(false);
    expect(model.getControlsInRoom('Unassigned')).toHaveLength(0);
  });
});
