import { useEffect, useState } from 'react'
import {
  OjtProfile,
  OjtSubmission,
  OjtProcedure,
  getReviewQueue,
  exportTrainingRecordsCSV,
} from '../../db/ojt'
import { SubmissionReview } from './SubmissionReview'
import { TraineeDashboard } from './TraineeDashboard'

interface Props {
  profile: OjtProfile
}

type FilterTab = 'pending' | 'approved' | 'returned'
type View = 'queue' | 'review' | 'dashboard'

type QueueItem = OjtSubmission & { procedure: OjtProcedure; profile: OjtProfile }

export function ReviewQueue({ profile }: Props) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState<FilterTab>('pending')
  const [view, setView] = useState<View>('queue')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setItems(await getReviewQueue(profile.id, profile.role))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleExport() {
    setExporting(true)
    try {
      const csv = await exportTrainingRecordsCSV(profile.id, profile.role)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `training-records-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  if (view === 'review' && selectedId) {
    return (
      <SubmissionReview
        submissionId={selectedId}
        reviewer={profile}
        onBack={() => {
          setView('queue')
          setSelectedId(null)
          void load()
        }}
      />
    )
  }

  if (view === 'dashboard') {
    return <TraineeDashboard profile={profile} onBack={() => setView('queue')} />
  }

  const statusGroups: Record<FilterTab, string[]> = {
    pending: ['submitted'],
    approved: ['approved'],
    returned: ['returned', 'incomplete', 'retrain'],
  }

  const filtered = items.filter((i) => statusGroups[filterTab].includes(i.status))

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Review Queue</h2>
        <div className="flex gap-2">
          {profile.role === 'supervisor' && (
            <button
              onClick={() => setView('dashboard')}
              className="text-sm px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
            >
              📊 Trainees
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="text-sm px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors disabled:opacity-50"
            title="Export approved training records as CSV"
          >
            {exporting ? 'Exporting…' : '⬇ Export'}
          </button>
        </div>
      </div>

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
                <span
                  className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    tab.id === 'pending'
                      ? 'bg-blue-700 text-blue-100'
                      : 'bg-slate-600 text-slate-300'
                  }`}
                >
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
          {filterTab === 'pending'
            ? 'No submissions awaiting review.'
            : `No ${filterTab} submissions.`}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setSelectedId(item.id)
              setView('review')
            }}
            className="text-left p-4 bg-slate-800 border border-slate-700 hover:border-violet-500 rounded-xl transition group"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white group-hover:text-violet-300 transition">
                  {item.procedure.title}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {item.profile.rank ? `${item.profile.rank} ` : ''}
                  {item.profile.display_name}
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
    <span
      className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${map[status] ?? 'bg-slate-700 text-slate-400'}`}
    >
      {labels[status] ?? status}
    </span>
  )
}
