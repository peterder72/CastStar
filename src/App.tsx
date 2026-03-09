import { useCallback, useState } from 'react'
import { Github } from 'lucide-react'
import { useWebHaptics } from 'web-haptics/react'
import ControlPanel from './features/controls/components/ControlPanel'
import GraphCanvas from './features/graph/components/GraphCanvas'
import NodeContextMenu from './features/graph/components/NodeContextMenu'
import PerformanceHud from './features/graph/components/PerformanceHud'
import { useGraphWorkspace } from './features/graph/hooks/useGraphWorkspace'
import { isDemoModeEnabled, isTokenConfigurable } from './tmdb'
import TokenSettingsModal from './components/TokenSettingsModal'

const REPOSITORY_URL = 'https://github.com/peterder72/CastStar'
const APP_VERSION_LABEL = `v${__APP_VERSION__}`

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
        isPanning={workspace.isPanning || workspace.isWheeling}
        excludeSelfAppearances={workspace.excludeSelfAppearances}
        includeCrewConnections={workspace.includeCrewConnections}
        hiddenEntityList={workspace.hiddenEntityList}
        errorMessage={workspace.errorMessage}
        inputMode={workspace.inputMode}
        trackpadSensitivity={workspace.trackpadSensitivity}
        physicsEnabled={workspace.physicsEnabled}
        showPhysicsSettings={workspace.showPhysicsSettings}
        physicsSettings={workspace.physicsSettings}
        tokenConfigurable={isTokenConfigurable}
        onQueryChange={workspace.handleQueryChange}
        onSearchFocus={workspace.handleSearchFocus}
        onSearchSubmit={workspace.submitSearch}
        onChooseSearchResult={workspace.chooseSearchResult}
        onToggleSearchOnlyMode={toggleSearchOnlyMode}
        onInputModeChange={workspace.setInputMode}
        onTrackpadSensitivityChange={workspace.setTrackpadSensitivity}
        onPhysicsEnabledChange={workspace.setPhysicsEnabled}
        onClearAllGraph={workspace.clearAllGraph}
        onTogglePhysicsSettings={workspace.togglePhysicsSettings}
        onPhysicsSettingChange={workspace.updatePhysicsSetting}
        onResetPhysics={workspace.resetGlobalPhysics}
        onOpenTokenSettings={openTokenSettings}
        onExcludeSelfAppearancesChange={workspace.setExcludeSelfAppearances}
        onIncludeCrewConnectionsChange={workspace.setIncludeCrewConnections}
        onClearHiddenEntities={workspace.clearHiddenEntities}
        onUnhideEntity={workspace.unhideEntity}
      />

      <GraphCanvas
        viewportRef={workspace.viewportRef}
        isPanning={workspace.isPanning}
        inputMode={workspace.inputMode}
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
        onLoadRelatedSelectionOptions={workspace.loadRelatedSelectionOptions}
        getConnectedNodeKeyList={workspace.getConnectedNodeKeyList}
        onAddSelectedRelations={workspace.addSelectedRelations}
      />

      <div className="pointer-events-none absolute bottom-2.5 right-2.5 z-[80] flex items-end gap-2 sm:bottom-3 sm:right-3">
        <PerformanceHud stats={workspace.performanceStats} />

        <span
          className="pointer-events-auto inline-flex items-center rounded-xl border border-slate-500/70 bg-slate-950/78 px-2.5 py-1.5 font-mono text-[0.72rem] text-cyan-100 shadow-[0_12px_28px_rgba(0,0,0,0.4)] backdrop-blur-md sm:text-[0.76rem]"
          aria-label={`CastStar version ${APP_VERSION_LABEL}`}
          title="App version"
        >
          {APP_VERSION_LABEL}
        </span>

        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto inline-flex items-center justify-center rounded-xl border border-slate-500/70 bg-slate-950/78 p-2.5 text-slate-200 shadow-[0_12px_28px_rgba(0,0,0,0.4)] backdrop-blur-md transition hover:border-cyan-300/65 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/55"
          aria-label="Open CastStar on GitHub"
          title="GitHub"
        >
          <Github className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>

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
