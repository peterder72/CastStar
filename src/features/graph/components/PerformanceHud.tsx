import { memo } from 'react'
import type { PerformanceStats } from '../uiTypes'

interface PerformanceHudProps {
  stats: PerformanceStats
}

function PerformanceHud({ stats }: PerformanceHudProps) {
  return (
    <aside className="performance-hud pointer-events-auto rounded-xl border border-slate-500/70 bg-slate-950/78 px-2.5 py-1.5 text-slate-100 shadow-[0_12px_28px_rgba(0,0,0,0.4)] backdrop-blur-md">
      <p className="font-mono text-[0.72rem] sm:text-[0.76rem]">{stats.fps.toFixed(1)} fps</p>
      <div className="performance-hud-details mt-1 border-t border-slate-600/70 pt-1 font-mono text-[0.66rem] text-slate-300">
        <p>frame {stats.frameMs.toFixed(2)}ms</p>
        <p>physics {stats.physicsMs.toFixed(2)}ms</p>
        <p>
          {stats.nodeCount} nodes | {stats.edgeCount} edges
        </p>
      </div>
    </aside>
  )
}

export default memo(PerformanceHud)
