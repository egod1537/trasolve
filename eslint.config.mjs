import babelParser from '@babel/eslint-parser';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  {
    files: [
      'frontend/**/*.{ts,tsx}',
      'backend/**/*.{ts,tsx}',
      'shared/**/*.{ts,tsx}',
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
];
