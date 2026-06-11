import { useEffect, useState } from 'react'
import {
  OjtProfile,
  OjtProcedure,
  OjtSubmission,
  OjtProcedureStep,
  OjtSubmissionStep,
  OjtQuizQuestion,
  OjtQuizResponse,
  getProcedureWithSteps,
  getLatestSubmission,
  getActiveSubmission,
  startSubmission,
  getQuizQuestions,
} from '../../db/ojt'
import { ProcedureSession } from './ProcedureSession'
import { QuizSession } from './QuizSession'
import { CompletionSummary } from './CompletionSummary'

type Phase = 'overview' | 'session' | 'quiz' | 'summary'

interface Props {
  procedure: OjtProcedure
  profile: OjtProfile
  onBack: () => void
}

export function ProcedureOverview({ procedure, profile, onBack }: Props) {
  const [steps, setSteps] = useState<OjtProcedureStep[]>([])
  const [quizQuestions, setQuizQuestions] = useState<OjtQuizQuestion[]>([])
  const [activeSubmission, setActiveSubmission] = useState<OjtSubmission | null>(null)
  const [latestSubmission, setLatestSubmission] = useState<OjtSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [phase, setPhase] = useState<Phase>('overview')
  // Carry responses across phases
  const [stepResponses, setStepResponses] = useState<Map<string, OjtSubmissionStep>>(new Map())
  const [quizResponses, setQuizResponses] = useState<Map<string, OjtQuizResponse>>(new Map())
  // The submission in use during session/quiz/summary
  const [currentSubmission, setCurrentSubmission] = useState<OjtSubmission | null>(null)

  useEffect(() => {
    async function load() {
      const [{ steps: s }, active, latest, questions] = await Promise.all([
        getProcedureWithSteps(procedure.id),
        getActiveSubmission(profile.id, procedure.id),
        getLatestSubmission(profile.id, procedure.id),
        getQuizQuestions(procedure.id),
      ])
      setSteps(s)
      setActiveSubmission(active)
      setLatestSubmission(latest)
      setQuizQuestions(questions)
      setLoading(false)
    }
    void load()
  }, [procedure.id, profile.id])

  async function handleStart() {
    setStarting(true)
    try {
      const sub = await startSubmission(profile.id, procedure.id)
      setCurrentSubmission(sub)
      setPhase('session')
    } finally {
      setStarting(false)
    }
  }

  function handleResume() {
    setCurrentSubmission(activeSubmission)
    setPhase('session')
  }

  function handleSessionComplete(responses: Map<string, OjtSubmissionStep>) {
    setStepResponses(responses)
    if (quizQuestions.length > 0) {
      setPhase('quiz')
    } else {
      setPhase('summary')
    }
  }

  function handleQuizComplete(responses: Map<string, OjtQuizResponse>) {
    setQuizResponses(responses)
    setPhase('summary')
  }

  // ─── Phase renders ───────────────────────────────────────────────────────────

  if (phase === 'session' && currentSubmission) {
    return (
      <ProcedureSession
        procedure={procedure}
        steps={steps}
        submission={currentSubmission}
        onComplete={handleSessionComplete}
        onBack={onBack}
      />
    )
  }

  if (phase === 'quiz' && currentSubmission) {
    return (
      <QuizSession
        questions={quizQuestions}
        submission={currentSubmission}
        onComplete={handleQuizComplete}
        onBack={() => setPhase('session')}
      />
    )
  }

  if (phase === 'summary' && currentSubmission) {
    return (
      <CompletionSummary
        procedure={procedure}
        steps={steps}
        submission={currentSubmission}
        responses={stepResponses}
        profile={profile}
        quizQuestions={quizQuestions}
        quizResponses={quizResponses}
        onBack={onBack}
      />
    )
  }

  // ─── Overview ────────────────────────────────────────────────────────────────

  const criticalPhotoSteps = steps.filter((s) => s.is_critical && s.photo_required)
  const hasCriticalPhotoSteps = criticalPhotoSteps.length > 0
  const isReturned =
    latestSubmission != null &&
    ['returned', 'incomplete', 'retrain'].includes(latestSubmission.status)

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-5 transition-colors"
      >
        ← Back to Procedures
      </button>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="mb-5">
            <h1 className="text-xl font-bold text-white">{procedure.title}</h1>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-slate-400">
              <span>{procedure.aircraft}</span>
              {procedure.afsc && <span>· AFSC {procedure.afsc}</span>}
              {procedure.skill_level && <span>· {procedure.skill_level}</span>}
              {procedure.version && <span>· v{procedure.version}</span>}
            </div>
          </div>

          {/* Returned / Incomplete / Retrain banner */}
          {isReturned && latestSubmission && (
            <div className="mb-5 p-4 bg-amber-900/30 border border-amber-700 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                  {latestSubmission.status === 'retrain'
                    ? '🔄 Retraining Required'
                    : latestSubmission.status === 'incomplete'
                      ? '⚠️ Marked Incomplete'
                      : '↩ Returned for Correction'}
                </span>
              </div>
              {latestSubmission.reviewer_comments && (
                <p className="text-sm text-amber-100 leading-relaxed mt-1">
                  <span className="font-medium">Reviewer comments: </span>
                  {latestSubmission.reviewer_comments}
                </p>
              )}
              {latestSubmission.reviewed_at && (
                <p className="text-xs text-amber-400 mt-1">
                  Reviewed {new Date(latestSubmission.reviewed_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {procedure.estimated_minutes != null && (
              <InfoCard label="Est. Time" value={`~${procedure.estimated_minutes} min`} />
            )}
            <InfoCard label="Steps" value={`${steps.length} steps`} />
            {procedure.procedure_category && (
              <InfoCard label="Category" value={procedure.procedure_category} />
            )}
            {quizQuestions.length > 0 && (
              <InfoCard
                label="Quiz"
                value={`${quizQuestions.length} question${quizQuestions.length !== 1 ? 's' : ''}${procedure.quiz_passing_score ? ` · ${procedure.quiz_passing_score}% to pass` : ''}`}
              />
            )}
            {hasCriticalPhotoSteps && (
              <InfoCard
                label="Critical Steps"
                value={`${criticalPhotoSteps.length} require photo`}
                highlight
              />
            )}
          </div>

          {/* Required tools */}
          {procedure.required_tools && (
            <Section title="Required Tools / Equipment">
              <p className="text-sm text-slate-300 leading-relaxed">{procedure.required_tools}</p>
            </Section>
          )}

          {/* Required references */}
          {procedure.required_references && (
            <Section title="Required References">
              <p className="text-sm text-slate-300 leading-relaxed">
                {procedure.required_references}
              </p>
            </Section>
          )}

          {/* Safety warnings */}
          {procedure.safety_warnings && (
            <div className="mb-4 p-4 bg-yellow-900/30 border border-yellow-700 rounded-xl">
              <p className="text-xs font-semibold text-yellow-300 uppercase tracking-wider mb-1">
                ⚠️ Warning
              </p>
              <p className="text-sm text-yellow-100 leading-relaxed">{procedure.safety_warnings}</p>
            </div>
          )}

          {/* Cautions */}
          {procedure.cautions && (
            <div className="mb-4 p-4 bg-amber-900/30 border border-amber-700 rounded-xl">
              <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1">
                ⚡ Caution
              </p>
              <p className="text-sm text-amber-100 leading-relaxed">{procedure.cautions}</p>
            </div>
          )}

          {/* Notes */}
          {procedure.notes && (
            <div className="mb-4 p-4 bg-blue-900/20 border border-blue-800 rounded-xl">
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1">
                ℹ️ Note
              </p>
              <p className="text-sm text-blue-100 leading-relaxed">{procedure.notes}</p>
            </div>
          )}

          {/* Critical photo warning */}
          {hasCriticalPhotoSteps && (
            <div className="mb-5 p-3 bg-slate-800 border border-slate-600 rounded-xl flex gap-2.5">
              <span className="text-base flex-shrink-0">📸</span>
              <p className="text-xs text-slate-300 leading-relaxed">
                This procedure includes {criticalPhotoSteps.length} critical step
                {criticalPhotoSteps.length > 1 ? 's' : ''} requiring photo verification. You will
                not be able to submit until all required photos are captured.
              </p>
            </div>
          )}

          {/* Action button(s) */}
          {activeSubmission ? (
            <button
              onClick={handleResume}
              className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-base transition-colors"
            >
              Resume Procedure
            </button>
          ) : isReturned ? (
            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-base transition-colors"
            >
              {starting ? 'Starting…' : 'Start New Attempt'}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-base transition-colors"
            >
              {starting ? 'Starting…' : 'Start Procedure'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function InfoCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${highlight ? 'bg-amber-900/20 border-amber-700' : 'bg-slate-800 border-slate-700'}`}
    >
      <p className={`text-xs ${highlight ? 'text-amber-400' : 'text-slate-500'}`}>{label}</p>
      <p
        className={`text-sm font-medium mt-0.5 ${highlight ? 'text-amber-200' : 'text-white'}`}
      >
        {value}
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {title}
      </p>
      {children}
    </div>
  )
}
