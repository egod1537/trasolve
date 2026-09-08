import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
};

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
};

const initialMessages: ChatMessage[] = [
  {
    id: 'assistant-welcome',
    role: 'assistant',
    content: '지도와 일정을 보면서 여행 계획을 도와드릴게요.',
  },
];

export function MapAiPanel({ open, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const nextMessageIdRef = useRef(1);

  useEffect(() => {
    if (open) textareaRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const submitMessage = () => {
    const content = draft.trim();
    if (!content) return;

    setMessages((current) => [
      ...current,
      {
        id: `user-${nextMessageIdRef.current++}`,
        role: 'user',
        content,
      },
    ]);
    setDraft('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMessage();
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
      </header>

      <div
        ref={messagesRef}
        className="trip-map-ai-messages"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((message) => (
          <p
            key={message.id}
            className={`trip-map-ai-message is-${message.role}`}
          >
            {message.content}
          </p>
        ))}
      </div>

      <form className="trip-map-ai-compose" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="trip-map-ai-input">
          AI 여행 도우미에게 메시지 보내기
        </label>
        <textarea
          ref={textareaRef}
          id="trip-map-ai-input"
          rows={1}
          value={draft}
          placeholder="여행에 대해 물어보세요"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleComposerKeyDown}
        />
        <button type="submit" disabled={!draft.trim()}>
          전송
        </button>
      </form>
    </aside>
  );
}
