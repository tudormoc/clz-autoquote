import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Raw Tailwind palette classes (text-zinc-400, bg-emerald-500 …) bypass the design tokens in src/styles/theme.js
const RAW_PALETTE_CLASS =
  "/(^|[\\s:'\"`])(text|bg|border(-[trblxy])?|divide|ring-offset|ring|outline|from|via|to|placeholder|fill|stroke|accent|caret|decoration|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-[0-9]{2,3})?([\\s'\"`/]|$)/";
const RAW_PALETTE_MESSAGE =
  "Use design tokens from src/styles/theme.js (e.g. text-fg-muted, bg-card, border-border, text-success-400) instead of raw palette colours.";
const ARBITRARY_FONT_SIZE = "/(^|[\\s:'\"`])text-\\[[0-9.]+(px|rem)\\]/";
const ARBITRARY_FONT_SIZE_MESSAGE =
  "Use a font-size token (text-xs, text-2xs, text-3xs, text-4xs …) from src/styles/theme.js instead of text-[Npx].";

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  ...compat.extends("next/typescript"),
  {
    // TEMPLATE.ts is the copy-me skeleton for new pricing formulas, unused on purpose
    ignores: [".next/", "node_modules/", "dist/", "out/", "scripts/**", "ecosystem.config.js", "src/lib/pricing/formulas/TEMPLATE.ts"],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // Prefix a parameter with _ when it must exist (callback signatures) but is not used
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "react-hooks/exhaustive-deps": "warn",
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${RAW_PALETTE_CLASS}]`, message: RAW_PALETTE_MESSAGE },
        { selector: `TemplateElement[value.raw=${RAW_PALETTE_CLASS}]`, message: RAW_PALETTE_MESSAGE },
        { selector: `Literal[value=${ARBITRARY_FONT_SIZE}]`, message: ARBITRARY_FONT_SIZE_MESSAGE },
        { selector: `TemplateElement[value.raw=${ARBITRARY_FONT_SIZE}]`, message: ARBITRARY_FONT_SIZE_MESSAGE },
      ],
    }
  },
  {
    // CommonJS because tailwind.config.js loads the design tokens with require()
    files: ["tailwind.config.js", "src/styles/theme.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    }
  }
];

export default eslintConfig;
