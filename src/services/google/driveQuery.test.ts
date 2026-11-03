import { describe, expect, it } from 'vitest';
import { escapeDriveQuery } from './driveQuery';

describe('escapeDriveQuery', () => {
  it('escapes backslashes and apostrophes in query literals', () => {
    expect(escapeDriveQuery(String.raw`Tutor's \ folder`)).toBe(String.raw`Tutor\'s \\ folder`);
  });
});
