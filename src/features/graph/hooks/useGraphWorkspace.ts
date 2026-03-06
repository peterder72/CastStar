import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_PHYSICS } from '../constants'
import {
  GRAPH_PREFERENCES_WRITE_DEBOUNCE_MS,
  readGraphPreferences,
  writeGraphPreferences,
} from '../persistence'
import { useGraphData } from './useGraphData'
import { useGraphGestures } from './useGraphGestures'
import { useGraphPhysics } from './useGraphPhysics'
import { useGraphSearch } from './useGraphSearch'
import type { Camera, InputMode, Point } from '../uiTypes'
import type { GraphNode, NodePhysics } from '../../../types'

interface UseGraphWorkspaceOptions {
  onNodeClick?: () => void
  onSearchEntityAdded?: () => void
  onNodeContextMenuOpen?: () => void
}

export function useGraphWorkspace(options: UseGraphWorkspaceOptions = {}) {
  const [initialPreferences] = useState(readGraphPreferences)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 })
  const [physicsEnabled, setPhysicsEnabled] = useState(initialPreferences.physicsEnabled)
  const [inputMode, setInputMode] = useState<InputMode>(initialPreferences.inputMode)
  const [trackpadSensitivity, setTrackpadSensitivity] = useState(initialPreferences.trackpadSensitivity)
  const [physicsSettings, setPhysicsSettings] = useState<NodePhysics>({ ...initialPreferences.physicsSettings })
  const [showPhysicsSettings, setShowPhysicsSettings] = useState(false)

  const cameraRef = useRef(camera)
  const physicsRef = useRef(physicsSettings)
  const persistTimerRef = useRef<number | null>(null)

  useEffect(() => {
    cameraRef.current = camera
  }, [camera])

  useEffect(() => {
    physicsRef.current = physicsSettings
  }, [physicsSettings])

  const data = useGraphData({
    viewportRef,
    cameraRef,
    initialExcludeSelfAppearances: initialPreferences.filters.excludeSelfAppearances,
    initialIncludeCrewConnections: initialPreferences.filters.includeCrewConnections,
  })

  useEffect(() => {
    const nextPreferences = {
      physicsEnabled,
      inputMode,
      trackpadSensitivity,
      physicsSettings,
      filters: {
        excludeSelfAppearances: data.excludeSelfAppearances,
        includeCrewConnections: data.includeCrewConnections,
      },
    }

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current)
    }

    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null
      writeGraphPreferences(nextPreferences)
    }, GRAPH_PREFERENCES_WRITE_DEBOUNCE_MS)

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
    }
  }, [data.excludeSelfAppearances, data.includeCrewConnections, inputMode, physicsEnabled, physicsSettings, trackpadSensitivity])

  const search = useGraphSearch({
    hiddenEntityKeys: data.hiddenEntityKeys,
    addSearchEntity: data.addSearchEntity,
    setErrorMessage: data.setErrorMessage,
    onEntityAdded: options.onSearchEntityAdded,
  })

  const gestures = useGraphGestures({
    viewportRef,
    inputMode,
    trackpadSensitivity,
    setCamera,
  })

  const performanceStats = useGraphPhysics({
    nodesRef: data.nodesRef,
    edgesRef: data.edgesRef,
    physicsRef,
    physicsEnabled,
    setNodes: data.setNodes,
  })

  const toScreenPoint = useCallback(
    (node: GraphNode): Point => ({
      x: node.x * camera.scale + camera.x,
      y: node.y * camera.scale + camera.y,
    }),
    [camera],
  )

  const gridSize = Math.max(20, Math.min(120, Math.round(48 * camera.scale)))
  const gridOffsetX = ((camera.x % gridSize) + gridSize) % gridSize
  const gridOffsetY = ((camera.y % gridSize) + gridSize) % gridSize

  const resetGlobalPhysics = useCallback((): void => {
    setPhysicsSettings({ ...DEFAULT_PHYSICS })
  }, [])

  const clearAllGraph = useCallback((): void => {
    data.clearAllGraph()
    search.closeSearch()
  }, [data, search])

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
    data.clearCanvasSelection()
    search.closeSearch()
  }, [data, search])

  const handleNodeClick = useCallback(
    (nodeKey: string): void => {
      options.onNodeClick?.()
      data.handleNodeClick(nodeKey)
    },
    [data, options],
  )

  const openNodeContextMenu = useCallback(
    (nodeKey: string, x: number, y: number): void => {
      options.onNodeContextMenuOpen?.()
      data.openNodeContextMenu(nodeKey, x, y)
    },
    [data, options],
  )

  return {
    viewportRef,
    nodes: data.nodes,
    isPanning: gestures.isPanning,
    query: search.query,
    searchLoading: search.searchLoading,
    searchResults: search.searchResults,
    searchOpen: search.searchOpen,
    selectedNodeKey: data.selectedNodeKey,
    errorMessage: data.errorMessage,
    physicsEnabled,
    isWheeling: gestures.isWheeling,
    inputMode,
    trackpadSensitivity,
    physicsSettings,
    showPhysicsSettings,
    excludeSelfAppearances: data.excludeSelfAppearances,
    includeCrewConnections: data.includeCrewConnections,
    hiddenEntityList: data.hiddenEntityList,
    performanceStats,
    contextNode: data.contextNode,
    contextMenuPosition: data.contextMenuPosition,
    gridSize,
    gridOffsetX,
    gridOffsetY,
    nodeList: data.nodeList,
    edgeList: data.edgeList,
    submitSearch: search.submitSearch,
    chooseSearchResult: search.chooseSearchResult,
    setInputMode,
    setTrackpadSensitivity,
    setPhysicsEnabled,
    setExcludeSelfAppearances: data.setExcludeSelfAppearances,
    setIncludeCrewConnections: data.setIncludeCrewConnections,
    clearAllGraph,
    resetGlobalPhysics,
    clearHiddenEntities: data.clearHiddenEntities,
    unhideEntity: data.unhideEntity,
    hideNodeFromBoard: data.hideNodeFromBoard,
    pruneNodeLeaves: data.pruneNodeLeaves,
    deleteNodeFromBoard: data.deleteNodeFromBoard,
    loadRelatedSelectionOptions: data.loadRelatedSelectionOptions,
    getConnectedNodeKeyList: data.getConnectedNodeKeyList,
    addSelectedRelations: data.addSelectedRelations,
    handlePointerDown: gestures.handlePointerDown,
    handlePointerMove: gestures.handlePointerMove,
    stopPanning: gestures.stopPanning,
    handleWheel: gestures.handleWheel,
    handleNodeClick,
    toScreenPoint,
    getRemainingRelatedCount: data.getRemainingRelatedCount,
    handleQueryChange: search.handleQueryChange,
    handleSearchFocus: search.handleSearchFocus,
    togglePhysicsSettings,
    updatePhysicsSetting,
    clearCanvasSelection,
    openNodeContextMenu,
    dismissContextMenu: data.dismissContextMenu,
  }
}
