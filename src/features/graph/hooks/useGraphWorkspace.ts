import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_PHYSICS } from '../constants'
import { useGraphData } from './useGraphData'
import { useGraphGestures } from './useGraphGestures'
import { useGraphPhysics } from './useGraphPhysics'
import { useGraphSearch } from './useGraphSearch'
import type { Camera, Point } from '../uiTypes'
import type { GraphNode, NodePhysics } from '../../../types'

interface UseGraphWorkspaceOptions {
  onNodeClick?: () => void
  onSearchEntityAdded?: () => void
  onNodeContextMenuOpen?: () => void
}

export function useGraphWorkspace(options: UseGraphWorkspaceOptions = {}) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 })
  const [physicsEnabled, setPhysicsEnabled] = useState(true)
  const [inputMode, setInputMode] = useState<'mouse' | 'trackpad'>('mouse')
  const [physicsSettings, setPhysicsSettings] = useState<NodePhysics>({ ...DEFAULT_PHYSICS })
  const [showPhysicsSettings, setShowPhysicsSettings] = useState(false)

  const cameraRef = useRef(camera)
  const physicsRef = useRef(physicsSettings)

  useEffect(() => {
    cameraRef.current = camera
  }, [camera])

  useEffect(() => {
    physicsRef.current = physicsSettings
  }, [physicsSettings])

  const data = useGraphData({
    viewportRef,
    cameraRef,
  })

  const search = useGraphSearch({
    hiddenEntityKeys: data.hiddenEntityKeys,
    addSearchEntity: data.addSearchEntity,
    setErrorMessage: data.setErrorMessage,
    onEntityAdded: options.onSearchEntityAdded,
  })

  const gestures = useGraphGestures({
    viewportRef,
    inputMode,
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
    physicsSettings,
    showPhysicsSettings,
    excludeSelfAppearances: data.excludeSelfAppearances,
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
    setPhysicsEnabled,
    setExcludeSelfAppearances: data.setExcludeSelfAppearances,
    clearAllGraph,
    resetGlobalPhysics,
    clearHiddenEntities: data.clearHiddenEntities,
    unhideEntity: data.unhideEntity,
    hideNodeFromBoard: data.hideNodeFromBoard,
    pruneNodeLeaves: data.pruneNodeLeaves,
    deleteNodeFromBoard: data.deleteNodeFromBoard,
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
