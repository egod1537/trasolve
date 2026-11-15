import type { Plugin } from 'vite';

/** Start selected-language downloads during HTML parsing, before async i18n
 * module evaluation would discover its dynamic imports. */
export function localizationPreload(): Plugin {
  let base = '/';
  return {
    name: 'localization-preload',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        if (!context.bundle) {
          return;
        }
        const languages: Record<string, string> = {};
        for (const output of Object.values(context.bundle)) {
          if (output.type !== 'chunk') {
            continue;
          }
          const language = /\/shared\/i18n\/languages\/(ko|en|ja|mn)\.ts$/.exec(
            output.facadeModuleId ?? '',
          )?.[1];
          if (language) {
            languages[language] = `${base}${output.fileName}`;
          }
        }
        if (Object.keys(languages).length !== 4) {
          throw new Error(
            'Language preload requires every supported language chunk.',
          );
        }
        return [
          {
            tag: 'script',
            injectTo: 'head',
            children: `(() => { const urls = ${JSON.stringify(languages)}; let language = 'ko'; try { const stored = localStorage.getItem('trasolve.language'); if (Object.hasOwn(urls, stored)) language = stored; } catch {} for (const key of new Set([language, 'en'])) { const link = document.createElement('link'); link.rel = 'modulepreload'; link.href = urls[key]; link.crossOrigin = ''; document.head.append(link); } })();`,
          },
        ];
      },
    },
  };
}
