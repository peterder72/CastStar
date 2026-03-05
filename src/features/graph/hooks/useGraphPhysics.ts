import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect, useRef, useState } from 'react'
import { stepGraphPhysics } from '../physics'
import type { PerformanceStats } from '../uiTypes'
import { clamp } from '../utils'
import type { GraphEdge, GraphNode, NodePhysics } from '../../../types'

interface PerfAccumulator {
  windowStart: number | null
  frameCount: number
  frameMsTotal: number
  physicsMsTotal: number
}

interface UseGraphPhysicsParams {
  nodesRef: MutableRefObject<Record<string, GraphNode>>
  edgesRef: MutableRefObject<Record<string, GraphEdge>>
  physicsRef: MutableRefObject<NodePhysics>
  physicsEnabled: boolean
  setNodes: Dispatch<SetStateAction<Record<string, GraphNode>>>
}

const PERF_SAMPLE_WINDOW_MS = 750

export function useGraphPhysics({ nodesRef, edgesRef, physicsRef, physicsEnabled, setNodes }: UseGraphPhysicsParams) {
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    fps: 0,
    frameMs: 0,
    physicsMs: 0,
    nodeCount: 0,
    edgeCount: 0,
  })
  const perfRef = useRef<PerfAccumulator>({
    windowStart: null,
    frameCount: 0,
    frameMsTotal: 0,
    physicsMsTotal: 0,
  })

  useEffect(() => {
    let frameId = 0
    let previousTimestamp: number | null = null

    const animate = (timestamp: number): void => {
      const frameStart = performance.now()
      const activeNodes = nodesRef.current
      const keys = Object.keys(activeNodes)
      let physicsMs = 0

      if (physicsEnabled && keys.length > 1) {
        const dt = previousTimestamp === null ? 1 : clamp((timestamp - previousTimestamp) / 16.667, 0.5, 2)
        const settings = physicsRef.current
        const physicsStart = performance.now()

        const { hasMovement, nextNodes } = stepGraphPhysics({
          nodes: activeNodes,
          edges: edgesRef.current,
          settings,
          dt,
        })
        physicsMs = performance.now() - physicsStart

        if (hasMovement) {
          nodesRef.current = nextNodes
          setNodes(nextNodes)
        }
      }

      const frameMs = performance.now() - frameStart
      const perf = perfRef.current

      if (perf.windowStart === null) {
        perf.windowStart = timestamp
      }

      perf.frameCount += 1
      perf.frameMsTotal += frameMs
      perf.physicsMsTotal += physicsMs

      const elapsed = timestamp - perf.windowStart

      if (elapsed >= PERF_SAMPLE_WINDOW_MS) {
        const frameCount = Math.max(1, perf.frameCount)
        const nextStats: PerformanceStats = {
          fps: Number.parseFloat(((frameCount * 1000) / elapsed).toFixed(1)),
          frameMs: Number.parseFloat((perf.frameMsTotal / frameCount).toFixed(2)),
          physicsMs: Number.parseFloat((perf.physicsMsTotal / frameCount).toFixed(2)),
          nodeCount: keys.length,
          edgeCount: Object.keys(edgesRef.current).length,
        }

        setPerformanceStats((current) => {
          if (
            current.fps === nextStats.fps &&
            current.frameMs === nextStats.frameMs &&
            current.physicsMs === nextStats.physicsMs &&
            current.nodeCount === nextStats.nodeCount &&
            current.edgeCount === nextStats.edgeCount
          ) {
            return current
          }

          return nextStats
        })

        perf.windowStart = timestamp
        perf.frameCount = 0
        perf.frameMsTotal = 0
        perf.physicsMsTotal = 0
      }

      previousTimestamp = timestamp
      frameId = window.requestAnimationFrame(animate)
    }

    frameId = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [edgesRef, nodesRef, physicsEnabled, physicsRef, setNodes])

  return performanceStats
}
