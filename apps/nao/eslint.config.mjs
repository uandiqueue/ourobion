// ourobion nao — ESLint flat config (eslint 9 + eslint-config-next).
// Uses FlatCompat to bridge eslint-config-next's "next/core-web-vitals" +
// "next/typescript" shareable configs into the flat-config format.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  { ignores: ['.next/**', '.open-next/**', 'node_modules/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default eslintConfig;
