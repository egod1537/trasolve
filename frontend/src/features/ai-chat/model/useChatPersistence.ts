import { useEffect, useLayoutEffect, useMemo } from 'react';
import type { UiChatMessage } from './chatTypes';

type Snapshot = { messages: readonly UiChatMessage[]; draft: string };

// Each key owns its latest snapshot. Effect cleanup on a keystroke only cancels
// the timer; leaving the session, hiding the tab or pagehide flushes the draft.
function createWriter(key: string | undefined) {
  let latest: Snapshot | null = null;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const flush = () => {
    cancel();
    if (!key || !latest || !dirty) {
      return;
    }
    try {
      sessionStorage.setItem(key, JSON.stringify({ version: 1, ...latest }));
      dirty = false;
    } catch {
      /* The live conversation remains usable when storage is full. */
    }
  };
  return {
    update(snapshot: Snapshot) {
      latest = snapshot;
      dirty = true;
    },
    schedule() {
      cancel();
      if (key) {
        timer = setTimeout(flush, 300);
      }
    },
    cancel,
    flush,
  };
}

export function useChatPersistence(
  key: string | undefined,
  messages: readonly UiChatMessage[],
  draft: string,
) {
  const writer = useMemo(() => createWriter(key), [key]);
  useLayoutEffect(() => {
    writer.update({ messages, draft });
  }, [writer, messages, draft]);
  useEffect(() => {
    writer.schedule();
    return writer.cancel;
  }, [writer, messages, draft]);
  useEffect(() => {
    if (!key) {
      return;
    }
    const hide = () => {
      if (document.hidden) {
        writer.flush();
      }
    };
    window.addEventListener('pagehide', writer.flush);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pagehide', writer.flush);
      document.removeEventListener('visibilitychange', hide);
      writer.flush();
    };
  }, [writer, key]);
}
