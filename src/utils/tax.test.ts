import { describe, expect, it } from 'vitest';
import { calculateTax } from './tax';
import type { TaxRate } from '../types';

const rates: TaxRate[] = [
  { id: 'cgst', name: 'CGST', rate: 9, enabled: true },
  { id: 'sgst', name: 'SGST', rate: 9, enabled: true },
];

describe('calculateTax', () => {
  it('adds multiple tax rates to a tax-exclusive amount', () => {
    const result = calculateTax(1000, rates, false);

    expect(result).toEqual({
      baseAmount: 1000,
      taxAmount: 180,
      totalAmount: 1180,
      taxLines: [
        { taxRateId: 'cgst', name: 'CGST', rate: 9, amount: 90 },
        { taxRateId: 'sgst', name: 'SGST', rate: 9, amount: 90 },
      ],
    });
  });

  it('extracts tax from an inclusive total without changing that total', () => {
    const result = calculateTax(1180, rates, true);

    expect(result.baseAmount).toBe(1000);
    expect(result.taxAmount).toBe(180);
    expect(result.totalAmount).toBe(1180);
    expect(result.baseAmount + result.taxAmount).toBe(result.totalAmount);
  });

  it('returns the entered amount unchanged when no rates are selected', () => {
    expect(calculateTax(99.95, [], false)).toEqual({
      baseAmount: 99.95,
      taxAmount: 0,
      totalAmount: 99.95,
      taxLines: [],
    });
  });
});
