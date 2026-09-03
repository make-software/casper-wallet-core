/**
 * Jest is configured in CommonJS mode (not ESM) for stability:
 *
 * The project's runtime uses `"type": "module"` + `module: nodenext`, but Jest's ESM
 * support has known interop issues with CJS deps that export named bindings (notably
 * `casper-js-sdk`, which ships CJS via `dist/lib.node.js`). Forcing ts-jest to emit
 * CommonJS for tests sidesteps that entirely while still type-checking the same way
 * production builds expect.
 *
 * The `moduleNameMapper` strip is what makes nodenext-style `'./foo.js'` imports
 * (which point at `.ts` files) work under Jest.
 *
 * @type {import('jest').Config}
 */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  moduleNameMapper: {
    // uuid v14+ is ESM-only; redirect to a CJS stub for Jest.
    '^uuid$': '<rootDir>/src/__test-utils__/uuid-mock.cjs',
    // nodenext-style `./foo.js` imports point at `.ts` source; strip the suffix.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  transform: {
    // Also transform `.mjs`/`.js` files from whitelisted ESM-only deps (see
    // `transformIgnorePatterns`). ts-jest accepts JS when `allowJs: true`.
    '^.+\\.(t|m?j)sx?$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          target: 'esnext',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          allowJs: true,
          strict: false,
          skipLibCheck: true,
          isolatedModules: true,
          types: ['node', 'jest'],
        },
      },
    ],
  },

  moduleFileExtensions: ['ts', 'tsx', 'mjs', 'js', 'jsx', 'json'],

  // Whitelist ESM-only transitive deps that need transforming.
  // `dom-accessibility-api` (via @testing-library/dom) ships its TypeScript sources, and
  // `moduleFileExtensions` resolves `.ts` first — so Jest reaches the sources, not the build,
  // and they have to be transformed like our own code.
  transformIgnorePatterns: [
    'node_modules/(?!(@noble|@scure|nanoid|jose|ws|@bufbuild|dom-accessibility-api)/)',
  ],

  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts',
    '!src/typings/**',
    '!src/__fixtures__/**',
    '!src/__test-utils__/**',
    '!src/domain/**/repository.ts',
    '!src/domain/**/entities.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov', 'html'],

  // Each worker builds its own ts-jest TypeScript program, so the default
  // (cores - 1) makes two concurrent runs oversubscribe the machine into swap.
  maxWorkers: '50%',
  // 15s, not jest's 5s: under a loaded machine the slower suites exceed 5s and
  // report as failures, which is indistinguishable from a real regression.
  testTimeout: 15000,

  clearMocks: true,
  restoreMocks: true,
};

module.exports = config;
