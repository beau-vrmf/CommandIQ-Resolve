// @ts-nocheck -- Upgrade Training (PRD 1) — disconnected, kept for future build
import { useEffect, useState } from 'react'
import { OjtProfile, getMyTrainees, getTraineeWithProgress, TraineeWithProgress } from '../../db/ojt'
import { MyRecords } from '../trainee/MyRecords'
import { CreateUser } from './CreateUser'

interface Props {
  supervisorProfile: OjtProfile
}

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'trainee'; profile: OjtProfile }

export function MyTrainees({ supervisorProfile }: Props) {
  const [trainees, setTrainees] = useState<OjtProfile[]>([])
  const [progress, setProgress] = useState<Map<string, TraineeWithProgress>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'list' })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const list = await getMyTrainees(supervisorProfile.id)
      setTrainees(list)
      // Load progress summaries in parallel
      const entries = await Promise.all(
        list.map((t) => getTraineeWithProgress(t.id)),
      )
      const map = new Map<string, TraineeWithProgress>()
      for (const entry of entries) {
        if (entry) map.set(entry.profile.id, entry)
      }
      setProgress(map)
    } catch {
      setError('Failed to load trainees.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [supervisorProfile.id])

  if (view.kind === 'trainee') {
    return (
      <div>
        <div className="px-4 pt-4 max-w-2xl mx-auto">
          <button
            onClick={() => setView({ kind: 'list' })}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-1 transition-colors"
          >
            ← Back to My Trainees
          </button>
        </div>
        {/* Read-only records view for this trainee */}
        <MyRecords profile={view.profile} />
      </div>
    )
  }

  if (view.kind === 'create') {
    return (
      <CreateUser
        supervisorProfile={supervisorProfile}
        onBack={() => { setView({ kind: 'list' }); void load() }}
      />
    )
  }

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-white">My Trainees</h2>
        <button
          onClick={() => setView({ kind: 'create' })}
          className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-colors"
        >
          + Create Trainee
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-red-400 text-sm text-center py-8">{error}</p>}

      {!loading && !error && trainees.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-12">
          No trainees assigned yet. Create one to get started.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {trainees.map((trainee) => {
          const tw = progress.get(trainee.id)
          const pct = tw && tw.totalTasks > 0
            ? Math.round((tw.completedTasks / tw.totalTasks) * 100)
            : 0

          return (
            <button
              key={trainee.id}
              onClick={() => setView({ kind: 'trainee', profile: trainee })}
              className="text-left p-4 bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl transition group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white group-hover:text-blue-300 transition">
                    {trainee.rank ? `${trainee.rank} ` : ''}{trainee.display_name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Man #{trainee.man_number}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-slate-400">
                    {trainee.aircraft && <span>{trainee.aircraft}</span>}
                    {trainee.afsc && <span>AFSC {trainee.afsc}</span>}
                    {trainee.target_skill_level && <span>→ {trainee.target_skill_level}</span>}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-lg font-bold text-blue-400">{pct}%</p>
                  {tw && (
                    <p className="text-xs text-slate-500">{tw.completedTasks}/{tw.totalTasks}</p>
                  )}
                </div>
              </div>
              {tw && tw.totalTasks > 0 && (
                <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
