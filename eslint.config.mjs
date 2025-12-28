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
      'app/components/ui/**',
      'app/components/ai-elements/**',
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
    files: ['app/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['app/**/*.{ts,tsx}'],
      'boundaries/elements': [
        { type: 'pages', pattern: 'app/**/page.tsx' },
        { type: 'api', pattern: 'app/api/**/*' },
        { type: 'feature', pattern: 'app/components/features/**/*' },
        { type: 'ui', pattern: 'app/components/ui/**/*' },
        { type: 'shared', pattern: 'app/components/shared/**/*' },
        { type: 'lib', pattern: 'app/lib/**/*' },
        { type: 'hooks', pattern: 'app/hooks/**/*' },
        { type: 'types', pattern: 'app/types/**/*' },
        { type: 'config', pattern: 'app/config/**/*' },
        { type: 'actions', pattern: 'app/actions/**/*' },
      ],
    },
    rules: {
      ...boundaries.configs.strict.rules,
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown': 'error',

      // Reglas de dependencias entre capas (alineadas con RULES.md V5)
      'boundaries/element-types': ['error', {
        default: 'allow',
        rules: [
          // Capas base (lib, types, config) no importan UI ni features
          { 
            from: ['lib', 'types', 'config'], 
            disallow: ['feature', 'ui', 'shared', 'pages', 'hooks'], 
            message: 'Capas base no pueden importar UI o logica de negocio.' 
          },
          // Hooks globales son agnósticos a features específicos
          { 
            from: ['hooks'], 
            disallow: ['feature', 'pages'], 
            message: 'Hooks globales deben ser agnosticos a features.' 
          },
          // Componentes UI son puros y reutilizables
          { 
            from: ['ui'], 
            disallow: ['feature', 'pages', 'hooks', 'api'], 
            message: 'Componentes UI deben ser puros y reutilizables.' 
          },
          // Features no dependen de páginas
          { 
            from: ['feature'], 
            disallow: ['pages'], 
            message: 'Features no dependen de paginas.' 
          },
          // Features aislados: no importar otro feature directamente
          { 
            from: ['feature'], 
            disallow: ['feature'], 
            message: 'Features aislados: no importar otro feature directamente.' 
          },
          // API routes no importan hooks ni store de React
          { 
            from: ['api'], 
            disallow: ['hooks', 'feature'], 
            message: 'API routes no deben importar hooks ni features de React.' 
          },
        ],
      }],
    },
  },

  // Aislamiento del servidor - No imports de React/UI
  {
    name: 'architecture/server-isolation',
    files: ['app/server/**/*.{ts,tsx}', 'app/api/**/*.{ts,tsx}'],
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
    files: ['app/**/*.{ts,tsx}'],
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
    files: ['app/components/features/**/*.tsx'],
    rules: {
      'max-lines': ['error', { max: 250, skipComments: true }],
      'complexity': ['error', { max: 12 }],
    },
  },
  
  // Override: Hooks (archivos pequenos y simples)
  {
    name: 'overrides/hooks',
    files: ['app/hooks/**/*.ts'],
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