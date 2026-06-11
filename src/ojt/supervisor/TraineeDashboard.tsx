import { useEffect, useState } from 'react'
import { OjtProfile, TraineeSummary, getTraineeSummaries } from '../../db/ojt'

interface Props {
  profile: OjtProfile
  onBack: () => void
}

export function TraineeDashboard({ profile, onBack }: Props) {
  const [summaries, setSummaries] = useState<TraineeSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setSummaries(await getTraineeSummaries(profile.id))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [profile.id])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-4 transition-colors"
      >
        ← Back to Queue
      </button>
      <h2 className="text-base font-semibold text-white mb-1">Trainee Dashboard</h2>
      <p className="text-xs text-slate-500 mb-5">
        {summaries.length} trainee{summaries.length !== 1 ? 's' : ''} assigned to you
      </p>

      {summaries.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 text-sm mb-2">No trainees assigned yet.</p>
          <p className="text-slate-600 text-xs">
            Go to Manage → Users to set supervisor assignments.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {summaries.map(
            ({
              profile: trainee,
              totalSubmissions,
              approvedSubmissions,
              pendingSubmissions,
              returnedSubmissions,
              lastActivityAt,
            }) => {
              const pct =
                totalSubmissions > 0
                  ? Math.round((approvedSubmissions / totalSubmissions) * 100)
                  : 0

              return (
                <div
                  key={trainee.id}
                  className={`p-4 bg-slate-800 border rounded-xl ${
                    returnedSubmissions > 0 ? 'border-amber-800' : 'border-slate-700'
                  }`}
                >
                  {/* Trainee header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-medium text-white">
                        {trainee.rank ? `${trainee.rank} ` : ''}
                        {trainee.display_name}
                      </p>
                      <p className="text-xs text-slate-400">#{trainee.man_number}</p>
                      {(trainee.aircraft || trainee.afsc) && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {trainee.aircraft}
                          {trainee.afsc ? ` · ${trainee.afsc}` : ''}
                          {trainee.current_skill_level
                            ? ` · ${trainee.current_skill_level}`
                            : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {pendingSubmissions > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-700">
                          {pendingSubmissions} pending
                        </span>
                      )}
                      {returnedSubmissions > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 border border-amber-700">
                          {returnedSubmissions} returned
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {totalSubmissions > 0 ? (
                    <>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Approved procedures</span>
                        <span className="text-white font-medium">
                          {approvedSubmissions} / {totalSubmissions} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-600 mb-2">No procedures started yet</p>
                  )}

                  {/* Footer */}
                  {lastActivityAt && (
                    <p className="text-xs text-slate-600">
                      Last activity {new Date(lastActivityAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )
            },
          )}
        </div>
      )}
    </div>
  )
}
