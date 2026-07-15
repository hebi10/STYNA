import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'functions/.next/**',
      'functions/lib/**',
      'tmp-edge-profile-single/**',
      'artifacts/**',
      '.gstack/**',
      '.worktrees/**',
      'public/**',
      'scripts/**',
      'next-env.d.ts',
      '*.config.js',
      '*.config.ts',
    ],
  },
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript'],
    settings: {
      next: {
        rootDir: '.',
      },
    },
  }),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
      'prefer-const': 'warn',
    },
  },
  {
    files: ['functions/src/index.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];

export default eslintConfig;
