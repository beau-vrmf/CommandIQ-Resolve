// Search / browse components without the camera (PRD §12.9).

import { useEffect, useState } from 'react'
import { ScanComponent, searchComponents } from '../db/scan'
import { ComponentCard } from './ComponentCard'

export function BrowseList() {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<ScanComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ScanComponent | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const data = await searchComponents(term)
        if (active) setResults(data)
      } finally {
        if (active) setLoading(false)
      }
    }, 250)
    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [term])

  return (
    <div className="px-5 py-5 max-w-lg mx-auto w-full">
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search components, system, aircraft…"
        className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm mb-4"
      />

      {loading ? (
        <p className="text-slate-500 text-sm text-center py-8">Loading…</p>
      ) : results.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">No components found.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelected(c)}
                className="w-full text-left p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-emerald-500 transition"
              >
                <p className="text-sm font-medium text-white">{c.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {c.aircraft}
                  {c.system ? ` · ${c.system}` : ''} · {c.area}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && <ComponentCard component={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
