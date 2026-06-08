// ExcelImport — parses .xlsx or .csv files into draft procedure steps.
// Admin downloads the template, fills it out, uploads it, reviews, then saves.

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { OjtProcedure, upsertStep } from '../../db/ojt'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftStep {
  step_number: number
  instruction: string
  warning: string
  caution: string
  note: string
  is_critical: boolean
  photo_required: boolean
}

interface Props {
  procedure: OjtProcedure
  existingStepCount: number
  onImported: () => void
  onCancel: () => void
}

type Phase = 'pick' | 'review' | 'saving'

// ─── Template download ────────────────────────────────────────────────────────

function downloadTemplate() {
  const headers = [
    'Step #',
    'Instruction',
    'Warning',
    'Caution',
    'Note',
    'Critical (yes/no)',
    'Photo Required (yes/no)',
  ]
  const example: (string | number)[] = [
    1,
    'Inspect landing gear strut for visible damage or fluid leaks.',
    'WARNING: Ensure aircraft is on jacks before proceeding.',
    '',
    'NOTE: Refer to applicable -2-6 TM for inspection criteria.',
    'yes',
    'yes',
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, example])

  // Column widths
  ws['!cols'] = [
    { wch: 8 },   // Step #
    { wch: 60 },  // Instruction
    { wch: 40 },  // Warning
    { wch: 40 },  // Caution
    { wch: 40 },  // Note
    { wch: 18 },  // Critical
    { wch: 22 },  // Photo Required
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Steps')
  XLSX.writeFile(wb, 'procedure_steps_template.xlsx')
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseWorkbook(file: File): Promise<DraftStep[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        // header:1 → array of arrays; defval:'' fills blanks
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, {
          header: 1,
          defval: '',
          blankrows: false,
        })

        if (rows.length < 2) {
          return resolve([])
        }

        // Skip the header row; process data rows
        const steps: DraftStep[] = []
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          const instruction = String(row[1] ?? '').trim()
          if (!instruction) continue  // skip blank instruction rows

          const rawCritical = String(row[5] ?? '').trim().toLowerCase()
          const rawPhoto = String(row[6] ?? '').trim().toLowerCase()

          steps.push({
            step_number: parseInt(String(row[0] ?? ''), 10) || i,
            instruction,
            warning: String(row[2] ?? '').trim(),
            caution: String(row[3] ?? '').trim(),
            note: String(row[4] ?? '').trim(),
            is_critical: rawCritical === 'yes' || rawCritical === 'true' || rawCritical === '1',
            photo_required: rawPhoto === 'yes' || rawPhoto === 'true' || rawPhoto === '1',
          })
        }
        resolve(steps)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsArrayBuffer(file)
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExcelImport({ procedure, existingStepCount, onImported, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('pick')
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([])
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveProgress, setSaveProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    try {
      const steps = await parseWorkbook(file)
      if (steps.length === 0) {
        setError(
          'No steps found. Make sure your file has data starting on row 2, with the instruction in column B.',
        )
        return
      }
      setDraftSteps(steps)
      setPhase('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the file.')
    }
  }

  async function saveAll() {
    setPhase('saving')
    setSaveProgress(0)
    try {
      for (let i = 0; i < draftSteps.length; i++) {
        const draft = draftSteps[i]
        await upsertStep({
          procedure_id: procedure.id,
          step_number: draft.step_number,
          instruction: draft.instruction,
          warning: draft.warning || null,
          caution: draft.caution || null,
          note: draft.note || null,
          is_critical: draft.is_critical,
          photo_required: draft.photo_required,
          sort_order: existingStepCount + i,
          requires_confirmation: true,
          is_active: true,
        })
        setSaveProgress(i + 1)
      }
      onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
      setPhase('review')
    }
  }

  function updateDraft(idx: number, patch: Partial<DraftStep>) {
    setDraftSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  function removeDraft(idx: number) {
    setDraftSteps((prev) => prev.filter((_, i) => i !== idx))
    if (editingIdx === idx) setEditingIdx(null)
  }

  function addBlankStep() {
    const newIdx = draftSteps.length
    setDraftSteps((prev) => [
      ...prev,
      {
        step_number: prev.length + 1,
        instruction: '',
        warning: '',
        caution: '',
        note: '',
        is_critical: false,
        photo_required: false,
      },
    ])
    setEditingIdx(newIdx)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-white">Import Steps from Spreadsheet</h2>
          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{procedure.title}</p>
        </div>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 py-5 max-w-2xl mx-auto w-full">

        {/* ── Phase: pick ── */}
        {phase === 'pick' && (
          <div className="flex flex-col items-center justify-center min-h-64 gap-5">
            <div className="text-center">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-white font-medium">Upload a filled-out spreadsheet</p>
              <p className="text-slate-400 text-sm mt-1 max-w-sm">
                Download the template, fill in your steps, then upload it here.
                Supports <span className="text-white">.xlsx</span> and <span className="text-white">.csv</span>.
              </p>
            </div>

            {/* Template columns reference */}
            <div className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-400 font-medium mb-2">Template columns</p>
              <div className="grid grid-cols-1 gap-1">
                {[
                  ['A', 'Step #', 'e.g. 1'],
                  ['B', 'Instruction', 'Required — the step text'],
                  ['C', 'Warning', 'Optional'],
                  ['D', 'Caution', 'Optional'],
                  ['E', 'Note', 'Optional'],
                  ['F', 'Critical (yes/no)', 'yes or no'],
                  ['G', 'Photo Required (yes/no)', 'yes or no'],
                ].map(([col, label, hint]) => (
                  <div key={col} className="flex items-baseline gap-2">
                    <span className="text-xs font-mono text-violet-400 w-4 flex-shrink-0">{col}</span>
                    <span className="text-xs text-slate-300">{label}</span>
                    <span className="text-xs text-slate-500">— {hint}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="w-full p-3 bg-red-900/20 border border-red-800 rounded-lg text-xs text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-3 w-full">
              <button
                onClick={downloadTemplate}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 text-sm font-medium transition-colors"
              >
                ⬇ Download Template
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-white text-sm font-medium transition-colors"
              >
                Upload File
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: saving ── */}
        {phase === 'saving' && (
          <div className="flex flex-col items-center justify-center min-h-64 gap-3">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">
              Saving step {saveProgress} of {draftSteps.length}…
            </p>
          </div>
        )}

        {/* ── Phase: review ── */}
        {phase === 'review' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  {draftSteps.length} step{draftSteps.length !== 1 ? 's' : ''} ready to import
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review and edit before saving. Nothing is saved until you click Import.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setPhase('pick'); setDraftSteps([]) }}
                  className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                >
                  ← Re-upload
                </button>
                <button
                  onClick={addBlankStep}
                  className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                >
                  + Add step
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-xs text-red-300">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2 mb-5">
              {draftSteps.map((draft, idx) => (
                <DraftStepCard
                  key={idx}
                  draft={draft}
                  idx={idx}
                  isEditing={editingIdx === idx}
                  onEdit={() => setEditingIdx(editingIdx === idx ? null : idx)}
                  onChange={(patch) => updateDraft(idx, patch)}
                  onRemove={() => removeDraft(idx)}
                />
              ))}
            </div>

            <button
              onClick={saveAll}
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-white font-semibold transition-colors"
            >
              Import {draftSteps.length} Step{draftSteps.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Draft step card ──────────────────────────────────────────────────────────

function DraftStepCard({
  draft, idx, isEditing, onEdit, onChange, onRemove,
}: {
  draft: DraftStep
  idx: number
  isEditing: boolean
  onEdit: () => void
  onChange: (patch: Partial<DraftStep>) => void
  onRemove: () => void
}) {
  const inp =
    'w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm'
  const ta = `${inp} resize-none`

  return (
    <div
      className={`bg-slate-800 border rounded-xl overflow-hidden ${
        draft.is_critical
          ? 'border-l-2 border-l-red-700 border-slate-700'
          : 'border-slate-700'
      }`}
    >
      {/* Collapsed row */}
      <div className="flex items-start gap-3 p-3">
        <span className="text-xs font-mono text-slate-500 mt-0.5 flex-shrink-0 w-6 text-right">
          {idx + 1}.
        </span>
        <p
          className={`text-sm flex-1 min-w-0 ${
            draft.instruction ? 'text-white' : 'text-slate-500 italic'
          } ${!isEditing ? 'line-clamp-2' : ''}`}
        >
          {draft.instruction || 'Empty — tap Edit to add instruction'}
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {draft.is_critical && (
            <span className="text-xs text-red-400 font-medium">CRIT</span>
          )}
          {draft.warning && <span className="text-base leading-none" title="Warning">⚠️</span>}
          {draft.caution && <span className="text-base leading-none" title="Caution">⚡</span>}
          {draft.note && <span className="text-base leading-none" title="Note">ℹ️</span>}
          {draft.photo_required && <span className="text-base leading-none" title="Photo required">📸</span>}
          <button
            onClick={onEdit}
            className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors ml-1"
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
          <button
            onClick={onRemove}
            className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-red-900 rounded text-slate-400 hover:text-red-300 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Expanded edit form */}
      {isEditing && (
        <div className="px-3 pb-3 flex flex-col gap-2 border-t border-slate-700 pt-3">
          <textarea
            value={draft.instruction}
            onChange={(e) => onChange({ instruction: e.target.value })}
            placeholder="Step instruction *"
            rows={3}
            className={ta}
          />
          <input
            value={draft.warning}
            onChange={(e) => onChange({ warning: e.target.value })}
            placeholder="Warning (optional)"
            className={inp}
          />
          <input
            value={draft.caution}
            onChange={(e) => onChange({ caution: e.target.value })}
            placeholder="Caution (optional)"
            className={inp}
          />
          <input
            value={draft.note}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="Note (optional)"
            className={inp}
          />
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.is_critical}
                onChange={(e) => onChange({ is_critical: e.target.checked })}
                className="rounded"
              />
              Critical step
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.photo_required}
                onChange={(e) => onChange({ photo_required: e.target.checked })}
                className="rounded"
              />
              Photo required
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
