import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Meerdere pagina's: elke HTML-file krijgt een eigen <title> en meta description,
// maar ze delen dezelfde React-code (src/main.tsx kiest de pagina via data-page).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        snoeikalender: resolve(import.meta.dirname, 'snoeikalender.html'),
        water: resolve(import.meta.dirname, 'water.html'),
      },
    },
  },
})
