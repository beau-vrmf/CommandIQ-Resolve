// @ts-nocheck -- Upgrade Training (PRD 1) — disconnected, kept for future build
import { useState, FormEvent } from 'react'
import { OjtProfile, createTraineeProfile } from '../../db/ojt'

interface Props {
  supervisorProfile: OjtProfile
  onBack: () => void
}

const AIRCRAFT_OPTIONS = ['C-130', 'C-17', 'F-16', 'F-15', 'A-10', 'KC-135', 'B-52', 'Other']
const SKILL_LEVELS = ['3', '5', '7', '9']

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 12; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)]
  }
  return pw
}

export function CreateUser({ supervisorProfile, onBack }: Props) {
  const [form, setForm] = useState({
    displayName: '',
    manNumber: '',
    rank: '',
    aircraft: '',
    afsc: '',
    currentSkillLevel: '',
    targetSkillLevel: '',
    workCenter: '',
    trainingStartDate: '',
    trainingDueDate: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ manNumber: string; tempPassword: string } | null>(null)

  const tempPassword = useState(() => generateTempPassword())[0]

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createTraineeProfile({
        manNumber: form.manNumber,
        displayName: form.displayName,
        rank: form.rank || undefined,
        aircraft: form.aircraft,
        afsc: form.afsc,
        currentSkillLevel: form.currentSkillLevel,
        targetSkillLevel: form.targetSkillLevel,
        workCenter: form.workCenter || undefined,
        trainingStartDate: form.trainingStartDate || undefined,
        trainingDueDate: form.trainingDueDate || undefined,
        notes: form.notes || undefined,
        supervisorProfileId: supervisorProfile.id,
        tempPassword,
      })
      setSuccess({ manNumber: form.manNumber, tempPassword })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trainee.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="px-4 py-5 max-w-md mx-auto w-full">
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-5 text-center">
          <p className="text-2xl mb-2">✅</p>
          <h2 className="text-lg font-semibold text-green-300">Trainee Created</h2>
          <p className="text-sm text-slate-300 mt-3">
            Hand these credentials to the trainee:
          </p>
          <div className="mt-4 bg-slate-900 rounded-lg p-4 text-left font-mono text-sm">
            <p className="text-slate-400">Man Number: <span className="text-white">{success.manNumber}</span></p>
            <p className="text-slate-400 mt-1">Password: <span className="text-white">{success.tempPassword}</span></p>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            The trainee should change their password after first sign-in.
          </p>
          <button
            onClick={onBack}
            className="mt-5 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-5 max-w-lg mx-auto w-full">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-5 transition-colors"
      >
        ← Back
      </button>

      <h2 className="text-base font-semibold text-white mb-5">Create Trainee</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Display Name *" col={2}>
            <input
              required
              value={form.displayName}
              onChange={(e) => set('displayName', e.target.value)}
              placeholder="Last, First MI"
              className={inputClass}
            />
          </Field>

          <Field label="Man Number *">
            <input
              required
              value={form.manNumber}
              onChange={(e) => set('manNumber', e.target.value)}
              placeholder="1234567"
              className={inputClass}
            />
          </Field>

          <Field label="Rank">
            <input
              value={form.rank}
              onChange={(e) => set('rank', e.target.value)}
              placeholder="A1C, SrA, SSgt…"
              className={inputClass}
            />
          </Field>

          <Field label="Aircraft *">
            <select
              required
              value={form.aircraft}
              onChange={(e) => set('aircraft', e.target.value)}
              className={inputClass}
            >
              <option value="">Select…</option>
              {AIRCRAFT_OPTIONS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </Field>

          <Field label="AFSC *">
            <input
              required
              value={form.afsc}
              onChange={(e) => set('afsc', e.target.value)}
              placeholder="2A554"
              className={inputClass}
            />
          </Field>

          <Field label="Current Skill Level *">
            <select
              required
              value={form.currentSkillLevel}
              onChange={(e) => set('currentSkillLevel', e.target.value)}
              className={inputClass}
            >
              <option value="">Select…</option>
              {SKILL_LEVELS.map((l) => <option key={l}>{l}-Level</option>)}
            </select>
          </Field>

          <Field label="Target Skill Level *">
            <select
              required
              value={form.targetSkillLevel}
              onChange={(e) => set('targetSkillLevel', e.target.value)}
              className={inputClass}
            >
              <option value="">Select…</option>
              {SKILL_LEVELS.map((l) => <option key={l}>{l}-Level</option>)}
            </select>
          </Field>

          <Field label="Work Center">
            <input
              value={form.workCenter}
              onChange={(e) => set('workCenter', e.target.value)}
              placeholder="AMXS, MXS…"
              className={inputClass}
            />
          </Field>

          <Field label="Training Start Date">
            <input
              type="date"
              value={form.trainingStartDate}
              onChange={(e) => set('trainingStartDate', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Training Due Date">
            <input
              type="date"
              value={form.trainingDueDate}
              onChange={(e) => set('trainingDueDate', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Notes" col={2}>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Optional notes…"
              className={`${inputClass} resize-none`}
            />
          </Field>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
        >
          {submitting ? 'Creating…' : 'Create Trainee'}
        </button>
      </form>
    </div>
  )
}

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'

function Field({
  label,
  children,
  col,
}: {
  label: string
  children: React.ReactNode
  col?: number
}) {
  return (
    <div className={col === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
