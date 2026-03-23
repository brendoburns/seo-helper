const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/renderer/renderer.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        buildFilename: 'readonly',
        getExt: 'readonly',
      },
    },
  },
  {
    files: ['src/lib/filename.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
];
