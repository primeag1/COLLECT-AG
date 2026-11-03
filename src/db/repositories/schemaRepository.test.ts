import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from '../indexeddb/database';
import { schemaRepository } from './schemaRepository';

const db = getDB();

beforeEach(async () => {
  await db.open();
  await Promise.all([db.studentFields.clear(), db.paymentFields.clear()]);
});

describe('schemaRepository', () => {
  it('seeds and filters default student fields on first access', async () => {
    const all = await schemaRepository.getStudentFields();

    expect(all.length).toBeGreaterThan(0);
    expect(await schemaRepository.getEnabledStudentFields()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'student_name', enabled: true })]),
    );
    expect(await schemaRepository.getListStudentFields()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'student_name', showInList: true })]),
    );
  });

  it('saves, creates, updates, and reorders student fields', async () => {
    await schemaRepository.seedStudentFields();
    const fields = await schemaRepository.getStudentFields();
    const first = fields[0];
    const second = fields[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) throw new Error('Expected seeded fields');

    await schemaRepository.updateStudentField(first.id, { label: 'Renamed' });
    expect((await schemaRepository.getStudentFields())[0]?.label).toBe('Renamed');
    await schemaRepository.reorderStudentFields([second.id, first.id]);
    expect((await schemaRepository.getStudentFields()).slice(0, 2).map(({ id }) => id))
      .toEqual([second.id, first.id]);
    await expect(schemaRepository.updateStudentField('missing', {}))
      .rejects.toThrow(`Student field missing not found`);

    const custom = await schemaRepository.createCustomStudentField({
      label: 'Custom field', type: 'text', required: false, searchable: false,
      enabled: true, showInList: false, showOnReceipt: false, order: 99,
    });
    expect(custom).toMatchObject({ category: 'custom', label: 'Custom field' });
    await schemaRepository.saveStudentField({ ...custom, label: 'Saved custom field' });
    expect((await schemaRepository.getStudentFields()).find(({ id }) => id === custom.id)?.label)
      .toBe('Saved custom field');
  });

  it('seeds payment fields and initializes either schema only when empty', async () => {
    await schemaRepository.initialise();
    const studentCount = await db.studentFields.count();
    const paymentCount = await db.paymentFields.count();
    expect(studentCount).toBeGreaterThan(0);
    expect(paymentCount).toBeGreaterThan(0);

    await db.studentFields.clear();
    await schemaRepository.initialise();
    expect(await db.studentFields.count()).toBe(studentCount);
    expect(await db.paymentFields.count()).toBe(paymentCount);
    expect(await schemaRepository.getPaymentFields()).toHaveLength(paymentCount);
  });
});
