import { useEffect, useState } from 'react'
import { OjtProfile, OjtSubmission, OjtProcedure, getReviewQueue } from '../../db/ojt'
import { SubmissionReview } from './SubmissionReview'

interface Props {
  profile: OjtProfile
}

type FilterTab = 'pending' | 'approved' | 'returned'

type QueueItem = OjtSubmission & { procedure: OjtProcedure; profile: OjtProfile }

export function ReviewQueue({ profile }: Props) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState<FilterTab>('pending')
  const [selected, setSelected] = useState<QueueItem | null>(null)

  async function load() {
    setLoading(true)
    try {
      setItems(await getReviewQueue())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  if (selected) {
    return (
      <SubmissionReview
        submissionId={selected.id}
        reviewer={profile}
        onBack={() => { setSelected(null); void load() }}
      />
    )
  }

  const statusGroups: Record<FilterTab, string[]> = {
    pending: ['submitted'],
    approved: ['approved'],
    returned: ['returned', 'incomplete', 'retrain'],
  }

  const filtered = items.filter((i) => statusGroups[filterTab].includes(i.status))

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <h2 className="text-base font-semibold text-white mb-4">Review Queue</h2>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-slate-800 rounded-xl p-1">
        {(
          [
            { id: 'pending' as FilterTab, label: 'Pending' },
            { id: 'approved' as FilterTab, label: 'Approved' },
            { id: 'returned' as FilterTab, label: 'Returned' },
          ] as const
        ).map((tab) => {
          const count = items.filter((i) => statusGroups[tab.id].includes(i.status)).length
          return (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterTab === tab.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  tab.id === 'pending' ? 'bg-blue-700 text-blue-100' : 'bg-slate-600 text-slate-300'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-12">
          {filterTab === 'pending' ? 'No submissions awaiting review.' : `No ${filterTab} submissions.`}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className="text-left p-4 bg-slate-800 border border-slate-700 hover:border-violet-500 rounded-xl transition group"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white group-hover:text-violet-300 transition">
                  {item.procedure.title}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {item.profile.rank ? `${item.profile.rank} ` : ''}{item.profile.display_name}
                  {' · '}#{item.profile.man_number}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {item.submitted_at
                    ? `Submitted ${new Date(item.submitted_at).toLocaleString()}`
                    : `Started ${new Date(item.started_at).toLocaleString()}`}
                </p>
              </div>
              <StatusChip status={item.status} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    submitted: 'bg-blue-900/50 text-blue-300 border border-blue-700',
    approved: 'bg-green-900/50 text-green-300 border border-green-700',
    returned: 'bg-red-900/50 text-red-300 border border-red-700',
    incomplete: 'bg-slate-700 text-slate-400',
    retrain: 'bg-red-900/50 text-red-300 border border-red-700',
  }
  const labels: Record<string, string> = {
    submitted: 'Pending Review',
    approved: 'Approved',
    returned: 'Returned',
    incomplete: 'Incomplete',
    retrain: 'Retrain',
  }
  return (
    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${map[status] ?? 'bg-slate-700 text-slate-400'}`}>
      {labels[status] ?? status}
    </span>
  )
}
