import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { PLUGIN_MANIFEST_FILENAME, PLUGIN_STATE } from './constants.js'
import { validateManifest, isApiCompatible, normalizeTargets } from './manifest.js'
import { PluginRegistry } from './registry.js'

function isIgnored(dir) {
  return existsSync(join(dir, 'nucleus.ignore'))
}

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
    extensions: raw.extensions && typeof raw.extensions === 'object' ? raw.extensions : {},
    state,
    valid,
    compatible,
    errors,
    manifest: raw,
  }

  const iconFile = typeof raw.icon === 'string' && raw.icon.endsWith('.svg') ? raw.icon : 'icon.svg'
  try {
    entry.iconSvg = readFileSync(join(baseDir, dirName, iconFile), 'utf8')
  } catch {}

  return entry
}

export function discoverPlugins(baseDir) {
  let dirents
  try {
    dirents = readdirSync(baseDir, { withFileTypes: true })
  } catch {
    return []
  }
  return dirents
    .filter(e => e.isDirectory() && !isIgnored(join(baseDir, e.name)))
    .filter(e => existsSync(join(baseDir, e.name, PLUGIN_MANIFEST_FILENAME)))
    .map(e => buildEntry(baseDir, e.name))
}

export function loadRegistry(baseDir, registry = new PluginRegistry()) {
  return registry.set(discoverPlugins(baseDir))
}
