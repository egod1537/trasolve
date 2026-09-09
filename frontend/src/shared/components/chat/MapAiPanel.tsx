import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { CHAT_LIMITS, type ChatMessage } from '@trasolve/shared';
import { sendChat } from '../../../api/chat';
import { downloadChatMarkdown } from '../../utils/chatMarkdown';
import { ChatMarkdown } from './ChatMarkdown';
import './chat-panel.css';

type Props = {
  open: boolean;
  onClose: () => void;
};

type UiChatMessage = ChatMessage & {
  id: string;
};

export function MapAiPanel({ open, onClose }: Props) {
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const nextMessageIdRef = useRef(1);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    if (open) textareaRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isSending, error, open]);

  const submitMessage = async () => {
    const content = draft.trim();
    if (!content || controllerRef.current) return;

    const nextMessages: UiChatMessage[] = [
      ...messages,
      {
        id: `user-${nextMessageIdRef.current++}`,
        role: 'user',
        content,
      },
    ];
    const controller = new AbortController();
    // The ref guards repeated submits before React commits isSending.
    controllerRef.current = controller;
    setMessages(nextMessages);
    setDraft('');
    setIsSending(true);
    setError(null);
    try {
      const result = await sendChat(
        {
          messages: nextMessages
            .slice(-CHAT_LIMITS.messages)
            .map(({ role, content }) => ({ role, content })),
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const message: UiChatMessage = {
        ...result.message,
        id: `assistant-${nextMessageIdRef.current++}`,
      };
      setMessages((current) => [...current, message]);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(
        cause instanceof Error
          ? cause.message
          : '답변을 불러올 수 없습니다. 다시 시도해 주세요.',
      );
    } finally {
      if (!controller.signal.aborted && controllerRef.current === controller) {
        controllerRef.current = null;
        setIsSending(false);
      }
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitMessage();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <aside
      id="trip-map-ai-panel"
      className={`trip-map-ai-panel${open ? ' is-open' : ''}`}
      aria-label="Trasolve AI 여행 도우미"
      aria-hidden={!open}
      inert={!open}
    >
      <header className="trip-map-ai-panel-header">
        <div>
          <h2>Trasolve AI</h2>
          <p>여행 도우미</p>
        </div>
        <div className="trip-map-ai-panel-actions">
          <button
            type="button"
            className="trip-map-ai-panel-export"
            aria-label="Markdown으로 저장"
            title="Markdown으로 저장"
            disabled={!messages.length}
            onClick={() => downloadChatMarkdown(messages)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" />
            </svg>
          </button>
          <button
            type="button"
            className="trip-map-ai-panel-close"
            aria-label="Close AI assistant"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </header>

      <div
        ref={messagesRef}
        className="trip-map-ai-messages"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <p className="trip-map-ai-message is-assistant">
          지도와 일정을 보면서 여행 계획을 도와드릴게요.
        </p>
        {messages.map((message) =>
          message.role === 'assistant' ? (
            <div key={message.id} className="trip-map-ai-message is-assistant">
              <ChatMarkdown content={message.content} />
            </div>
          ) : (
            <p key={message.id} className="trip-map-ai-message is-user">
              {message.content}
            </p>
          ),
        )}
        {isSending && (
          <p className="trip-map-ai-message is-assistant" role="status">
            <span className="sr-only">답변을 생각하고 있어요.</span>
            <span className="trip-map-ai-typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </p>
        )}
        {error && (
          <p className="trip-map-ai-message is-assistant" role="alert">
            {error}
          </p>
        )}
      </div>

      <form className="trip-map-ai-compose" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="trip-map-ai-input">
          AI 여행 도우미에게 메시지 보내기
        </label>
        <textarea
          ref={textareaRef}
          id="trip-map-ai-input"
          rows={1}
          maxLength={CHAT_LIMITS.messageLength}
          value={draft}
          placeholder="여행에 대해 물어보세요"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleComposerKeyDown}
        />
        <button type="submit" disabled={isSending || !draft.trim()}>
          전송
        </button>
      </form>
    </aside>
  );
}
