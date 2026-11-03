import { describe, expect, it } from 'vitest';
import { serializeCSV } from './csv';

describe('serializeCSV', () => {
  it('prefixes formula-like text while keeping numeric amount values unchanged', () => {
    const csv = serializeCSV([
      ['Name', 'Phone', 'Amount'],
      ['=HYPERLINK("https://example.com")', '+91 98300', '-5'],
      ['@SUM(A1)', '\t=1+1', '12'],
      ['-5', '\r=1+1', '0'],
      ['Soumik Das', '98300', '1500'],
    ]);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+91 98300");
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain("'\t=1+1");
    expect(csv).toContain("'\r=1+1");
    expect(csv).toContain("'-5");
    expect(csv).toContain('"-5"');
    expect(csv).toContain('\uFEFF');
    expect(csv).toContain('Soumik Das');
  });
});
