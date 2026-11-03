import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from '../indexeddb/database';
import { studentRepository } from './studentRepository';

const db = getDB();

beforeEach(async () => {
  await db.open();
  await db.students.clear();
});

describe('studentRepository', () => {
  it('creates, updates, searches, filters, archives, and restores students', async () => {
    const first = await studentRepository.create({
      values: { student_name: 'Asha Rao', parent_phone: '12345' },
      batchIds: ['batch-a'],
    });
    const second = await studentRepository.create({
      values: { student_name: 'Ben Das' },
      batchIds: ['batch-b'],
    });

    expect(first.batchMemberships).toHaveLength(1);
    expect(await studentRepository.listByBatch('batch-a')).toHaveLength(1);
    expect((await studentRepository.search('  ', [])).map(({ id }) => id)).toEqual(
      expect.arrayContaining([first.id, second.id]),
    );
    expect((await studentRepository.search('ASHA', ['student_name'])).map(({ id }) => id)).toEqual([first.id]);
    expect(await studentRepository.count()).toBe(2);

    await studentRepository.update(first.id, { parent_phone: '99999' });
    expect((await studentRepository.getById(first.id))?.values.parent_phone).toBe('99999');
    await studentRepository.addToBatch(first.id, 'batch-a');
    await studentRepository.addToBatch(first.id, 'batch-c');
    expect((await studentRepository.getById(first.id))?.batchMemberships).toHaveLength(2);
    await studentRepository.removeFromBatch(first.id, 'batch-a');
    expect((await studentRepository.getById(first.id))?.batchMemberships[0]?.status).toBe('completed');

    await studentRepository.archive(first.id);
    expect(await studentRepository.count()).toBe(1);
    expect((await studentRepository.listAll()).map(({ id }) => id)).toContain(first.id);
    await studentRepository.restore(first.id);
    expect(await studentRepository.count()).toBe(2);
  });

  it('reports a missing student update and safely ignores removing an unknown student', async () => {
    await expect(studentRepository.update('missing', {})).rejects.toThrow('Student missing not found');
    await studentRepository.removeFromBatch('missing', 'batch');
    expect(await studentRepository.getById('missing')).toBeUndefined();
  });

  it('deletes a student record', async () => {
    const student = await studentRepository.create({ values: { student_name: 'Delete Me' } });

    await studentRepository.delete(student.id);

    expect(await studentRepository.getById(student.id)).toBeUndefined();
  });
});
