import type { AtRule, Plugin } from 'postcss';
import { MOBILE_LAYOUT_PREVIEW_WIDTH } from '../src/shared/config/mobileLayout';

const widthCondition = /\(\s*(min|max)-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)/g;

/** Keep responsive declarations in their owning stylesheets and preserve cascade
 * order/specificity. Only viewport-width conditions use the preview width;
 * height, media type and accessibility preferences still use the real device. */
export function mobileLayout(): Plugin {
  return {
    postcssPlugin: 'trasolve-mobile-layout',
    Once(root) {
      const file = root.source?.input.file?.replaceAll('\\', '/') ?? '';
      if (!file.includes('/frontend/src/')) {
        return;
      }
      const queries: AtRule[] = [];
      root.walkAtRules('media', (rule) => {
        if (/\((?:min|max)-width\s*:/.test(rule.params)) {
          queries.push(rule);
        }
      });
      for (const query of queries) {
        const preview = query.clone();
        preview.params = preview.params.replace(
          widthCondition,
          (_condition, bound: string, pixels: string) => {
            const matches =
              bound === 'max'
                ? MOBILE_LAYOUT_PREVIEW_WIDTH <= Number(pixels)
                : MOBILE_LAYOUT_PREVIEW_WIDTH >= Number(pixels);
            return matches ? '(min-width: 0px)' : '(max-width: -1px)';
          },
        );
        scope(query, ':root:not([data-mobile-layout="forced"])');
        scope(preview, ':root[data-mobile-layout="forced"]');
        query.after(preview);
      }
    },
  };
}

function scope(query: AtRule, rootSelector: string): void {
  const guard = `:where(${rootSelector}, ${rootSelector} *)`;
  query.walkRules((rule) => {
    // Keyframe selectors are percentages, not document elements.
    if (
      rule.parent?.type === 'atrule' &&
      /keyframes$/i.test(rule.parent.name)
    ) {
      return;
    }
    rule.selectors = rule.selectors.map((selector) =>
      selector.replace(/(::[\w-]+(?:\([^)]*\))?)?$/, `${guard}$1`),
    );
  });
}
