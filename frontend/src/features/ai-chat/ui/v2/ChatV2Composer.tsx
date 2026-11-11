import { useEffect, type RefObject, type FormEvent } from 'react';
import { CHAT_LIMITS } from '@trasolve/shared';
import { useL } from '@/shared/i18n';

type Props = {
  draft: string;
  sending: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onDraftChange: (value: string) => void;
  onSend: () => Promise<void>;
  onStop: () => void;
};

export function ChatV2Composer({
  draft,
  sending,
  textareaRef,
  onDraftChange,
  onSend,
  onStop,
}: Props) {
  const L = useL();
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(160, Math.max(44, textarea.scrollHeight))}px`;
    }
  }, [draft, textareaRef]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sending && draft.trim()) {
      void onSend();
    }
  };
  return (
    <form className="chat-v2-compose" onSubmit={submit} aria-busy={sending}>
      <label className="sr-only" htmlFor="trip-map-ai-input">
        {L('ai:mapAiPanel.label.sendMessageAiTravelAssistant')}
      </label>
      <textarea
        id="trip-map-ai-input"
        ref={textareaRef}
        rows={1}
        value={draft}
        maxLength={CHAT_LIMITS.messageLength}
        placeholder={L('ai:mapAiPanel.placeholder.askAboutTravel')}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            if (!sending) {
              event.currentTarget.form?.requestSubmit();
            }
          }
        }}
      />
      {sending ? (
        <button
          type="button"
          className="chat-v2-send is-stop"
          onClick={onStop}
          aria-label={L('ai:mapAiPanel.renderThread.action.cancelCreation')}
          title={L('ai:mapAiPanel.renderThread.action.cancelCreation')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="7" y="7" width="10" height="10" rx="2" />
          </svg>
        </button>
      ) : (
        <button
          type="submit"
          className="chat-v2-send"
          disabled={!draft.trim()}
          aria-label={L('ai:mapAiPanel.action.transfer')}
          title={L('ai:mapAiPanel.action.transfer')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5m-6 6 6-6 6 6" />
          </svg>
        </button>
      )}
    </form>
  );
}
