import {
  validateWorkspaceCommand,
  type WorkspaceCommandRequest,
} from '@trasolve/shared';
export type CommandItem = {
  label: string;
  detail?: string;
  command?: WorkspaceCommandRequest;
};
export type CommandOutput = {
  items?: CommandItem[];
  data?: unknown;
  text?: string;
  handoff?: boolean;
  expectedTrip?: string;
};
export type CommandHandler = (
  args: WorkspaceCommandRequest['args'],
  signal: AbortSignal,
) => CommandOutput | Promise<CommandOutput>;
export type CommandHandlers = Record<string, CommandHandler>;
export type CommandRecord = {
  id: number;
  request: WorkspaceCommandRequest;
  status: 'running' | 'success' | 'error' | 'cancelled';
  output?: CommandOutput;
  error?: string;
};
export function createCommandRuntime() {
  const bindings = new Map<
    string,
    { owner: object; handler: CommandHandler }
  >();
  const listeners = new Set<() => void>();
  let records: readonly CommandRecord[] = [];
  let nextId = 0;
  let departureGuard: (() => Promise<boolean>) | null = null;
  let active: { name: string; owner: object; abort: AbortController } | null =
    null;
  const publish = () => {
    for (const listener of listeners) {
      listener();
    }
  };
  return {
    getSnapshot: () => records,
    guardNavigation(guard: () => Promise<boolean>) {
      departureGuard = guard;
      return () => {
        if (departureGuard === guard) {
          departureGuard = null;
        }
      };
    },
    async beforeNavigate() {
      if (departureGuard && !(await departureGuard())) {
        throw new Error('SAVE_NOT_CONFIRMED');
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    available: (name: string) => bindings.has(name) || name === 'help',
    cancel: () => active?.abort.abort(),
    bind(handlers: CommandHandlers) {
      const owner = {};
      for (const [name, handler] of Object.entries(handlers)) {
        bindings.set(name, { owner, handler });
      }
      publish();
      return () => {
        if (active?.owner === owner) {
          active.abort.abort();
        }
        for (const [name, entry] of bindings) {
          if (entry.owner === owner) {
            bindings.delete(name);
          }
        }
      };
    },
    async execute(
      input: WorkspaceCommandRequest,
      signal?: AbortSignal,
    ): Promise<CommandOutput> {
      const request = validateWorkspaceCommand(input);
      if (request.name === 'ai stop') {
        const stopped = active?.name === 'ai';
        if (stopped) {
          active?.abort.abort();
        }
        return { data: { stopped } };
      }
      if (active) {
        throw new Error('COMMAND_BUSY');
      }
      const binding = bindings.get(request.name);
      if (!binding) {
        throw new Error('COMMAND_UNAVAILABLE');
      }
      const abort = new AbortController();
      const execution = { name: request.name, owner: binding.owner, abort };
      active = execution;
      const combined = signal
        ? AbortSignal.any([abort.signal, signal])
        : abort.signal;
      const id = ++nextId;
      records = [...records.slice(-19), { id, request, status: 'running' }];
      publish();
      try {
        combined.throwIfAborted();
        const output = await binding.handler(request.args, combined);
        combined.throwIfAborted();
        records = records.map((r) =>
          r.id === id ? { ...r, status: 'success', output } : r,
        );
        return output;
      } catch (error) {
        records = records.map((r) =>
          r.id === id
            ? {
                ...r,
                status: combined.aborted ? 'cancelled' : 'error',
                error:
                  error instanceof Error ? error.message : 'COMMAND_FAILED',
              }
            : r,
        );
        throw error;
      } finally {
        if (active === execution) {
          active = null;
        }
        publish();
      }
    },
  };
}
export type CommandRuntime = ReturnType<typeof createCommandRuntime>;
