import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

export default defineConfig({
  root: '.',
  base: './',

  server: {
    port: 5173,
    strictPort: false,
    host: true,
    open: false,
    cors: true
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 800,
    emptyOutDir: true,
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') },
      output: {
        manualChunks: {
          'vendor-qrcode': ['qrcode'],
          'vendor-canvas': ['html2canvas'],
          'vendor-pdf': ['jspdf'],
          'vendor-xlsx': ['xlsx']
        },
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  },

  resolve: {
    alias: {
      '@':         resolve(__dirname, 'src'),
      '@db':       resolve(__dirname, 'src/modules/db'),
      '@badge':    resolve(__dirname, 'src/modules/badge'),
      '@visitor':  resolve(__dirname, 'src/modules/visitor'),
      '@vendeur':  resolve(__dirname, 'src/modules/vendeur'),
      '@export':   resolve(__dirname, 'src/modules/export'),
      '@ui':       resolve(__dirname, 'src/modules/ui'),
      '@styles':   resolve(__dirname, 'src/styles')
    }
  },

  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/main.js', 'src/modules/db/schema.js']
    }
  }
});
