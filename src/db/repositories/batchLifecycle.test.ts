// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDB } from '../indexeddb/database';
import { processExpiredBatchMemberships } from './batchLifecycle';

const db = getDB();

beforeEach(async () => {
  await db.open();
  await Promise.all([db.batches.clear(), db.students.clear()]);
  localStorage.clear();
});

describe('processExpiredBatchMemberships', () => {
  it('ends expired memberships and completes students only when no active batch remains', async () => {
    const now = new Date().toISOString();
    await db.batches.bulkPut([
      { id: 'expired', name: 'Expired', subjectIds: [], status: 'active', endDate: '2000-01-01', createdAt: now, updatedAt: now },
      { id: 'current', name: 'Current', subjectIds: [], status: 'active', endDate: '2999-01-01', createdAt: now, updatedAt: now },
    ]);
    await db.students.bulkPut([
      {
        id: 'finished', values: { student_status: 'active' }, createdAt: now, updatedAt: now,
        batchMemberships: [{ id: 'm1', studentId: 'finished', batchId: 'expired', status: 'active' }],
      },
      {
        id: 'continuing', values: { student_status: 'active' }, createdAt: now, updatedAt: now,
        batchMemberships: [
          { id: 'm2', studentId: 'continuing', batchId: 'expired', status: 'active' },
          { id: 'm3', studentId: 'continuing', batchId: 'current', status: 'active' },
        ],
      },
      {
        id: 'already-completed', values: { student_status: 'completed' }, createdAt: now, updatedAt: now,
        batchMemberships: [{ id: 'm4', studentId: 'already-completed', batchId: 'expired', status: 'active' }],
      },
      {
        id: 'archived', values: { student_status: 'active' }, createdAt: now, updatedAt: now,
        archivedAt: now,
        batchMemberships: [{ id: 'm5', studentId: 'archived', batchId: 'expired', status: 'active' }],
      },
    ]);
    const processed = vi.fn();
    window.addEventListener('fl:batch-lifecycle-processed', processed);

    const result = await processExpiredBatchMemberships();

    window.removeEventListener('fl:batch-lifecycle-processed', processed);
    expect(result).toMatchObject({
      batchesProcessed: 1, batchesCompleted: 1, membershipsEnded: 3, studentsCompleted: 1,
    });
    expect((await db.students.get('finished'))?.values.student_status).toBe('completed');
    expect((await db.students.get('continuing'))?.values.student_status).toBe('active');
    expect((await db.students.get('already-completed'))?.values.student_status).toBe('completed');
    expect((await db.students.get('archived'))?.batchMemberships[0]?.status).toBe('active');
    expect(processed).toHaveBeenCalledOnce();

    await expect(processExpiredBatchMemberships()).resolves.toMatchObject({
      batchesProcessed: 0, membershipsEnded: 0, studentsCompleted: 0,
    });
  });

  it('supports forced runs and does not dispatch when there are no expired batches', async () => {
    const eventSpy = vi.spyOn(window, 'dispatchEvent');

    await expect(processExpiredBatchMemberships(true)).resolves.toMatchObject({
      batchesProcessed: 0, batchesCompleted: 0, membershipsEnded: 0, studentsCompleted: 0,
    });

    expect(eventSpy).not.toHaveBeenCalled();
  });
});
