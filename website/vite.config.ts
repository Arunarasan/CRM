import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Public website + customer portal build.
// base '/' — this app is served at the site root by nginx; the CRM app is served under /crm.
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5273,
    // Dev-only: proxy API + uploads to the locally-running Spring Boot backend so the portal
    // can talk to it during development. In production, nginx handles this (Option A).
    // Target MUST match the backend port (app default 10000, per application.yml) and the CRM
    // frontend's VITE_API_URL — otherwise the website writes orders/enquiries to a different
    // backend/DB than the CRM reads, and captured data never shows up in the CRM.
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY || 'http://localhost:10000', changeOrigin: true },
      '/uploads': { target: process.env.VITE_API_PROXY || 'http://localhost:10000', changeOrigin: true },
      // Dev-only: serve the CRM under the SAME origin as the website (mirrors nginx in production),
      // so the single website login hands its localStorage session straight into the CRM. The CRM
      // dev server bases itself at /crm/ (frontend/vite.config.ts). ws:true forwards its HMR socket.
      '/crm': {
        target: process.env.VITE_CRM_PROXY || 'http://localhost:5173',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
