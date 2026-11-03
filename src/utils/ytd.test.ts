import { describe, expect, it } from 'vitest';
import {
  DEFAULT_YTD_ANCHOR,
  formatYtdLabel,
  normalizeYtdAnchor,
  resolveYtdStartDate,
} from './ytd';

describe('YTD date helpers', () => {
  it('uses the default anchor for missing and invalid values', () => {
    expect(normalizeYtdAnchor(undefined)).toBe(DEFAULT_YTD_ANCHOR);
    expect(normalizeYtdAnchor('4-01')).toBe(DEFAULT_YTD_ANCHOR);
    expect(normalizeYtdAnchor('13-01')).toBe(DEFAULT_YTD_ANCHOR);
    expect(normalizeYtdAnchor('02-32')).toBe(DEFAULT_YTD_ANCHOR);
  });

  it('keeps a valid anchor and resolves the most recent occurrence', () => {
    expect(normalizeYtdAnchor('04-01')).toBe('04-01');
    expect(resolveYtdStartDate('04-01', new Date(2026, 10, 4))).toBe('2026-04-01');
    expect(resolveYtdStartDate('04-01', new Date(2026, 1, 4))).toBe('2025-04-01');
    expect(resolveYtdStartDate(undefined, new Date(2026, 10, 4))).toBe('2026-01-01');
  });

  it('formats a human-readable label', () => {
    expect(formatYtdLabel('2026-04-01')).toContain('1 Apr 2026');
  });
});
