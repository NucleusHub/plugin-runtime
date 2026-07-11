// The plugin runtime: discover installed plugins, validate their manifests, and
// build registry entries. This is the ONLY thing that touches the filesystem.
//
// It does NOT execute plugin code and has NO lifecycle hooks — discovery and
// validation only. A broken plugin never fails the scan; it becomes an INVALID
// entry so the Admin UI can show the problem.

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { PLUGIN_MANIFEST_FILENAME, PLUGIN_STATE } from './constants.js'
import { validateManifest, isApiCompatible, normalizeTargets } from './manifest.js'
import { PluginRegistry } from './registry.js'

// A directory containing a `nucleus.ignore` marker is never discovered — mirrors
// the guard the apps/widgets registry uses (infra/registry/index.js).
function isIgnored(dir) {
  return existsSync(join(dir, 'nucleus.ignore'))
}

// A minimal entry for a plugin whose manifest could not be read/parsed. Keeps the
// directory name so the Admin UI can still list and flag it.
function invalidEntry(dirName, message) {
  return {
    id: dirName,
    dir: dirName,
    name: dirName,
    description: '',
    version: null,
    apiVersion: null,
    author: null,
    target: [],
    crossApp: false,
    dependencies: { apps: {}, plugins: {} },
    permissions: [],
    extensions: {},
    state: PLUGIN_STATE.INVALID,
    valid: false,
    compatible: false,
    errors: [message],
    manifest: null,
  }
}

// Build a registry entry from one plugin directory. Never throws.
function buildEntry(baseDir, dirName) {
  const manifestPath = join(baseDir, dirName, PLUGIN_MANIFEST_FILENAME)

  let raw
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (e) {
    return invalidEntry(dirName, `could not read ${PLUGIN_MANIFEST_FILENAME}: ${e.message}`)
  }

  const { valid, errors } = validateManifest(raw)
  const compatible = valid && isApiCompatible(raw.apiVersion)

  let state = PLUGIN_STATE.DISCOVERED
  if (!valid) state = PLUGIN_STATE.INVALID
  else if (!compatible) state = PLUGIN_STATE.INCOMPATIBLE

  const entry = {
    // Fall back to the directory name when the manifest omits/breaks `id`, so the
    // entry is still addressable and listable.
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : dirName,
    dir: dirName,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : dirName,
    description: typeof raw.description === 'string' ? raw.description : '',
    version: raw.version ?? null,
    apiVersion: raw.apiVersion ?? null,
    author: raw.author ?? null,
    target: normalizeTargets(raw.target),
    crossApp: raw.crossApp === true,
    dependencies: {
      apps: raw.dependencies?.apps ?? {},
      plugins: raw.dependencies?.plugins ?? {},
    },
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
    // What this plugin contributes to host extension points (e.g. admin tabs).
    // Surfaced as metadata; the host (admin) resolves and loads the components.
    extensions: raw.extensions && typeof raw.extensions === 'object' ? raw.extensions : {},
    state,
    valid,
    compatible,
    errors,
    manifest: raw,
  }

  // Inline the plugin's icon.svg (if any) so the Admin UI can render it themeably
  // via currentColor — the same convenience the apps/widgets registry provides.
  const iconFile = typeof raw.icon === 'string' && raw.icon.endsWith('.svg') ? raw.icon : 'icon.svg'
  try {
    entry.iconSvg = readFileSync(join(baseDir, dirName, iconFile), 'utf8')
  } catch { /* no icon shipped */ }

  return entry
}

// Discover every plugin under baseDir. A plugin is a directory that ships a
// manifest. Returns an array of registry entries (possibly empty).
export function discoverPlugins(baseDir) {
  let dirents
  try {
    dirents = readdirSync(baseDir, { withFileTypes: true })
  } catch {
    return [] // no /plugins dir yet → nothing installed
  }
  return dirents
    .filter(e => e.isDirectory() && !isIgnored(join(baseDir, e.name)))
    .filter(e => existsSync(join(baseDir, e.name, PLUGIN_MANIFEST_FILENAME)))
    .map(e => buildEntry(baseDir, e.name))
}

// Discover + populate a registry in one call — the runtime's single entry point.
export function loadRegistry(baseDir, registry = new PluginRegistry()) {
  return registry.set(discoverPlugins(baseDir))
}
