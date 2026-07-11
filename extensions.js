// Extension-point infrastructure — PREPARED, NOT IMPLEMENTED.
//
// A future PR lets a plugin contribute to well-known *extension points* — a Core
// surface, an app surface, or a cross-app surface. This module fixes the SHAPE of
// that system now so those PRs slot in without a refactor:
//
//   • EXTENSION_SCOPE — the taxonomy of point scopes (mirrors plugin targeting),
//   • an empty, read-only catalogue of point definitions.
//
// It deliberately defines NO extension points and executes NO code. There are no
// lifecycle hooks here. When extension points land, they will register through a
// `defineExtensionPoint(...)` added to this module; today the catalogue is always
// empty and only exposes read accessors, so consumers can already depend on the
// interface.

// The scopes an extension point can belong to, mirroring the plugin targeting
// model: Core itself, a single app, or many apps at once.
export const EXTENSION_SCOPE = Object.freeze({
  CORE: 'core',            // a point exposed by Core
  APP: 'app',              // a point exposed by one app
  CROSS_APP: 'cross-app',  // a point spanning multiple apps
})

// Known extension-point keys a plugin may fill via its manifest's `extensions`.
// Discovery/metadata only — the runtime never loads the contributions; the host
// surface that owns the point resolves them (e.g. the Admin console reads
// `extensions.adminTabs` and mounts each tab's component).
export const EXTENSION_POINT = Object.freeze({
  // Core scope: a tab in the Admin console. Shape: { path, label, component }.
  ADMIN_TABS: 'adminTabs',
})

// The catalogue of defined extension points. Empty in this PR — future PRs
// populate it. Kept module-private so the only surface is the read API below.
const points = new Map()

// A read-only view over the extension-point catalogue. Always empty today.
export function createExtensionCatalog() {
  return {
    list: () => [...points.values()],
    get: id => points.get(id) ?? null,
    has: id => points.has(id),
    scopes: () => ({ ...EXTENSION_SCOPE }),
  }
}
