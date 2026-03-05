import type { GraphEdge, GraphNode, NodePhysics } from '../../types'
import { BASE_REPULSION_FORCE, POSITION_EPSILON } from './constants'
import type { Point } from './uiTypes'
import { clamp } from './utils'

interface PhysicsStepInput {
  nodes: Record<string, GraphNode>
  edges: Record<string, GraphEdge>
  settings: NodePhysics
  dt: number
}

interface PhysicsStepResult {
  hasMovement: boolean
  nextNodes: Record<string, GraphNode>
}

function pushForce(forces: Map<string, Point>, key: string, fx: number, fy: number): void {
  const current = forces.get(key)

  if (current) {
    current.x += fx
    current.y += fy
    return
  }

  forces.set(key, { x: fx, y: fy })
}

export function stepGraphPhysics(input: PhysicsStepInput): PhysicsStepResult {
  const { nodes, edges, settings, dt } = input
  const keys = Object.keys(nodes)

  if (keys.length <= 1) {
    return {
      hasMovement: false,
      nextNodes: nodes,
    }
  }

  const edgesList = Object.values(edges)
  const forces = new Map<string, Point>()
  const degrees = new Map<string, number>()
  keys.forEach((key) => degrees.set(key, 0))

  for (const edge of edgesList) {
    if (!nodes[edge.source] || !nodes[edge.target]) {
      continue
    }

    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1)
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1)
  }

  const nodeValues = keys.map((key) => nodes[key])

  for (let leftIndex = 0; leftIndex < nodeValues.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodeValues.length; rightIndex += 1) {
      const leftNode = nodeValues[leftIndex]
      const rightNode = nodeValues[rightIndex]
      const dx = rightNode.x - leftNode.x
      const dy = rightNode.y - leftNode.y
      const distanceSq = Math.max(dx * dx + dy * dy, 1)
      const distance = Math.sqrt(distanceSq)
      const directionX = dx / distance
      const directionY = dy / distance
      const repulsion = (settings.repulsion * BASE_REPULSION_FORCE) / distanceSq
      const forceX = directionX * repulsion
      const forceY = directionY * repulsion

      pushForce(forces, leftNode.key, -forceX, -forceY)
      pushForce(forces, rightNode.key, forceX, forceY)
    }
  }

  for (const edge of edgesList) {
    const sourceNode = nodes[edge.source]
    const targetNode = nodes[edge.target]

    if (!sourceNode || !targetNode) {
      continue
    }

    const dx = targetNode.x - sourceNode.x
    const dy = targetNode.y - sourceNode.y
    const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01)
    const directionX = dx / distance
    const directionY = dy / distance

    const sourceDegree = degrees.get(sourceNode.key) ?? 1
    const targetDegree = degrees.get(targetNode.key) ?? 1
    const degreeFactor = 1 + Math.log1p(Math.max(sourceDegree, targetDegree)) * 0.22

    const springLength = settings.springLength / degreeFactor
    const stretch = distance - springLength
    const springForce = stretch * settings.springStrength
    const clusterForce = Math.max(stretch, 0) * settings.clusterPull
    const totalForce = springForce + clusterForce

    const forceX = directionX * totalForce
    const forceY = directionY * totalForce

    pushForce(forces, sourceNode.key, forceX, forceY)
    pushForce(forces, targetNode.key, -forceX, -forceY)
  }

  let hasMovement = false
  const nextNodes: Record<string, GraphNode> = {}

  for (const key of keys) {
    const node = nodes[key]
    const force = forces.get(key) ?? { x: 0, y: 0 }
    const mass = Math.max(0.3, settings.mass)
    const damping = Math.pow(clamp(settings.damping, 0.5, 0.99), dt)

    let vx = (node.vx + (force.x / mass) * dt) * damping
    let vy = (node.vy + (force.y / mass) * dt) * damping

    const speed = Math.hypot(vx, vy)
    const maxSpeed = Math.max(0.1, settings.maxSpeed)

    if (speed > maxSpeed) {
      const speedScale = maxSpeed / speed
      vx *= speedScale
      vy *= speedScale
    }

    const nextX = node.x + vx * dt
    const nextY = node.y + vy * dt

    if (
      Math.abs(nextX - node.x) > POSITION_EPSILON ||
      Math.abs(nextY - node.y) > POSITION_EPSILON ||
      Math.abs(vx) > POSITION_EPSILON ||
      Math.abs(vy) > POSITION_EPSILON
    ) {
      hasMovement = true
    }

    nextNodes[key] = {
      ...node,
      x: nextX,
      y: nextY,
      vx,
      vy,
    }
  }

  return {
    hasMovement,
    nextNodes,
  }
}
