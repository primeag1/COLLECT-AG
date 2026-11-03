import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteAndRecreateDB, getDB } from './database';

describe('IndexedDB reset', () => {
  afterEach(async () => {
    await getDB().delete();
  });

  it('deletes the existing database and opens a fresh empty database with the same name', async () => {
    const database = getDB();
    await database.open();
    await database.driveMeta.put({ id: 'singleton', applicationRootFolderId: 'old-root' });

    await deleteAndRecreateDB();

    const recreated = getDB();
    expect(recreated.name).toBe('FeeLedgerDB');
    expect(await recreated.driveMeta.count()).toBe(0);
  });
});
