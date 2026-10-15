import { vlyPlugin } from "@vly-ai/integrations";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createReadStream, cpSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "path";
import { defineConfig, type Plugin } from "vite";

const require = createRequire(import.meta.url);
const cesiumPkg = path.dirname(require.resolve("cesium/package.json"));
const cesiumBuild = path.join(cesiumPkg, "Build/Cesium");

/* Cesium ships as ~1,500 ES modules under Source/ plus a single prebuilt ESM
 * bundle under Build/. Compiling the Source tree through Rollup is slow and
 * has OOM'd memory-constrained CI before, so resolve the bare "cesium"
 * specifier to the prebuilt bundle. It is lazy-loaded (photoreal globe mode
 * only), so the size never touches first paint.
 *
 * This is intentionally an exact match: `cesium/Build/Cesium/Widgets/…` (the
 * stylesheet) must still resolve normally. */
function cesiumPrebuiltEsm(): Plugin {
  return {
    name: "terra-core:cesium-prebuilt-esm",
    enforce: "pre",
    resolveId(source) {
      if (source === "cesium") return path.join(cesiumBuild, "index.js");
      return null;
    },
  };
}

/* Cesium's Workers, static Assets, Widgets and ThirdParty trees must be
 * served as loose files from a URL — they cannot be bundled. Serving them
 * from node_modules in dev and copying them into the build output keeps
 * ~7MB of vendored data out of the git repository. */
function cesiumStaticAssets(): Plugin {
  const DIRS = ["Workers", "Assets", "Widgets", "ThirdParty"];
  const MIME: Record<string, string> = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".cjs": "text/javascript",
    ".json": "application/json",
    ".wasm": "application/wasm",
    ".css": "text/css",
    ".html": "text/html",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".xml": "application/xml",
    ".glb": "model/gltf-binary",
    ".bin": "application/octet-stream",
    ".woff2": "font/woff2",
    ".txt": "text/plain",
  };

  return {
    name: "terra-core:cesium-static",
    configureServer(server) {
      server.middlewares.use("/cesium", (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/+/, "");
        const file = path.resolve(cesiumBuild, rel);
        const relFile = path.relative(cesiumBuild, file);
        if (relFile.startsWith("..") || path.isAbsolute(relFile) || !existsSync(file) || !statSync(file).isFile()) {
          next();
          return;
        }
        res.setHeader(
          "Content-Type",
          MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
        );
        res.setHeader("Cache-Control", "public, max-age=86400");
        createReadStream(file).pipe(res);
      });
    },
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dirname, "dist");
      for (const dir of DIRS) {
        const from = path.join(cesiumBuild, dir);
        if (!existsSync(from)) continue;
        cpSync(from, path.join(outDir, "cesium", dir), { recursive: true });
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    vlyPlugin(),
    tailwindcss(),
    cesiumPrebuiltEsm(),
    cesiumStaticAssets(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Force a single copy of React across all packages (including vlyPlugin).
    // Without this, @vly-ai/integrations can resolve its own React copy, which
    // triggers "Invalid hook call" errors at runtime.
    dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  },
  build: {
    // Enable source maps for better debugging (disable in production if needed)
    sourcemap: false,
    // Default rollup chunking. (Manual chunks caused OOM during chunk
    // rendering on memory-constrained CI; defaults are far lighter.)
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit for better chunking
    chunkSizeWarningLimit: 1000,
    // Target modern browsers for better optimization
    target: 'esnext',
    // Minify options - using esbuild (faster than terser)
    minify: 'esbuild',
  },
  // Optimize dependencies
  optimizeDeps: {
    // Only scan the app entry HTML; avoids crawling unrelated *.html files
    // if a legacy snapshot accidentally contains leaked package folders.
    entries: ['index.html'],
    include: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      'react-router',
      'framer-motion',
    ],
  },
  // Performance hints
  server: {
    // Bind to all interfaces so WebContainer's server-ready event fires.
    host: true,
    port: 5173,
    // Keep HMR on, but disable full-screen error overlay
    hmr: {
      overlay: false,
    },
  },
});
