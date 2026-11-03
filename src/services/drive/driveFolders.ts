/**
 * Manages the COLLECT-AG folder structure in Google Drive.
 *
 * Structure:
 *   COLLECT-AG/
 *   ├── Data/
 *   │   ├── students.json
 *   │   ├── batches.json
 *   │   ├── payments.json
 *   │   ├── schemas.json
 *   │   └── settings.json
 *   ├── Receipts/
 *   │   └── 2026/
 *   │       └── FEE-2026-09-0001.pdf
 *   └── Exports/
 *
 * All folder IDs are stored locally in IndexedDB (driveMetaRepository)
 * so we never scan the whole Drive on every load.
 */

import { driveClient } from '../google/driveClient';
import { driveMetaRepository } from '../../db/repositories/syncRepository';
import { DRIVE_ROOT_FOLDER, DRIVE_DATA_FOLDER, DRIVE_RECEIPTS_FOLDER, DRIVE_EXPORTS_FOLDER } from '../../config';
import type { DriveMetadata } from '../../types';
import { escapeDriveQuery } from '../google/driveQuery';

const LEGACY_ROOT_NAME = 'FeeLedger';
const FOLDER_MIME   = 'application/vnd.google-apps.folder';

// ── Folder resolution ─────────────────────────────────────────────────────────

async function findFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<string | null> {
  let query = `name='${escapeDriveQuery(name)}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  const existing = await driveClient.listFiles(token, query, 'files(id,name)');
  return existing[0]?.id ?? null;
}

/**
 * Find an existing folder by name inside a parent, or create it.
 * Returns the folder ID.
 */
async function findOrCreateFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const existingId = await findFolder(token, name, parentId);
  if (existingId) return existingId;

  // Create new
  const created = await driveClient.createFolder(token, name, parentId);
  return created.id;
}

// ── Main initialiser ──────────────────────────────────────────────────────────

/**
 * Ensure the full COLLECT-AG folder structure exists in Drive.
 * Cached in IndexedDB — only makes Drive API calls when folder IDs are missing.
 * Safe to call on every app start.
 */
export async function ensureDriveFolders(token: string): Promise<DriveMetadata> {
  const meta = await driveMetaRepository.get();

  let changed = false;
  let rootId   = meta.applicationRootFolderId;
  let dataId   = meta.dataFolderId;
  let receiptsId = meta.receiptsFolderId;
  let exportsId  = meta.exportsFolderId;

  // Rename the existing app folder in place so existing Drive data is preserved.
  if (!rootId) {
    rootId = await findFolder(token, DRIVE_ROOT_FOLDER) ?? undefined;
    if (!rootId) {
      rootId = await findFolder(token, LEGACY_ROOT_NAME) ?? undefined;
      if (rootId) await driveClient.renameFolder(token, rootId, DRIVE_ROOT_FOLDER);
    }
    if (!rootId) {
      rootId = (await driveClient.createFolder(token, DRIVE_ROOT_FOLDER)).id;
    }
    changed = true;
  } else if (meta.applicationRootFolderName !== DRIVE_ROOT_FOLDER) {
    await driveClient.renameFolder(token, rootId, DRIVE_ROOT_FOLDER);
    changed = true;
  }

  // Data/
  if (!dataId) {
    dataId = await findOrCreateFolder(token, DRIVE_DATA_FOLDER, rootId);
    changed = true;
  }

  // Receipts/
  if (!receiptsId) {
    receiptsId = await findOrCreateFolder(token, DRIVE_RECEIPTS_FOLDER, rootId);
    changed = true;
  }

  // Exports/
  if (!exportsId) {
    exportsId = await findOrCreateFolder(token, DRIVE_EXPORTS_FOLDER, rootId);
    changed = true;
  }

  if (changed) {
    await driveMetaRepository.patch({
      applicationRootFolderId: rootId,
      applicationRootFolderName: DRIVE_ROOT_FOLDER,
      dataFolderId: dataId,
      receiptsFolderId: receiptsId,
      exportsFolderId: exportsId,
    });
  }

  return driveMetaRepository.get();
}

/**
 * Get or create a year sub-folder inside Receipts/.
 * e.g. COLLECT-AG/Receipts/2026/
 */
export async function getReceiptsYearFolder(
  token: string,
  year: number,
): Promise<string> {
  const meta = await driveMetaRepository.get();
  const receiptsId = meta.receiptsFolderId;
  if (!receiptsId) throw new Error('Receipts folder not initialised');

  return findOrCreateFolder(token, String(year), receiptsId);
}
