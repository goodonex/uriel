import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

/** Der gebaute Commit (Netlify setzt COMMIT_REF) — `scripts/live-check.ts` sucht ihn im Bundle. */
function buildCommit(): string {
  if (process.env.COMMIT_REF) return process.env.COMMIT_REF
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unbekannt'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: { __BUILD_COMMIT__: JSON.stringify(buildCommit()) },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      '@supabase/supabase-js',
    ],
  },
})
