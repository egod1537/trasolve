import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const sourceRoot = join(repositoryRoot, 'frontend', 'src');
const sourceExtensions = ['.ts', '.tsx'];
const importPattern =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;
const rawFetchPattern = /\bfetch\s*\(/;
const publicApiLayers = new Set(['features', 'entities']);
const legacySourceRoots = [
  'api/',
  'pages/map/api/',
  'pages/map/components/',
  'pages/map/domain/',
  'pages/map/hooks/',
  'pages/map/repository/',
  'pages/map/store/',
  'pages/testbed/troute/',
  'shared/components/',
  'shared/styles/',
];
const legacyImportRoots = legacySourceRoots.map(
  (sourceRoot) => `@/${sourceRoot.slice(0, -1)}`,
);

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }
    return sourceExtensions.includes(extname(entry.name)) ? [entryPath] : [];
  });
}

function toSourcePath(filePath) {
  return relative(sourceRoot, filePath).replaceAll('\\', '/');
}

function resolveSourceImport(sourceFile, specifier) {
  let targetBase;
  if (specifier.startsWith('@/')) {
    targetBase = join(sourceRoot, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    targetBase = resolve(dirname(sourceFile), specifier);
  } else {
    return null;
  }

  const candidates = [
    targetBase,
    ...sourceExtensions.map((extension) => `${targetBase}${extension}`),
    ...sourceExtensions.map((extension) =>
      join(targetBase, `index${extension}`),
    ),
  ];
  return (
    candidates.find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
    ) ?? null
  );
}

function getSlice(sourcePath) {
  const [layer, slice] = sourcePath.split('/');
  return { layer, slice };
}

function validateBoundary(sourcePath, targetPath) {
  const source = getSlice(sourcePath);
  const target = getSlice(targetPath);
  const allowedTargets = {
    app: new Set(['app', 'pages', 'features', 'entities', 'shared', 'map']),
    pages: new Set(['pages', 'features', 'entities', 'shared', 'map']),
    features: new Set(['features', 'entities', 'shared', 'map']),
    entities: new Set(['entities', 'shared']),
    shared: new Set(['shared']),
    map: new Set(['map', 'shared']),
  };
  const allowed = allowedTargets[source.layer];
  if (allowed && !allowed.has(target.layer)) {
    return `${source.layer} 레이어에서 ${target.layer} 레이어를 import할 수 없습니다.`;
  }
  if (
    source.layer === 'entities' &&
    target.layer === 'entities' &&
    source.slice !== target.slice
  ) {
    return 'entity 간 직접 import는 허용하지 않습니다.';
  }
  if (
    (target.layer === 'features' || target.layer === 'entities') &&
    (source.layer !== target.layer || source.slice !== target.slice)
  ) {
    const publicEntry = `${target.layer}/${target.slice}/index.ts`;
    if (targetPath !== publicEntry) {
      return `${target.layer}/${target.slice}의 public index.ts를 통해 import해야 합니다.`;
    }
  }
  return null;
}

function isNetworkBoundary(sourcePath) {
  return (
    sourcePath.startsWith('shared/api/') ||
    /^features\/[^/]+\/api\//.test(sourcePath)
  );
}

function findCycles(graph) {
  const state = new Map();
  const stack = [];
  const cycles = new Map();

  function visit(source) {
    state.set(source, 'visiting');
    stack.push(source);
    for (const target of graph.get(source) ?? []) {
      if (state.get(target) === 'visiting') {
        const cycle = stack.slice(stack.indexOf(target)).concat(target);
        const body = cycle.slice(0, -1);
        const rotations = body.map((_, index) => [
          ...body.slice(index),
          ...body.slice(0, index),
        ]);
        rotations.sort((left, right) =>
          left.join('\0').localeCompare(right.join('\0')),
        );
        const canonical = rotations[0];
        cycles.set(canonical.join('\0'), [...canonical, canonical[0]]);
        continue;
      }
      if (!state.has(target)) {
        visit(target);
      }
    }
    stack.pop();
    state.set(source, 'visited');
  }

  for (const source of graph.keys()) {
    if (!state.has(source)) {
      visit(source);
    }
  }
  return [...cycles.values()];
}

const sourceFiles = collectSourceFiles(sourceRoot);
const graph = new Map(
  sourceFiles.map((file) => [toSourcePath(file), new Set()]),
);
const violations = [];
let dependencyCount = 0;

for (const sourceFile of sourceFiles) {
  const sourcePath = toSourcePath(sourceFile);
  const legacyRoot = legacySourceRoots.find((root) =>
    sourcePath.startsWith(root),
  );
  if (legacyRoot) {
    violations.push(
      `${sourcePath}: 제거된 legacy source root를 다시 사용할 수 없습니다: ${legacyRoot}`,
    );
  }

  const parts = sourcePath.split('/');
  const isPublicIndex =
    publicApiLayers.has(parts[0]) && /^index\.tsx?$/.test(parts.at(-1));
  if (isPublicIndex && parts.length !== 3) {
    violations.push(
      `${sourcePath}: feature/entity public index는 slice root에만 둘 수 있습니다.`,
    );
  }
}

for (const layer of publicApiLayers) {
  const slices = new Set(
    sourceFiles
      .map(toSourcePath)
      .filter((sourcePath) => sourcePath.startsWith(`${layer}/`))
      .map((sourcePath) => sourcePath.split('/')[1]),
  );
  for (const slice of slices) {
    const publicEntry = `${layer}/${slice}/index.ts`;
    if (!graph.has(publicEntry)) {
      violations.push(
        `${layer}/${slice}: slice root public index.ts가 필요합니다.`,
      );
    }
  }
}

for (const sourceFile of sourceFiles) {
  const sourcePath = toSourcePath(sourceFile);
  const contents = readFileSync(sourceFile, 'utf8');
  if (rawFetchPattern.test(contents) && !isNetworkBoundary(sourcePath)) {
    violations.push(
      `${sourcePath}: raw fetch는 shared/api 또는 feature api에서만 사용할 수 있습니다.`,
    );
  }
  for (const match of contents.matchAll(importPattern)) {
    const specifier = match[2];
    const legacyImport = legacyImportRoots.find(
      (root) => specifier === root || specifier.startsWith(`${root}/`),
    );
    if (legacyImport) {
      violations.push(
        `${sourcePath}: 제거된 legacy import를 다시 사용할 수 없습니다: ${specifier}`,
      );
    }
    if (/^(?:\.\.\/){3,}/.test(specifier)) {
      violations.push(
        `${sourcePath}: deep relative import를 사용할 수 없습니다: ${specifier}`,
      );
    }
    const targetFile = resolveSourceImport(sourceFile, specifier);
    if (!targetFile) {
      continue;
    }
    const targetPath = toSourcePath(targetFile);
    const boundaryError = validateBoundary(sourcePath, targetPath);
    if (boundaryError) {
      violations.push(`${sourcePath} -> ${targetPath}: ${boundaryError}`);
    }
    if (!sourceExtensions.includes(extname(targetFile))) {
      continue;
    }
    graph.get(sourcePath).add(targetPath);
    dependencyCount += 1;
  }
}

for (const cycle of findCycles(graph)) {
  violations.push(`순환 의존: ${cycle.join(' -> ')}`);
}

if (violations.length > 0) {
  console.error(`Frontend architecture check failed (${violations.length})`);
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Frontend architecture check passed (${sourceFiles.length} modules, ${dependencyCount} dependencies, 0 cycles).`,
  );
}
