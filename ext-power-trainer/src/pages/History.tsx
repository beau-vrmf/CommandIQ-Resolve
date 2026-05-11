import { useEffect, useState } from 'react'
import { listSessions } from '../db/sessions'
import { getBlock } from '../data/fi-tree'
import type { ActiveSession } from '../store/session'

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString()
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${sec}s`
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-rose-400'
}

export function History() {
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null)

  useEffect(() => {
    listSessions().then(setSessions)
  }, [])

  if (sessions === null) return <div className="p-6 text-slate-400">Loading…</div>
  if (sessions.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400">
        No sessions yet. Start a fault code from the home screen.
      </div>
    )
  }

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 flex flex-col gap-3">
      <p className="text-xs text-slate-400 uppercase tracking-wide">Instructor Review — {sessions.length} session{sessions.length === 1 ? '' : 's'}</p>
      {sessions.map((s) => {
        const incorrectCount = s.incorrectDecisions?.length ?? 0
        const score = s.score ?? 100
        return (
          <details key={s.id} className="bg-slate-800 rounded-lg border border-slate-700">
            <summary className="p-4 cursor-pointer list-none flex items-center justify-between">
              <div>
                <div className="font-mono text-brand-50">{s.faultCode}</div>
                <div className="text-xs text-slate-400">{fmtDate(s.startedAt)}</div>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <div
                  className={`text-xs px-2 py-0.5 inline-block rounded ${
                    s.outcome?.kind === 'resolved'
                      ? 'bg-emerald-700'
                      : s.outcome?.kind === 'escalate'
                        ? 'bg-amber-700'
                        : 'bg-slate-600'
                  }`}
                >
                  {s.outcome?.kind ?? 'in progress'}
                </div>
                <div className={`font-mono font-bold ${scoreColor(score)}`}>{score}pts</div>
                <div className="text-xs text-slate-400">{fmtDuration(s.elapsedMs)}</div>
              </div>
            </summary>

            <div className="border-t border-slate-700 p-4 text-sm space-y-4">
              {/* Score summary */}
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Score: </span>
                  <span className={`font-bold ${scoreColor(score)}`}>{score}/100</span>
                </div>
                <div>
                  <span className="text-slate-400">Wrong answers: </span>
                  <span className={incorrectCount > 0 ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                    {incorrectCount}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Deductions: </span>
                  <span className="text-rose-300">−{s.deductions ?? 0}pts</span>
                </div>
              </div>

              {s.outcome && <p className="text-slate-200">{s.outcome.message}</p>}

              {/* Per-step decision log */}
              <ol className="space-y-1">
                {s.steps.map((step, i) => {
                  const b = getBlock(step.blockId)
                  const wrong = step.wasCorrect === false
                  return (
                    <li
                      key={i}
                      className={`rounded px-2 py-1.5 ${wrong ? 'bg-rose-900/30' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">
                          {step.wasCorrect === true && <span className="text-emerald-400 text-xs">✓</span>}
                          {step.wasCorrect === false && <span className="text-rose-400 text-xs">✗</span>}
                          {step.wasCorrect === null && <span className="text-slate-500 text-xs">·</span>}
                        </span>
                        <div className="min-w-0">
                          <span className="font-mono text-slate-300">
                            Block {b?.blockNumber ?? step.blockId.split('/').pop()}
                          </span>
                          {step.answer && (
                            <>
                              {' → '}
                              <span className={step.answer === 'yes' ? 'text-emerald-400' : 'text-rose-400'}>
                                {step.answer.toUpperCase()}
                              </span>
                              {wrong && s.incorrectDecisions && (
                                <span className="text-slate-500 text-xs ml-1">
                                  (correct: {s.incorrectDecisions.find((d) => d.blockId === step.blockId)?.correctAnswer.toUpperCase()})
                                </span>
                              )}
                            </>
                          )}
                          {b && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{b.text}</p>
                          )}
                          {step.note && (
                            <span className="italic text-slate-400 text-xs"> — {step.note}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </details>
        )
      })}
    </div>
  )
}
