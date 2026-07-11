// The centralized plugin registry — the single source of truth for what plugins
// exist on this install. The runtime (runtime.js) discovers + validates plugins
// and populates this; every consumer (the Admin API here, and future lifecycle /
// dependency resolvers) reads from here rather than re-scanning disk.
//
// Per-plugin state stored here is discovery-level only (see PLUGIN_STATE in
// constants.js). Enable/disable, ordering and execution are future work and are
// intentionally NOT modeled — this registry answers "what is installed and is
// its manifest sound?", nothing more.

import { createExtensionCatalog } from './extensions.js'

export class PluginRegistry {
  constructor() {
    this._plugins = new Map() // id → entry
    // Extension points a plugin could target. Empty in this PR (see extensions.js),
    // but hung here so the registry is the one object consumers reach for.
    this.extensions = createExtensionCatalog()
  }

  // Replace the whole set atomically — discovery re-scans and re-registers.
  set(entries) {
    const next = new Map()
    for (const e of entries) next.set(e.id, e)
    this._plugins = next
    return this
  }

  register(entry) {
    this._plugins.set(entry.id, entry)
    return this
  }

  all() { return [...this._plugins.values()] }
  get(id) { return this._plugins.get(id) ?? null }
  has(id) { return this._plugins.has(id) }
  ids() { return [...this._plugins.keys()] }
  size() { return this._plugins.size }

  // Declared dependency metadata across the registry. This PR does NOT resolve
  // dependencies (no version-range satisfaction, no load ordering, no cycle
  // detection) — it just surfaces what each plugin asks for, so a future
  // resolver has a stable shape to read.
  dependencies() {
    return this.all().map(e => ({
      id: e.id,
      dependencies: e.dependencies,
    }))
  }
}
