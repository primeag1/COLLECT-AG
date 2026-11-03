import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from '../indexeddb/database';
import { settingsRepository } from './settingsRepository';

describe('settingsRepository receipt numbering', () => {
  beforeEach(async () => {
    const db = getDB();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it('creates unique receipt numbers across parallel calls', async () => {
    const receipts = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        settingsRepository.createReceiptWithNextNumber({
          paymentId: `payment-${index}`,
          studentId: 'student-1',
        }),
      ),
    );
    const receiptNumbers = receipts.map(receipt => receipt.receiptNumber);

    expect(new Set(receiptNumbers).size).toBe(20);
    expect(await getDB().receipts.count()).toBe(20);
    expect((await settingsRepository.get()).receiptNumbering.nextNumber).toBe(21);
  });
});
