import type { NodePhysics } from '../../types'
import type { PhysicsControl } from './uiTypes'

export const SEARCH_DEBOUNCE_MS = 280
export const EXPAND_BATCH_SIZE = 10
export const MIN_NODE_DISTANCE = 180
export const BASE_REPULSION_FORCE = 22000
export const POSITION_EPSILON = 0.0005
export const MIN_TRACKPAD_SENSITIVITY = 0.4
export const MAX_TRACKPAD_SENSITIVITY = 3
export const DEFAULT_TRACKPAD_SENSITIVITY = 1
export const TRACKPAD_SENSITIVITY_STEP = 0.1

export const PHYSICS_CONTROLS: PhysicsControl[] = [
  { key: 'mass', label: 'Mass', min: 0.4, max: 4, step: 0.1, precision: 1 },
  { key: 'repulsion', label: 'Repulsion', min: 0.2, max: 3, step: 0.05, precision: 2 },
  { key: 'springLength', label: 'Spring Length', min: 80, max: 420, step: 5, precision: 0 },
  { key: 'springStrength', label: 'Spring Strength', min: 0.001, max: 0.03, step: 0.001, precision: 3 },
  { key: 'clusterPull', label: 'Cluster Pull', min: 0, max: 0.03, step: 0.001, precision: 3 },
  { key: 'damping', label: 'Damping', min: 0.55, max: 0.99, step: 0.01, precision: 2 },
  { key: 'maxSpeed', label: 'Max Speed', min: 1, max: 18, step: 0.5, precision: 1 },
]

export const DEFAULT_PHYSICS: NodePhysics = {
  mass: 1.2,
  repulsion: 1,
  springLength: 190,
  springStrength: 0.009,
  damping: 0.87,
  clusterPull: 0.011,
  maxSpeed: 8,
}
