export const EXTENSION_SCOPE = Object.freeze({
  CORE: 'core',
  APP: 'app',
  CROSS_APP: 'cross-app',
})

export const EXTENSION_POINT = Object.freeze({
  ADMIN_TABS: 'adminTabs',
})

const points = new Map()

export function createExtensionCatalog() {
  return {
    list: () => [...points.values()],
    get: id => points.get(id) ?? null,
    has: id => points.has(id),
    scopes: () => ({ ...EXTENSION_SCOPE }),
  }
}
