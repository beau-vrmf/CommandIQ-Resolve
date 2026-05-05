import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Outcome } from '../data/fi-tree'

export type StepRecord = {
  blockId: string
  enteredAt: number
  answer: 'yes' | 'no' | null
  answeredAt: number | null
  note?: string
  photoIds: string[] // multiple photos per block
}

export type ActiveSession = {
  id: string
  faultCode: string
  entryBlockId: string
  currentBlockId: string
  startedAt: number
  elapsedMs: number // accumulated while paused
  resumedAt: number | null // timestamp when timer last resumed; null while paused
  steps: StepRecord[] // index 0 is the entry block; last step is the current visit
  outcome: Outcome | null
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
          },
        })
      },
      answer: (blockId, answer, next) => {
        const a = get().active
        if (!a || a.steps.length === 0) return
        const lastIdx = a.steps.length - 1
        const last = a.steps[lastIdx]
        if (last.blockId !== blockId) return // safety: ignore stale answers
        const updatedLast: StepRecord = {
          ...last,
          answer,
          answeredAt: Date.now(),
        }
        const steps = a.steps.slice(0, lastIdx).concat(updatedLast)
        if (typeof next === 'string') {
          set({
            active: {
              ...a,
              steps: [...steps, makeStep(next)],
              currentBlockId: next,
            },
          })
        } else if (next) {
          set({ active: { ...a, steps, outcome: next } })
        } else {
          // No next defined — treat as escalate (cross-sheet not authored, etc.)
          set({
            active: {
              ...a,
              steps,
              outcome: { kind: 'escalate', message: 'Tree path not yet authored.' },
            },
          })
        }
      },
      goBack: () => {
        const a = get().active
        if (!a || a.steps.length < 2) return
        // Drop the current block visit (and any notes/photos attached to it),
        // then clear the previous step's YES/NO answer so the user can re-pick.
        const newSteps = a.steps.slice(0, -1)
        const lastIdx = newSteps.length - 1
        newSteps[lastIdx] = { ...newSteps[lastIdx], answer: null, answeredAt: null }
        set({
          active: {
            ...a,
            steps: newSteps,
            currentBlockId: newSteps[lastIdx].blockId,
            outcome: null, // in case we somehow had a terminal outcome staged
          },
        })
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
      name: 'tk-active-session',
      version: 3, // bumped due to scoped-id block schema change
      migrate: () => ({ active: null }), // discard any prior in-flight session
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
