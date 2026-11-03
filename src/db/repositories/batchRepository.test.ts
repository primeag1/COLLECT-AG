// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDB } from '../indexeddb/database';
import { academicYearRepository, batchRepository, subjectRepository } from './batchRepository';

const db = getDB();

beforeEach(async () => {
  await db.open();
  await Promise.all([db.academicYears.clear(), db.batches.clear(), db.subjects.clear()]);
});

describe('academicYearRepository', () => {
  it('creates years, notifies listeners, filters, updates, and archives', async () => {
    const listener = vi.fn();
    window.addEventListener('fl:academic-year-created', listener);
    const active = await academicYearRepository.create('2026–27', '2026-04-01', '2027-03-31');
    const other = await academicYearRepository.create('2025–26');
    window.removeEventListener('fl:academic-year-created', listener);

    expect(listener).toHaveBeenCalledTimes(2);
    expect((await academicYearRepository.listActive()).map(({ name }) => name)).toEqual(['2025–26', '2026–27']);
    await academicYearRepository.update(other.id, { name: '2024–25' });
    await academicYearRepository.archive(active.id);
    expect((await academicYearRepository.listAll()).map(({ name }) => name)).toEqual(['2024–25', '2026–27']);
    expect(await academicYearRepository.listActive()).toMatchObject([{ id: other.id }]);
  });
});

describe('subjectRepository', () => {
  it('seeds default subjects only once and supports archive and update', async () => {
    await subjectRepository.seedDefaults();
    const seededCount = await db.subjects.count();
    await subjectRepository.seedDefaults();
    expect(await db.subjects.count()).toBe(seededCount);

    const subject = await subjectRepository.create('Art');
    await subjectRepository.update(subject.id, 'Fine Art');
    await subjectRepository.archive(subject.id);
    expect(await subjectRepository.listActive()).toHaveLength(seededCount);
    expect(await subjectRepository.listAll()).toContainEqual(
      expect.objectContaining({ id: subject.id, name: 'Fine Art', status: 'archived' }),
    );
  });
});

describe('batchRepository', () => {
  it('lists, updates, archives, restores, and deletes batches', async () => {
    const first = await batchRepository.create({
      name: 'Zeta', academicYearId: 'year-1', subjectIds: [], status: 'active',
    });
    const second = await batchRepository.create({
      name: 'Alpha', academicYearId: 'year-2', subjectIds: [], status: 'active',
    });
    await batchRepository.update(first.id, { name: 'Beta' });

    expect(await batchRepository.getById(first.id)).toMatchObject({ name: 'Beta' });
    expect((await batchRepository.listAll()).map(({ name }) => name)).toEqual(['Alpha', 'Beta']);
    expect(await batchRepository.listByAcademicYear('year-2')).toMatchObject([{ id: second.id }]);
    await batchRepository.archive(first.id);
    expect(await batchRepository.listActive()).toMatchObject([{ id: second.id }]);
    await batchRepository.unarchive(first.id);
    expect(await batchRepository.getById(first.id)).toMatchObject({ status: 'active' });
    await batchRepository.update(second.id, { endDate: '2000-01-01' });
    await batchRepository.archive(second.id);
    await batchRepository.unarchive(second.id);
    expect(await batchRepository.getById(second.id)).toMatchObject({ status: 'completed' });
    await batchRepository.delete(second.id);
    expect(await batchRepository.getById(second.id)).toBeUndefined();
    await batchRepository.unarchive('missing');
  });
});
