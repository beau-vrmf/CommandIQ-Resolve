import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBlock, isTerminal } from '../data/fi-tree'
import { currentStep, useSession } from '../store/session'
import { archiveSession } from '../db/sessions'
import { Timer } from '../components/Timer'
import { NoteDialog } from '../components/NoteDialog'
import { CameraCapture } from '../components/CameraCapture'
import { Lightbox } from '../components/Lightbox'
import type { VisitedBlock } from '../components/Lightbox'

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
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)

  useEffect(() => {
    if (!active) {
      navigate('/', { replace: true })
      return
    }
    if (active.outcome) {
      navigate('/outcome', { replace: true })
      return
    }
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

  if (!active) return null
  const block = getBlock(active.currentBlockId)
  if (!block) {
    return (
      <div className="p-6 text-center">
        <p className="text-lg">Unknown block {active.currentBlockId}.</p>
        <button
          className="mt-4 px-4 py-2 bg-brand-600 rounded-lg"
          onClick={() => navigate('/', { replace: true })}
        >
          Back to fault codes
        </button>
      </div>
    )
  }

  const step = currentStep(active)
  const photoCount = step?.photoIds.length ?? 0

  const sessionNotes: VisitedBlock[] = active.steps
    .filter((s) => s.answer !== null)
    .map((s): VisitedBlock | null => {
      const b = getBlock(s.blockId)
      if (!b) return null
      return {
        blockId: s.blockId,
        blockNumber: b.blockNumber,
        sheet: b.sheet,
        answer: s.answer,
        hasNote: !!s.note,
        note: s.note,
      }
    })
    .filter((e): e is VisitedBlock => e !== null)

  const onAnswer = async (ans: 'yes' | 'no') => {
    const next = ans === 'yes' ? block.onYes : block.onNo
    pause()
    answer(block.id, ans, next)
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
    const outcome =
      outcomeOverride ?? { kind: block.terminalKind ?? 'resolved', message: block.text }
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
      const ok = confirm(
        'Going back will discard the note and any photos attached to this block. Continue?',
      )
      if (!ok) return
    }
    goBack()
  }

  const terminal = isTerminal(block)
  const canGoBack = active.steps.length >= 2

  return (
    <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto">
      <div className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {canGoBack && (
            <button
              onClick={onBack}
              aria-label="Go back to the previous block"
              className="shrink-0 px-2.5 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium"
              title="Go back to previous block"
            >
              ← Back
            </button>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-xs uppercase tracking-wide text-slate-400 truncate">
              Fault {active.faultCode} · Fig {block.figure} · Sheet {block.sheet}
            </span>
            <span className="text-base font-semibold">Block {block.blockNumber}</span>
          </div>
        </div>
        <Timer />
        <div className="flex items-center gap-1">
          {active.steps.some((s) => s.answer !== null) && (
            <button
              onClick={() => setProgressOpen(true)}
              className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-800"
            >
              Progress
            </button>
          )}
          <button
            onClick={() => {
              pause()
              navigate('/', { replace: true })
            }}
            className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-800"
          >
            Pause & exit
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 px-4 py-5">
        <p className="text-base leading-relaxed text-slate-100 whitespace-pre-wrap">
          {block.text}
        </p>
        {block.cautions && block.cautions.length > 0 && (
          <div className="bg-rose-900/30 border-l-4 border-rose-500 rounded-r-md p-3">
            <p className="text-xs uppercase font-semibold text-rose-300 mb-1">Caution</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-rose-100">
              {block.cautions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        {block.sheetNotes && block.sheetNotes.length > 0 && (
          <div className="bg-amber-900/30 border-l-4 border-amber-500 rounded-r-md p-3">
            <p className="text-xs uppercase font-semibold text-amber-300 mb-1">Note</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-amber-100">
              {block.sheetNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
        {block.stub && (
          <div className="bg-slate-800 border border-slate-600 rounded-md p-3 text-sm text-slate-300">
            ⚠ This sheet has not yet been authored in the app. Tap “Mark fix complete” below
            to record the escalation, or back out and reference the original Technical Order.
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
          {block.imageRef && (
            <button
              onClick={() => setLightboxOpen(true)}
              className="flex-1 min-w-[8rem] px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium"
              aria-label="View Technical Order source page for this block"
            >
              📄 View TO source
            </button>
          )}
        </div>

        {step?.note && (
          <div className="border-l-2 border-slate-600 pl-3">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              Note for this block
            </p>
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
            <p className="text-center text-sm font-medium text-slate-200">
              Did this correct the issue?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onFixFailed}
                className="py-5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-lg font-bold shadow-lg"
              >
                No — escalate
              </button>
              <button
                onClick={onFixWorked}
                className="py-5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-lg font-bold shadow-lg"
              >
                Yes — fix worked
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onAnswer('no')}
              className="py-6 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-2xl font-bold shadow-lg"
            >
              NO
            </button>
            <button
              onClick={() => onAnswer('yes')}
              className="py-6 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-2xl font-bold shadow-lg"
            >
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

      {progressOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col max-w-3xl mx-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h2 className="text-base font-semibold">Progress — Fault {active.faultCode}</h2>
            <button
              onClick={() => setProgressOpen(false)}
              className="text-white text-xl px-3 py-1 rounded hover:bg-slate-800"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <ol className="space-y-2">
              {active.steps
                .filter((s) => s.answer !== null)
                .map((s, i) => {
                  const b = getBlock(s.blockId)
                  return (
                    <li key={i} className="bg-slate-800 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-300">
                          {b ? `Sheet ${b.sheet} · Block ${b.blockNumber}` : `Block ${s.blockId}`}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            s.answer === 'yes'
                              ? 'bg-emerald-700 text-emerald-50'
                              : 'bg-rose-700 text-rose-50'
                          }`}
                        >
                          {s.answer!.toUpperCase()}
                        </span>
                      </div>
                      {b && (
                        <p className="text-sm text-slate-300 mt-1 line-clamp-3 whitespace-pre-wrap">
                          {b.text}
                        </p>
                      )}
                      {s.note && (
                        <p className="text-sm italic text-slate-200 mt-2 border-l-2 border-slate-600 pl-3">
                          {s.note}
                        </p>
                      )}
                      {s.photoIds.length > 0 && (
                        <p className="text-xs text-slate-400 mt-1">
                          📷 {s.photoIds.length} photo{s.photoIds.length === 1 ? '' : 's'} attached
                        </p>
                      )}
                    </li>
                  )
                })}
            </ol>
          </div>
        </div>
      )}

      {block.imageRef && (
        <Lightbox
          open={lightboxOpen}
          src={block.imageRef}
          alt={`TO ${block.technicalOrder} · Fig ${block.figure} · Sheet ${block.sheet}`}
          onClose={() => setLightboxOpen(false)}
          sessionNotes={sessionNotes}
        />
      )}
    </div>
  )
}
