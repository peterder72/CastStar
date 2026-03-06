import { useCallback, useState } from 'react'
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
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.38 6.84 9.73.5.1.66-.22.66-.49v-1.86c-2.78.62-3.36-1.37-3.36-1.37-.45-1.2-1.11-1.52-1.11-1.52-.91-.64.07-.62.07-.62 1 .08 1.54 1.06 1.54 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.09 0-1.13.39-2.06 1.03-2.79-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.06A9.3 9.3 0 0 1 12 6.86c.85 0 1.7.12 2.5.36 1.9-1.33 2.75-1.06 2.75-1.06.55 1.42.2 2.47.1 2.73.64.73 1.03 1.66 1.03 2.8 0 3.96-2.34 4.83-4.57 5.08.36.32.69.95.69 1.92v2.85c0 .27.17.6.67.49A10.29 10.29 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
          </svg>
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
