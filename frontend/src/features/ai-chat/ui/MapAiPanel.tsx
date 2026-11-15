import type { Props } from './chatPanelTypes';
import { AiHeaderTokenBalance } from './AiHeaderTokenBalance';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { forwardRef, type FormEvent, type KeyboardEvent } from 'react';
import { CHAT_LIMITS } from '@trasolve/shared';

import { downloadChatMarkdown } from '@/features/ai-chat/lib/chatMarkdown';
import { ChatAssistantBody } from './ChatAssistantBody';
import { AiPanelFrame } from '@/features/ai-chat/ui/AiPanelFrame';

import { CloseIcon } from '@/shared/ui/icons';
import '@/features/ai-chat/ui/chat-panel.css';

import {
  type MapAiPanelHandle,
  type ChatThread,
} from '@/features/ai-chat/model/chatTypes';

export {
  type ChatRequestPreamble,
  type MapAiUnreadPreview,
  type MapAiPanelHandle,
} from '@/features/ai-chat/model/chatTypes';

import { useChatPanel } from './useChatPanel';
import { useChatSubmission } from '../model/useChatSubmission';
import { ChatThreadItem } from './ChatThreadItem';
import { ChatPanelV2 } from './ChatPanelV2';
import { opts } from '@/shared/config/opts';
import { isDebugMode } from '@/shared/config/debugMode';

export const MapAiPanel = forwardRef<MapAiPanelHandle, Props>(
  function MapAiPanel(props, ref) {
    return opts.useChatV2 ? (
      <ChatPanelV2 {...props} ref={ref} />
    ) : (
      <LegacyMapAiPanel {...props} ref={ref} />
    );
  },
);

const LegacyMapAiPanel = forwardRef<MapAiPanelHandle, Props>(
  function MapAiPanel(props, ref) {
    const debugMode = isDebugMode(window.location.search);
    const {
      open,
      modal = false,
      singleSession = false,
      model,
      onClose,
      getRequestPreamble,
      renderAssistantActions,
      notice,
    } = props;
    const state = useChatPanel(props, ref);
    const {
      changeDraft,
      cancelRename,
      toggleThreadMenu,
      cancelCreation,
      searchQuery,
      setSearchQuery,
      selectedThreadSending,
      L,
      titleId,
      sendingThreadIds,
      cancelThreadRequest,
      selectedThread,
      draft,
      recentThreads,
      archivedThreads,
      textareaRef,
      messagesRef,
      openMenuThreadId,
      renamingThreadId,
      renameDraft,
      setRenameDraft,
      listDrawerOpen,
      setListDrawerOpen,
      createNewThread,
      selectThread,
      beginRename,
      commitRename,
      setArchived,
      deleteThread,
    } = state;
    const submitMessage = useChatSubmission({
      ...state,
      getRequestPreamble,
      model,
    });
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submitMessage();
    };

    const handleComposerKeyDown = (
      event: KeyboardEvent<HTMLTextAreaElement>,
    ) => {
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

    const renderThread = (thread: ChatThread) => (
      <ChatThreadItem
        key={thread.id}
        thread={thread}
        selected={thread.id === selectedThread.id}
        sending={sendingThreadIds.has(thread.id)}
        renaming={thread.id === renamingThreadId}
        menuOpen={thread.id === openMenuThreadId}
        renameDraft={renameDraft}
        onSelect={selectThread}
        onBeginRename={beginRename}
        onCommitRename={commitRename}
        onRenameDraftChange={setRenameDraft}
        onCancelRename={cancelRename}
        onToggleMenu={toggleThreadMenu}
        onCancelRequest={cancelCreation}
        onSetArchived={setArchived}
        onDelete={deleteThread}
      />
    );

    return (
      <AiPanelFrame
        open={open}
        modal={modal}
        titleId={titleId}
        initialFocusRef={textareaRef}
        onClose={onClose}
      >
        <div
          className={`trip-ai-chat-layout${singleSession ? ' is-single-session' : ''}`}
        >
          {!singleSession && listDrawerOpen && (
            <button
              type="button"
              className="trip-ai-chat-list-backdrop"
              aria-label={L('ai:mapAiPanel.ariaLabel.closeChatList')}
              onClick={() => setListDrawerOpen(false)}
            />
          )}
          {!singleSession && (
            <aside
              id="trip-ai-chat-list"
              className={`trip-ai-chat-list${listDrawerOpen ? ' is-mobile-open' : ''}`}
              aria-label={L('ai:mapAiPanel.ariaLabel.aiChatList')}
            >
              <header className="trip-ai-chat-list-header">
                <h2>{L('ai:mapAiPanel.title.trasolveAi')}</h2>
                <button type="button" onClick={createNewThread}>
                  <span aria-hidden="true">＋</span>
                  {L('ai:mapAiPanel.createThread.title.newChat')}
                </button>
              </header>
              <label className="trip-ai-chat-search">
                <span className="sr-only">
                  {L('ai:mapAiPanel.text.chatSearch')}
                </span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m15.5 15.5 5 5" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  placeholder={L('ai:mapAiPanel.text.chatSearch')}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>
              <ScrollArea
                className="trip-ai-chat-list-content"
                contentClassName="trip-ai-chat-list-content-content"
              >
                <section aria-labelledby="trip-ai-recent-chats-title">
                  <h3 id="trip-ai-recent-chats-title">
                    {L('ai:mapAiPanel.title.recentConversations')}
                  </h3>
                  {recentThreads.length ? (
                    <ul>{recentThreads.map(renderThread)}</ul>
                  ) : (
                    <p className="trip-ai-chat-list-empty">
                      {L('ai:mapAiPanel.description.thereNoDialogue')}
                    </p>
                  )}
                </section>
                {!!archivedThreads.length && (
                  <section aria-labelledby="trip-ai-archived-chats-title">
                    <h3 id="trip-ai-archived-chats-title">
                      {L('ai:mapAiPanel.title.archived')}
                    </h3>
                    <ul>{archivedThreads.map(renderThread)}</ul>
                  </section>
                )}
              </ScrollArea>
            </aside>
          )}

          <section
            className="trip-ai-conversation"
            aria-label={L('ai:mapAiPanel.ariaLabel.currentConversation')}
          >
            <header className="trip-map-ai-panel-header">
              {!singleSession && (
                <button
                  type="button"
                  className="trip-ai-chat-list-toggle"
                  aria-label={L('ai:mapAiPanel.ariaLabel.openChatList')}
                  aria-controls="trip-ai-chat-list"
                  aria-expanded={listDrawerOpen}
                  onClick={() => setListDrawerOpen(true)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                </button>
              )}
              <div>
                <h2 id={titleId}>{L('ai:mapAiPanel.title.aiPlanner')}</h2>
                <p>{L('ai:mapAiPanel.description.travelAssistant')}</p>
              </div>
              {onClose && (
                <div className="trip-map-ai-panel-actions">
                  {debugMode && (
                    <button
                      type="button"
                      className="trip-map-ai-panel-export"
                      aria-label={L('ai:mapAiPanel.ariaLabel.saveAsMarkdown')}
                      title={L('ai:mapAiPanel.ariaLabel.saveAsMarkdown')}
                      disabled={!selectedThread.messages.length}
                      onClick={() =>
                        downloadChatMarkdown(selectedThread.messages)
                      }
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    className="trip-map-ai-panel-close"
                    aria-label={L('ai:mapAiPanel.ariaLabel.closeAiAssistant')}
                    onClick={onClose}
                  >
                    <CloseIcon />
                  </button>
                </div>
              )}
              <AiHeaderTokenBalance />
            </header>

            {notice}

            <ScrollArea
              viewportRef={messagesRef}
              className="trip-map-ai-messages"
              contentClassName="trip-map-ai-messages-content"
              viewportProps={{
                role: 'log',
                'aria-live': 'polite',
                'aria-relevant': 'additions',
              }}
            >
              {!selectedThread.messages.length && (
                <p className="trip-map-ai-message is-assistant">
                  {L('ai:mapAiPanel.description.weWillHelpYouPlanTrip')}
                </p>
              )}
              {selectedThread.messages.map((message) =>
                message.role === 'assistant' ? (
                  <div
                    key={message.id}
                    className="trip-map-ai-message is-assistant"
                  >
                    <ChatAssistantBody
                      content={message.content}
                      context={message.requestContext}
                      renderActions={renderAssistantActions}
                    />
                  </div>
                ) : (
                  <p key={message.id} className="trip-map-ai-message is-user">
                    {message.content}
                  </p>
                ),
              )}
              {selectedThreadSending && (
                <p className="trip-map-ai-message is-assistant" role="status">
                  <span className="sr-only">
                    {L('ai:mapAiPanel.text.iMThinkingAnswer')}
                  </span>
                  <span className="trip-map-ai-typing-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </p>
              )}
              {selectedThread.error && (
                <p className="trip-map-ai-message is-assistant" role="alert">
                  {selectedThread.error}
                </p>
              )}
            </ScrollArea>

            <form
              className="trip-map-ai-compose"
              aria-busy={selectedThreadSending}
              onSubmit={handleSubmit}
            >
              {singleSession && selectedThreadSending && (
                <button
                  type="button"
                  onClick={() =>
                    cancelThreadRequest(selectedThread.id, 'explicit-cancel')
                  }
                >
                  {L('common:action.cancel')}
                </button>
              )}
              <label className="sr-only" htmlFor="trip-map-ai-input">
                {L('ai:mapAiPanel.label.sendMessageAiTravelAssistant')}
              </label>
              <textarea
                ref={textareaRef}
                id="trip-map-ai-input"
                rows={1}
                maxLength={CHAT_LIMITS.messageLength}
                value={draft}
                placeholder={L('ai:mapAiPanel.placeholder.askAboutTravel')}
                onChange={(event) => changeDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
              />
              <button
                type="submit"
                disabled={selectedThreadSending || !draft.trim()}
              >
                {selectedThreadSending
                  ? L('ai:mapAiPanel.action.creating')
                  : L('ai:mapAiPanel.action.transfer')}
              </button>
            </form>
          </section>
        </div>
      </AiPanelFrame>
    );
  },
);
