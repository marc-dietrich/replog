import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import packageJson from './package.json' with { type: 'json' }

function resolveGitTag() {
  try {
    execSync('git fetch --tags --force', { stdio: 'ignore' })
  } catch {
    // ignore network errors
  }

  try {
    return execSync('git describe --tags --abbrev=0').toString().trim()
  } catch {
    try {
      const commitWithTag = execSync('git rev-list --tags --max-count=1')
        .toString()
        .trim()
      if (commitWithTag) {
        return execSync(`git describe --tags ${commitWithTag}`).toString().trim()
      }
    } catch {
      // fall through
    }
  }

  return packageJson.version || 'dev'
}

const gitTag = resolveGitTag()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/replog/", // <- exakt dein Repo-Name
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('recharts')) return 'vendor-recharts'
          if (id.includes('@dnd-kit')) return 'vendor-dnd'
          if (id.includes('react-dom')) return 'vendor-react-dom'
          if (id.includes('react')) return 'vendor-react'

          return 'vendor'
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(gitTag),
  }
})

