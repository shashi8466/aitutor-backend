import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    historyApiFallback: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    // 'hidden': .map files are generated (so a minified stack trace like a production error
    // report can actually be traced back to real file/line) but the JS bundles don't reference
    // them, so ordinary browser devtools don't auto-load full source for every visitor.
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['framer-motion', 'react-icons'],
          'chart-vendor': ['recharts', 'echarts', 'echarts-for-react'],
          'utils-vendor': ['axios', 'date-fns', '@supabase/supabase-js']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
});
