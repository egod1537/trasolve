import { useCallback, useState } from 'react';
import type { Localize } from '@/shared/i18n';
import type { ChatThreadState } from '../model/useChatThreads';
import type { ChatThread } from '../model/chatTypes';
import type { useThreadRequests } from '../model/useThreadRequests';
import { createChatThreadActions } from '../model/chatThreadActions';
import { getThreadTitle } from './chatPresentation';

export function useChatThreadControls(
  state: ChatThreadState,
  cancelThreadRequest: ReturnType<
    typeof useThreadRequests
  >['cancelThreadRequest'],
  L: Localize,
) {
  const [openMenuThreadId, setOpenMenuThreadId] = useState<string | null>(null);
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [listDrawerOpen, setListDrawerOpen] = useState(false);
  const edits = createChatThreadActions(state);
  const { changeSelectedThread, markThreadRead } = state;
  const closeThreadOverlays = useCallback(() => {
    setOpenMenuThreadId(null);
    setRenamingThreadId(null);
    setListDrawerOpen(false);
  }, []);
  const selectThread = useCallback(
    (id: string) => {
      changeSelectedThread(id);
      markThreadRead(id);
      closeThreadOverlays();
    },
    [changeSelectedThread, markThreadRead, closeThreadOverlays],
  );
  const createNewThread = () => {
    edits.createNewThread();
    closeThreadOverlays();
  };
  const beginRename = (thread: ChatThread) => {
    setRenamingThreadId(thread.id);
    setRenameDraft(getThreadTitle(thread, L));
    setOpenMenuThreadId(null);
  };
  const cancelRename = () => {
    setRenamingThreadId(null);
    setRenameDraft('');
  };
  const commitRename = (id: string) => {
    if (!renameDraft.trim()) {
      return;
    }
    edits.renameThread(id, renameDraft);
    cancelRename();
  };
  const setArchived = (id: string, archived: boolean) => {
    edits.setArchived(id, archived);
    setOpenMenuThreadId(null);
  };
  const deleteThread = (id: string) => {
    cancelThreadRequest(id, 'thread-deleted');
    edits.deleteThread(id);
    setOpenMenuThreadId(null);
    setRenamingThreadId(null);
  };
  const cancelCreation = (id: string) => {
    cancelThreadRequest(id, 'explicit-cancel');
    setOpenMenuThreadId(null);
  };
  const toggleThreadMenu = (id: string) =>
    setOpenMenuThreadId((current) => (current === id ? null : id));
  return {
    openMenuThreadId,
    setOpenMenuThreadId,
    renamingThreadId,
    setRenamingThreadId,
    renameDraft,
    setRenameDraft,
    listDrawerOpen,
    setListDrawerOpen,
    selectThread,
    createNewThread,
    beginRename,
    commitRename,
    cancelRename,
    setArchived,
    deleteThread,
    cancelCreation,
    toggleThreadMenu,
  };
}
