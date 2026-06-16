// PDF Import Wizard — extracts text from a PDF and uses pattern matching to
// populate draft steps for admin review before saving. No AI/API key required.
//
// For scanned-image PDFs (no embedded text layer), falls back to on-device OCR
// via Tesseract.js: each page is rendered to a canvas in the browser and the
// characters are recognized locally. The page images never leave the device —
// only the OCR engine/model is fetched from a CDN (contains no user content).
//
// Job-guide figure pages: in TO-format manuals, a page of numbered steps is
// typically followed by a full-page illustration of the panel those steps act
// on. We detect those figure pages, render them to JPEGs in-browser (same
// on-device canvas path as OCR — nothing leaves the device), and attach each
// figure to the steps in the text run that precedes it, so the trainee sees the
// relevant diagram beside each step. The admin can detach any image in review.

import { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { OjtProcedure, upsertStep, uploadJobGuideImage } from '../../db/ojt'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// ─── Types ────────────────────────────────────────────────────────────────────

// A figure page rendered to an uploadable image, plus a preview object URL and
// the (1-based) source page it came from.
interface JobGuideImage {
  file: File
  url: string
  page: number
}

interface DraftStep {
  step_number: number
  instruction: string
  warning: string
  caution: string
  note: string
  is_critical: boolean
  photo_required: boolean
  sourcePage: number              // 0-based page the step was parsed from
  jobGuideImage?: JobGuideImage   // matched figure page, if any
}

interface Props {
  procedure: OjtProcedure
  existingStepCount: number
  onImported: () => void
  onCancel: () => void
}

type Phase = 'pick' | 'parsing' | 'needsOcr' | 'ocr' | 'review' | 'saving'

// A loaded pdf.js document. Typed off getDocument so we don't import the proxy
// type name (which has moved between pdfjs-dist versions).
type PdfDoc = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> & {
  destroy?: () => void // present at runtime; not always in the published types
}

async function loadPdf(file: File): Promise<PdfDoc> {
  const buffer = await file.arrayBuffer()
  return pdfjsLib.getDocument({ data: buffer }).promise
}

// ─── PDF text extraction (one string per page) ──────────────────────────────────

async function extractPagesText(pdf: PdfDoc): Promise<string[]> {
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(pageText)
  }
  return pages
}

// ─── On-device OCR (scanned PDFs) ───────────────────────────────────────────────
// Renders each page to a canvas, then recognizes characters locally with
// Tesseract.js. Tesseract is dynamically imported so its wasm core only loads
// when OCR is actually needed. Returns one string per page.

interface OcrProgress { page: number; total: number; pct: number }

async function ocrPages(
  pdf: PdfDoc,
  onProgress: (p: OcrProgress) => void,
): Promise<string[]> {
  const { createWorker } = await import('tesseract.js')

  let curPage = 0
  const totalPages = pdf.numPages
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        onProgress({ page: curPage, total: totalPages, pct: m.progress })
      }
    },
  })

  const pages: string[] = []
  try {
    for (let i = 1; i <= totalPages; i++) {
      curPage = i
      onProgress({ page: i, total: totalPages, pct: 0 })
      const page = await pdf.getPage(i)
      // Scale 2x for sharper text — improves OCR accuracy on dense pages
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not create canvas context for OCR.')
      await page.render({ canvas, canvasContext: ctx, viewport } as Parameters<typeof page.render>[0]).promise
      const { data } = await worker.recognize(canvas)
      pages.push(data.text)
      onProgress({ page: i, total: totalPages, pct: 1 })
      // Free memory between pages
      canvas.width = 0
      canvas.height = 0
    }
  } finally {
    await worker.terminate()
  }
  return pages
}

// ─── Render a page to an uploadable JPEG (figure pages) ──────────────────────────
// Runs entirely in-browser on a canvas — the image never leaves the device.

async function renderPageImage(pdf: PdfDoc, pageNum: number): Promise<File> {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context.')
  await page.render({ canvas, canvasContext: ctx, viewport } as Parameters<typeof page.render>[0]).promise
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render page image.'))), 'image/jpeg', 0.85)
  })
  canvas.width = 0
  canvas.height = 0
  return new File([blob], `figure-p${pageNum}.jpg`, { type: 'image/jpeg' })
}

// ─── Pattern matching parser ──────────────────────────────────────────────────

const append = (a: string, b: string) => (b ? (a ? `${a} ${b}` : b) : a)

// Rejoin OCR word-breaks: a line ending in "word-" continues on the next line.
function dehyphenate(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    while (/[A-Za-z]-$/.test(line) && i + 1 < lines.length) {
      line = line.slice(0, -1) + lines[i + 1].replace(/^\s+/, '')
      i++
    }
    out.push(line)
  }
  return out
}

// Recognize scan noise that should never become step content: running headers,
// disclosure footers, page numbers, figure identifiers, panel captions, and the
// scattered character soup produced when OCR runs over a diagram/illustration.
// Structural lines (steps, sub-steps, advisory labels) are matched BEFORE this
// runs, so this only ever judges free text.
function isNoise(l: string): boolean {
  if (!l) return true
  if (/^TO\s+\d/i.test(l)) return true                                   // running header (e.g. "TO 1C-130J-...")
  if (/disclosur|disloare|copying and|govern?ed by|govemed by|title page of this|opti mis doe/i.test(l)) return true
  if (/^00[\s-]?1[\s-]?0[\s-]?0[\s-]?1/i.test(l)) return true            // doc-number footer ("00-10-01" / "00 1 0 0 1")
  if (/^[-\s|]+statement/i.test(l)) return true
  if (/^\(?\d+-\d+(\s+blank)?\)?(\s*\/\s*\d+-?\d*)?$/.test(l)) return true // page numbers
  if (/JG-\d/i.test(l)) return true                                       // figure/graphic identifiers
  if (l === l.toUpperCase() && /[A-Z]/.test(l) && /(PANEL|CONSOLE|SHOWN|SIMILAR|TYPICAL)/.test(l)) return true // figure captions
  if (/^\d{1,4}$/.test(l)) return true                                    // lone figure-callout number
  if (/[|\\\][®=]/.test(l)) return true                                   // junk symbols (rare in real instructions)
  if (/[A-Za-z]—[A-Za-z]/.test(l)) return true                            // OCR em-dash between letters (diagram artifact)
  if (l.length <= 2) return true
  // Scattered tiny tokens — diagram label fragments like "ON CX J", "CO OO Ob"
  const toks = l.split(/\s+/)
  const tiny = toks.filter((t) => t.replace(/[^A-Za-z0-9]/g, '').length <= 2).length
  if (l.length <= 25 && toks.length >= 3 && tiny / toks.length >= 0.6) return true
  if (l.length <= 6 && toks.length === 2 && tiny === 2) return true
  return false
}

// Split a page of text into cleaned, de-hyphenated lines. Also breaks apart
// steps that OCR glued onto one line ("...done. 2. Next...").
function splitLines(pageText: string): string[] {
  const lines = pageText.split(/\n|(?<=\.) (?=\d+\.)/g).map((l) => l.trim()).filter(Boolean)
  return dehyphenate(lines)
}

// Classify a page as a full-page figure/illustration (vs. a text/step page).
// Figure pages carry a graphic identifier (e.g. "00JG-10-0-112BL7.0") and/or
// produce almost nothing but scan-noise when run through OCR, and contain no
// numbered steps.
function isFigurePage(pageText: string): boolean {
  const lines = splitLines(pageText)
  if (lines.length === 0) return false
  // A numbered step or "Step N" means this is a text page, never a figure.
  const hasStep = lines.some((l) => /^(\d+)[.)]\s+/.test(l) || /^[Ss]tep\s+\d/i.test(l))
  if (hasStep) return false
  const hasFigureId = lines.some((l) => /\d{2}JG-\d/.test(l) || /JG-\d.*BL/i.test(l) || /BL\d\.\d/.test(l))
  // Lines that survive noise filtering AND carry a real word — i.e. genuine prose.
  const realLines = lines.filter((l) => !isNoise(l) && /[A-Za-z]{4,}/.test(l))
  if (hasFigureId && realLines.length <= 4) return true       // figure ID + little prose
  return lines.length >= 4 && realLines.length <= 2           // mostly scan-noise → illustration
}

function parsePages(pages: string[]): DraftStep[] {
  const steps: DraftStep[] = []
  let current: DraftStep | null = null
  let curPage = 0

  // In job guides, WARNING / CAUTION / NOTE blocks PRECEDE the step they apply
  // to — you read the advisory, then perform the action below it. So we buffer
  // advisories as we encounter them and attach them to the NEXT step that
  // begins (or, if sub-steps follow, to the step they sit inside).
  let pending = { warning: '', caution: '', note: '' }
  // Tracks where wrapped/continuation lines should be appended:
  //  'instruction' → current step's instruction
  //  'warning' | 'caution' | 'note' → the matching pending advisory buffer
  let cont: 'instruction' | 'warning' | 'caution' | 'note' | null = null

  const stepRegex = /^(\d+)[.)]\s+(.+)/
  const stepAltRegex = /^[Ss]tep\s+(\d+)[:.]\s+(.+)/
  const subStepRegex = /^[a-z][.)]\s+/
  // Advisory label: "CAUTION" alone on a line OR "CAUTION: text" inline.
  const advRegex = /^(WARNING|CAUTION|NOTE)\b[:.\s]*(.*)$/i

  function flush() {
    if (current) steps.push({ ...current })
  }
  function bindPendingTo(target: DraftStep) {
    target.warning = append(target.warning, pending.warning)
    target.caution = append(target.caution, pending.caution)
    target.note = append(target.note, pending.note)
    pending = { warning: '', caution: '', note: '' }
  }

  // Iterate page by page so each step records the page it started on. Parser
  // state (current step, pending advisories, continuation target) deliberately
  // carries across page boundaries, since a step or advisory can wrap onto the
  // next page.
  for (curPage = 0; curPage < pages.length; curPage++) {
    for (const raw of splitLines(pages[curPage])) {
      const line = raw.trim()
      if (!line) continue

      // 1. New numbered step — advisories seen above bind to THIS (the post step).
      const stepMatch = line.match(stepRegex) ?? line.match(stepAltRegex)
      if (stepMatch) {
        flush()
        current = {
          step_number: parseInt(stepMatch[1], 10),
          instruction: stepMatch[2].trim(),
          warning: pending.warning,
          caution: pending.caution,
          note: pending.note,
          is_critical: false,
          photo_required: false,
          sourcePage: curPage,
        }
        pending = { warning: '', caution: '', note: '' }
        cont = 'instruction'
        continue
      }

      // 2. Advisory label (own-line or inline).
      const advMatch = line.match(advRegex)
      if (advMatch) {
        const kind = advMatch[1].toLowerCase() as 'warning' | 'caution' | 'note'
        cont = kind
        if (advMatch[2].trim()) pending[kind] = append(pending[kind], advMatch[2].trim())
        continue
      }

      // 3. Sub-step (a. b. c.) belongs to the CURRENT step; any advisory that
      //    appeared mid-step (between the parent step and its sub-steps) binds here.
      if (current && subStepRegex.test(line)) {
        bindPendingTo(current)
        current.instruction = append(current.instruction, line)
        cont = 'instruction'
        continue
      }

      // 4. Free text that isn't structural — drop scan noise before treating it
      //    as continuation.
      if (isNoise(line)) continue

      // 5. Continuation (wrapped) line — append to whatever block we're inside.
      if (cont === 'warning') pending.warning = append(pending.warning, line)
      else if (cont === 'caution') pending.caution = append(pending.caution, line)
      else if (cont === 'note') pending.note = append(pending.note, line)
      else if (cont === 'instruction' && current) current.instruction = append(current.instruction, line)
      // else: prose before the first step with no advisory context — ignore.
    }
  }
  flush()

  // Trailing advisories that never got a following step: attach to the last
  // step so they aren't lost (rare — advisories normally precede a step).
  if (steps.length) bindPendingTo(steps[steps.length - 1])

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
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // The loaded pdf.js doc is held in a ref (not state) so OCR and figure
  // rendering can reuse it without re-parsing the file or triggering renders.
  const pdfRef = useRef<PdfDoc | null>(null)
  // Object URLs we create for figure previews, revoked on unmount.
  const urlsRef = useRef<string[]>([])

  // Release preview URLs and the pdf doc when the wizard closes.
  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      urlsRef.current = []
      pdfRef.current?.destroy?.()
      pdfRef.current = null
    }
  }, [])

  // Parse steps, detect figure pages, render them, and bind each figure to the
  // steps in the text run that precedes it.
  async function finalize(pages: string[]) {
    const steps = parsePages(pages)
    const pdf = pdfRef.current

    if (pdf) {
      const figurePages: number[] = []
      pages.forEach((t, i) => { if (isFigurePage(t)) figurePages.push(i) })

      for (let fi = 0; fi < figurePages.length; fi++) {
        const p = figurePages[fi]
        const prevFig = fi > 0 ? figurePages[fi - 1] : -1
        // Steps on the text pages between the previous figure and this one.
        const targets = steps.filter((s) => s.sourcePage > prevFig && s.sourcePage < p)
        if (targets.length === 0) continue
        let file: File
        try {
          file = await renderPageImage(pdf, p + 1) // pages are 1-based in pdf.js
        } catch {
          continue
        }
        const url = URL.createObjectURL(file)
        urlsRef.current.push(url)
        const img: JobGuideImage = { file, url, page: p + 1 }
        for (const s of targets) s.jobGuideImage = img
      }
    }

    setRawText(pages.join('\n'))
    setDraftSteps(steps)
    setPhase('review')
  }

  async function handleFile(file: File) {
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file.')
      return
    }
    setError(null)
    setPhase('parsing')
    try {
      pdfRef.current?.destroy?.()
      const pdf = await loadPdf(file)
      pdfRef.current = pdf
      const pages = await extractPagesText(pdf)
      if (!pages.join('').trim()) {
        // No embedded text layer — almost certainly a scanned image.
        // Offer on-device OCR rather than failing.
        setPhase('needsOcr')
        return
      }
      await finalize(pages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read PDF.')
      setPhase('pick')
    }
  }

  async function runOcr() {
    const pdf = pdfRef.current
    if (!pdf) return
    setError(null)
    setOcrProgress({ page: 0, total: 0, pct: 0 })
    setPhase('ocr')
    try {
      const pages = await ocrPages(pdf, setOcrProgress)
      if (!pages.join('').trim()) {
        setError('OCR could not read any text. The scan may be too low-resolution or skewed.')
        setPhase('needsOcr')
        return
      }
      await finalize(pages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR failed.')
      setPhase('needsOcr')
    }
  }

  async function saveAll() {
    setPhase('saving')
    setSaveProgress(0)
    try {
      for (let i = 0; i < draftSteps.length; i++) {
        const draft = draftSteps[i]
        const saved = await upsertStep({
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
        // Upload the matched figure (if any) now that we have the step id.
        if (draft.jobGuideImage) {
          await uploadJobGuideImage(saved.id, draft.jobGuideImage.file)
        }
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
      { step_number: prev.length + 1, instruction: '', warning: '', caution: '', note: '', is_critical: false, photo_required: false, sourcePage: -1 },
    ])
    setEditingIdx(draftSteps.length)
  }

  function removeImage(idx: number) {
    updateDraft(idx, { jobGuideImage: undefined })
  }

  const imagesMatched = draftSteps.filter((s) => s.jobGuideImage).length

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
              <p className="text-slate-500 text-xs mt-2">Scanned (image) PDFs are supported too — you'll be offered on-device OCR.</p>
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

        {/* ── Phase: needsOcr (scanned PDF — offer OCR) ── */}
        {phase === 'needsOcr' && (
          <div className="flex flex-col items-center justify-center min-h-64 gap-5">
            <div className="text-center max-w-sm">
              <div className="text-4xl mb-3">🔎</div>
              <p className="text-white font-medium">This PDF has no text layer</p>
              <p className="text-slate-400 text-sm mt-1">
                It looks like a scanned image. Run on-device OCR to recognize the text — the
                pages stay on this device; only the OCR engine is downloaded.
              </p>
              <p className="text-slate-500 text-xs mt-2">
                This can take several seconds per page, and accuracy depends on scan quality.
                You can review and fix the result before saving.
              </p>
            </div>
            {error && (
              <div className="w-full p-3 bg-red-900/20 border border-red-800 rounded-lg text-xs text-red-300">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { pdfRef.current?.destroy?.(); pdfRef.current = null; setError(null); setPhase('pick') }}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 font-medium transition-colors"
              >
                Choose a different file
              </button>
              <button
                onClick={runOcr}
                className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-white font-medium transition-colors"
              >
                Run OCR
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: ocr (running) ── */}
        {phase === 'ocr' && (
          <div className="flex flex-col items-center justify-center min-h-64 gap-4">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-slate-300 text-sm">
                {ocrProgress && ocrProgress.total > 0
                  ? `Recognizing text — page ${ocrProgress.page} of ${ocrProgress.total}`
                  : 'Loading OCR engine…'}
              </p>
              {ocrProgress && ocrProgress.total > 0 && (
                <div className="mt-3 w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden mx-auto">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-200"
                    style={{
                      width: `${Math.round(
                        ((ocrProgress.page - 1 + ocrProgress.pct) / ocrProgress.total) * 100,
                      )}%`,
                    }}
                  />
                </div>
              )}
              <p className="text-slate-500 text-xs mt-2">Keep this screen open until it finishes.</p>
            </div>
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
                {imagesMatched > 0 && (
                  <p className="text-xs text-emerald-400 mt-0.5">
                    🖼 {imagesMatched} step{imagesMatched !== 1 ? 's' : ''} matched to a job-guide image
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
                  onRemoveImage={() => removeImage(idx)}
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
  draft, idx, isEditing, onEdit, onChange, onRemove, onRemoveImage,
}: {
  draft: DraftStep
  idx: number
  isEditing: boolean
  onEdit: () => void
  onChange: (patch: Partial<DraftStep>) => void
  onRemove: () => void
  onRemoveImage: () => void
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
          {draft.jobGuideImage && <span className="text-xs text-emerald-400" title={`Job-guide image from page ${draft.jobGuideImage.page}`}>🖼</span>}
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
          {draft.jobGuideImage && (
            <div className="flex items-start gap-3 p-2 bg-slate-950 border border-slate-700 rounded-lg">
              <img
                src={draft.jobGuideImage.url}
                alt={`Job-guide figure from page ${draft.jobGuideImage.page}`}
                className="h-24 w-auto rounded border border-slate-600 object-contain bg-white"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300">Job-guide image</p>
                <p className="text-xs text-slate-500 mt-0.5">Matched from page {draft.jobGuideImage.page}</p>
                <button
                  onClick={onRemoveImage}
                  className="mt-2 text-xs px-2 py-1 bg-slate-700 hover:bg-red-900 rounded text-slate-300 hover:text-red-300 transition-colors"
                >
                  Remove image
                </button>
              </div>
            </div>
          )}
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
