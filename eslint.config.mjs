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
      'max-lines': [
        'error',
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      'max-lines-per-function': [
        'warn',
        { max: 80, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ['frontend/src/**/*.tsx'],
    rules: {
      'max-lines-per-function': [
        'warn',
        { max: 150, skipBlankLines: true, skipComments: true },
      ],
    },
  },
];
