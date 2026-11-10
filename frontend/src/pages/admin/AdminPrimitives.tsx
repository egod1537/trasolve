// Adapted from satnaing/shadcn-admin: components/layout/{header,main}.tsx
// and components/ui/card.tsx. MIT, see docs/licenses/SHADCN-ADMIN-MIT.txt.
// Tailwind classes are replaced with scoped Trasolve theme styles.
import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Icon } from '@blueprintjs/core';
import { useL, getLanguage } from '@/shared/i18n';
import { AdminApiError } from '@/shared/api/admin';

export function AdminHeader({
  className = '',
  children,
  ...props
}: ComponentProps<'header'>) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const onScroll = () => setOffset(document.documentElement.scrollTop);
    onScroll();
    document.addEventListener('scroll', onScroll, { passive: true });
    return () => document.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header
      className={`admin-header ${className}`}
      data-scrolled={offset > 10}
      {...props}
    >
      <div className="admin-header-inner">{children}</div>
    </header>
  );
}

export function AdminMain({
  className = '',
  ...props
}: ComponentProps<'main'>) {
  return <main className={`admin-main ${className}`} {...props} />;
}

export function Card({ className = '', ...props }: ComponentProps<'div'>) {
  return (
    <div data-slot="card" className={`admin-card ${className}`} {...props} />
  );
}
export function CardHeader({
  className = '',
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={`admin-card-header ${className}`}
      {...props}
    />
  );
}
export function CardTitle({ className = '', ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="card-title"
      className={`admin-card-title ${className}`}
      {...props}
    />
  );
}
export function CardDescription({
  className = '',
  ...props
}: ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={`admin-muted ${className}`}
      {...props}
    />
  );
}
export function CardContent({
  className = '',
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={`admin-card-content ${className}`}
      {...props}
    />
  );
}

export function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: ComponentProps<typeof Icon>['icon'];
}) {
  return (
    <Card>
      <CardContent>
        <div className="admin-metric-label">
          <span>{label}</span>
          {icon && <Icon icon={icon} size={17} />}
        </div>
        <div className="admin-metric-value">{value}</div>
        {detail && <p className="admin-muted">{detail}</p>}
      </CardContent>
    </Card>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'danger' | 'warning';
}) {
  return (
    <span className="admin-badge" data-tone={tone}>
      {children}
    </span>
  );
}
export function EmptyState() {
  const L = useL();
  return (
    <div className="admin-empty" role="status">
      <Icon icon="inbox" size={28} />
      <p>{L('admin:common.empty')}</p>
    </div>
  );
}
export function ResourceState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: unknown;
  retry: () => void;
}) {
  const L = useL();
  if (loading) {
    return (
      <div className="admin-empty" role="status">
        <span className="admin-spinner" />
        {L('common:routes.loadingLabel.pageLoading')}
      </div>
    );
  }
  if (!error) {
    return null;
  }
  const expired =
    error instanceof AdminApiError &&
    (error.status === 401 || error.status === 403);
  return (
    <div className="admin-empty admin-error" role="alert">
      <Icon icon="warning-sign" size={24} />
      <p>
        {expired
          ? L('admin:common.accessExpired')
          : error instanceof AdminApiError &&
              error.code === 'ADMIN_REQUIRES_POSTGRES'
            ? L('admin:common.requiresPostgres')
            : L('admin:common.loadFailed')}
      </p>
      <button
        className="admin-button"
        type="button"
        onClick={expired ? () => window.location.reload() : retry}
      >
        {L('common:action.retry')}
      </button>
    </div>
  );
}

export function Pagination({
  page,
  total,
  hasNext,
  loading,
  previous,
  next,
}: {
  page: number;
  total?: number;
  hasNext: boolean;
  loading: boolean;
  previous: () => void;
  next: () => void;
}) {
  const L = useL();
  return (
    <div className="admin-pagination">
      <span className="admin-muted">
        {total === undefined
          ? L('admin:common.page', { page })
          : L('admin:common.pageTotal', { page, total: number(total) })}
      </span>
      <div className="admin-inline">
        <button
          className="admin-button"
          type="button"
          disabled={page === 1 || loading}
          onClick={previous}
        >
          <Icon icon="chevron-left" size={14} />
          {L('admin:common.action.previous')}
        </button>
        <button
          className="admin-button"
          type="button"
          disabled={!hasNext || loading}
          onClick={next}
        >
          {L('admin:common.action.next')}
          <Icon icon="chevron-right" size={14} />
        </button>
      </div>
    </div>
  );
}

export function number(value: number): string {
  return new Intl.NumberFormat(getLanguage()).format(value);
}
export function dateTime(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat(getLanguage(), {
        timeZone: 'Asia/Seoul',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—';
}
export function percent(failed: number, total: number): string {
  return total > 0
    ? new Intl.NumberFormat(getLanguage(), {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(failed / total)
    : '—';
}
export function latency(value: number | null): string {
  return value === null
    ? '—'
    : new Intl.NumberFormat(getLanguage(), {
        style: 'unit',
        unit: 'millisecond',
        maximumFractionDigits: 0,
      }).format(value);
}
