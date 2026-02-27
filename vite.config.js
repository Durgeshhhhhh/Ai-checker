import { copyFileSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "vite";
import JavaScriptObfuscator from "javascript-obfuscator";

export default defineConfig({
  root: "frontend",
  plugins: [
    {
      name: "copy-runtime-assets",
      closeBundle() {
        copyFileSync(
          resolve(__dirname, "frontend/config.js"),
          resolve(__dirname, "dist/config.js")
        );
        copyFileSync(
          resolve(__dirname, "frontend/requin-logo.png"),
          resolve(__dirname, "dist/requin-logo.png")
        );
      }
    },
    {
      name: "obfuscate-bundled-js",
      apply: "build",
      enforce: "post",
      generateBundle(_options, bundle) {
        for (const item of Object.values(bundle)) {
          if (item.type !== "chunk" || !item.fileName.endsWith(".js")) {
            continue;
          }
          const obfuscated = JavaScriptObfuscator.obfuscate(item.code, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.8,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.2,
            identifierNamesGenerator: "hexadecimal",
            renameGlobals: false,
            selfDefending: true,
            simplify: true,
            splitStrings: true,
            splitStringsChunkLength: 8,
            stringArray: true,
            stringArrayThreshold: 0.8
          });
          item.code = obfuscated.getObfuscatedCode();
        }
      }
    }
  ],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: false,
    minify: "terser",
    rollupOptions: {
      input: {
        index: resolve(__dirname, "frontend/index.html"),
        login: resolve(__dirname, "frontend/login.html"),
        prediction: resolve(__dirname, "frontend/prediction.html"),
        admin: resolve(__dirname, "frontend/admin.html"),
        scanHistory: resolve(__dirname, "frontend/scan-history.html")
      }
    }
  },
  esbuild: {
    drop: ["console", "debugger"]
  }
});
