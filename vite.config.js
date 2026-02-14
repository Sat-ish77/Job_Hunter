/**
 * Vite Configuration
 * ==================
 *
 * MIGRATION NOTE: Removed @base44/vite-plugin which handled Base44's proprietary
 * SDK imports (legacySDKImports), HMR notifications, navigation tracking, and a
 * visual edit agent. All of these are replaced by standard Vite + React tooling.
 *
 * The "@" path alias lets us write clean imports like:
 *   import { Button } from "@/components/ui/button"
 * Instead of fragile relative paths:
 *   import { Button } from "../../components/ui/button"
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
