import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"
import { createRequire } from "node:module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  // Resolve Next's plugins from its own dependencies in isolated pnpm installs.
  resolvePluginsRelativeTo: dirname(require.resolve("eslint-config-next")),
})

const eslintConfig = [
  { ignores: [".next/", "out/", "dist/", "coverage/", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
]

export default eslintConfig
