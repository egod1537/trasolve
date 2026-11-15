import { useL } from '@/shared/i18n';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import type { WorkspaceCommandRequest } from '@trasolve/shared';
import type { CommandRecord } from './commandRuntime';
export function CommandOutputView({
  record,
  onExecute,
}: {
  record: CommandRecord;
  onExecute: (request: WorkspaceCommandRequest, expectedTrip?: string) => void;
}) {
  const L = useL();
  return (
    <article className="command-output" data-status={record.status}>
      <header>
        <code>{record.request.name}</code>
        {record.status === 'running' ? (
          <LoadingSpinner size="sm" />
        ) : (
          <span aria-hidden="true">
            {record.status === 'success'
              ? '✓'
              : record.status === 'cancelled'
                ? '—'
                : '!'}
          </span>
        )}
      </header>
      <small>
        {record.status === 'running'
          ? L('common:jobs.jOBSTATUSLABELS.text.running')
          : record.status === 'success'
            ? L('common:jobs.jOBSTATUSLABELS.text.done')
            : record.status === 'cancelled'
              ? L('common:jobs.jOBSTATUSLABELS.text.canceled')
              : L('common:status.error')}
      </small>
      {record.error && <p role="alert">{record.error}</p>}
      {record.output?.text && (
        <pre className="command-response">{record.output.text}</pre>
      )}
      {record.output?.items?.length === 0 && <p>{L('admin:common.empty')}</p>}
      {record.output?.items && (
        <ol>
          {record.output.items.map((item, index) => (
            <li key={index}>
              {item.command ? (
                <button
                  type="button"
                  onClick={() =>
                    onExecute(item.command!, record.output?.expectedTrip)
                  }
                >
                  <strong>{item.label}</strong>
                  {item.detail && <small>{item.detail}</small>}
                </button>
              ) : (
                <div>
                  <strong>{item.label}</strong>
                  {item.detail && <code>{item.detail}</code>}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {record.output?.data !== undefined && (
        <details open={!record.output.items && !record.output.text}>
          <summary>{L('admin:common.details')}</summary>
          <pre>
            {JSON.stringify(record.output.data, null, 2).slice(0, 20000)}
          </pre>
        </details>
      )}
    </article>
  );
}
