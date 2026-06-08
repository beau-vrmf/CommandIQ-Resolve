// PDF Import Wizard — extracts text from a PDF and uses pattern matching to
// populate draft steps for admin review before saving. No AI/API key required.
// Future upgrade: replace parsePdf() with an edge function call to Claude API.

import { useState, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { OjtProcedure, upsertStep } from '../../db/ojt'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

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

type Phase = 'pick' | 'parsing' | 'review' | 'saving'

// ─── PDF text extraction ──────────────────────────────────────────────────────

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(pageText)
  }
  return pages.join('\n')
}

// ─── Pattern matching parser ──────────────────────────────────────────────────

function parsePdf(text: string): DraftStep[] {
  const lines = text.split(/\n|(?<=\.) (?=\d+\.)/g).map((l) => l.trim()).filter(Boolean)
  const steps: DraftStep[] = []
  let current: DraftStep | null = null

  const stepRegex = /^(\d+)[.)]\s+(.+)/
  const stepAltRegex = /^[Ss]tep\s+(\d+)[:.]\s+(.+)/
  const warningRegex = /^WARNING[:\s]\s*(.+)/i
  const cautionRegex = /^CAUTION[:\s]\s*(.+)/i
  const noteRegex = /^NOTE[:\s]\s*(.+)/i

  function flush() {
    if (current) steps.push({ ...current })
  }

  for (const line of lines) {
    const stepMatch = line.match(stepRegex) ?? line.match(stepAltRegex)
    if (stepMatch) {
      flush()
      current = {
        step_number: parseInt(stepMatch[1], 10),
        instruction: stepMatch[2].trim(),
        warning: '',
        caution: '',
        note: '',
        is_critical: false,
        photo_required: false,
      }
      continue
    }

    if (!current) continue  // Ignore pre-step text

    const warnMatch = line.match(warningRegex)
    if (warnMatch) {
      current.warning = current.warning
        ? `${current.warning} ${warnMatch[1]}`
        : warnMatch[1]
      continue
    }

    const cautionMatch = line.match(cautionRegex)
    if (cautionMatch) {
      current.caution = current.caution
        ? `${current.caution} ${cautionMatch[1]}`
        : cautionMatch[1]
      continue
    }

    const noteMatch = line.match(noteRegex)
    if (noteMatch) {
      current.note = current.note
        ? `${current.note} ${noteMatch[1]}`
        : noteMatch[1]
      continue
    }

    // Continuation line — append to instruction
    current.instruction = `${current.instruction} ${line}`
  }
  flush()
  return steps
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PdfImport({ procedure, existingStepCount, onImported, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('pick')
  const [rawText, setRawText] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([])
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveProgress, setSaveProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file.')
      return
    }
    setError(null)
    setPhase('parsing')
    try {
      const text = await extractPdfText(file)
      if (!text.trim()) {
        setError('No readable text found in this PDF. It may be a scanned image — those require OCR software first.')
        setPhase('pick')
        return
      }
      const parsed = parsePdf(text)
      setRawText(text)
      setDraftSteps(parsed)
      setPhase('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read PDF.')
      setPhase('pick')
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
          instruction: draft.instruction.trim(),
          warning: draft.warning.trim() || null,
          caution: draft.caution.trim() || null,
          note: draft.note.trim() || null,
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
    setDraftSteps((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  function removeDraft(idx: number) {
    setDraftSteps((prev) => prev.filter((_, i) => i !== idx))
  }

  function addBlankStep() {
    setDraftSteps((prev) => [
      ...prev,
      { step_number: prev.length + 1, instruction: '', warning: '', caution: '', note: '', is_critical: false, photo_required: false },
    ])
    setEditingIdx(draftSteps.length)
  }

  // ── Render ──

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-white">Import Steps from PDF</h2>
          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{procedure.title}</p>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors">
          Cancel
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 py-5 max-w-2xl mx-auto w-full">

        {/* ── Phase: pick ── */}
        {(phase === 'pick') && (
          <div className="flex flex-col items-center justify-center min-h-64 gap-5">
            <div className="text-center">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-white font-medium">Select a PDF file</p>
              <p className="text-slate-400 text-sm mt-1 max-w-xs">
                Numbered steps (1. 2. 3.) and WARNING / CAUTION / NOTE labels will be detected automatically.
              </p>
              <p className="text-slate-500 text-xs mt-2">Text-based PDFs only — scanned image PDFs won't work.</p>
            </div>
            {error && (
              <div className="w-full p-3 bg-red-900/20 border border-red-800 rounded-lg text-xs text-red-300">
                {error}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-white font-medium transition-colors"
            >
              Choose PDF
            </button>
          </div>
        )}

        {/* ── Phase: parsing ── */}
        {phase === 'parsing' && (
          <div className="flex flex-col items-center justify-center min-h-64 gap-3">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Reading PDF…</p>
          </div>
        )}

        {/* ── Phase: saving ── */}
        {phase === 'saving' && (
          <div className="flex flex-col items-center justify-center min-h-64 gap-3">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Saving step {saveProgress} of {draftSteps.length}…</p>
          </div>
        )}

        {/* ── Phase: review ── */}
        {phase === 'review' && (
          <div>
            {/* Source text toggle */}
            <button
              onClick={() => setShowRaw((v) => !v)}
              className="text-xs text-slate-500 hover:text-slate-300 mb-3 underline underline-offset-2 transition-colors"
            >
              {showRaw ? 'Hide source text ▲' : 'View source text ▼'}
            </button>
            {showRaw && (
              <pre className="mb-4 p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-400 whitespace-pre-wrap max-h-48 overflow-auto">
                {rawText}
              </pre>
            )}

            {/* Summary bar */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  {draftSteps.length === 0 ? 'No steps detected' : `${draftSteps.length} step${draftSteps.length !== 1 ? 's' : ''} detected`}
                </p>
                {draftSteps.length === 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    The PDF may not use numbered steps. Add steps manually below or cancel.
                  </p>
                )}
              </div>
              <button
                onClick={addBlankStep}
                className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
              >
                + Add step
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-xs text-red-300">
                {error}
              </div>
            )}

            {/* Step list */}
            <div className="flex flex-col gap-2 mb-5">
              {draftSteps.map((draft, idx) => (
                <DraftStepCard
                  key={idx}
                  draft={draft}
                  idx={idx}
                  isEditing={editingIdx === idx}
                  onEdit={() => setEditingIdx(editingIdx === idx ? null : idx)}
                  onChange={(patch) => updateDraft(idx, patch)}
                  onRemove={() => { removeDraft(idx); if (editingIdx === idx) setEditingIdx(null) }}
                />
              ))}
            </div>

            {/* Import button */}
            {draftSteps.length > 0 && (
              <button
                onClick={saveAll}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-white font-semibold transition-colors"
              >
                Import {draftSteps.length} Step{draftSteps.length !== 1 ? 's' : ''}
              </button>
            )}
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
  const inp = 'w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm'
  const ta = `${inp} resize-none`

  return (
    <div className={`bg-slate-800 border rounded-xl overflow-hidden ${draft.is_critical ? 'border-l-2 border-l-red-700 border-slate-700' : 'border-slate-700'}`}>
      {/* Collapsed header */}
      <div className="flex items-start gap-3 p-3">
        <span className="text-xs font-mono text-slate-500 mt-0.5 flex-shrink-0">
          {idx + 1}.
        </span>
        <p className={`text-sm flex-1 min-w-0 ${draft.instruction ? 'text-white' : 'text-slate-500 italic'} ${!isEditing ? 'line-clamp-2' : ''}`}>
          {draft.instruction || 'Empty — tap Edit to add instruction'}
        </p>
        <div className="flex gap-1.5 flex-shrink-0">
          {draft.is_critical && <span className="text-xs text-red-400">CRIT</span>}
          {draft.warning && <span className="text-xs text-yellow-400">⚠</span>}
          {draft.caution && <span className="text-xs text-amber-400">⚡</span>}
          {draft.note && <span className="text-xs text-blue-400">ℹ</span>}
          <button onClick={onEdit} className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors">
            {isEditing ? 'Done' : 'Edit'}
          </button>
          <button onClick={onRemove} className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-red-900 rounded text-slate-400 hover:text-red-300 transition-colors">✕</button>
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
