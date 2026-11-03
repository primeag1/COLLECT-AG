import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from '../indexeddb/database';
import { paymentRepository } from './paymentRepository';

const db = getDB();

beforeEach(async () => {
  await db.open();
  await db.payments.clear();
});

describe('paymentRepository', () => {
  it('supports optional fields, filters, and per-student lists', async () => {
    const first = await paymentRepository.create({
      studentId: 'student-a', batchId: 'batch-a', amount: 1200, currency: 'USD',
      paymentMode: 'cash', paymentDate: '2026-03-10', purpose: 'March',
      customValues: { note: 'manual' }, taxAmount: 100, baseAmount: 1100,
    });
    await paymentRepository.create({
      studentId: 'student-a', batchId: 'batch-b', amount: 500,
      paymentMode: 'upi', paymentDate: '2026-04-10',
    });
    const otherStudent = await paymentRepository.create({
      studentId: 'student-b', batchId: 'batch-a', amount: 300,
      paymentMode: 'cash', paymentDate: '2026-02-10',
    });

    expect(first.currency).toBe('USD');
    expect(first.customValues).toEqual({ note: 'manual' });
    expect(await paymentRepository.listByStudent('student-a')).toHaveLength(2);
    expect(await paymentRepository.listAll({
      studentId: 'student-a', batchId: 'batch-a', paymentMode: 'cash',
      dateFrom: '2026-03-01', dateTo: '2026-03-31',
    })).toMatchObject([{ id: first.id }]);
    expect(await paymentRepository.listAll({ studentId: 'student-b' })).toMatchObject([{ id: otherStudent.id }]);
    expect(await paymentRepository.listRecent(1)).toHaveLength(1);
  });

  it('aggregates only unarchived payment totals and dates', async () => {
    const old = await paymentRepository.create({
      studentId: 'student-a', amount: 100, paymentMode: 'cash', paymentDate: '2025-12-31',
    });
    await paymentRepository.create({
      studentId: 'student-a', amount: 200, paymentMode: 'cash', paymentDate: '2026-03-01',
    });
    await paymentRepository.create({
      studentId: 'student-b', amount: 300, paymentMode: 'upi', paymentDate: '2026-03-15',
    });
    await paymentRepository.archive(old.id);

    expect(await paymentRepository.totalCollection()).toBe(500);
    expect(await paymentRepository.monthlyCollection(2026, 3)).toBe(500);
    expect(await paymentRepository.collectionSince('2026-03-15')).toBe(300);
    expect(await paymentRepository.collectionByMode()).toEqual({ cash: 200, upi: 300 });
    expect(await paymentRepository.monthlyBreakdown()).toEqual([
      { month: '2026-03', amount: 500 },
    ]);
    expect(await paymentRepository.count()).toBe(2);
  });
});
