import { describe, expect, it } from 'vitest';
import { getDefaultPaymentFields, getDefaultStudentFields } from './defaultFields';

describe('default schema fields', () => {
  it('returns stable student fields with required searchable identity fields', () => {
    const fields = getDefaultStudentFields();
    const byId = new Map(fields.map(field => [field.id, field]));

    expect(byId.get('student_name')).toMatchObject({
      type: 'text', required: true, searchable: true, enabled: true,
    });
    expect(byId.get('student_id')).toMatchObject({
      type: 'text', required: false, searchable: true,
    });
    expect(byId.get('gender')?.options).toHaveLength(3);
    expect(fields.every(({ createdAt, updatedAt }) => createdAt === updatedAt)).toBe(true);
  });

  it('returns default payment fields with unique IDs and stable order', () => {
    const fields = getDefaultPaymentFields();

    expect(fields.length).toBeGreaterThan(0);
    expect(new Set(fields.map(({ id }) => id)).size).toBe(fields.length);
    expect(fields.map(({ order }) => order)).toEqual(
      [...fields].map(({ order }) => order).sort((a, b) => a - b),
    );
    expect(fields.every(({ createdAt, updatedAt }) => createdAt === updatedAt)).toBe(true);
  });
});
