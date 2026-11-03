import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from '../indexeddb/database';
import { migrateFeeTypeField, runMigrations } from './migrations';

const db = getDB();

beforeEach(async () => {
  await db.open();
  await Promise.all([db.studentFields.clear(), db.students.clear()]);
});

describe('fee type migration', () => {
  it('converts legacy field definitions and student values losslessly', async () => {
    const timestamp = '2020-01-01T00:00:00.000Z';
    await db.studentFields.put({
      id: 'fee_type', label: 'Fee Amount Type', type: 'select',
      required: false, searchable: false, enabled: true, showInList: false, showOnReceipt: false,
      order: 1, category: 'tuition', options: [{ id: 'total', label: 'Total', value: 'total' }],
      createdAt: timestamp, updatedAt: timestamp, _store: 'studentFields',
    });
    await db.students.bulkPut([
      { id: 'total', values: { fee_type: 'total' }, batchMemberships: [], createdAt: timestamp, updatedAt: timestamp },
      { id: 'recurring', values: { fee_type: 'per_frequency' }, batchMemberships: [], createdAt: timestamp, updatedAt: timestamp },
      { id: 'other', values: { fee_type: 'custom' }, batchMemberships: [], createdAt: timestamp, updatedAt: timestamp },
    ]);

    await runMigrations();

    expect(await db.studentFields.get('fee_type')).toMatchObject({
      label: 'This is a recurring amount', type: 'boolean', defaultValue: false,
      booleanLabels: { on: 'Recurring amount', off: 'Total fee due' },
    });
    expect((await db.students.get('total'))?.values.fee_type).toBe(false);
    expect((await db.students.get('recurring'))?.values.fee_type).toBe(true);
    expect((await db.students.get('other'))?.values.fee_type).toBe('custom');
    const updatedAt = (await db.students.get('total'))?.updatedAt;

    await migrateFeeTypeField();

    expect((await db.students.get('total'))?.updatedAt).toBe(updatedAt);
  });

  it('does nothing when the definition is already current or absent', async () => {
    await migrateFeeTypeField();
    await db.studentFields.put({
      id: 'fee_type', label: 'Other label', type: 'boolean',
      required: false, searchable: false, enabled: true, showInList: false, showOnReceipt: false,
      order: 1, category: 'tuition', createdAt: '2020-01-01', updatedAt: '2020-01-01',
      _store: 'studentFields',
    });
    await db.students.put({
      id: 'current', values: { fee_type: 'per_frequency' }, batchMemberships: [],
      createdAt: '2020-01-01', updatedAt: '2020-01-01',
    });

    await migrateFeeTypeField();

    expect((await db.students.get('current'))?.values.fee_type).toBe('per_frequency');
  });
});
