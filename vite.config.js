// vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  console.log('Current mode:', mode);
  console.log('Current Base URL:', env.VITE_BASE_URL);
  console.log('Current API URL:', env.VITE_API_BASE_URL);
   
  return {
    plugins: [react()],
    base: env.VITE_BASE_URL || './',  // Fallback to './' if VITE_BASE_URL is not defined
  };
});
