import { forwardRef, useCallback } from 'react';
import { useChatThreads } from '../model/useChatThreads';
import { useChatSubmission } from '../model/useChatSubmission';
import { useChatV2Transport } from '../model/useChatV2Transport';
import type { Props, MapAiPanelHandle } from '../model/chatTypes';
import { AiPanelFrame } from './AiPanelFrame';
import { ChatV2Header } from './v2/ChatV2Header';
import { ChatV2Sidebar } from './v2/ChatV2Sidebar';
import { ChatV2Messages } from './v2/ChatV2Messages';
import { ChatV2Composer } from './v2/ChatV2Composer';
import './chat-panel.css';
import './v2/chat-v2.css';

export const ChatPanelV2 = forwardRef<MapAiPanelHandle, Props>(
  function ChatPanelV2(props, ref) {
    const { singleSession = false } = props;
    const state = useChatThreads(props, ref, { autoScroll: false });
    const { pending, sendRequest } = useChatV2Transport();
    const submit = useChatSubmission({
      ...state,
      getRequestPreamble: props.getRequestPreamble,
      model: props.model,
      sendRequest,
    });
    const suggestion = useCallback(
      (text: string) => {
        state.changeDraft(text);
        state.textareaRef.current?.focus({ preventScroll: true });
      },
      [state.changeDraft, state.textareaRef],
    );
    return (
      <AiPanelFrame
        open={props.open}
        modal={props.modal ?? false}
        titleId={state.titleId}
        initialFocusRef={state.textareaRef}
        onClose={props.onClose}
        className="is-chat-v2"
      >
        <div
          className={`trip-ai-chat-layout chat-v2-layout${singleSession ? ' is-single-session' : ''}`}
        >
          {!singleSession && <ChatV2Sidebar {...state} />}
          <section
            className="trip-ai-conversation chat-v2-conversation"
            aria-label={state.L('ai:mapAiPanel.ariaLabel.currentConversation')}
          >
            <ChatV2Header
              titleId={state.titleId}
              messages={state.selectedThread.messages}
              singleSession={singleSession}
              listOpen={state.listDrawerOpen}
              onOpenList={() => state.setListDrawerOpen(true)}
              onClose={props.onClose}
            />
            {props.notice}
            <ChatV2Messages
              thread={state.selectedThread}
              pending={pending[state.selectedThread.id]}
              sending={state.selectedThreadSending}
              messagesRef={state.messagesRef}
              onSuggestion={suggestion}
              renderAssistantActions={props.renderAssistantActions}
            />
            <ChatV2Composer
              draft={state.draft}
              sending={state.selectedThreadSending}
              textareaRef={state.textareaRef}
              onDraftChange={state.changeDraft}
              onSend={submit}
              onStop={() =>
                state.cancelThreadRequest(
                  state.selectedThread.id,
                  'explicit-cancel',
                )
              }
            />
          </section>
        </div>
      </AiPanelFrame>
    );
  },
);
