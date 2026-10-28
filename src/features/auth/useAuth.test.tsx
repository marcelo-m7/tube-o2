import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, render, renderHook } from '@testing-library/react';
import { AuthProvider, useAuth } from './useAuth';

const signInWithEmailMock = vi.fn();
const signUpWithEmailMock = vi.fn();
const signOutUserMock = vi.fn();

vi.mock('./auth.api', () => ({
  signInWithEmail: (...args: unknown[]) => signInWithEmailMock(...args),
  signUpWithEmail: (...args: unknown[]) => signUpWithEmailMock(...args),
  signOutUser: () => signOutUserMock(),
}));

const onAuthStateChangeMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock('@/shared/api/supabase/supabaseClient', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
      getSession: () => getSessionMock(),
    },
  },
}));

function TestConsumer() {
  const { user, loading, signIn } = useAuth();

  return (
    <div>
      <span>{loading ? 'loading' : 'ready'}</span>
      <span>{user?.email ?? 'no-user'}</span>
      <button type="button" onClick={() => signIn('test@example.com', 'secret')}>
        sign-in
      </button>
    </div>
  );
}

beforeEach(() => {
  onAuthStateChangeMock.mockReset();
  getSessionMock.mockReset();
  signInWithEmailMock.mockReset();
  signUpWithEmailMock.mockReset();
  signOutUserMock.mockReset();

  onAuthStateChangeMock.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });

  getSessionMock.mockResolvedValue({ data: { session: null } });
});

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const suppressExpectedWindowError = (event: ErrorEvent) => {
      if (event.error instanceof Error && event.error.message.includes('useAuth must be used within an AuthProvider')) {
        event.preventDefault();
      }
    };

    window.addEventListener('error', suppressExpectedWindowError);
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within an AuthProvider');
    window.removeEventListener('error', suppressExpectedWindowError);
    consoleErrorSpy.mockRestore();
  });

  it('waits for INITIAL_SESSION before displaying an authenticated or signed-out state', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByText('loading')).toBeInTheDocument();

    act(() => {
      onAuthStateChangeMock.mock.calls[0][0]('SIGNED_OUT', null);
    });

    expect(screen.getByText('loading')).toBeInTheDocument();

    act(() => {
      onAuthStateChangeMock.mock.calls[0][0]('INITIAL_SESSION', {
        user: { id: 'alice', email: 'alice@example.com' },
      });
    });

    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(getSessionMock).not.toHaveBeenCalled();

    screen.getByRole('button', { name: /sign-in/i }).click();

    expect(signInWithEmailMock).toHaveBeenCalledWith('test@example.com', 'secret');
  });

  it('keeps session changes in sync after hydration', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    const notify = onAuthStateChangeMock.mock.calls[0][0];
    act(() => notify('INITIAL_SESSION', { user: { id: 'alice', email: 'alice@example.com' } }));
    act(() => notify('TOKEN_REFRESHED', { user: { id: 'alice', email: 'alice@example.com' } }));

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();

    act(() => notify('SIGNED_OUT', null));
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('no-user')).toBeInTheDocument();
  });
});
