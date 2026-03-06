import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_GRAPH_PREFERENCES,
  GRAPH_PREFERENCES_STORAGE_KEY,
  readGraphPreferences,
  writeGraphPreferences,
  type GraphPreferences,
} from '../src/features/graph/persistence'

function createStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map<string, string>(Object.entries(initial))

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      const keys = Array.from(values.keys())
      return keys[index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

function stubLocalStorage(value: Storage | undefined): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value,
  })
}

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor)
    return
  }

  delete (globalThis as { localStorage?: Storage }).localStorage
})

describe('graph preferences persistence', () => {
  it('returns defaults when localStorage is unavailable', () => {
    stubLocalStorage(undefined)
    expect(readGraphPreferences()).toEqual(DEFAULT_GRAPH_PREFERENCES)
  })

  it('returns defaults when stored JSON is invalid', () => {
    const storage = createStorage({
      [GRAPH_PREFERENCES_STORAGE_KEY]: '{',
    })
    stubLocalStorage(storage)

    expect(readGraphPreferences()).toEqual(DEFAULT_GRAPH_PREFERENCES)
  })

  it('hydrates valid persisted preferences', () => {
    const expected: GraphPreferences = {
      physicsEnabled: false,
      inputMode: 'trackpad',
      trackpadSensitivity: 1.8,
      physicsSettings: {
        mass: 2.4,
        repulsion: 2.1,
        springLength: 250,
        springStrength: 0.02,
        damping: 0.73,
        clusterPull: 0.006,
        maxSpeed: 11,
      },
      filters: {
        excludeSelfAppearances: false,
        includeCrewConnections: true,
      },
    }

    const storage = createStorage({
      [GRAPH_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        version: 1,
        ...expected,
      }),
    })
    stubLocalStorage(storage)

    expect(readGraphPreferences()).toEqual(expected)
  })

  it('clamps invalid physics numbers to control limits', () => {
    const storage = createStorage({
      [GRAPH_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        version: 1,
        physicsEnabled: true,
        inputMode: 'mouse',
        trackpadSensitivity: 9,
        physicsSettings: {
          mass: -10,
          repulsion: 99,
          springLength: 0,
          springStrength: 1,
          damping: 0.1,
          clusterPull: -4,
          maxSpeed: 99,
        },
        filters: {
          excludeSelfAppearances: true,
          includeCrewConnections: false,
        },
      }),
    })
    stubLocalStorage(storage)

    expect(readGraphPreferences().physicsSettings).toEqual({
      mass: 0.4,
      repulsion: 3,
      springLength: 80,
      springStrength: 0.03,
      damping: 0.55,
      clusterPull: 0,
      maxSpeed: 18,
    })
  })

  it('clamps invalid trackpad sensitivity to allowed limits', () => {
    const storage = createStorage({
      [GRAPH_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        version: 1,
        physicsEnabled: true,
        inputMode: 'trackpad',
        trackpadSensitivity: -3,
        physicsSettings: {
          mass: 1.2,
          repulsion: 1,
          springLength: 190,
          springStrength: 0.009,
          damping: 0.87,
          clusterPull: 0.011,
          maxSpeed: 8,
        },
        filters: {
          excludeSelfAppearances: true,
          includeCrewConnections: false,
        },
      }),
    })
    stubLocalStorage(storage)

    expect(readGraphPreferences().trackpadSensitivity).toBe(0.4)
  })

  it('falls back to defaults for invalid booleans and input mode', () => {
    const storage = createStorage({
      [GRAPH_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        version: 1,
        physicsEnabled: 'yes',
        inputMode: 'touchscreen',
        trackpadSensitivity: 'max',
        physicsSettings: {
          mass: 1.2,
          repulsion: 1,
          springLength: 190,
          springStrength: 0.009,
          damping: 0.87,
          clusterPull: 0.011,
          maxSpeed: 8,
        },
        filters: {
          excludeSelfAppearances: 'on',
          includeCrewConnections: 1,
        },
      }),
    })
    stubLocalStorage(storage)

    const actual = readGraphPreferences()
    expect(actual.physicsEnabled).toBe(DEFAULT_GRAPH_PREFERENCES.physicsEnabled)
    expect(actual.inputMode).toBe(DEFAULT_GRAPH_PREFERENCES.inputMode)
    expect(actual.trackpadSensitivity).toBe(DEFAULT_GRAPH_PREFERENCES.trackpadSensitivity)
    expect(actual.filters.excludeSelfAppearances).toBe(DEFAULT_GRAPH_PREFERENCES.filters.excludeSelfAppearances)
    expect(actual.filters.includeCrewConnections).toBe(DEFAULT_GRAPH_PREFERENCES.filters.includeCrewConnections)
  })

  it('writes and reads preferences in a versioned payload', () => {
    const storage = createStorage()
    stubLocalStorage(storage)

    const preferences: GraphPreferences = {
      physicsEnabled: false,
      inputMode: 'trackpad',
      trackpadSensitivity: 1.4,
      physicsSettings: {
        mass: 1.8,
        repulsion: 0.65,
        springLength: 130,
        springStrength: 0.004,
        damping: 0.91,
        clusterPull: 0.015,
        maxSpeed: 6,
      },
      filters: {
        excludeSelfAppearances: true,
        includeCrewConnections: true,
      },
    }

    writeGraphPreferences(preferences)

    const raw = storage.getItem(GRAPH_PREFERENCES_STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(raw).toContain('"version":1')
    expect(readGraphPreferences()).toEqual(preferences)
  })

  it('does not throw when localStorage access throws', () => {
    stubLocalStorage({
      get length() {
        return 0
      },
      clear() {},
      getItem() {
        throw new Error('blocked')
      },
      key() {
        return null
      },
      removeItem() {},
      setItem() {
        throw new Error('blocked')
      },
    })

    expect(() => readGraphPreferences()).not.toThrow()
    expect(() => writeGraphPreferences(DEFAULT_GRAPH_PREFERENCES)).not.toThrow()
  })
})
