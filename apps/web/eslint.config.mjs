import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import baseConfig from "../../eslint.config.mjs";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url))
});

const eslintConfig = [
  ...baseConfig,
  ...compat.extends("next/core-web-vitals")
];

export default eslintConfig;
