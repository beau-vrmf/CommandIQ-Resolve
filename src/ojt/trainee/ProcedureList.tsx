import { useEffect, useState } from 'react'
import {
  OjtProfile,
  OjtProcedure,
  OjtSubmission,
  getProcedures,
  getMySubmissions,
} from '../../db/ojt'
import { ProcedureOverview } from './ProcedureOverview'

interface Props {
  profile: OjtProfile
}

export function ProcedureList({ profile }: Props) {
  const [procedures, setProcedures] = useState<OjtProcedure[]>([])
  const [submissions, setSubmissions] = useState<OjtSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<OjtProcedure | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [procs, subs] = await Promise.all([
        getProcedures(profile),
        getMySubmissions(profile.id),
      ])
      setProcedures(procs)
      setSubmissions(subs)
    } catch {
      setError('Failed to load procedures.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [profile.id])

  if (selected) {
    return (
      <ProcedureOverview
        procedure={selected}
        profile={profile}
        onBack={() => { setSelected(null); void load() }}
      />
    )
  }

  // Build a map of latest submission per procedure
  const latestSub = new Map<string, OjtSubmission>()
  for (const s of submissions) {
    const existing = latestSub.get(s.procedure_id)
    if (!existing || new Date(s.started_at) > new Date(existing.started_at)) {
      latestSub.set(s.procedure_id, s)
    }
  }

  // Group procedures by category
  const byCategory = new Map<string, OjtProcedure[]>()
  for (const p of procedures) {
    const cat = p.procedure_category || 'General'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(p)
  }

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <h2 className="text-base font-semibold text-white mb-5">Available Procedures</h2>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && <p className="text-red-400 text-sm text-center py-8">{error}</p>}

      {!loading && !error && procedures.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-12">
          No procedures available for your aircraft/AFSC. Contact your administrator.
        </p>
      )}

      {Array.from(byCategory.entries()).map(([category, procs]) => (
        <div key={category} className="mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{category}</p>
          <div className="flex flex-col gap-2">
            {procs.map((proc) => {
              const sub = latestSub.get(proc.id)
              const statusInfo = sub ? getStatusDisplay(sub.status) : null

              return (
                <button
                  key={proc.id}
                  onClick={() => setSelected(proc)}
                  className="text-left p-4 bg-slate-800 border border-slate-700 hover:border-violet-500 rounded-xl transition group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white group-hover:text-violet-300 transition truncate">
                        {proc.title}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-400">
                        <span>{proc.aircraft}</span>
                        {proc.afsc && <span>AFSC {proc.afsc}</span>}
                        {proc.skill_level && <span>{proc.skill_level}</span>}
                        {proc.estimated_minutes && <span>~{proc.estimated_minutes} min</span>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      {statusInfo && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      )}
                      <span className="text-slate-500 group-hover:text-violet-400 transition text-sm">→</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function getStatusDisplay(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    in_progress: { label: 'In Progress', className: 'bg-amber-900/50 text-amber-300 border border-amber-700' },
    submitted: { label: 'Submitted', className: 'bg-blue-900/50 text-blue-300 border border-blue-700' },
    approved: { label: 'Approved', className: 'bg-green-900/50 text-green-300 border border-green-700' },
    returned: { label: 'Returned', className: 'bg-red-900/50 text-red-300 border border-red-700' },
    incomplete: { label: 'Incomplete', className: 'bg-slate-700 text-slate-400' },
    retrain: { label: 'Retrain', className: 'bg-red-900/50 text-red-300 border border-red-700' },
  }
  return map[status] ?? { label: status, className: 'bg-slate-700 text-slate-400' }
}
