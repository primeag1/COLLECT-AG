import { getDB, generateId, now, type StoredSettings } from '../indexeddb/database';
import { getDefaultSettings } from '../indexeddb/defaultSettings';
import type { AppSettings, Receipt } from '../../types';

const SINGLETON_ID = 'singleton' as const;

export interface ReceiptCreationInput {
  paymentId: string;
  studentId: string;
  templateId?: string;
  pdfDriveFileId?: string;
}

export const settingsRepository = {

  async get(): Promise<AppSettings> {
    const db = getDB();
    const row = await db.settings.get(SINGLETON_ID);
    if (!row) return getDefaultSettings();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...settings } = row;
    return settings as AppSettings;
  },

  async save(settings: AppSettings): Promise<void> {
    const db = getDB();
    const row: StoredSettings = { id: SINGLETON_ID, ...settings };
    await db.settings.put(row);
  },

  async patch(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.get();
    const updated: AppSettings = {
      ...current,
      ...partial,
      business: { ...current.business, ...partial.business },
      receiptNumbering: { ...current.receiptNumbering, ...partial.receiptNumbering },
      paymentModes: partial.paymentModes ?? current.paymentModes,
    };
    await this.save(updated);
    return updated;
  },

  async isOnboardingComplete(): Promise<boolean> {
    const s = await this.get();
    return s.onboardingComplete;
  },

  async completeOnboarding(): Promise<void> {
    await this.patch({ onboardingComplete: true });
  },

  /** Allocate the next available number and insert its receipt atomically. */
  async createReceiptWithNextNumber(input: ReceiptCreationInput): Promise<Receipt> {
    const db = getDB();
    return db.transaction('rw', [db.settings, db.receipts], async () => {
      const settings = await this.get();
      const { prefix, includeYear, includeMonth, padding } = settings.receiptNumbering;
      const date = new Date();
      const parts = [prefix];
      if (includeYear) parts.push(date.getFullYear().toString());
      if (includeMonth) parts.push(String(date.getMonth() + 1).padStart(2, '0'));

      let serial = settings.receiptNumbering.nextNumber;
      let existingReceipt: Receipt | undefined;
      let receiptNumber = '';
      do {
        receiptNumber = [...parts, String(serial).padStart(padding, '0')].join('-');
        existingReceipt = await db.receipts.where('receiptNumber').equals(receiptNumber).first();
        if (existingReceipt) serial += 1;
      } while (existingReceipt);

      const timestamp = now();
      const receipt: Receipt = {
        id: generateId('rec'),
        receiptNumber,
        paymentId: input.paymentId,
        studentId: input.studentId,
        templateId: input.templateId,
        pdfDriveFileId: input.pdfDriveFileId,
        issuedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await this.save({
        ...settings,
        receiptNumbering: { ...settings.receiptNumbering, nextNumber: serial + 1 },
      });
      await db.receipts.add(receipt);
      return receipt;
    });
  },
};
