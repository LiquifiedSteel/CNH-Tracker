import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Match what your Node server used previously
  build: {
    outDir: 'build',
  },

  server: {
    proxy: {
      // Forward ALL /api requests to local Apache/PHP
      // Dev:    http://localhost/api/...
      // Prod:   https://SUBDOMAIN.YOURDOMAIN.COM/api/...
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})