import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  { ignores: ["main.js", "dist/**", ".agents/**", ".opencode/**"] },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: { allowDefaultProject: ["eslint.config.mjs", "esbuild.config.mjs", "scripts/*.mjs"] } },
    },
  },
  { files: ["*.mjs", "scripts/**", "vitest.config.ts", "tests/**"], rules: { "obsidianmd/no-nodejs-modules": "off" } },
  { files: ["scripts/**"], languageOptions: { globals: { process: "readonly", Buffer: "readonly" } }, rules: { "no-console": "off" } },
]);
