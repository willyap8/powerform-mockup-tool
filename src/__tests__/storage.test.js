import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  serializeDesign, deserializeDesign,
  loadSlots, saveSlots, saveToSlot, getSlot, deleteSlot,
} from '../storage';

const SLOTS_KEY = 'powerform.slots.v1'; // internal key, mirrored here for the corrupt-store test

// A form exercising the block variety the plan asks for: a heading, a number
// field, a radio group with weights, a checkbox group with weights, and a text
// field carrying a conditional rule that points at the number field.
function fixtureForm() {
  return {
    title: ' My Form ',
    blocks: [
      { id: 'h1',  type: 'formHeading', x: 5,  y: 5,   label: ' Head' },
      { id: 'num', type: 'field', fieldType: 'number',   label: 'Pain score', x: 10, y: 50,  width: 90,  height: 22, mandatory: true },
      { id: 'rad', type: 'field', fieldType: 'radio',    label: 'Severity',   x: 10, y: 100, width: 220, height: 22, options: ['Low', 'High'], optionWeights: [0, 5], selectedIndex: 1 },
      { id: 'chk', type: 'field', fieldType: 'checkbox', label: 'Symptoms',   x: 10, y: 150, width: 220, height: 22, options: ['A', 'B'], optionWeights: [1, 2] },
      { id: 'tgt', type: 'field', fieldType: 'text',     label: 'Followup',   x: 10, y: 200, width: 200, height: 22, enableWhen: { sourceId: 'num', op: 'ge', value: 3 } },
    ],
  };
}

const byLabel = (blocks, label) => blocks.find((b) => b.label === label);

// ---------------------------------------------------------------------------
// serialize / deserialize round-trip
// ---------------------------------------------------------------------------
describe('serialize/deserialize round-trip', () => {
  it('preserves title, notes and block properties', () => {
    const rt = deserializeDesign(serializeDesign(fixtureForm(), 'some notes'));
    expect(rt.title).toBe(' My Form ');
    expect(rt.notes).toBe('some notes');

    const num = byLabel(rt.blocks, 'Pain score');
    expect(num.type).toBe('field');
    expect(num.fieldType).toBe('number');
    expect(num.x).toBe(10);
    expect(num.y).toBe(50);
    expect(num.width).toBe(90);
    expect(num.height).toBe(22);
    expect(num.mandatory).toBe(true);

    const rad = byLabel(rt.blocks, 'Severity');
    expect(rad.options).toEqual(['Low', 'High']);
    expect(rad.optionWeights).toEqual([0, 5]);
    expect(rad.selectedIndex).toBe(1);

    const chk = byLabel(rt.blocks, 'Symptoms');
    expect(chk.options).toEqual(['A', 'B']);
    expect(chk.optionWeights).toEqual([1, 2]);
  });

  it('strips ids on save and regenerates unique ids on load', () => {
    const payload = serializeDesign(fixtureForm(), '');
    expect(payload.blocks.every((b) => !Object.prototype.hasOwnProperty.call(b, 'id'))).toBe(true);

    const rt = deserializeDesign(payload);
    expect(rt.blocks.every((b) => typeof b.id === 'string' && b.id.length > 0)).toBe(true);
    const ids = rt.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('writes the expected envelope fields', () => {
    const payload = serializeDesign(fixtureForm(), '');
    expect(payload.fileType).toBe('powerform-mockup');
    expect(typeof payload.version).toBe('number');
    expect(typeof payload.savedAt).toBe('string');
    expect(Number.isNaN(Date.parse(payload.savedAt))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// conditional-logic remapping (sourceId <-> sourceIndex)
// ---------------------------------------------------------------------------
describe('conditional-logic remapping', () => {
  it('serializes sourceId to the array index and rebuilds it on load', () => {
    const form = fixtureForm();
    const payload = serializeDesign(form, '');

    // 'num' is at index 1; the target must reference it by index, without sourceId.
    const serializedTarget = payload.blocks.find((b) => b.label === 'Followup');
    expect(serializedTarget.enableWhen.sourceIndex).toBe(1);
    expect(serializedTarget.enableWhen.sourceId).toBeUndefined();
    expect(serializedTarget.enableWhen.op).toBe('ge');
    expect(serializedTarget.enableWhen.value).toBe(3);

    const rt = deserializeDesign(payload);
    const target = byLabel(rt.blocks, 'Followup');
    const source = byLabel(rt.blocks, 'Pain score');
    expect(target.enableWhen.sourceId).toBe(source.id); // matched via the NEW id
    expect(target.enableWhen.op).toBe('ge');
    expect(target.enableWhen.value).toBe(3);
  });

  it('works when the source appears after the target in the array', () => {
    const form = {
      title: 'T',
      blocks: [
        { id: 'tgt', type: 'field', fieldType: 'text',   label: 'Followup', x: 0, y: 0, enableWhen: { sourceId: 'num', op: 'gt', value: 1 } },
        { id: 'num', type: 'field', fieldType: 'number', label: 'Score',    x: 0, y: 0 },
      ],
    };
    const rt = deserializeDesign(serializeDesign(form, ''));
    const target = byLabel(rt.blocks, 'Followup');
    const source = byLabel(rt.blocks, 'Score');
    expect(target.enableWhen.sourceId).toBe(source.id);
  });

  it('drops a rule whose source was deleted before save (dangling sourceId)', () => {
    const form = {
      title: 'T',
      blocks: [
        { id: 'tgt', type: 'field', fieldType: 'text', label: 'Followup', x: 0, y: 0, enableWhen: { sourceId: 'ghost', op: 'ge', value: 1 } },
      ],
    };
    const payload = serializeDesign(form, '');
    expect(payload.blocks[0].enableWhen.sourceIndex).toBe(-1);
    const rt = deserializeDesign(payload);
    expect(rt.blocks[0].enableWhen).toBeUndefined();
  });

  it('drops a rule with an out-of-range sourceIndex without throwing', () => {
    const payload = {
      fileType: 'powerform-mockup', version: 1, savedAt: new Date().toISOString(),
      title: 'T', notes: '',
      blocks: [
        { type: 'field', fieldType: 'text', label: 'Followup', enableWhen: { sourceIndex: 99, op: 'ge', value: 1 } },
      ],
    };
    const rt = deserializeDesign(payload);
    expect(rt.blocks[0].enableWhen).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------
describe('deserializeDesign validation', () => {
  const validBase = () => serializeDesign(fixtureForm(), '');

  it('throws for null / non-object input', () => {
    expect(() => deserializeDesign(null)).toThrow();
    expect(() => deserializeDesign(42)).toThrow();
    expect(() => deserializeDesign('nope')).toThrow();
  });

  it('throws for a wrong or missing fileType', () => {
    expect(() => deserializeDesign({ ...validBase(), fileType: 'something-else' })).toThrow();
    const { fileType, ...noType } = validBase();
    expect(() => deserializeDesign(noType)).toThrow();
  });

  it('throws for a missing or non-numeric version', () => {
    const { version, ...noVersion } = validBase();
    expect(() => deserializeDesign(noVersion)).toThrow();
    expect(() => deserializeDesign({ ...validBase(), version: 'one' })).toThrow();
  });

  it('throws for a version newer than this tool supports', () => {
    const base = validBase();
    expect(() => deserializeDesign({ ...base, version: base.version + 1 })).toThrow();
  });

  it('throws for missing or non-array blocks', () => {
    const { blocks, ...noBlocks } = validBase();
    expect(() => deserializeDesign(noBlocks)).toThrow();
    expect(() => deserializeDesign({ ...validBase(), blocks: 'nope' })).toThrow();
  });

  it('loads non-string notes as an empty string (no throw)', () => {
    const rt = deserializeDesign({ ...validBase(), notes: 123 });
    expect(rt.notes).toBe('');
  });
});

// ---------------------------------------------------------------------------
// slot helpers (stubbed localStorage)
// ---------------------------------------------------------------------------
describe('slot helpers', () => {
  let store;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips saveToSlot -> getSlot and removes with deleteSlot', () => {
    expect(saveToSlot('slot1', fixtureForm(), 'notes')).toBe(true);
    const got = getSlot('slot1');
    expect(got).not.toBeNull();
    expect(got.title).toBe(' My Form ');
    expect(got.notes).toBe('notes');
    expect(loadSlots()).toHaveProperty('slot1');

    expect(deleteSlot('slot1')).toBe(true);
    expect(getSlot('slot1')).toBeNull();
  });

  it('returns {} when the stored slots JSON is corrupt', () => {
    localStorage.setItem(SLOTS_KEY, '{ not valid json');
    expect(loadSlots()).toEqual({});
  });

  it('saveSlots returns false when setItem throws (quota)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {},
    });
    expect(saveSlots({ a: 1 })).toBe(false);
  });
});
