import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Auditorias privadas, provas externas e caches locais não são código publicado.
    ".tmp/**",
    ".tmp-*",
    // Arquivos minificados de terceiros são distribuídos sem edição no projeto.
    "public/browser-print/*.min.js",
  ]),
]);

export default eslintConfig;
