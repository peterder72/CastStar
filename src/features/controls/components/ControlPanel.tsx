import type { FormEvent } from 'react'
import EntityAvatar from '../../../components/EntityAvatar'
import type { DiscoverEntity, NodePhysics } from '../../../types'
import { entityKey } from '../../../types'
import { PHYSICS_CONTROLS } from '../../graph/constants'
import type { HiddenEntity, InputMode } from '../../graph/uiTypes'

interface ControlPanelProps {
  query: string
  searchLoading: boolean
  searchResults: DiscoverEntity[]
  searchOpen: boolean
  inputMode: InputMode
  physicsEnabled: boolean
  showPhysicsSettings: boolean
  excludeSelfAppearances: boolean
  hiddenEntityList: HiddenEntity[]
  physicsSettings: NodePhysics
  errorMessage: string | null
  onQueryChange: (value: string) => void
  onSearchFocus: () => void
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onChooseSearchResult: (entity: DiscoverEntity) => void
  onInputModeChange: (mode: InputMode) => void
  onPhysicsEnabledChange: (enabled: boolean) => void
  onCoolDownGraph: () => void
  onTogglePhysicsSettings: () => void
  onExcludeSelfAppearancesChange: (enabled: boolean) => void
  onClearHiddenEntities: () => void
  onUnhideEntity: (key: string) => void
  onPhysicsSettingChange: (key: keyof NodePhysics, value: number) => void
  onResetPhysics: () => void
}

function ControlPanel({
  query,
  searchLoading,
  searchResults,
  searchOpen,
  inputMode,
  physicsEnabled,
  showPhysicsSettings,
  excludeSelfAppearances,
  hiddenEntityList,
  physicsSettings,
  errorMessage,
  onQueryChange,
  onSearchFocus,
  onSearchSubmit,
  onChooseSearchResult,
  onInputModeChange,
  onPhysicsEnabledChange,
  onCoolDownGraph,
  onTogglePhysicsSettings,
  onExcludeSelfAppearancesChange,
  onClearHiddenEntities,
  onUnhideEntity,
  onPhysicsSettingChange,
  onResetPhysics,
}: ControlPanelProps) {
  return (
    <header className="search-panel">
      <form className="search-form" onSubmit={(event) => void onSearchSubmit(event)}>
        <input
          type="search"
          value={query}
          placeholder="Search actor, movie, or TV series"
          onFocus={onSearchFocus}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <button type="submit" disabled={searchLoading || query.trim().length < 2}>
          {searchLoading ? 'Searching...' : 'Add'}
        </button>
      </form>

      {searchOpen && searchResults.length > 0 && (
        <ul className="search-results" role="listbox">
          {searchResults.map((result) => (
            <li key={entityKey(result)}>
              <button type="button" className="result-row" onClick={() => onChooseSearchResult(result)}>
                <EntityAvatar imagePath={result.imagePath} title={result.title} className="result-thumb" />
                <span className="result-copy">
                  <span>{result.title}</span>
                  <small>
                    {result.kind.toUpperCase()}
                    {result.subtitle ? ` • ${result.subtitle}` : ''}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="control-toolbar">
        <div className="input-mode-switch" role="group" aria-label="Input mode">
          <button
            type="button"
            className={inputMode === 'mouse' ? 'is-active' : ''}
            onClick={() => onInputModeChange('mouse')}
          >
            Mouse Mode
          </button>
          <button
            type="button"
            className={inputMode === 'trackpad' ? 'is-active' : ''}
            onClick={() => onInputModeChange('trackpad')}
          >
            Trackpad Mode
          </button>
        </div>

        <div className="physics-toolbar">
          <label>
            <input
              type="checkbox"
              checked={physicsEnabled}
              onChange={(event) => onPhysicsEnabledChange(event.target.checked)}
            />
            Live Physics
          </label>
          <button type="button" onClick={onCoolDownGraph}>
            Stop Motion
          </button>
          <button type="button" onClick={onTogglePhysicsSettings}>
            {showPhysicsSettings ? 'Hide Physics' : 'Show Physics'}
          </button>
        </div>
      </div>

      <section className="filter-panel">
        <div className="filter-panel-head">
          <strong>Global Filters</strong>
        </div>

        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={excludeSelfAppearances}
            onChange={(event) => onExcludeSelfAppearancesChange(event.target.checked)}
          />
          Exclude self-appearances ("Self", "Himself", "Herself", talk-show style entries)
        </label>

        <div className="hidden-entities">
          <div className="hidden-entities-head">
            <small>Hidden Entities ({hiddenEntityList.length})</small>
            {hiddenEntityList.length > 0 && (
              <button type="button" onClick={onClearHiddenEntities}>
                Clear Hidden
              </button>
            )}
          </div>

          {hiddenEntityList.length === 0 ? (
            <small className="hidden-empty">No hidden entities.</small>
          ) : (
            <ul className="hidden-entities-list">
              {hiddenEntityList.map((item) => (
                <li key={item.key}>
                  <span>
                    {item.title} <small>({item.kind.toUpperCase()})</small>
                  </span>
                  <button type="button" onClick={() => onUnhideEntity(item.key)}>
                    Unhide
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {showPhysicsSettings && (
        <section className="physics-panel">
          <div className="physics-panel-head">
            <strong>Global Physics</strong>
            <small>Applies to all nodes</small>
          </div>

          <div className="physics-controls">
            {PHYSICS_CONTROLS.map((control) => {
              const currentValue = physicsSettings[control.key]

              return (
                <label key={control.key} className="physics-control">
                  <span>
                    {control.label}
                    <b>{currentValue.toFixed(control.precision)}</b>
                  </span>
                  <input
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={currentValue}
                    onChange={(event) => onPhysicsSettingChange(control.key, Number.parseFloat(event.target.value))}
                  />
                </label>
              )
            })}
          </div>

          <div className="physics-panel-actions">
            <button type="button" onClick={onResetPhysics}>
              Reset Physics
            </button>
          </div>
        </section>
      )}

      <p className="hint-text">Click a bubble to load 10 connected results; click again for the next 10.</p>
      <p className="hint-text">Right-click a bubble for hide/prune/delete actions.</p>
      <p className="hint-text">Trackpad mode: scroll to zoom, drag to pan. Mouse mode keeps the original controls.</p>
      {errorMessage && <p className="error-text">{errorMessage}</p>}
    </header>
  )
}

export default ControlPanel
