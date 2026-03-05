import type { NodeKind, NodePhysics } from '../../types'

export interface Point {
  x: number
  y: number
}

export interface Camera {
  x: number
  y: number
  scale: number
}

export interface PhysicsControl {
  key: keyof NodePhysics
  label: string
  min: number
  max: number
  step: number
  precision: number
}

export interface HiddenEntity {
  key: string
  title: string
  kind: NodeKind
}

export interface NodeContextMenuState {
  nodeKey: string
  x: number
  y: number
}

export interface PerformanceStats {
  fps: number
  frameMs: number
  physicsMs: number
  nodeCount: number
  edgeCount: number
}

export type InputMode = 'mouse' | 'trackpad'
