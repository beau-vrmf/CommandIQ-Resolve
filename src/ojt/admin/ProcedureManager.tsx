import { useEffect, useState } from 'react'
import { OjtProcedure, getAllProcedures, upsertProcedure } from '../../db/ojt'
import { ProcedureEditor } from './ProcedureEditor'
import { UserManager } from './UserManager'

type View = { kind: 'list' } | { kind: 'editor'; procedure: OjtProcedure } | { kind: 'users' }

const AIRCRAFT_OPTIONS = ['C-130', 'C-17', 'F-16', 'F-15', 'A-10', 'KC-135', 'B-52', 'Other']

export function ProcedureManager() {
  const [procedures, setProcedures] = useState<OjtProcedure[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    try { setProcedures(await getAllProcedures()) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function toggleActive(proc: OjtProcedure) {
    await upsertProcedure({ ...proc, is_active: !proc.is_active })
    void load()
  }

  if (view.kind === 'editor') {
    return <ProcedureEditor procedure={view.procedure} onBack={() => { setView({ kind: 'list' }); void load() }} />
  }

  if (view.kind === 'users') {
    return <UserManager onBack={() => setView({ kind: 'list' })} />
  }

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-white">Admin</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView({ kind: 'users' })}
            className="text-sm px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
          >
            Users
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-medium transition-colors"
          >
            + Procedure
          </button>
        </div>
      </div>

      {showForm && (
        <NewProcedureForm
          onSaved={(p) => { setShowForm(false); setView({ kind: 'editor', procedure: p }) }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : procedures.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-12">No procedures yet. Create one to get started.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {procedures.map((proc) => (
            <div
              key={proc.id}
              className={`p-4 bg-slate-800 border rounded-xl ${proc.is_active ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{proc.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {proc.aircraft}{proc.afsc ? ` · AFSC ${proc.afsc}` : ''}{proc.skill_level ? ` · ${proc.skill_level}` : ''} · v{proc.version}
                  </p>
                  {proc.procedure_category && (
                    <p className="text-xs text-slate-500 mt-0.5">{proc.procedure_category}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${proc.is_active ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-slate-700 text-slate-500'}`}>
                  {proc.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setView({ kind: 'editor', procedure: proc })}
                  className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                >
                  Edit Steps
                </button>
                <button
                  onClick={() => toggleActive(proc)}
                  className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                >
                  {proc.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewProcedureForm({
  onSaved,
  onCancel,
}: {
  onSaved: (p: OjtProcedure) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ title: '', aircraft: '', afsc: '', skillLevel: '', category: '', version: '1.0' })
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const missingTitle = !form.title.trim()
  const missingAircraft = !form.aircraft

  function fieldCls(invalid: boolean) {
    return `w-full px-3 py-2 rounded-lg bg-slate-900 border text-white placeholder-slate-500 focus:outline-none focus:ring-2 text-sm transition-colors ${
      invalid && touched
        ? 'border-red-500 focus:ring-red-500'
        : 'border-slate-600 focus:ring-violet-500'
    }`
  }

  function extractError(e: unknown): string {
    if (e && typeof e === 'object') {
      // Supabase PostgrestError shape
      const err = e as Record<string, unknown>
      if (err.message) {
        const code = err.code ? ` (code: ${err.code})` : ''
        return `${err.message}${code}`
      }
    }
    if (e instanceof Error) return e.message
    return 'Save failed. Check your connection and try again.'
  }

  async function save() {
    setTouched(true)
    if (missingTitle || missingAircraft) return
    setSaving(true)
    setError(null)
    try {
      const proc = await upsertProcedure({
        title: form.title.trim(),
        aircraft: form.aircraft,
        afsc: form.afsc.trim() || null,
        skill_level: form.skillLevel.trim() || null,
        procedure_category: form.category.trim() || null,
        version: form.version.trim() || '1.0',
        is_active: true,
      })
      onSaved(proc)
    } catch (e) {
      setError(extractError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-5 p-4 bg-slate-800 border border-violet-700 rounded-xl">
      <h3 className="text-sm font-semibold text-white mb-1">New Procedure</h3>
      <p className="text-xs text-slate-400 mb-3">Fields marked * are required.</p>
      <div className="flex flex-col gap-3">
        {/* Title */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Procedure Title *</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Inspect and Service Main Landing Gear"
            className={fieldCls(missingTitle)}
          />
          {missingTitle && touched && (
            <p className="text-xs text-red-400 mt-1">Title is required.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Aircraft */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Aircraft *</label>
            <select
              value={form.aircraft}
              onChange={(e) => setForm((f) => ({ ...f, aircraft: e.target.value }))}
              className={fieldCls(missingAircraft)}
            >
              <option value="">Select aircraft…</option>
              {AIRCRAFT_OPTIONS.map((a) => <option key={a}>{a}</option>)}
            </select>
            {missingAircraft && touched && (
              <p className="text-xs text-red-400 mt-1">Aircraft is required.</p>
            )}
          </div>

          {/* AFSC */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">AFSC</label>
            <input
              value={form.afsc}
              onChange={(e) => setForm((f) => ({ ...f, afsc: e.target.value }))}
              placeholder="e.g. 2A554"
              className={fieldCls(false)}
            />
          </div>

          {/* Skill Level */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Skill Level</label>
            <input
              value={form.skillLevel}
              onChange={(e) => setForm((f) => ({ ...f, skillLevel: e.target.value }))}
              placeholder="e.g. 5-Level"
              className={fieldCls(false)}
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Category</label>
            <input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="e.g. Landing Gear"
              className={fieldCls(false)}
            />
          </div>

          {/* Version */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Version</label>
            <input
              value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              placeholder="e.g. 1.0"
              className={fieldCls(false)}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-xs text-red-300 font-medium mb-0.5">Save failed</p>
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={save}
          disabled={saving}
          className="text-sm px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Create & Edit Steps'}
        </button>
        <button
          onClick={onCancel}
          className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
