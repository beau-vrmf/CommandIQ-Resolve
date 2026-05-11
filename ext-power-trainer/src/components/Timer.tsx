import { useEffect, useState } from 'react'
import { totalElapsedMs, useSession } from '../store/session'

function fmt(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function Timer() {
  const active = useSession((s) => s.active)
  const [, tick] = useState(0)

  useEffect(() => {
    if (!active || active.resumedAt === null) return
    const id = setInterval(() => tick((n) => n + 1), 500)
    return () => clearInterval(id)
  }, [active?.id, active?.resumedAt])

  if (!active) return null
  const running = active.resumedAt !== null
  return (
    <div
      className={`font-mono text-base px-3 py-1 rounded-md ${
        running ? 'bg-emerald-700/40 text-emerald-200' : 'bg-slate-700 text-slate-300'
      }`}
      aria-label={running ? 'Timer running' : 'Timer paused'}
    >
      {fmt(totalElapsedMs(active))}
    </div>
  )
}
