/**
 * Drive sync service.
 *
 * pull() — Downloads all Drive data files → populates IndexedDB
 * push() — Reads all IndexedDB data → writes to Drive data files
 * pushReceiptPDF() — Generates and uploads a single receipt PDF
 *
 * This is a simple full-file sync (not delta/patch).
 * Suitable for a single-user tuition management app with moderate data volume.
 */

import { ensureDriveFolders, getReceiptsYearFolder } from './driveFolders';
import {
  writeDriveDataFile, readDriveDataFile, uploadReceiptPDF,
  getDriveDataFileModifiedTime, DATA_FILES,
} from './driveData';
import { driveMetaRepository } from '../../db/repositories/syncRepository';
import { getDB } from '../../db/indexeddb/database';
import { settingsRepository } from '../../db/repositories/settingsRepository';
import { receiptRepository } from '../../db/repositories/receiptRepository';
import type { ReceiptData } from '../pdf/receiptPDF';
import type {
  Student, Batch, Subject, AcademicYear,
  Payment, Receipt, StudentFieldDefinition,
  PaymentFieldDefinition, AppSettings,
} from '../../types';

// ── Serialised data shapes ────────────────────────────────────────────────────

interface StudentsFile   { students: Student[] }
interface BatchesFile    { batches: Batch[]; subjects: Subject[]; academicYears: AcademicYear[] }
interface PaymentsFile   { payments: Payment[] }
interface ReceiptsFile   { receipts: Receipt[] }
interface SchemasFile    { studentFields: StudentFieldDefinition[]; paymentFields: PaymentFieldDefinition[] }

async function mergeRecords<T extends { id: string; updatedAt: string }>(
  table: {
    get: (id: string) => Promise<T | undefined>;
    put: (record: T) => Promise<unknown>;
  },
  remoteRecords: T[],
): Promise<void> {
  for (const remoteRecord of remoteRecords) {
    const localRecord = await table.get(remoteRecord.id);
    if (!localRecord || remoteRecord.updatedAt > localRecord.updatedAt) {
      await table.put(remoteRecord);
    }
  }
}

// ── Push (local → Drive) ──────────────────────────────────────────────────────

/**
 * Write all local data to Drive.
 * Called after any significant change (or on a timer).
 */
export async function pushAllToDrive(token: string): Promise<void> {
  const initialMeta = await driveMetaRepository.get();
  if (!initialMeta.remoteReconciledAt) {
    throw new Error('Sync paused: restore from Google Drive first so this device cannot overwrite existing data.');
  }

  // Ensure folder structure exists
  await ensureDriveFolders(token);

  const meta = await driveMetaRepository.get();
  const remoteModifiedTimes = await Promise.all(
    (Object.keys(DATA_FILES) as Array<keyof typeof DATA_FILES>).map(key =>
      getDriveDataFileModifiedTime(token, key)
    ),
  );
  const parsedLastRemoteSyncTime = meta.lastRemoteSyncAt
    ? Date.parse(meta.lastRemoteSyncAt)
    : Number.NEGATIVE_INFINITY;
  const lastRemoteSyncTime = Number.isNaN(parsedLastRemoteSyncTime)
    ? Number.NEGATIVE_INFINITY
    : parsedLastRemoteSyncTime;
  if (remoteModifiedTimes.some(time => time && Date.parse(time) > lastRemoteSyncTime)) {
    await pullAllFromDrive(token);
  }

  const db = getDB();

  // Read all local data in parallel
  const [
    students,
    batches, subjects, academicYears,
    payments,
    receipts,
    studentFields, paymentFields,
    settings,
  ] = await Promise.all([
    db.students.toArray(),
    db.batches.toArray(),
    db.subjects.toArray(),
    db.academicYears.toArray(),
    db.payments.toArray(),
    db.receipts.toArray(),
    db.studentFields.toArray().then(rows => rows.map(({ _store: _sf, ...f }) => { void _sf; return f as StudentFieldDefinition; })),
    db.paymentFields.toArray().then(rows => rows.map(({ _store: _pf, ...f }) => { void _pf; return f as PaymentFieldDefinition; })),
    settingsRepository.get(),
  ]);

  // Write all files in parallel
  await Promise.all([
    writeDriveDataFile<StudentsFile>(token, 'students', { students }),
    writeDriveDataFile<BatchesFile>(token, 'batches', { batches, subjects, academicYears }),
    writeDriveDataFile<PaymentsFile>(token, 'payments', { payments }),
    writeDriveDataFile<ReceiptsFile>(token, 'receipts', { receipts }),
    writeDriveDataFile<SchemasFile>(token, 'schemas', { studentFields, paymentFields }),
    writeDriveDataFile<AppSettings>(token, 'settings', settings),
  ]);

  // Record sync time
  const writtenModifiedTimes = await Promise.all(
    (Object.keys(DATA_FILES) as Array<keyof typeof DATA_FILES>).map(key =>
      getDriveDataFileModifiedTime(token, key)
    ),
  );
  const latestRemoteTime = writtenModifiedTimes.reduce((latest, time) => {
    const timestamp = time ? Date.parse(time) : 0;
    return Number.isNaN(timestamp) ? latest : Math.max(latest, timestamp);
  }, Date.now());
  const syncTime = new Date(latestRemoteTime).toISOString();
  await driveMetaRepository.patch({ lastRemoteSyncAt: syncTime, lastRemotePushAt: syncTime });
}

// ── Pull (Drive → local) ──────────────────────────────────────────────────────

/**
 * Pull all data from Drive into IndexedDB.
 * Called on first login to restore data from Drive,
 * or to sync from another device.
 */
export async function pullAllFromDrive(token: string): Promise<{ restored: boolean }> {
  await ensureDriveFolders(token);
  const db = getDB();

  const [studentsFile, batchesFile, paymentsFile, receiptsFile, schemasFile, settingsFile] =
    await Promise.all([
      readDriveDataFile<StudentsFile>(token, 'students'),
      readDriveDataFile<BatchesFile>(token, 'batches'),
      readDriveDataFile<PaymentsFile>(token, 'payments'),
      readDriveDataFile<ReceiptsFile>(token, 'receipts'),
      readDriveDataFile<SchemasFile>(token, 'schemas'),
      readDriveDataFile<AppSettings>(token, 'settings'),
    ]);

  // Merge record stores by id and updatedAt. Rows missing from Drive are
  // deliberately retained so partial/older remote snapshots cannot delete data.
  await db.transaction('rw',
    [db.students, db.batches, db.subjects, db.academicYears,
    db.payments, db.receipts, db.studentFields, db.paymentFields, db.settings],
    async () => {
      if (studentsFile?.students) await mergeRecords(db.students, studentsFile.students);
      if (batchesFile?.batches) await mergeRecords(db.batches, batchesFile.batches);
      if (batchesFile?.subjects) await mergeRecords(db.subjects, batchesFile.subjects);
      if (batchesFile?.academicYears) await mergeRecords(db.academicYears, batchesFile.academicYears);
      if (paymentsFile?.payments) await mergeRecords(db.payments, paymentsFile.payments);
      if (receiptsFile?.receipts) await mergeRecords(db.receipts, receiptsFile.receipts);
      if (schemasFile?.studentFields) {
        await mergeRecords(
          db.studentFields,
          schemasFile.studentFields.map(f => ({ ...f, _store: 'studentFields' as const })),
        );
      }
      if (schemasFile?.paymentFields) {
        await mergeRecords(
          db.paymentFields,
          schemasFile.paymentFields.map(f => ({ ...f, _store: 'paymentFields' as const })),
        );
      }

      const localSettings = await settingsRepository.get();
      const mergedSettings = settingsFile
        ? {
            ...settingsFile,
            onboardingComplete: localSettings.onboardingComplete || settingsFile.onboardingComplete,
          }
        : localSettings;
      const receipts = await db.receipts.toArray();
      const highestSerial = receipts.reduce((highest, receipt) => {
        const serialPart = receipt.receiptNumber.match(/(?:^|-)(\d+)$/)?.[1];
        const serial = serialPart === undefined ? 0 : Number(serialPart);
        return Number.isSafeInteger(serial) ? Math.max(highest, serial) : highest;
      }, 0);
      await settingsRepository.save({
        ...mergedSettings,
        receiptNumbering: {
          ...mergedSettings.receiptNumbering,
          nextNumber: Math.max(
            localSettings.receiptNumbering.nextNumber,
            settingsFile?.receiptNumbering.nextNumber ?? 0,
            highestSerial + 1,
          ),
        },
      });
    },
  );

  const reconciledAt = new Date().toISOString();
  await driveMetaRepository.patch({
    lastRemoteSyncAt: reconciledAt,
    remoteReconciledAt: reconciledAt,
  });
  return {
    restored: Boolean(
      studentsFile || batchesFile || paymentsFile || receiptsFile || schemasFile || settingsFile,
    ),
  };
}

// ── Receipt PDF upload ────────────────────────────────────────────────────────

/**
 * Generate and upload a single receipt PDF to Drive.
 * Called immediately after a payment is recorded.
 */
export async function pushReceiptPDFToDrive(
  token: string,
  receiptData: ReceiptData,
): Promise<string | null> {
  try {
    await ensureDriveFolders(token);

    const year = new Date(receiptData.payment.paymentDate).getFullYear();
    const yearFolderId = await getReceiptsYearFolder(token, year);

    const { getReceiptPDFBlob } = await import('../pdf/receiptPDF');
    const pdfBlob = await getReceiptPDFBlob(receiptData);
    const fileId  = await uploadReceiptPDF(
      token,
      receiptData.receipt.receiptNumber,
      pdfBlob,
      yearFolderId,
    );

    // Store the Drive file ID on the receipt record
    await receiptRepository.updateDriveFileId(receiptData.receipt.id, fileId);
    return fileId;

  } catch (err) {
    console.error('[COLLECT-AG] Receipt PDF upload failed:', err);
    return null;
  }
}
