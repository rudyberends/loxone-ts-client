import { describe, expect, it } from 'vitest';
import { StructureModel } from '../src/structure/StructureModel.js';
import type { LoxoneStructureFile } from '../src/structure/types.js';

const FIXTURE: LoxoneStructureFile = {
  lastModified: '2026-06-14 12:00:00',
  msInfo: { serialNr: '504F94A0', msName: 'Home', miniserverType: 2 },
  globalStates: { sunrise: '0a0a0a0a-0000-0000-0000000000000000' },
  rooms: {
    'room-uuid-1': { uuid: 'room-uuid-1', name: 'Living Room' },
  },
  cats: {
    'cat-uuid-1': { uuid: 'cat-uuid-1', name: 'Lighting', type: 'lights' },
  },
  controls: {
    '0f869a02-0367-3105-ffffb2f8baf0a3e6': {
      name: 'Ceiling Light',
      type: 'Switch',
      uuidAction: '0f869a02-0367-3105-ffffb2f8baf0a3e6',
      room: 'room-uuid-1',
      cat: 'cat-uuid-1',
      isSecured: true,
      states: { active: '11111111-1111-1111-1111111111111111' },
      subControls: {
        '22222222-2222-2222-2222222222222222': {
          name: 'Sub Dimmer',
          type: 'Dimmer',
          uuidAction: '22222222-2222-2222-2222222222222222',
          states: { position: '33333333-3333-3333-3333333333333333' },
        },
      },
    },
    'orphan-control': {
      name: 'Outside Sensor',
      type: 'InfoOnlyAnalog',
      uuidAction: 'orphan-control',
      states: { value: '44444444-4444-4444-4444444444444444' },
    },
  },
};

describe('StructureModel.parse', () => {
  const model = StructureModel.parse(FIXTURE);

  it('exposes top-level metadata', () => {
    expect(model.lastModified).toBe('2026-06-14 12:00:00');
    expect(model.msInfo.msName).toBe('Home');
  });

  it('builds rooms (plus a synthetic Unassigned room) and categories', () => {
    expect(model.rooms.get('room-uuid-1')?.name).toBe('Living Room');
    expect(model.rooms.get('00000000-0000-0000-0000000000000000')?.name).toBe('Unassigned');
    expect(model.categories.get('cat-uuid-1')?.type).toBe('lights');
  });

  it('parses controls, sub-controls, and links them to rooms/categories', () => {
    const control = model.getControl('0f869a02-0367-3105-ffffb2f8baf0a3e6')!;
    expect(control.type).toBe('Switch');
    expect(control.isSecured).toBe(true);
    expect(control.room?.name).toBe('Living Room');
    expect(control.category?.name).toBe('Lighting');

    const sub = control.subControls.get('22222222-2222-2222-2222222222222222')!;
    expect(sub.parent).toBe(control);
    expect(sub.type).toBe('Dimmer');
    // Sub-controls inherit the parent's room when none is specified.
    expect(model.controls.has('22222222-2222-2222-2222222222222222')).toBe(true);
  });

  it('indexes every state by UUID for event enrichment', () => {
    const state = model.getStateByUuid('11111111-1111-1111-1111111111111111')!;
    expect(state.name).toBe('active');
    expect(state.control.name).toBe('Ceiling Light');
    expect(model.getStateByUuid('33333333-3333-3333-3333333333333333')?.control.type).toBe('Dimmer');
  });

  it('places room-less controls in the Unassigned room', () => {
    expect(model.getControl('orphan-control')?.room?.name).toBe('Unassigned');
  });
});
