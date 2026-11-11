import * as RadixScrollArea from '@radix-ui/react-scroll-area';
import type { ComponentPropsWithoutRef, Ref } from 'react';
import './scroll-area.css';

type Props = Omit<
  ComponentPropsWithoutRef<typeof RadixScrollArea.Root>,
  'asChild'
> & {
  orientation?: 'vertical' | 'horizontal' | 'both';
  viewportRef?: Ref<HTMLDivElement>;
  viewportProps?: Omit<
    ComponentPropsWithoutRef<typeof RadixScrollArea.Viewport>,
    'asChild' | 'children' | 'disableImplicitContentElement'
  >;
  contentClassName?: string;
  /** Keep semantic lists/tables intact, without an extra content div. */
  contentAsChild?: boolean;
};

/** The viewport owns native scrolling, refs and scroll events; Root owns layout. */
export function ScrollArea({
  className = '',
  children,
  orientation = 'vertical',
  viewportRef,
  viewportProps,
  contentClassName,
  contentAsChild = false,
  type = 'hover',
  scrollHideDelay = 700,
  style,
  ...props
}: Props) {
  return (
    <RadixScrollArea.Root
      {...props}
      className={`ui-scroll-area ${className}`.trim()}
      type={type}
      scrollHideDelay={scrollHideDelay}
      style={{ position: undefined, ...style }}
    >
      <RadixScrollArea.Viewport
        tabIndex={0}
        {...viewportProps}
        ref={viewportRef}
        className={`ui-scroll-viewport ${viewportProps?.className ?? ''}`.trim()}
        disableImplicitContentElement
      >
        <RadixScrollArea.Content
          asChild={contentAsChild}
          className={`ui-scroll-content ${contentClassName ?? ''}`.trim()}
        >
          {children}
        </RadixScrollArea.Content>
      </RadixScrollArea.Viewport>
      {orientation !== 'horizontal' && <Scrollbar orientation="vertical" />}
      {orientation !== 'vertical' && <Scrollbar orientation="horizontal" />}
      {orientation === 'both' && (
        <RadixScrollArea.Corner className="ui-scroll-corner" />
      )}
    </RadixScrollArea.Root>
  );
}

function Scrollbar({
  orientation,
}: {
  orientation: 'vertical' | 'horizontal';
}) {
  return (
    <RadixScrollArea.Scrollbar
      className="ui-scrollbar"
      orientation={orientation}
    >
      <RadixScrollArea.Thumb className="ui-scroll-thumb" />
    </RadixScrollArea.Scrollbar>
  );
}
