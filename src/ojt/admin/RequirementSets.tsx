// @ts-nocheck -- Upgrade Training (PRD 1) — disconnected, kept for future build
import { useEffect, useState } from 'react'
import { RequirementSet, getRequirementSets, upsertRequirementSet } from '../../db/ojt'
import { TaskEditor } from './TaskEditor'

type View = { kind: 'list' } | { kind: 'tasks'; set: RequirementSet }

export function RequirementSets() {
  const [sets, setSets] = useState<RequirementSet[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setSets(await getRequirementSets())
    } catch {
      setError('Failed to load requirement sets.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function toggleActive(set: RequirementSet) {
    try {
      await upsertRequirementSet({ ...set, is_active: !set.is_active })
      void load()
    } catch {
      alert('Failed to update.')
    }
  }

  if (view.kind === 'tasks') {
    return (
      <TaskEditor
        requirementSet={view.kind === 'tasks' ? view.set : sets[0]}
        onBack={() => { setView({ kind: 'list' }); void load() }}
      />
    )
  }

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-white">Requirement Sets</h2>
        <button
          onClick={() => setShowForm(true)}
          className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-colors"
        >
          + New Set
        </button>
      </div>

      {showForm && (
        <NewSetForm
          onSaved={() => { setShowForm(false); void load() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-red-400 text-sm text-center py-8">{error}</p>}

      <div className="flex flex-col gap-3">
        {sets.map((set) => (
          <div
            key={set.id}
            className="p-4 bg-slate-800 border border-slate-700 rounded-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white">{set.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {set.aircraft} · AFSC {set.afsc} · → {set.target_skill_level} · v{set.version}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    set.is_active
                      ? 'bg-green-900/50 text-green-300 border border-green-700'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {set.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setView({ kind: 'tasks', set })}
                className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
              >
                Edit Tasks
              </button>
              <button
                onClick={() => toggleActive(set)}
                className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
              >
                {set.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NewSetForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [aircraft, setAircraft] = useState('')
  const [afsc, setAfsc] = useState('')
  const [targetSkillLevel, setTargetSkillLevel] = useState('')
  const [version, setVersion] = useState('1.0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name || !aircraft || !afsc || !targetSkillLevel) return
    setSaving(true)
    setError(null)
    try {
      await upsertRequirementSet({ name, aircraft, afsc, target_skill_level: targetSkillLevel, version, is_active: true })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'

  return (
    <div className="mb-5 p-4 bg-slate-800 border border-blue-700 rounded-xl">
      <h3 className="text-sm font-semibold text-white mb-3">New Requirement Set</h3>
      <div className="flex flex-col gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Set name *" className={inputClass} />
        <div className="grid grid-cols-2 gap-3">
          <input value={aircraft} onChange={(e) => setAircraft(e.target.value)} placeholder="Aircraft *" className={inputClass} />
          <input value={afsc} onChange={(e) => setAfsc(e.target.value)} placeholder="AFSC *" className={inputClass} />
          <input value={targetSkillLevel} onChange={(e) => setTargetSkillLevel(e.target.value)} placeholder="Target Skill Level *" className={inputClass} />
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Version" className={inputClass} />
        </div>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button onClick={save} disabled={saving} className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
