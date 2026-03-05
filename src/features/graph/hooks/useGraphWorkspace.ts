import {
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  DEFAULT_PHYSICS,
  EXPAND_BATCH_SIZE,
  MIN_NODE_DISTANCE,
  SEARCH_DEBOUNCE_MS,
} from '../constants'
import { stepGraphPhysics } from '../physics'
import type {
  Camera,
  HiddenEntity,
  InputMode,
  NodeContextMenuState,
  PerformanceStats,
  Point,
} from '../uiTypes'
import { clamp, isSelfAppearanceRole } from '../utils'
import { fetchRelatedEntities, searchMulti } from '../../../tmdb'
import {
  entityKey,
  type DiscoverEntity,
  type GraphEdge,
  type GraphNode,
  type NodePhysics,
} from '../../../types'

interface EnsureNodeResult {
  key: string
  created: boolean
  blocked: boolean
}

interface PerfAccumulator {
  windowStart: number | null
  frameCount: number
  frameMsTotal: number
  physicsMsTotal: number
}

const PERF_SAMPLE_WINDOW_MS = 750

export function useGraphWorkspace() {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const panStateRef = useRef({
    active: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
  })
  const panDeltaRef = useRef({
    x: 0,
    y: 0,
  })
  const panFrameRef = useRef<number | null>(null)
  const wheelDeltaRef = useRef({
    zoomDelta: 0,
    panX: 0,
    panY: 0,
    localX: 0,
    localY: 0,
  })
  const wheelFrameRef = useRef<number | null>(null)
  const wheelIdleTimerRef = useRef<number | null>(null)
  const wheelActiveRef = useRef(false)

  const [nodes, setNodes] = useState<Record<string, GraphNode>>({})
  const [edges, setEdges] = useState<Record<string, GraphEdge>>({})
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [query, setQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<DiscoverEntity[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [physicsEnabled, setPhysicsEnabled] = useState(true)
  const [inputMode, setInputMode] = useState<InputMode>('mouse')
  const [physicsSettings, setPhysicsSettings] = useState<NodePhysics>({ ...DEFAULT_PHYSICS })
  const [showPhysicsSettings, setShowPhysicsSettings] = useState(true)
  const [excludeSelfAppearances, setExcludeSelfAppearances] = useState(true)
  const [hiddenEntities, setHiddenEntities] = useState<Record<string, HiddenEntity>>({})
  const [contextMenu, setContextMenu] = useState<NodeContextMenuState | null>(null)
  const [isWheeling, setIsWheeling] = useState(false)
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    fps: 0,
    frameMs: 0,
    physicsMs: 0,
    nodeCount: 0,
    edgeCount: 0,
  })

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const cameraRef = useRef(camera)
  const physicsRef = useRef(physicsSettings)
  const hiddenKeysRef = useRef(new Set<string>())
  const searchRequestRef = useRef(0)
  const relatedCacheRef = useRef<Record<string, DiscoverEntity[]>>({})
  const perfRef = useRef<PerfAccumulator>({
    windowStart: null,
    frameCount: 0,
    frameMsTotal: 0,
    physicsMsTotal: 0,
  })

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  useEffect(() => {
    cameraRef.current = camera
  }, [camera])

  useEffect(() => {
    physicsRef.current = physicsSettings
  }, [physicsSettings])

  useEffect(() => {
    const hiddenKeys = new Set(Object.keys(hiddenEntities))
    hiddenKeysRef.current = hiddenKeys

    setSearchResults((current) => {
      const filtered = current.filter((item) => !hiddenKeys.has(entityKey(item)))
      return filtered.length === current.length ? current : filtered
    })
  }, [hiddenEntities])

  useEffect(() => {
    const currentNodes = nodesRef.current
    let changed = false
    const nextNodes: Record<string, GraphNode> = {}

    for (const [key, node] of Object.entries(currentNodes)) {
      if (node.kind === 'person' && node.expansionCursor !== 0) {
        nextNodes[key] = {
          ...node,
          expansionCursor: 0,
        }
        changed = true
        continue
      }

      nextNodes[key] = node
    }

    if (changed) {
      nodesRef.current = nextNodes
      setNodes(nextNodes)
    }
  }, [excludeSelfAppearances])

  useEffect(() => {
    if (contextMenu && !nodes[contextMenu.nodeKey]) {
      setContextMenu(null)
    }
  }, [contextMenu, nodes])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const rect = viewport.getBoundingClientRect()
    setCamera((current) => {
      if (current.x !== 0 || current.y !== 0) {
        return current
      }

      return {
        x: rect.width / 2,
        y: rect.height / 2,
        scale: 1,
      }
    })
  }, [])

  const worldFromScreen = useCallback((screenX: number, screenY: number): Point => {
    const { x, y, scale } = cameraRef.current
    return {
      x: (screenX - x) / scale,
      y: (screenY - y) / scale,
    }
  }, [])

  const viewportCenterWorld = useCallback((): Point => {
    const viewport = viewportRef.current

    if (!viewport) {
      return { x: 0, y: 0 }
    }

    const rect = viewport.getBoundingClientRect()
    return worldFromScreen(rect.width / 2, rect.height / 2)
  }, [worldFromScreen])

  const resolvePosition = useCallback((candidate: Point): Point => {
    const existing = Object.values(nodesRef.current)

    if (existing.length === 0) {
      return candidate
    }

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const angle = attempt * 1.35
      const radius = attempt === 0 ? 0 : MIN_NODE_DISTANCE * (0.75 + attempt * 0.16)
      const x = candidate.x + Math.cos(angle) * radius
      const y = candidate.y + Math.sin(angle) * radius
      const blocked = existing.some((node) => {
        const dx = node.x - x
        const dy = node.y - y
        return dx * dx + dy * dy < MIN_NODE_DISTANCE * MIN_NODE_DISTANCE
      })

      if (!blocked) {
        return { x, y }
      }
    }

    return candidate
  }, [])

  const shouldSkipRelatedEntity = useCallback(
    (parentNode: GraphNode, candidate: DiscoverEntity): boolean => {
      if (hiddenKeysRef.current.has(entityKey(candidate))) {
        return true
      }

      if (excludeSelfAppearances && parentNode.kind === 'person' && isSelfAppearanceRole(candidate.creditRole)) {
        return true
      }

      return false
    },
    [excludeSelfAppearances],
  )

  const ensureNode = useCallback(
    (entity: DiscoverEntity, preferredPosition?: Point): EnsureNodeResult => {
      const key = entityKey(entity)

      if (hiddenKeysRef.current.has(key)) {
        return { key, created: false, blocked: true }
      }

      const existing = nodesRef.current[key]

      if (existing) {
        return { key, created: false, blocked: false }
      }

      const center = preferredPosition ?? viewportCenterWorld()
      const resolved = resolvePosition(center)
      const nextNode: GraphNode = {
        ...entity,
        key,
        x: resolved.x,
        y: resolved.y,
        vx: 0,
        vy: 0,
        expansionCursor: 0,
        totalRelated: 0,
        loading: false,
      }

      const nextNodes = {
        ...nodesRef.current,
        [key]: nextNode,
      }

      nodesRef.current = nextNodes
      setNodes(nextNodes)

      return { key, created: true, blocked: false }
    },
    [resolvePosition, viewportCenterWorld],
  )

  const patchNode = useCallback((key: string, patch: Partial<GraphNode>): void => {
    const current = nodesRef.current[key]

    if (!current) {
      return
    }

    const nextNodes = {
      ...nodesRef.current,
      [key]: {
        ...current,
        ...patch,
      },
    }

    nodesRef.current = nextNodes
    setNodes(nextNodes)
  }, [])

  const removeNodesFromGraph = useCallback((keysToRemove: Set<string>): void => {
    if (keysToRemove.size === 0) {
      return
    }

    const currentNodes = nodesRef.current
    let hasRemovals = false

    for (const key of keysToRemove) {
      if (currentNodes[key]) {
        hasRemovals = true
        break
      }
    }

    if (!hasRemovals) {
      return
    }

    const nextNodes: Record<string, GraphNode> = {}

    for (const [key, node] of Object.entries(currentNodes)) {
      if (!keysToRemove.has(key)) {
        nextNodes[key] = node
      }
    }

    const nextEdges: Record<string, GraphEdge> = {}

    for (const edge of Object.values(edgesRef.current)) {
      if (!keysToRemove.has(edge.source) && !keysToRemove.has(edge.target)) {
        nextEdges[edge.key] = edge
      }
    }

    nodesRef.current = nextNodes
    edgesRef.current = nextEdges
    setNodes(nextNodes)
    setEdges(nextEdges)
    setSelectedNodeKey((current) => (current && keysToRemove.has(current) ? null : current))
    setContextMenu((current) => (current && keysToRemove.has(current.nodeKey) ? null : current))
  }, [])

  const ensureEdge = useCallback((leftKey: string, rightKey: string): void => {
    if (leftKey === rightKey || hiddenKeysRef.current.has(leftKey) || hiddenKeysRef.current.has(rightKey)) {
      return
    }

    const [source, target] = leftKey < rightKey ? [leftKey, rightKey] : [rightKey, leftKey]
    const key = `${source}|${target}`

    if (edgesRef.current[key]) {
      return
    }

    const nextEdge: GraphEdge = {
      key,
      source,
      target,
    }

    const nextEdges = {
      ...edgesRef.current,
      [key]: nextEdge,
    }

    edgesRef.current = nextEdges
    setEdges(nextEdges)
  }, [])

  const expansionPosition = useCallback(
    (parentNode: GraphNode, absoluteIndex: number): Point => {
      const ring = Math.floor(absoluteIndex / EXPAND_BATCH_SIZE)
      const slot = absoluteIndex % EXPAND_BATCH_SIZE
      const angle = (Math.PI * 2 * slot) / EXPAND_BATCH_SIZE + ring * 0.35
      const radius = 250 + ring * 150

      return resolvePosition({
        x: parentNode.x + Math.cos(angle) * radius,
        y: parentNode.y + Math.sin(angle) * radius,
      })
    },
    [resolvePosition],
  )

  const addSearchEntity = useCallback(
    (entity: DiscoverEntity): boolean => {
      const center = viewportCenterWorld()
      const preferred = {
        x: center.x + (Math.random() - 0.5) * 120,
        y: center.y + (Math.random() - 0.5) * 120,
      }

      const ensured = ensureNode(entity, preferred)

      if (ensured.blocked) {
        setErrorMessage('This entity is currently hidden. Unhide it from the filter panel to add it again.')
        return false
      }

      setSelectedNodeKey(ensured.key)
      setErrorMessage(null)
      return true
    },
    [ensureNode, viewportCenterWorld],
  )

  const hideNodeFromBoard = useCallback(
    (nodeKey: string): void => {
      const node = nodesRef.current[nodeKey]

      if (!node) {
        return
      }

      setHiddenEntities((current) => {
        if (current[nodeKey]) {
          return current
        }

        return {
          ...current,
          [nodeKey]: {
            key: node.key,
            title: node.title,
            kind: node.kind,
          },
        }
      })

      removeNodesFromGraph(new Set([nodeKey]))
      setContextMenu(null)
      setErrorMessage(null)
    },
    [removeNodesFromGraph],
  )

  const deleteNodeFromBoard = useCallback(
    (nodeKey: string): void => {
      removeNodesFromGraph(new Set([nodeKey]))
      setContextMenu(null)
      setErrorMessage(null)
    },
    [removeNodesFromGraph],
  )

  const pruneNodeLeaves = useCallback(
    (nodeKey: string): void => {
      if (!nodesRef.current[nodeKey]) {
        return
      }

      const edgeList = Object.values(edgesRef.current)
      const degrees = new Map<string, number>()

      for (const key of Object.keys(nodesRef.current)) {
        degrees.set(key, 0)
      }

      for (const edge of edgeList) {
        if (!nodesRef.current[edge.source] || !nodesRef.current[edge.target]) {
          continue
        }

        degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1)
        degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1)
      }

      const removable = new Set<string>()

      for (const edge of edgeList) {
        if (edge.source === nodeKey) {
          if ((degrees.get(edge.target) ?? 0) <= 1) {
            removable.add(edge.target)
          }
          continue
        }

        if (edge.target === nodeKey && (degrees.get(edge.source) ?? 0) <= 1) {
          removable.add(edge.source)
        }
      }

      if (removable.size === 0) {
        setErrorMessage('No loose direct children were found to prune.')
        setContextMenu(null)
        return
      }

      removeNodesFromGraph(removable)
      setContextMenu(null)
      setErrorMessage(null)
    },
    [removeNodesFromGraph],
  )

  const expandNode = useCallback(
    async (nodeKey: string): Promise<void> => {
      const node = nodesRef.current[nodeKey]

      if (!node || node.loading) {
        return
      }

      patchNode(nodeKey, { loading: true })
      setErrorMessage(null)

      try {
        let related = relatedCacheRef.current[nodeKey]

        if (!related) {
          related = await fetchRelatedEntities(node)
          relatedCacheRef.current[nodeKey] = related
        }

        const latestNode = nodesRef.current[nodeKey]

        if (!latestNode) {
          return
        }

        const start = latestNode.expansionCursor
        const batch: DiscoverEntity[] = []
        let cursor = start

        while (cursor < related.length && batch.length < EXPAND_BATCH_SIZE) {
          const candidate = related[cursor]
          cursor += 1

          if (shouldSkipRelatedEntity(latestNode, candidate)) {
            continue
          }

          batch.push(candidate)
        }

        if (batch.length === 0) {
          patchNode(nodeKey, {
            loading: false,
            expansionCursor: cursor,
            totalRelated: related.length,
          })
          return
        }

        batch.forEach((entity, index) => {
          const childPosition = expansionPosition(latestNode, start + index)
          const ensured = ensureNode(entity, childPosition)

          if (ensured.blocked) {
            return
          }

          ensureEdge(nodeKey, ensured.key)
        })

        patchNode(nodeKey, {
          loading: false,
          expansionCursor: cursor,
          totalRelated: related.length,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch from TMDB.'
        patchNode(nodeKey, { loading: false })
        setErrorMessage(message)
      }
    },
    [ensureEdge, ensureNode, expansionPosition, patchNode, shouldSkipRelatedEntity],
  )

  const chooseSearchResult = useCallback(
    (entity: DiscoverEntity): void => {
      const added = addSearchEntity(entity)

      if (!added) {
        return
      }

      setQuery('')
      setSearchResults([])
      setSearchOpen(false)
    },
    [addSearchEntity],
  )

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 2) {
      setSearchResults([])
      setSearchOpen(false)
      setSearchLoading(false)
      return
    }

    const requestId = searchRequestRef.current + 1
    searchRequestRef.current = requestId

    setSearchLoading(true)

    const timerId = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await searchMulti(trimmedQuery)

          if (requestId !== searchRequestRef.current) {
            return
          }

          const filteredResults = results.filter((entity) => !hiddenKeysRef.current.has(entityKey(entity)))
          setSearchResults(filteredResults)
          setSearchOpen(true)
        } catch (error) {
          if (requestId !== searchRequestRef.current) {
            return
          }

          setErrorMessage(error instanceof Error ? error.message : 'Search request failed.')
          setSearchResults([])
          setSearchOpen(false)
        } finally {
          if (requestId === searchRequestRef.current) {
            setSearchLoading(false)
          }
        }
      })()
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [query])

  const submitSearch = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault()
      const trimmedQuery = query.trim()

      if (trimmedQuery.length < 2) {
        return
      }

      if (searchResults.length > 0) {
        chooseSearchResult(searchResults[0])
        return
      }

      try {
        setSearchLoading(true)
        const results = await searchMulti(trimmedQuery)
        const filteredResults = results.filter((entity) => !hiddenKeysRef.current.has(entityKey(entity)))
        setSearchResults(filteredResults)
        setSearchOpen(true)

        if (filteredResults[0]) {
          chooseSearchResult(filteredResults[0])
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Search request failed.')
      } finally {
        setSearchLoading(false)
      }
    },
    [chooseSearchResult, query, searchResults],
  )

  const handleNodeClick = useCallback(
    (nodeKey: string): void => {
      setSelectedNodeKey(nodeKey)
      setContextMenu(null)
      void expandNode(nodeKey)
    },
    [expandNode],
  )

  const toScreenPoint = useCallback(
    (node: GraphNode): Point => ({
      x: node.x * camera.scale + camera.x,
      y: node.y * camera.scale + camera.y,
    }),
    [camera],
  )

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement

    if (target.closest('[data-node]')) {
      return
    }

    panStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    }
    panDeltaRef.current.x = 0
    panDeltaRef.current.y = 0

    event.currentTarget.setPointerCapture(event.pointerId)
    setIsPanning(true)
  }, [])

  const flushPanDelta = useCallback((): void => {
    const pending = panDeltaRef.current

    if (pending.x === 0 && pending.y === 0) {
      return
    }

    const deltaX = pending.x
    const deltaY = pending.y
    pending.x = 0
    pending.y = 0

    setCamera((current) => ({
      ...current,
      x: current.x + deltaX,
      y: current.y + deltaY,
    }))
  }, [])

  const schedulePanFrame = useCallback((): void => {
    if (panFrameRef.current !== null) {
      return
    }

    panFrameRef.current = window.requestAnimationFrame(() => {
      panFrameRef.current = null
      flushPanDelta()
    })
  }, [flushPanDelta])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const state = panStateRef.current

    if (!state.active || state.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - state.lastX
    const deltaY = event.clientY - state.lastY

    state.lastX = event.clientX
    state.lastY = event.clientY

    panDeltaRef.current.x += deltaX
    panDeltaRef.current.y += deltaY
    schedulePanFrame()
  }, [schedulePanFrame])

  const stopPanning = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const state = panStateRef.current

    if (!state.active || state.pointerId !== event.pointerId) {
      return
    }

    state.active = false
    state.pointerId = -1

    if (panFrameRef.current !== null) {
      window.cancelAnimationFrame(panFrameRef.current)
      panFrameRef.current = null
    }
    flushPanDelta()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    setIsPanning(false)
  }, [flushPanDelta])

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>): void => {
      event.preventDefault()

      const viewport = viewportRef.current

      if (!viewport) {
        return
      }

      const bounds = viewport.getBoundingClientRect()
      const localX = event.clientX - bounds.left
      const localY = event.clientY - bounds.top

      const flushWheelDelta = (): void => {
        const pending = wheelDeltaRef.current
        const hasPan = pending.panX !== 0 || pending.panY !== 0
        const hasZoom = pending.zoomDelta !== 0

        if (!hasPan && !hasZoom) {
          return
        }

        const panX = pending.panX
        const panY = pending.panY
        const zoomDelta = pending.zoomDelta
        const anchorX = pending.localX
        const anchorY = pending.localY

        pending.panX = 0
        pending.panY = 0
        pending.zoomDelta = 0

        setCamera((current) => {
          let next = current

          if (hasPan) {
            next = {
              ...next,
              x: next.x - panX,
              y: next.y - panY,
            }
          }

          if (hasZoom) {
            const zoomFactor = Math.exp(-zoomDelta * 0.002)
            const nextScale = Math.max(0.3, Math.min(2.4, next.scale * zoomFactor))
            const worldPointX = (anchorX - next.x) / next.scale
            const worldPointY = (anchorY - next.y) / next.scale

            next = {
              scale: nextScale,
              x: anchorX - worldPointX * nextScale,
              y: anchorY - worldPointY * nextScale,
            }
          }

          return next
        })
      }

      if (!wheelActiveRef.current) {
        wheelActiveRef.current = true
        setIsWheeling(true)
      }

      if (wheelIdleTimerRef.current !== null) {
        window.clearTimeout(wheelIdleTimerRef.current)
      }

      wheelIdleTimerRef.current = window.setTimeout(() => {
        wheelActiveRef.current = false
        wheelIdleTimerRef.current = null
        setIsWheeling(false)
      }, 140)

      const pending = wheelDeltaRef.current
      const zoomInput = inputMode === 'trackpad' || event.ctrlKey || event.metaKey

      if (zoomInput) {
        pending.zoomDelta += event.deltaY
        pending.localX = localX
        pending.localY = localY
      } else {
        pending.panX += event.deltaX
        pending.panY += event.deltaY
      }

      if (wheelFrameRef.current === null) {
        wheelFrameRef.current = window.requestAnimationFrame(() => {
          wheelFrameRef.current = null
          flushWheelDelta()
        })
      }
    },
    [inputMode],
  )

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
  }, [physicsEnabled])

  useEffect(() => {
    return () => {
      if (panFrameRef.current !== null) {
        window.cancelAnimationFrame(panFrameRef.current)
      }

      if (wheelFrameRef.current !== null) {
        window.cancelAnimationFrame(wheelFrameRef.current)
      }

      if (wheelIdleTimerRef.current !== null) {
        window.clearTimeout(wheelIdleTimerRef.current)
      }
    }
  }, [])

  const resetGlobalPhysics = useCallback((): void => {
    setPhysicsSettings({ ...DEFAULT_PHYSICS })
  }, [])

  const coolDownGraph = useCallback((): void => {
    const activeNodes = nodesRef.current
    const keys = Object.keys(activeNodes)

    if (keys.length === 0) {
      return
    }

    const nextNodes: Record<string, GraphNode> = {}

    for (const key of keys) {
      const node = activeNodes[key]
      nextNodes[key] = {
        ...node,
        vx: 0,
        vy: 0,
      }
    }

    nodesRef.current = nextNodes
    setNodes(nextNodes)
  }, [])

  const unhideEntity = useCallback((key: string): void => {
    setHiddenEntities((current) => {
      if (!current[key]) {
        return current
      }

      const next = { ...current }
      delete next[key]
      return next
    })
  }, [])

  const clearHiddenEntities = useCallback((): void => {
    setHiddenEntities({})
  }, [])

  const getRemainingRelatedCount = useCallback(
    (node: GraphNode): number => {
      const related = relatedCacheRef.current[node.key]

      if (!related) {
        return 0
      }

      let remaining = 0

      for (let index = node.expansionCursor; index < related.length; index += 1) {
        if (!shouldSkipRelatedEntity(node, related[index])) {
          remaining += 1
        }
      }

      return remaining
    },
    [shouldSkipRelatedEntity],
  )

  const nodeList = useMemo(() => Object.values(nodes), [nodes])
  const edgeList = useMemo(() => Object.values(edges), [edges])

  const hiddenEntityList = useMemo(
    () => Object.values(hiddenEntities).sort((left, right) => left.title.localeCompare(right.title)),
    [hiddenEntities],
  )

  const contextNode = contextMenu ? nodes[contextMenu.nodeKey] ?? null : null

  const contextMenuPosition = useMemo(() => {
    if (!contextMenu) {
      return null
    }

    const menuWidth = 240
    const menuHeight = 160
    const maxX = typeof window === 'undefined' ? contextMenu.x : window.innerWidth - menuWidth - 10
    const maxY = typeof window === 'undefined' ? contextMenu.y : window.innerHeight - menuHeight - 10

    return {
      left: Math.max(10, Math.min(contextMenu.x, maxX)),
      top: Math.max(10, Math.min(contextMenu.y, maxY)),
    }
  }, [contextMenu])

  const gridSize = Math.max(20, Math.min(120, Math.round(48 * camera.scale)))
  const gridOffsetX = ((camera.x % gridSize) + gridSize) % gridSize
  const gridOffsetY = ((camera.y % gridSize) + gridSize) % gridSize

  const handleQueryChange = useCallback((value: string): void => {
    setQuery(value)
    setErrorMessage(null)
  }, [])

  const handleSearchFocus = useCallback((): void => {
    if (searchResults.length > 0) {
      setSearchOpen(true)
    }
  }, [searchResults])

  const togglePhysicsSettings = useCallback((): void => {
    setShowPhysicsSettings((current) => !current)
  }, [])

  const updatePhysicsSetting = useCallback((key: keyof NodePhysics, value: number): void => {
    setPhysicsSettings((current) => ({
      ...current,
      [key]: value,
    }))
  }, [])

  const clearCanvasSelection = useCallback((): void => {
    setSelectedNodeKey(null)
    setSearchOpen(false)
    setContextMenu(null)
  }, [])

  const openNodeContextMenu = useCallback((nodeKey: string, x: number, y: number): void => {
    setSelectedNodeKey(nodeKey)
    setContextMenu({
      nodeKey,
      x,
      y,
    })
  }, [])

  const dismissContextMenu = useCallback((): void => {
    setContextMenu(null)
  }, [])

  return {
    viewportRef,
    nodes,
    isPanning,
    query,
    searchLoading,
    searchResults,
    searchOpen,
    selectedNodeKey,
    errorMessage,
    physicsEnabled,
    isWheeling,
    inputMode,
    physicsSettings,
    showPhysicsSettings,
    excludeSelfAppearances,
    hiddenEntityList,
    performanceStats,
    contextNode,
    contextMenuPosition,
    gridSize,
    gridOffsetX,
    gridOffsetY,
    nodeList,
    edgeList,
    submitSearch,
    chooseSearchResult,
    setInputMode,
    setPhysicsEnabled,
    setExcludeSelfAppearances,
    coolDownGraph,
    resetGlobalPhysics,
    clearHiddenEntities,
    unhideEntity,
    hideNodeFromBoard,
    pruneNodeLeaves,
    deleteNodeFromBoard,
    handlePointerDown,
    handlePointerMove,
    stopPanning,
    handleWheel,
    handleNodeClick,
    toScreenPoint,
    getRemainingRelatedCount,
    handleQueryChange,
    handleSearchFocus,
    togglePhysicsSettings,
    updatePhysicsSetting,
    clearCanvasSelection,
    openNodeContextMenu,
    dismissContextMenu,
  }
}
