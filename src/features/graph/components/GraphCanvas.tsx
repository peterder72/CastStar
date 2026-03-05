import type { PointerEvent as ReactPointerEvent, RefObject, WheelEvent } from 'react'
import EntityAvatar from '../../../components/EntityAvatar'
import type { GraphEdge, GraphNode } from '../../../types'
import { EXPAND_BATCH_SIZE } from '../constants'
import type { Point } from '../uiTypes'

interface GraphCanvasProps {
  viewportRef: RefObject<HTMLDivElement | null>
  isPanning: boolean
  gridSize: number
  gridOffsetX: number
  gridOffsetY: number
  edges: GraphEdge[]
  nodes: GraphNode[]
  nodesByKey: Record<string, GraphNode>
  selectedNodeKey: string | null
  toScreenPoint: (node: GraphNode) => Point
  getRemainingRelatedCount: (node: GraphNode) => number
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void
  onWheel: (event: WheelEvent<HTMLDivElement>) => void
  onCanvasClick: () => void
  onNodeClick: (nodeKey: string) => void
  onNodeContextMenu: (nodeKey: string, x: number, y: number) => void
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

function GraphCanvas({
  viewportRef,
  isPanning,
  gridSize,
  gridOffsetX,
  gridOffsetY,
  edges,
  nodes,
  nodesByKey,
  selectedNodeKey,
  toScreenPoint,
  getRemainingRelatedCount,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onWheel,
  onCanvasClick,
  onNodeClick,
  onNodeContextMenu,
}: GraphCanvasProps) {
  return (
    <div
      ref={viewportRef}
      className={`canvas ${isPanning ? 'is-panning' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
      onClick={onCanvasClick}
    >
      <div
        className="canvas-grid"
        style={{
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
        }}
      />

      <svg className="edges-layer" aria-hidden="true">
        {edges.map((edge) => {
          const source = nodesByKey[edge.source]
          const target = nodesByKey[edge.target]

          if (!source || !target) {
            return null
          }

          const sourcePoint = toScreenPoint(source)
          const targetPoint = toScreenPoint(target)

          return (
            <line
              key={edge.key}
              x1={sourcePoint.x}
              y1={sourcePoint.y}
              x2={targetPoint.x}
              y2={targetPoint.y}
            />
          )
        })}
      </svg>

      {nodes.map((node) => {
        const screenPoint = toScreenPoint(node)
        const remaining = getRemainingRelatedCount(node)
        const selected = selectedNodeKey === node.key

        return (
          <button
            key={node.key}
            type="button"
            data-node="true"
            className={`bubble bubble-${node.kind} ${selected ? 'is-selected' : ''}`}
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
            <EntityAvatar imagePath={node.imagePath} title={node.title} className="bubble-photo" />
            <span className="bubble-copy">
              <strong>{node.title}</strong>
              {node.subtitle && <small>{node.subtitle}</small>}
              <small className="bubble-status">{nodeStatusLabel(node, remaining)}</small>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default GraphCanvas
