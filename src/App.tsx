import { useCallback, useState } from 'react'
import { useWebHaptics } from 'web-haptics/react'
import ControlPanel from './features/controls/components/ControlPanel'
import GraphCanvas from './features/graph/components/GraphCanvas'
import NodeContextMenu from './features/graph/components/NodeContextMenu'
import PerformanceHud from './features/graph/components/PerformanceHud'
import { useGraphWorkspace } from './features/graph/hooks/useGraphWorkspace'
import { isDemoModeEnabled, isTokenConfigurable } from './tmdb'
import TokenSettingsModal from './components/TokenSettingsModal'

function App() {
  const [searchOnlyMode, setSearchOnlyMode] = useState(false)
  const [tokenModalKey, setTokenModalKey] = useState(0)
  const [tokenModalOpen, setTokenModalOpen] = useState(false)
  const { trigger: triggerHaptic } = useWebHaptics()

  const triggerShortTapHaptic = useCallback(() => {
    void triggerHaptic('selection')
  }, [triggerHaptic])

  const triggerContextMenuOpenHaptic = useCallback(() => {
    void triggerHaptic([
      { duration: 16, intensity: 0.35 },
      { delay: 90, duration: 30, intensity: 1 },
    ])
  }, [triggerHaptic])

  const workspace = useGraphWorkspace({
    onNodeClick: triggerShortTapHaptic,
    onSearchEntityAdded: triggerShortTapHaptic,
    onNodeContextMenuOpen: triggerContextMenuOpenHaptic,
  })

  const toggleSearchOnlyMode = useCallback(() => {
    setSearchOnlyMode((value) => !value)
  }, [])

  const openTokenSettings = useCallback(() => {
    setTokenModalKey((k) => k + 1)
    setTokenModalOpen(true)
  }, [])

  const closeTokenSettings = useCallback(() => {
    setTokenModalOpen(false)
  }, [])

  return (
    <div
      className="relative h-full w-full select-none overflow-hidden overscroll-none bg-[radial-gradient(circle_at_15%_15%,#1f4e73_0%,#101d2c_44%,#070b11_100%)] text-slate-100"
      onClick={workspace.dismissContextMenu}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-6rem] h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <ControlPanel
        query={workspace.query}
        searchLoading={workspace.searchLoading}
        searchResults={workspace.searchResults}
        searchOpen={workspace.searchOpen}
        searchOnlyMode={searchOnlyMode}
        inputMode={workspace.inputMode}
        isPanning={workspace.isPanning || workspace.isWheeling}
        physicsEnabled={workspace.physicsEnabled}
        showPhysicsSettings={workspace.showPhysicsSettings}
        excludeSelfAppearances={workspace.excludeSelfAppearances}
        hiddenEntityList={workspace.hiddenEntityList}
        physicsSettings={workspace.physicsSettings}
        errorMessage={workspace.errorMessage}
        tokenConfigurable={isTokenConfigurable}
        onQueryChange={workspace.handleQueryChange}
        onSearchFocus={workspace.handleSearchFocus}
        onSearchSubmit={workspace.submitSearch}
        onChooseSearchResult={workspace.chooseSearchResult}
        onToggleSearchOnlyMode={toggleSearchOnlyMode}
        onInputModeChange={workspace.setInputMode}
        onPhysicsEnabledChange={workspace.setPhysicsEnabled}
        onClearAllGraph={workspace.clearAllGraph}
        onTogglePhysicsSettings={workspace.togglePhysicsSettings}
        onExcludeSelfAppearancesChange={workspace.setExcludeSelfAppearances}
        onClearHiddenEntities={workspace.clearHiddenEntities}
        onUnhideEntity={workspace.unhideEntity}
        onPhysicsSettingChange={workspace.updatePhysicsSetting}
        onResetPhysics={workspace.resetGlobalPhysics}
        onOpenTokenSettings={openTokenSettings}
      />

      <GraphCanvas
        viewportRef={workspace.viewportRef}
        isPanning={workspace.isPanning}
        gridSize={workspace.gridSize}
        gridOffsetX={workspace.gridOffsetX}
        gridOffsetY={workspace.gridOffsetY}
        edges={workspace.edgeList}
        nodes={workspace.nodeList}
        nodesByKey={workspace.nodes}
        selectedNodeKey={workspace.selectedNodeKey}
        toScreenPoint={workspace.toScreenPoint}
        getRemainingRelatedCount={workspace.getRemainingRelatedCount}
        onPointerDown={workspace.handlePointerDown}
        onPointerMove={workspace.handlePointerMove}
        onPointerUp={workspace.stopPanning}
        onPointerCancel={workspace.stopPanning}
        onWheel={workspace.handleWheel}
        onCanvasClick={workspace.clearCanvasSelection}
        onNodeClick={workspace.handleNodeClick}
        onNodeContextMenu={workspace.openNodeContextMenu}
      />

      <NodeContextMenu
        node={workspace.contextNode}
        position={workspace.contextMenuPosition}
        onHideNode={workspace.hideNodeFromBoard}
        onPruneLeaves={workspace.pruneNodeLeaves}
        onDeleteNode={workspace.deleteNodeFromBoard}
      />

      <PerformanceHud stats={workspace.performanceStats} />

      {isDemoModeEnabled && (
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[80] inline-flex items-center gap-1.5 rounded-xl border border-amber-300/45 bg-slate-950/78 px-2.5 py-1.5 text-amber-200 shadow-[0_12px_28px_rgba(0,0,0,0.4)] backdrop-blur-md sm:bottom-3 sm:left-3">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.7)]" />
          <span className="font-mono text-[0.7rem] font-semibold tracking-[0.14em]">DEMO</span>
        </div>
      )}

      <TokenSettingsModal key={tokenModalKey} open={tokenModalOpen} onClose={closeTokenSettings} />
    </div>
  )
}

export default App
