import { TokenRemainingGauge } from '@/features/billing';
import { useL } from '@/shared/i18n';
import { CloseIcon } from '@/shared/ui/icons';
import type { UiChatMessage } from '../../model/chatTypes';
import { downloadChatMarkdown } from '../../lib/chatMarkdown';

type Props = {
  title: string;
  titleId: string;
  messages: UiChatMessage[];
  singleSession: boolean;
  listOpen: boolean;
  onOpenList: () => void;
  onClose?: () => void;
};

export function ChatV2Header({
  title,
  titleId,
  messages,
  singleSession,
  listOpen,
  onOpenList,
  onClose,
}: Props) {
  const L = useL();
  return (
    <header className="chat-v2-header">
      {!singleSession && (
        <button
          type="button"
          className="trip-ai-chat-list-toggle"
          aria-label={L('ai:mapAiPanel.ariaLabel.openChatList')}
          aria-controls="trip-ai-chat-list"
          aria-expanded={listOpen}
          onClick={onOpenList}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      )}
      <div className="chat-v2-heading">
        <h2 id={titleId}>{title}</h2>
        <p>{L('ai:mapAiPanel.description.travelAssistant')}</p>
      </div>
      <div className="chat-v2-header-actions">
        <button
          type="button"
          className="trip-map-ai-panel-export"
          aria-label={L('ai:mapAiPanel.ariaLabel.saveAsMarkdown')}
          title={L('ai:mapAiPanel.ariaLabel.saveAsMarkdown')}
          disabled={!messages.length}
          onClick={() => downloadChatMarkdown(messages)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" />
          </svg>
        </button>
        <TokenRemainingGauge />
        {onClose && (
          <button
            type="button"
            className="trip-map-ai-panel-close"
            aria-label={L('ai:mapAiPanel.ariaLabel.closeAiAssistant')}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        )}
      </div>
    </header>
  );
}
