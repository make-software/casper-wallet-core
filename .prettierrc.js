module.exports = {
  arrowParens: 'avoid',
  bracketSameLine: false,
  bracketSpacing: true,
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  jsxBracketSameLine: false,
  useTabs: false,
  tabWidth: 2,
  printWidth: 100,
  importOrder: [
    '^react(.*)|@(react|react-native|tanstack|gorhom|redux-saga|redux|reduxjs)|^redux(.*)|inversify|decimal.js|i18next|uuid|apisauce|jwt-decode|axios|^styled|reflect-metadata|casper-js-sdk|buffer',
    '<THIRD_PARTY_MODULES>',
    '@/(.*)',
    '^[./]',
  ],
  overrides: [
    { files: ['*.ts'], options: { parser: 'babel-ts' } },
    { files: ['*.tsx'], options: { parser: 'babel-ts' } },
  ],
  importOrderSeparation: true,
  importOrderParserPlugins: ['typescript', 'decorators-legacy'],
};
