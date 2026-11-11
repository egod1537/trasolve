// Share only unfinished requests. Completed responses are never cached here.
type Entry<T> = {
  controller: AbortController;
  promise: Promise<T>;
  consumers: number;
  settled: boolean;
};

export function createRequestCoalescer<T>() {
  const pending = new Map<string, Entry<T>>();
  return (
    key: string,
    load: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> => {
    if (signal?.aborted) {
      return Promise.reject(signal.reason);
    }
    let entry = pending.get(key);
    if (!entry) {
      const controller = new AbortController();
      const created: Entry<T> = {
        controller,
        consumers: 0,
        settled: false,
        promise: Promise.resolve().then(() => {
          controller.signal.throwIfAborted();
          return load(controller.signal);
        }),
      };
      created.promise = created.promise.finally(() => {
        created.settled = true;
        if (pending.get(key) === created) {
          pending.delete(key);
        }
      });
      entry = created;
      pending.set(key, entry);
    }
    const request = entry;
    request.consumers += 1;
    return new Promise<T>((resolve, reject) => {
      let released = false;
      const release = () => {
        if (released) {
          return false;
        }
        released = true;
        signal?.removeEventListener('abort', abort);
        request.consumers -= 1;
        if (!request.consumers && !request.settled) {
          if (pending.get(key) === request) {
            pending.delete(key);
          }
          request.controller.abort();
        }
        return true;
      };
      const abort = () => {
        if (release()) {
          reject(signal?.reason);
        }
      };
      signal?.addEventListener('abort', abort, { once: true });
      request.promise.then(
        (value) => {
          if (release()) {
            resolve(value);
          }
        },
        (error: unknown) => {
          if (release()) {
            reject(error);
          }
        },
      );
    });
  };
}
