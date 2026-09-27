import { Classes, NonIdealState } from '@blueprintjs/core';
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import {
  sortTimeline,
  type TimelineEntry as Entry,
} from '@/entities/route-job';
import { TimelineEntry } from '@/features/troute-testbed/components/detail/TimelineEntry';
import { useL } from '@/shared/i18n';

const scrollPositions = new Map<string, number>();

interface JobTimelineProps {
  jobId: string;
  timeline: Entry[];
}

export const JobTimeline = memo(function JobTimeline({
  jobId,
  timeline,
}: JobTimelineProps) {
  const L = useL();
  const viewportRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const orderedTimeline = useMemo(() => sortTimeline(timeline), [timeline]);

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
          {L('testbed:jobDetail.timelineSection.title.timeline')}
        </h2>
        <span className={Classes.TEXT_MUTED}>
          {L('testbed:jobTimeline.text.httpSseInstancesObservedBrowsers', {
            length: orderedTimeline.length,
          })}
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
            title={L(
              'testbed:jobTimeline.tooltip.noRequestsHaveBeenObservedYet',
            )}
          />
        ) : (
          orderedTimeline.map((entry) => (
            <TimelineEntry key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </section>
  );
});

function isNearBottom(element: HTMLDivElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 80;
}
