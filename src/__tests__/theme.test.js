import { describe, expect, it } from 'vitest';
import { resolveTheme } from '../theme';

describe('resolveTheme', () => {
  it('uses explicit light and dark preferences', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('tracks the system preference in system mode', () => {
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
  });
});
