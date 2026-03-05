import { useCallback, useEffect, useRef, useState } from 'react'
import Button from './ui/Button'
import { getUserToken, setUserToken } from '../tmdb'

interface TokenSettingsModalProps {
  open: boolean
  onClose: () => void
}

function TokenSettingsModal({ open, onClose }: TokenSettingsModalProps) {
  const [value, setValue] = useState(() => getUserToken())
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const handleSave = useCallback(() => {
    setUserToken(value)
  }, [value])

  const handleClear = useCallback(() => {
    setUserToken('')
  }, [])

  if (!open) {
    return null
  }

  const hasExistingToken = getUserToken().length > 0

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-3 grid w-full max-w-md gap-3 rounded-2xl border border-slate-500/55 bg-slate-950/95 p-4 shadow-[0_24px_48px_rgba(0,0,0,0.5)] backdrop-blur-md"
        onClick={(event) => event.stopPropagation()}
      >
        <strong className="text-[0.95rem] text-slate-100">TMDB API Token</strong>
        <p className="text-[0.8rem] leading-snug text-slate-300">
          Enter your TMDB API key or Read Access Token. The token is stored locally on this device.
        </p>
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder="Paste your TMDB token here"
          onChange={(event) => setValue(event.target.value)}
          className="w-full rounded-xl border border-slate-500/70 bg-slate-900/85 px-3.5 py-2.5 text-[0.9rem] text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-400/20"
        />
        <div className="flex items-center justify-end gap-2">
          {hasExistingToken && (
            <Button tone="danger" onClick={handleClear}>
              Remove Token
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <button
            type="button"
            disabled={value.trim().length === 0}
            onClick={handleSave}
            className="min-h-10 rounded-lg border border-cyan-200/40 bg-gradient-to-br from-cyan-300 to-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save & Reload
          </button>
        </div>
      </div>
    </div>
  )
}

export default TokenSettingsModal
