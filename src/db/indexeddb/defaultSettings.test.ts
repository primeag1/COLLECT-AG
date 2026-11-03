import { describe, expect, it } from 'vitest';
import { getDefaultSettings } from './defaultSettings';

describe('getDefaultSettings', () => {
  it('creates a valid initial settings object with the supported payment modes', () => {
    const settings = getDefaultSettings();

    expect(settings.schemaVersion).toBe(1);
    expect(settings.onboardingComplete).toBe(false);
    expect(settings.receiptNumbering).toMatchObject({
      prefix: 'CAG',
      startingNumber: 1,
      nextNumber: 1,
      padding: 4,
    });
    expect(settings.paymentModes.map(({ id }) => id)).toEqual([
      'cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other',
    ]);
  });
});
