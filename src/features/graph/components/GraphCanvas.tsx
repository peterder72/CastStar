import type { PointerEvent as ReactPointerEvent, RefObject, WheelEvent } from 'react'
import type { GraphEdge, GraphNode } from '../../../types'
import GraphNodeBubble from './GraphNodeBubble'
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
      className={`relative h-full w-full touch-none overflow-hidden overscroll-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
      onClick={onCanvasClick}
    >
      <div
        className="absolute"
        style={{
          left: -gridSize,
          top: -gridSize,
          width: `calc(100% + ${gridSize * 2}px)`,
          height: `calc(100% + ${gridSize * 2}px)`,
          backgroundImage:
            'linear-gradient(to right, rgb(103 168 214 / 22%) 1px, transparent 1px), linear-gradient(to bottom, rgb(103 168 214 / 22%) 1px, transparent 1px)',
          backgroundSize: `${gridSize}px ${gridSize}px`,
          transform: `translate3d(${gridOffsetX}px, ${gridOffsetY}px, 0)`,
          willChange: isPanning ? 'transform' : undefined,
        }}
      />

      <svg className="pointer-events-none absolute inset-0 h-full w-full [&_line]:stroke-cyan-200/55 [&_line]:stroke-[1.6]" aria-hidden="true">
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
          <GraphNodeBubble
            key={node.key}
            node={node}
            screenPoint={screenPoint}
            remaining={remaining}
            selected={selected}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
          />
        )
      })}
    </div>
  )
}

export default GraphCanvas
