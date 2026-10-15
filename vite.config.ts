import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    // Os testes de tela com MUI são lentos no jsdom e estouravam os 5 s padrão com a suíte inteira em
    // paralelo (passavam isolados). Só folga: nenhum teste depende de ser rápido.
    testTimeout: 20000,
  },
})
