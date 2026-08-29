import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// The CRM is served under /crm — in production one nginx serves the public website at / and the CRM
// at /crm (Option A), and in dev the website dev server proxies /crm here (see website/vite.config.ts).
// Basing the app at /crm/ in BOTH modes keeps dev same-origin with the website, so the single website
// login hands the session straight into the CRM. An explicit VITE_BASE overrides (e.g. host at root).
export default defineConfig(() => ({
  base: process.env.VITE_BASE ?? '/crm/',
  plugins: [react()],
  // Honor an externally assigned port (e.g. the Claude Code preview harness) instead of
  // always claiming 5173, so multiple dev servers can coexist.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))
