import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from '../indexeddb/database';
import { receiptRepository } from './receiptRepository';

const db = getDB();

beforeEach(async () => {
  await db.open();
  await db.receipts.clear();
});

describe('receiptRepository', () => {
  it('creates, finds, lists, and updates receipts', async () => {
    const first = await receiptRepository.create({
      receiptNumber: 'CAG-0001', paymentId: 'payment-1', studentId: 'student-1',
    });
    const second = await receiptRepository.create({
      receiptNumber: 'CAG-0002', paymentId: 'payment-2', studentId: 'student-1',
    });

    expect(await receiptRepository.getById(first.id)).toMatchObject({ receiptNumber: 'CAG-0001' });
    expect(await receiptRepository.getByPaymentId('payment-2')).toMatchObject({ id: second.id });
    expect(await receiptRepository.listByStudent('student-1')).toHaveLength(2);
    expect(await receiptRepository.listAll()).toHaveLength(2);
    await receiptRepository.updateDriveFileId(first.id, 'drive-file');
    expect((await receiptRepository.getById(first.id))?.pdfDriveFileId).toBe('drive-file');
    expect(await receiptRepository.count()).toBe(2);
  });
});
