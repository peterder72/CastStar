import {
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
  type WheelEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { Camera, InputMode, Point } from '../uiTypes'

const MIN_CAMERA_SCALE = 0.3
const MAX_CAMERA_SCALE = 2.4

interface UseGraphGesturesParams {
  viewportRef: RefObject<HTMLDivElement | null>
  inputMode: InputMode
  setCamera: Dispatch<SetStateAction<Camera>>
}

function touchMidpoint(left: Point, right: Point): Point {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  }
}

function touchDistance(left: Point, right: Point): number {
  return Math.hypot(right.x - left.x, right.y - left.y)
}

export function useGraphGestures({ viewportRef, inputMode, setCamera }: UseGraphGesturesParams) {
  const panStateRef = useRef({
    active: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
  })
  const panDeltaRef = useRef({
    x: 0,
    y: 0,
  })
  const panFrameRef = useRef<number | null>(null)
  const touchPointsRef = useRef<Map<number, Point>>(new Map())
  const pinchStateRef = useRef({
    active: false,
    centerX: 0,
    centerY: 0,
    distance: 0,
  })
  const wheelDeltaRef = useRef({
    zoomDelta: 0,
    panX: 0,
    panY: 0,
    localX: 0,
    localY: 0,
  })
  const wheelFrameRef = useRef<number | null>(null)
  const wheelIdleTimerRef = useRef<number | null>(null)
  const wheelActiveRef = useRef(false)

  const [isPanning, setIsPanning] = useState(false)
  const [isWheeling, setIsWheeling] = useState(false)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const rect = viewport.getBoundingClientRect()
    setCamera((current) => {
      if (current.x !== 0 || current.y !== 0) {
        return current
      }

      return {
        x: rect.width / 2,
        y: rect.height / 2,
        scale: 1,
      }
    })
  }, [setCamera, viewportRef])

  useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport || typeof ResizeObserver === 'undefined') {
      return
    }

    let previousWidth = viewport.clientWidth
    let previousHeight = viewport.clientHeight

    const observer = new ResizeObserver(() => {
      const nextWidth = viewport.clientWidth
      const nextHeight = viewport.clientHeight

      if (nextWidth === previousWidth && nextHeight === previousHeight) {
        return
      }

      const deltaX = (nextWidth - previousWidth) / 2
      const deltaY = (nextHeight - previousHeight) / 2

      previousWidth = nextWidth
      previousHeight = nextHeight

      setCamera((current) => ({
        ...current,
        x: current.x + deltaX,
        y: current.y + deltaY,
      }))
    })

    observer.observe(viewport)

    return () => {
      observer.disconnect()
    }
  }, [setCamera, viewportRef])

  const flushPanDelta = useCallback((): void => {
    const pending = panDeltaRef.current

    if (pending.x === 0 && pending.y === 0) {
      return
    }

    const deltaX = pending.x
    const deltaY = pending.y
    pending.x = 0
    pending.y = 0

    setCamera((current) => ({
      ...current,
      x: current.x + deltaX,
      y: current.y + deltaY,
    }))
  }, [setCamera])

  const schedulePanFrame = useCallback((): void => {
    if (panFrameRef.current !== null) {
      return
    }

    panFrameRef.current = window.requestAnimationFrame(() => {
      panFrameRef.current = null
      flushPanDelta()
    })
  }, [flushPanDelta])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const target = event.target as HTMLElement
      const isNodeTarget = Boolean(target.closest('[data-node]'))

      if (event.pointerType === 'touch') {
        if (isNodeTarget) {
          return
        }

        const point = {
          x: event.clientX,
          y: event.clientY,
        }
        const touchPoints = touchPointsRef.current
        touchPoints.set(event.pointerId, point)

        if (touchPoints.size >= 2) {
          event.currentTarget.setPointerCapture(event.pointerId)

          const touches = Array.from(touchPoints.values())
          const first = touches[0]
          const second = touches[1]

          if (first && second) {
            const center = touchMidpoint(first, second)
            const distance = touchDistance(first, second)

            if (distance > 0) {
              panStateRef.current.active = false
              panStateRef.current.pointerId = -1
              panDeltaRef.current.x = 0
              panDeltaRef.current.y = 0

              if (panFrameRef.current !== null) {
                window.cancelAnimationFrame(panFrameRef.current)
                panFrameRef.current = null
              }

              pinchStateRef.current = {
                active: true,
                centerX: center.x,
                centerY: center.y,
                distance,
              }

              setIsPanning(true)
              return
            }
          }
        }

        pinchStateRef.current.active = false
        pinchStateRef.current.distance = 0

        event.currentTarget.setPointerCapture(event.pointerId)

        panStateRef.current = {
          active: true,
          pointerId: event.pointerId,
          lastX: event.clientX,
          lastY: event.clientY,
        }
        panDeltaRef.current.x = 0
        panDeltaRef.current.y = 0
        setIsPanning(true)
        return
      }

      if (isNodeTarget) {
        return
      }

      panStateRef.current = {
        active: true,
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
      }
      panDeltaRef.current.x = 0
      panDeltaRef.current.y = 0

      event.currentTarget.setPointerCapture(event.pointerId)
      setIsPanning(true)
    },
    [],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (event.pointerType === 'touch') {
        const touchPoints = touchPointsRef.current
        const point = touchPoints.get(event.pointerId)

        if (!point) {
          return
        }

        point.x = event.clientX
        point.y = event.clientY

        if (pinchStateRef.current.active && touchPoints.size >= 2) {
          const touches = Array.from(touchPoints.values())
          const first = touches[0]
          const second = touches[1]

          if (!first || !second) {
            return
          }

          const nextCenter = touchMidpoint(first, second)
          const nextDistance = touchDistance(first, second)

          if (nextDistance <= 0) {
            return
          }

          const previousCenterX = pinchStateRef.current.centerX
          const previousCenterY = pinchStateRef.current.centerY
          const previousDistance =
            pinchStateRef.current.distance > 0 ? pinchStateRef.current.distance : nextDistance

          setCamera((current) => {
            const worldPointX = (previousCenterX - current.x) / current.scale
            const worldPointY = (previousCenterY - current.y) / current.scale
            const zoomFactor = nextDistance / previousDistance
            const nextScale = Math.max(MIN_CAMERA_SCALE, Math.min(MAX_CAMERA_SCALE, current.scale * zoomFactor))

            return {
              scale: nextScale,
              x: nextCenter.x - worldPointX * nextScale,
              y: nextCenter.y - worldPointY * nextScale,
            }
          })

          pinchStateRef.current.centerX = nextCenter.x
          pinchStateRef.current.centerY = nextCenter.y
          pinchStateRef.current.distance = nextDistance
          return
        }
      }

      const state = panStateRef.current

      if (!state.active || state.pointerId !== event.pointerId) {
        return
      }

      const deltaX = event.clientX - state.lastX
      const deltaY = event.clientY - state.lastY

      state.lastX = event.clientX
      state.lastY = event.clientY

      panDeltaRef.current.x += deltaX
      panDeltaRef.current.y += deltaY
      schedulePanFrame()
    },
    [schedulePanFrame, setCamera],
  )

  const stopPanning = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (event.pointerType === 'touch') {
        const touchPoints = touchPointsRef.current
        touchPoints.delete(event.pointerId)

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }

        if (pinchStateRef.current.active) {
          if (touchPoints.size >= 2) {
            const touches = Array.from(touchPoints.values())
            const first = touches[0]
            const second = touches[1]

            if (first && second) {
              const center = touchMidpoint(first, second)
              const distance = touchDistance(first, second)

              pinchStateRef.current.centerX = center.x
              pinchStateRef.current.centerY = center.y
              pinchStateRef.current.distance = Math.max(distance, 1)
              setIsPanning(true)
              return
            }
          }

          pinchStateRef.current.active = false
          pinchStateRef.current.distance = 0

          if (touchPoints.size === 1) {
            const [[nextPointerId, nextPoint]] = Array.from(touchPoints.entries())
            panStateRef.current = {
              active: true,
              pointerId: nextPointerId,
              lastX: nextPoint.x,
              lastY: nextPoint.y,
            }
            panDeltaRef.current.x = 0
            panDeltaRef.current.y = 0
            setIsPanning(true)
            return
          }

          panStateRef.current.active = false
          panStateRef.current.pointerId = -1
          setIsPanning(false)
          return
        }

        const state = panStateRef.current

        if (state.active && state.pointerId === event.pointerId) {
          state.active = false
          state.pointerId = -1

          if (panFrameRef.current !== null) {
            window.cancelAnimationFrame(panFrameRef.current)
            panFrameRef.current = null
          }

          flushPanDelta()
        }

        if (touchPoints.size === 1) {
          const [[nextPointerId, nextPoint]] = Array.from(touchPoints.entries())
          panStateRef.current = {
            active: true,
            pointerId: nextPointerId,
            lastX: nextPoint.x,
            lastY: nextPoint.y,
          }
          panDeltaRef.current.x = 0
          panDeltaRef.current.y = 0
          setIsPanning(true)
          return
        }

        if (touchPoints.size === 0) {
          setIsPanning(false)
        }

        return
      }

      const state = panStateRef.current

      if (!state.active || state.pointerId !== event.pointerId) {
        return
      }

      state.active = false
      state.pointerId = -1

      if (panFrameRef.current !== null) {
        window.cancelAnimationFrame(panFrameRef.current)
        panFrameRef.current = null
      }
      flushPanDelta()

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      setIsPanning(false)
    },
    [flushPanDelta],
  )

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>): void => {
      event.preventDefault()

      const viewport = viewportRef.current

      if (!viewport) {
        return
      }

      const bounds = viewport.getBoundingClientRect()
      const localX = event.clientX - bounds.left
      const localY = event.clientY - bounds.top

      const flushWheelDelta = (): void => {
        const pending = wheelDeltaRef.current
        const hasPan = pending.panX !== 0 || pending.panY !== 0
        const hasZoom = pending.zoomDelta !== 0

        if (!hasPan && !hasZoom) {
          return
        }

        const panX = pending.panX
        const panY = pending.panY
        const zoomDelta = pending.zoomDelta
        const anchorX = pending.localX
        const anchorY = pending.localY

        pending.panX = 0
        pending.panY = 0
        pending.zoomDelta = 0

        setCamera((current) => {
          let next = current

          if (hasPan) {
            next = {
              ...next,
              x: next.x - panX,
              y: next.y - panY,
            }
          }

          if (hasZoom) {
            const zoomFactor = Math.exp(-zoomDelta * 0.002)
            const nextScale = Math.max(MIN_CAMERA_SCALE, Math.min(MAX_CAMERA_SCALE, next.scale * zoomFactor))
            const worldPointX = (anchorX - next.x) / next.scale
            const worldPointY = (anchorY - next.y) / next.scale

            next = {
              scale: nextScale,
              x: anchorX - worldPointX * nextScale,
              y: anchorY - worldPointY * nextScale,
            }
          }

          return next
        })
      }

      if (!wheelActiveRef.current) {
        wheelActiveRef.current = true
        setIsWheeling(true)
      }

      if (wheelIdleTimerRef.current !== null) {
        window.clearTimeout(wheelIdleTimerRef.current)
      }

      wheelIdleTimerRef.current = window.setTimeout(() => {
        wheelActiveRef.current = false
        wheelIdleTimerRef.current = null
        setIsWheeling(false)
      }, 140)

      const pending = wheelDeltaRef.current
      const zoomInput = inputMode === 'trackpad' || event.ctrlKey || event.metaKey

      if (zoomInput) {
        pending.zoomDelta += event.deltaY
        pending.localX = localX
        pending.localY = localY
      } else {
        pending.panX += event.deltaX
        pending.panY += event.deltaY
      }

      if (wheelFrameRef.current === null) {
        wheelFrameRef.current = window.requestAnimationFrame(() => {
          wheelFrameRef.current = null
          flushWheelDelta()
        })
      }
    },
    [inputMode, setCamera, viewportRef],
  )

  useEffect(() => {
    const touchPoints = touchPointsRef.current
    const pinchState = pinchStateRef.current

    return () => {
      if (panFrameRef.current !== null) {
        window.cancelAnimationFrame(panFrameRef.current)
      }

      if (wheelFrameRef.current !== null) {
        window.cancelAnimationFrame(wheelFrameRef.current)
      }

      if (wheelIdleTimerRef.current !== null) {
        window.clearTimeout(wheelIdleTimerRef.current)
      }

      touchPoints.clear()
      pinchState.active = false
    }
  }, [])

  return {
    isPanning,
    isWheeling,
    handlePointerDown,
    handlePointerMove,
    stopPanning,
    handleWheel,
  }
}
