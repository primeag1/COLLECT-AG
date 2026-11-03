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
      uploadJSON: vi.fn(),
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

import { writeDriveDataFile } from './driveData';

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
});
