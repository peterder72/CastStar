import type { NodePhysics } from '../../types'
import { PHYSICS_CONTROLS, DEFAULT_PHYSICS } from './constants'
import type { InputMode } from './uiTypes'

export const GRAPH_PREFERENCES_STORAGE_KEY = 'caststar_graph_preferences_v1'
export const GRAPH_PREFERENCES_WRITE_DEBOUNCE_MS = 120
const GRAPH_PREFERENCES_VERSION = 1 as const

export interface GraphFiltersPreferences {
  excludeSelfAppearances: boolean
  includeCrewConnections: boolean
}

export interface GraphPreferences {
  physicsEnabled: boolean
  inputMode: InputMode
  physicsSettings: NodePhysics
  filters: GraphFiltersPreferences
}

interface StoredGraphPreferencesV1 extends GraphPreferences {
  version: typeof GRAPH_PREFERENCES_VERSION
}

export const DEFAULT_GRAPH_PREFERENCES: GraphPreferences = {
  physicsEnabled: true,
  inputMode: 'mouse',
  physicsSettings: { ...DEFAULT_PHYSICS },
  filters: {
    excludeSelfAppearances: true,
    includeCrewConnections: false,
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function sanitizeInputMode(value: unknown): InputMode {
  return value === 'mouse' || value === 'trackpad' ? value : DEFAULT_GRAPH_PREFERENCES.inputMode
}

function sanitizePhysicsSettings(value: unknown): NodePhysics {
  const candidateSettings = isRecord(value) ? value : {}
  const sanitized: NodePhysics = { ...DEFAULT_PHYSICS }

  for (const control of PHYSICS_CONTROLS) {
    const raw = candidateSettings[control.key]
    const fallback = DEFAULT_PHYSICS[control.key]
    const numeric = typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback
    sanitized[control.key] = Math.min(control.max, Math.max(control.min, numeric))
  }

  return sanitized
}

function toStoredGraphPreferences(value: GraphPreferences): StoredGraphPreferencesV1 {
  return {
    version: GRAPH_PREFERENCES_VERSION,
    physicsEnabled: value.physicsEnabled,
    inputMode: value.inputMode,
    physicsSettings: value.physicsSettings,
    filters: value.filters,
  }
}

export function readGraphPreferences(): GraphPreferences {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_GRAPH_PREFERENCES
  }

  try {
    const raw = localStorage.getItem(GRAPH_PREFERENCES_STORAGE_KEY)

    if (!raw) {
      return DEFAULT_GRAPH_PREFERENCES
    }

    const parsed: unknown = JSON.parse(raw)

    if (!isRecord(parsed) || parsed.version !== GRAPH_PREFERENCES_VERSION) {
      return DEFAULT_GRAPH_PREFERENCES
    }

    const parsedFilters = isRecord(parsed.filters) ? parsed.filters : {}

    return {
      physicsEnabled: sanitizeBoolean(parsed.physicsEnabled, DEFAULT_GRAPH_PREFERENCES.physicsEnabled),
      inputMode: sanitizeInputMode(parsed.inputMode),
      physicsSettings: sanitizePhysicsSettings(parsed.physicsSettings),
      filters: {
        excludeSelfAppearances: sanitizeBoolean(
          parsedFilters.excludeSelfAppearances,
          DEFAULT_GRAPH_PREFERENCES.filters.excludeSelfAppearances,
        ),
        includeCrewConnections: sanitizeBoolean(
          parsedFilters.includeCrewConnections,
          DEFAULT_GRAPH_PREFERENCES.filters.includeCrewConnections,
        ),
      },
    }
  } catch {
    return DEFAULT_GRAPH_PREFERENCES
  }
}

export function writeGraphPreferences(value: GraphPreferences): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(GRAPH_PREFERENCES_STORAGE_KEY, JSON.stringify(toStoredGraphPreferences(value)))
  } catch {
    // Ignore storage write failures (private mode, quota, restricted environment).
  }
}
