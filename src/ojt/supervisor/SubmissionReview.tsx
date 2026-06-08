import { useEffect, useState } from 'react'
import {
  OjtProfile,
  ReviewDecision,
  SubmissionDetail,
  getSubmissionDetail,
  reviewSubmission,
  reviewStepPhoto,
  getSignedUrl,
} from '../../db/ojt'

interface Props {
  submissionId: string
  reviewer: OjtProfile
  onBack: () => void
}

const DECISIONS: { value: ReviewDecision; label: string; color: string }[] = [
  { value: 'approved', label: 'Approve', color: 'bg-green-700 hover:bg-green-600 text-white' },
  { value: 'returned', label: 'Return for Correction', color: 'bg-amber-700 hover:bg-amber-600 text-white' },
  { value: 'incomplete', label: 'Mark Incomplete', color: 'bg-slate-700 hover:bg-slate-600 text-slate-200' },
  { value: 'retrain', label: 'Require Retraining', color: 'bg-red-800 hover:bg-red-700 text-white' },
]

export function SubmissionReview({ submissionId, reviewer, onBack }: Props) {
  const [detail, setDetail] = useState<SubmissionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState<ReviewDecision | null>(null)
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null)

  useEffect(() => {
    getSubmissionDetail(submissionId)
      .then(async (d) => {
        setDetail(d)
        // Pre-load signed URLs for any photos
        const urls = new Map<string, string>()
        for (const step of d.steps) {
          if (step.response?.photo_path) {
            try {
              const url = await getSignedUrl(step.response.photo_path)
              urls.set(step.id, url)
            } catch { /* skip */ }
          }
        }
        setPhotoUrls(urls)
        // Pre-fill if already reviewed
        if (d.submission.review_decision) {
          setDecision(d.submission.review_decision)
          setComments(d.submission.reviewer_comments ?? '')
        }
      })
      .finally(() => setLoading(false))
  }, [submissionId])

  async function handleReview() {
    if (!decision || !detail) return
    setSubmitting(true)
    try {
      await reviewSubmission(submissionId, reviewer.id, decision, comments)
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePhotoReview(
    submissionStepId: string,
    dec: 'approved' | 'rejected',
    photoComments: string,
  ) {
    await reviewStepPhoto(submissionStepId, dec, photoComments)
    // Refresh detail
    const refreshed = await getSubmissionDetail(submissionId)
    setDetail(refreshed)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!detail) return null

  if (submitted) {
    return (
      <div className="px-4 py-10 max-w-md mx-auto text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-white mb-2">Review Submitted</h2>
        <button onClick={onBack} className="mt-6 w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors">
          Back to Queue
        </button>
      </div>
    )
  }

  const { submission, procedure, profile, steps } = detail
  const criticalSteps = steps.filter((s) => s.is_critical)
  const flaggedSteps = steps.filter((s) => s.response?.confirmation === 'need_assistance')

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-4 transition-colors">
        ← Back to Queue
      </button>

      {/* Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-5">
        <p className="font-semibold text-white">{procedure.title}</p>
        <p className="text-sm text-slate-400 mt-0.5">
          {profile.rank ? `${profile.rank} ` : ''}{profile.display_name} · #{profile.man_number}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Submitted {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '—'}
        </p>
        <div className="flex gap-3 mt-3 text-xs text-slate-400">
          <span>{steps.filter((s) => s.response?.confirmation === 'complete').length}/{steps.length} complete</span>
          {flaggedSteps.length > 0 && <span className="text-amber-400">⚠️ {flaggedSteps.length} need assistance</span>}
          {criticalSteps.length > 0 && <span>{criticalSteps.filter((s) => s.response?.photo_path).length}/{criticalSteps.length} photos</span>}
        </div>
      </div>

      {/* Step list */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Steps</p>
        <div className="flex flex-col gap-2">
          {steps.map((step) => {
            const resp = step.response
            const photoUrl = photoUrls.get(step.id)
            return (
              <div
                key={step.id}
                className={`p-4 bg-slate-800 border rounded-xl ${
                  step.is_critical ? 'border-red-900' : 'border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-500">STEP {step.step_number}</span>
                      {step.is_critical && (
                        <span className="text-xs text-red-400 font-medium">CRITICAL</span>
                      )}
                      {resp?.confirmation === 'need_assistance' && (
                        <span className="text-xs text-amber-400">⚠️ Needs Assistance</span>
                      )}
                    </div>
                    <p className="text-sm text-white">{step.instruction}</p>
                  </div>
                  {resp?.confirmation && <ConfBadge conf={resp.confirmation} />}
                </div>

                {/* Photo review */}
                {step.photo_required && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    {photoUrl ? (
                      <>
                        <button
                          onClick={() => setExpandedPhoto(expandedPhoto === step.id ? null : step.id)}
                          className="text-xs text-violet-400 hover:text-violet-300 underline mb-2"
                        >
                          {expandedPhoto === step.id ? 'Hide photo' : 'View submitted photo'}
                        </button>
                        {expandedPhoto === step.id && (
                          <img src={photoUrl} alt="Step photo" className="w-full max-h-64 object-contain rounded-lg border border-slate-600 mb-3" />
                        )}
                        <PhotoReviewInline
                          response={resp}
                          onReview={(dec, c) => handlePhotoReview(resp!.id, dec, c)}
                        />
                      </>
                    ) : (
                      <p className="text-xs text-red-400">📸 No photo submitted</p>
                    )}
                  </div>
                )}

                {/* Knowledge check result */}
                {step.kc_question && resp?.kc_response && (
                  <p className={`text-xs mt-2 ${resp.kc_correct ? 'text-green-400' : 'text-red-400'}`}>
                    KC: "{resp.kc_response}" — {resp.kc_correct ? 'Correct' : `Incorrect (correct: ${step.kc_correct_answer})`}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Review decision */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Review Decision</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {DECISIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDecision(d.value)}
              className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                decision === d.value ? d.color + ' ring-2 ring-white/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          placeholder="Comments for the trainee (optional)…"
          className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm resize-none"
        />
      </div>

      <button
        onClick={handleReview}
        disabled={!decision || submitting}
        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold transition-colors"
      >
        {submitting ? 'Submitting Review…' : 'Submit Review'}
      </button>
    </div>
  )
}

function ConfBadge({ conf }: { conf: string }) {
  const map: Record<string, { label: string; color: string }> = {
    complete: { label: '✓ Complete', color: 'text-green-400' },
    not_complete: { label: '✗ Not Complete', color: 'text-red-400' },
    need_assistance: { label: '? Assistance', color: 'text-amber-400' },
    not_applicable: { label: 'N/A', color: 'text-slate-500' },
  }
  const { label, color } = map[conf] ?? { label: conf, color: 'text-slate-400' }
  return <span className={`text-xs font-medium flex-shrink-0 ${color}`}>{label}</span>
}

function PhotoReviewInline({
  response,
  onReview,
}: {
  response: { photo_review_status?: string | null; photo_review_comments?: string | null } | null | undefined
  onReview: (decision: 'approved' | 'rejected', comments: string) => void
}) {
  const [localComments, setLocalComments] = useState(response?.photo_review_comments ?? '')
  const [showForm, setShowForm] = useState(false)

  const status = response?.photo_review_status

  if (status === 'approved' || status === 'rejected') {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-xs ${status === 'approved' ? 'text-green-400' : 'text-red-400'}`}>
          Photo {status === 'approved' ? '✓ Approved' : '✗ Rejected'}
        </span>
        <button onClick={() => setShowForm(true)} className="text-xs text-slate-500 hover:text-slate-300 underline">
          Change
        </button>
      </div>
    )
  }

  if (!showForm) {
    return (
      <button onClick={() => setShowForm(true)} className="text-xs text-violet-400 hover:text-violet-300 underline">
        Review photo
      </button>
    )
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <input
        value={localComments}
        onChange={(e) => setLocalComments(e.target.value)}
        placeholder="Photo review comments…"
        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onReview('approved', localComments)}
          className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-white font-medium"
        >
          Approve Photo
        </button>
        <button
          onClick={() => onReview('rejected', localComments)}
          className="text-xs px-3 py-1.5 bg-red-800 hover:bg-red-700 rounded-lg text-white font-medium"
        >
          Reject Photo
        </button>
        <button
          onClick={() => setShowForm(false)}
          className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
