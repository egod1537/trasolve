import type { ChatThread } from '../model/chatTypes';
import { useL } from '@/shared/i18n';
import { getThreadTitle, formatRelativeTime } from './chatPresentation';
type Props = {
  thread: ChatThread;
  selected: boolean;
  sending: boolean;
  renaming: boolean;
  menuOpen: boolean;
  renameDraft: string;
  onSelect: (id: string) => void;
  onBeginRename: (thread: ChatThread) => void;
  onCommitRename: (id: string) => void;
  onRenameDraftChange: (value: string) => void;
  onCancelRename: () => void;
  onToggleMenu: (id: string) => void;
  onCancelRequest: (id: string) => void;
  onSetArchived: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
};
export function ChatThreadItem({
  thread,
  selected,
  sending,
  renaming,
  menuOpen,
  renameDraft,
  onSelect,
  onBeginRename,
  onCommitRename,
  onRenameDraftChange,
  onCancelRename,
  onToggleMenu,
  onCancelRequest,
  onSetArchived,
  onDelete,
}: Props) {
  const L = useL();
  return (
    <li
      key={thread.id}
      className={`trip-ai-chat-item${selected ? ' is-selected' : ''}${sending ? ' is-generating' : ''}`}
    >
      {renaming ? (
        <form
          className="trip-ai-chat-rename"
          onSubmit={(event) => {
            event.preventDefault();
            onCommitRename(thread.id);
          }}
        >
          <input
            autoFocus
            value={renameDraft}
            aria-label={L('ai:mapAiPanel.renderThread.ariaLabel.chatName')}
            maxLength={80}
            onChange={(event) => onRenameDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') {
                return;
              }
              onCancelRename();
            }}
          />
          <button type="submit" disabled={!renameDraft.trim()}>
            {L('common:action.save')}
          </button>
          <button
            type="button"
            onClick={() => {
              onCancelRename();
            }}
          >
            {L('common:action.cancel')}
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            className="trip-ai-chat-select"
            aria-pressed={selected}
            onClick={() => onSelect(thread.id)}
          >
            <span className="trip-ai-chat-title">
              <span className="trip-ai-chat-title-text">
                {getThreadTitle(thread, L)}
              </span>
              {sending && (
                <span
                  className="trip-ai-chat-generating"
                  role="status"
                  aria-label={L(
                    'ai:mapAiPanel.renderThread.ariaLabel.generatingAiResponse',
                  )}
                />
              )}
            </span>
            <time dateTime={new Date(thread.updatedAt).toISOString()}>
              {formatRelativeTime(thread.updatedAt)}
            </time>
          </button>
          <div className="trip-ai-chat-item-more">
            <button
              type="button"
              className="trip-ai-chat-more-button"
              aria-label={L('ai:mapAiPanel.renderThread.ariaLabel.menu', {
                title: getThreadTitle(thread, L),
              })}
              title={L('ai:mapAiPanel.renderThread.tooltip.chatMenu')}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => onToggleMenu(thread.id)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className="trip-ai-chat-menu" role="menu">
                {sending && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onCancelRequest(thread.id);
                    }}
                  >
                    {L('ai:mapAiPanel.renderThread.action.cancelCreation')}
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => onBeginRename(thread)}
                >
                  {L('ai:mapAiPanel.renderThread.action.changeName')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => onSetArchived(thread.id, !thread.archived)}
                >
                  {thread.archived
                    ? L('ai:mapAiPanel.renderThread.action.unarchive')
                    : L('ai:mapAiPanel.renderThread.action.storage')}
                </button>
                <button
                  type="button"
                  className="is-destructive"
                  role="menuitem"
                  onClick={() => onDelete(thread.id)}
                >
                  {L('common:action.delete')}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </li>
  );
}
