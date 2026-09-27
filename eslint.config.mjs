import babelParser from '@babel/eslint-parser';
import { localizationPlugin } from './infra/localization/eslint-user-facing-literal.mjs';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  {
    files: [
      'frontend/**/*.{ts,tsx}',
      'backend/**/*.{ts,tsx}',
      'shared/**/*.{ts,tsx}',
      'infra/localization/**/*.ts',
    ],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          babelrc: false,
          configFile: false,
          parserOpts: {
            plugins: ['typescript', 'jsx'],
          },
        },
        sourceType: 'module',
      },
    },
    rules: {
      curly: ['error', 'all'],
    },
  },
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    plugins: {
      localization: localizationPlugin,
    },
    rules: {
      'localization/no-unclassified-user-facing-literal': 'error',
    },
  },
];
