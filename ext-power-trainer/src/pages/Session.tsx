import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBlock, isTerminal } from '../data/fi-tree'
import { currentStep, useSession } from '../store/session'
import { archiveSession } from '../db/sessions'
import { Timer } from '../components/Timer'
import { NoteDialog } from '../components/NoteDialog'
import { CameraCapture } from '../components/CameraCapture'

export function Session() {
  const navigate = useNavigate()
  const active = useSession((s) => s.active)
  const answer = useSession((s) => s.answer)
  const completeTerminal = useSession((s) => s.completeTerminal)
  const goBack = useSession((s) => s.goBack)
  const setNote = useSession((s) => s.setNoteOnCurrent)
  const addPhoto = useSession((s) => s.addPhotoToCurrent)
  const pause = useSession((s) => s.pause)
  const resume = useSession((s) => s.resume)

  const [noteOpen, setNoteOpen] = useState(false)
  // Deduction toast: shows "-10 pts" briefly after a wrong answer
  const [deductionFlash, setDeductionFlash] = useState(false)
  const deductionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!active) { navigate('/', { replace: true }); return }
    if (active.outcome) { navigate('/outcome', { replace: true }); return }
    if (active.resumedAt === null) resume()
  }, [active?.id, active?.outcome, active?.resumedAt])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pause()
      else resume()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pause, resume])

  useEffect(() => {
    return () => { if (deductionTimer.current) clearTimeout(deductionTimer.current) }
  }, [])

  if (!active) return null
  const block = getBlock(active.currentBlockId)
  if (!block) {
    return (
      <div className="p-6 text-center">
        <p className="text-lg">Unknown block {active.currentBlockId}.</p>
        <button className="mt-4 px-4 py-2 bg-brand-600 rounded-lg" onClick={() => navigate('/', { replace: true })}>
          Back to fault codes
        </button>
      </div>
    )
  }

  const step = currentStep(active)
  const photoCount = step?.photoIds.length ?? 0
  const hasDeductions = active.deductions > 0

  const onAnswer = async (ans: 'yes' | 'no') => {
    const prevScore = active.score
    const next = ans === 'yes' ? block.onYes : block.onNo
    pause()
    answer(block.id, ans, next)

    // Check if a deduction was applied by comparing scores
    const newState = useSession.getState().active
    if (newState && newState.score < prevScore) {
      setDeductionFlash(true)
      deductionTimer.current = setTimeout(() => setDeductionFlash(false), 1500)
    }

    if (typeof next !== 'string') {
      const snapshot = useSession.getState().active
      if (snapshot) await archiveSession(snapshot)
      navigate('/outcome', { replace: true })
    } else {
      resume()
    }
  }

  const finalizeTerminal = async (outcomeOverride?: { kind: 'resolved' | 'escalate'; message: string }) => {
    pause()
    const outcome = outcomeOverride ?? { kind: block.terminalKind ?? 'resolved', message: block.text }
    completeTerminal(block.id, outcome)
    const snapshot = useSession.getState().active
    if (snapshot) await archiveSession(snapshot)
    navigate('/outcome', { replace: true })
  }

  const onFixWorked = () => finalizeTerminal({ kind: 'resolved', message: block.text })
  const onFixFailed = () =>
    finalizeTerminal({
      kind: 'escalate',
      message: `Documented fix did not resolve the issue. Escalate to next-level troubleshooting. Original step: ${block.text}`,
    })
  const onAcknowledgeEscalate = () => finalizeTerminal()

  const onBack = () => {
    if (active.steps.length < 2) return
    const hasContent = !!step?.note || (step?.photoIds.length ?? 0) > 0
    if (hasContent) {
      const ok = confirm('Going back will discard the note and any photos attached to this block. Continue?')
      if (!ok) return
    }
    goBack()
  }

  const terminal = isTerminal(block)
  const canGoBack = active.steps.length >= 2

  return (
    <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto">
      {/* Deduction flash overlay */}
      {deductionFlash && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="bg-rose-700/90 text-white text-3xl font-bold px-8 py-4 rounded-2xl shadow-xl animate-bounce">
            −10 pts
          </div>
        </div>
      )}

      <div className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {canGoBack && (
            <button
              onClick={onBack}
              aria-label="Go back to the previous block"
              className="shrink-0 px-2.5 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium"
            >
              ← Back
            </button>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-xs uppercase tracking-wide text-slate-400 truncate">
              Fault {active.faultCode} · Fig {block.figure}
            </span>
            <span className="text-base font-semibold">Block {block.blockNumber}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Timer />
          <div
            className={`font-mono text-sm px-3 py-1 rounded-md font-semibold ${
              hasDeductions ? 'bg-rose-700/50 text-rose-200' : 'bg-slate-700 text-slate-300'
            }`}
            aria-label={`Score: ${active.score}`}
          >
            {active.score}pts
          </div>
        </div>

        <button
          onClick={() => { pause(); navigate('/', { replace: true }) }}
          className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-800"
        >
          Pause & exit
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-4 px-4 py-5">
        {block.imageRef && (
          <img
            src={block.imageRef}
            alt={`Training image for block ${block.blockNumber}`}
            className="w-full rounded-lg border border-slate-700 object-contain max-h-72 bg-slate-800"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}

        <p className="text-base leading-relaxed text-slate-100 whitespace-pre-wrap">{block.text}</p>

        {block.cautions && block.cautions.length > 0 && (
          <div className="bg-rose-900/30 border-l-4 border-rose-500 rounded-r-md p-3">
            <p className="text-xs uppercase font-semibold text-rose-300 mb-1">Caution</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-rose-100">
              {block.cautions.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        {block.sheetNotes && block.sheetNotes.length > 0 && (
          <div className="bg-amber-900/30 border-l-4 border-amber-500 rounded-r-md p-3">
            <p className="text-xs uppercase font-semibold text-amber-300 mb-1">Note</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-amber-100">
              {block.sheetNotes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mt-2">
          <button
            onClick={() => setNoteOpen(true)}
            className="flex-1 min-w-[8rem] px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium"
          >
            ✎ {step?.note ? 'Edit note' : 'Add note'}
          </button>
          <CameraCapture onCaptured={(id) => addPhoto(id)} />
        </div>

        {step?.note && (
          <div className="border-l-2 border-slate-600 pl-3">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Note for this block</p>
            <p className="text-sm italic text-slate-200">{step.note}</p>
          </div>
        )}

        {photoCount > 0 && (
          <p className="text-xs text-slate-400">
            📷 {photoCount} photo{photoCount === 1 ? '' : 's'} attached to this block
          </p>
        )}
      </div>

      <div className="sticky bottom-0 bg-slate-950/95 backdrop-blur border-t border-slate-800 px-4 py-4">
        {terminal && block.terminalKind === 'escalate' ? (
          <button
            onClick={onAcknowledgeEscalate}
            className="w-full py-6 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-2xl font-bold shadow-lg"
          >
            Acknowledge & escalate
          </button>
        ) : terminal ? (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm font-medium text-slate-200">Did this correct the issue?</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onFixFailed} className="py-5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-lg font-bold shadow-lg">
                No — escalate
              </button>
              <button onClick={onFixWorked} className="py-5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-lg font-bold shadow-lg">
                Yes — fix worked
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onAnswer('no')} className="py-6 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-2xl font-bold shadow-lg">
              NO
            </button>
            <button onClick={() => onAnswer('yes')} className="py-6 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-2xl font-bold shadow-lg">
              YES
            </button>
          </div>
        )}
      </div>

      <NoteDialog
        open={noteOpen}
        initial={step?.note}
        onClose={() => setNoteOpen(false)}
        onSave={(note) => setNote(note)}
      />
    </div>
  )
}
