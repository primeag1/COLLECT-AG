import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { driveClient } = vi.hoisted(() => ({
  driveClient: {
    listFiles: vi.fn(),
    createFolder: vi.fn(),
    renameFolder: vi.fn(),
    downloadJSON: vi.fn(),
    uploadJSON: vi.fn(),
    uploadPDF: vi.fn(),
    getFile: vi.fn(),
    trashFile: vi.fn(),
  },
}));

vi.mock('../google/driveClient', () => ({ driveClient }));

import { getDB } from '../../db/indexeddb/database';
import { driveMetaRepository } from '../../db/repositories/syncRepository';
import { pullAllFromDrive, pushAllToDrive } from './driveSync';

const folderMetadata = {
  applicationRootFolderId: 'root',
  applicationRootFolderName: 'COLLECT-AG',
  dataFolderId: 'data',
  receiptsFolderId: 'receipts',
  exportsFolderId: 'exports',
};

function makeStudent(id: string, updatedAt: string, archivedAt?: string) {
  return {
    id,
    values: {},
    batchMemberships: [],
    createdAt: updatedAt,
    updatedAt,
    archivedAt,
  };
}

describe('Drive sync safety', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getDB();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    driveClient.listFiles.mockResolvedValue([]);
    driveClient.downloadJSON.mockResolvedValue(null);
    driveClient.uploadJSON.mockImplementation(async (_token: string, name: string) => ({
      id: `file-${name}`,
    }));
    driveClient.getFile.mockResolvedValue({
      modifiedTime: '2099-01-01T00:00:00.000Z',
    });
  });

  it('refuses to push from a new, unreconciled device with an empty database', async () => {
    await driveMetaRepository.save(folderMetadata);

    await expect(pushAllToDrive('token'))
      .rejects.toThrow('restore from Google Drive first');

    expect(driveClient.uploadJSON).not.toHaveBeenCalled();
  });

  it('merges by id and keeps the newer record without removing local-only rows', async () => {
    const db = getDB();
    const localWins = makeStudent('local-wins', '2026-01-03T00:00:00.000Z');
    const remoteWins = makeStudent('remote-wins', '2026-01-01T00:00:00.000Z');
    const localOnly = makeStudent('local-only', '2026-01-02T00:00:00.000Z');
    await db.students.bulkPut([localWins, remoteWins, localOnly]);
    await driveMetaRepository.save({
      ...folderMetadata,
      studentsFileId: 'students-file',
    });
    driveClient.downloadJSON.mockImplementation(async (_token: string, fileId: string) => {
      if (fileId !== 'students-file') return null;
      return {
        schemaVersion: 1,
        exportedAt: '2026-01-04T00:00:00.000Z',
        data: {
          students: [
            makeStudent('local-wins', '2026-01-02T00:00:00.000Z'),
            makeStudent('remote-wins', '2026-01-04T00:00:00.000Z'),
            makeStudent('remote-only', '2026-01-04T00:00:00.000Z'),
          ],
        },
      };
    });

    await pullAllFromDrive('token');

    const students = await db.students.toArray();
    expect(students.find(student => student.id === 'local-wins')?.updatedAt)
      .toBe('2026-01-03T00:00:00.000Z');
    expect(students.find(student => student.id === 'remote-wins')?.updatedAt)
      .toBe('2026-01-04T00:00:00.000Z');
    expect(students.map(student => student.id)).toEqual(
      expect.arrayContaining(['local-only', 'remote-only']),
    );
  });

  it('includes archived students and payments in Drive uploads', async () => {
    const db = getDB();
    const archivedStudent = makeStudent(
      'archived-student',
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    );
    const archivedPayment = {
      id: 'archived-payment',
      studentId: archivedStudent.id,
      amount: 10,
      currency: 'INR',
      paymentMode: 'cash',
      paymentDate: '2026-01-01',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
      archivedAt: '2026-02-01T00:00:00.000Z',
    };
    await db.students.put(archivedStudent);
    await db.payments.put(archivedPayment);
    await driveMetaRepository.save({
      ...folderMetadata,
      lastRemoteSyncAt: '2099-01-01T00:00:00.000Z',
      remoteReconciledAt: '2026-01-01T00:00:00.000Z',
    });
    const uploads: Array<{ name: string; data: unknown }> = [];
    driveClient.uploadJSON.mockImplementation(async (
      _token: string,
      name: string,
      data: unknown,
    ) => {
      uploads.push({ name, data });
      return { id: `file-${name}` };
    });

    await pushAllToDrive('token');

    expect(uploads.find(upload => upload.name === 'students.json')?.data)
      .toMatchObject({ data: { students: [archivedStudent] } });
    expect(uploads.find(upload => upload.name === 'payments.json')?.data)
      .toMatchObject({ data: { payments: [archivedPayment] } });
  });
});
