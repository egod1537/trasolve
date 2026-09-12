const MAX_DELAY_MS = 2_147_483_647;

export type DebugDelayCommand =
  | { kind: 'none' }
  | { kind: 'invalid'; error: string }
  | { kind: 'valid'; delayMs: number; prompt: string };

export function parseDebugDelayCommand(content: string): DebugDelayCommand {
  if (!import.meta.env.DEV) return { kind: 'none' };

  const normalized = content.trim();
  if (!/^\/delay(?:\s|$)/.test(normalized)) return { kind: 'none' };

  const match = normalized.match(/^\/delay\s+(\S+)(?:\s+([\s\S]+))?$/);
  const millisecondsToken = match?.[1];
  const prompt = match?.[2]?.trim();
  if (!millisecondsToken || !/^\d+$/.test(millisecondsToken) || !prompt) {
    return {
      kind: 'invalid',
      error: '사용법: /delay <0 이상의 정수 ms> <질문>',
    };
  }

  const delayMs = Number(millisecondsToken);
  if (!Number.isSafeInteger(delayMs) || delayMs > MAX_DELAY_MS) {
    return {
      kind: 'invalid',
      error: `지연 시간은 0~${MAX_DELAY_MS}ms 사이의 정수여야 합니다.`,
    };
  }
  return { kind: 'valid', delayMs, prompt };
}

export function waitForDebugDelay(
  delayMs: number,
  signal: AbortSignal,
): Promise<void> {
  if (delayMs === 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delayMs);
    const abort = () => {
      window.clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException('지연 요청이 취소되었습니다.', 'AbortError'),
      );
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}
