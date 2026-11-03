import { describe, expect, it } from 'vitest';
import type { Payment, Student } from '../types';
import { calculateFeeDue, getFrequencyLabel } from './fees';

const student: Student = {
  id: 'student_1',
  values: {
    fee_amount: 500,
    fee_type: true,
    fee_frequency: 'monthly',
    admission_date: '2026-01-15',
  },
  batchMemberships: [],
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
};

function payment(amount: number): Payment {
  return {
    id: `payment_${amount}`,
    studentId: student.id,
    amount,
    currency: 'INR',
    paymentMode: 'cash',
    paymentDate: '2026-01-20',
    createdAt: '2026-01-20T00:00:00.000Z',
    updatedAt: '2026-01-20T00:00:00.000Z',
  };
}

describe('calculateFeeDue', () => {
  it('labels known frequencies and preserves custom frequency text', () => {
    expect(getFrequencyLabel('')).toBe('');
    expect(getFrequencyLabel('monthly')).toBe('monthly');
    expect(getFrequencyLabel('custom')).toBe('as per agreed schedule');
    expect(getFrequencyLabel('unexpected')).toBe('unexpected');
  });

  it('accrues a new monthly cycle on the admission date', () => {
    const beforeCycle = calculateFeeDue(student, [], new Date(2026, 1, 14));
    const onCycle = calculateFeeDue(student, [], new Date(2026, 1, 15));

    expect(beforeCycle.cyclesAccrued).toBe(1);
    expect(beforeCycle.totalDue).toBe(500);
    expect(onCycle.cyclesAccrued).toBe(2);
    expect(onCycle.totalDue).toBe(1000);
  });

  it('subtracts recorded payments and never reports a negative balance', () => {
    expect(calculateFeeDue(student, [payment(500)], new Date(2026, 2, 15)).totalDue).toBe(1000);
    expect(calculateFeeDue(student, [payment(2000)], new Date(2026, 2, 15)).totalDue).toBe(0);
  });

  it('treats a non-recurring fee as one total amount', () => {
    const flatFee = { ...student, values: { ...student.values, fee_type: false } };
    const result = calculateFeeDue(flatFee, [payment(200)], new Date(2026, 11, 1));

    expect(result.cyclesAccrued).toBe(1);
    expect(result.totalDue).toBe(300);
  });

  it('handles zero, invalid, instalment, and unsupported recurring values', () => {
    const noFee = { ...student, values: { fee_amount: 0, fee_type: true } };
    expect(calculateFeeDue(noFee, [payment(25)]).totalDue).toBe(0);

    const noAnchor = {
      ...student,
      createdAt: 'invalid',
      values: { fee_amount: 500, fee_type: true, fee_frequency: 'quarterly', admission_date: 'invalid' },
    };
    expect(calculateFeeDue(noAnchor, [], new Date(2026, 9, 1)).cyclesAccrued).toBe(1);

    for (const [frequency, cycles] of [['instalment2', 2], ['instalment3', 3], ['custom', 1]] as const) {
      expect(calculateFeeDue({
        ...student,
        values: { fee_amount: 500, fee_type: true, fee_frequency: frequency },
      }, [], new Date(2026, 9, 1)).cyclesAccrued).toBe(cycles);
    }

    expect(calculateFeeDue({
      ...student,
      values: { fee_amount: 500, fee_type: false, fee_frequency: 'yearly' },
    }, []).frequency).toBe('yearly');
  });
});
