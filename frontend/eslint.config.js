import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([

  // Ignorar la carpeta dist
  globalIgnores(['dist']),

  // ============================
  // 🔹 CONFIGURACIÓN PARA ELECTRON (main.js, preload.js)
  // ============================
  {
    files: ['electron/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,   // ✔ habilita require, module, __dirname, etc.
      },
      ecmaVersion: 2020,
      sourceType: 'script',
    },
    rules: {
      // Reglas específicas para Node/Electron
      'no-undef': 'off', // evita errores falsos de require/__dirname
    },
  },

  // ============================
  // 🔹 CONFIGURACIÓN PARA FRONTEND (React)
  // ============================
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['electron/**/*.js'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser, // ✔ solo frontend
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },

]);
