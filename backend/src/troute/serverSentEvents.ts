export type ServerSentEvent = {
  event: string;
  data: string;
  id?: string;
  lastEventId: string;
  retry?: number;
};

export async function* parseServerSentEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ServerSentEvent> {
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';
  let eventId: string | undefined;
  let lastEventId = '';
  let retry: number | undefined;
  let dataLines: string[] = [];
  let firstChunk = true;

  const dispatch = (): ServerSentEvent | null => {
    if (dataLines.length === 0) {
      eventName = '';
      eventId = undefined;
      retry = undefined;
      return null;
    }
    if (eventId !== undefined) {
      lastEventId = eventId;
    }
    const event: ServerSentEvent = {
      event: eventName || 'message',
      data: dataLines.join('\n'),
      lastEventId,
      ...(eventId === undefined ? {} : { id: eventId }),
      ...(retry === undefined ? {} : { retry }),
    };
    eventName = '';
    eventId = undefined;
    retry = undefined;
    dataLines = [];
    return event;
  };
  const processLine = (line: string): ServerSentEvent | null => {
    if (line === '') {
      return dispatch();
    }
    if (line.startsWith(':')) {
      return null;
    }
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    switch (field) {
      case 'event':
        eventName = value;
        break;
      case 'data':
        dataLines.push(value);
        break;
      case 'id':
        if (!value.includes('\0')) {
          eventId = value;
        }
        break;
      case 'retry':
        if (/^\d+$/.test(value)) {
          retry = Number(value);
        }
        break;
    }
    return null;
  };

  for await (const chunk of stream) {
    let decoded = decoder.decode(chunk, { stream: true });
    if (firstChunk) {
      firstChunk = false;
      decoded = decoded.replace(/^\uFEFF/, '');
    }
    buffer += decoded;
    while (true) {
      const boundary = findLineBoundary(buffer);
      if (!boundary) {
        break;
      }
      const line = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary.length);
      const event = processLine(line);
      if (event) {
        yield event;
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.endsWith('\r')) {
    buffer = buffer.slice(0, -1);
  }
  if (buffer) {
    const event = processLine(buffer);
    if (event) {
      yield event;
    }
  }
  const trailingEvent = dispatch();
  if (trailingEvent) {
    yield trailingEvent;
  }
}

function findLineBoundary(
  value: string,
): { index: number; length: number } | null {
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '\n') {
      return { index, length: 1 };
    }
    if (character === '\r') {
      if (index === value.length - 1) {
        return null;
      }
      return {
        index,
        length: value[index + 1] === '\n' ? 2 : 1,
      };
    }
  }
  return null;
}
