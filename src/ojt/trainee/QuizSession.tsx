import { useEffect, useState } from 'react'
import {
  OjtQuizQuestion,
  OjtQuizResponse,
  OjtSubmission,
  upsertQuizResponse,
  getQuizResponses,
} from '../../db/ojt'

interface Props {
  questions: OjtQuizQuestion[]
  submission: OjtSubmission
  onComplete: (responses: Map<string, OjtQuizResponse>) => void
  onBack: () => void
}

export function QuizSession({ questions, submission, onComplete, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState<Map<string, OjtQuizResponse>>(new Map())
  const [shortAnswer, setShortAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(true)

  // Resume any already-answered quiz responses
  useEffect(() => {
    getQuizResponses(submission.id)
      .then((rows) => {
        const map = new Map<string, OjtQuizResponse>()
        for (const r of rows) map.set(r.question_id, r)
        setResponses(map)
        // Jump to first unanswered
        const firstUnanswered = questions.findIndex((q) => !map.has(q.id))
        if (firstUnanswered > 0) setCurrentIndex(firstUnanswered)
      })
      .catch(console.error)
      .finally(() => setLoadingExisting(false))
  }, [submission.id])

  const question = questions[currentIndex]
  const response = responses.get(question?.id ?? '')
  const isLast = currentIndex === questions.length - 1
  const isFirst = currentIndex === 0
  const answeredCount = responses.size
  const pct = Math.round((answeredCount / questions.length) * 100)
  const allAnswered = answeredCount >= questions.length

  async function handleAnswer(answer: string) {
    if (!question || saving) return
    setSaving(true)
    const isCorrect =
      question.correct_answer != null && question.question_type !== 'short_answer'
        ? answer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase()
        : null
    try {
      await upsertQuizResponse(submission.id, question.id, answer, isCorrect)
      const qr: OjtQuizResponse = {
        id: '',
        submission_id: submission.id,
        question_id: question.id,
        response: answer,
        is_correct: isCorrect,
        answered_at: new Date().toISOString(),
      }
      const updated = new Map(responses)
      updated.set(question.id, qr)
      setResponses(updated)
      // Auto-advance after brief pause (except last question)
      if (!isLast) {
        setTimeout(() => {
          setCurrentIndex((i) => i + 1)
          setShortAnswer('')
        }, 700)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleShortAnswerSubmit() {
    if (!shortAnswer.trim()) return
    await handleAnswer(shortAnswer.trim())
  }

  function finish() {
    onComplete(responses)
  }

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!question) return null

  return (
    <div className="flex flex-col min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onBack}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Back to Summary
          </button>
          <span className="text-xs text-slate-400">
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1.5">Post-Procedure Quiz</p>
      </div>

      {/* Question content */}
      <div className="flex-1 overflow-auto px-4 py-5 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-mono text-slate-500">Q{currentIndex + 1}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900/50 text-violet-300 border border-violet-700 capitalize">
            {question.question_type.replace('_', ' ')}
          </span>
        </div>

        <p className="text-lg text-white leading-relaxed mb-6">{question.question_text}</p>

        {/* Yes / No */}
        {question.question_type === 'yes_no' && (
          <div className="grid grid-cols-2 gap-3">
            {['Yes', 'No'].map((opt) => (
              <button
                key={opt}
                onClick={() => handleAnswer(opt)}
                disabled={saving || !!response}
                className={`py-4 rounded-xl text-base font-semibold transition-colors disabled:opacity-80 ${
                  response?.response === opt
                    ? response.is_correct === true
                      ? 'bg-green-700 border-2 border-green-500 text-white'
                      : response.is_correct === false
                        ? 'bg-red-800 border-2 border-red-600 text-white'
                        : 'bg-violet-700 border-2 border-violet-500 text-white'
                    : 'bg-slate-800 border-2 border-slate-700 hover:border-violet-500 text-slate-200'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Multiple choice */}
        {question.question_type === 'multiple_choice' && (
          <div className="flex flex-col gap-2">
            {(question.options ?? []).map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(opt)}
                disabled={saving || !!response}
                className={`text-left px-4 py-3 rounded-xl text-sm transition-colors disabled:opacity-80 ${
                  response?.response === opt
                    ? response.is_correct === true
                      ? 'bg-green-700 border-2 border-green-500 text-white'
                      : response.is_correct === false
                        ? 'bg-red-800 border-2 border-red-600 text-white'
                        : 'bg-violet-700 border-2 border-violet-500 text-white'
                    : 'bg-slate-800 border-2 border-slate-700 hover:border-violet-500 text-slate-200'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Short answer */}
        {question.question_type === 'short_answer' && (
          <div>
            <textarea
              value={response ? (response.response ?? '') : shortAnswer}
              onChange={(e) => setShortAnswer(e.target.value)}
              disabled={!!response || saving}
              placeholder="Type your answer…"
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm resize-none disabled:opacity-60"
            />
            {!response && (
              <button
                onClick={handleShortAnswerSubmit}
                disabled={!shortAnswer.trim() || saving}
                className="mt-3 w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-medium transition-colors"
              >
                {saving ? 'Saving…' : 'Submit Answer'}
              </button>
            )}
          </div>
        )}

        {/* Feedback after answering */}
        {response && question.question_type !== 'short_answer' && (
          <div
            className={`mt-4 p-3 rounded-xl border ${
              response.is_correct === true
                ? 'bg-green-900/30 border-green-700'
                : response.is_correct === false
                  ? 'bg-red-900/30 border-red-700'
                  : 'bg-violet-900/20 border-violet-700'
            }`}
          >
            {response.is_correct === true && (
              <p className="text-sm text-green-300 font-medium">✓ Correct!</p>
            )}
            {response.is_correct === false && (
              <>
                <p className="text-sm text-red-300 font-medium">✗ Incorrect</p>
                {question.correct_answer && (
                  <p className="text-xs text-red-200 mt-0.5">
                    Correct answer: {question.correct_answer}
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {response && question.question_type === 'short_answer' && (
          <div className="mt-4 p-3 rounded-xl bg-slate-800 border border-slate-700">
            <p className="text-xs text-slate-400">✓ Answer recorded for supervisor review.</p>
          </div>
        )}
      </div>

      {/* Navigation footer */}
      <div className="bg-slate-950 border-t border-slate-800 px-4 py-3 flex gap-3 flex-shrink-0">
        <button
          onClick={() => {
            setCurrentIndex((i) => i - 1)
            setShortAnswer('')
          }}
          disabled={isFirst}
          className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-sm font-medium transition-colors"
        >
          ← Back
        </button>
        {isLast ? (
          <button
            onClick={finish}
            disabled={!allAnswered}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            {allAnswered ? 'Finish Quiz →' : 'Answer all questions'}
          </button>
        ) : (
          <button
            onClick={() => {
              setCurrentIndex((i) => i + 1)
              setShortAnswer('')
            }}
            disabled={!response}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  )
}
