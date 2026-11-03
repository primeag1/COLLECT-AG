// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from './database';
import { initialiseDatabase } from './initialise';

const db = getDB();

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
  localStorage.clear();
});

describe('initialiseDatabase', () => {
  it('seeds default schema, subjects, and settings on first run', async () => {
    await initialiseDatabase();

    expect(await db.studentFields.count()).toBeGreaterThan(0);
    expect(await db.paymentFields.count()).toBeGreaterThan(0);
    expect(await db.subjects.count()).toBeGreaterThan(0);
    expect(await db.settings.get('singleton')).toMatchObject({
      schemaVersion: 1,
      onboardingComplete: false,
    });
  });

  it('is safe to run repeatedly', async () => {
    await initialiseDatabase();
    const counts = await Promise.all([
      db.studentFields.count(), db.paymentFields.count(), db.subjects.count(),
    ]);

    await initialiseDatabase();

    expect(await Promise.all([
      db.studentFields.count(), db.paymentFields.count(), db.subjects.count(),
    ])).toEqual(counts);
  });
});
