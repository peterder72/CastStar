import { memo, type FormEvent } from 'react'
import EntityAvatar from '../../../components/EntityAvatar'
import Button from '../../../components/ui/Button'
import PanelCard from '../../../components/ui/PanelCard'
import { cn } from '../../../components/ui/cn'
import type { DiscoverEntity, NodePhysics } from '../../../types'
import { entityKey } from '../../../types'
import { PHYSICS_CONTROLS } from '../../graph/constants'
import type { HiddenEntity, InputMode } from '../../graph/uiTypes'

interface ControlPanelProps {
  query: string
  searchLoading: boolean
  searchResults: DiscoverEntity[]
  searchOpen: boolean
  searchOnlyMode: boolean
  inputMode: InputMode
  isPanning: boolean
  physicsEnabled: boolean
  showPhysicsSettings: boolean
  excludeSelfAppearances: boolean
  hiddenEntityList: HiddenEntity[]
  physicsSettings: NodePhysics
  errorMessage: string | null
  tokenConfigurable: boolean
  onQueryChange: (value: string) => void
  onSearchFocus: () => void
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onChooseSearchResult: (entity: DiscoverEntity) => void
  onToggleSearchOnlyMode: () => void
  onInputModeChange: (mode: InputMode) => void
  onPhysicsEnabledChange: (enabled: boolean) => void
  onClearAllGraph: () => void
  onTogglePhysicsSettings: () => void
  onExcludeSelfAppearancesChange: (enabled: boolean) => void
  onClearHiddenEntities: () => void
  onUnhideEntity: (key: string) => void
  onPhysicsSettingChange: (key: keyof NodePhysics, value: number) => void
  onResetPhysics: () => void
  onOpenTokenSettings: () => void
}

const hintTextClass = 'px-0.5 text-[0.78rem] leading-snug text-slate-300 sm:text-[0.82rem]'

function inputModeButtonClass(active: boolean, withLeftBorder = false): string {
  return cn(
    'flex-1 px-3 py-1.5 text-xs transition',
    withLeftBorder && 'border-l border-slate-500/70',
    active
      ? 'bg-gradient-to-br from-cyan-300 to-sky-500 font-semibold text-slate-950'
      : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800/80',
  )
}

function ControlPanel({
  query,
  searchLoading,
  searchResults,
  searchOpen,
  searchOnlyMode,
  inputMode,
  isPanning,
  physicsEnabled,
  showPhysicsSettings,
  excludeSelfAppearances,
  hiddenEntityList,
  physicsSettings,
  errorMessage,
  tokenConfigurable,
  onQueryChange,
  onSearchFocus,
  onSearchSubmit,
  onChooseSearchResult,
  onToggleSearchOnlyMode,
  onInputModeChange,
  onPhysicsEnabledChange,
  onClearAllGraph,
  onTogglePhysicsSettings,
  onExcludeSelfAppearancesChange,
  onClearHiddenEntities,
  onUnhideEntity,
  onPhysicsSettingChange,
  onResetPhysics,
  onOpenTokenSettings,
}: ControlPanelProps) {
  return (
    <header
      className={cn(
        'absolute left-1/2 top-2 z-50 w-[calc(100vw-0.75rem)] max-w-[760px] -translate-x-1/2 rounded-2xl sm:top-[18px] sm:w-[calc(100vw-1.75rem)]',
        searchOnlyMode
          ? 'border-0 bg-transparent p-0 shadow-none'
          : isPanning
            ? 'max-h-[calc(100dvh-0.75rem)] overflow-y-auto border border-slate-500/55 bg-slate-950/90 p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] sm:max-h-[unset] sm:overflow-visible sm:p-3.5'
            : 'max-h-[calc(100dvh-0.75rem)] overflow-y-auto border border-slate-500/55 bg-slate-950/70 p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:max-h-[unset] sm:overflow-visible sm:p-3.5',
      )}
    >
      <form className="flex flex-col gap-2 sm:gap-2.5 sm:flex-row" onSubmit={(event) => void onSearchSubmit(event)}>
        <input
          type="search"
          value={query}
          placeholder="Search actor, movie, or TV series"
          onFocus={onSearchFocus}
          onChange={(event) => onQueryChange(event.target.value)}
          className="w-full rounded-xl border border-slate-500/70 bg-slate-900/85 px-3.5 py-2.5 text-[0.95rem] text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-400/20"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2.5">
          <button
            type="submit"
            disabled={searchLoading || query.trim().length < 2}
            className="min-h-11 min-w-[84px] rounded-xl border border-cyan-200/40 bg-gradient-to-br from-cyan-300 to-sky-500 px-3.5 py-2.5 text-sm font-bold text-slate-950 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searchLoading ? 'Searching...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={onToggleSearchOnlyMode}
            className="min-h-11 min-w-[96px] rounded-xl border border-slate-500/70 bg-slate-900/85 px-3 py-2.5 text-xs font-semibold text-slate-100 transition hover:border-cyan-300/55 hover:bg-slate-800/80"
          >
            {searchOnlyMode ? 'Show All' : 'Hide All'}
          </button>
        </div>
      </form>

      {searchOpen && searchResults.length > 0 && (
        <ul
          className="mt-2.5 max-h-[min(36dvh,320px)] list-none overflow-auto rounded-xl border border-slate-600/80 bg-slate-950/90 p-0 sm:max-h-[min(42vh,360px)]"
          role="listbox"
        >
          {searchResults.map((result) => (
            <li key={entityKey(result)}>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 border-b border-slate-700/80 bg-transparent px-2.5 py-2.5 text-left text-inherit transition hover:bg-cyan-300/10 last:border-b-0"
                onClick={() => onChooseSearchResult(result)}
              >
                <EntityAvatar
                  imagePath={result.imagePath}
                  title={result.title}
                  className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-500/90 bg-slate-700/70 text-[0.72rem] font-bold"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{result.title}</span>
                  <small className="block truncate text-[0.73rem] text-slate-300">
                    {result.kind.toUpperCase()}
                    {result.subtitle ? ` • ${result.subtitle}` : ''}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!searchOnlyMode && (
        <>
          <div className="mt-2.5 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid w-full grid-cols-2 overflow-hidden rounded-lg border border-slate-500/70 lg:inline-flex lg:w-auto" role="group" aria-label="Input mode">
              <button
                type="button"
                className={inputModeButtonClass(inputMode === 'mouse')}
                onClick={() => onInputModeChange('mouse')}
              >
                Mouse Mode
              </button>
              <button
                type="button"
                className={inputModeButtonClass(inputMode === 'trackpad', true)}
                onClick={() => onInputModeChange('trackpad')}
              >
                Trackpad Mode
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
              <label className="inline-flex items-center gap-2 text-[0.82rem] text-slate-300">
                <input
                  type="checkbox"
                  checked={physicsEnabled}
                  onChange={(event) => onPhysicsEnabledChange(event.target.checked)}
                  className="accent-cyan-300"
                />
                Live Physics
              </label>
              <Button tone="danger" className="ring-2 ring-rose-500/45" onClick={onClearAllGraph}>
                Clear All
              </Button>
              <Button
                disabled={!tokenConfigurable}
                className={tokenConfigurable ? '' : 'cursor-not-allowed opacity-50'}
                onClick={onOpenTokenSettings}
              >
                Set Token
              </Button>
              <Button onClick={onTogglePhysicsSettings}>
                {showPhysicsSettings ? 'Hide Physics' : 'Show Physics'}
              </Button>
            </div>
          </div>

          <PanelCard>
            <div className="flex items-center justify-between gap-2.5">
              <strong className="text-[0.86rem]">Global Filters</strong>
            </div>

            <label className="mt-2 flex items-start gap-2 text-[0.8rem] text-slate-300">
              <input
                type="checkbox"
                checked={excludeSelfAppearances}
                onChange={(event) => onExcludeSelfAppearancesChange(event.target.checked)}
                className="mt-0.5 accent-cyan-300"
              />
              Exclude self-appearances ("Self", "Himself", "Herself", talk-show style entries)
            </label>

            <div className="mt-2.5">
              <div className="flex items-center justify-between gap-2.5">
                <small className="text-slate-300">Hidden Entities ({hiddenEntityList.length})</small>
                {hiddenEntityList.length > 0 && (
                  <Button onClick={onClearHiddenEntities}>
                    Clear Hidden
                  </Button>
                )}
              </div>

              {hiddenEntityList.length === 0 ? (
                <small className="mt-2 block text-slate-400">No hidden entities.</small>
              ) : (
                <ul className="mt-2 grid max-h-[130px] list-none gap-1.5 overflow-auto p-0 max-[780px]:max-h-[104px]">
                  {hiddenEntityList.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-700/90 bg-slate-900/75 px-2 py-1.5"
                    >
                      <span className="truncate text-[0.78rem] text-slate-200">
                        {item.title} <small className="text-slate-400">({item.kind.toUpperCase()})</small>
                      </span>
                      <Button onClick={() => onUnhideEntity(item.key)}>
                        Unhide
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PanelCard>

          {showPhysicsSettings && (
            <PanelCard>
              <div className="flex items-baseline justify-between gap-2.5">
                <strong className="truncate text-[0.86rem]">Global Physics</strong>
                <small className="text-[0.74rem] text-slate-300">Applies to all nodes</small>
              </div>

              <div className="mt-2.5 grid gap-x-2.5 gap-y-2 md:grid-cols-2 max-[780px]:grid-cols-1">
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
                <Button onClick={onResetPhysics}>
                  Reset Physics
                </Button>
              </div>
            </PanelCard>
          )}

          <p className={cn(hintTextClass, 'mt-2.5')}>
            Click a bubble to load 10 connected results; click again for the next 10.
          </p>
          <p className={cn(hintTextClass, 'mt-1')}>Right-click a bubble for hide/prune/delete actions.</p>
          <p className={cn(hintTextClass, 'mt-1')}>
            Touch: one finger pans and two fingers pinch-zoom. Trackpad mode: scroll to zoom, drag to pan.
          </p>
          {errorMessage && <p className="mt-2.5 px-0.5 text-[0.84rem] text-rose-300">{errorMessage}</p>}
        </>
      )}
    </header>
  )
}

export default memo(ControlPanel)
