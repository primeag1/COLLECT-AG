// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

function AuthState() {
  const { user, isAuthenticated, signOut } = useAuth();
  return (
    <div>
      <output data-testid="auth-state">{isAuthenticated ? 'signed-in' : 'signed-out'}</output>
      <output data-testid="user-name">{user?.displayName ?? ''}</output>
      <button onClick={() => void signOut(true)}>Sign out</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('restores a saved identity and clears authentication on sign out', async () => {
    localStorage.setItem('fl_user', JSON.stringify({
      id: 'user-1',
      email: 'member@example.test',
      displayName: 'Member',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('signed-in'));
    expect(screen.getByTestId('user-name')).toHaveTextContent('Member');

    await act(async () => screen.getByRole('button', { name: 'Sign out' }).click());

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('signed-out'));
    expect(localStorage.getItem('fl_user')).toBeNull();
    expect(localStorage.getItem('fl_token_expires_at')).toBeNull();
  });
});
