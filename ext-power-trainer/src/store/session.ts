import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getBlock, DEDUCTION_PER_WRONG_ANSWER } from '../data/fi-tree'
import type { Outcome } from '../data/fi-tree'

export type StepRecord = {
  blockId: string
  enteredAt: number
  answer: 'yes' | 'no' | null
  answeredAt: number | null
  wasCorrect: boolean | null  // null until answered; true/false based on correctAnswer
  note?: string
  photoIds: string[]
}

export type IncorrectDecision = {
  blockId: string
  userAnswer: 'yes' | 'no'
  correctAnswer: 'yes' | 'no'
  timestamp: number
}

export type ActiveSession = {
  id: string
  faultCode: string
  entryBlockId: string
  currentBlockId: string
  startedAt: number
  elapsedMs: number
  resumedAt: number | null
  steps: StepRecord[]
  outcome: Outcome | null
  score: number
  deductions: number
  incorrectDecisions: IncorrectDecision[]
}

type SessionState = {
  active: ActiveSession | null
  startSession: (faultCode: string, entryBlockId: string) => void
  answer: (blockId: string, answer: 'yes' | 'no', next: string | Outcome | undefined) => void
  completeTerminal: (blockId: string, outcome: Outcome) => void
  goBack: () => void
  setNoteOnCurrent: (note: string) => void
  addPhotoToCurrent: (photoId: string) => void
  removePhotoFromCurrent: (photoId: string) => void
  pause: () => void
  resume: () => void
  finish: () => void
  clear: () => void
}

function makeStep(blockId: string): StepRecord {
  return {
    blockId,
    enteredAt: Date.now(),
    answer: null,
    answeredAt: null,
    wasCorrect: null,
    photoIds: [],
  }
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      active: null,
      startSession: (faultCode, entryBlockId) => {
        const now = Date.now()
        set({
          active: {
            id: crypto.randomUUID(),
            faultCode,
            entryBlockId,
            currentBlockId: entryBlockId,
            startedAt: now,
            elapsedMs: 0,
            resumedAt: now,
            steps: [makeStep(entryBlockId)],
            outcome: null,
            score: 100,
            deductions: 0,
            incorrectDecisions: [],
          },
        })
      },
      answer: (blockId, userAnswer, next) => {
        const a = get().active
        if (!a || a.steps.length === 0) return
        const lastIdx = a.steps.length - 1
        const last = a.steps[lastIdx]
        if (last.blockId !== blockId) return

        // Scoring: compare against correctAnswer on the block data
        const block = getBlock(blockId)
        const correctAnswer = block?.correctAnswer
        const wasCorrect = correctAnswer ? userAnswer === correctAnswer : null

        let score = a.score
        let deductions = a.deductions
        const incorrectDecisions = [...a.incorrectDecisions]

        if (wasCorrect === false && correctAnswer) {
          const deduct = DEDUCTION_PER_WRONG_ANSWER
          deductions += deduct
          score = Math.max(0, score - deduct)
          incorrectDecisions.push({
            blockId,
            userAnswer,
            correctAnswer,
            timestamp: Date.now(),
          })
        }

        const updatedLast: StepRecord = {
          ...last,
          answer: userAnswer,
          answeredAt: Date.now(),
          wasCorrect,
        }
        const steps = a.steps.slice(0, lastIdx).concat(updatedLast)

        if (typeof next === 'string') {
          set({
            active: {
              ...a,
              steps: [...steps, makeStep(next)],
              currentBlockId: next,
              score,
              deductions,
              incorrectDecisions,
            },
          })
        } else if (next) {
          set({ active: { ...a, steps, outcome: next, score, deductions, incorrectDecisions } })
        } else {
          set({
            active: {
              ...a,
              steps,
              outcome: { kind: 'escalate', message: 'Tree path not yet authored.' },
              score,
              deductions,
              incorrectDecisions,
            },
          })
        }
      },
      completeTerminal: (blockId, outcome) => {
        const a = get().active
        if (!a || a.steps.length === 0) return
        const lastIdx = a.steps.length - 1
        const last = a.steps[lastIdx]
        if (last.blockId !== blockId) return
        const updatedLast: StepRecord = { ...last, answeredAt: Date.now() }
        const steps = a.steps.slice(0, lastIdx).concat(updatedLast)
        set({ active: { ...a, steps, outcome } })
      },
      goBack: () => {
        const a = get().active
        if (!a || a.steps.length < 2) return
        const newSteps = a.steps.slice(0, -1)
        const lastIdx = newSteps.length - 1
        newSteps[lastIdx] = {
          ...newSteps[lastIdx],
          answer: null,
          answeredAt: null,
          wasCorrect: null,
        }
        set({
          active: {
            ...a,
            steps: newSteps,
            currentBlockId: newSteps[lastIdx].blockId,
            outcome: null,
          },
        })
      },
      setNoteOnCurrent: (note) => {
        const a = get().active
        if (!a || a.steps.length === 0) return
        const lastIdx = a.steps.length - 1
        const steps = a.steps.map((s, i) =>
          i === lastIdx ? { ...s, note: note || undefined } : s,
        )
        set({ active: { ...a, steps } })
      },
      addPhotoToCurrent: (photoId) => {
        const a = get().active
        if (!a || a.steps.length === 0) return
        const lastIdx = a.steps.length - 1
        const steps = a.steps.map((s, i) =>
          i === lastIdx ? { ...s, photoIds: [...s.photoIds, photoId] } : s,
        )
        set({ active: { ...a, steps } })
      },
      removePhotoFromCurrent: (photoId) => {
        const a = get().active
        if (!a || a.steps.length === 0) return
        const lastIdx = a.steps.length - 1
        const steps = a.steps.map((s, i) =>
          i === lastIdx ? { ...s, photoIds: s.photoIds.filter((p) => p !== photoId) } : s,
        )
        set({ active: { ...a, steps } })
      },
      pause: () => {
        const a = get().active
        if (!a || a.resumedAt === null) return
        const delta = Date.now() - a.resumedAt
        set({ active: { ...a, elapsedMs: a.elapsedMs + delta, resumedAt: null } })
      },
      resume: () => {
        const a = get().active
        if (!a || a.resumedAt !== null) return
        set({ active: { ...a, resumedAt: Date.now() } })
      },
      finish: () => set({ active: null }),
      clear: () => set({ active: null }),
    }),
    {
      name: 'ext-power-trainer-session',
      version: 1,
      migrate: () => ({ active: null }),
    },
  ),
)

export function totalElapsedMs(a: ActiveSession): number {
  const running = a.resumedAt ? Date.now() - a.resumedAt : 0
  return a.elapsedMs + running
}

export function currentStep(a: ActiveSession): StepRecord | null {
  return a.steps.length > 0 ? a.steps[a.steps.length - 1] : null
}
