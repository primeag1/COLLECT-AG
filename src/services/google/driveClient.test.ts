import { afterEach, describe, expect, it, vi } from 'vitest';
import { driveClient } from './driveClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Drive API retries', () => {
  it('retries a list request after a 429 response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', {
        status: 429,
        headers: { 'Retry-After': '0' },
      }))
      .mockResolvedValueOnce(new Response('{"files":[]}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(driveClient.listFiles('token', "name='students.json'"))
      .resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops after four attempts for repeated server errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', {
      status: 503,
      headers: { 'Retry-After': '0' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(driveClient.listFiles('token', 'trashed=false'))
      .rejects.toThrow('Drive API error 503');

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
