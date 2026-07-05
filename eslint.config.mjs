import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nx from '@nx/eslint-plugin';

export default tseslint.config(
  {
    ignores: [
      '**/dist',
      '**/dist-web',
      '**/node_modules',
      '.nx',
      '**/vite.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@nx': nx,
    },
    rules: {
      // Enforce the one-way layering rules from ARCHITECTURE.md / ADR 0002.
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            { sourceTag: 'scope:math', onlyDependOnLibsWithTags: [] },
            {
              sourceTag: 'scope:geometry',
              onlyDependOnLibsWithTags: ['scope:math'],
            },
            {
              sourceTag: 'scope:physics',
              onlyDependOnLibsWithTags: ['scope:math'],
            },
            {
              sourceTag: 'scope:spatial',
              onlyDependOnLibsWithTags: ['scope:math'],
            },
            {
              sourceTag: 'scope:slicing',
              onlyDependOnLibsWithTags: [
                'scope:geometry',
                'scope:spatial',
                'scope:math',
              ],
            },
            {
              sourceTag: 'scope:core',
              onlyDependOnLibsWithTags: [
                'scope:physics',
                'scope:slicing',
                'scope:spatial',
                'scope:geometry',
                'scope:math',
              ],
            },
            {
              sourceTag: 'scope:renderer',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:math'],
            },
            {
              sourceTag: 'scope:runtime',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:math'],
            },
            {
              sourceTag: 'layer:app',
              onlyDependOnLibsWithTags: [
                'layer:core',
                'layer:adapter',
                'layer:runtime',
              ],
            },
          ],
        },
      ],
    },
  },
);
