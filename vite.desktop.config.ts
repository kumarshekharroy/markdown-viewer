import { defineConfig, mergeConfig } from 'vite';
import webConfig from './vite.config';

export default mergeConfig(
  webConfig,
  defineConfig({
    clearScreen: false,
    server: {
      watch: { ignored: ['**/src-tauri/**'] }
    }
  })
);
