import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/bq': {
            target: env.VITE_BIGQUERY_API_URL || 'https://fms-bigquery-api-808402455416.us-central1.run.app',
            changeOrigin: true,
            rewrite: (p: string) => p.replace(/^\/api\/bq/, ''),
            secure: false,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('recharts')) return 'recharts';
                if (id.includes('lucide-react')) return 'lucide';
                if (id.includes('@supabase')) return 'supabase';
                if (id.includes('dexie')) return 'dexie';
                return 'vendor';
              }
            },
          },
        },
      },
    };
});
