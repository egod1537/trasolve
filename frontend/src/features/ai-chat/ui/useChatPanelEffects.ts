import { useEffect, useRef } from 'react';
type Props = {
  open: boolean;
  selectedThreadId: string;
  activeThreadId: string;
  messageCount: number;
  messageError: string | null;
  selectedThreadSending: boolean;
  openMenuThreadId: string | null;
  setOpenMenuThreadId: (id: string | null) => void;
};
export function useChatPanelEffects({
  open,
  selectedThreadId,
  activeThreadId,
  messageCount,
  messageError,
  selectedThreadSending,
  openMenuThreadId,
  setOpenMenuThreadId,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      textareaRef.current?.focus({ preventScroll: true });
    }
  }, [open, selectedThreadId]);
  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [activeThreadId, messageCount, messageError, selectedThreadSending, open]);
  useEffect(() => {
    if (!openMenuThreadId) {
      return;
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest('.trip-ai-chat-item-more')
      ) {
        setOpenMenuThreadId(null);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuThreadId(null);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openMenuThreadId, setOpenMenuThreadId]);
  return { textareaRef, messagesRef };
}
