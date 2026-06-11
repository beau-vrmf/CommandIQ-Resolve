import { useEffect, useState } from 'react'
import {
  OjtProcedure,
  OjtQuizQuestion,
  QuizQuestionType,
  getQuizQuestions,
  upsertQuizQuestion,
  deleteQuizQuestion,
  upsertProcedure,
} from '../../db/ojt'

interface Props {
  procedure: OjtProcedure
  onBack: () => void
}

export function QuizEditor({ procedure, onBack }: Props) {
  const [questions, setQuestions] = useState<OjtQuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [editingQ, setEditingQ] = useState<Partial<OjtQuizQuestion> | null>(null)
  const [passingScore, setPassingScore] = useState(
    procedure.quiz_passing_score?.toString() ?? '',
  )
  const [savingScore, setSavingScore] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setQuestions(await getQuizQuestions(procedure.id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [procedure.id])

  async function handleDelete(id: string) {
    if (!confirm('Remove this question?')) return
    await deleteQuizQuestion(id)
    void load()
  }

  async function handleSave(q: Partial<OjtQuizQuestion>) {
    await upsertQuizQuestion({
      ...q,
      procedure_id: procedure.id,
    } as Partial<OjtQuizQuestion> & { procedure_id: string; question_text: string })
    setEditingQ(null)
    void load()
  }

  async function handleSavePassingScore() {
    setSavingScore(true)
    try {
      await upsertProcedure({
        ...procedure,
        quiz_passing_score: passingScore ? parseInt(passingScore, 10) : null,
      })
    } finally {
      setSavingScore(false)
    }
  }

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-4 transition-colors"
      >
        ← Back to Steps
      </button>

      {/* Procedure header */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-5">
        <p className="font-semibold text-white">{procedure.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Post-procedure quiz — presented to the trainee after all steps are complete
        </p>
        {/* Passing score */}
        <div className="flex items-center gap-2 mt-3">
          <input
            type="number"
            min="0"
            max="100"
            value={passingScore}
            onChange={(e) => setPassingScore(e.target.value)}
            placeholder="Passing score %"
            className="w-36 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
          />
          <button
            onClick={handleSavePassingScore}
            disabled={savingScore}
            className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors disabled:opacity-50"
          >
            {savingScore ? 'Saved' : 'Set Passing Score'}
          </button>
          <span className="text-xs text-slate-500">(leave blank to skip grading)</span>
        </div>
      </div>

      {/* Add question header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-300">
          {questions.length} Question{questions.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() =>
            setEditingQ({
              procedure_id: procedure.id,
              sort_order: questions.length,
              question_type: 'yes_no',
              is_active: true,
            })
          }
          className="text-sm px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-medium transition-colors"
        >
          + Add Question
        </button>
      </div>

      {editingQ && (
        <QuestionForm
          question={editingQ}
          onSave={handleSave}
          onCancel={() => setEditingQ(null)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : questions.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-12">
          No quiz questions yet. Add questions to create a post-procedure quiz.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {questions.map((q, idx) => (
            <div key={q.id} className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="text-xs font-mono text-slate-500 mt-0.5 flex-shrink-0 w-6">
                  Q{idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{q.question_text}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-500 capitalize">
                      {q.question_type.replace('_', ' ')}
                    </span>
                    {q.correct_answer && (
                      <span className="text-xs text-green-400">✓ {q.correct_answer}</span>
                    )}
                  </div>
                  {q.options && q.options.length > 0 && (
                    <p className="text-xs text-slate-600 mt-0.5">
                      Options: {q.options.join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setEditingQ({ ...q })}
                    className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-red-900 rounded-lg text-slate-400 hover:text-red-300 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuestionForm({
  question,
  onSave,
  onCancel,
}: {
  question: Partial<OjtQuizQuestion>
  onSave: (q: Partial<OjtQuizQuestion>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    question_text: question.question_text ?? '',
    question_type: (question.question_type ?? 'yes_no') as QuizQuestionType,
    options: (question.options ?? []).join('\n'),
    correct_answer: question.correct_answer ?? '',
  })

  const inp =
    'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm'
  const ta = `${inp} resize-none`

  function submit() {
    if (!form.question_text.trim()) return
    const opts =
      form.question_type === 'multiple_choice'
        ? form.options
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : null
    onSave({
      ...question,
      question_text: form.question_text.trim(),
      question_type: form.question_type,
      options: opts && opts.length > 0 ? opts : null,
      correct_answer: form.correct_answer.trim() || null,
    })
  }

  return (
    <div className="mb-4 p-4 bg-slate-800 border border-violet-700 rounded-xl">
      <h3 className="text-sm font-semibold text-white mb-3">
        {question.id ? 'Edit Question' : 'New Question'}
      </h3>
      <div className="flex flex-col gap-3">
        <textarea
          value={form.question_text}
          onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
          placeholder="Question text *"
          rows={2}
          className={ta}
        />
        <select
          value={form.question_type}
          onChange={(e) =>
            setForm((f) => ({ ...f, question_type: e.target.value as QuizQuestionType }))
          }
          className={inp}
        >
          <option value="yes_no">Yes / No</option>
          <option value="multiple_choice">Multiple Choice</option>
          <option value="short_answer">Short Answer</option>
        </select>

        {form.question_type === 'multiple_choice' && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Answer options (one per line)</label>
            <textarea
              value={form.options}
              onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
              placeholder="Option A&#10;Option B&#10;Option C"
              rows={4}
              className={ta}
            />
          </div>
        )}

        {form.question_type !== 'short_answer' && (
          <input
            value={form.correct_answer}
            onChange={(e) => setForm((f) => ({ ...f, correct_answer: e.target.value }))}
            placeholder={
              form.question_type === 'yes_no'
                ? 'Correct answer: Yes or No'
                : 'Correct answer (must match an option exactly)'
            }
            className={inp}
          />
        )}

        {form.question_type === 'short_answer' && (
          <p className="text-xs text-slate-500">
            Short answer responses are recorded for supervisor review — no auto-grading.
          </p>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={submit}
          disabled={!form.question_text.trim()}
          className="text-sm px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
        >
          {question.id ? 'Save Changes' : 'Add Question'}
        </button>
        <button
          onClick={onCancel}
          className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
