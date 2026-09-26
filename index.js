import express from 'express'
import { readFileSync } from 'fs'
import { PluginRegistry } from './registry.js'
import { loadRegistry } from './runtime.js'
import { PLUGIN_API_VERSION } from './constants.js'

const app = express()
const PORT = process.env.PORT || 4100
const PLUGINS_DIR = process.env.PLUGINS_DIR || '/plugins'
const NUCLEUS_MANIFEST = process.env.NUCLEUS_MANIFEST || '/nucleus.json'

function nucleusVersion() {
  try {
    return JSON.parse(readFileSync(NUCLEUS_MANIFEST, 'utf8')).version ?? null
  } catch {
    return null
  }
}

const registry = new PluginRegistry()
const refresh = () => loadRegistry(PLUGINS_DIR, registry)

app.use((_, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  next()
})

app.get('/api/plugins', (_, res) => {
  refresh()
  res.json({
    apiVersion: PLUGIN_API_VERSION,
    nucleus: nucleusVersion(),
    plugins: registry.all(),
  })
})

app.get('/api/plugins/dependencies', (_, res) => {
  refresh()
  res.json({ dependencies: registry.dependencies() })
})

// Must be declared after /dependencies so the literal path wins.
app.get('/api/plugins/:id', (req, res) => {
  refresh()
  const entry = registry.get(req.params.id)
  if (!entry) return res.status(404).json({ error: 'plugin not found' })
  res.json(entry)
})

app.get('/health', (_, res) => res.json({ ok: true }))

app.listen(PORT, () => console.log(`Plugin runtime listening on :${PORT}`))
