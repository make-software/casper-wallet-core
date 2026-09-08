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
      'jest.config.cjs',
      'scripts/**',
      '.prettierrc.js',
    ],
  },
  ...compat.extends('@react-native'),
  {
    rules: {
      'jest/expect-expect': 'off',
      'jest/no-disabled-tests': 'off',
    },
  },
  {
    // Both rules are scoped to the swap surface. Repo-wide, the unbound-catch rule would
    // report 23 pre-existing sites and the type-aware rule a larger backlog still; these are
    // the directories where a swallowed error or a truthiness test on a nullable number
    // decides what a user signs.
    files: ['src/react/**/*.{ts,tsx}', 'src/data/repositories/dex/**/*.ts'],
    languageOptions: {
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname },
    },
    rules: {
      // Nullable strings stay allowed: `!activePublicKey` and `!packageHash` are the repo's
      // idiom for "absent", where '' and null mean the same thing.
      '@typescript-eslint/strict-boolean-expressions': ['error', { allowNullableString: true }],
      // `catch {}` discards the error, so nothing can log, classify or re-throw it. Binding it
      // is a speed bump, not a guarantee — a deliberate swallow disables this rule with a
      // reason, which is the point.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CatchClause[param=null]',
          message:
            'Bind the caught error (`catch (e)`). If the swallow is deliberate, disable this rule on the line with a reason.',
        },
      ],
    },
  },
];
