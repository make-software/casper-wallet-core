module.exports = {
  root: true,
  extends: ['@react-native'],
  plugins: ['simple-import-sort'],
  rules: {
    'jest/expect-expect': 'off',
    'jest/no-disabled-tests': 'off',
  },

  settings: {
    react: {
      version: '18',
    },
  },
};
