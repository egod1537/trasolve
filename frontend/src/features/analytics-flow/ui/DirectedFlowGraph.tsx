import { useEffect, useRef } from 'react';
import cytoscape, {
  type Core,
  type ElementDefinition,
  type EventObject,
  type LayoutOptions,
  type StylesheetJson,
} from 'cytoscape';
import dagre from 'cytoscape-dagre';
import type { AnalyticsFlowResponse } from '@trasolve/shared';

cytoscape.use(dagre);

export type AnalyticsFlowSelection =
  | {
      kind: 'node';
      value: AnalyticsFlowResponse['nodes'][number];
    }
  | {
      kind: 'edge';
      value: AnalyticsFlowResponse['edges'][number];
    };

type DirectedFlowGraphProps = {
  data: AnalyticsFlowResponse;
  accessibleLabel: string;
  getNodeLabel: (
    identifier: AnalyticsFlowResponse['nodes'][number]['identifier'],
    kind: AnalyticsFlowResponse['nodes'][number]['kind'],
  ) => string;
  formatNodeMetrics: (visits: number, sessions: number) => string;
  formatEdgeMetrics: (count: number, ratio: number) => string;
  onSelectionChange: (selection: AnalyticsFlowSelection | null) => void;
};

export function DirectedFlowGraph({
  data,
  accessibleLabel,
  getNodeLabel,
  formatNodeMetrics,
  formatEdgeMetrics,
  onSelectionChange,
}: DirectedFlowGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const colors = readGraphColors(container);
    const cy = cytoscape({
      container,
      elements: createElements(
        data,
        getNodeLabel,
        formatNodeMetrics,
        formatEdgeMetrics,
      ),
      style: createStyles(colors),
      layout: createLayout(data.nodes.length),
      minZoom: 0.25,
      maxZoom: 2.5,
      wheelSensitivity: 0.18,
      selectionType: 'single',
    });

    const handleTap = (event: EventObject): void => {
      if (event.target === cy) {
        onSelectionChange(null);
        return;
      }
      if (event.target.isNode()) {
        const node = data.nodes.find(({ id }) => id === event.target.id());
        onSelectionChange(node ? { kind: 'node', value: node } : null);
        return;
      }
      if (event.target.isEdge()) {
        const edge = data.edges.find(
          ({ source, target }) =>
            source === event.target.source().id() &&
            target === event.target.target().id(),
        );
        onSelectionChange(edge ? { kind: 'edge', value: edge } : null);
      }
    };
    cy.on('tap', handleTap);

    const resizeObserver = new ResizeObserver(() => {
      cy.resize();
      cy.fit(undefined, 36);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      destroyGraph(cy, handleTap);
    };
  }, [
    data,
    formatEdgeMetrics,
    formatNodeMetrics,
    getNodeLabel,
    onSelectionChange,
  ]);

  return (
    <div
      ref={containerRef}
      className="analytics-flow-graph"
      role="img"
      aria-label={accessibleLabel}
    />
  );
}

function createElements(
  data: AnalyticsFlowResponse,
  getNodeLabel: DirectedFlowGraphProps['getNodeLabel'],
  formatNodeMetrics: DirectedFlowGraphProps['formatNodeMetrics'],
  formatEdgeMetrics: DirectedFlowGraphProps['formatEdgeMetrics'],
): ElementDefinition[] {
  return [
    ...data.nodes.map((node) => ({
      data: {
        id: node.id,
        label: `${getNodeLabel(node.identifier, node.kind)}\n${node.identifier}\n${formatNodeMetrics(node.visits, node.sessions)}`,
        kind: node.kind,
        visits: node.visits,
        sessions: node.sessions,
      },
    })),
    ...data.edges.map((edge) => ({
      data: {
        id: `${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        label: formatEdgeMetrics(edge.count, edge.ratio),
        count: edge.count,
        ratio: edge.ratio,
        sessions: edge.sessions,
      },
    })),
  ];
}

function createLayout(nodeCount: number): LayoutOptions {
  if (nodeCount > 30) {
    return {
      name: 'cose',
      animate: false,
      fit: true,
      padding: 36,
      nodeRepulsion: 7200,
      idealEdgeLength: 120,
    };
  }
  return {
    name: 'dagre',
    rankDir: 'LR',
    rankSep: 86,
    nodeSep: 44,
    edgeSep: 18,
    acyclicer: 'greedy',
    padding: 36,
  } as LayoutOptions;
}

function createStyles(colors: GraphColors): StylesheetJson {
  return [
    {
      selector: 'node',
      style: {
        width: 184,
        height: 68,
        shape: 'round-rectangle',
        'background-color': colors.surface,
        'border-color': colors.border,
        'border-width': 1.5,
        color: colors.text,
        label: 'data(label)',
        'font-size': 11,
        'font-weight': 600,
        'text-wrap': 'wrap',
        'text-max-width': '164px',
        'text-valign': 'center',
        'text-halign': 'center',
        'overlay-opacity': 0,
      },
    },
    {
      selector: 'node[kind = "domain_event"]',
      style: {
        'background-color': colors.accentSoft,
        'border-color': colors.accent,
      },
    },
    {
      selector: 'edge',
      style: {
        width: 'mapData(count, 1, 100, 1.5, 9)',
        'curve-style': 'bezier',
        'line-color': colors.edge,
        'target-arrow-color': colors.edge,
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.9,
        label: 'data(label)',
        color: colors.muted,
        'font-size': 10,
        'text-background-color': colors.surface,
        'text-background-opacity': 0.9,
        'text-background-padding': '3px',
        'text-rotation': 'autorotate',
        'overlay-opacity': 0,
      },
    },
    {
      selector: ':selected',
      style: {
        'border-color': colors.accent,
        'border-width': 3,
        'line-color': colors.accent,
        'target-arrow-color': colors.accent,
      },
    },
  ];
}

function destroyGraph(cy: Core, handleTap: (event: EventObject) => void): void {
  cy.off('tap', handleTap);
  cy.destroy();
}

type GraphColors = {
  surface: string;
  text: string;
  muted: string;
  border: string;
  edge: string;
  accent: string;
  accentSoft: string;
};

function readGraphColors(container: HTMLElement): GraphColors {
  const styles = getComputedStyle(container);
  const read = (token: string, fallback: string): string =>
    styles.getPropertyValue(token).trim() || fallback;
  return {
    surface: read('--bg-surface-raised', '#ffffff'),
    text: read('--text-primary', '#0f172a'),
    muted: read('--text-muted', '#64748b'),
    border: read('--border-strong', '#cbd5e1'),
    edge: read('--text-muted', '#64748b'),
    accent: read('--accent', '#2563eb'),
    accentSoft: read('--accent-soft', '#eff6ff'),
  };
}
