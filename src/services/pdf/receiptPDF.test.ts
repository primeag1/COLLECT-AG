import { describe, expect, it } from 'vitest';
import { getDefaultSettings } from '../../db/indexeddb/defaultSettings';
import type { ReceiptData } from './receiptPDF';
import { generateReceiptPDF, getReceiptPDFBlob } from './receiptPDF';
import type { StudentFieldDefinition } from '../../types';

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

  it('renders optional business, member, batch, payment, and tax details', async () => {
    const data = makeReceiptData('Asha Rao');
    data.settings.business = {
      businessName: 'Asha Academy',
      phone: '1234567890',
      email: 'academy@example.test',
      gstin: 'GST-123',
      address: '12 Main Street',
    };
    data.settings.defaultCurrency = 'USD';
    data.student.values = {
      student_name: 'Asha Rao',
      gender: 'female',
      subjects: ['math', 'english'],
      admission_date: '2024-06-01',
      ignored_empty: '',
    };
    const field = (
      id: string,
      type: StudentFieldDefinition['type'],
      valueLabel = id,
    ): StudentFieldDefinition => ({
      id, label: valueLabel, type, category: 'custom', required: false, searchable: false,
      enabled: true, showInList: false, showOnReceipt: true, order: 0,
      options: type === 'select' ? [{ id: 'female', label: 'Female', value: 'female' }] : undefined,
      createdAt: '2026-01-01', updatedAt: '2026-01-01',
    });
    data.fields = [
      field('student_name', 'text'),
      field('gender', 'select', 'Gender'),
      field('subjects', 'multiselect', 'Subjects'),
      field('admission_date', 'date', 'Admission date'),
      field('unknown', 'text', 'Unknown value'),
      field('ignored_empty', 'text'),
      { ...field('not-enabled', 'text'), enabled: false },
      { ...field('not-visible', 'text'), showOnReceipt: false },
    ];
    data.student.values.unknown = 'fallback text';
    data.payment.purpose = 'Spring term';
    data.payment.notes = 'Paid in full';
    data.payment.taxLines = [
      { taxRateId: 'gst', name: 'GST', rate: 5, amount: 50 },
    ];
    data.payment.baseAmount = 1000;
    data.payment.amount = 1050;

    const pdf = await generateReceiptPDF({ ...data, batchName: 'Grade 10' });
    const blob = await getReceiptPDFBlob({ ...data, batchName: 'Grade 10' });

    expect(pdf.output()).toContain('NotoSans');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });
});
