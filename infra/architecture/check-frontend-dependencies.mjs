import { cruise } from 'dependency-cruiser';
import { parseSync } from '@babel/core';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const sourceRoot = join(repositoryRoot, 'frontend', 'src');
const sourceExtensions = ['.ts', '.tsx'];
const publicApiLayers = new Set(['features', 'entities']);
const legacySourceRoots = [
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

function isNetworkBoundary(sourcePath) {
  return (
    sourcePath.startsWith('api/') ||
    sourcePath.startsWith('shared/api/') ||
    /^features\/[^/]+\/api\//.test(sourcePath)
  );
}

const sourceFiles = collectSourceFiles(sourceRoot);
const violations = [];

process.chdir(repositoryRoot);
const { default: dependencyRules } =
  await import('../../.dependency-cruiser.cjs');
const { output } = await cruise(['frontend/src'], {
  ...dependencyRules.options,
  ruleSet: dependencyRules,
  validate: true,
  outputType: 'json',
});
const graph = typeof output === 'string' ? JSON.parse(output) : output;
const scanned = new Set(graph.modules.map((module) => module.source));
for (const file of sourceFiles) {
  const source = relative(repositoryRoot, file).replaceAll('\\', '/');
  if (!file.endsWith('.d.ts') && !scanned.has(source)) {
    violations.push(
      `${source}: dependency-cruiser가 소스 파일을 분석하지 못했습니다.`,
    );
  }
}
for (const violation of graph.summary.violations) {
  violations.push(
    `${violation.from} -> ${violation.to}: ${violation.rule.name}`,
  );
}
for (const issue of graph.summary.environment?.issues ?? []) {
  violations.push(`분석 환경: ${issue.name}`);
}

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
    if (!sourceFiles.some((file) => toSourcePath(file) === publicEntry)) {
      violations.push(
        `${layer}/${slice}: slice root public index.ts가 필요합니다.`,
      );
    }
  }
}

for (const sourceFile of sourceFiles) {
  const sourcePath = toSourcePath(sourceFile);
  const contents = readFileSync(sourceFile, 'utf8');
  const ast = parseSync(contents, {
    filename: sourceFile,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
  });
  const imports = new Set();
  const flags = { network: false, google: false };
  function visit(node) {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (
      [
        'ImportDeclaration',
        'ExportNamedDeclaration',
        'ExportAllDeclaration',
      ].includes(node.type) &&
      node.source
    ) {
      imports.add(node.source.value);
    }
    if (
      node.type === 'ImportExpression' &&
      node.source?.type === 'StringLiteral'
    ) {
      imports.add(node.source.value);
    }
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      if (
        callee?.type === 'Import' &&
        node.arguments[0]?.type === 'StringLiteral'
      ) {
        imports.add(node.arguments[0].value);
      }
      if (
        callee?.name === 'fetch' ||
        (callee?.type === 'MemberExpression' &&
          ['window', 'globalThis'].includes(callee.object?.name) &&
          (callee.property?.name === 'fetch' ||
            callee.property?.value === 'fetch'))
      ) {
        flags.network = true;
      }
    }
    if (
      (node.type === 'MemberExpression' &&
        node.object?.name === 'google' &&
        node.property?.name === 'maps') ||
      (node.type === 'TSQualifiedName' &&
        node.left?.name === 'google' &&
        node.right?.name === 'maps')
    ) {
      flags.google = true;
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'start', 'end', 'comments', 'tokens'].includes(key)) {
        continue;
      }
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value === 'object') {
        visit(value);
      }
    }
  }
  visit(ast);
  if (flags.network && !isNetworkBoundary(sourcePath)) {
    violations.push(
      `${sourcePath}: HTTP 요청은 API 모듈에서만 실행해야 합니다.`,
    );
  }
  if (flags.google && !/^map\/(runtime|adapters)\//.test(sourcePath)) {
    violations.push(
      `${sourcePath}: Google SDK 객체와 타입은 runtime/adapters 내부에서만 사용해야 합니다.`,
    );
  }
  for (const specifier of imports) {
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
  }
}

if (violations.length > 0) {
  console.error(`Frontend architecture check failed (${violations.length})`);
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Frontend architecture check passed (${sourceFiles.length} source modules, ${graph.summary.totalDependenciesCruised} dependencies, including type imports).`,
  );
}
