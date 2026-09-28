import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { ESLint } from 'eslint';

const traverse = traverseModule.default ?? traverseModule;
const root = process.cwd();
const sourceRoot = path.join(root, 'frontend', 'src');
const resourceRoot = path.join(sourceRoot, 'shared', 'i18n', 'resources');
const locales = ['ko', 'ja', 'en', 'mn'];
const inventoryRequested = process.argv.includes('--inventory');
const localizationKeyPattern =
  /^[A-Za-z][A-Za-z0-9-]*:[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/u;
const localeKeyPattern = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/u;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function listSourceFiles(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      listSourceFiles(absolute, result);
    } else if (/\.tsx?$/u.test(entry.name)) {
      result.push(absolute);
    }
  }
  return result;
}

function sourceLocation(filename, node) {
  const relative = path.relative(sourceRoot, filename).replaceAll('\\', '/');
  return `${relative}:${node.loc?.start.line ?? 1}`;
}

function enclosingContext(nodePath) {
  const functionParent = nodePath.getFunctionParent();
  if (!functionParent) {
    return 'module';
  }
  const node = functionParent.node;
  if ('id' in node && node.id?.type === 'Identifier') {
    return node.id.name;
  }
  const parent = functionParent.parentPath?.node;
  if (
    parent?.type === 'VariableDeclarator' &&
    parent.id.type === 'Identifier'
  ) {
    return parent.id.name;
  }
  return 'anonymous function';
}

function addSource(target, key, source) {
  const sources = target.get(key) ?? [];
  sources.push(source);
  target.set(key, sources);
}

function interpolationVariables(value) {
  return [
    ...new Set(
      [...value.matchAll(/\{\{-?\s*([A-Za-z_][A-Za-z0-9_.-]*)/gu)].map(
        (match) => match[1],
      ),
    ),
  ].sort();
}

function hasLocalizationDisable(comment) {
  for (const line of comment.value.split(/\r?\n/u)) {
    const match = line.match(/eslint-disable(?:-next-line|-line)?\b(.*)$/u);
    if (!match) {
      continue;
    }
    const configuredRules = match[1].trim();
    if (
      configuredRules.length === 0 ||
      configuredRules.includes(
        'localization/no-unclassified-user-facing-literal',
      )
    ) {
      return true;
    }
  }
  return false;
}

function flattenNamespace(
  value,
  locale,
  namespace,
  issues,
  prefix = '',
  result = new Map(),
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.malformed_resource_values.push({
      locale,
      namespace,
      key: prefix || null,
    });
    return result;
  }
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') {
      const collision = [...result.keys()].find(
        (existing) =>
          existing === next ||
          existing.startsWith(`${next}.`) ||
          next.startsWith(`${existing}.`),
      );
      if (collision) {
        issues.nested_collisions.push({
          locale,
          namespace,
          keys: [collision, next],
        });
      }
      result.set(next, child);
      continue;
    }
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      const leafCollision = [...result.keys()].find(
        (existing) => existing === next || next.startsWith(`${existing}.`),
      );
      if (leafCollision) {
        issues.nested_collisions.push({
          locale,
          namespace,
          keys: [leafCollision, next],
        });
      }
      flattenNamespace(child, locale, namespace, issues, next, result);
      continue;
    }
    issues.malformed_resource_values.push({ locale, namespace, key: next });
  }
  return result;
}

function loadResources(issues) {
  const resources = Object.fromEntries(
    locales.map((locale) => [locale, new Map()]),
  );
  const localeNamespaces = Object.fromEntries(
    locales.map((locale) => [locale, new Set()]),
  );
  for (const locale of locales) {
    const directory = path.join(resourceRoot, locale);
    if (!fs.existsSync(directory)) {
      issues.locale_namespace_mismatches.push({
        locale,
        missing_directory: true,
      });
      continue;
    }
    for (const filename of fs.readdirSync(directory).sort()) {
      if (!filename.endsWith('.json')) {
        continue;
      }
      const namespace = filename.slice(0, -'.json'.length);
      localeNamespaces[locale].add(namespace);
      if (!/^[A-Za-z][A-Za-z0-9-]*$/u.test(namespace)) {
        issues.namespace_mismatches.push({ locale, namespace });
      }
      const bundle = flattenNamespace(
        JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8')),
        locale,
        namespace,
        issues,
      );
      for (const [locKey, value] of bundle) {
        if (!localeKeyPattern.test(locKey)) {
          issues.namespace_mismatches.push({
            locale,
            namespace,
            loc_key: locKey,
          });
        }
        const fullKey = `${namespace}:${locKey}`;
        if (resources[locale].has(fullKey)) {
          issues.nested_collisions.push({
            locale,
            namespace,
            keys: [locKey, locKey],
          });
        }
        resources[locale].set(fullKey, value);
      }
    }
  }

  const expectedNamespaces = localeNamespaces[locales[0]];
  for (const locale of locales.slice(1)) {
    const missing = [...expectedNamespaces].filter(
      (namespace) => !localeNamespaces[locale].has(namespace),
    );
    const extra = [...localeNamespaces[locale]].filter(
      (namespace) => !expectedNamespaces.has(namespace),
    );
    if (missing.length > 0 || extra.length > 0) {
      issues.locale_namespace_mismatches.push({ locale, missing, extra });
    }
  }

  const allKeys = new Set(
    locales.flatMap((locale) => [...resources[locale].keys()]),
  );
  for (const key of [...allKeys].sort()) {
    const missingLocales = locales.filter(
      (locale) => !resources[locale].has(key),
    );
    if (missingLocales.length > 0) {
      issues.locale_key_mismatches.push({
        key,
        missing_locales: missingLocales,
      });
      continue;
    }
    for (const locale of locales) {
      if (resources[locale].get(key).trim().length === 0) {
        issues.empty_translations.push({ key, locale });
      }
    }
    const variables = Object.fromEntries(
      locales.map((locale) => [
        locale,
        interpolationVariables(resources[locale].get(key)),
      ]),
    );
    const baseline = JSON.stringify(variables[locales[0]]);
    if (
      locales.some((locale) => JSON.stringify(variables[locale]) !== baseline)
    ) {
      issues.interpolation_mismatches.push({ key, variables });
    }
  }
  return { resources, allKeys };
}

function nonLocalizedReason(literal) {
  if (['Trasolve', 'Google', 'tcache'].includes(literal)) {
    return '번역하지 않는 브랜드 또는 제품 고유명사';
  }
  if (['HTTP', 'HTTP + SSE', 'API', 'POST', 'GET'].includes(literal)) {
    return '프로토콜, API 또는 HTTP method의 고정 기술 표기';
  }
  if (
    ['KO', 'JA', 'EN', 'MN', '한국어', '日本語', 'English', 'Монгол'].includes(
      literal,
    )
  ) {
    return 'locale code 또는 언어 선택기의 고정 자칭 언어명';
  }
  if (['Enter', 'Esc'].includes(literal)) {
    return '물리 keyboard key의 고정 표기';
  }
  if (['S', 'E'].includes(literal)) {
    return '지도 marker의 고정 기술 표기';
  }
  if (literal === '©') {
    return '국제적으로 동일하게 사용하는 저작권 기호';
  }
  if (['DEBUG', 'Debug'].includes(literal)) {
    return '개발자 진단 mode의 고정 기술 표기';
  }
  return '외부 API 또는 protocol의 raw field/token 표기';
}

const issues = {
  empty_translations: [],
  forbidden_localization_disables: [],
  interpolation_mismatches: [],
  invalid_l_calls: [],
  invalid_nl_calls: [],
  locale_key_mismatches: [],
  locale_namespace_mismatches: [],
  malformed_resource_values: [],
  missing_resource_keys: [],
  namespace_mismatches: [],
  nested_collisions: [],
  residual_hardcoded_user_facing_literals: [],
};
const { resources, allKeys: resourceKeys } = loadResources(issues);
const resourceNamespaces = new Set(
  [...resourceKeys].map((key) => key.slice(0, key.indexOf(':'))),
);
const lSources = new Map();
const referencedKeySources = new Map();
const nlSources = new Map();
let lCallCount = 0;
let nlCallCount = 0;

for (const filename of listSourceFiles(sourceRoot)) {
  const source = fs.readFileSync(filename, 'utf8');
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', ...(filename.endsWith('.tsx') ? ['jsx'] : [])],
  });
  for (const comment of ast.comments ?? []) {
    if (hasLocalizationDisable(comment)) {
      issues.forbidden_localization_disables.push(
        sourceLocation(filename, comment),
      );
    }
  }
  traverse(ast, {
    StringLiteral(nodePath) {
      const separator = nodePath.node.value.indexOf(':');
      const namespace = nodePath.node.value.slice(0, separator);
      if (
        !localizationKeyPattern.test(nodePath.node.value) ||
        !resourceNamespaces.has(namespace)
      ) {
        return;
      }
      addSource(referencedKeySources, nodePath.node.value, {
        source_file: sourceLocation(filename, nodePath.node),
        context: enclosingContext(nodePath),
      });
    },
    CallExpression(nodePath) {
      const callee = nodePath.node.callee;
      if (callee.type !== 'Identifier' || !['L', 'NL'].includes(callee.name)) {
        return;
      }
      const argument = nodePath.node.arguments[0];
      const isLiteral = argument?.type === 'StringLiteral';
      const location = sourceLocation(filename, nodePath.node);
      const context = enclosingContext(nodePath);
      if (callee.name === 'L') {
        lCallCount += 1;
        if (!isLiteral || !localizationKeyPattern.test(argument.value)) {
          issues.invalid_l_calls.push(location);
          return;
        }
        addSource(lSources, argument.value, {
          source_file: location,
          context,
        });
        return;
      }
      nlCallCount += 1;
      if (
        !isLiteral ||
        nodePath.node.arguments.length !== 1 ||
        argument.value.trim().length === 0
      ) {
        issues.invalid_nl_calls.push(location);
        return;
      }
      addSource(nlSources, argument.value, {
        source_file: location,
        context,
      });
    },
  });
}

for (const key of new Set([
  ...referencedKeySources.keys(),
  ...lSources.keys(),
])) {
  const missingLocales = locales.filter(
    (locale) => !resources[locale].has(key),
  );
  if (missingLocales.length > 0) {
    issues.missing_resource_keys.push({ key, missing_locales: missingLocales });
  }
}

const unusedWhitelist = new Set(
  readJson('infra/localization/unused-key-whitelist.json').keys,
);
const unusedKeys = [...resourceKeys]
  .filter((key) => !referencedKeySources.has(key) && !unusedWhitelist.has(key))
  .sort();

const eslint = new ESLint();
const lintResults = await eslint.lintFiles(['frontend/src/**/*.{ts,tsx}']);
for (const result of lintResults) {
  for (const message of result.messages) {
    if (message.ruleId !== 'localization/no-unclassified-user-facing-literal') {
      continue;
    }
    if (
      message.messageId === 'unclassified' ||
      message.messageId === 'interpolationRequired'
    ) {
      issues.residual_hardcoded_user_facing_literals.push(
        `${path.relative(root, result.filePath).replaceAll('\\', '/')}:${message.line}`,
      );
    }
  }
}

const localizedEntries = [...referencedKeySources.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, sources]) => {
    const separator = key.indexOf(':');
    const namespace = key.slice(0, separator);
    const locKey = key.slice(separator + 1);
    const values = Object.fromEntries(
      locales.map((locale) => [locale, resources[locale].get(key) ?? null]),
    );
    return {
      source_file: sources.map((item) => item.source_file).join(', '),
      context: [...new Set(sources.map((item) => item.context))].join(', '),
      original_text: values.ko,
      namespace,
      loc_key: locKey,
      ko: values.ko,
      ja: values.ja,
      en: values.en,
      translator_context: `UI에서 ${key} 의미로 사용`,
      duplicate_group: sources.length > 1,
      localization_kind: 'LOCALIZED',
      reason: '언어별 번역이 필요한 사용자 노출 UI 문자열',
    };
  });

const nonLocalizedEntries = [...nlSources.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([literal, sources]) => ({
    source_file: sources.map((item) => item.source_file).join(', '),
    context: [...new Set(sources.map((item) => item.context))].join(', '),
    original_text: literal,
    namespace: null,
    loc_key: null,
    ko: null,
    ja: null,
    en: null,
    translator_context: '모든 locale에서 원문 literal을 그대로 표시',
    duplicate_group: sources.length > 1,
    localization_kind: 'NON_LOCALIZED',
    reason: nonLocalizedReason(literal),
  }));

const dynamicEntries = readJson(
  'infra/localization/dynamic-data-inventory.json',
).entries;
const cleanupCandidates = readJson(
  'infra/localization/sheet-cleanup-candidates.json',
).candidates;
const nlUsages = [...nlSources.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([literal, sources]) => ({
    literal,
    locations: sources.map((source) => source.source_file),
  }));
const summary = {
  resource_key_count: resourceKeys.size,
  referenced_key_count: referencedKeySources.size,
  l_call_count: lCallCount,
  l_key_count: lSources.size,
  nl_call_count: nlCallCount,
  nl_literal_count: nlSources.size,
  dynamic_data_excluded_count: dynamicEntries.length,
  hardcoded_ui_literal_count:
    issues.residual_hardcoded_user_facing_literals.length,
  missing_key_count: issues.missing_resource_keys.length,
  empty_translation_count: issues.empty_translations.length,
  locale_structure_mismatch_count:
    issues.locale_key_mismatches.length +
    issues.locale_namespace_mismatches.length,
  interpolation_mismatch_count: issues.interpolation_mismatches.length,
  nested_collision_count: issues.nested_collisions.length,
  namespace_mismatch_count: issues.namespace_mismatches.length,
  unused_key_count: unusedKeys.length,
};
const warnings = { unused_resource_keys: unusedKeys };
const inventory = [
  ...localizedEntries,
  ...nonLocalizedEntries,
  ...dynamicEntries,
];
const report = {
  summary,
  issues,
  warnings,
  nl_usages: nlUsages,
  sheet_cleanup_candidates: cleanupCandidates,
  ...(inventoryRequested ? { inventory } : {}),
};

console.log(JSON.stringify(report, null, 2));

if (Object.values(issues).some((values) => values.length > 0)) {
  process.exitCode = 1;
}
