import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: ['localhost', '127.0.0.1', '164.132.96.184'] },
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', testTimeout: 30_000, hookTimeout: 30_000 },
})
