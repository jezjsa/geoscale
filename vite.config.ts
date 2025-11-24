import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Prevent page refreshes in production
  build: {
    outDir: 'dist',
    // Ensure proper chunking
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'stripe-vendor': ['@stripe/stripe-js', '@stripe/react-stripe-js'],
        },
      },
    },
  },
  // Disable HMR in production builds
  server: {
    port: 5174, // Use port 5174 to avoid conflict with other apps
    hmr: {
      // Only enable HMR in development
      protocol: 'ws',
    },
  },
  // Ensure no refresh on focus in production
  define: {
    // Prevent any window focus refresh logic
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
})

