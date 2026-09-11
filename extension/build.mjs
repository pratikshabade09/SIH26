import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

// background/content/popup are simple — bundle as classic IIFE scripts.
const iifeEntryPoints = [
  "src/background/background.ts",
  "src/content/content.ts",
  "src/popup/popup.ts",
];

const iifeOptions = {
  entryPoints: iifeEntryPoints,
  bundle: true,
  outdir: "dist",
  entryNames: "[name]",
  target: "chrome110",
  format: "iife",
  sourcemap: true,
  logLevel: "info",
};

// offscreen.ts pulls in @huggingface/transformers, which uses internal
// dynamic import() calls for lazy-loaded pieces (image processing utils,
// device/dtype config, etc). An IIFE bundle can't code-split those, so
// esbuild leaves them as literal runtime import() calls that 404 unless
// we actually emit them as real split chunks — hence ESM + splitting
// here, loaded via <script type="module"> in offscreen.html.
const offscreenOptions = {
  entryPoints: ["src/offscreen/offscreen.ts"],
  bundle: true,
  outdir: "dist",
  entryNames: "[name]",
  chunkNames: "chunks/[name]-[hash]",
  target: "chrome110",
  format: "esm",
  splitting: true,
  sourcemap: true,
  logLevel: "info",
};

if (watch) {
  const ctxs = await Promise.all([
    esbuild.context(iifeOptions),
    esbuild.context(offscreenOptions),
  ]);
  await Promise.all(ctxs.map((c) => c.watch()));
  console.log("Watching for changes...");
} else {
  await esbuild.build(iifeOptions);
  await esbuild.build(offscreenOptions);
  console.log("Build complete.");
}
