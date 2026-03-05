import { useEffect, useRef } from 'react'
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
const LONG_PRESS_MS = 430
const LONG_PRESS_MOVE_THRESHOLD = 12

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
  const longPressPointerIdRef = useRef<number | null>(null)
  const longPressStartPointRef = useRef<Point | null>(null)
  const longPressTriggeredRef = useRef(false)
  const longPressTimerRef = useRef<number | null>(null)

  const clearLongPressTimer = (): void => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  const resetTouchLongPress = (target: HTMLButtonElement, pointerId: number): void => {
    clearLongPressTimer()

    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId)
    }

    longPressPointerIdRef.current = null
    longPressStartPointRef.current = null
  }

  return (
    <button
      type="button"
      data-node="true"
      className={cn(
        'group absolute flex w-[190px] -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-2xl border bg-slate-950/88 p-2.5 text-left text-slate-100 shadow-[0_18px_30px_rgba(0,0,0,0.4)] backdrop-blur-sm transition hover:border-cyan-200/80 max-[780px]:w-[170px] max-[780px]:p-2 max-[560px]:w-[152px] max-[560px]:gap-2',
        nodeKindClass[node.kind],
        selected && 'border-cyan-100/95 ring-2 ring-cyan-100/25',
      )}
      style={{
        left: `${screenPoint.x}px`,
        top: `${screenPoint.y}px`,
      }}
      onClick={(event) => {
        event.stopPropagation()
        if (longPressTriggeredRef.current) {
          longPressTriggeredRef.current = false
          return
        }
        onNodeClick(node.key)
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== 'touch') {
          return
        }

        if (longPressPointerIdRef.current !== null && longPressPointerIdRef.current !== event.pointerId) {
          clearLongPressTimer()
          longPressPointerIdRef.current = null
          longPressStartPointRef.current = null
          return
        }

        longPressTriggeredRef.current = false
        longPressPointerIdRef.current = event.pointerId
        longPressStartPointRef.current = {
          x: event.clientX,
          y: event.clientY,
        }
        event.currentTarget.setPointerCapture(event.pointerId)

        clearLongPressTimer()
        const contextX = event.clientX
        const contextY = event.clientY

        longPressTimerRef.current = window.setTimeout(() => {
          longPressTriggeredRef.current = true
          longPressTimerRef.current = null
          onNodeContextMenu(node.key, contextX, contextY)
        }, LONG_PRESS_MS)
      }}
      onPointerMove={(event) => {
        if (event.pointerType !== 'touch' || longPressPointerIdRef.current !== event.pointerId) {
          return
        }

        const startPoint = longPressStartPointRef.current

        if (!startPoint || longPressTimerRef.current === null) {
          return
        }

        const movedX = event.clientX - startPoint.x
        const movedY = event.clientY - startPoint.y
        const movedDistance = Math.hypot(movedX, movedY)

        if (movedDistance > LONG_PRESS_MOVE_THRESHOLD) {
          clearLongPressTimer()
        }
      }}
      onPointerUp={(event) => {
        if (event.pointerType !== 'touch' || longPressPointerIdRef.current !== event.pointerId) {
          return
        }

        resetTouchLongPress(event.currentTarget, event.pointerId)
      }}
      onPointerCancel={(event) => {
        if (event.pointerType !== 'touch' || longPressPointerIdRef.current !== event.pointerId) {
          return
        }

        resetTouchLongPress(event.currentTarget, event.pointerId)
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
        className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-400/70 bg-slate-700 text-[0.8rem] font-bold max-[780px]:h-12 max-[780px]:w-12 max-[560px]:h-10 max-[560px]:w-10"
      />
      <span className="min-w-0">
        <strong className="block break-words text-[0.94rem] leading-tight whitespace-normal max-[560px]:text-[0.85rem]">{node.title}</strong>
        {node.subtitle && (
          <small className="block break-words text-[0.75rem] leading-tight whitespace-normal text-slate-300 max-[560px]:text-[0.7rem]">
            {node.subtitle}
          </small>
        )}
        <small className="block break-words text-[0.74rem] leading-tight whitespace-normal text-cyan-200 max-[560px]:text-[0.7rem]">
          {nodeStatusLabel(node, remaining)}
        </small>
      </span>
    </button>
  )
}

export default GraphNodeBubble
