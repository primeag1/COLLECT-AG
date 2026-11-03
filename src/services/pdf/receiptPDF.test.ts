import { describe, expect, it } from 'vitest';
import { getDefaultSettings } from '../../db/indexeddb/defaultSettings';
import type { ReceiptData } from './receiptPDF';
import { generateReceiptPDF } from './receiptPDF';

function makeReceiptData(studentName: string): ReceiptData {
  const timestamp = '2026-11-03T00:00:00.000Z';
  return {
    receipt: {
      id: 'receipt-1',
      receiptNumber: 'CAG-2026-11-0001',
      paymentId: 'payment-1',
      studentId: 'student-1',
      issuedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    payment: {
      id: 'payment-1',
      studentId: 'student-1',
      amount: 1500,
      currency: 'INR',
      paymentMode: 'cash',
      paymentDate: '2026-11-03',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    student: {
      id: 'student-1',
      values: { student_name: studentName },
      batchMemberships: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    settings: getDefaultSettings(),
    fields: [],
  };
}

describe('generateReceiptPDF', () => {
  it('embeds Noto Sans for an English member name', async () => {
    const pdf = (await generateReceiptPDF(makeReceiptData('Soumik Das'))
      .then(doc => doc.output())) as string;
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf).toContain('NotoSans');
    expect(pdf).not.toContain('Rs.');
  });

  it('renders Hindi member names with Noto Sans', async () => {
    const pdf = (await generateReceiptPDF(makeReceiptData('अमित कुमार'))
      .then(doc => doc.output())) as string;
    expect(pdf).toContain('NotoSans');
  });
});
