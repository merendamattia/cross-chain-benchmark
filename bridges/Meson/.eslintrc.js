/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['standard'],
  rules: {
    'comma-dangle': ['error', 'always-multiline'],
    curly: ['error', 'all'],
    'brace-style': ['error', '1tbs'],
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.eslint.json'],
        sourceType: 'module',
      },
      plugins: ['@typescript-eslint', '@stylistic'],
      extends: [
        'plugin:@typescript-eslint/strict',
        'plugin:@typescript-eslint/stylistic',
      ],
      rules: {
        'no-use-before-define': 'off',
        '@typescript-eslint/no-use-before-define': ['error', {
          ignoreTypeReferences: true,
        }],
        '@stylistic/member-delimiter-style': ['error', {
          multiline: { delimiter: 'none', requireLast: false },
        }],
      },
    },
  ],
  ignorePatterns: ['packages/sdk/', 'packages/presets/', 'lib/', 'es/', 'test/', 'node_modules/', '*.d.ts'],
}
