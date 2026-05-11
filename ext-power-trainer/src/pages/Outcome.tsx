import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { totalElapsedMs, useSession } from '../store/session'
import { getBlock } from '../data/fi-tree'

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`
}

export function Outcome() {
  const navigate = useNavigate()
  const active = useSession((s) => s.active)
  const finish = useSession((s) => s.finish)

  useEffect(() => {
    if (!active) navigate('/', { replace: true })
  }, [active])

  if (!active || !active.outcome) return null

  const resolved = active.outcome.kind === 'resolved'
  const perfect = active.deductions === 0
  const incorrectCount = active.incorrectDecisions.length

  const scoreColor =
    active.score >= 80
      ? 'text-emerald-400'
      : active.score >= 60
        ? 'text-amber-400'
        : 'text-rose-400'

  return (
    <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-6 gap-6">
      {/* Outcome banner */}
      <div
        className={`rounded-xl p-5 border ${
          resolved ? 'bg-emerald-900/30 border-emerald-600' : 'bg-amber-900/30 border-amber-600'
        }`}
      >
        <p className="text-xs uppercase tracking-wider opacity-80">{resolved ? 'Resolved' : 'Escalate'}</p>
        <h1 className="text-xl font-semibold mt-1">{active.outcome.message}</h1>
      </div>

      {/* Score card */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Training Score</p>
        <p className={`text-6xl font-bold font-mono ${scoreColor}`}>{active.score}</p>
        <p className="text-slate-400 text-sm">out of 100</p>
        {perfect ? (
          <p className="mt-1 text-emerald-400 font-semibold">Perfect run — no incorrect decisions!</p>
        ) : (
          <p className="mt-1 text-rose-300 text-sm">
            {incorrectCount} incorrect decision{incorrectCount === 1 ? '' : 's'} · −{active.deductions} pts
          </p>
        )}
      </div>

      {/* Stats */}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-slate-800 rounded-lg p-3">
          <dt className="text-slate-400">Fault code</dt>
          <dd className="font-mono text-lg">{active.faultCode}</dd>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <dt className="text-slate-400">Duration</dt>
          <dd className="text-lg">{fmtDuration(totalElapsedMs(active))}</dd>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <dt className="text-slate-400">Blocks visited</dt>
          <dd className="text-lg">{active.steps.length}</dd>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <dt className="text-slate-400">Wrong answers</dt>
          <dd className={`text-lg ${incorrectCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {incorrectCount}
          </dd>
        </div>
      </dl>

      {/* Incorrect decisions callout */}
      {active.incorrectDecisions.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-2 text-rose-300">Incorrect Decisions</h2>
          <ol className="space-y-2">
            {active.incorrectDecisions.map((d, i) => {
              const b = getBlock(d.blockId)
              return (
                <li key={i} className="bg-rose-900/20 border border-rose-700/40 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm text-slate-300">
                      Block {b?.blockNumber ?? d.blockId.split('/').pop()}
                    </span>
                    <span className="text-xs text-rose-300">−10 pts</span>
                  </div>
                  {b && <p className="text-sm text-slate-300 line-clamp-2">{b.text}</p>}
                  <p className="text-xs mt-1">
                    <span className="text-rose-400">You answered: {d.userAnswer.toUpperCase()}</span>
                    {' · '}
                    <span className="text-emerald-400">Correct: {d.correctAnswer.toUpperCase()}</span>
                  </p>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {/* Path walked */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Path Walked</h2>
        <ol className="space-y-2">
          {active.steps.map((step, i) => {
            const b = getBlock(step.blockId)
            const wrong = step.wasCorrect === false
            return (
              <li
                key={i}
                className={`rounded-lg p-3 ${wrong ? 'bg-rose-900/20 border border-rose-700/40' : 'bg-slate-800'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-300">
                    Block {b?.blockNumber ?? step.blockId.split('/').pop()}
                  </span>
                  <div className="flex items-center gap-2">
                    {wrong && <span className="text-xs text-rose-400">✗ wrong</span>}
                    {step.answer && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          step.answer === 'yes' ? 'bg-emerald-700 text-emerald-50' : 'bg-rose-700 text-rose-50'
                        }`}
                      >
                        {step.answer.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                {b && <p className="text-sm text-slate-300 mt-1 line-clamp-2 whitespace-pre-wrap">{b.text}</p>}
                {step.note && (
                  <p className="text-sm italic text-slate-200 mt-2 border-l-2 border-slate-600 pl-3">{step.note}</p>
                )}
                {step.photoIds.length > 0 && (
                  <p className="text-xs text-slate-400 mt-1">📷 {step.photoIds.length} photo{step.photoIds.length === 1 ? '' : 's'}</p>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      <button
        onClick={() => { finish(); navigate('/', { replace: true }) }}
        className="mt-2 w-full bg-brand-600 hover:bg-brand-500 text-white text-lg font-semibold py-4 rounded-lg"
      >
        Done — new session
      </button>
    </div>
  )
}
