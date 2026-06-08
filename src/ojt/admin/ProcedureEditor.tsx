import { useEffect, useState, lazy, Suspense } from 'react'
import {
  OjtProcedure,
  OjtProcedureStep,
  getStepsForProcedure,
  upsertStep,
  deleteStep,
  uploadStepImage,
  upsertProcedure,
} from '../../db/ojt'

// Lazy-load ExcelImport so xlsx is only fetched when needed
const ExcelImport = lazy(() => import('./ExcelImport').then((m) => ({ default: m.ExcelImport })))

interface Props {
  procedure: OjtProcedure
  onBack: () => void
}

export function ProcedureEditor({ procedure, onBack }: Props) {
  const [steps, setSteps] = useState<OjtProcedureStep[]>([])
  const [loading, setLoading] = useState(true)
  const [editingStep, setEditingStep] = useState<Partial<OjtProcedureStep> | null>(null)
  const [editingProcedure, setEditingProcedure] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [procForm, setProcForm] = useState({
    title: procedure.title,
    required_tools: procedure.required_tools ?? '',
    required_references: procedure.required_references ?? '',
    safety_warnings: procedure.safety_warnings ?? '',
    cautions: procedure.cautions ?? '',
    notes: procedure.notes ?? '',
    estimated_minutes: procedure.estimated_minutes?.toString() ?? '',
  })

  async function load() {
    setLoading(true)
    try { setSteps(await getStepsForProcedure(procedure.id)) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [procedure.id])

  async function saveProcedure() {
    await upsertProcedure({
      ...procedure,
      title: procForm.title,
      required_tools: procForm.required_tools || null,
      required_references: procForm.required_references || null,
      safety_warnings: procForm.safety_warnings || null,
      cautions: procForm.cautions || null,
      notes: procForm.notes || null,
      estimated_minutes: procForm.estimated_minutes ? parseInt(procForm.estimated_minutes, 10) : null,
    })
    setEditingProcedure(false)
  }

  async function saveStep(step: Partial<OjtProcedureStep> & { procedure_id: string; instruction: string }) {
    await upsertStep(step)
    setEditingStep(null)
    void load()
  }

  async function handleDeleteStep(stepId: string) {
    if (!confirm('Remove this step?')) return
    await deleteStep(stepId)
    void load()
  }

  async function handleImageUpload(stepId: string, file: File) {
    await uploadStepImage(stepId, file)
    void load()
  }

  async function moveStep(step: OjtProcedureStep, dir: 'up' | 'down') {
    const idx = steps.findIndex((s) => s.id === step.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= steps.length) return
    const other = steps[swapIdx]
    await Promise.all([
      upsertStep({ ...step, sort_order: other.sort_order }),
      upsertStep({ ...other, sort_order: step.sort_order }),
    ])
    void load()
  }

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-4 transition-colors">
        ← Back
      </button>

      {/* Procedure header */}
      {editingProcedure ? (
        <ProcedureForm
          form={procForm}
          onChange={(k, v) => setProcForm((f) => ({ ...f, [k]: v }))}
          onSave={saveProcedure}
          onCancel={() => setEditingProcedure(false)}
        />
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-white">{procedure.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {procedure.aircraft}{procedure.afsc ? ` · AFSC ${procedure.afsc}` : ''} · v{procedure.version}
              </p>
            </div>
            <button
              onClick={() => setEditingProcedure(true)}
              className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors flex-shrink-0"
            >
              Edit Info
            </button>
          </div>
        </div>
      )}

      {/* Spreadsheet Import overlay — lazy-loaded so xlsx only downloads on demand */}
      {showImport && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <ExcelImport
            procedure={procedure}
            existingStepCount={steps.length}
            onImported={() => { setShowImport(false); void load() }}
            onCancel={() => setShowImport(false)}
          />
        </Suspense>
      )}

      {/* Steps */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-300">{steps.filter((s) => s.is_active).length} Steps</p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="text-sm px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
          >
            📊 Import Spreadsheet
          </button>
          <button
            onClick={() => setEditingStep({ procedure_id: procedure.id, sort_order: steps.length, step_number: steps.length + 1, requires_confirmation: true, is_critical: false, photo_required: false, is_active: true })}
            className="text-sm px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-medium transition-colors"
          >
            + Add Step
          </button>
        </div>
      </div>

      {editingStep && (
        <StepForm
          step={editingStep}
          procedureId={procedure.id}
          onSave={saveStep}
          onCancel={() => setEditingStep(null)}
          onImageUpload={editingStep.id ? (f) => handleImageUpload(editingStep.id!, f) : undefined}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className={`p-4 bg-slate-800 border rounded-xl ${step.is_active ? 'border-slate-700' : 'border-slate-800 opacity-50'} ${step.is_critical ? 'border-l-2 border-l-red-700' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* Up/down controls */}
                <div className="flex flex-col gap-0.5 flex-shrink-0 mt-0.5">
                  <button onClick={() => moveStep(step, 'up')} disabled={idx === 0} className="text-slate-600 hover:text-slate-300 disabled:opacity-20 text-xs">▲</button>
                  <button onClick={() => moveStep(step, 'down')} disabled={idx === steps.length - 1} className="text-slate-600 hover:text-slate-300 disabled:opacity-20 text-xs">▼</button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-500">STEP {step.step_number}</span>
                    {step.is_critical && <span className="text-xs text-red-400">CRITICAL</span>}
                    {step.photo_required && <span className="text-xs text-violet-400">📸 Photo</span>}
                    {step.kc_question && <span className="text-xs text-blue-400">KC</span>}
                  </div>
                  <p className="text-sm text-white line-clamp-2">{step.instruction}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setEditingStep({ ...step })}
                    className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteStep(step.id)}
                    className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-red-900 rounded-lg text-slate-400 hover:text-red-300 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Inline forms ─────────────────────────────────────────────────────────────

function ProcedureForm({
  form,
  onChange,
  onSave,
  onCancel,
}: {
  form: Record<string, string>
  onChange: (k: string, v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const inp = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm'
  const ta = `${inp} resize-none`
  return (
    <div className="bg-slate-800 border border-violet-700 rounded-xl p-4 mb-5">
      <h3 className="text-sm font-semibold text-white mb-3">Procedure Info</h3>
      <div className="flex flex-col gap-3">
        <input value={form.title} onChange={(e) => onChange('title', e.target.value)} placeholder="Title *" className={inp} />
        <input value={form.estimated_minutes} onChange={(e) => onChange('estimated_minutes', e.target.value)} placeholder="Est. minutes" type="number" className={inp} />
        <textarea value={form.required_tools} onChange={(e) => onChange('required_tools', e.target.value)} placeholder="Required tools / equipment" rows={2} className={ta} />
        <textarea value={form.required_references} onChange={(e) => onChange('required_references', e.target.value)} placeholder="Required references" rows={2} className={ta} />
        <textarea value={form.safety_warnings} onChange={(e) => onChange('safety_warnings', e.target.value)} placeholder="Safety warnings" rows={2} className={ta} />
        <textarea value={form.cautions} onChange={(e) => onChange('cautions', e.target.value)} placeholder="Cautions" rows={2} className={ta} />
        <textarea value={form.notes} onChange={(e) => onChange('notes', e.target.value)} placeholder="Notes" rows={2} className={ta} />
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={onSave} className="text-sm px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-medium transition-colors">Save</button>
        <button onClick={onCancel} className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

function StepForm({
  step,
  procedureId,
  onSave,
  onCancel,
  onImageUpload,
}: {
  step: Partial<OjtProcedureStep>
  procedureId: string
  onSave: (s: Partial<OjtProcedureStep> & { procedure_id: string; instruction: string }) => void
  onCancel: () => void
  onImageUpload?: (file: File) => void
}) {
  const [form, setForm] = useState({
    instruction: step.instruction ?? '',
    warning: step.warning ?? '',
    caution: step.caution ?? '',
    note: step.note ?? '',
    step_number: step.step_number?.toString() ?? '',
    estimated_minutes: '',
    is_critical: step.is_critical ?? false,
    photo_required: step.photo_required ?? false,
    photo_instructions: step.photo_instructions ?? '',
    requires_confirmation: step.requires_confirmation ?? true,
    kc_question: step.kc_question ?? '',
    kc_type: step.kc_type ?? '',
    kc_options: (step.kc_options ?? []).join('\n'),
    kc_correct_answer: step.kc_correct_answer ?? '',
  })

  const inp = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm'
  const ta = `${inp} resize-none`

  function submit() {
    if (!form.instruction) return
    const kcOptions = form.kc_options.split('\n').map((s) => s.trim()).filter(Boolean)
    onSave({
      ...step,
      id: step.id,
      procedure_id: procedureId,
      instruction: form.instruction,
      warning: form.warning || null,
      caution: form.caution || null,
      note: form.note || null,
      step_number: parseInt(form.step_number, 10) || (step.step_number ?? 1),
      is_critical: form.is_critical,
      photo_required: form.photo_required,
      photo_instructions: form.photo_instructions || null,
      requires_confirmation: form.requires_confirmation,
      kc_question: form.kc_question || null,
      kc_type: (form.kc_type as OjtProcedureStep['kc_type']) || null,
      kc_options: kcOptions.length > 0 ? kcOptions : null,
      kc_correct_answer: form.kc_correct_answer || null,
      sort_order: step.sort_order ?? 0,
      is_active: step.is_active ?? true,
    })
  }

  return (
    <div className="mb-4 p-4 bg-slate-800 border border-violet-700 rounded-xl">
      <h3 className="text-sm font-semibold text-white mb-3">{step.id ? 'Edit Step' : 'New Step'}</h3>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <input value={form.step_number} onChange={(e) => setForm((f) => ({ ...f, step_number: e.target.value }))} placeholder="Step #" type="number" className={inp} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input type="checkbox" checked={form.requires_confirmation} onChange={(e) => setForm((f) => ({ ...f, requires_confirmation: e.target.checked }))} className="rounded" />
              Requires confirmation
            </label>
          </div>
        </div>
        <textarea value={form.instruction} onChange={(e) => setForm((f) => ({ ...f, instruction: e.target.value }))} placeholder="Step instruction *" rows={3} className={ta} />
        <input value={form.warning} onChange={(e) => setForm((f) => ({ ...f, warning: e.target.value }))} placeholder="Warning (optional)" className={inp} />
        <input value={form.caution} onChange={(e) => setForm((f) => ({ ...f, caution: e.target.value }))} placeholder="Caution (optional)" className={inp} />
        <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Note (optional)" className={inp} />

        {/* Critical + photo */}
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={form.is_critical} onChange={(e) => setForm((f) => ({ ...f, is_critical: e.target.checked }))} className="rounded" />
            Critical step
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={form.photo_required} onChange={(e) => setForm((f) => ({ ...f, photo_required: e.target.checked }))} className="rounded" />
            Photo required
          </label>
        </div>
        {form.photo_required && (
          <input value={form.photo_instructions} onChange={(e) => setForm((f) => ({ ...f, photo_instructions: e.target.value }))} placeholder="Photo capture instructions" className={inp} />
        )}

        {/* Image upload (only for existing steps) */}
        {step.id && onImageUpload && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Reference image</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onImageUpload(f) }}
              className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-700 file:text-slate-300 file:text-xs"
            />
          </div>
        )}

        {/* Knowledge check */}
        <div className="pt-2 border-t border-slate-700">
          <p className="text-xs text-slate-500 mb-2">Knowledge check (optional)</p>
          <input value={form.kc_question} onChange={(e) => setForm((f) => ({ ...f, kc_question: e.target.value }))} placeholder="Question" className={`${inp} mb-2`} />
          {form.kc_question && (
            <>
              <select value={form.kc_type} onChange={(e) => setForm((f) => ({ ...f, kc_type: e.target.value }))} className={`${inp} mb-2`}>
                <option value="">Type…</option>
                <option value="yes_no">Yes / No</option>
                <option value="multiple_choice">Multiple Choice</option>
              </select>
              {form.kc_type === 'multiple_choice' && (
                <textarea value={form.kc_options} onChange={(e) => setForm((f) => ({ ...f, kc_options: e.target.value }))} placeholder="Options (one per line)" rows={3} className={`${ta} mb-2`} />
              )}
              <input value={form.kc_correct_answer} onChange={(e) => setForm((f) => ({ ...f, kc_correct_answer: e.target.value }))} placeholder="Correct answer" className={inp} />
            </>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={submit} disabled={!form.instruction} className="text-sm px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-medium disabled:opacity-50 transition-colors">
          {step.id ? 'Save Changes' : 'Add Step'}
        </button>
        <button onClick={onCancel} className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors">Cancel</button>
      </div>
    </div>
  )
}
