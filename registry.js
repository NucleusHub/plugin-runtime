import { createExtensionCatalog } from './extensions.js'

export class PluginRegistry {
  constructor() {
    this._plugins = new Map()
    this.extensions = createExtensionCatalog()
  }

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

  dependencies() {
    return this.all().map(e => ({
      id: e.id,
      dependencies: e.dependencies,
    }))
  }
}
