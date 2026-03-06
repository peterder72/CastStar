import { memo, type FormEvent } from 'react'
import EntityAvatar from '../../../components/EntityAvatar'
import Button from '../../../components/ui/Button'
import PanelCard from '../../../components/ui/PanelCard'
import { cn } from '../../../components/ui/cn'
import type { DiscoverEntity } from '../../../types'
import { entityKey } from '../../../types'
import type { HiddenEntity } from '../../graph/uiTypes'
import type { InputMode } from '../../graph/uiTypes'
import type { NodePhysics } from '../../../types'
import SettingsMenu from './SettingsMenu'

interface ControlPanelProps {
  query: string
  searchLoading: boolean
  searchResults: DiscoverEntity[]
  searchOpen: boolean
  searchOnlyMode: boolean
  isPanning: boolean
  excludeSelfAppearances: boolean
  includeCrewConnections: boolean
  hiddenEntityList: HiddenEntity[]
  errorMessage: string | null
  inputMode: InputMode
  physicsEnabled: boolean
  showPhysicsSettings: boolean
  physicsSettings: NodePhysics
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
  onPhysicsSettingChange: (key: keyof NodePhysics, value: number) => void
  onResetPhysics: () => void
  onOpenTokenSettings: () => void
  onExcludeSelfAppearancesChange: (enabled: boolean) => void
  onIncludeCrewConnectionsChange: (enabled: boolean) => void
  onClearHiddenEntities: () => void
  onUnhideEntity: (key: string) => void
}

function ControlPanel({
  query,
  searchLoading,
  searchResults,
  searchOpen,
  searchOnlyMode,
  isPanning,
  excludeSelfAppearances,
  includeCrewConnections,
  hiddenEntityList,
  errorMessage,
  inputMode,
  physicsEnabled,
  showPhysicsSettings,
  physicsSettings,
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
  onPhysicsSettingChange,
  onResetPhysics,
  onOpenTokenSettings,
  onExcludeSelfAppearancesChange,
  onIncludeCrewConnectionsChange,
  onClearHiddenEntities,
  onUnhideEntity,
}: ControlPanelProps) {
  return (
    <header
      className={cn(
        'absolute left-1.5 right-1.5 top-2 z-50 max-w-[760px] rounded-2xl transition-[padding,background-color,border-color,box-shadow] duration-180 ease-out sm:left-1/2 sm:right-auto sm:top-[18px] sm:w-[calc(100vw-6.75rem)] sm:-translate-x-1/2',
        searchOnlyMode
          ? 'border-0 bg-transparent p-0 shadow-none'
          : isPanning
            ? 'max-h-[calc(100dvh-0.75rem)] overflow-y-auto border border-slate-500/55 bg-slate-950/90 p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] sm:max-h-[unset] sm:overflow-visible sm:p-3.5'
            : 'max-h-[calc(100dvh-0.75rem)] overflow-y-auto border border-slate-500/55 bg-slate-950/70 p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:max-h-[unset] sm:overflow-visible sm:p-3.5',
      )}
    >
      <form className="flex items-center gap-1.5 sm:gap-2.5" onSubmit={(event) => void onSearchSubmit(event)}>
        <input
          type="search"
          value={query}
          placeholder="Search actor, movie, series"
          onFocus={onSearchFocus}
          onChange={(event) => onQueryChange(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-slate-500/70 bg-slate-900/85 px-3 py-2.5 text-[0.95rem] text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-400/20 sm:px-3.5"
        />
        <div className="flex shrink-0 gap-1.5 sm:gap-2.5">
          <button
            type="submit"
            disabled={searchLoading || query.trim().length < 2}
            className="min-h-10 min-w-[68px] rounded-xl border border-cyan-200/40 bg-gradient-to-br from-cyan-300 to-sky-500 px-2.5 py-2 text-sm font-bold text-slate-950 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:min-w-[84px] sm:px-3.5 sm:py-2.5"
          >
            {searchLoading ? '...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={onToggleSearchOnlyMode}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-500/70 bg-slate-900/85 text-slate-100 transition hover:border-cyan-300/55 hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/55 sm:h-11 sm:w-11"
            aria-label={searchOnlyMode ? 'Show filters' : 'Hide filters'}
            title={searchOnlyMode ? 'Show filters' : 'Hide filters'}
          >
            <svg
              viewBox="0 0 24 24"
              className={cn('h-4 w-4 fill-current transition-transform duration-180 ease-out', searchOnlyMode ? 'rotate-0' : 'rotate-180')}
              aria-hidden="true"
            >
              <path d="M12 16.4a1 1 0 0 1-.7-.29l-5.5-5.5a1 1 0 1 1 1.4-1.42L12 14l4.8-4.8a1 1 0 0 1 1.4 1.42l-5.5 5.5a1 1 0 0 1-.7.28Z" />
            </svg>
          </button>
          <SettingsMenu
            inputMode={inputMode}
            physicsEnabled={physicsEnabled}
            showPhysicsSettings={showPhysicsSettings}
            physicsSettings={physicsSettings}
            tokenConfigurable={tokenConfigurable}
            onInputModeChange={onInputModeChange}
            onPhysicsEnabledChange={onPhysicsEnabledChange}
            onClearAllGraph={onClearAllGraph}
            onTogglePhysicsSettings={onTogglePhysicsSettings}
            onPhysicsSettingChange={onPhysicsSettingChange}
            onResetPhysics={onResetPhysics}
            onOpenTokenSettings={onOpenTokenSettings}
          />
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
                  <span className="block break-words text-sm font-semibold leading-tight whitespace-normal">{result.title}</span>
                  <small className="block break-words text-[0.73rem] leading-tight whitespace-normal text-slate-300">
                    {result.kind.toUpperCase()}
                    {result.subtitle ? ` • ${result.subtitle}` : ''}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className={cn(
          'grid overflow-hidden transition-[grid-template-rows,opacity] duration-180 ease-out',
          searchOnlyMode ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        )}
        aria-hidden={searchOnlyMode}
      >
        <div className="min-h-0">
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

            <label className="mt-2 flex items-start gap-2 text-[0.8rem] text-slate-300">
              <input
                type="checkbox"
                checked={includeCrewConnections}
                onChange={(event) => onIncludeCrewConnectionsChange(event.target.checked)}
                className="mt-0.5 accent-cyan-300"
              />
              Include crew connections (Directing & Writing)
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
                      <span className="break-words text-[0.78rem] leading-tight whitespace-normal text-slate-200">
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
        </div>
      </div>

      {errorMessage && <p className="mt-2.5 px-0.5 text-[0.84rem] text-rose-300">{errorMessage}</p>}
    </header>
  )
}

export default memo(ControlPanel)
