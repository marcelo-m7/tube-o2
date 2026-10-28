import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/shared/test/renderWithProviders';
import { Header } from './Header';

const useAuthMock = vi.fn();
const useProfileByIdMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/features/profile/queries/useProfile', () => ({
  useProfileById: (id?: string) => useProfileByIdMock(id),
}));

vi.mock('@/features/messages', () => ({
  useUnreadMessagesCount: () => ({ data: 3 }),
}));

vi.mock('@/features/notifications', () => ({
  useUnreadNotificationsCount: () => ({ data: 2 }),
}));

beforeEach(() => {
  navigateMock.mockReset();
});

describe('Header', () => {
  it('keeps public mobile navigation usable without exposing guest actions during auth initialization', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: true, signOut: vi.fn() });
    useProfileByIdMock.mockReturnValue({ data: undefined, isPending: true });

    renderWithProviders(<Header />);

    expect(screen.queryByRole('button', { name: /login/i })).not.toBeInTheDocument();
    const mobileMenu = screen.getByRole('button', { name: /toggle menu/i });
    expect(mobileMenu).toBeEnabled();
    await userEvent.click(mobileMenu);
    expect(screen.getAllByRole('link', { name: /imports/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /login/i })).not.toBeInTheDocument();
  });

  it.each([undefined, null])('keeps authenticated navigation without a resolved profile (%s)', async (profile) => {
    useAuthMock.mockReturnValue({ user: { id: 'user-1', email: 'user@example.com' }, loading: false, signOut: vi.fn() });
    useProfileByIdMock.mockReturnValue({ data: profile, isPending: profile === undefined });

    renderWithProviders(<Header />);

    expect(screen.queryByRole('button', { name: /login/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /my profile/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /toggle menu/i }));
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /login/i })).not.toBeInTheDocument();
  });

  it('shows login and submit buttons when user is not authenticated', () => {
    useAuthMock.mockReturnValue({ user: null, loading: false, signOut: vi.fn() });
    useProfileByIdMock.mockReturnValue({ data: null });

    renderWithProviders(<Header />);

    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit video/i })).toBeInTheDocument();
    expect(screen.queryByText(/favorites/i)).not.toBeInTheDocument();
  });

  it('shows navigation links and avatar when user is authenticated', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'user-1', email: 'user@example.com' }, loading: false, signOut: vi.fn() });
    useProfileByIdMock.mockReturnValue({ data: { id: 'user-1', username: 'user', display_name: 'User', avatar_url: null } });

    renderWithProviders(<Header />);

    expect(screen.getByRole('button', { name: /submit video/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /login/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /imports/i })).toHaveAttribute('href', '/submissions');

    await userEvent.click(screen.getByRole('button', { name: /project/i }));
    expect(screen.getByRole('menuitem', { name: /curation/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /about/i })).toBeInTheDocument();
  });

  it('opens grouped mobile navigation from the hamburger menu', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'user-1', email: 'user@example.com' }, loading: false, signOut: vi.fn() });
    useProfileByIdMock.mockReturnValue({ data: { id: 'user-1', username: 'user', display_name: 'User', avatar_url: null } });

    renderWithProviders(<Header />);

    await userEvent.click(screen.getByRole('button', { name: /toggle menu/i }));

    expect(await screen.findByText(/discover/i)).toBeInTheDocument();
    expect(screen.getByText(/learning/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /imports/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /messages/i })).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: /notifications/i })).toHaveTextContent('2');
  });
});
