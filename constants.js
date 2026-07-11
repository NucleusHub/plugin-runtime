// Shared constants for the plugin runtime + registry.
//
// Scope note: this whole service is INFRASTRUCTURE ONLY. It discovers plugins,
// validates their manifests and exposes metadata. It never executes plugin code,
// has no lifecycle hooks and no enable/disable. Those arrive in later PRs; the
// constants here are deliberately limited to what discovery needs.

// The plugin API version this runtime implements. A plugin's manifest declares
// which plugin API it targets via `apiVersion`; the runtime compares the MAJOR
// component against this to decide compatibility. Bump the MAJOR on a breaking
// change to the plugin contract (manifest shape, extension-point surface, …).
// Kept separate from the Nucleus platform version (infra/nucleus.json) on
// purpose — the plugin contract can evolve independently of the platform.
export const PLUGIN_API_VERSION = '0.1.0'

// Filename every plugin ships at the root of its directory (/plugins/<id>/…).
export const PLUGIN_MANIFEST_FILENAME = 'nucleus.plugin.json'

// Reserved `target` keyword — a plugin extending Core rather than a specific
// app. Any other target value is interpreted as an app id.
export const TARGET_CORE = 'core'

// Discovery-time state of a plugin in the registry. This PR only discovers and
// validates; it never runs, enables or disables anything — so a plugin is only
// ever one of these three. Lifecycle states (enabled / disabled / active /
// errored) arrive with the lifecycle PR and are intentionally absent here.
export const PLUGIN_STATE = Object.freeze({
  DISCOVERED: 'discovered',     // manifest is valid and API-compatible
  INVALID: 'invalid',           // manifest missing/unparseable or failed validation
  INCOMPATIBLE: 'incompatible', // valid manifest, but targets a different API major
})
