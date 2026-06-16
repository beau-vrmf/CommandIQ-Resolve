import { useEffect, useRef, useState } from 'react'
import {
  OjtProcedure,
  OjtProcedureStep,
  OjtSubmission,
  OjtSubmissionStep,
  ConfirmationType,
  getSubmissionSteps,
  upsertStepResponse,
  uploadStepPhoto,
  getSignedUrl,
} from '../../db/ojt'

interface Props {
  procedure: OjtProcedure
  steps: OjtProcedureStep[]
  submission: OjtSubmission
  onComplete: (responses: Map<string, OjtSubmissionStep>) => void
  onBack: () => void
}

export function ProcedureSession({ procedure, steps, submission, onComplete, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState<Map<string, OjtSubmissionStep>>(new Map())
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<Map<string, string>>(new Map())
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState(false)  // brief flash before auto-advance
  const [showImage, setShowImage] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [jobGuideUrl, setJobGuideUrl] = useState<string | null>(null)
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing responses on mount
  useEffect(() => {
    getSubmissionSteps(submission.id)
      .then((rows) => {
        const map = new Map<string, OjtSubmissionStep>()
        for (const r of rows) map.set(r.step_id, r)
        setResponses(map)
        // Resume to first unanswered step
        const firstUnanswered = steps.findIndex((s) => !map.get(s.id)?.confirmation)
        if (firstUnanswered > 0) setCurrentIndex(firstUnanswered)
      })
      .catch(console.error)
  }, [submission.id])

  const step = steps[currentIndex]
  const response = responses.get(step?.id ?? '')
  const isLastStep = currentIndex === steps.length - 1
  const totalSteps = steps.length

  // Resolve signed URL for step reference image; clear photo error on step change
  useEffect(() => {
    setImageUrl(null)
    setJobGuideUrl(null)
    setShowImage(false)
    setPhotoError(null)
    if (step?.image_path) {
      getSignedUrl(step.image_path).then(setImageUrl).catch(console.error)
    }
    if (step?.job_guide_image_path) {
      getSignedUrl(step.job_guide_image_path).then(setJobGuideUrl).catch(console.error)
    }
  }, [step?.id])

  async function handleConfirm(confirmation: ConfirmationType) {
    if (!step) return
    setSaving(true)
    try {
      await upsertStepResponse(submission.id, step.id, {
        confirmation,
        responded_at: new Date().toISOString(),
      })
      const updated = new Map(responses)
      updated.set(step.id, {
        ...(responses.get(step.id) ?? {
          id: '',
          submission_id: submission.id,
          step_id: step.id,
          kc_response: null,
          kc_correct: null,
          photo_path: null,
          photo_submitted_at: null,
          photo_review_status: null,
          photo_review_comments: null,
        }),
        confirmation,
        responded_at: new Date().toISOString(),
      } as OjtSubmissionStep)
      setResponses(updated)
      // Auto-advance after a short pause so the selected state is visible
      setConfirmed(true)
      setTimeout(() => {
        setConfirmed(false)
        goNext()
      }, 700)
    } finally {
      setSaving(false)
    }
  }

  async function handleKcAnswer(answer: string) {
    if (!step) return
    const correct = answer === step.kc_correct_answer
    await upsertStepResponse(submission.id, step.id, {
      kc_response: answer,
      kc_correct: correct,
    })
    const updated = new Map(responses)
    const existing = responses.get(step.id)
    updated.set(step.id, {
      ...(existing ?? {
        id: '',
        submission_id: submission.id,
        step_id: step.id,
        confirmation: null,
        photo_path: null,
        photo_submitted_at: null,
        photo_review_status: null,
        photo_review_comments: null,
      }),
      kc_response: answer,
      kc_correct: correct,
    } as OjtSubmissionStep)
    setResponses(updated)
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !step) return
    setUploadingPhoto(true)
    setPhotoError(null)
    // Show local preview immediately — this also unlocks the confirmation buttons
    const localUrl = URL.createObjectURL(file)
    setPhotoPreviewUrls((prev) => new Map(prev).set(step.id, localUrl))
    try {
      await uploadStepPhoto(submission.id, step.id, file)
      const updated = new Map(responses)
      const existing = responses.get(step.id)
      updated.set(step.id, {
        ...(existing ?? {
          id: '',
          submission_id: submission.id,
          step_id: step.id,
          confirmation: null,
          kc_response: null,
          kc_correct: null,
          responded_at: null,
          photo_review_comments: null,
        }),
        photo_path: `submissions/${submission.id}/steps/${step.id}`,
        photo_submitted_at: new Date().toISOString(),
        photo_review_status: 'pending',
      } as OjtSubmissionStep)
      setResponses(updated)
    } catch (err) {
      setPhotoError('Photo upload failed — your photo is saved locally but may not sync. Try retaking.')
      console.error('[photo upload]', err)
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function canConfirm(): boolean {
    if (!step) return false
    // Accept either a local preview (photo selected) or confirmed upload
    const hasPhoto = !!photoPreviewUrls.get(step.id) || !!response?.photo_path
    if (step.photo_required && !hasPhoto) return false
    if (step.kc_question && !response?.kc_response) return false
    return true
  }

  function goNext() {
    if (isLastStep) {
      onComplete(responses)
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  function goPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1)
  }

  if (!step) return null

  const pct = Math.round(((currentIndex + 1) / totalSteps) * 100)

  return (
    <div className="flex flex-col min-h-screen bg-slate-900">
      {/* Session header */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onBack}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            ✕ Exit
          </button>
          <span className="text-xs text-slate-400">
            Step {currentIndex + 1} of {totalSteps}
          </span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1.5 truncate">{procedure.title}</p>
      </div>

      {/* Step content */}
      <div className={`flex-1 overflow-auto px-4 py-5 w-full mx-auto ${jobGuideUrl ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <div className={`flex flex-col gap-6 ${jobGuideUrl ? 'lg:flex-row lg:items-start' : ''}`}>
        {/* LEFT COLUMN — instruction + all interactions */}
        <div className={jobGuideUrl ? 'lg:flex-1 lg:min-w-0' : ''}>
        {/* Step number + critical badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-mono text-slate-500">STEP {step.step_number}</span>
          {step.is_critical && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-300 border border-red-700 font-medium">
              CRITICAL
            </span>
          )}
        </div>

        {/* Warning */}
        {step.warning && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-xl">
            <p className="text-xs font-semibold text-yellow-300 uppercase tracking-wider mb-0.5">⚠️ Warning</p>
            <p className="text-sm text-yellow-100 leading-relaxed">{step.warning}</p>
          </div>
        )}

        {/* Caution */}
        {step.caution && (
          <div className="mb-4 p-3 bg-amber-900/30 border border-amber-700 rounded-xl">
            <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-0.5">⚡ Caution</p>
            <p className="text-sm text-amber-100 leading-relaxed">{step.caution}</p>
          </div>
        )}

        {/* Note */}
        {step.note && (
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800 rounded-xl">
            <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-0.5">ℹ️ Note</p>
            <p className="text-sm text-blue-100 leading-relaxed">{step.note}</p>
          </div>
        )}

        {/* Instruction */}
        <p className="text-base text-white leading-relaxed mb-5">{step.instruction}</p>

        {/* Reference image */}
        {imageUrl && (
          <div className="mb-5">
            <button
              onClick={() => setShowImage(!showImage)}
              className="text-xs text-violet-400 hover:text-violet-300 underline mb-2"
            >
              {showImage ? 'Hide reference image' : 'Show reference image'}
            </button>
            {showImage && (
              <img
                src={imageUrl}
                alt="Step reference"
                className="w-full rounded-xl border border-slate-700 object-contain max-h-64"
              />
            )}
          </div>
        )}

        {/* Photo capture */}
        {step.photo_required && (
          <div className="mb-5 p-4 bg-slate-800 border border-slate-700 rounded-xl">
            <p className="text-sm font-medium text-white mb-1">📸 Photo Required</p>
            {step.photo_instructions && (
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">{step.photo_instructions}</p>
            )}
            {/* Photo preview */}
            {(photoPreviewUrls.get(step.id) || response?.photo_path) && (
              <div className="mb-3 relative">
                <img
                  src={photoPreviewUrls.get(step.id) ?? ''}
                  alt="Captured photo"
                  className="w-full max-h-48 object-cover rounded-lg border border-slate-600"
                />
                <span className="absolute top-2 right-2 bg-green-700 text-white text-xs px-2 py-0.5 rounded-full">
                  ✓ Captured
                </span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
              id={`photo-${step.id}`}
            />
            <label
              htmlFor={`photo-${step.id}`}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                uploadingPhoto
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : photoPreviewUrls.get(step.id) || response?.photo_path
                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  : 'bg-violet-600 hover:bg-violet-500 text-white'
              }`}
            >
              {uploadingPhoto ? 'Uploading…' : photoPreviewUrls.get(step.id) || response?.photo_path ? 'Retake Photo' : 'Capture Photo'}
            </label>
            {photoError && (
              <p className="text-xs text-amber-400 mt-2">⚠️ {photoError}</p>
            )}
          </div>
        )}

        {/* Knowledge check */}
        {step.kc_question && (
          <div className="mb-5 p-4 bg-slate-800 border border-slate-700 rounded-xl">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Knowledge Check</p>
            <p className="text-sm text-white mb-3">{step.kc_question}</p>
            {step.kc_type === 'yes_no' ? (
              <div className="flex gap-2">
                {['Yes', 'No'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleKcAnswer(opt)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      response?.kc_response === opt
                        ? response.kc_correct
                          ? 'bg-green-700 text-white'
                          : 'bg-red-700 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {(step.kc_options ?? []).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleKcAnswer(opt)}
                    className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      response?.kc_response === opt
                        ? response.kc_correct
                          ? 'bg-green-700 text-white'
                          : 'bg-red-700 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            {response?.kc_response && (
              <p className={`text-xs mt-2 ${response.kc_correct ? 'text-green-400' : 'text-red-400'}`}>
                {response.kc_correct ? '✓ Correct' : `✗ Incorrect — correct answer: ${step.kc_correct_answer}`}
              </p>
            )}
          </div>
        )}

        {/* Confirmation buttons */}
        {step.requires_confirmation && (
          <div className="mb-5">
            <p className="text-xs text-slate-500 mb-2">Step confirmation</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'complete' as ConfirmationType, label: 'Complete', color: 'green' },
                  { value: 'not_complete' as ConfirmationType, label: 'Not Complete', color: 'red' },
                  { value: 'need_assistance' as ConfirmationType, label: 'Need Assistance', color: 'amber' },
                  { value: 'not_applicable' as ConfirmationType, label: 'Not Applicable', color: 'slate' },
                ] as const
              ).map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() => handleConfirm(value)}
                  disabled={saving || confirmed || !canConfirm()}
                  className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 ${
                    response?.confirmation === value
                      ? colorSelected[color]
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {step.photo_required && !response?.photo_path && (
              <p className="text-xs text-amber-400 mt-2">📸 Capture the required photo before confirming</p>
            )}
            {step.kc_question && !response?.kc_response && (
              <p className="text-xs text-amber-400 mt-2">Answer the knowledge check before confirming</p>
            )}
            {/* After confirming on the last step, prompt to use the footer button */}
            {confirmed && isLastStep && (
              <p className="text-xs text-violet-400 mt-2 text-center">✓ Saved — tap Review &amp; Submit below</p>
            )}
          </div>
        )}
        </div>
        {/* END LEFT COLUMN */}

        {/* RIGHT COLUMN — Job Guide image */}
        {jobGuideUrl && (
          <div className="lg:w-[44%] lg:flex-shrink-0 lg:sticky lg:top-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">📄 Job Guide</p>
            <button
              onClick={() => setZoomUrl(jobGuideUrl)}
              className="block w-full rounded-xl border border-slate-700 overflow-hidden bg-slate-950"
            >
              <img
                src={jobGuideUrl}
                alt="Job Guide reference"
                className="w-full object-contain max-h-[70vh]"
              />
            </button>
            <p className="text-xs text-slate-500 mt-1.5 text-center">Tap image to enlarge</p>
          </div>
        )}
        {/* END RIGHT COLUMN */}
        </div>
      </div>

      {/* Fullscreen zoom modal */}
      {zoomUrl && (
        <div
          onClick={() => setZoomUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        >
          <button
            onClick={() => setZoomUrl(null)}
            className="absolute top-4 right-4 text-white text-2xl leading-none w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-slate-700"
          >
            ✕
          </button>
          <img
            src={zoomUrl}
            alt="Job Guide enlarged"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Navigation footer */}
      <div className="bg-slate-950 border-t border-slate-800 px-4 py-3 flex gap-3 flex-shrink-0">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-sm font-medium transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={goNext}
          disabled={step.requires_confirmation && !response?.confirmation}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
        >
          {isLastStep ? 'Review & Submit' : 'Next →'}
        </button>
      </div>
    </div>
  )
}

const colorSelected: Record<string, string> = {
  green: 'bg-green-700 border-green-600 text-white',
  red: 'bg-red-800 border-red-700 text-white',
  amber: 'bg-amber-800 border-amber-700 text-white',
  slate: 'bg-slate-700 border-slate-600 text-white',
}
