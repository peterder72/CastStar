import './App.css'
import ControlPanel from './features/controls/components/ControlPanel'
import GraphCanvas from './features/graph/components/GraphCanvas'
import NodeContextMenu from './features/graph/components/NodeContextMenu'
import { useGraphWorkspace } from './features/graph/hooks/useGraphWorkspace'

function App() {
  const workspace = useGraphWorkspace()

  return (
    <div className="app-shell" onClick={workspace.dismissContextMenu}>
      <ControlPanel
        query={workspace.query}
        searchLoading={workspace.searchLoading}
        searchResults={workspace.searchResults}
        searchOpen={workspace.searchOpen}
        inputMode={workspace.inputMode}
        physicsEnabled={workspace.physicsEnabled}
        showPhysicsSettings={workspace.showPhysicsSettings}
        excludeSelfAppearances={workspace.excludeSelfAppearances}
        hiddenEntityList={workspace.hiddenEntityList}
        physicsSettings={workspace.physicsSettings}
        errorMessage={workspace.errorMessage}
        onQueryChange={workspace.handleQueryChange}
        onSearchFocus={workspace.handleSearchFocus}
        onSearchSubmit={workspace.submitSearch}
        onChooseSearchResult={workspace.chooseSearchResult}
        onInputModeChange={workspace.setInputMode}
        onPhysicsEnabledChange={workspace.setPhysicsEnabled}
        onCoolDownGraph={workspace.coolDownGraph}
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
