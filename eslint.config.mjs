/**
 * eslint.config.mjs - Configuración ESLint 9 Flat Config
 *
 * Configuración estricta de arquitectura para proyecto Next.js 16+ SaaS.
 * Aplica reglas de boundaries, imports, TypeScript strict y JSDoc.
 *
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 */
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import importPlugin from 'eslint-plugin-import';
import boundaries from 'eslint-plugin-boundaries';
import unicorn from 'eslint-plugin-unicorn';
import jsdoc from 'eslint-plugin-jsdoc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
  // Archivos ignorados globalmente (no procesados por ESLint)
  {
    name: 'global/ignores',
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      '**/*.config.{js,mjs,ts}',
      'src/components/ui/**',
      'src/components/ai-elements/**',
      'public/**',
      'coverage/**'
    ],
  },

  // Configuracion base de ESLint (reglas recomendadas JS)
  {
    name: 'global/base',
    ...js.configs.recommended,
  },

  // Configuracion TypeScript con type-checking estricto
  {
    name: 'typescript/strict',
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...tseslint.configs.strictTypeChecked.rules,
      ...tseslint.configs.stylisticTypeChecked.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },

  // Configuracion React y Next.js (modo estricto)
  {
    name: 'react/strict',
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@next/next': nextPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      
      // Ajustes para Next.js (React 18+ no requiere import React)
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      
      // Reglas de calidad elevadas a error
      'react/display-name': 'error',
      'react/no-danger': 'error',
      'react/jsx-pascal-case': 'error',
      'react/self-closing-comp': 'error',
      'react/jsx-no-useless-fragment': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  // Configuracion de imports (orden, ciclos, duplicados)
  {
    name: 'imports/order-and-cycles',
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      parserOptions: { sourceType: 'module' },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: true,
      },
    },
    rules: {
      ...importPlugin.flatConfigs.recommended.rules,
      ...(importPlugin.flatConfigs.typescript?.rules ?? {}),
      
      // Prevencion de dependencias circulares
      'import/no-cycle': 'error',
      'import/first': 'error',
      'import/no-duplicates': 'error',
      
      // Ordenamiento de imports por grupos
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'object', 'type'],
        'newlines-between': 'always',
        pathGroups: [
          { pattern: '@/**', group: 'internal', position: 'after' }
        ],
        alphabetize: { order: 'asc', caseInsensitive: true },
      }],

      // Prohibir imports relativos profundos (usar @/ en su lugar)
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['../../../*', '../../../../*', '../../../../../*'],
          message: 'Usa imports absolutos (@/...) en lugar de rutas relativas profundas.'
        }]
      }],
    },
  },

  // Configuracion de boundaries (arquitectura de silos)
  {
    name: 'architecture/boundaries',
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*.{ts,tsx}'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**/*' },
        { type: 'feature', pattern: 'src/components/features/**/*' },
        { type: 'ui', pattern: 'src/components/ui/**/*' },
        { type: 'lib', pattern: 'src/lib/**/*' },
        { type: 'hooks', pattern: 'src/hooks/**/*' },
        { type: 'types', pattern: 'src/types/**/*' },
        { type: 'db', pattern: 'src/db/**/*' },
      ],
    },
    rules: {
      ...boundaries.configs.strict.rules,
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown': 'error',

      // Reglas de dependencias entre capas
      'boundaries/element-types': ['error', {
        default: 'allow',
        rules: [
          { 
            from: ['lib', 'types', 'db'], 
            disallow: ['feature', 'ui', 'app', 'hooks'], 
            message: 'Capas base no pueden importar UI o logica de negocio.' 
          },
          { 
            from: ['hooks'], 
            disallow: ['feature', 'app'], 
            message: 'Hooks globales deben ser agnosticos a features.' 
          },
          { 
            from: ['ui'], 
            disallow: ['feature', 'app', 'hooks'], 
            message: 'Componentes UI deben ser puros y reutilizables.' 
          },
          { 
            from: ['feature'], 
            disallow: ['app'], 
            message: 'Features no dependen de paginas.' 
          },
          { 
            from: ['feature'], 
            disallow: ['feature'], 
            message: 'Features aislados: no importar otro feature directamente.' 
          },
        ],
      }],
    },
  },

  // Aislamiento del servidor - No imports de React/UI
  {
    name: 'architecture/server-isolation',
    files: ['src/server/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@/hooks/*', '@/core/hooks/*', '@/store/*', '@/core/store/*', '*/hooks/*', '*/store/*'],
            message: 'El servidor no debe importar hooks, store ni estado de UI de React.'
          }
        ]
      }]
    }
  },

  // Configuracion de calidad y JSDoc (solo exports publicos)
  {
    name: 'quality/jsdoc-and-limits',
    files: ['src/**/*.{ts,tsx}'],
    plugins: { unicorn, jsdoc },
    rules: {
      // Nombres de archivo en kebab-case
      'unicorn/filename-case': ['error', { 
        case: 'kebabCase', 
        ignore: ['README.md'] 
      }],
      
      // Limite de lineas por archivo
      'max-lines': ['error', { max: 300, skipComments: true }],
      
      // JSDoc obligatorio solo en exports publicos
      ...jsdoc.configs['flat/recommended'].rules,
      'jsdoc/require-jsdoc': ['error', {
        publicOnly: true,
        require: {
          FunctionDeclaration: true,
          ClassDeclaration: true,
          MethodDefinition: true,
        },
      }],
      'jsdoc/require-description': 'warn',
    },
  },

  // Override: Features (limite de lineas extendido)
  {
    name: 'overrides/features',
    files: ['src/components/features/**/*.tsx'],
    rules: {
      'max-lines': ['error', { max: 250, skipComments: true }],
      'complexity': ['error', { max: 12 }],
    },
  },
  
  // Override: Hooks (archivos pequenos y simples)
  {
    name: 'overrides/hooks',
    files: ['src/hooks/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 100, skipComments: true }],
      'complexity': ['error', { max: 8 }],
    },
  },

  // Override: Tests (reglas relajadas)
  {
    name: 'overrides/tests',
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        test: 'readonly',
        jest: 'readonly',
        global: 'readonly',
      },
    },
    rules: {
      'max-lines': 'off',
      'complexity': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'boundaries/element-types': 'off',
      'no-restricted-imports': 'off',
      'jsdoc/require-jsdoc': 'off',
    },
  }
);