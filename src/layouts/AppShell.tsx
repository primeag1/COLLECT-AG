import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Logo } from '../components/Logo';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { Icons } from '../components/Icons';

const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard',  Icon: Icons.dashboard  },
  { to: '/app/payments',  label: 'Payments',   Icon: Icons.payments   },
  { to: '/app/students',  label: 'Members',    Icon: Icons.students   },
  { to: '/app/batches',   label: 'Batches',    Icon: Icons.batches    },
  { to: '/app/receipts',  label: 'Receipts',   Icon: Icons.receipts   },
  { to: '/app/reports',   label: 'Reports',    Icon: Icons.reports    },
  { to: '/app/settings',  label: 'Settings',   Icon: Icons.settings   },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  const sidebarContent = (
    <nav
      className="app-sidebar"
      aria-label="Main navigation"
    >
      {/* Logo — click to go to Dashboard */}
      <button
        onClick={() => { navigate('/app/dashboard'); setSidebarOpen(false); }}
        className="app-sidebar-logo"
        aria-label="Go to Dashboard"
      >
        <Logo size={30} variant="full" dark={true} />
      </button>

      {/* Nav items */}
      {NAV_ITEMS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) => `app-sidebar-link${isActive ? ' is-active' : ''}`}
        >
          {({ isActive }) => (
            <>
              <Icon size={17} color={isActive ? 'var(--color-ink)' : 'rgba(255,255,255,0.6)'} />
              {label}
            </>
          )}
        </NavLink>
      ))}

      <div className="app-sidebar-spacer" />

      {/* Sync status */}
      <div className="app-sidebar-sync">
        <SyncStatusBar sidebar />
      </div>
      <p className="app-sidebar-credit">
        DEVELOPED BY PRIME
      </p>

      {/* User section */}
      <div className="app-sidebar-user">
        {user?.photoUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
            <img
              src={user.photoUrl}
              alt={user.displayName ?? 'User'}
              style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
            <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <p style={{ color: 'var(--color-white)', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.displayName ?? 'User'}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </p>
            </div>
          </div>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, padding: '0 4px' }}>
            {user?.email ?? 'Signed in'}
          </p>
        )}
        <button
          onClick={handleSignOut}
          className="app-sidebar-signout"
        >
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <div className="sidebar-desktop app-sidebar-desktop">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <>
          <div
            className="app-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="app-sidebar-mobile">
            {sidebarContent}
          </div>
        </>
      )}

      {/* Main content */}
      <div className="app-shell-content">
        {/* Mobile topbar */}
        <div
          className="topbar-mobile"
        >
          <button
            onClick={() => navigate('/app/dashboard')}
            className="app-topbar-logo"
            aria-label="Go to Dashboard"
          >
            <Logo size={28} variant="full" dark={true} />
          </button>
          <button
            onClick={() => setSidebarOpen(true)}
            className="app-topbar-menu"
            aria-label="Open navigation menu"
          >
            <Icons.menu size={20} color="white" />
          </button>
        </div>

        <main id="main-content" tabIndex={-1} className="app-shell-main">
          <Outlet />
        </main>
      </div>

    </div>
  );
}
