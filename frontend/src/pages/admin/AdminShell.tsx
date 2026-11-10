import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '@blueprintjs/core';
import type { AdminMeResponse } from '@trasolve/shared';
import { logout } from '@/features/auth';
import { LanguageControl, NL, useL } from '@/shared/i18n';
import { ThemeControl } from '@/shared/theme/ThemeControl';
import { AdminHeader, AdminMain } from './AdminPrimitives';

export function useAdminNavigation() {
  const L = useL();
  return [
    {
      href: '/admin',
      label: L('admin:navigation.dashboard'),
      icon: 'dashboard',
    },
    {
      href: '/admin/users',
      label: L('admin:navigation.users'),
      icon: 'people',
    },
    { href: '/admin/trips', label: L('admin:navigation.trips'), icon: 'map' },
    {
      href: '/admin/api-usage',
      label: L('admin:navigation.apiUsage'),
      icon: 'chart',
    },
    {
      href: '/admin/operations',
      label: L('admin:navigation.operations'),
      icon: 'pulse',
    },
    {
      href: '/admin/audit',
      label: L('admin:navigation.audit'),
      icon: 'history',
    },
  ] satisfies Array<{ href: string; label: string; icon: IconName }>;
}

export function AdminShell({
  session,
  children,
}: {
  session: AdminMeResponse;
  children: ReactNode;
}) {
  const L = useL();
  const navigation = useAdminNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const changed = () => {
      setMobile(media.matches);
      setMenuOpen(false);
    };
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const current = navigation.find((item) => item.href === path);
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    sidebarRef.current?.querySelector<HTMLElement>('a')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
      if (event.key === 'Tab') {
        const items =
          sidebarRef.current?.querySelectorAll<HTMLElement>('a, button');
        if (!items?.length) {
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [menuOpen]);
  return (
    <div className="admin-shell">
      <a className="admin-skip-link" href="#admin-content">
        {L('admin:common.skipToContent')}
      </a>
      <aside
        inert={mobile && !menuOpen}
        ref={sidebarRef}
        className="admin-sidebar"
        id="admin-navigation"
        data-open={menuOpen}
      >
        <a className="admin-brand" href="/admin">
          <span className="admin-brand-icon">
            <Icon icon="route" size={21} />
          </span>
          <span>
            {NL('Trasolve')}
            <small>{L('admin:shell.workspace')}</small>
          </span>
        </a>
        <div className="admin-nav-label">{L('admin:shell.management')}</div>
        <nav aria-label={L('common:header.ariaLabel.mainMenu')}>
          {navigation.map(({ href, label, icon }) => (
            <a
              key={href}
              href={href}
              aria-current={path === href ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <Icon icon={icon} size={17} />
              <span>{label}</span>
              {path === href && <span className="admin-nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <a className="admin-back-link" href="/map">
            <Icon icon="arrow-top-right" size={16} />
            {L('common:header.text.goServices')}
          </a>
          <div className="admin-session">
            <span className="admin-avatar">
              {(session.user.name ?? session.user.email)
                .slice(0, 1)
                .toLocaleUpperCase()}
            </span>
            <div>
              <strong>{session.user.name ?? session.user.email}</strong>
              <small>{session.user.email}</small>
            </div>
            <button
              className="admin-icon-button"
              type="button"
              title={L('common:action.signOut')}
              aria-label={L('common:action.signOut')}
              disabled={loggingOut}
              onClick={() => {
                setLoggingOut(true);
                setLogoutFailed(false);
                void logout()
                  .then(() => window.location.assign('/admin'))
                  .catch(() => {
                    setLogoutFailed(true);
                    setLoggingOut(false);
                  });
              }}
            >
              <Icon icon="log-out" size={16} />
            </button>
          </div>
          {logoutFailed && (
            <p className="admin-error" role="alert">
              {L('admin:common.loadFailed')}
            </p>
          )}
        </div>
      </aside>
      <div className="admin-body">
        <AdminHeader>
          <button
            ref={triggerRef}
            type="button"
            className="admin-icon-button admin-menu-button"
            aria-label={L('common:header.ariaLabel.mainMenu')}
            aria-expanded={menuOpen}
            aria-controls="admin-navigation"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <Icon icon="menu" size={19} />
          </button>
          <div className="admin-breadcrumb">
            <span>{L('admin:shell.workspace')}</span>
            <Icon icon="chevron-right" size={13} />
            <strong>{current?.label ?? L('admin:common.notFound')}</strong>
          </div>
          <div className="admin-header-controls">
            <span className="admin-time-zone">{NL('Asia/Seoul')}</span>
            <LanguageControl />
            <ThemeControl />
          </div>
        </AdminHeader>
        <AdminMain id="admin-content" tabIndex={-1}>
          {children}
        </AdminMain>
        <footer className="admin-footer">
          <span>{NL('Trasolve')}</span>
          <span>{L('admin:shell.timeZoneNote')}</span>
        </footer>
      </div>
      {menuOpen && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          aria-label={L('common:action.close')}
          onClick={() => {
            setMenuOpen(false);
            triggerRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
