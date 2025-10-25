import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/HypergraphViewer/', // GitHub Pages base path
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Ensure assets are properly referenced
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
