import { describe, it, expect } from 'vitest';
import { cloneForm } from '../constants';

// A form with one option-bearing block carrying every mutable prop, plus a
// plain block that carries none of them.
function fixture() {
  return {
    title: 'Assessment',
    blocks: [
      {
        id: 'r1', type: 'field', fieldType: 'radio', label: 'Severity',
        x: 10, y: 20, width: 220, height: 22,
        options: ['Low', 'High'], optionWeights: [0, 5], selectedIndex: 1,
        enableWhen: { sourceId: 'n1', op: 'ge', value: 3 },
      },
      { id: 't1', type: 'field', fieldType: 'text', label: 'Plain', x: 30, y: 40, width: 200, height: 22 },
    ],
  };
}

describe('cloneForm', () => {
  it('produces a structurally equal copy', () => {
    const form = fixture();
    expect(cloneForm(form)).toEqual(form);
  });

  it('shares no references for options / optionWeights / enableWhen', () => {
    const form = fixture();
    const clone = cloneForm(form);

    // Mutating the clone must not touch the original.
    clone.blocks[0].options.push('Extra');
    clone.blocks[0].optionWeights[0] = 99;
    clone.blocks[0].enableWhen.value = 100;

    expect(form.blocks[0].options).toEqual(['Low', 'High']);
    expect(form.blocks[0].optionWeights).toEqual([0, 5]);
    expect(form.blocks[0].enableWhen.value).toBe(3);

    // ...and mutating the original must not touch the clone.
    const form2 = fixture();
    const clone2 = cloneForm(form2);
    form2.blocks[0].options.push('Another');
    form2.blocks[0].enableWhen.op = 'lt';
    expect(clone2.blocks[0].options).toEqual(['Low', 'High']);
    expect(clone2.blocks[0].enableWhen.op).toBe('ge');
  });

  it('leaves blocks without the optional props absent-ish', () => {
    const clone = cloneForm(fixture());
    const plain = clone.blocks[1];
    expect(plain.options).toBeUndefined();
    expect(plain.optionWeights).toBeUndefined();
    expect(plain.enableWhen).toBeUndefined();
    // The non-optional props are preserved.
    expect(plain.label).toBe('Plain');
    expect(plain.x).toBe(30);
  });
});
