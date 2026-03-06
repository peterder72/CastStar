import {
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { EXPAND_BATCH_SIZE, MIN_NODE_DISTANCE } from '../constants'
import type { Camera, HiddenEntity, NodeContextMenuState, Point } from '../uiTypes'
import { isSelfAppearanceRole } from '../utils'
import { fetchRelatedEntities, isAbortError } from '../../../tmdb'
import {
  computeRemainingRelatedCountByNode,
  deleteRelatedCacheEntries,
  setRelatedCacheEntry,
  touchRelatedCacheEntry,
} from './relatedCache'
import {
  entityKey,
  type DiscoverEntity,
  type GraphEdge,
  type GraphNode,
} from '../../../types'

interface EnsureNodeResult {
  key: string
  created: boolean
  blocked: boolean
}

interface UseGraphDataParams {
  viewportRef: RefObject<HTMLDivElement | null>
  cameraRef: MutableRefObject<Camera>
}

interface UseGraphDataResult {
  nodes: Record<string, GraphNode>
  edges: Record<string, GraphEdge>
  nodesRef: MutableRefObject<Record<string, GraphNode>>
  edgesRef: MutableRefObject<Record<string, GraphEdge>>
  setNodes: Dispatch<SetStateAction<Record<string, GraphNode>>>
  nodeList: GraphNode[]
  edgeList: GraphEdge[]
  selectedNodeKey: string | null
  errorMessage: string | null
  setErrorMessage: Dispatch<SetStateAction<string | null>>
  excludeSelfAppearances: boolean
  setExcludeSelfAppearances: Dispatch<SetStateAction<boolean>>
  includeCrewConnections: boolean
  setIncludeCrewConnections: Dispatch<SetStateAction<boolean>>
  hiddenEntityList: HiddenEntity[]
  hiddenEntityKeys: string[]
  contextNode: GraphNode | null
  contextMenuPosition: { left: number; top: number } | null
  addSearchEntity: (entity: DiscoverEntity) => boolean
  clearAllGraph: () => void
  clearHiddenEntities: () => void
  unhideEntity: (key: string) => void
  hideNodeFromBoard: (nodeKey: string) => void
  pruneNodeLeaves: (nodeKey: string) => void
  deleteNodeFromBoard: (nodeKey: string) => void
  loadRelatedSelectionOptions: (nodeKey: string) => Promise<DiscoverEntity[]>
  getConnectedNodeKeyList: (nodeKey: string) => string[]
  addSelectedRelations: (nodeKey: string, relationKeys: string[]) => Promise<AddSelectedRelationsResult>
  handleNodeClick: (nodeKey: string) => void
  getRemainingRelatedCount: (node: GraphNode) => number
  clearCanvasSelection: () => void
  openNodeContextMenu: (nodeKey: string, x: number, y: number) => void
  dismissContextMenu: () => void
}

interface AddSelectedRelationsResult {
  added: number
  alreadyConnected: number
  hidden: number
  missing: number
}

function toAbortError(): Error {
  const error = new Error('Request aborted.')
  error.name = 'AbortError'
  return error
}

function withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise
  }

  if (signal.aborted) {
    return Promise.reject(toAbortError())
  }

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => {
      cleanup()
      reject(toAbortError())
    }
    const cleanup = () => {
      signal.removeEventListener('abort', handleAbort)
    }

    signal.addEventListener('abort', handleAbort, { once: true })

    promise.then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error) => {
        cleanup()
        reject(error)
      },
    )
  })
}

export function useGraphData({ viewportRef, cameraRef }: UseGraphDataParams): UseGraphDataResult {
  const [nodes, setNodes] = useState<Record<string, GraphNode>>({})
  const [edges, setEdges] = useState<Record<string, GraphEdge>>({})
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [excludeSelfAppearances, setExcludeSelfAppearancesState] = useState(true)
  const [includeCrewConnections, setIncludeCrewConnectionsState] = useState(false)
  const [hiddenEntities, setHiddenEntities] = useState<Record<string, HiddenEntity>>({})
  const [contextMenu, setContextMenu] = useState<NodeContextMenuState | null>(null)
  const [relatedCacheSnapshot, setRelatedCacheSnapshot] = useState<Map<string, DiscoverEntity[]>>(new Map())
  const [replayQueueSnapshot, setReplayQueueSnapshot] = useState<Record<string, string[]>>({})

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const hiddenKeysRef = useRef(new Set<string>())
  const hiddenEntitiesRef = useRef(hiddenEntities)
  const relatedCacheRef = useRef<Map<string, DiscoverEntity[]>>(new Map())
  const relatedRequestRef = useRef<Record<string, Promise<DiscoverEntity[]>>>({})
  const relatedAbortControllerRef = useRef<Record<string, AbortController>>({})
  const replayQueueRef = useRef<Record<string, string[]>>({})
  const excludeSelfAppearancesRef = useRef(excludeSelfAppearances)
  const includeCrewConnectionsRef = useRef(includeCrewConnections)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  useEffect(() => {
    hiddenKeysRef.current = new Set(Object.keys(hiddenEntities))
    hiddenEntitiesRef.current = hiddenEntities
  }, [hiddenEntities])

  useEffect(() => {
    excludeSelfAppearancesRef.current = excludeSelfAppearances
  }, [excludeSelfAppearances])

  useEffect(() => {
    includeCrewConnectionsRef.current = includeCrewConnections
  }, [includeCrewConnections])

  const hiddenKeySet = useMemo(() => new Set(Object.keys(hiddenEntities)), [hiddenEntities])

  useEffect(() => {
    return () => {
      const activeControllers = Object.values(relatedAbortControllerRef.current)
      for (const controller of activeControllers) {
        controller.abort()
      }

      relatedAbortControllerRef.current = {}
      relatedRequestRef.current = {}
    }
  }, [])

  const setExcludeSelfAppearances = useCallback<Dispatch<SetStateAction<boolean>>>((value) => {
    const previousValue = excludeSelfAppearancesRef.current
    const nextValue = typeof value === 'function' ? (value as (previous: boolean) => boolean)(previousValue) : value

    if (nextValue === previousValue) {
      return
    }

    excludeSelfAppearancesRef.current = nextValue
    setExcludeSelfAppearancesState(nextValue)

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
  }, [])

  const setIncludeCrewConnections = useCallback<Dispatch<SetStateAction<boolean>>>((value) => {
    const previousValue = includeCrewConnectionsRef.current
    const nextValue = typeof value === 'function' ? (value as (previous: boolean) => boolean)(previousValue) : value

    if (nextValue === previousValue) {
      return
    }

    includeCrewConnectionsRef.current = nextValue
    setIncludeCrewConnectionsState(nextValue)

    const currentNodes = nodesRef.current
    let changed = false
    const nextNodes: Record<string, GraphNode> = {}

    for (const [key, node] of Object.entries(currentNodes)) {
      if (node.expansionCursor !== 0) {
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
  }, [])

  const worldFromScreen = useCallback(
    (screenX: number, screenY: number): Point => {
      const { x, y, scale } = cameraRef.current
      return {
        x: (screenX - x) / scale,
        y: (screenY - y) / scale,
      }
    },
    [cameraRef],
  )

  const viewportCenterWorld = useCallback((): Point => {
    const viewport = viewportRef.current

    if (!viewport) {
      return { x: 0, y: 0 }
    }

    const rect = viewport.getBoundingClientRect()
    return worldFromScreen(rect.width / 2, rect.height / 2)
  }, [viewportRef, worldFromScreen])

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
      if (hiddenKeySet.has(entityKey(candidate))) {
        return true
      }

      if (excludeSelfAppearances && parentNode.kind === 'person' && isSelfAppearanceRole(candidate.creditRole)) {
        return true
      }

      if (!includeCrewConnections && candidate.creditCategory === 'crew') {
        return true
      }

      return false
    },
    [excludeSelfAppearances, hiddenKeySet, includeCrewConnections],
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

  const publishRelatedCacheSnapshot = useCallback((): void => {
    setRelatedCacheSnapshot(new Map(relatedCacheRef.current))
  }, [])

  const publishReplayQueueSnapshot = useCallback((): void => {
    setReplayQueueSnapshot({ ...replayQueueRef.current })
  }, [])

  const abortRelatedRequests = useCallback((keys: Iterable<string>): void => {
    const nextControllers = { ...relatedAbortControllerRef.current }
    const nextRequests = { ...relatedRequestRef.current }
    let changed = false

    for (const key of keys) {
      const controller = nextControllers[key]

      if (controller) {
        controller.abort()
        delete nextControllers[key]
        changed = true
      }

      if (key in nextRequests) {
        delete nextRequests[key]
        changed = true
      }
    }

    if (changed) {
      relatedAbortControllerRef.current = nextControllers
      relatedRequestRef.current = nextRequests
    }
  }, [])

  const removeNodesFromGraph = useCallback((
    keysToRemove: Set<string>,
    options?: {
      preserveRelatedCacheKeys?: Set<string>
    },
  ): void => {
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

    if (Object.keys(replayQueueRef.current).length > 0) {
      const nextReplayQueue = { ...replayQueueRef.current }

      for (const key of keysToRemove) {
        delete nextReplayQueue[key]
      }

      replayQueueRef.current = nextReplayQueue
      publishReplayQueueSnapshot()
    }

    const keysToEvict = new Set<string>()
    const preservedKeys = options?.preserveRelatedCacheKeys

    for (const key of keysToRemove) {
      if (!preservedKeys || !preservedKeys.has(key)) {
        keysToEvict.add(key)
      }
    }

    if (keysToEvict.size > 0) {
      abortRelatedRequests(keysToEvict)
      deleteRelatedCacheEntries(relatedCacheRef.current, keysToEvict)
      publishRelatedCacheSnapshot()
    }

    nodesRef.current = nextNodes
    edgesRef.current = nextEdges
    setNodes(nextNodes)
    setEdges(nextEdges)
    setSelectedNodeKey((current) => (current && keysToRemove.has(current) ? null : current))
    setContextMenu((current) => (current && keysToRemove.has(current.nodeKey) ? null : current))
  }, [abortRelatedRequests, publishRelatedCacheSnapshot, publishReplayQueueSnapshot])

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

  const getConnectedNodeKeys = useCallback((nodeKey: string): Set<string> => {
    const connected = new Set<string>()

    for (const edge of Object.values(edgesRef.current)) {
      if (edge.source === nodeKey) {
        connected.add(edge.target)
        continue
      }

      if (edge.target === nodeKey) {
        connected.add(edge.source)
      }
    }

    return connected
  }, [])

  const queueReplayEntities = useCallback((nodeKey: string, keys: Iterable<string>): void => {
    const requested = new Set(keys)

    if (requested.size === 0) {
      return
    }

    const related = touchRelatedCacheEntry(relatedCacheRef.current, nodeKey)

    if (!related) {
      return
    }

    const existingQueue = replayQueueRef.current[nodeKey] ?? []
    const orderedKeys: string[] = []

    for (const candidate of related) {
      const candidateKey = entityKey(candidate)

      if (requested.has(candidateKey)) {
        orderedKeys.push(candidateKey)
      }
    }

    if (orderedKeys.length === 0) {
      return
    }

    const seen = new Set(existingQueue)
    const mergedQueue = [...existingQueue]

    for (const candidateKey of orderedKeys) {
      if (!seen.has(candidateKey)) {
        mergedQueue.push(candidateKey)
        seen.add(candidateKey)
      }
    }

    replayQueueRef.current = {
      ...replayQueueRef.current,
      [nodeKey]: mergedQueue,
    }
    publishReplayQueueSnapshot()
  }, [publishReplayQueueSnapshot])

  const restoreHiddenEntityToGraph = useCallback(
    (item: HiddenEntity): void => {
      const snapshot = item.nodeSnapshot

      if (snapshot && !nodesRef.current[item.key]) {
        const nextNodes = {
          ...nodesRef.current,
          [item.key]: {
            ...snapshot,
            loading: false,
          },
        }

        nodesRef.current = nextNodes
        setNodes(nextNodes)
      }

      if (!nodesRef.current[item.key]) {
        return
      }

      for (const connectedKey of item.connectionKeys ?? []) {
        if (!nodesRef.current[connectedKey] || hiddenKeysRef.current.has(connectedKey)) {
          continue
        }

        ensureEdge(item.key, connectedKey)
      }
    },
    [ensureEdge],
  )

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

  const getOrFetchRelatedEntities = useCallback(
    async (nodeKey: string, signal?: AbortSignal): Promise<DiscoverEntity[]> => {
      const cached = touchRelatedCacheEntry(relatedCacheRef.current, nodeKey)

      if (cached) {
        return cached
      }

      const inFlightRequest = relatedRequestRef.current[nodeKey]

      if (inFlightRequest) {
        return withSignal(inFlightRequest, signal)
      }

      const node = nodesRef.current[nodeKey]

      if (!node) {
        return []
      }

      const controller = new AbortController()
      const externalSignal = signal

      const handleExternalAbort = () => {
        controller.abort()
      }

      if (externalSignal) {
        if (externalSignal.aborted) {
          controller.abort()
        } else {
          externalSignal.addEventListener('abort', handleExternalAbort, { once: true })
        }
      }

      relatedAbortControllerRef.current = {
        ...relatedAbortControllerRef.current,
        [nodeKey]: controller,
      }

      const request = fetchRelatedEntities(node, {
        signal: controller.signal,
      })
        .then((related) => {
          setRelatedCacheEntry(relatedCacheRef.current, nodeKey, related)
          publishRelatedCacheSnapshot()
          return related
        })
        .finally(() => {
          if (externalSignal) {
            externalSignal.removeEventListener('abort', handleExternalAbort)
          }

          const nextRequests = { ...relatedRequestRef.current }
          delete nextRequests[nodeKey]
          relatedRequestRef.current = nextRequests

          const nextControllers = { ...relatedAbortControllerRef.current }
          delete nextControllers[nodeKey]
          relatedAbortControllerRef.current = nextControllers
        })

      relatedRequestRef.current = {
        ...relatedRequestRef.current,
        [nodeKey]: request,
      }

      return withSignal(request, signal)
    },
    [publishRelatedCacheSnapshot],
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

      const connectedNodeKeys = Array.from(getConnectedNodeKeys(nodeKey))

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
            nodeSnapshot: {
              ...node,
              loading: false,
            },
            connectionKeys: connectedNodeKeys,
          },
        }
      })

      removeNodesFromGraph(new Set([nodeKey]), {
        preserveRelatedCacheKeys: new Set([nodeKey]),
      })
      setContextMenu(null)
      setErrorMessage(null)
    },
    [getConnectedNodeKeys, removeNodesFromGraph],
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

      queueReplayEntities(nodeKey, removable)
      removeNodesFromGraph(removable)
      setContextMenu(null)
      setErrorMessage(null)
    },
    [queueReplayEntities, removeNodesFromGraph],
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
        const related = await getOrFetchRelatedEntities(nodeKey)

        const latestNode = nodesRef.current[nodeKey]

        if (!latestNode) {
          return
        }

        const start = latestNode.expansionCursor
        const batch: DiscoverEntity[] = []
        const batchKeys = new Set<string>()
        const relatedByKey = new Map<string, DiscoverEntity>()
        const connectedKeys = getConnectedNodeKeys(nodeKey)
        let cursor = start

        for (const candidate of related) {
          relatedByKey.set(entityKey(candidate), candidate)
        }

        const replayQueue = replayQueueRef.current[nodeKey] ?? []

        if (replayQueue.length > 0) {
          const deferredQueue: string[] = []

          for (const replayKey of replayQueue) {
            if (batch.length >= EXPAND_BATCH_SIZE) {
              deferredQueue.push(replayKey)
              continue
            }

            if (batchKeys.has(replayKey) || connectedKeys.has(replayKey)) {
              continue
            }

            const candidate = relatedByKey.get(replayKey)

            if (!candidate) {
              continue
            }

            if (shouldSkipRelatedEntity(latestNode, candidate)) {
              deferredQueue.push(replayKey)
              continue
            }

            batch.push(candidate)
            batchKeys.add(replayKey)
          }

          if (deferredQueue.length > 0) {
            replayQueueRef.current = {
              ...replayQueueRef.current,
              [nodeKey]: deferredQueue,
            }
            publishReplayQueueSnapshot()
          } else {
            const nextReplayQueue = { ...replayQueueRef.current }
            delete nextReplayQueue[nodeKey]
            replayQueueRef.current = nextReplayQueue
            publishReplayQueueSnapshot()
          }
        }

        while (cursor < related.length && batch.length < EXPAND_BATCH_SIZE) {
          const candidate = related[cursor]
          const candidateKey = entityKey(candidate)
          cursor += 1

          if (batchKeys.has(candidateKey) || connectedKeys.has(candidateKey)) {
            continue
          }

          if (shouldSkipRelatedEntity(latestNode, candidate)) {
            continue
          }

          batch.push(candidate)
          batchKeys.add(candidateKey)
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
        patchNode(nodeKey, { loading: false })

        if (isAbortError(error)) {
          return
        }

        const message = error instanceof Error ? error.message : 'Failed to fetch from TMDB.'
        setErrorMessage(message)
      }
    },
    [
      ensureEdge,
      ensureNode,
      expansionPosition,
      getConnectedNodeKeys,
      getOrFetchRelatedEntities,
      patchNode,
      publishReplayQueueSnapshot,
      shouldSkipRelatedEntity,
    ],
  )

  const loadRelatedSelectionOptions = useCallback(
    async (nodeKey: string): Promise<DiscoverEntity[]> => {
      try {
        const related = await getOrFetchRelatedEntities(nodeKey)
        const node = nodesRef.current[nodeKey]

        if (!node) {
          return []
        }

        const filteredRelated = related.filter((candidate) => !shouldSkipRelatedEntity(node, candidate))

        patchNode(nodeKey, {
          totalRelated: related.length,
        })

        return filteredRelated
      } catch (error) {
        if (isAbortError(error)) {
          return []
        }

        const message = error instanceof Error ? error.message : 'Failed to fetch from TMDB.'
        setErrorMessage(message)
        throw error
      }
    },
    [getOrFetchRelatedEntities, patchNode, shouldSkipRelatedEntity],
  )

  const getConnectedNodeKeyList = useCallback(
    (nodeKey: string): string[] => {
      return Array.from(getConnectedNodeKeys(nodeKey))
    },
    [getConnectedNodeKeys],
  )

  const addSelectedRelations = useCallback(
    async (nodeKey: string, relationKeys: string[]): Promise<AddSelectedRelationsResult> => {
      const parentNode = nodesRef.current[nodeKey]

      if (!parentNode || relationKeys.length === 0) {
        return {
          added: 0,
          alreadyConnected: 0,
          hidden: 0,
          missing: 0,
        }
      }

      let related: DiscoverEntity[]

      try {
        related = await getOrFetchRelatedEntities(nodeKey)
      } catch (error) {
        if (isAbortError(error)) {
          return {
            added: 0,
            alreadyConnected: 0,
            hidden: 0,
            missing: 0,
          }
        }

        const message = error instanceof Error ? error.message : 'Failed to fetch from TMDB.'
        setErrorMessage(message)
        throw error
      }

      const relatedByKey = new Map<string, DiscoverEntity>()

      for (const candidate of related) {
        relatedByKey.set(entityKey(candidate), candidate)
      }

      const connectedKeys = getConnectedNodeKeys(nodeKey)
      let added = 0
      let alreadyConnected = 0
      let hidden = 0
      let missing = 0

      for (const relationKey of relationKeys) {
        const candidate = relatedByKey.get(relationKey)

        if (!candidate) {
          missing += 1
          continue
        }

        if (connectedKeys.has(relationKey)) {
          alreadyConnected += 1
          continue
        }

        if (shouldSkipRelatedEntity(parentNode, candidate)) {
          continue
        }

        const childPosition = expansionPosition(parentNode, parentNode.expansionCursor + added)
        const ensured = ensureNode(candidate, childPosition)

        if (ensured.blocked) {
          hidden += 1
          continue
        }

        ensureEdge(nodeKey, ensured.key)
        connectedKeys.add(ensured.key)
        added += 1
      }

      patchNode(nodeKey, {
        totalRelated: related.length,
      })
      setErrorMessage(null)

      return {
        added,
        alreadyConnected,
        hidden,
        missing,
      }
    },
    [ensureEdge, ensureNode, expansionPosition, getConnectedNodeKeys, getOrFetchRelatedEntities, patchNode, shouldSkipRelatedEntity],
  )

  const handleNodeClick = useCallback(
    (nodeKey: string): void => {
      setSelectedNodeKey(nodeKey)
      setContextMenu(null)
      void expandNode(nodeKey)
    },
    [expandNode],
  )

  const clearAllGraph = useCallback((): void => {
    abortRelatedRequests(Object.keys(relatedAbortControllerRef.current))
    nodesRef.current = {}
    edgesRef.current = {}
    relatedCacheRef.current = new Map()
    replayQueueRef.current = {}
    setRelatedCacheSnapshot(new Map())
    setReplayQueueSnapshot({})
    setNodes({})
    setEdges({})
    setSelectedNodeKey(null)
    setContextMenu(null)
    setErrorMessage(null)
  }, [abortRelatedRequests])

  const unhideEntity = useCallback((key: string): void => {
    const item = hiddenEntitiesRef.current[key]

    if (!item) {
      return
    }

    const nextHidden = { ...hiddenEntitiesRef.current }
    delete nextHidden[key]

    hiddenEntitiesRef.current = nextHidden
    hiddenKeysRef.current = new Set(Object.keys(nextHidden))
    setHiddenEntities(nextHidden)
    touchRelatedCacheEntry(relatedCacheRef.current, key)
    restoreHiddenEntityToGraph(item)
  }, [restoreHiddenEntityToGraph])

  const clearHiddenEntities = useCallback((): void => {
    const hiddenItems = Object.values(hiddenEntitiesRef.current)

    if (hiddenItems.length === 0) {
      return
    }

    const nextNodes = { ...nodesRef.current }
    let hasNodeChanges = false

    for (const item of hiddenItems) {
      const snapshot = item.nodeSnapshot

      if (!snapshot || nextNodes[item.key]) {
        continue
      }

      nextNodes[item.key] = {
        ...snapshot,
        loading: false,
      }
      hasNodeChanges = true
    }

    if (hasNodeChanges) {
      nodesRef.current = nextNodes
      setNodes(nextNodes)
    }

    hiddenEntitiesRef.current = {}
    hiddenKeysRef.current = new Set()
    setHiddenEntities({})

    for (const item of hiddenItems) {
      restoreHiddenEntityToGraph(item)
    }
  }, [restoreHiddenEntityToGraph])

  const remainingRelatedCountByNode = useMemo(
    () => computeRemainingRelatedCountByNode({
      nodes,
      edges,
      relatedCache: relatedCacheSnapshot,
      replayQueueByNodeKey: replayQueueSnapshot,
      shouldSkipRelatedEntity,
    }),
    [edges, nodes, relatedCacheSnapshot, replayQueueSnapshot, shouldSkipRelatedEntity],
  )

  const getRemainingRelatedCount = useCallback(
    (node: GraphNode): number => {
      return remainingRelatedCountByNode[node.key] ?? 0
    },
    [remainingRelatedCountByNode],
  )

  const nodeList = useMemo(() => Object.values(nodes), [nodes])
  const edgeList = useMemo(() => Object.values(edges), [edges])

  const hiddenEntityList = useMemo(
    () => Object.values(hiddenEntities).sort((left, right) => left.title.localeCompare(right.title)),
    [hiddenEntities],
  )

  const hiddenEntityKeys = useMemo(() => Object.keys(hiddenEntities), [hiddenEntities])
  const contextNode = contextMenu ? nodes[contextMenu.nodeKey] ?? null : null

  const contextMenuPosition = useMemo(() => {
    if (!contextMenu) {
      return null
    }

    const menuWidth = 360
    const menuHeight = 560
    const maxX = typeof window === 'undefined' ? contextMenu.x : window.innerWidth - menuWidth - 10
    const maxY = typeof window === 'undefined' ? contextMenu.y : window.innerHeight - menuHeight - 10

    return {
      left: Math.max(10, Math.min(contextMenu.x, maxX)),
      top: Math.max(10, Math.min(contextMenu.y, maxY)),
    }
  }, [contextMenu])

  const clearCanvasSelection = useCallback((): void => {
    setSelectedNodeKey(null)
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
    nodes,
    edges,
    nodesRef,
    edgesRef,
    setNodes,
    nodeList,
    edgeList,
    selectedNodeKey,
    errorMessage,
    setErrorMessage,
    excludeSelfAppearances,
    setExcludeSelfAppearances,
    includeCrewConnections,
    setIncludeCrewConnections,
    hiddenEntityList,
    hiddenEntityKeys,
    contextNode,
    contextMenuPosition,
    addSearchEntity,
    clearAllGraph,
    clearHiddenEntities,
    unhideEntity,
    hideNodeFromBoard,
    pruneNodeLeaves,
    deleteNodeFromBoard,
    loadRelatedSelectionOptions,
    getConnectedNodeKeyList,
    addSelectedRelations,
    handleNodeClick,
    getRemainingRelatedCount,
    clearCanvasSelection,
    openNodeContextMenu,
    dismissContextMenu,
  }
}
