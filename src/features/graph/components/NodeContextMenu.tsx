import type { GraphNode } from '../../../types'

interface ContextMenuPosition {
  left: number
  top: number
}

interface NodeContextMenuProps {
  node: GraphNode | null
  position: ContextMenuPosition | null
  onHideNode: (nodeKey: string) => void
  onPruneLeaves: (nodeKey: string) => void
  onDeleteNode: (nodeKey: string) => void
}

function NodeContextMenu({ node, position, onHideNode, onPruneLeaves, onDeleteNode }: NodeContextMenuProps) {
  if (!node || !position) {
    return null
  }

  return (
    <div
      className="node-context-menu"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <strong>{node.title}</strong>
      <button type="button" onClick={() => onHideNode(node.key)}>
        Hide Node (to hidden list)
      </button>
      <button type="button" onClick={() => onPruneLeaves(node.key)}>
        Prune Loose Children
      </button>
      <button type="button" className="danger" onClick={() => onDeleteNode(node.key)}>
        Delete Node
      </button>
    </div>
  )
}

export default NodeContextMenu
