import {
  isTrouteJobTerminalStatus,
  type TrouteJobState,
} from '@trasolve/shared';
import {
  type TrouteJobEvent,
  type TrouteJobEventType,
  TrouteClient,
} from '../../troute/trouteClient.js';
import {
  TrouteJobRepository,
  type TrouteJobMirrorSnapshot,
} from './trouteJobRepository.js';

const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 5_000] as const;

export type PublishedTrouteJobEvent = {
  type: TrouteJobEventType;
  state: TrouteJobState;
  updatedAt: number;
  eventId?: string;
  sequence?: number;
};

export type TrouteJobEventSubscriber = (event: PublishedTrouteJobEvent) => void;

type JobChannel = {
  jobId: string;
  subscribers: Set<TrouteJobEventSubscriber>;
  controller: AbortController;
  seenEventIds: Set<string>;
  initialization: Promise<void> | null;
  task: Promise<void> | null;
  pinned: boolean;
  lastEventId: string;
  lastSequence: number | null;
};

export class JobEventSubscriptionManager {
  public constructor(
    private readonly jobs: TrouteJobRepository,
    private readonly client: TrouteClient,
  ) {}

  public async track(jobId: string): Promise<void> {
    const channel = this.getOrCreateChannel(jobId);
    channel.pinned = true;
    await this.initializeChannel(channel);
    this.startChannel(channel);
  }

  public async subscribe(
    jobId: string,
    subscriber: TrouteJobEventSubscriber,
  ): Promise<() => void> {
    const channel = this.getOrCreateChannel(jobId);
    let ready = false;
    const pending: PublishedTrouteJobEvent[] = [];
    const bufferedSubscriber: TrouteJobEventSubscriber = (event) => {
      if (ready) {
        subscriber(event);
      } else {
        pending.push(event);
      }
    };
    channel.subscribers.add(bufferedSubscriber);

    try {
      await this.initializeChannel(channel);
      subscriber(this.toPublishedSnapshot(this.jobs.getMirrorSnapshot(jobId)));
      ready = true;
      for (const event of pending) {
        subscriber(event);
      }
      pending.length = 0;
      this.startChannel(channel);
    } catch (cause) {
      channel.subscribers.delete(bufferedSubscriber);
      this.stopUnusedChannel(channel);
      throw cause;
    }

    let subscribed = true;
    return () => {
      if (!subscribed) {
        return;
      }
      subscribed = false;
      channel.subscribers.delete(bufferedSubscriber);
      this.stopUnusedChannel(channel);
    };
  }

  private readonly channels = new Map<string, JobChannel>();

  private getOrCreateChannel(jobId: string): JobChannel {
    const existing = this.channels.get(jobId);
    if (existing && !existing.controller.signal.aborted) {
      return existing;
    }
    const snapshot = this.jobs.has(jobId)
      ? this.jobs.getMirrorSnapshot(jobId)
      : null;
    const channel: JobChannel = {
      jobId,
      subscribers: new Set(),
      controller: new AbortController(),
      seenEventIds: new Set(
        snapshot?.lastEventId ? [snapshot.lastEventId] : [],
      ),
      initialization: null,
      task: null,
      pinned: false,
      lastEventId: snapshot?.lastEventId ?? '',
      lastSequence: snapshot?.lastEventSequence ?? null,
    };
    this.channels.set(jobId, channel);
    return channel;
  }

  private initializeChannel(channel: JobChannel): Promise<void> {
    channel.initialization ??= this.recover(channel, false).then(
      () => undefined,
    );
    return channel.initialization;
  }

  private startChannel(channel: JobChannel): void {
    if (
      channel.task !== null ||
      channel.controller.signal.aborted ||
      isTrouteJobTerminalStatus(this.jobs.get(channel.jobId).status)
    ) {
      return;
    }
    channel.task = this.runChannel(channel).finally(() => {
      channel.task = null;
      this.stopUnusedChannel(channel);
    });
  }

  private async runChannel(channel: JobChannel): Promise<void> {
    let reconnectAttempt = 0;
    while (
      !channel.controller.signal.aborted &&
      (channel.pinned || channel.subscribers.size > 0)
    ) {
      try {
        for await (const event of this.client.openJobEventStream(
          channel.jobId,
          {
            signal: channel.controller.signal,
            ...(channel.lastEventId
              ? { lastEventId: channel.lastEventId }
              : {}),
          },
        )) {
          reconnectAttempt = 0;
          if (this.applyEvent(channel, event)) {
            return;
          }
        }
      } catch (cause) {
        if (!channel.controller.signal.aborted) {
          console.warn('troute SSE 연결이 끊겨 복구를 시도합니다.', {
            jobId: channel.jobId,
            cause,
          });
        }
      }
      if (channel.controller.signal.aborted) {
        return;
      }

      try {
        const snapshot = await this.recover(channel, true);
        if (isTrouteJobTerminalStatus(snapshot.state.status)) {
          channel.pinned = false;
          return;
        }
      } catch (cause) {
        console.warn('troute Job GET 복구에 실패했습니다.', {
          jobId: channel.jobId,
          cause,
        });
      }

      const delay =
        RECONNECT_DELAYS_MS[
          Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)
        ]!;
      reconnectAttempt += 1;
      await waitForReconnect(delay, channel.controller.signal);
    }
  }

  private applyEvent(channel: JobChannel, event: TrouteJobEvent): boolean {
    if (event.id && channel.seenEventIds.has(event.id)) {
      return false;
    }
    if (
      event.sequence !== undefined &&
      channel.lastSequence !== null &&
      event.sequence <= channel.lastSequence
    ) {
      return false;
    }

    const result = this.jobs.applyRemoteEvent(event.state, {
      ...(event.id === undefined ? {} : { eventId: event.id }),
      ...(event.sequence === undefined ? {} : { sequence: event.sequence }),
      ...(event.updatedAt === undefined ? {} : { updatedAt: event.updatedAt }),
    });
    if (!result.applied) {
      return false;
    }
    if (event.id) {
      channel.seenEventIds.add(event.id);
    }
    if (event.lastEventId) {
      channel.lastEventId = event.lastEventId;
    }
    if (event.sequence !== undefined) {
      channel.lastSequence = event.sequence;
    }

    const snapshot = this.jobs.getMirrorSnapshot(channel.jobId);
    this.publish(channel, {
      type: event.type,
      state: result.state,
      updatedAt: snapshot.updatedAt,
      ...(event.id === undefined ? {} : { eventId: event.id }),
      ...(event.sequence === undefined ? {} : { sequence: event.sequence }),
    });
    if (isTrouteJobTerminalStatus(result.state.status)) {
      channel.pinned = false;
      channel.controller.abort();
      return true;
    }
    return false;
  }

  private async recover(
    channel: JobChannel,
    publish: boolean,
  ): Promise<TrouteJobMirrorSnapshot> {
    try {
      const remote = await this.client.getJob(channel.jobId);
      this.jobs.syncRemoteJob(remote);
    } catch (cause) {
      if (!this.jobs.has(channel.jobId)) {
        throw cause;
      }
    }
    const snapshot = this.jobs.getMirrorSnapshot(channel.jobId);
    channel.lastEventId = snapshot.lastEventId ?? channel.lastEventId;
    channel.lastSequence = snapshot.lastEventSequence;
    if (publish) {
      this.publish(channel, this.toPublishedSnapshot(snapshot));
    }
    return snapshot;
  }

  private toPublishedSnapshot(
    snapshot: TrouteJobMirrorSnapshot,
  ): PublishedTrouteJobEvent {
    return {
      type: 'snapshot',
      state: snapshot.state,
      updatedAt: snapshot.updatedAt,
    };
  }

  private publish(channel: JobChannel, event: PublishedTrouteJobEvent): void {
    for (const subscriber of channel.subscribers) {
      try {
        subscriber(event);
      } catch (cause) {
        console.error('로컬 troute SSE subscriber 호출에 실패했습니다.', {
          jobId: channel.jobId,
          cause,
        });
      }
    }
  }

  private stopUnusedChannel(channel: JobChannel): void {
    if (channel.pinned || channel.subscribers.size > 0) {
      return;
    }
    channel.controller.abort();
    if (this.channels.get(channel.jobId) === channel) {
      this.channels.delete(channel.jobId);
    }
  }
}

function waitForReconnect(
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener('abort', finish, { once: true });
    function finish(): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    }
  });
}
