/** @type {import('@commitlint/types').UserConfig} */
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'app',
        'chart',
        'orderbook',
        'trades',
        'watchlist',
        'websocket',
        'store',
        'ui',
        'auth',
        'canvas',
        'layout',
        'config',
        'deps',
        'test',
        'ci',
      ],
    ],
    'scope-empty': [1, 'never'],
    'subject-case': [2, 'always', 'lower-case'],
  },
};

export default config;
