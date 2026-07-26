# YAML Config Override System

## Goal

Replace the plain `src/config.js` with a system where:

- **Hardcoded defaults** live in `src/config.defaults.js` (always safe, always present)
- **Optional overrides** go in `config.yaml` at project root (user creates this to tweak values)
- **Merged result** is available as `virtual:app-config` — all imports use this virtual module
- **Merge happens at Vite build time** — zero runtime cost, resolved once

## How it works

```
┌─────────────────────────┐     ┌──────────────────────┐
│  src/config.defaults.js  │     │  config.yaml         │
│  (all defaults)          │     │  (user overrides,    │
│                          │     │   optional)          │
└───────────┬─────────────┘     └──────────┬───────────┘
            │                              │
            ▼                              ▼
     ┌──────────────────────────────────────────┐
     │  Vite plugin (in vite.config.js)         │
     │  - Reads defaults module                 │
     │  - Reads config.yaml (if exists)         │
     │  - Deep-merges: yaml overrides defaults  │
     │  - Creates virtual module                │
     └──────────────────────┬───────────────────┘
                            │
                            ▼
                 ┌──────────────────┐
                 │ virtual:app-config│
                 │ (merged result)   │
                 └──────────────────┘
                            │
                            ▼
              All imports in the app:
    import config from "virtual:app-config"
```

## Files

### `src/config.defaults.js` — unchanged from current `config.js`

The master set of all configurable values. Never edited by users.

### `config.yaml` — optional, at project root

User creates this file to override specific values. Example:

```yaml
# config.yaml — RepLog configuration overrides
# Only specify values you want to change from the defaults.

sync:
  maxRetries: 5          # fewer retries
  retryIntervalMs: 60000 # retry every 60s instead of 30s

entries:
  defaultLimit: 5        # show only 5 entries per exercise

health:
  pollIntervalMs: 60000  # check health every 60s
```

If this file doesn't exist or is empty, all defaults are used as-is.

### `vite.config.js` — new plugin

A small inline Vite plugin (no npm dependency needed) that:

1. Uses `js-yaml` (dev dependency) to parse `config.yaml`
2. Evaluates `src/config.defaults.js` to get the defaults object
3. Deep-merges (2-level: top-level + one nested level)
4. Creates virtual module `virtual:app-config`

### Deep merge behavior

- Only specified keys in YAML override the default
- Unspecified keys keep their default value
- Merge is 2 levels deep (top-level groups → nested values)
- YAML can't add new top-level groups — only override existing ones

## Import changes

| File | Before | After |
|---|---|---|
| `sync/queue.js` | `import config from "../config"` | `import config from "virtual:app-config"` |
| `useExercises.js` | `import config from "../config"` | `import config from "virtual:app-config"` |
| `useSyncStatus.js` | `import config from "../config"` | `import config from "virtual:app-config"` |
| `db/dexie.js` | `import config from "../config"` | `import config from "virtual:app-config"` |
| `db/repositories.js` | `import config from "../config"` | `import config from "virtual:app-config"` |
| `useSettings.js` | `import config from "../config"` | `import config from "virtual:app-config"` |
| `api/client.js` | `import config from "../../config"` | `import config from "virtual:app-config"` |

## Dev dependency

```
npm install -D js-yaml
```

`js-yaml` is ~20 KB, used only at build time in the Vite plugin, not shipped to the browser.

## Example: changing one value

User wants 5 entries per exercise instead of 10:

```yaml
# config.yaml
entries:
  defaultLimit: 5
```

That's it. Everything else stays at defaults. No code changes needed.
