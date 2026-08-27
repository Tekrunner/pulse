import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "/vite/",
  root: resolve(import.meta.dirname, "vite"),
  build: { outDir: "dist", emptyOutDir: true },
});
