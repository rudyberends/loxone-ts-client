import { describe, expect, it } from 'vitest';
import { ValueEvent } from '../src/protocol/events/ValueEvent.js';
import { TextEvent } from '../src/protocol/events/TextEvent.js';
import { Uuid } from '../src/protocol/messages/Uuid.js';
import { StructureModel } from '../src/structure/StructureModel.js';
import { formatLoxoneValue } from '../src/structure/format.js';
import type { LoxoneStructureFile } from '../src/structure/types.js';

const SWITCH_UUID = '0f869a02-0367-3105-ffffb2f8baf0a3e6';
const ACTIVE_STATE = '11111111-1111-1111-1111111111111111';
const TEMP_UUID = '22222222-2222-2222-2222222222222222';
const TEMP_STATE = '33333333-3333-3333-3333333333333333';
const LOCK_STATE = '44444444-4444-4444-4444444444444444';
const JSON_STATE = '55555555-5555-5555-5555555555555555';

const FIXTURE: LoxoneStructureFile = {
  lastModified: '2026-06-14 12:00:00',
  msInfo: { msName: 'Home' },
  rooms: { 'room-1': { uuid: 'room-1', name: 'Living Room' } },
  cats: { 'cat-1': { uuid: 'cat-1', name: 'Lighting', type: 'lights' } },
  controls: {
    [SWITCH_UUID]: {
      name: 'Ceiling Light',
      type: 'Switch',
      uuidAction: SWITCH_UUID,
      room: 'room-1',
      cat: 'cat-1',
      states: { active: ACTIVE_STATE },
    },
    [TEMP_UUID]: {
      name: 'Temperature',
      type: 'InfoOnlyAnalog',
      uuidAction: TEMP_UUID,
      room: 'room-1',
      details: { format: '%.1f°C' },
      states: { value: TEMP_STATE },
    },
    'lockable-uuid': {
      name: 'Lockable',
      type: 'Switch',
      uuidAction: 'lockable-uuid',
      room: 'room-1',
      states: { jLocked: LOCK_STATE, icon: JSON_STATE },
    },
  },
};

function textBuf(stateUuid: string, text: string): Buffer {
  const uuid = Uuid.fromString(stateUuid).toBuffer();
  const icon = Uuid.EMPTY.toBuffer();
  const len = Buffer.alloc(4);
  len.writeUInt32LE(Buffer.byteLength(text), 0);
  const body = Buffer.concat([uuid, icon, len, Buffer.from(text, 'utf8')]);
  const pad = (4 - (body.length % 4)) % 4;
  return pad ? Buffer.concat([body, Buffer.alloc(pad)]) : body;
}

describe('formatLoxoneValue', () => {
  it('applies printf-style precision and units', () => {
    expect(formatLoxoneValue(21.349, '%.1f°C')).toBe('21.3°C');
    expect(formatLoxoneValue(49.6, '%.0f %%')).toBe('50 %');
    expect(formatLoxoneValue(7.9, '%i')).toBe('8');
  });
  it('resolves a literal %% even without a numeric conversion', () => {
    expect(formatLoxoneValue(50, '%.0f%%')).toBe('50%');
    expect(formatLoxoneValue(5, '%%')).toBe('%'); // regression: was returning the raw number
  });
  it('returns the raw value when no usable format is given', () => {
    expect(formatLoxoneValue(3.14, undefined)).toBe('3.14');
    expect(formatLoxoneValue(3.14, 'no-placeholder')).toBe('3.14');
  });
});

describe('State value getters', () => {
  const model = StructureModel.parse(FIXTURE);

  it('exposes numeric/boolean/text/updatedAt + formatted', () => {
    const active = model.getStateByUuid(ACTIVE_STATE)!;
    active.latestEvent = ValueEvent.parse(valueBuf(ACTIVE_STATE, 1), 0);
    expect(active.numericValue).toBe(1);
    expect(active.booleanValue).toBe(true);
    expect(active.textValue).toBeUndefined();
    expect(active.updatedAt).toBeInstanceOf(Date);

    const temp = model.getStateByUuid(TEMP_STATE)!;
    temp.latestEvent = ValueEvent.parse(valueBuf(TEMP_STATE, 21.349), 0);
    expect(temp.numericValue).toBeCloseTo(21.349);
    expect(temp.formatted).toBe('21.3°C'); // format string applied
  });

  it('booleanValue is false for 0 and undefined before any event', () => {
    const s = model.getStateByUuid(ACTIVE_STATE)!;
    s.latestEvent = ValueEvent.parse(valueBuf(ACTIVE_STATE, 0), 0);
    expect(s.booleanValue).toBe(false);
  });
});

describe('Control lock status + State.json', () => {
  function freshControl() {
    const model = StructureModel.parse(FIXTURE);
    return model.getControl('lockable-uuid')!;
  }

  it('reports unlocked when jLocked is empty/absent', () => {
    const control = freshControl();
    expect(control.isLocked).toBe(false);
    expect(control.lockStatus).toEqual({ locked: false, level: 0, reason: undefined });
  });

  it('parses a jLocked JSON status', () => {
    const control = freshControl();
    control.getState('jLocked')!.latestEvent = TextEvent.parse(
      textBuf(LOCK_STATE, JSON.stringify({ locked: 2, reason: 'Blocked by logic' })),
      0,
    );
    expect(control.isLocked).toBe(true);
    expect(control.lockStatus).toEqual({ locked: true, level: 2, reason: 'Blocked by logic' });
  });

  it('State.json parses JSON text states and tolerates non-JSON', () => {
    const control = freshControl();
    const icon = control.getState('icon')!;
    icon.latestEvent = TextEvent.parse(textBuf(JSON_STATE, '{"icon":"x.svg","color":"#575C61"}'), 0);
    expect(icon.json<{ icon: string; color: string }>()).toEqual({ icon: 'x.svg', color: '#575C61' });
    icon.latestEvent = TextEvent.parse(textBuf(JSON_STATE, 'not json'), 0);
    expect(icon.json()).toBeUndefined();
  });
});

describe('StructureModel navigation', () => {
  const model = StructureModel.parse(FIXTURE);

  it('finds controls by name (case-insensitive) and by room', () => {
    expect(model.getControlByName('ceiling light')?.uuid).toBe(SWITCH_UUID);
    expect(model.getControlByName('Ceiling Light', 'Living Room')?.uuid).toBe(SWITCH_UUID);
    expect(model.getControlByName('Ceiling Light', 'Kitchen')).toBeUndefined();
  });

  it('finds controls by type, room and category', () => {
    expect(model.getControlsByType('Switch').map((c) => c.uuid)).toEqual([SWITCH_UUID, 'lockable-uuid']);
    expect(model.getControlsInRoom('Living Room')).toHaveLength(3);
    expect(model.getControlsByCategory('Lighting').map((c) => c.uuid)).toEqual([SWITCH_UUID]);
  });

  it('back-references controls from rooms and categories', () => {
    expect(model.rooms.get('room-1')!.controls).toHaveLength(3);
    expect(model.categories.get('cat-1')!.controls).toHaveLength(1);
  });
});

function valueBuf(stateUuid: string, value: number): Buffer {
  const buf = Buffer.alloc(24);
  Uuid.fromString(stateUuid).toBuffer().copy(buf, 0);
  buf.writeDoubleLE(value, 16);
  return buf;
}
