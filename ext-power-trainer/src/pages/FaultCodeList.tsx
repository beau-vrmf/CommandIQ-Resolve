import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { faultCodes } from '../data/fi-tree'
import { useSession } from '../store/session'

export function FaultCodeList() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const startSession = useSession((s) => s.startSession)
  const active = useSession((s) => s.active)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return faultCodes
    return faultCodes.filter(
      (f) =>
        f.code.includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.reference.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <div className="flex-1 flex flex-col px-4 py-4 gap-4 max-w-3xl w-full mx-auto">
      {active && active.outcome === null && (
        <button
          onClick={() => navigate('/session')}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white text-lg font-semibold py-4 rounded-lg shadow"
        >
          Resume session — fault {active.faultCode}, block {active.currentBlockId.split('/').pop()}
        </button>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Training Module</p>
        <p className="text-sm text-slate-300">
          This is a scored training exercise. Each incorrect decision deducts 10 points from your score.
          Follow the fault isolation procedure carefully.
        </p>
      </div>

      <div>
        <label className="text-sm text-slate-400" htmlFor="fc-search">
          Search fault codes
        </label>
        <input
          id="fc-search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. 240115 or 'external power'"
          className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <ul className="flex flex-col gap-3">
        {filtered.map((f) => (
          <li key={f.code}>
            <button
              disabled={!f.entry}
              onClick={() => {
                if (!f.entry) return
                startSession(f.code, f.entry)
                navigate('/session')
              }}
              className="w-full text-left bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 rounded-lg p-4 border border-slate-700"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-brand-50 text-lg font-semibold">{f.code}</span>
                {!f.entry && (
                  <span className="text-xs uppercase tracking-wide text-slate-400">Not yet authored</span>
                )}
              </div>
              <p className="text-slate-200 mt-1">{f.description}</p>
              <p className="text-xs text-slate-400 mt-2">{f.reference}</p>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-slate-400 text-center py-8">No fault codes match "{query}".</li>
        )}
      </ul>
    </div>
  )
}
