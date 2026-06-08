import { useState } from 'react'
import {
  OjtProfile,
  OjtProcedure,
  OjtProcedureStep,
  OjtSubmission,
  OjtSubmissionStep,
  submitProcedure,
} from '../../db/ojt'

interface Props {
  procedure: OjtProcedure
  steps: OjtProcedureStep[]
  submission: OjtSubmission
  responses: Map<string, OjtSubmissionStep>
  profile: OjtProfile
  onBack: () => void
}

export function CompletionSummary({
  procedure,
  steps,
  submission,
  responses,
  profile,
  onBack,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const missingPhotos = steps.filter((s) => s.photo_required && !responses.get(s.id)?.photo_path)
  const flaggedSteps = steps.filter((s) => responses.get(s.id)?.confirmation === 'need_assistance')
  const completedSteps = steps.filter((s) => responses.get(s.id)?.confirmation === 'complete')
  const kcSteps = steps.filter((s) => s.kc_question)
  const kcCorrect = kcSteps.filter((s) => responses.get(s.id)?.kc_correct === true)

  const canSubmit = missingPhotos.length === 0

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      await submitProcedure(submission.id)
      setSubmitted(true)
    } catch {
      setError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="px-4 py-10 max-w-md mx-auto text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-white mb-2">Submitted for Review</h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          Your procedure activity has been submitted. Your supervisor or administrator will review it shortly.
        </p>
        <button
          onClick={onBack}
          className="mt-8 w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
        >
          Back to Procedures
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <h1 className="text-lg font-bold text-white mb-1">Completion Summary</h1>
      <p className="text-xs text-slate-500 mb-5">Review before submitting for supervisor review</p>

      {/* Info card */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-5">
        <p className="font-medium text-white">{procedure.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {profile.rank ? `${profile.rank} ` : ''}{profile.display_name} · #{profile.man_number}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {new Date(submission.started_at).toLocaleString()}
        </p>
      </div>

      {/* Step summary */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Steps</p>
        <div className="flex flex-col gap-1.5">
          {steps.map((step) => {
            const resp = responses.get(step.id)
            const conf = resp?.confirmation
            return (
              <div
                key={step.id}
                className="flex items-start gap-3 p-3 bg-slate-800 border border-slate-700 rounded-lg"
              >
                <span className="text-xs font-mono text-slate-500 mt-0.5 flex-shrink-0">
                  {step.step_number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{step.instruction.slice(0, 80)}{step.instruction.length > 80 ? '…' : ''}</p>
                  {step.is_critical && (
                    <span className="text-xs text-red-400">CRITICAL</span>
                  )}
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <ConfBadge conf={conf ?? null} />
                  {step.photo_required && (
                    <span className={`text-xs ${resp?.photo_path ? 'text-green-400' : 'text-red-400'}`}>
                      {resp?.photo_path ? '📸 ✓' : '📸 ✗'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard label="Completed" value={`${completedSteps.length} / ${steps.length}`} color="green" />
        <StatCard label="Need Assistance" value={String(flaggedSteps.length)} color={flaggedSteps.length > 0 ? 'amber' : 'slate'} />
        {kcSteps.length > 0 && (
          <StatCard label="Knowledge Checks" value={`${kcCorrect.length} / ${kcSteps.length}`} color={kcCorrect.length === kcSteps.length ? 'green' : 'amber'} />
        )}
        <StatCard label="Photos" value={`${steps.filter((s) => s.photo_required && responses.get(s.id)?.photo_path).length} / ${steps.filter((s) => s.photo_required).length}`} color={missingPhotos.length === 0 ? 'green' : 'red'} />
      </div>

      {/* Missing photos warning */}
      {missingPhotos.length > 0 && (
        <div className="mb-5 p-4 bg-red-900/30 border border-red-700 rounded-xl">
          <p className="text-sm font-semibold text-red-300 mb-1">⚠️ Missing Required Photos</p>
          <p className="text-xs text-red-200 mb-2">
            You must capture photos for all critical steps before submitting.
          </p>
          <ul className="text-xs text-red-300 list-disc list-inside space-y-0.5">
            {missingPhotos.map((s) => (
              <li key={s.id}>Step {s.step_number}: {s.instruction.slice(0, 60)}…</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-colors"
        >
          Back to Procedure
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit for Review'}
        </button>
      </div>
    </div>
  )
}

function ConfBadge({ conf }: { conf: string | null }) {
  if (!conf) return <span className="text-xs text-slate-600">—</span>
  const map: Record<string, string> = {
    complete: 'text-green-400',
    not_complete: 'text-red-400',
    need_assistance: 'text-amber-400',
    not_applicable: 'text-slate-400',
  }
  const labels: Record<string, string> = {
    complete: '✓',
    not_complete: '✗',
    need_assistance: '?',
    not_applicable: 'N/A',
  }
  return <span className={`text-xs font-medium ${map[conf] ?? 'text-slate-400'}`}>{labels[conf] ?? conf}</span>
}

function StatCard({ label, value, color }: { label: string; value: string; color: 'green' | 'amber' | 'red' | 'slate' }) {
  const colorMap = {
    green: 'text-green-300',
    amber: 'text-amber-300',
    red: 'text-red-300',
    slate: 'text-slate-400',
  }
  return (
    <div className="p-3 bg-slate-800 border border-slate-700 rounded-lg">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${colorMap[color]}`}>{value}</p>
    </div>
  )
}
