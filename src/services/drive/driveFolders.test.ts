import { beforeEach, describe, expect, it, vi } from 'vitest';

const { driveClient, driveMetaRepository } = vi.hoisted(() => ({
  driveClient: {
    listFiles: vi.fn(),
    createFolder: vi.fn(),
    renameFolder: vi.fn(),
  },
  driveMetaRepository: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../google/driveClient', () => ({ driveClient }));
vi.mock('../../db/repositories/syncRepository', () => ({ driveMetaRepository }));

import { ensureDriveFolders } from './driveFolders';

describe('ensureDriveFolders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    driveMetaRepository.get.mockResolvedValue({});
    driveClient.listFiles.mockResolvedValue([]);
    driveClient.createFolder.mockImplementation(async (_token: string, name: string) => ({
      id: `new-${name}`,
    }));
    driveClient.renameFolder.mockResolvedValue({});
  });

  it('renames an existing legacy Drive folder and keeps its folder ID', async () => {
    driveClient.listFiles.mockImplementation(async (_token: string, query: string) => (
      query.includes("name='FeeLedger'") ? [{ id: 'existing-root' }] : []
    ));

    await ensureDriveFolders('token');

    expect(driveClient.renameFolder).toHaveBeenCalledWith(
      'token',
      'existing-root',
      'COLLECT-AG',
    );
    expect(driveClient.createFolder).not.toHaveBeenCalledWith(
      'token',
      'COLLECT-AG',
      undefined,
    );
    expect(driveMetaRepository.patch).toHaveBeenCalledWith(expect.objectContaining({
      applicationRootFolderId: 'existing-root',
      applicationRootFolderName: 'COLLECT-AG',
    }));
  });

  it('renames a previously cached root folder once', async () => {
    driveMetaRepository.get.mockResolvedValue({
      applicationRootFolderId: 'cached-root',
      dataFolderId: 'data',
      receiptsFolderId: 'receipts',
      exportsFolderId: 'exports',
    });

    await ensureDriveFolders('token');

    expect(driveClient.renameFolder).toHaveBeenCalledWith('token', 'cached-root', 'COLLECT-AG');
    expect(driveMetaRepository.patch).toHaveBeenCalledWith(expect.objectContaining({
      applicationRootFolderName: 'COLLECT-AG',
    }));
  });
});
