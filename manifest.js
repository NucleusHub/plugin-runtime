// Plugin manifest schema + validation.
//
// The manifest shape mirrors the schema in the plugin-infrastructure spec:
//   {
//     id, name, description?,
//     version, apiVersion,
//     target: string | string[],
//     crossApp: boolean,
//     author?,
//     dependencies?: { apps?: Record<string,string>, plugins?: Record<string,string> },
//     permissions?: string[],
//   }
//
// Validation is structural only. It never touches the filesystem, never resolves
// dependencies and never decides whether a plugin *should* run — it just answers
// "is this manifest well-formed?" so the registry can flag broken plugins in the
// Admin UI instead of silently dropping them.

import { PLUGIN_API_VERSION, TARGET_CORE } from './constants.js'

// Kebab-case slug: lowercase, digits, single dashes between segments. Same shape
// Nucleus already uses for app/widget ids.
const ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

// The Nucleus-supported SemVer form — mirrors core/version.js and infra/tool/validate.go.
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Normalize `target` (string | string[] | undefined) to a plain array.
export function normalizeTargets(target) {
  if (Array.isArray(target)) return target
  return target != null ? [target] : []
}

// Validate a raw parsed manifest object. Returns { valid, errors } — a list of
// human-readable problems (empty when valid). Never throws.
export function validateManifest(raw) {
  const errors = []
  const m = isPlainObject(raw) ? raw : {}

  if (!isPlainObject(raw)) {
    return { valid: false, errors: ['manifest must be a JSON object'] }
  }

  // id — required kebab-case slug
  if (typeof m.id !== 'string' || !m.id.trim()) {
    errors.push('`id` is required and must be a non-empty string')
  } else if (!ID_RE.test(m.id)) {
    errors.push('`id` must be a kebab-case slug, e.g. "my-plugin"')
  }

  // name — required
  if (typeof m.name !== 'string' || !m.name.trim()) {
    errors.push('`name` is required and must be a non-empty string')
  }

  // description — optional string
  if (m.description !== undefined && typeof m.description !== 'string') {
    errors.push('`description` must be a string')
  }

  // version — required SemVer
  if (typeof m.version !== 'string' || !SEMVER_RE.test(m.version)) {
    errors.push('`version` is required and must be SemVer (MAJOR.MINOR.PATCH)')
  }

  // apiVersion — required SemVer (which plugin API the plugin targets)
  if (typeof m.apiVersion !== 'string' || !SEMVER_RE.test(m.apiVersion)) {
    errors.push('`apiVersion` is required and must be SemVer (MAJOR.MINOR.PATCH)')
  }

  // target — required, string or array of app ids / "core"
  const targets = normalizeTargets(m.target)
  if (targets.length === 0) {
    errors.push('`target` is required (an app id, "core", or an array of them)')
  } else if (!targets.every(t => typeof t === 'string' && t.trim())) {
    errors.push('`target` entries must be non-empty strings')
  }

  // crossApp — required boolean; must be true when targeting >1 app
  if (typeof m.crossApp !== 'boolean') {
    errors.push('`crossApp` is required and must be a boolean')
  } else if (m.crossApp === false) {
    const appTargets = targets.filter(t => typeof t === 'string' && t !== TARGET_CORE)
    if (appTargets.length > 1) {
      errors.push('`crossApp` must be true when `target` spans more than one app')
    }
  }

  // author — optional string
  if (m.author !== undefined && typeof m.author !== 'string') {
    errors.push('`author` must be a string')
  }

  // dependencies — optional { apps?: {id: range}, plugins?: {id: range} }
  if (m.dependencies !== undefined) {
    if (!isPlainObject(m.dependencies)) {
      errors.push('`dependencies` must be an object')
    } else {
      for (const key of ['apps', 'plugins']) {
        const dep = m.dependencies[key]
        if (dep === undefined) continue
        if (!isPlainObject(dep)) {
          errors.push(`\`dependencies.${key}\` must be an object of { id: versionRange }`)
          continue
        }
        for (const [id, range] of Object.entries(dep)) {
          if (typeof range !== 'string') {
            errors.push(`\`dependencies.${key}.${id}\` must be a version-range string`)
          }
        }
      }
    }
  }

  // permissions — optional string[]
  if (m.permissions !== undefined) {
    if (!Array.isArray(m.permissions) || !m.permissions.every(p => typeof p === 'string')) {
      errors.push('`permissions` must be an array of strings')
    }
  }

  // extensions — optional. What a plugin contributes to host extension points.
  // The only point defined so far is `adminTabs` (see extensions.js); validation
  // is intentionally shallow — the host resolves/loads the actual components.
  if (m.extensions !== undefined) {
    if (!isPlainObject(m.extensions)) {
      errors.push('`extensions` must be an object')
    } else if (m.extensions.adminTabs !== undefined) {
      const tabs = m.extensions.adminTabs
      if (!Array.isArray(tabs)) {
        errors.push('`extensions.adminTabs` must be an array')
      } else {
        tabs.forEach((t, i) => {
          if (!isPlainObject(t) || typeof t.path !== 'string' || typeof t.label !== 'string' || typeof t.component !== 'string') {
            errors.push(`\`extensions.adminTabs[${i}]\` must be { path, label, component } strings`)
          }
        })
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// Is a (validated) manifest's apiVersion compatible with this runtime? SemVer
// major-match: same MAJOR ⇒ compatible. Minor/patch differences are additive.
export function isApiCompatible(apiVersion) {
  if (typeof apiVersion !== 'string') return false
  const major = v => String(v).split('.')[0]
  return major(apiVersion) === major(PLUGIN_API_VERSION)
}
