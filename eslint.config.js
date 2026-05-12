const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.yarn/**',
      'coverage-ts/**',
      'out/**',
      '__generated__/**',
      'coverage/**',
      'eslint.config.js',
      '.prettierrc.js',
    ],
  },
  ...compat.extends('@react-native'),
  {
    rules: {
      'jest/expect-expect': 'off',
      'jest/no-disabled-tests': 'off'
    },
  },
];
