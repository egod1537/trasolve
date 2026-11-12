import { ScrollArea } from '@/shared/ui/ScrollArea';
import {
  memo,
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useL } from '@/shared/i18n';
import type { ChatThread, UiChatMessage } from '../../model/chatTypes';
import type { PendingChatResponse } from '../../model/useChatV2Transport';
import { ChatMarkdown } from '../ChatMarkdown';
import { ChatV2Progress } from './ChatV2Progress';
import { ChatWebImages } from './ChatWebImages';
import { ChatV2QuickNav } from './ChatV2QuickNav';
import { useChatMessageNavigation } from './useChatMessageNavigation';

type Props = {
  thread: ChatThread;
  pending?: PendingChatResponse;
  sending: boolean;
  messagesRef: RefObject<HTMLDivElement | null>;
  onSuggestion: (text: string) => void;
  renderAssistantActions?: (content: string, context?: string) => ReactNode;
};

export const ChatV2Messages = memo(function ChatV2Messages({
  thread,
  pending,
  sending,
  messagesRef,
  onSuggestion,
  renderAssistantActions,
}: Props) {
  const L = useL();
  const navigation = useChatMessageNavigation(thread.messages, messagesRef);
  const { pinned } = navigation;
  useLayoutEffect(() => {
    const container = messagesRef.current;
    if (container && pinned.current) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'instant' });
    }
  }, [
    pending?.content,
    pending?.summary,
    thread.id,
    thread.messages.length,
    sending,
    messagesRef,
    pinned,
  ]);
  const lastMessage = thread.messages.at(-1);
  return (
    <div
      className={`chat-v2-message-region${navigation.questions.length > 1 ? ' has-quick-nav' : ''}`}
    >
      <ScrollArea
        viewportRef={messagesRef}
        className="chat-v2-messages"
        contentClassName="chat-v2-messages-content"
        onPointerDown={navigation.onUserScroll}
        viewportProps={{
          role: 'log',
          'aria-live': 'polite',
          'aria-busy': sending,
          onWheel: (event) => {
            if (event.deltaY !== 0) {
              navigation.onUserScroll();
            }
          },
          onTouchStart: navigation.onUserScroll,
          onKeyDown: (event) => {
            if (
              [
                'ArrowUp',
                'ArrowDown',
                'PageUp',
                'PageDown',
                'Home',
                'End',
                ' ',
              ].includes(event.key)
            ) {
              navigation.onUserScroll();
            }
          },
          onScroll: navigation.onScroll,
        }}
      >
        {!thread.messages.length && (
          <div className="chat-v2-welcome">
            <span className="chat-v2-welcome-mark" aria-hidden="true">
              ✦
            </span>
            <h3>{L('ai:mapAiPanel.description.travelAssistant')}</h3>
            <p>{L('ai:mapAiPanel.description.weWillHelpYouPlanTrip')}</p>
            <div className="chat-v2-suggestions">
              <button
                type="button"
                onClick={() =>
                  onSuggestion(L('auth:tokenPlans.feature.aiItinerary'))
                }
              >
                {L('auth:tokenPlans.feature.aiItinerary')}
              </button>
              <button
                type="button"
                onClick={() =>
                  onSuggestion(
                    L('auth:tokenPlans.feature.personalizedSuggestions'),
                  )
                }
              >
                {L('auth:tokenPlans.feature.personalizedSuggestions')}
              </button>
            </div>
          </div>
        )}
        {thread.messages.map((message) => (
          <ChatV2Message
            key={message.id}
            message={message}
            current={
              navigation.questions.length > 1 &&
              message.id === navigation.activeId
            }
            renderAssistantActions={renderAssistantActions}
          />
        ))}
        {sending && (
          <article className="chat-v2-message is-assistant is-pending">
            <ChatV2Progress
              busy
              summary={pending?.summary}
              waiting={!pending || pending.stage === 'waiting'}
            />
            {pending?.content && <ChatMarkdown content={pending.content} />}
          </article>
        )}
        {!sending &&
          lastMessage?.role === 'assistant' &&
          !!lastMessage.followUps?.length && (
            <div className="chat-v2-suggestions">
              {lastMessage.followUps.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onSuggestion(suggestion)}
                >
                  {suggestion}
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          )}
        {thread.error && (
          <div className="chat-v2-error" role="alert">
            <p>{thread.error}</p>
          </div>
        )}
      </ScrollArea>
      <ChatV2QuickNav
        questions={navigation.questions}
        activeId={navigation.activeId}
        onJump={navigation.jump}
      />
    </div>
  );
});

const ChatV2Message = memo(function ChatV2Message({
  message,
  current,
  renderAssistantActions,
}: {
  message: UiChatMessage;
  current: boolean;
  renderAssistantActions?: Props['renderAssistantActions'];
}) {
  const L = useL();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  if (message.role !== 'assistant') {
    return (
      <p
        data-chat-question={message.id}
        className={`chat-v2-message is-user${current ? ' is-current-question' : ''}`}
      >
        {message.content}
      </p>
    );
  }
  return (
    <article className="chat-v2-message is-assistant">
      <ChatV2Progress summary={message.summary} />
      <ChatMarkdown content={message.content} />
      <ChatWebImages images={message.webImages} />
      {renderAssistantActions?.(message.content, message.requestContext)}
      <div className="chat-v2-message-actions">
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={L('common:action.copy')}
          title={L('common:action.copy')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {copied ? (
              <path d="m5 12 4 4L19 6" />
            ) : (
              <>
                <rect x="8" y="8" width="12" height="12" rx="2" />
                <path d="M16 8V4H4v12h4" />
              </>
            )}
          </svg>
        </button>
      </div>
    </article>
  );
});
