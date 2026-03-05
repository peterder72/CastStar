import EntityAvatar from '../../../components/EntityAvatar'
import type { GraphNode, NodeKind } from '../../../types'
import { EXPAND_BATCH_SIZE } from '../constants'
import type { Point } from '../uiTypes'
import { cn } from '../../../components/ui/cn'

interface GraphNodeBubbleProps {
  node: GraphNode
  screenPoint: Point
  remaining: number
  selected: boolean
  onNodeClick: (nodeKey: string) => void
  onNodeContextMenu: (nodeKey: string, x: number, y: number) => void
}

const nodeKindClass: Record<NodeKind, string> = {
  person: 'border-cyan-300/45',
  movie: 'border-amber-300/45',
  tv: 'border-emerald-300/45',
}

function nodeStatusLabel(node: GraphNode, remaining: number): string {
  if (node.loading) {
    return 'Loading...'
  }

  if (node.totalRelated === 0) {
    return 'Click to expand'
  }

  if (remaining > 0) {
    return `Click for +${Math.min(EXPAND_BATCH_SIZE, remaining)} more`
  }

  return 'No more new connections'
}

function GraphNodeBubble({ node, screenPoint, remaining, selected, onNodeClick, onNodeContextMenu }: GraphNodeBubbleProps) {
  return (
    <button
      type="button"
      data-node="true"
      className={cn(
        'group absolute flex w-[190px] -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-2xl border bg-slate-950/88 p-2.5 text-left text-slate-100 shadow-[0_18px_30px_rgba(0,0,0,0.4)] backdrop-blur-sm transition hover:border-cyan-200/80 max-[780px]:w-[170px] max-[780px]:p-2',
        nodeKindClass[node.kind],
        selected && 'border-cyan-100/95 ring-2 ring-cyan-100/25',
      )}
      style={{
        left: `${screenPoint.x}px`,
        top: `${screenPoint.y}px`,
      }}
      onClick={(event) => {
        event.stopPropagation()
        onNodeClick(node.key)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onNodeContextMenu(node.key, event.clientX, event.clientY)
      }}
    >
      <EntityAvatar
        imagePath={node.imagePath}
        title={node.title}
        className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-400/70 bg-slate-700 text-[0.8rem] font-bold max-[780px]:h-12 max-[780px]:w-12"
      />
      <span className="min-w-0">
        <strong className="block truncate text-[0.94rem]">{node.title}</strong>
        {node.subtitle && <small className="block truncate text-[0.75rem] text-slate-300">{node.subtitle}</small>}
        <small className="block truncate text-[0.74rem] text-cyan-200">{nodeStatusLabel(node, remaining)}</small>
      </span>
    </button>
  )
}

export default GraphNodeBubble
