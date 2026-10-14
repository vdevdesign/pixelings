import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this project from /pixelings/, while local Vite serves
// from /. Keep both environments working without changing source imports.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/pixelings/' : '/',
  plugins: [react()],
}));
