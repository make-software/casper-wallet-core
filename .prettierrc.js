module.exports = {
  arrowParens: 'avoid',
  bracketSameLine: false,
  bracketSpacing: true,
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  useTabs: false,
  tabWidth: 2,
  printWidth: 100,
  overrides: [
    { files: ['*.ts'], options: { parser: 'babel-ts' } },
    { files: ['*.tsx'], options: { parser: 'babel-ts' } },
  ],
};
