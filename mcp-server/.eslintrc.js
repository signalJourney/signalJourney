module.exports = {
  env: {
    es2021: true,
    node: true,
    jest: true, // Added jest environment for test files
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    // 'plugin:prettier/recommended', // Uncomment if you want Prettier rules integrated via ESLint
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json', // Point to your tsconfig.json for type-aware linting
  },
  plugins: [
    '@typescript-eslint',
    // 'prettier' // Uncomment if using plugin:prettier/recommended
  ],
  rules: {
    // Common overrides and custom rules
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off', // Allow console in dev
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_|^req$|^res$|^next$' }],
    '@typescript-eslint/no-explicit-any': 'warn', // Warn instead of error for any, to be addressed gradually
    '@typescript-eslint/explicit-module-boundary-types': 'off', // Can be overly verbose for some projects
    // Add any other project-specific rules here
    // "prettier/prettier": ["error", {}, { "usePrettierrc": true }] // Example if using Prettier plugin
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    'logs/',
    '.eslintrc.js',
    'jest.config.js',
  ],
}; 