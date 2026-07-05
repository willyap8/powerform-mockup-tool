import { describe, it, expect } from 'vitest';
import {
  scoreOf, evaluateEnabled, describeRule, OPERATORS, isScoreableField,
} from '../constants';

// ---------------------------------------------------------------------------
// scoreOf
// ---------------------------------------------------------------------------
describe('scoreOf', () => {
  it('number: parses numeric strings, garbage → 0', () => {
    const b = { type: 'field', fieldType: 'number' };
    expect(scoreOf(b, '7')).toBe(7);
    expect(scoreOf(b, 'abc')).toBe(0);
    expect(scoreOf(b, undefined)).toBe(0);
  });

  it('radio: live value wins, falls back to selectedIndex, else 0', () => {
    const b = {
      type: 'field', fieldType: 'radio',
      options: ['a', 'b', 'c'], optionWeights: [10, 20, 30], selectedIndex: 2,
    };
    expect(scoreOf(b, [1])).toBe(20);         // live value [idx] wins over selectedIndex
    expect(scoreOf(b, undefined)).toBe(30);   // falls back to selectedIndex 2
    const noSel = { ...b, selectedIndex: null };
    expect(scoreOf(noSel, undefined)).toBe(0); // no selection at all
    expect(scoreOf(b, [5])).toBe(0);           // index with missing weight → 0
  });

  it('checkbox: sums weights of checked options only', () => {
    const b = {
      type: 'field', fieldType: 'checkbox',
      options: ['a', 'b', 'c'], optionWeights: [1, 2, 4],
    };
    expect(scoreOf(b, [true, false, true])).toBe(5);
    expect(scoreOf(b, [])).toBe(0);
    expect(scoreOf(b, undefined)).toBe(0);
  });

  it('dropdown: matches option text weight, unknown → 0, empty → selectedIndex', () => {
    const b = {
      type: 'field', fieldType: 'dropdown',
      options: ['Low', 'Med', 'High'], optionWeights: [0, 5, 10], selectedIndex: 1,
    };
    expect(scoreOf(b, 'High')).toBe(10);   // live value is the option text
    expect(scoreOf(b, 'Zzz')).toBe(0);     // unknown text
    expect(scoreOf(b, '')).toBe(5);        // empty → falls back to selectedIndex 1
  });

  it('returns 0 for a missing source block', () => {
    expect(scoreOf(null, '5')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateEnabled
// ---------------------------------------------------------------------------
describe('evaluateEnabled', () => {
  it('is enabled when there is no rule / no gate', () => {
    expect(evaluateEnabled({ type: 'field' }, {}, {})).toBe(true);
    // dangling sourceId (source deleted) → no gate
    const target = { enableWhen: { sourceId: 'gone', op: 'ge', value: 1 } };
    expect(evaluateEnabled(target, {}, {})).toBe(true);
    // unknown operator → no gate
    const src = { id: 'n', type: 'field', fieldType: 'number' };
    const t2 = { enableWhen: { sourceId: 'n', op: 'xx', value: 1 } };
    expect(evaluateEnabled(t2, { n: src }, { n: '5' })).toBe(true);
  });

  it('applies all six operators against a numeric source', () => {
    const src = { id: 'n', type: 'field', fieldType: 'number' };
    const blocksById = { n: src };
    // threshold fixed at 5; vary the source's live value above/at/below.
    const check = (op, sourceVal) =>
      evaluateEnabled({ enableWhen: { sourceId: 'n', op, value: 5 } }, blocksById, { n: sourceVal });

    expect(check('eq', '5')).toBe(true);
    expect(check('eq', '4')).toBe(false);
    expect(check('eq', '6')).toBe(false);

    expect(check('ne', '5')).toBe(false);
    expect(check('ne', '4')).toBe(true);

    expect(check('lt', '4')).toBe(true);
    expect(check('lt', '5')).toBe(false);

    expect(check('gt', '6')).toBe(true);
    expect(check('gt', '5')).toBe(false);

    expect(check('le', '5')).toBe(true);
    expect(check('le', '6')).toBe(false);

    expect(check('ge', '5')).toBe(true);
    expect(check('ge', '4')).toBe(false);
  });

  it('coerces a non-numeric rule value to 0', () => {
    const src = { id: 'n', type: 'field', fieldType: 'number' };
    // score 0 (no value) with `ge` against non-numeric threshold → 0 >= 0 → enabled
    const target = { enableWhen: { sourceId: 'n', op: 'ge', value: 'abc' } };
    expect(evaluateEnabled(target, { n: src }, {})).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// describeRule
// ---------------------------------------------------------------------------
describe('describeRule', () => {
  it('uses the source label (trimmed) and operator symbol', () => {
    const src = { id: 'p', type: 'field', fieldType: 'number', label: '  Pain score  ' };
    const target = { enableWhen: { sourceId: 'p', op: 'ge', value: 3 } };
    expect(describeRule(target, { p: src })).toBe('Editable when ‘Pain score’ ≥ 3');
  });

  it('falls back to describeBlock when the label is empty', () => {
    const src = { id: 'p', type: 'field', fieldType: 'number', label: '' };
    const target = { enableWhen: { sourceId: 'p', op: 'ge', value: 3 } };
    // describeBlock renders a number field with empty label as: number field ''
    expect(describeRule(target, { p: src })).toBe("Editable when ‘number field ''’ ≥ 3");
  });

  it('reports a deleted source and returns "" with no rule', () => {
    const target = { enableWhen: { sourceId: 'missing', op: 'ge', value: 3 } };
    expect(describeRule(target, {})).toBe('Editable when ‘(deleted field)’ ≥ 3');
    expect(describeRule({ type: 'field' }, {})).toBe('');
  });
});

// ---------------------------------------------------------------------------
// isScoreableField
// ---------------------------------------------------------------------------
describe('isScoreableField', () => {
  it('is true only for number/radio/checkbox/dropdown field blocks', () => {
    for (const fieldType of ['number', 'radio', 'checkbox', 'dropdown']) {
      expect(isScoreableField({ type: 'field', fieldType })).toBe(true);
    }
    expect(isScoreableField({ type: 'field', fieldType: 'text' })).toBe(false);
    expect(isScoreableField({ type: 'field', fieldType: 'date' })).toBe(false);
    expect(isScoreableField({ type: 'heading1' })).toBe(false);
    expect(isScoreableField(null)).toBeFalsy(); // short-circuits to null, not literal false
  });
});

// ---------------------------------------------------------------------------
// OPERATORS map sanity
// ---------------------------------------------------------------------------
describe('OPERATORS', () => {
  it('exposes the six Millennium operators with working tests', () => {
    expect(Object.keys(OPERATORS).sort()).toEqual(['eq', 'ge', 'gt', 'le', 'lt', 'ne']);
    expect(OPERATORS.eq.test(3, 3)).toBe(true);
    expect(OPERATORS.ne.test(3, 4)).toBe(true);
    expect(OPERATORS.lt.test(2, 3)).toBe(true);
    expect(OPERATORS.gt.test(4, 3)).toBe(true);
    expect(OPERATORS.le.test(3, 3)).toBe(true);
    expect(OPERATORS.ge.test(3, 3)).toBe(true);
  });
});
