import { beforeEach, describe, expect, it, vi } from 'vitest';

const { driveClient, driveMetaRepository, DriveAPIError } = vi.hoisted(() => {
  class MockDriveAPIError extends Error {
    code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  }

  return {
    driveClient: {
      listFiles: vi.fn(),
      createFolder: vi.fn(),
      downloadJSON: vi.fn(),
      getFile: vi.fn(),
      uploadJSON: vi.fn(),
      uploadPDF: vi.fn(),
      trashFile: vi.fn(),
    },
    driveMetaRepository: {
      get: vi.fn(),
      patch: vi.fn(),
    },
    DriveAPIError: MockDriveAPIError,
  };
});

vi.mock('../google/driveClient', () => ({ driveClient, DriveAPIError }));
vi.mock('../../db/repositories/syncRepository', () => ({ driveMetaRepository }));

import {
  getDriveDataFileModifiedTime,
  readDriveDataFile,
  uploadReceiptPDF,
  writeDriveDataFile,
} from './driveData';

describe('drive data file safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    driveMetaRepository.get.mockResolvedValue({ dataFolderId: 'data-folder' });
    driveMetaRepository.patch.mockResolvedValue(undefined);
  });

  it('does not create a duplicate file when Drive search fails with 429', async () => {
    driveClient.listFiles.mockRejectedValue(new DriveAPIError('Rate limited', 429));

    await expect(writeDriveDataFile('token', 'students', { students: [] }))
      .rejects.toThrow('Rate limited');

    expect(driveClient.uploadJSON).not.toHaveBeenCalled();
  });

  it('rotates backups so only the newest ten for a data file remain', async () => {
    driveMetaRepository.get.mockResolvedValue({
      dataFolderId: 'data-folder',
      studentsFileId: 'students-file',
      backupsFolderId: 'backups-folder',
    });
    driveClient.downloadJSON.mockResolvedValue({
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: { students: [{ id: 'preserved' }] },
    });
    driveClient.uploadJSON.mockImplementation(async (_token: string, name: string) => ({
      id: name.startsWith('students-') ? 'new-backup' : 'students-file',
    }));
    driveClient.listFiles.mockImplementation(async () => [
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `backup-${index}`,
        name: `students-2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z.json`,
        modifiedTime: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      })),
      {
        id: 'new-backup',
        name: 'students-2026-11-03T06:31:32.000Z.json',
        modifiedTime: '2026-11-03T06:31:32.000Z',
      },
    ]);

    await writeDriveDataFile('token', 'students', { students: [] });

    expect(driveClient.trashFile).toHaveBeenCalledTimes(1);
    expect(driveClient.trashFile).toHaveBeenCalledWith('token', 'backup-0');
    expect(driveClient.uploadJSON).toHaveBeenCalledWith(
      'token',
      expect.stringMatching(/^students-.+\.json$/),
      expect.objectContaining({ data: { students: [{ id: 'preserved' }] } }),
      'backups-folder',
    );
  });

  it('returns null only after a successful search finds no named file', async () => {
    driveClient.listFiles.mockResolvedValue([]);

    await expect(readDriveDataFile('token', 'students')).resolves.toBeNull();
    expect(driveClient.downloadJSON).not.toHaveBeenCalled();
  });

  it('clears a stale file ID after a 404 and rethrows other download errors', async () => {
    driveMetaRepository.get.mockResolvedValue({
      dataFolderId: 'data-folder',
      studentsFileId: 'stale-file',
    });
    driveClient.downloadJSON.mockRejectedValueOnce(new DriveAPIError('Not found', 404));

    await expect(readDriveDataFile('token', 'students')).resolves.toBeNull();
    expect(driveMetaRepository.patch).toHaveBeenCalledWith({ studentsFileId: undefined });

    driveClient.downloadJSON.mockRejectedValueOnce(new DriveAPIError('Server failed', 500));
    await expect(readDriveDataFile('token', 'students')).rejects.toThrow('Server failed');
  });

  it('finds data files by name when metadata has no cached ID', async () => {
    driveMetaRepository.get.mockResolvedValue({ dataFolderId: 'data-folder' });
    driveClient.listFiles.mockResolvedValue([{ id: 'found-file' }]);
    driveClient.downloadJSON.mockResolvedValue({ data: { students: [{ id: 'remote' }] } });

    await expect(readDriveDataFile('token', 'students'))
      .resolves.toEqual({ students: [{ id: 'remote' }] });
    expect(driveMetaRepository.patch).toHaveBeenCalledWith({ studentsFileId: 'found-file' });
  });

  it('returns modified time for cached or searched files and uploads receipt PDFs', async () => {
    driveMetaRepository.get.mockResolvedValue({ studentsFileId: 'cached-file' });
    driveClient.getFile.mockResolvedValue({ id: 'cached-file', modifiedTime: '2026-01-01T00:00:00.000Z' });
    await expect(getDriveDataFileModifiedTime('token', 'students'))
      .resolves.toBe('2026-01-01T00:00:00.000Z');

    driveMetaRepository.get.mockResolvedValue({ dataFolderId: 'data-folder' });
    driveClient.listFiles.mockResolvedValue([{ id: 'searched-file' }]);
    driveClient.getFile.mockResolvedValue({ id: 'searched-file' });
    await expect(getDriveDataFileModifiedTime('token', 'students')).resolves.toBeUndefined();
    expect(driveMetaRepository.patch).toHaveBeenCalledWith({ studentsFileId: 'searched-file' });

    driveClient.uploadPDF.mockResolvedValue({ id: 'pdf-file' });
    await expect(uploadReceiptPDF('token', 'CAG-0001', new Blob(['pdf']), 'year-folder'))
      .resolves.toBe('pdf-file');
  });

  it('does not upload when the data folder has not been initialized', async () => {
    driveMetaRepository.get.mockResolvedValue({});

    await expect(writeDriveDataFile('token', 'students', { students: [] }))
      .rejects.toThrow('Drive Data folder not initialised.');
    expect(driveClient.uploadJSON).not.toHaveBeenCalled();
  });
});
