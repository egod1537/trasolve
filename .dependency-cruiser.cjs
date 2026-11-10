const { readdirSync } = require('node:fs');
const source = 'frontend/src';
const layers = {
  app: ['app', 'pages', 'features', 'entities', 'shared', 'map', 'api'],
  pages: ['pages', 'features', 'entities', 'shared', 'map', 'api'],
  features: ['features', 'entities', 'shared', 'map', 'api'],
  entities: ['entities', 'shared'],
  shared: ['shared'],
  map: ['map', 'shared'],
  api: ['api', 'shared'],
};
const slices = (layer) =>
  readdirSync(`${source}/${layer}`, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-unresolved',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    ...Object.entries(layers).map(([layer, allowed]) => ({
      name: `${layer}-dependency-direction`,
      severity: 'error',
      from: { path: `^${source}/${layer}/` },
      to: {
        path: `^${source}/`,
        pathNot: `^${source}/(${allowed.join('|')})/`,
      },
    })),
    ...['features', 'entities'].flatMap((layer) =>
      slices(layer).map((slice) => ({
        name: `${layer}-${slice}-public-api`,
        severity: 'error',
        from: { pathNot: `^${source}/${layer}/${slice}/` },
        to: {
          path: `^${source}/${layer}/${slice}/`,
          pathNot: `^${source}/${layer}/${slice}/index\\.ts$`,
        },
      })),
    ),
    ...slices('entities').map((slice) => ({
      name: `entity-${slice}-independence`,
      severity: 'error',
      from: { path: `^${source}/entities/${slice}/` },
      to: {
        path: `^${source}/entities/`,
        pathNot: `^${source}/entities/${slice}/`,
      },
    })),
    {
      name: 'plain-logic-without-react',
      severity: 'error',
      from: {
        path: `^${source}/(?:entities/|features/[^/]+/(?:domain|command|ai-command|controller)/|features/[^/]+/store/(?!TripProvider))`,
      },
      to: { path: '(?:^react(?:/|$)|node_modules/react(?:/|$))' },
    },
    {
      name: 'google-implementations-are-private',
      severity: 'error',
      from: { path: `^${source}/`, pathNot: `^${source}/map/` },
      to: { path: `^${source}/map/(?:runtime|adapters/Google)` },
    },
  ],
  options: {
    parser: 'swc',
    doNotFollow: { path: 'node_modules|shared/dist' },
    exclude: { path: '\\.(?:css|json|svg|png)$' },

    tsConfig: { fileName: 'frontend/tsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      conditionNames: ['import', 'default'],
    },
  },
};
