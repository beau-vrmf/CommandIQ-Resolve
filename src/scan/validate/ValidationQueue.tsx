// SME validation queue (PRD §12.11, §16.4). Mirrors ojt/supervisor/ReviewQueue:
// lists submitted components and lets an SME approve (→ publish) or return.

import { useEffect, useState } from 'react'
import { ScanComponent, getValidationQueue, reviewComponent } from '../db/scan'
import { ComponentCard } from '../scan/ComponentCard'

export function ValidationQueue() {
  const [queue, setQueue] = useState<ScanComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<ScanComponent | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setQueue(await getValidationQueue())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function decide(c: ScanComponent, decision: 'approved' | 'returned') {
    setBusy(c.id)
    try {
      await reviewComponent(c.id, decision)
      await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="px-5 py-5 max-w-2xl mx-auto w-full">
      <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-4">Pending SME validation</h2>

      {loading ? (
        <p className="text-slate-500 text-sm text-center py-8">Loading…</p>
      ) : queue.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">Nothing awaiting validation.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {queue.map((c) => (
            <li key={c.id} className="p-3 rounded-lg bg-slate-800 border border-slate-700">
              <button onClick={() => setPreview(c)} className="text-left w-full">
                <p className="text-sm font-medium text-white">{c.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {c.aircraft}
                  {c.system ? ` · ${c.system}` : ''} · {c.area}
                  {c.content_owner ? ` · ${c.content_owner}` : ''}
                </p>
              </button>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => decide(c, 'approved')}
                  disabled={busy === c.id}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
                >
                  Approve & publish
                </button>
                <button
                  onClick={() => decide(c, 'returned')}
                  disabled={busy === c.id}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium"
                >
                  Return
                </button>
                <button
                  onClick={() => setPreview(c)}
                  className="text-xs px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Preview
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {preview && <ComponentCard component={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
