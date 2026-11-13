import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Raw Tailwind palette classes (text-zinc-400, bg-emerald-500 …) bypass the design tokens in src/styles/theme.js
const RAW_PALETTE_CLASS =
  "/(^|[\\s:'\"`])(text|bg|border(-[trblxy])?|divide|ring-offset|ring|outline|from|via|to|placeholder|fill|stroke|accent|caret|decoration|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-[0-9]{2,3})?([\\s'\"`/]|$)/";
const RAW_PALETTE_MESSAGE =
  "Use design tokens from src/styles/theme.js (e.g. text-fg-muted, bg-card, border-border, text-success-400) instead of raw palette colours.";
const ARBITRARY_FONT_SIZE = "/(^|[\\s:'\"`])text-\\[[0-9.]+(px|rem)\\]/";
const ARBITRARY_FONT_SIZE_MESSAGE =
  "Use a font-size token (text-xs, text-2xs, text-3xs …) from src/styles/theme.js instead of text-[Npx].";
// A corner or a pace written as a number bypasses the skin (theme.js → SKIN): a new look could not change it
const FIXED_SHAPE_OR_PACE = "/(^|[\\s:'\"`])(rounded(-[a-z]{1,2})?-\\[|duration-(\\[|[0-9])|ease-\\[)/";
// A box written by hand (bg-card + border + rounded in one class list) or a <button> of its own bypasses the shared parts
// a skin restyles: Surface / surfaceClasses(), and the parts one presses (Button, IconButton, ChoiceButton, MenuRow …)
const HAND_MADE_BOX =
  "/^(?=.*(^|\\s)bg-card\\S*(\\s|$))(?=.*(^|\\s)border(\\s|$))(?=.*(^|\\s)rounded(-[a-z0-9]+)?(\\s|$))/";
const HAND_MADE_BOX_MESSAGE =
  "Use <Surface> or surfaceClasses() from src/components/ui/Surface.tsx (kinds: panel, inset, floating, chrome, bar, drawer) instead of writing bg-card + border + rounded by hand.";
// A surface that names its own background (bg-card/60 …) takes it away from its kind, and so from the skin
const OWN_BACKGROUND = "/(^|\\s)bg-card/";
const OWN_BACKGROUND_MESSAGE =
  "The kind of a Surface owns its background and its transparency (src/components/ui/Surface.tsx): pick the kind that fits instead of a bg-card of its own.";
const BOX_CLASSES = "JSXOpeningElement:not([name.name=/^(input|select|textarea)$/]) JSXAttribute[name.name='className']";
const RAW_BUTTON_MESSAGE =
  "Use one of the parts one presses in src/components/ui (Button, IconButton, ChoiceButton, MenuRow, SurfaceButton, TextButton, FoldToggle) instead of a raw <button>.";
const FIXED_SHAPE_OR_PACE_MESSAGE =
  "Use the skin's corners and pace from src/styles/theme.js (rounded-lg, rounded-full, a plain transition-*, duration-slide, ease-out) instead of a fixed value.";

// What `no-restricted-syntax` refuses, in the groups a folder may be let off
const TOKEN_RULES = [
  { selector: `Literal[value=${RAW_PALETTE_CLASS}]`, message: RAW_PALETTE_MESSAGE },
  { selector: `TemplateElement[value.raw=${RAW_PALETTE_CLASS}]`, message: RAW_PALETTE_MESSAGE },
  { selector: `Literal[value=${ARBITRARY_FONT_SIZE}]`, message: ARBITRARY_FONT_SIZE_MESSAGE },
  { selector: `TemplateElement[value.raw=${ARBITRARY_FONT_SIZE}]`, message: ARBITRARY_FONT_SIZE_MESSAGE },
  { selector: `Literal[value=${FIXED_SHAPE_OR_PACE}]`, message: FIXED_SHAPE_OR_PACE_MESSAGE },
  { selector: `TemplateElement[value.raw=${FIXED_SHAPE_OR_PACE}]`, message: FIXED_SHAPE_OR_PACE_MESSAGE },
];
const BOX_RULES = [
  { selector: `${BOX_CLASSES} Literal[value=${HAND_MADE_BOX}]`, message: HAND_MADE_BOX_MESSAGE },
  { selector: `${BOX_CLASSES} TemplateElement[value.raw=${HAND_MADE_BOX}]`, message: HAND_MADE_BOX_MESSAGE },
  { selector: `JSXOpeningElement[name.name='Surface'] JSXAttribute[name.name='className'] Literal[value=${OWN_BACKGROUND}]`, message: OWN_BACKGROUND_MESSAGE },
  { selector: `CallExpression[callee.name='surfaceClasses'] > Literal[value=${OWN_BACKGROUND}]`, message: OWN_BACKGROUND_MESSAGE },
];
const BUTTON_RULE = { selector: "JSXOpeningElement[name.name='button']", message: RAW_BUTTON_MESSAGE };
// The icons of the app are named in one file, so a skin can bring its own set
const ICON_PACKAGE = { name: "lucide-react", message: "Take icons from @/components/ui/icons (add the name there when it is new), never from the icon package itself." };
// Pressable is the bare <button> under the shared parts: a screen that used it would draw a button of its own
const BARE_BUTTON = { name: "@/components/ui/Pressable", message: "Pressable is only for the shared parts in src/components/ui: " + RAW_BUTTON_MESSAGE };

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  // TEMPLATE.ts is the copy-me skeleton for new pricing formulas, unused on purpose
  globalIgnores([".next/", "node_modules/", "dist/", "out/", "scripts/**", "ecosystem.config.js", "src/lib/pricing/formulas/TEMPLATE.ts"]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // Prefix a parameter with _ when it must exist (callback signatures) but is not used
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "react-hooks/exhaustive-deps": "warn",
      // React Compiler rules (eslint-plugin-react-hooks 7): the app does not use the compiler, and these flag
      // working patterns (a draft filled from loaded data in an effect, a ref read in a cell editor). Off until then.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/incompatible-library": "off",
      "no-restricted-syntax": ["error", ...TOKEN_RULES, ...BOX_RULES, BUTTON_RULE],
      "no-restricted-imports": ["error", { paths: [ICON_PACKAGE, BARE_BUTTON] }],
    },
  },
  {
    // The shared parts are built on Pressable
    files: ["src/components/ui/**"],
    rules: {
      "no-restricted-imports": ["error", { paths: [ICON_PACKAGE] }],
    },
  },
  {
    files: ["src/components/ui/icons.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // The floor plan is being worked on apart: its one hand-made box moves to Surface when it is next touched
    files: ["src/components/floorplan/**"],
    rules: {
      "no-restricted-syntax": ["error", ...TOKEN_RULES, BUTTON_RULE],
    },
  },
  {
    // CommonJS because tailwind.config.js loads the design tokens with require()
    files: ["tailwind.config.js", "src/styles/theme.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
