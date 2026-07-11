// Nucleus plugin runtime service.
//
// A small, read-only HTTP surface over the plugin registry. Mirrors the apps/
// widgets registry service (infra/registry), but for plugins. It discovers
// plugins under /plugins, validates their manifests and serves their metadata.
//
// INFRASTRUCTURE ONLY: it never executes plugin code, has no lifecycle hooks and
// no enable/disable. nginx proxies /api/plugins here.

import express from 'express'
import { readFileSync } from 'fs'
import { PluginRegistry } from './registry.js'
import { loadRegistry } from './runtime.js'
import { PLUGIN_API_VERSION } from './constants.js'

const app = express()
const PORT = process.env.PORT || 4100
const PLUGINS_DIR = process.env.PLUGINS_DIR || '/plugins'
// The Nucleus platform version — surfaced alongside the plugin API version so
// clients can reason about both. Read per request (cheap) so it stays fresh.
const NUCLEUS_MANIFEST = process.env.NUCLEUS_MANIFEST || '/nucleus.json'

function nucleusVersion() {
  try {
    return JSON.parse(readFileSync(NUCLEUS_MANIFEST, 'utf8')).version ?? null
  } catch {
    return null
  }
}

// One shared registry. Discovery is a cheap directory read and nothing is
// executed, so we re-scan per request: a plugin dropped into /plugins shows up
// without a restart. (True hot-loading — running code — is future work; this is
// just keeping the metadata read fresh.)
const registry = new PluginRegistry()
const refresh = () => loadRegistry(PLUGINS_DIR, registry)

app.use((_, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  next()
})

// Every discovered plugin with its metadata + validation state, plus the plugin
// API version this runtime implements and the platform version.
app.get('/api/plugins', (_, res) => {
  refresh()
  res.json({
    apiVersion: PLUGIN_API_VERSION,
    nucleus: nucleusVersion(),
    plugins: registry.all(),
  })
})

// Declared dependency metadata across all plugins (not resolved in this PR).
app.get('/api/plugins/dependencies', (_, res) => {
  refresh()
  res.json({ dependencies: registry.dependencies() })
})

// A single plugin by id. Declared AFTER /dependencies so that literal path wins.
app.get('/api/plugins/:id', (req, res) => {
  refresh()
  const entry = registry.get(req.params.id)
  if (!entry) return res.status(404).json({ error: 'plugin not found' })
  res.json(entry)
})

app.get('/health', (_, res) => res.json({ ok: true }))

app.listen(PORT, () => console.log(`Plugin runtime listening on :${PORT}`))
