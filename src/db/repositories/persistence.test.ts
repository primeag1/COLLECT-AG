import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from '../indexeddb/database';
import { paymentRepository } from './paymentRepository';
import { receiptRepository } from './receiptRepository';
import { studentRepository } from './studentRepository';

const db = getDB();

beforeEach(async () => {
  await db.open();
  await db.transaction('rw', [db.students, db.payments, db.receipts], async () => {
    await db.students.clear();
    await db.payments.clear();
    await db.receipts.clear();
  });
});

describe('local payment records', () => {
  it('persists members, payments, and linked receipts in IndexedDB', async () => {
    const student = await studentRepository.create({
      values: { student_name: 'Rina Das' },
    });
    const payment = await paymentRepository.create({
      studentId: student.id,
      amount: 1200,
      currency: 'INR',
      paymentMode: 'upi',
      paymentDate: '2026-11-01',
    });
    const receipt = await receiptRepository.create({
      receiptNumber: 'CAG-2026-11-0001',
      paymentId: payment.id,
      studentId: student.id,
    });
    await paymentRepository.linkReceipt(payment.id, receipt.id);

    await db.close();
    await db.open();

    expect((await studentRepository.getById(student.id))?.values.student_name).toBe('Rina Das');
    expect((await paymentRepository.getById(payment.id))?.receiptId).toBe(receipt.id);
    expect((await receiptRepository.getByPaymentId(payment.id))?.receiptNumber).toBe('CAG-2026-11-0001');
  });

  it('filters archived payments from collection totals and active payment lists', async () => {
    const student = await studentRepository.create({ values: { student_name: 'Rina Das' } });
    const activePayment = await paymentRepository.create({
      studentId: student.id,
      amount: 800,
      paymentMode: 'cash',
      paymentDate: '2026-11-01',
    });
    const archivedPayment = await paymentRepository.create({
      studentId: student.id,
      amount: 300,
      paymentMode: 'cash',
      paymentDate: '2026-11-02',
    });
    await paymentRepository.archive(archivedPayment.id);

    expect(await paymentRepository.totalCollection()).toBe(800);
    expect((await paymentRepository.listAll()).map(({ id }) => id)).toEqual([activePayment.id]);
  });
});
