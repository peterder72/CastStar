import { memo } from 'react'
import type { GraphNode } from '../../../types'
import Button from '../../../components/ui/Button'

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
      className="fixed z-[120] grid w-60 gap-1.5 rounded-xl border border-slate-500/70 bg-slate-950/95 p-2 shadow-[0_18px_36px_rgba(0,0,0,0.45)] backdrop-blur-md"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <strong className="truncate px-1 pb-0.5 text-[0.82rem] text-slate-100">{node.title}</strong>
      <Button size="sm" onClick={() => onHideNode(node.key)}>
        Hide Node (to hidden list)
      </Button>
      <Button size="sm" onClick={() => onPruneLeaves(node.key)}>
        Prune Loose Children
      </Button>
      <Button size="sm" tone="danger" onClick={() => onDeleteNode(node.key)}>
        Delete Node
      </Button>
    </div>
  )
}

export default memo(NodeContextMenu)
