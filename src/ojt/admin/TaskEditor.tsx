// @ts-nocheck -- Upgrade Training (PRD 1) — disconnected, kept for future build
import { useEffect, useState } from 'react'
import { RequirementSet, OjtTask, getTasksForSet, upsertTask } from '../../db/ojt'
import { ContentUpload } from './ContentUpload'

interface Props {
  requirementSet: RequirementSet
  onBack: () => void
}

type View = { kind: 'list' } | { kind: 'content'; task: OjtTask }

export function TaskEditor({ requirementSet, onBack }: Props) {
  const [tasks, setTasks] = useState<OjtTask[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [showAdd, setShowAdd] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setTasks(await getTasksForSet(requirementSet.id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [requirementSet.id])

  async function toggleActive(task: OjtTask) {
    try {
      await upsertTask({ ...task, is_active: !task.is_active })
      void load()
    } catch {
      alert('Failed to update task.')
    }
  }

  if (view.kind === 'content') {
    return (
      <ContentUpload
        task={view.task}
        onBack={() => setView({ kind: 'list' })}
      />
    )
  }

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-2 transition-colors"
      >
        ← Back to Requirement Sets
      </button>

      <div className="mb-5">
        <h2 className="text-base font-semibold text-white">{requirementSet.name}</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {requirementSet.aircraft} · AFSC {requirementSet.afsc} · → {requirementSet.target_skill_level}
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400">{tasks.filter((t) => t.is_active).length} active tasks</p>
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-colors"
        >
          + Add Task
        </button>
      </div>

      {showAdd && (
        <AddTaskForm
          requirementSetId={requirementSet.id}
          nextSortOrder={tasks.length}
          onSaved={() => { setShowAdd(false); void load() }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`p-4 bg-slate-800 border rounded-xl ${task.is_active ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">
                  {task.task_number ? `${task.task_number}. ` : ''}{task.title}
                </p>
                {task.category && (
                  <p className="text-xs text-slate-500 mt-0.5">{task.category}</p>
                )}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setView({ kind: 'content', task })}
                  className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                >
                  Content
                </button>
                <button
                  onClick={() => toggleActive(task)}
                  className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                >
                  {task.is_active ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AddTaskForm({
  requirementSetId,
  nextSortOrder,
  onSaved,
  onCancel,
}: {
  requirementSetId: string
  nextSortOrder: number
  onSaved: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [taskNumber, setTaskNumber] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [estimatedMinutes, setEstimatedMinutes] = useState('')
  const [saving, setSaving] = useState(false)

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'

  async function save() {
    if (!title) return
    setSaving(true)
    try {
      await upsertTask({
        requirement_set_id: requirementSetId,
        title,
        task_number: taskNumber || null,
        category: category || null,
        description: description || null,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
        sort_order: nextSortOrder,
        is_required: true,
        is_active: true,
      })
      onSaved()
    } catch {
      alert('Failed to save task.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-4 p-4 bg-slate-800 border border-blue-700 rounded-xl">
      <h3 className="text-sm font-semibold text-white mb-3">New Task</h3>
      <div className="flex flex-col gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title *" className={inputClass} />
        <div className="grid grid-cols-2 gap-3">
          <input value={taskNumber} onChange={(e) => setTaskNumber(e.target.value)} placeholder="Task # (optional)" className={inputClass} />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className={inputClass} />
          <input type="number" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} placeholder="Est. minutes" className={inputClass} />
        </div>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className={`${inputClass} resize-none`} />
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={save} disabled={saving || !title} className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save Task'}
        </button>
        <button onClick={onCancel} className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
