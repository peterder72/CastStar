import { useCallback, useState } from 'react'
import ControlPanel from './features/controls/components/ControlPanel'
import GraphCanvas from './features/graph/components/GraphCanvas'
import NodeContextMenu from './features/graph/components/NodeContextMenu'
import { useGraphWorkspace } from './features/graph/hooks/useGraphWorkspace'

function App() {
  const workspace = useGraphWorkspace()
  const [searchOnlyMode, setSearchOnlyMode] = useState(false)
  const toggleSearchOnlyMode = useCallback(() => {
    setSearchOnlyMode((value) => !value)
  }, [])

  return (
    <div
      className="relative h-full w-full overflow-hidden overscroll-none bg-[radial-gradient(circle_at_15%_15%,#1f4e73_0%,#101d2c_44%,#070b11_100%)] text-slate-100"
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
        performanceStats={workspace.performanceStats}
        errorMessage={workspace.errorMessage}
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
    </div>
  )
}

export default App
