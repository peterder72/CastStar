import type { GraphEdge, GraphNode, NodePhysics } from '../../types'
import { BASE_REPULSION_FORCE, POSITION_EPSILON } from './constants'
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

const MIN_REPULSION_RANGE = 260
const REPULSION_RANGE_FACTOR = 2.6

function hashCell(x: number, y: number): string {
  return `${x}:${y}`
}

interface CellBucket {
  x: number
  y: number
  indices: number[]
}

export function stepGraphPhysics(input: PhysicsStepInput): PhysicsStepResult {
  const { nodes, edges, settings, dt } = input
  const keys = Object.keys(nodes)
  const nodeCount = keys.length

  if (nodeCount <= 1) {
    return {
      hasMovement: false,
      nextNodes: nodes,
    }
  }

  const nodeValues = keys.map((key) => nodes[key])
  const indexByKey = new Map<string, number>()
  nodeValues.forEach((node, index) => {
    indexByKey.set(node.key, index)
  })

  const edgesList = Object.values(edges)
  const forcesX = new Float64Array(nodeCount)
  const forcesY = new Float64Array(nodeCount)
  const degrees = new Uint16Array(nodeCount)

  for (const edge of edgesList) {
    const sourceIndex = indexByKey.get(edge.source)
    const targetIndex = indexByKey.get(edge.target)

    if (sourceIndex === undefined || targetIndex === undefined) {
      continue
    }

    degrees[sourceIndex] += 1
    degrees[targetIndex] += 1
  }

  const repulsionRange = Math.max(MIN_REPULSION_RANGE, settings.springLength * REPULSION_RANGE_FACTOR)
  const repulsionRangeSq = repulsionRange * repulsionRange
  const cellSize = repulsionRange
  const bucketsByHash = new Map<string, CellBucket>()
  const buckets: CellBucket[] = []

  for (let index = 0; index < nodeCount; index += 1) {
    const node = nodeValues[index]
    const cellX = Math.floor(node.x / cellSize)
    const cellY = Math.floor(node.y / cellSize)
    const cellKey = hashCell(cellX, cellY)
    const bucket = bucketsByHash.get(cellKey)

    if (bucket) {
      bucket.indices.push(index)
      continue
    }

    const nextBucket: CellBucket = {
      x: cellX,
      y: cellY,
      indices: [index],
    }

    bucketsByHash.set(cellKey, nextBucket)
    buckets.push(nextBucket)
  }

  const applyRepulsion = (leftIndex: number, rightIndex: number): void => {
    const leftNode = nodeValues[leftIndex]
    const rightNode = nodeValues[rightIndex]
    const dx = rightNode.x - leftNode.x
    const dy = rightNode.y - leftNode.y
    const distanceSq = dx * dx + dy * dy

    if (distanceSq > repulsionRangeSq) {
      return
    }

    const clampedDistanceSq = Math.max(distanceSq, 1)
    const distance = Math.sqrt(clampedDistanceSq)
    const directionX = dx / distance
    const directionY = dy / distance
    const repulsion = (settings.repulsion * BASE_REPULSION_FORCE) / clampedDistanceSq
    const forceX = directionX * repulsion
    const forceY = directionY * repulsion

    forcesX[leftIndex] -= forceX
    forcesY[leftIndex] -= forceY
    forcesX[rightIndex] += forceX
    forcesY[rightIndex] += forceY
  }

  for (const bucket of buckets) {
    const sameBucket = bucket.indices

    for (let left = 0; left < sameBucket.length; left += 1) {
      for (let right = left + 1; right < sameBucket.length; right += 1) {
        applyRepulsion(sameBucket[left], sameBucket[right])
      }
    }

    const rightNeighbor = bucketsByHash.get(hashCell(bucket.x + 1, bucket.y))
    const bottomNeighbor = bucketsByHash.get(hashCell(bucket.x, bucket.y + 1))
    const diagonalDownNeighbor = bucketsByHash.get(hashCell(bucket.x + 1, bucket.y + 1))
    const diagonalUpNeighbor = bucketsByHash.get(hashCell(bucket.x + 1, bucket.y - 1))
    const neighbors = [rightNeighbor, bottomNeighbor, diagonalDownNeighbor, diagonalUpNeighbor]

    for (const neighbor of neighbors) {
      if (!neighbor) {
        continue
      }

      for (const leftIndex of sameBucket) {
        for (const rightIndex of neighbor.indices) {
          applyRepulsion(leftIndex, rightIndex)
        }
      }
    }
  }

  for (const edge of edgesList) {
    const sourceIndex = indexByKey.get(edge.source)
    const targetIndex = indexByKey.get(edge.target)

    if (sourceIndex === undefined || targetIndex === undefined) {
      continue
    }

    const sourceNode = nodeValues[sourceIndex]
    const targetNode = nodeValues[targetIndex]
    const dx = targetNode.x - sourceNode.x
    const dy = targetNode.y - sourceNode.y
    const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01)
    const directionX = dx / distance
    const directionY = dy / distance

    const sourceDegree = Math.max(1, degrees[sourceIndex])
    const targetDegree = Math.max(1, degrees[targetIndex])
    const degreeFactor = 1 + Math.log1p(Math.max(sourceDegree, targetDegree)) * 0.22

    const springLength = settings.springLength / degreeFactor
    const stretch = distance - springLength
    const springForce = stretch * settings.springStrength
    const clusterForce = Math.max(stretch, 0) * settings.clusterPull
    const totalForce = springForce + clusterForce

    const forceX = directionX * totalForce
    const forceY = directionY * totalForce

    forcesX[sourceIndex] += forceX
    forcesY[sourceIndex] += forceY
    forcesX[targetIndex] -= forceX
    forcesY[targetIndex] -= forceY
  }

  let hasMovement = false
  const nextNodes: Record<string, GraphNode> = {}
  const mass = Math.max(0.3, settings.mass)
  const damping = Math.pow(clamp(settings.damping, 0.5, 0.99), dt)
  const maxSpeed = Math.max(0.1, settings.maxSpeed)

  for (let index = 0; index < nodeCount; index += 1) {
    const node = nodeValues[index]
    let vx = (node.vx + (forcesX[index] / mass) * dt) * damping
    let vy = (node.vy + (forcesY[index] / mass) * dt) * damping

    const speed = Math.hypot(vx, vy)

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

    nextNodes[node.key] = {
      ...node,
      x: nextX,
      y: nextY,
      vx,
      vy,
    }
  }

  if (!hasMovement) {
    return {
      hasMovement: false,
      nextNodes: nodes,
    }
  }

  return {
    hasMovement,
    nextNodes,
  }
}
