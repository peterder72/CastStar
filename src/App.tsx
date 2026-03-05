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
import './App.css'
import { fetchRelatedEntities, getImageUrl, searchMulti } from './tmdb'
import {
  entityKey,
  type DiscoverEntity,
  type GraphEdge,
  type GraphNode,
  type NodeKind,
  type NodePhysics,
} from './types'

const SEARCH_DEBOUNCE_MS = 280
const EXPAND_BATCH_SIZE = 10
const MIN_NODE_DISTANCE = 180
const BASE_REPULSION_FORCE = 22000
const POSITION_EPSILON = 0.0005

interface Point {
  x: number
  y: number
}

interface Camera {
  x: number
  y: number
  scale: number
}

interface PhysicsControl {
  key: keyof NodePhysics
  label: string
  min: number
  max: number
  step: number
  precision: number
}

interface EnsureNodeResult {
  key: string
  created: boolean
  blocked: boolean
}

interface HiddenEntity {
  key: string
  title: string
  kind: NodeKind
}

interface NodeContextMenu {
  nodeKey: string
  x: number
  y: number
}

type InputMode = 'mouse' | 'trackpad'

const PHYSICS_CONTROLS: PhysicsControl[] = [
  { key: 'mass', label: 'Mass', min: 0.4, max: 4, step: 0.1, precision: 1 },
  { key: 'repulsion', label: 'Repulsion', min: 0.2, max: 3, step: 0.05, precision: 2 },
  { key: 'springLength', label: 'Spring Length', min: 80, max: 420, step: 5, precision: 0 },
  { key: 'springStrength', label: 'Spring Strength', min: 0.001, max: 0.03, step: 0.001, precision: 3 },
  { key: 'clusterPull', label: 'Cluster Pull', min: 0, max: 0.03, step: 0.001, precision: 3 },
  { key: 'damping', label: 'Damping', min: 0.55, max: 0.99, step: 0.01, precision: 2 },
  { key: 'maxSpeed', label: 'Max Speed', min: 1, max: 18, step: 0.5, precision: 1 },
]

const DEFAULT_PHYSICS: NodePhysics = {
  mass: 1.2,
  repulsion: 1,
  springLength: 190,
  springStrength: 0.009,
  damping: 0.87,
  clusterPull: 0.011,
  maxSpeed: 8,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
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

function isSelfAppearanceRole(role?: string): boolean {
  if (!role) {
    return false
  }

  const normalized = role.toLowerCase().trim()
  return /\b(self|himself|herself|themselves)\b/.test(normalized)
}

function App() {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const panStateRef = useRef({
    active: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
  })

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
  const [contextMenu, setContextMenu] = useState<NodeContextMenu | null>(null)

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const cameraRef = useRef(camera)
  const physicsRef = useRef(physicsSettings)
  const hiddenKeysRef = useRef(new Set<string>())
  const searchRequestRef = useRef(0)
  const relatedCacheRef = useRef<Record<string, DiscoverEntity[]>>({})

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

    event.currentTarget.setPointerCapture(event.pointerId)
    setIsPanning(true)
  }, [])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const state = panStateRef.current

    if (!state.active || state.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - state.lastX
    const deltaY = event.clientY - state.lastY

    state.lastX = event.clientX
    state.lastY = event.clientY

    setCamera((current) => ({
      ...current,
      x: current.x + deltaX,
      y: current.y + deltaY,
    }))
  }, [])

  const stopPanning = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const state = panStateRef.current

    if (!state.active || state.pointerId !== event.pointerId) {
      return
    }

    state.active = false
    state.pointerId = -1

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    setIsPanning(false)
  }, [])

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

      const zoomToPointer = (zoomDelta: number): void => {
        setCamera((current) => {
          const zoomFactor = Math.exp(-zoomDelta * 0.002)
          const nextScale = Math.max(0.3, Math.min(2.4, current.scale * zoomFactor))
          const worldPointX = (localX - current.x) / current.scale
          const worldPointY = (localY - current.y) / current.scale

          return {
            scale: nextScale,
            x: localX - worldPointX * nextScale,
            y: localY - worldPointY * nextScale,
          }
        })
      }

      if (inputMode === 'trackpad') {
        zoomToPointer(event.deltaY)
        return
      }

      if (event.ctrlKey || event.metaKey) {
        zoomToPointer(event.deltaY)
        return
      }

      setCamera((current) => ({
        ...current,
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      }))
    },
    [inputMode],
  )

  useEffect(() => {
    let frameId = 0
    let previousTimestamp: number | null = null

    const animate = (timestamp: number): void => {
      const activeNodes = nodesRef.current
      const keys = Object.keys(activeNodes)

      if (physicsEnabled && keys.length > 1) {
        const settings = physicsRef.current
        const edgesList = Object.values(edgesRef.current)
        const dt = previousTimestamp === null ? 1 : clamp((timestamp - previousTimestamp) / 16.667, 0.5, 2)

        const forces = new Map<string, Point>()
        const degrees = new Map<string, number>()
        keys.forEach((key) => degrees.set(key, 0))

        for (const edge of edgesList) {
          if (!activeNodes[edge.source] || !activeNodes[edge.target]) {
            continue
          }

          degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1)
          degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1)
        }

        const nodeValues = keys.map((key) => activeNodes[key])

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
          const sourceNode = activeNodes[edge.source]
          const targetNode = activeNodes[edge.target]

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
          const node = activeNodes[key]
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

        if (hasMovement) {
          nodesRef.current = nextNodes
          setNodes(nextNodes)
        }
      }

      previousTimestamp = timestamp
      frameId = window.requestAnimationFrame(animate)
    }

    frameId = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [physicsEnabled])

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

  return (
    <div
      className="app-shell"
      onClick={() => {
        setContextMenu(null)
      }}
    >
      <header className="search-panel">
        <form className="search-form" onSubmit={(event) => void submitSearch(event)}>
          <input
            type="search"
            value={query}
            placeholder="Search actor, movie, or TV series"
            onFocus={() => {
              if (searchResults.length > 0) {
                setSearchOpen(true)
              }
            }}
            onChange={(event) => {
              setQuery(event.target.value)
              setErrorMessage(null)
            }}
          />
          <button type="submit" disabled={searchLoading || query.trim().length < 2}>
            {searchLoading ? 'Searching...' : 'Add'}
          </button>
        </form>

        {searchOpen && searchResults.length > 0 && (
          <ul className="search-results" role="listbox">
            {searchResults.map((result) => {
              const imageUrl = getImageUrl(result.imagePath)

              return (
                <li key={entityKey(result)}>
                  <button
                    type="button"
                    className="result-row"
                    onClick={() => chooseSearchResult(result)}
                  >
                    <span className="result-thumb" aria-hidden="true">
                      {imageUrl ? <img src={imageUrl} alt="" /> : result.title.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="result-copy">
                      <span>{result.title}</span>
                      <small>
                        {result.kind.toUpperCase()}
                        {result.subtitle ? ` • ${result.subtitle}` : ''}
                      </small>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="control-toolbar">
          <div className="input-mode-switch" role="group" aria-label="Input mode">
            <button
              type="button"
              className={inputMode === 'mouse' ? 'is-active' : ''}
              onClick={() => setInputMode('mouse')}
            >
              Mouse Mode
            </button>
            <button
              type="button"
              className={inputMode === 'trackpad' ? 'is-active' : ''}
              onClick={() => setInputMode('trackpad')}
            >
              Trackpad Mode
            </button>
          </div>

          <div className="physics-toolbar">
            <label>
              <input
                type="checkbox"
                checked={physicsEnabled}
                onChange={(event) => setPhysicsEnabled(event.target.checked)}
              />
              Live Physics
            </label>
            <button type="button" onClick={coolDownGraph}>
              Stop Motion
            </button>
            <button type="button" onClick={() => setShowPhysicsSettings((current) => !current)}>
              {showPhysicsSettings ? 'Hide Physics' : 'Show Physics'}
            </button>
          </div>
        </div>

        <section className="filter-panel">
          <div className="filter-panel-head">
            <strong>Global Filters</strong>
          </div>

          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={excludeSelfAppearances}
              onChange={(event) => setExcludeSelfAppearances(event.target.checked)}
            />
            Exclude self-appearances ("Self", "Himself", "Herself", talk-show style entries)
          </label>

          <div className="hidden-entities">
            <div className="hidden-entities-head">
              <small>Hidden Entities ({hiddenEntityList.length})</small>
              {hiddenEntityList.length > 0 && (
                <button type="button" onClick={clearHiddenEntities}>
                  Clear Hidden
                </button>
              )}
            </div>

            {hiddenEntityList.length === 0 ? (
              <small className="hidden-empty">No hidden entities.</small>
            ) : (
              <ul className="hidden-entities-list">
                {hiddenEntityList.map((item) => (
                  <li key={item.key}>
                    <span>
                      {item.title} <small>({item.kind.toUpperCase()})</small>
                    </span>
                    <button type="button" onClick={() => unhideEntity(item.key)}>
                      Unhide
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {showPhysicsSettings && (
          <section className="physics-panel">
            <div className="physics-panel-head">
              <strong>Global Physics</strong>
              <small>Applies to all nodes</small>
            </div>

            <div className="physics-controls">
              {PHYSICS_CONTROLS.map((control) => {
                const currentValue = physicsSettings[control.key]

                return (
                  <label key={control.key} className="physics-control">
                    <span>
                      {control.label}
                      <b>{currentValue.toFixed(control.precision)}</b>
                    </span>
                    <input
                      type="range"
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      value={currentValue}
                      onChange={(event) => {
                        setPhysicsSettings((current) => ({
                          ...current,
                          [control.key]: Number.parseFloat(event.target.value),
                        }))
                      }}
                    />
                  </label>
                )
              })}
            </div>

            <div className="physics-panel-actions">
              <button type="button" onClick={resetGlobalPhysics}>
                Reset Physics
              </button>
            </div>
          </section>
        )}

        <p className="hint-text">Click a bubble to load 10 connected results; click again for the next 10.</p>
        <p className="hint-text">Right-click a bubble for hide/prune/delete actions.</p>
        <p className="hint-text">Trackpad mode: scroll to zoom, drag to pan. Mouse mode keeps the original controls.</p>
        {errorMessage && <p className="error-text">{errorMessage}</p>}
      </header>

      <div
        ref={viewportRef}
        className={`canvas ${isPanning ? 'is-panning' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
        onWheel={handleWheel}
        onClick={() => {
          setSelectedNodeKey(null)
          setSearchOpen(false)
          setContextMenu(null)
        }}
      >
        <div
          className="canvas-grid"
          style={{
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
          }}
        />

        <svg className="edges-layer" aria-hidden="true">
          {edgeList.map((edge) => {
            const source = nodes[edge.source]
            const target = nodes[edge.target]

            if (!source || !target) {
              return null
            }

            const sourcePoint = toScreenPoint(source)
            const targetPoint = toScreenPoint(target)

            return (
              <line
                key={edge.key}
                x1={sourcePoint.x}
                y1={sourcePoint.y}
                x2={targetPoint.x}
                y2={targetPoint.y}
              />
            )
          })}
        </svg>

        {nodeList.map((node) => {
          const screenPoint = toScreenPoint(node)
          const imageUrl = getImageUrl(node.imagePath)
          const remaining = getRemainingRelatedCount(node)
          const selected = selectedNodeKey === node.key

          return (
            <button
              key={node.key}
              type="button"
              data-node="true"
              className={`bubble bubble-${node.kind} ${selected ? 'is-selected' : ''}`}
              style={{
                left: `${screenPoint.x}px`,
                top: `${screenPoint.y}px`,
              }}
              onClick={(event) => {
                event.stopPropagation()
                handleNodeClick(node.key)
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setSelectedNodeKey(node.key)
                setContextMenu({
                  nodeKey: node.key,
                  x: event.clientX,
                  y: event.clientY,
                })
              }}
            >
              <span className="bubble-photo" aria-hidden="true">
                {imageUrl ? <img src={imageUrl} alt="" /> : node.title.slice(0, 2).toUpperCase()}
              </span>
              <span className="bubble-copy">
                <strong>{node.title}</strong>
                {node.subtitle && <small>{node.subtitle}</small>}
                <small className="bubble-status">
                  {node.loading
                    ? 'Loading...'
                    : node.totalRelated === 0
                      ? 'Click to expand'
                      : remaining > 0
                        ? `Click for +${Math.min(EXPAND_BATCH_SIZE, remaining)} more`
                        : 'No more new connections'}
                </small>
              </span>
            </button>
          )
        })}
      </div>

      {contextNode && contextMenuPosition && (
        <div
          className="node-context-menu"
          style={{
            left: `${contextMenuPosition.left}px`,
            top: `${contextMenuPosition.top}px`,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <strong>{contextNode.title}</strong>
          <button type="button" onClick={() => hideNodeFromBoard(contextNode.key)}>
            Hide Node (to hidden list)
          </button>
          <button type="button" onClick={() => pruneNodeLeaves(contextNode.key)}>
            Prune Loose Children
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => deleteNodeFromBoard(contextNode.key)}
          >
            Delete Node
          </button>
        </div>
      )}
    </div>
  )
}

export default App
