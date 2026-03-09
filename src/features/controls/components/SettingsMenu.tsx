import { memo, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Settings as SettingsIcon } from 'lucide-react'
import Button from '../../../components/ui/Button'
import PanelCard from '../../../components/ui/PanelCard'
import { cn } from '../../../components/ui/cn'
import {
  MAX_TRACKPAD_SENSITIVITY,
  MIN_TRACKPAD_SENSITIVITY,
  PHYSICS_CONTROLS,
  TRACKPAD_SENSITIVITY_STEP,
} from '../../graph/constants'
import type { InputMode } from '../../graph/uiTypes'
import type { NodePhysics } from '../../../types'

interface SettingsMenuProps {
  inputMode: InputMode
  trackpadSensitivity: number
  physicsEnabled: boolean
  showPhysicsSettings: boolean
  physicsSettings: NodePhysics
  tokenConfigurable: boolean
  onInputModeChange: (mode: InputMode) => void
  onTrackpadSensitivityChange: (value: number) => void
  onPhysicsEnabledChange: (enabled: boolean) => void
  onClearAllGraph: () => void
  onTogglePhysicsSettings: () => void
  onPhysicsSettingChange: (key: keyof NodePhysics, value: number) => void
  onResetPhysics: () => void
  onOpenTokenSettings: () => void
}

const POPOVER_ID = 'settings-menu-popover'
const MOBILE_SHEET_CLOSE_THRESHOLD = 110
const DESKTOP_PANEL_TOP_OFFSET = 8
const DESKTOP_PANEL_MIN_RIGHT = 12
const DESKTOP_POPOVER_CLOSE_DURATION_MS = 140

function inputModeButtonClass(active: boolean, withLeftBorder = false): string {
  return cn(
    'flex-1 px-3 py-1.5 text-xs transition',
    withLeftBorder && 'border-l border-slate-500/70',
    active
      ? 'bg-gradient-to-br from-cyan-300 to-sky-500 font-semibold text-slate-950'
      : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800/80',
  )
}

function SettingsMenu({
  inputMode,
  trackpadSensitivity,
  physicsEnabled,
  showPhysicsSettings,
  physicsSettings,
  tokenConfigurable,
  onInputModeChange,
  onTrackpadSensitivityChange,
  onPhysicsEnabledChange,
  onClearAllGraph,
  onTogglePhysicsSettings,
  onPhysicsSettingChange,
  onResetPhysics,
  onOpenTokenSettings,
}: SettingsMenuProps) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [panelTop, setPanelTop] = useState<number>(0)
  const [panelRight, setPanelRight] = useState<number>(12)
  const [mobileDragOffset, setMobileDragOffset] = useState(0)
  const [mobileDragging, setMobileDragging] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const isMobileRef = useRef(false)
  const mobileDragStateRef = useRef<{ active: boolean; pointerId: number | null; startY: number }>({
    active: false,
    pointerId: null,
    startY: 0,
  })

  const clearCloseTimer = useCallback((): void => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const resetMobileSheetState = useCallback((): void => {
    mobileDragStateRef.current = { active: false, pointerId: null, startY: 0 }
    setMobileDragging(false)
    setMobileDragOffset(0)
  }, [])

  const closeMenu = useCallback((): void => {
    resetMobileSheetState()

    if (isMobileRef.current) {
      clearCloseTimer()
      setClosing(false)
      setOpen(false)
      return
    }

    setClosing(true)
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      setClosing(false)
      closeTimerRef.current = null
    }, DESKTOP_POPOVER_CLOSE_DURATION_MS)
  }, [clearCloseTimer, resetMobileSheetState])

  useEffect(() => {
    return () => {
      clearCloseTimer()
    }
  }, [clearCloseTimer])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(max-width: 639px)')

    const syncMobile = (): void => {
      const nextIsMobile = mediaQuery.matches

      if (nextIsMobile === isMobileRef.current) {
        return
      }

      isMobileRef.current = nextIsMobile
      setIsMobile(nextIsMobile)
      resetMobileSheetState()
    }

    syncMobile()
    mediaQuery.addEventListener('change', syncMobile)

    return () => {
      mediaQuery.removeEventListener('change', syncMobile)
    }
  }, [resetMobileSheetState])

  const computeDesktopPanelPosition = useCallback((): { top: number; right: number } | null => {
    const trigger = triggerRef.current

    if (!trigger) {
      return null
    }

    const rect = trigger.getBoundingClientRect()

    return {
      top: rect.bottom + DESKTOP_PANEL_TOP_OFFSET,
      right: Math.max(DESKTOP_PANEL_MIN_RIGHT, window.innerWidth - rect.right),
    }
  }, [])

  const updateDesktopPanelPosition = useCallback(() => {
    if (isMobile) {
      return
    }

    const position = computeDesktopPanelPosition()

    if (!position) {
      return
    }

    setPanelTop(position.top)
    setPanelRight(position.right)
  }, [computeDesktopPanelPosition, isMobile])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return
      }

      closeMenu()
      triggerRef.current?.focus()
    }

    window.addEventListener('keydown', handleKeyDown)

    if (!isMobile) {
      window.addEventListener('resize', updateDesktopPanelPosition)
      window.addEventListener('scroll', updateDesktopPanelPosition, true)
      updateDesktopPanelPosition()
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updateDesktopPanelPosition)
      window.removeEventListener('scroll', updateDesktopPanelPosition, true)
    }
  }, [closeMenu, open, isMobile, updateDesktopPanelPosition])

  const handleMobileDragStart = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!isMobile) {
      return
    }

    mobileDragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
    }
    setMobileDragging(true)
    setMobileDragOffset(0)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleMobileDragMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!isMobile) {
      return
    }

    const state = mobileDragStateRef.current

    if (!state.active || state.pointerId !== event.pointerId) {
      return
    }

    const delta = Math.max(0, event.clientY - state.startY)
    setMobileDragOffset(delta)
  }

  const finishMobileDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    mode: 'end' | 'cancel',
  ): void => {
    if (!isMobile) {
      return
    }

    const state = mobileDragStateRef.current

    if (!state.active || state.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    mobileDragStateRef.current = { active: false, pointerId: null, startY: 0 }
    setMobileDragging(false)

    if (mode === 'end' && mobileDragOffset > MOBILE_SHEET_CLOSE_THRESHOLD) {
      closeMenu()
      return
    }

    setMobileDragOffset(0)
  }

  const portalTarget = typeof document !== 'undefined' ? document.body : null

  const openMenu = useCallback((): void => {
    clearCloseTimer()
    setClosing(false)

    if (!isMobileRef.current) {
      const position = computeDesktopPanelPosition()

      if (position) {
        setPanelTop(position.top)
        setPanelRight(position.right)
      }
    }

    setOpen(true)
  }, [clearCloseTimer, computeDesktopPanelPosition])

  const handleToggleOpen = useCallback((): void => {
    if (open && !closing) {
      closeMenu()
      return
    }

    openMenu()
  }, [closeMenu, closing, open, openMenu])

  const panel =
    open && portalTarget
      ? createPortal(
          <>
            <button
              type="button"
              className={cn('fixed inset-0 z-[100]', isMobile ? 'bg-black/32 backdrop-blur-[1px]' : 'bg-transparent')}
              onClick={closeMenu}
              aria-label="Close settings"
            />

            <div
              id={POPOVER_ID}
              role="dialog"
              aria-label="Settings menu"
              className={cn(
                'z-[110] overflow-y-auto rounded-2xl border border-slate-500/55 bg-slate-950/92 p-2.5 text-slate-100 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl motion-reduce:animate-none',
                isMobile
                  ? 'fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] top-[max(4.25rem,calc(env(safe-area-inset-top)+0.5rem))] origin-bottom animate-[settings-sheet-in_220ms_cubic-bezier(0.16,1,0.3,1)]'
                  : cn(
                      'fixed w-[min(24rem,calc(100vw-1.25rem))] max-h-[calc(100dvh-1rem)] origin-top-right',
                      closing ? 'animate-[settings-popover-out_140ms_ease-in]' : 'animate-[settings-popover-in_140ms_ease-out]',
                    ),
              )}
              style={
                isMobile
                  ? mobileDragging || mobileDragOffset > 0
                    ? {
                        transform: `translateY(${mobileDragOffset}px)`,
                        transition: mobileDragging ? 'none' : 'transform 180ms cubic-bezier(0.22,1,0.36,1)',
                      }
                    : undefined
                  : { top: `${panelTop}px`, right: `${panelRight}px` }
              }
              onClick={(event) => event.stopPropagation()}
            >
              {isMobile && (
                <div
                  className="mb-2.5 flex justify-center py-1.5 touch-none"
                  onPointerDown={handleMobileDragStart}
                  onPointerMove={handleMobileDragMove}
                  onPointerUp={(event) => finishMobileDrag(event, 'end')}
                  onPointerCancel={(event) => finishMobileDrag(event, 'cancel')}
                >
                  <div className="h-1 w-12 rounded-full bg-slate-500/80" aria-hidden="true" />
                </div>
              )}

              <PanelCard className="mt-0 bg-slate-950/82">
                <strong className="text-[0.86rem] text-slate-100">Quick Actions</strong>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    disabled={!tokenConfigurable}
                    onClick={() => {
                      closeMenu()
                      onOpenTokenSettings()
                    }}
                  >
                    Set Token
                  </Button>
                  <Button tone="danger" className="ring-2 ring-rose-500/45" onClick={onClearAllGraph}>
                    Clear All
                  </Button>
                </div>
              </PanelCard>

              <PanelCard className="bg-slate-950/82">
                <strong className="text-[0.86rem] text-slate-100">Interaction</strong>

                <div className="mt-2 grid w-full grid-cols-2 overflow-hidden rounded-lg border border-slate-500/70" role="group" aria-label="Input mode">
                  <button
                    type="button"
                    className={inputModeButtonClass(inputMode === 'mouse')}
                    onClick={() => onInputModeChange('mouse')}
                  >
                    Mouse
                  </button>
                  <button
                    type="button"
                    className={inputModeButtonClass(inputMode === 'trackpad', true)}
                    onClick={() => onInputModeChange('trackpad')}
                  >
                    Trackpad
                  </button>
                </div>

                <label className="mt-3 flex flex-col gap-1.5">
                  <span className="flex items-center justify-between gap-2 text-[0.73rem] text-slate-300">
                    Trackpad Sensitivity
                    <b className="font-mono text-[0.71rem] text-cyan-100">{trackpadSensitivity.toFixed(1)}x</b>
                  </span>
                  <input
                    type="range"
                    min={MIN_TRACKPAD_SENSITIVITY}
                    max={MAX_TRACKPAD_SENSITIVITY}
                    step={TRACKPAD_SENSITIVITY_STEP}
                    value={trackpadSensitivity}
                    onChange={(event) => onTrackpadSensitivityChange(Number.parseFloat(event.target.value))}
                    className="w-full accent-cyan-300"
                  />
                </label>
              </PanelCard>

              <PanelCard className="bg-slate-950/82">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[0.86rem] text-slate-100">Global Physics</strong>
                  <Button size="sm" onClick={onTogglePhysicsSettings}>
                    {showPhysicsSettings ? 'Hide' : 'Show'}
                  </Button>
                </div>
                <label className="mt-2 inline-flex items-center gap-2 text-[0.82rem] text-slate-300">
                  <input
                    type="checkbox"
                    checked={physicsEnabled}
                    onChange={(event) => onPhysicsEnabledChange(event.target.checked)}
                    className="accent-cyan-300"
                  />
                  Live Physics
                </label>

                {showPhysicsSettings && (
                  <>
                    <small className="mt-1 block text-[0.74rem] text-slate-300">Applies to all nodes</small>
                    <div className="mt-2.5 grid gap-x-2.5 gap-y-2 max-[420px]:grid-cols-1 sm:grid-cols-2">
                      {PHYSICS_CONTROLS.map((control) => {
                        const currentValue = physicsSettings[control.key]

                        return (
                          <label key={control.key} className="flex flex-col gap-1">
                            <span className="flex items-center justify-between gap-2 text-[0.73rem] text-slate-300">
                              {control.label}
                              <b className="font-mono text-[0.71rem] text-cyan-100">{currentValue.toFixed(control.precision)}</b>
                            </span>
                            <input
                              type="range"
                              min={control.min}
                              max={control.max}
                              step={control.step}
                              value={currentValue}
                              onChange={(event) => onPhysicsSettingChange(control.key, Number.parseFloat(event.target.value))}
                              className="w-full accent-cyan-300"
                            />
                          </label>
                        )
                      })}
                    </div>
                    <div className="mt-2.5 flex justify-end">
                      <Button onClick={onResetPhysics}>Reset Physics</Button>
                    </div>
                  </>
                )}
              </PanelCard>

              <PanelCard className="bg-slate-950/82">
                <strong className="text-[0.86rem] text-slate-100">Usage Tips</strong>
                <p className="mt-2 px-0.5 text-[0.78rem] leading-snug text-slate-300">
                  Click a bubble to load 10 connected results; click again for the next 10.
                </p>
                <p className="mt-1 px-0.5 text-[0.78rem] leading-snug text-slate-300">
                  Right-click a bubble for hide/prune/delete/manual-select actions.
                </p>
                <p className="mt-1 px-0.5 text-[0.78rem] leading-snug text-slate-300">
                  Touch: one finger pans and two fingers pinch-zoom. Trackpad mode: scroll to pan and pinch to zoom. Mouse mode: drag to pan and wheel to zoom.
                </p>
              </PanelCard>
            </div>
          </>,
          portalTarget,
        )
      : null

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggleOpen}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-500/70 bg-slate-950/78 text-slate-200 shadow-[0_12px_28px_rgba(0,0,0,0.4)] backdrop-blur-md transition hover:border-cyan-300/65 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/55 sm:h-11 sm:w-11"
          aria-label="Open settings"
          aria-expanded={open}
          aria-controls={POPOVER_ID}
          title="Settings"
        >
          <SettingsIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {panel}
    </>
  )
}

export default memo(SettingsMenu)
