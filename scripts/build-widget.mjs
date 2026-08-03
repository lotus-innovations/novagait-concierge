/**
 * Bundles the embeddable widget (widget/src) to public/widget.js as a
 * minified, self-contained IIFE. Runs via `npm run build:widget` and
 * automatically before `next build` / `next dev` (pre-scripts), so the
 * Vercel build and CI always ship a fresh bundle; public/widget.js is a
 * build artifact and stays out of git.
 */
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

await build({
  entryPoints: ["widget/src/widget.ts"],
  outfile: "public/widget.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  loader: { ".css": "text" },
  define: { __WIDGET_VERSION__: JSON.stringify(pkg.version) },
  banner: {
    js: `/* Novagait Concierge widget v${pkg.version} - Lotus Innovations demo. Fictional brand; synthetic data. */`,
  },
  logLevel: "info",
});
