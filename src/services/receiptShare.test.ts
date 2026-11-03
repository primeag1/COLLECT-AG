// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDefaultSettings } from '../db/indexeddb/defaultSettings';
import type { ReceiptData } from './pdf/receiptPDF';

vi.mock('./pdf/receiptPDF', () => ({
  getReceiptPDFBlob: vi.fn(async () => new Blob(['receipt'])),
}));

import { shareReceiptOnWhatsApp } from './receiptShare';

function receiptData(phone?: string): ReceiptData {
  const timestamp = '2026-03-01T00:00:00.000Z';
  return {
    receipt: {
      id: 'receipt-1', receiptNumber: 'CAG-0001', paymentId: 'payment-1',
      studentId: 'student-1', issuedAt: timestamp, createdAt: timestamp, updatedAt: timestamp,
    },
    payment: {
      id: 'payment-1', studentId: 'student-1', amount: 1250, currency: 'INR',
      paymentMode: 'cash', paymentDate: '2026-03-01', purpose: 'March',
      createdAt: timestamp, updatedAt: timestamp,
    },
    student: {
      id: 'student-1',
      values: { student_name: 'Asha Rao', whatsapp_number: phone },
      batchMemberships: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    settings: { ...getDefaultSettings(), business: { businessName: 'Test Academy' } },
    fields: [],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('shareReceiptOnWhatsApp', () => {
  it('downloads the PDF and opens the phone chat with an encoded receipt message', async () => {
    const open = vi.fn();
    const alert = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:receipt'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('alert', alert);
    vi.spyOn(window, 'open').mockImplementation(open);

    await shareReceiptOnWhatsApp(receiptData('+1 (555) 123-4567'));

    expect(click).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/wa\.me\/9115551234567\?text=/),
      '_blank',
      'noopener,noreferrer',
    );
    expect(decodeURIComponent(String(open.mock.calls[0]?.[0]))).toContain('Asha Rao');
    expect(alert).toHaveBeenCalledWith(
      'Your browser can\'t attach files to WhatsApp directly, so the receipt PDF has been downloaded — please attach it to the chat that just opened.',
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:receipt');
  });

  it('informs the user if no phone number is available for chat', async () => {
    const alert = vi.fn();
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:receipt'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('alert', alert);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await shareReceiptOnWhatsApp(receiptData());

    expect(alert).toHaveBeenCalledWith(
      'The receipt PDF has been downloaded. This member has no WhatsApp/phone number on file to open a chat automatically.',
    );
  });

  it('continues to the text chat when the native file share is cancelled', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    const canShare = vi.fn(() => true);
    const open = vi.fn();
    vi.stubGlobal('navigator', { share, canShare });
    vi.spyOn(window, 'open').mockImplementation(open);

    await shareReceiptOnWhatsApp(receiptData('9876543210'));

    expect(share).toHaveBeenCalledOnce();
    expect(canShare).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
  });
});
