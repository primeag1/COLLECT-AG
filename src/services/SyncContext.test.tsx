// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  DriveAPIError: class MockDriveAPIError extends Error {
    code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  },
  auth: {
    isAuthenticated: false,
    ensureFreshToken: vi.fn(),
    connectDriveInteractive: vi.fn(),
    attemptSilentReconnect: vi.fn(),
  },
  pushAllToDrive: vi.fn(),
  pullAllFromDrive: vi.fn(),
  driveMetaGet: vi.fn(),
  getPendingCount: vi.fn(),
  clearCompleted: vi.fn(),
}));

vi.mock('../features/auth/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('./drive/driveSync', () => ({
  pushAllToDrive: mocks.pushAllToDrive,
  pullAllFromDrive: mocks.pullAllFromDrive,
}));
vi.mock('./google/driveClient', () => ({
  DriveAPIError: mocks.DriveAPIError,
}));
vi.mock('../db/repositories/syncRepository', () => ({
  driveMetaRepository: { get: mocks.driveMetaGet, patch: vi.fn() },
  syncRepository: {
    getPendingCount: mocks.getPendingCount,
    clearCompleted: mocks.clearCompleted,
  },
}));

import { SyncProvider, useSync } from './SyncContext';

function SyncState() {
  const {
    syncState, errorMessage, initialSyncAttempted, hasPendingChanges,
    push, pull, connectDrive, enqueuePush,
  } = useSync();
  return (
    <div>
      <output data-testid="sync-state">{syncState}</output>
      <output data-testid="sync-error">{errorMessage ?? ''}</output>
      <output data-testid="initial-sync">{String(initialSyncAttempted)}</output>
      <output data-testid="has-pending">{String(hasPendingChanges)}</output>
      <button onClick={() => void push()}>Push</button>
      <button onClick={() => void pull()}>Pull</button>
      <button onClick={() => void connectDrive()}>Connect</button>
      <button onClick={enqueuePush}>Queue</button>
    </div>
  );
}

describe('SyncProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.ensureFreshToken.mockResolvedValue('token');
    mocks.auth.connectDriveInteractive.mockResolvedValue(true);
    mocks.auth.attemptSilentReconnect.mockReturnValue(false);
    mocks.driveMetaGet.mockResolvedValue({});
    mocks.getPendingCount.mockResolvedValue(0);
    mocks.clearCompleted.mockResolvedValue(undefined);
    mocks.pushAllToDrive.mockResolvedValue(undefined);
    mocks.pullAllFromDrive.mockResolvedValue({ restored: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('blocks push until a successful initial reconciliation', async () => {
    render(<SyncProvider><SyncState /></SyncProvider>);

    await act(async () => screen.getByRole('button', { name: 'Push' }).click());

    expect(mocks.pushAllToDrive).not.toHaveBeenCalled();
    expect(screen.getByTestId('sync-state')).toHaveTextContent('error');
    expect(screen.getByTestId('sync-error')).toHaveTextContent('restore from Google Drive first');
  });

  it('retries a transient push failure', async () => {
    vi.useFakeTimers();
    mocks.driveMetaGet.mockResolvedValue({ remoteReconciledAt: '2026-01-01T00:00:00.000Z' });
    mocks.pushAllToDrive
      .mockRejectedValueOnce(new Error('temporary error'))
      .mockResolvedValueOnce(undefined);
    render(<SyncProvider><SyncState /></SyncProvider>);

    await act(async () => screen.getByRole('button', { name: 'Push' }).click());
    expect(screen.getByTestId('sync-state')).toHaveTextContent('error');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(mocks.pushAllToDrive).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('sync-state')).toHaveTextContent('synced');
  });

  it('marks a successful pull as the initial reconciliation', async () => {
    mocks.pullAllFromDrive.mockResolvedValue({ restored: true });
    const restored = vi.fn();
    window.addEventListener('fl:drive-restored', restored);
    render(<SyncProvider><SyncState /></SyncProvider>);

    await act(async () => screen.getByRole('button', { name: 'Pull' }).click());

    expect(screen.getByTestId('sync-state')).toHaveTextContent('synced');
    expect(screen.getByTestId('initial-sync')).toHaveTextContent('true');
    expect(restored).toHaveBeenCalledOnce();
    window.removeEventListener('fl:drive-restored', restored);
  });

  it('reports pull errors and completes the initial attempt state', async () => {
    mocks.pullAllFromDrive.mockRejectedValue(new Error('Drive is unavailable'));
    render(<SyncProvider><SyncState /></SyncProvider>);

    await act(async () => screen.getByRole('button', { name: 'Pull' }).click());

    expect(screen.getByTestId('sync-state')).toHaveTextContent('error');
    expect(screen.getByTestId('sync-error')).toHaveTextContent('Drive is unavailable');
    expect(screen.getByTestId('initial-sync')).toHaveTextContent('true');
  });

  it('refreshes an expired token once and retries the push', async () => {
    mocks.driveMetaGet.mockResolvedValue({ remoteReconciledAt: '2026-01-01T00:00:00.000Z' });
    mocks.auth.ensureFreshToken
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce('fresh-token');
    mocks.pushAllToDrive
      .mockRejectedValueOnce(new mocks.DriveAPIError('Expired', 401))
      .mockResolvedValueOnce(undefined);
    render(<SyncProvider><SyncState /></SyncProvider>);

    await act(async () => screen.getByRole('button', { name: 'Push' }).click());

    expect(mocks.pushAllToDrive).toHaveBeenNthCalledWith(2, 'fresh-token');
    expect(screen.getByTestId('sync-state')).toHaveTextContent('synced');
  });

  it('switches to no-drive when a refreshed push token is unavailable', async () => {
    mocks.driveMetaGet.mockResolvedValue({ remoteReconciledAt: '2026-01-01T00:00:00.000Z' });
    mocks.auth.ensureFreshToken
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce(null);
    mocks.pushAllToDrive.mockRejectedValue(new mocks.DriveAPIError('Expired', 401));
    render(<SyncProvider><SyncState /></SyncProvider>);

    await act(async () => screen.getByRole('button', { name: 'Push' }).click());

    expect(screen.getByTestId('sync-state')).toHaveTextContent('no_drive');
    expect(screen.getByTestId('sync-error')).toBeEmptyDOMElement();
  });

  it('refreshes the token after a 401 pull response', async () => {
    mocks.auth.ensureFreshToken
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce('fresh-token');
    mocks.pullAllFromDrive
      .mockRejectedValueOnce(new mocks.DriveAPIError('Expired', 401))
      .mockResolvedValueOnce({ restored: false });
    render(<SyncProvider><SyncState /></SyncProvider>);

    await act(async () => screen.getByRole('button', { name: 'Pull' }).click());

    expect(mocks.pullAllFromDrive).toHaveBeenNthCalledWith(2, 'fresh-token');
    expect(screen.getByTestId('sync-state')).toHaveTextContent('synced');
  });

  it('connects interactively and leaves Drive connection denied in no-drive state', async () => {
    mocks.auth.connectDriveInteractive.mockResolvedValueOnce(true);
    mocks.pullAllFromDrive.mockResolvedValue({ restored: true });
    render(<SyncProvider><SyncState /></SyncProvider>);

    await act(async () => screen.getByRole('button', { name: 'Connect' }).click());

    expect(mocks.auth.connectDriveInteractive).toHaveBeenCalledOnce();
    expect(mocks.pullAllFromDrive).toHaveBeenCalledOnce();

    mocks.auth.connectDriveInteractive.mockResolvedValueOnce(false);
    await act(async () => screen.getByRole('button', { name: 'Connect' }).click());
    expect(screen.getByTestId('sync-state')).toHaveTextContent('no_drive');
  });

  it('pushes local data after Drive is connected and confirmed empty', async () => {
    mocks.driveMetaGet.mockResolvedValue({ remoteReconciledAt: '2026-01-01T00:00:00.000Z' });
    mocks.pullAllFromDrive.mockResolvedValue({ restored: false });
    render(<SyncProvider><SyncState /></SyncProvider>);

    await act(async () => screen.getByRole('button', { name: 'Connect' }).click());

    expect(mocks.pushAllToDrive).toHaveBeenCalledOnce();
    expect(screen.getByTestId('sync-state')).toHaveTextContent('synced');
  });

  it('queues changes while offline and transitions back to idle when online', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<SyncProvider><SyncState /></SyncProvider>);

    await act(async () => { await Promise.resolve(); });
    await act(async () => screen.getByRole('button', { name: 'Queue' }).click());
    expect(screen.getByTestId('has-pending')).toHaveTextContent('true');

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(screen.getByTestId('sync-state')).not.toHaveTextContent('offline');
  });

  it('handles missing Drive authorization for both push and pull', async () => {
    mocks.auth.ensureFreshToken.mockResolvedValue(null);
    render(<SyncProvider><SyncState /></SyncProvider>);

    await act(async () => screen.getByRole('button', { name: 'Push' }).click());
    expect(screen.getByTestId('sync-state')).toHaveTextContent('no_drive');
    await act(async () => screen.getByRole('button', { name: 'Pull' }).click());
    expect(screen.getByTestId('sync-state')).toHaveTextContent('no_drive');
    expect(screen.getByTestId('initial-sync')).toHaveTextContent('true');
  });

  it('does not repeat a background reconnect already in progress', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.attemptSilentReconnect.mockReturnValue(true);
    render(<SyncProvider><SyncState /></SyncProvider>);

    expect(mocks.auth.attemptSilentReconnect).toHaveBeenCalledOnce();
    expect(mocks.pullAllFromDrive).not.toHaveBeenCalled();
  });
});
