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

  it('parses API error details and does not retry non-retryable errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: 'Not allowed', status: 'PERMISSION_DENIED' } }),
      { status: 403 },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(driveClient.listFiles('token', 'trashed=false'))
      .rejects.toMatchObject({ message: 'Not allowed', code: 403, status: 'PERMISSION_DENIED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('supports folder metadata, updates, trash, and empty successful responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"id":"folder","name":"Data"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"id":"folder","name":"Archive"}', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await driveClient.createFolder('token', 'Data', 'root');
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)))
      .toMatchObject({ name: 'Data', parents: ['root'] });
    await driveClient.renameFolder('token', 'folder', 'Archive');
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ name: 'Archive' });
    await expect(driveClient.deleteFile('token', 'old-file')).resolves.toBeUndefined();
    await expect(driveClient.trashFile('token', 'folder')).resolves.toBeUndefined();
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toEqual({ trashed: true });
  });

  it('uploads JSON and PDF with the appropriate HTTP methods', async () => {
    const fetchMock = vi.fn()
      .mockImplementation(() => Promise.resolve(new Response('{"id":"file"}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    await driveClient.uploadJSON('token', 'students.json', { students: [] }, 'data-folder');
    await driveClient.uploadPDF('token', 'receipt.pdf', new Blob(['pdf']), 'receipts-folder', 'pdf-file');

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('PATCH');
  });

  it('downloads JSON and surfaces download failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"files":[]}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(driveClient.downloadJSON('token', 'file-id')).resolves.toEqual({ files: [] });
    await expect(driveClient.downloadJSON('token', 'missing'))
      .rejects.toMatchObject({ message: 'Download failed: 404', code: 404 });
  });
});
