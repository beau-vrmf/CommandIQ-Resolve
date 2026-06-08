// @ts-nocheck -- Upgrade Training (PRD 1) — disconnected, kept for future build
import { useState } from 'react'
import { TaskWithProgress, ProgressStatus, upsertProgress, getSignedContentUrl } from '../../db/ojt'

interface Props {
  task: TaskWithProgress
  profileId: string
  onBack: () => void
}

const STATUS_OPTIONS: { value: ProgressStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'content_complete', label: 'Content Complete' },
  { value: 'not_applicable', label: 'Not Applicable' },
]

export function TaskDetail({ task, profileId, onBack }: Props) {
  const [status, setStatus] = useState<ProgressStatus>(
    task.progress?.status ?? 'not_started',
  )
  const [notes, setNotes] = useState(task.progress?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [openingUrl, setOpeningUrl] = useState<string | null>(null)

  async function saveProgress(newStatus: ProgressStatus) {
    setStatus(newStatus)
    setSaving(true)
    try {
      const now = new Date().toISOString()
      await upsertProgress(profileId, task.id, {
        status: newStatus,
        started_at: newStatus !== 'not_started' && !task.progress?.started_at ? now : task.progress?.started_at ?? undefined,
        completed_at: newStatus === 'content_complete' ? now : task.progress?.completed_at ?? undefined,
        last_activity_at: now,
      })
    } catch {
      // Revert on error
      setStatus(task.progress?.status ?? 'not_started')
    } finally {
      setSaving(false)
    }
  }

  async function saveNotes() {
    setSaving(true)
    try {
      await upsertProgress(profileId, task.id, {
        notes,
        last_activity_at: new Date().toISOString(),
      })
    } finally {
      setSaving(false)
    }
  }

  async function openContent(filePath: string | null, externalUrl: string | null) {
    if (externalUrl) {
      window.open(externalUrl, '_blank', 'noopener,noreferrer')
      return
    }
    if (!filePath) return
    setOpeningUrl(filePath)
    try {
      const url = await getSignedContentUrl(filePath)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      alert('Failed to open file. Please try again.')
    } finally {
      setOpeningUrl(null)
    }
  }

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-5 transition-colors"
      >
        <span>←</span> Back to My Records
      </button>

      <div className="mb-5">
        <div className="flex items-start gap-2 mb-1">
          {task.category && (
            <span className="text-xs text-slate-500 uppercase tracking-wider">{task.category}</span>
          )}
        </div>
        <h1 className="text-lg font-semibold text-white">
          {task.task_number ? `${task.task_number}. ` : ''}{task.title}
        </h1>
        {task.estimated_minutes && (
          <p className="text-xs text-slate-500 mt-1">Estimated time: ~{task.estimated_minutes} min</p>
        )}
        {task.description && (
          <p className="text-sm text-slate-300 mt-3 leading-relaxed">{task.description}</p>
        )}
      </div>

      {/* Status selector */}
      <div className="mb-5">
        <p className="text-sm font-medium text-slate-300 mb-2">Status</p>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => saveProgress(opt.value)}
              disabled={saving}
              className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors ${
                status === opt.value
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Training content */}
      {task.content.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-medium text-slate-300 mb-2">Training Content</p>
          <div className="flex flex-col gap-2">
            {task.content.map((c) => (
              <button
                key={c.id}
                onClick={() => openContent(c.file_path, c.external_url)}
                disabled={openingUrl === c.file_path}
                className="flex items-center gap-3 p-3 bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl text-left transition group"
              >
                <ContentIcon type={c.content_type} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white group-hover:text-blue-300 transition truncate">
                    {c.title}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">
                    {c.content_type}{c.version ? ` · v${c.version}` : ''}
                  </p>
                </div>
                <span className="text-slate-500 group-hover:text-blue-400 text-sm transition flex-shrink-0">
                  {openingUrl === c.file_path ? '…' : '↗'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mb-5">
        <p className="text-sm font-medium text-slate-300 mb-2">Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          rows={4}
          placeholder="Add notes about this task…"
          className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
        />
        {saving && <p className="text-xs text-slate-500 mt-1">Saving…</p>}
      </div>
    </div>
  )
}

function ContentIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    pdf: '📄',
    ppt: '📊',
    video: '🎬',
    checklist: '✅',
    guide: '📋',
    link: '🔗',
  }
  return (
    <span className="text-xl flex-shrink-0" role="img" aria-label={type}>
      {icons[type] ?? '📎'}
    </span>
  )
}
