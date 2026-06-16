import { describe, expect, it } from 'vitest';
import { CONTROL_WRAPPERS } from '../src/controls/registry.js';
import { GENERATED_WRAPPERS } from '../src/controls/generated/index.js';

describe('control wrapper registry', () => {
  it('covers a broad set of control types', () => {
    // 12 hand-written + the generated set.
    expect(Object.keys(CONTROL_WRAPPERS).length).toBeGreaterThanOrEqual(60);
  });

  it('every entry key matches its wrapper controlType', () => {
    for (const [type, ctor] of Object.entries(CONTROL_WRAPPERS)) {
      expect(ctor.controlType).toBe(type);
    }
  });

  it('every generated wrapper is registered', () => {
    for (const ctor of GENERATED_WRAPPERS) {
      expect(CONTROL_WRAPPERS[ctor.controlType]).toBeDefined();
    }
  });

  it('hand-written wrappers win over generated ones on overlap', () => {
    // The 12 hand-written types should resolve to their hand-written classes.
    for (const type of ['Switch', 'Dimmer', 'Jalousie', 'Gate', 'Window', 'ColorPickerV2']) {
      expect(CONTROL_WRAPPERS[type]?.controlType).toBe(type);
    }
  });
});
