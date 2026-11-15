/** Incremental SSE framing shared by the browser and upstream provider. */
export async function* readSseData(
  body: {
    getReader(): {
      read(): Promise<{ done: boolean; value?: Uint8Array }>;
      cancel(): Promise<unknown>;
      releaseLock(): void;
    };
  },
  decoder: {
    decode(value?: Uint8Array, options?: { stream: boolean }): string;
  },
): AsyncGenerator<string> {
  const reader = body.getReader();
  let buffer = '';
  try {
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      if (buffer.length > 1_000_000) {
        throw new Error('SSE frame exceeds the size limit');
      }
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n');
        if (data) {
          yield data;
        }
      }
      if (chunk.done) {
        if (buffer.trim()) {
          throw new Error('SSE stream ended with an incomplete frame');
        }
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
