// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// O mesmo código vira o app de mesa (Tauri) e o PWA publicado na Vercel.
const tauri = Boolean(process.env.TAURI_ENV_PLATFORM);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: tauri ? "127.0.0.1" : false },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    target: tauri ? "chrome105" : "es2022",
    minify: "esbuild",
    sourcemap: false,
    outDir: "dist",
  },
});
