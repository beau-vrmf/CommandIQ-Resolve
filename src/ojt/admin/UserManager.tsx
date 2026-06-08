import { useEffect, useState, FormEvent } from 'react'
import { OjtProfile, OjtRole, getAllProfiles, updateProfile, createUserViaEdgeFunction } from '../../db/ojt'

interface Props {
  onBack: () => void
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

const AIRCRAFT_OPTIONS = ['C-130', 'C-17', 'F-16', 'F-15', 'A-10', 'KC-135', 'B-52', 'Other']
const ROLES: OjtRole[] = ['trainee', 'supervisor', 'admin']

export function UserManager({ onBack }: Props) {
  const [profiles, setProfiles] = useState<OjtProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [success, setSuccess] = useState<{ manNumber: string; tempPassword: string } | null>(null)

  async function load() {
    setLoading(true)
    try { setProfiles(await getAllProfiles()) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function handleRoleChange(profile: OjtProfile, role: OjtRole) {
    await updateProfile(profile.id, { role })
    void load()
  }

  async function handleSupervisorChange(profile: OjtProfile, supervisorId: string) {
    await updateProfile(profile.id, { supervisor_id: supervisorId || null })
    void load()
  }

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-4 transition-colors">
        ← Back to Admin
      </button>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-white">Users</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="text-sm px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-medium transition-colors"
        >
          + Create User
        </button>
      </div>

      {success && (
        <div className="mb-5 p-4 bg-green-900/30 border border-green-700 rounded-xl">
          <p className="text-sm font-semibold text-green-300 mb-2">✅ User Created</p>
          <div className="bg-slate-900 rounded-lg p-3 font-mono text-sm">
            <p className="text-slate-400">Man Number: <span className="text-white">{success.manNumber}</span></p>
            <p className="text-slate-400 mt-1">Password: <span className="text-white">{success.tempPassword}</span></p>
          </div>
          <button onClick={() => setSuccess(null)} className="mt-3 text-xs text-slate-400 hover:text-white underline">Dismiss</button>
        </div>
      )}

      {showCreate && (
        <CreateUserForm
          supervisors={profiles.filter((p) => p.role === 'supervisor' || p.role === 'admin')}
          onCreated={(manNumber, tempPassword) => {
            setShowCreate(false)
            setSuccess({ manNumber, tempPassword })
            void load()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {profiles.map((profile) => (
            <div key={profile.id} className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">
                    {profile.rank ? `${profile.rank} ` : ''}{profile.display_name}
                  </p>
                  <p className="text-xs text-slate-400">#{profile.man_number}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {profile.aircraft ? profile.aircraft : 'No aircraft'}
                    {profile.afsc ? ` · AFSC ${profile.afsc}` : ''}
                  </p>
                </div>
                {/* Role selector */}
                <select
                  value={profile.role}
                  onChange={(e) => handleRoleChange(profile, e.target.value as OjtRole)}
                  className="text-xs px-2 py-1.5 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {/* Supervisor assignment (for trainees) */}
              {profile.role === 'trainee' && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Supervisor:</span>
                  <select
                    value={profile.supervisor_id ?? ''}
                    onChange={(e) => handleSupervisorChange(profile, e.target.value)}
                    className="text-xs px-2 py-1 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 flex-1"
                  >
                    <option value="">— None —</option>
                    {profiles
                      .filter((p) => p.role === 'supervisor' || p.role === 'admin')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.display_name} #{p.man_number}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateUserForm({
  supervisors,
  onCreated,
  onCancel,
}: {
  supervisors: OjtProfile[]
  onCreated: (manNumber: string, tempPassword: string) => void
  onCancel: () => void
}) {
  const tempPassword = generateTempPassword()
  const [form, setForm] = useState({
    displayName: '', manNumber: '', rank: '', role: 'trainee' as OjtRole,
    aircraft: '', afsc: '', currentSkillLevel: '', targetSkillLevel: '',
    workCenter: '', supervisorProfileId: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const inp = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createUserViaEdgeFunction({
        manNumber: form.manNumber,
        displayName: form.displayName,
        rank: form.rank || undefined,
        role: form.role,
        aircraft: form.aircraft || undefined,
        afsc: form.afsc || undefined,
        currentSkillLevel: form.currentSkillLevel || undefined,
        targetSkillLevel: form.targetSkillLevel || undefined,
        workCenter: form.workCenter || undefined,
        supervisorProfileId: form.supervisorProfileId || undefined,
        tempPassword,
      })
      onCreated(form.manNumber, tempPassword)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-5 p-4 bg-slate-800 border border-violet-700 rounded-xl">
      <h3 className="text-sm font-semibold text-white mb-3">Create User</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-slate-400 block mb-1">Display Name *</label>
          <input required value={form.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder="Last, First MI" className={inp} />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Man Number *</label>
          <input required value={form.manNumber} onChange={(e) => set('manNumber', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Role *</label>
          <select required value={form.role} onChange={(e) => set('role', e.target.value as OjtRole)} className={inp}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Rank</label>
          <input value={form.rank} onChange={(e) => set('rank', e.target.value)} placeholder="A1C, SSgt…" className={inp} />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Aircraft</label>
          <select value={form.aircraft} onChange={(e) => set('aircraft', e.target.value)} className={inp}>
            <option value="">Select…</option>
            {AIRCRAFT_OPTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">AFSC</label>
          <input value={form.afsc} onChange={(e) => set('afsc', e.target.value)} placeholder="2A554" className={inp} />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Work Center</label>
          <input value={form.workCenter} onChange={(e) => set('workCenter', e.target.value)} className={inp} />
        </div>
        {form.role === 'trainee' && (
          <div className="col-span-2">
            <label className="text-xs text-slate-400 block mb-1">Assign Supervisor</label>
            <select value={form.supervisorProfileId} onChange={(e) => set('supervisorProfileId', e.target.value)} className={inp}>
              <option value="">— None —</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>{s.display_name} #{s.man_number}</option>
              ))}
            </select>
          </div>
        )}
        <div className="col-span-2 p-3 bg-slate-900 rounded-lg border border-slate-700">
          <p className="text-xs text-slate-500">Temp password to hand off:</p>
          <p className="text-sm font-mono text-white mt-0.5">{tempPassword}</p>
        </div>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button type="submit" disabled={submitting} className="text-sm px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-medium disabled:opacity-50 transition-colors">
          {submitting ? 'Creating…' : 'Create User'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors">Cancel</button>
      </div>
    </form>
  )
}
