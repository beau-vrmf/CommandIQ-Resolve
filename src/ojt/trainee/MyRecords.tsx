// @ts-nocheck -- Upgrade Training (PRD 1) — disconnected, kept for future build
import { useEffect, useState } from 'react'
import { OjtProfile, AssignedTaskSet, getMyAssignedTasks, TaskWithProgress } from '../../db/ojt'
import { TaskDetail } from './TaskDetail'

interface Props {
  profile: OjtProfile
}

export function MyRecords({ profile }: Props) {
  const [sets, setSets] = useState<AssignedTaskSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskWithProgress | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getMyAssignedTasks(profile.id)
      setSets(data)
    } catch {
      setError('Failed to load tasks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [profile.id])

  if (selectedTask) {
    return (
      <TaskDetail
        task={selectedTask}
        profileId={profile.id}
        onBack={() => { setSelectedTask(null); void load() }}
      />
    )
  }

  const totalTasks = sets.reduce((sum, s) => sum + s.tasks.length, 0)
  const completedTasks = sets.reduce(
    (sum, s) => sum + s.tasks.filter((t) => t.progress?.status === 'content_complete').length,
    0,
  )
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      {/* Profile summary */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-white text-base">
              {profile.rank ? `${profile.rank} ` : ''}{profile.display_name}
            </p>
            <p className="text-slate-400 text-sm mt-0.5">Man #{profile.man_number}</p>
          </div>
          <span className="text-2xl font-bold text-blue-400">{pct}%</span>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>{completedTasks} of {totalTasks} tasks complete</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
          {profile.aircraft && <span>Aircraft: <span className="text-slate-300">{profile.aircraft}</span></span>}
          {profile.afsc && <span>AFSC: <span className="text-slate-300">{profile.afsc}</span></span>}
          {profile.target_skill_level && (
            <span>Target Level: <span className="text-slate-300">{profile.target_skill_level}</span></span>
          )}
          {profile.training_due_date && (
            <span>Due: <span className="text-slate-300">{profile.training_due_date}</span></span>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm text-center py-8">{error}</p>
      )}

      {!loading && !error && sets.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-12">
          No training tasks assigned yet. Contact your supervisor.
        </p>
      )}

      {sets.map((set) => {
        // Group tasks by category
        const byCategory = new Map<string, TaskWithProgress[]>()
        for (const task of set.tasks) {
          const cat = task.category || 'General'
          if (!byCategory.has(cat)) byCategory.set(cat, [])
          byCategory.get(cat)!.push(task)
        }

        return (
          <div key={set.requirementSet.id} className="mb-6">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">{set.requirementSet.name}</h2>
            {Array.from(byCategory.entries()).map(([category, tasks]) => (
              <div key={category} className="mb-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{category}</p>
                <div className="flex flex-col gap-2">
                  {tasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="text-left p-4 bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl transition group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white group-hover:text-blue-300 truncate">
                            {task.task_number ? `${task.task_number}. ` : ''}{task.title}
                          </p>
                          {task.estimated_minutes && (
                            <p className="text-xs text-slate-500 mt-0.5">~{task.estimated_minutes} min</p>
                          )}
                        </div>
                        <StatusBadge status={task.progress?.status ?? 'not_started'} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    not_started: { label: 'Not Started', className: 'bg-slate-700 text-slate-400' },
    in_progress: { label: 'In Progress', className: 'bg-amber-900/50 text-amber-300 border border-amber-700' },
    content_complete: { label: 'Complete', className: 'bg-green-900/50 text-green-300 border border-green-700' },
    not_applicable: { label: 'N/A', className: 'bg-slate-700 text-slate-500' },
  }
  const { label, className } = map[status] ?? map.not_started
  return (
    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  )
}
