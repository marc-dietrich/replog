/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load as parseYaml } from 'js-yaml'
import packageJson from './package.json' with { type: 'json' }

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Git tag ─────────────────────────────────────────────────────────────

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

// ── Config merge: defaults + optional YAML overrides ────────────────────

function deepMerge(defaults, overrides) {
  const merged = { ...defaults }
  if (!overrides || typeof overrides !== 'object') return merged

  for (const key of Object.keys(overrides)) {
    if (
      overrides[key] !== null &&
      typeof overrides[key] === 'object' &&
      !Array.isArray(overrides[key]) &&
      defaults[key] !== null &&
      typeof defaults[key] === 'object' &&
      !Array.isArray(defaults[key])
    ) {
      merged[key] = deepMerge(defaults[key], overrides[key])
    } else {
      merged[key] = overrides[key]
    }
  }

  return merged
}

async function loadMergedConfig() {
  // Load the defaults module (ESM dynamic import in Node)
  const defaultsPath = resolve(__dirname, 'src', 'config.defaults.js')
  const defaultsModule = await import(`${defaultsPath}?t=${Date.now()}`)
  let config = defaultsModule.default

  // Try to merge YAML overrides if the file exists
  const yamlPath = resolve(__dirname, 'config.yaml')
  if (existsSync(yamlPath)) {
    try {
      const yamlText = readFileSync(yamlPath, 'utf-8')
      // Skip if the file is effectively empty (all comments / whitespace)
      const meaningful = yamlText.split('\n')
        .filter(line => line.trim() && !line.trim().startsWith('#'))
        .join('\n')
      if (meaningful.trim()) {
        const overrides = parseYaml(yamlText)
        if (overrides && typeof overrides === 'object') {
          config = deepMerge(config, overrides)
        }
      }
    } catch (err) {
      console.warn(`[config] Failed to parse config.yaml: ${err.message}`)
    }
  }

  return config
}

// ── Vite virtual module plugin ──────────────────────────────────────────

function appConfigPlugin(mergedConfig) {
  const virtualModuleId = 'virtual:app-config'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    name: 'app-config',
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        return `export default ${JSON.stringify(mergedConfig)};`
      }
    },
  }
}

// ── Build config (async to load + merge before plugins are created) ─────

export default defineConfig(async () => {
  const gitTag = resolveGitTag()
  const mergedConfig = await loadMergedConfig()

  return {
    plugins: [react(), appConfigPlugin(mergedConfig)],
    base: '/',
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('recharts')) return 'vendor-recharts'
            if (id.includes('@dnd-kit')) return 'vendor-dnd'
            return 'vendor'
          },
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(gitTag),
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/__tests__/setup.js'],
      globals: true,
      exclude: ['e2e/**', 'node_modules/**'],
    },
  }
})

