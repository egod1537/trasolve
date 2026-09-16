import { Classes, NonIdealState } from '@blueprintjs/core';
import { useLayoutEffect, useRef } from 'react';
import { sortTimeline, type TimelineEntry as Entry } from '../../timeline';
import { TimelineEntry } from './TimelineEntry';

const scrollPositions = new Map<string, number>();

interface JobTimelineProps {
  jobId: string;
  timeline: Entry[];
}

export function JobTimeline({ jobId, timeline }: JobTimelineProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const orderedTimeline = sortTimeline(timeline);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const savedPosition = scrollPositions.get(jobId);
    if (savedPosition === undefined) {
      viewport.scrollTop = viewport.scrollHeight;
      nearBottomRef.current = true;
    } else {
      viewport.scrollTop = savedPosition;
      nearBottomRef.current = isNearBottom(viewport);
    }

    return () => {
      scrollPositions.set(jobId, viewport.scrollTop);
    };
  }, [jobId]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport && nearBottomRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [orderedTimeline.length]);

  return (
    <section className="job-timeline" aria-labelledby="timeline-title">
      <div className="timeline-heading">
        <h2 id="timeline-title" className={Classes.HEADING}>
          Timeline
        </h2>
        <span className={Classes.TEXT_MUTED}>
          브라우저에서 관찰한 HTTP {orderedTimeline.length}건
        </span>
      </div>
      <div
        ref={viewportRef}
        className="timeline-viewport"
        onScroll={(event) => {
          nearBottomRef.current = isNearBottom(event.currentTarget);
        }}
      >
        {orderedTimeline.length === 0 ? (
          <NonIdealState
            className="timeline-empty"
            icon="timeline-events"
            title="아직 관찰된 요청이 없습니다."
          />
        ) : (
          orderedTimeline.map((entry) => (
            <TimelineEntry key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </section>
  );
}

function isNearBottom(element: HTMLDivElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 80;
}
