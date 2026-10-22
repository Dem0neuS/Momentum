import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'release', 'node_modules', 'public'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Только классические правила хуков. Новые compiler-правила
      // (immutability, set-state-in-effect, refs) в этом проекте дают
      // десятки ложных срабатываний на осознанные паттерны (ref-колбэки,
      // синхронизация внешнего состояния в эффекте).
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // В проекте рядом с компонентами осознанно живут константы и варианты
      // (BLOCK_META, buttonVariants, useUpdateToast): дробить файлы ради HMR
      // не стоит, ошибкой это не считаем.
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['*.config.{ts,js}', 'scripts/**/*.{js,mjs}', 'electron/**/*.cjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
