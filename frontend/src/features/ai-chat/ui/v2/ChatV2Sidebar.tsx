import { ScrollArea } from '@/shared/ui/ScrollArea';
import type { useChatPanel } from '../useChatPanel';
import { ChatThreadItem } from '../ChatThreadItem';
import type { ChatThread } from '../../model/chatTypes';

type Props = Pick<
  ReturnType<typeof useChatPanel>,
  | 'L'
  | 'listDrawerOpen'
  | 'setListDrawerOpen'
  | 'createNewThread'
  | 'searchQuery'
  | 'setSearchQuery'
  | 'recentThreads'
  | 'archivedThreads'
  | 'selectedThread'
  | 'sendingThreadIds'
  | 'renamingThreadId'
  | 'openMenuThreadId'
  | 'renameDraft'
  | 'selectThread'
  | 'beginRename'
  | 'commitRename'
  | 'setRenameDraft'
  | 'cancelRename'
  | 'toggleThreadMenu'
  | 'cancelCreation'
  | 'setArchived'
  | 'deleteThread'
>;

export function ChatV2Sidebar(props: Props) {
  const { L } = props;
  const renderThread = (thread: ChatThread) => (
    <ChatThreadItem
      key={thread.id}
      thread={thread}
      selected={thread.id === props.selectedThread.id}
      sending={props.sendingThreadIds.has(thread.id)}
      renaming={thread.id === props.renamingThreadId}
      menuOpen={thread.id === props.openMenuThreadId}
      renameDraft={props.renameDraft}
      onSelect={props.selectThread}
      onBeginRename={props.beginRename}
      onCommitRename={props.commitRename}
      onRenameDraftChange={props.setRenameDraft}
      onCancelRename={props.cancelRename}
      onToggleMenu={props.toggleThreadMenu}
      onCancelRequest={props.cancelCreation}
      onSetArchived={props.setArchived}
      onDelete={props.deleteThread}
    />
  );
  return (
    <>
      {props.listDrawerOpen && (
        <button
          type="button"
          className="trip-ai-chat-list-backdrop"
          aria-label={L('ai:mapAiPanel.ariaLabel.closeChatList')}
          onClick={() => props.setListDrawerOpen(false)}
        />
      )}
      <aside
        id="trip-ai-chat-list"
        className={`trip-ai-chat-list${props.listDrawerOpen ? ' is-mobile-open' : ''}`}
        aria-label={L('ai:mapAiPanel.ariaLabel.aiChatList')}
      >
        <header className="trip-ai-chat-list-header">
          <h2>{L('ai:mapAiPanel.title.trasolveAi')}</h2>
          <button type="button" onClick={props.createNewThread}>
            <span aria-hidden="true">＋</span>
            {L('ai:mapAiPanel.createThread.title.newChat')}
          </button>
        </header>
        <label className="trip-ai-chat-search chat-v2-search">
          <span className="sr-only">{L('ai:mapAiPanel.text.chatSearch')}</span>
          <input
            type="search"
            value={props.searchQuery}
            placeholder={L('ai:mapAiPanel.text.chatSearch')}
            onChange={(event) => props.setSearchQuery(event.target.value)}
          />
        </label>
        <ScrollArea
          className="trip-ai-chat-list-content"
          contentClassName="trip-ai-chat-list-content-content"
        >
          <section aria-label={L('ai:mapAiPanel.title.recentConversations')}>
            <h3>{L('ai:mapAiPanel.title.recentConversations')}</h3>
            {props.recentThreads.length ? (
              <ul>{props.recentThreads.map(renderThread)}</ul>
            ) : (
              <p className="trip-ai-chat-list-empty">
                {L('ai:mapAiPanel.description.thereNoDialogue')}
              </p>
            )}
          </section>
          {!!props.archivedThreads.length && (
            <section aria-label={L('ai:mapAiPanel.title.archived')}>
              <h3>{L('ai:mapAiPanel.title.archived')}</h3>
              <ul>{props.archivedThreads.map(renderThread)}</ul>
            </section>
          )}
        </ScrollArea>
      </aside>
    </>
  );
}
