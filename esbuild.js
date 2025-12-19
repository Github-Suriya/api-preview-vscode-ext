const esbuild = require("esbuild");

const isWatch = process.argv.includes("--watch");

async function run() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: "dist/extension.js",
    platform: "node",
    target: "node18",
    sourcemap: true,
    external: ["vscode"]
  });

  if (isWatch) {
    await ctx.watch();
    console.log("👀 Watching for changes...");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log("✅ Build complete");
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
