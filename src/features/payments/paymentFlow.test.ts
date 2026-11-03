import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from '../../db/indexeddb/database';
import { paymentRepository } from '../../db/repositories/paymentRepository';
import { settingsRepository } from '../../db/repositories/settingsRepository';
import { studentRepository } from '../../db/repositories/studentRepository';

describe('member payment flow persistence', () => {
  beforeEach(async () => {
    const db = getDB();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it('adds a member, records payment, and persists the linked receipt', async () => {
    const student = await studentRepository.create({
      values: { student_name: 'Member Example' },
    });
    const payment = await paymentRepository.create({
      studentId: student.id,
      amount: 1250,
      paymentMode: 'cash',
      paymentDate: '2026-11-03',
    });
    const receipt = await settingsRepository.createReceiptWithNextNumber({
      studentId: student.id,
      paymentId: payment.id,
    });
    await paymentRepository.linkReceipt(payment.id, receipt.id);

    await expect(studentRepository.getById(student.id)).resolves.toMatchObject({
      values: { student_name: 'Member Example' },
    });
    await expect(paymentRepository.getById(payment.id)).resolves.toMatchObject({
      amount: 1250,
      receiptId: receipt.id,
    });
    await expect(getDB().receipts.get(receipt.id)).resolves.toMatchObject({
      paymentId: payment.id,
      studentId: student.id,
      receiptNumber: expect.stringMatching(/^CAG-/),
    });
  });
});
