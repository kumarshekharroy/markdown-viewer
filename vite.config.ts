import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/markdown-viewer/',
  plugins: [react()],
  build: {
    target: 'es2021',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@codemirror/') || id.includes('/node_modules/@uiw/')) {
            return 'editor';
          }
          if (
            id.includes('/node_modules/react-markdown/') ||
            id.includes('/node_modules/remark-') ||
            id.includes('/node_modules/rehype-') ||
            id.includes('/node_modules/katex/') ||
            id.includes('/node_modules/highlight.js/') ||
            id.includes('/node_modules/dompurify/') ||
            id.includes('/node_modules/yaml/')
          ) {
            return 'markdown';
          }
          return undefined;
        }
      }
    }
  }
});
