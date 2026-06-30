// Main menu — public, no sign-in required.
// CommandIQ Toolkit: CommandIQ Resolve (open, /resolve) and CommandIQ Assess (sign-in at /ojt).

import { useNavigate } from 'react-router-dom'
import { useSession } from '../store/session'

export function Landing() {
  const navigate = useNavigate()
  const active = useSession((s) => s.active)

  return (
    <div className="flex-1 flex flex-col px-5 py-10 max-w-lg mx-auto w-full">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-white">CommandIQ Toolkit</h1>
        <p className="text-slate-400 text-sm mt-2">Select a tool to begin</p>
      </div>

      {/* Resume FI session banner */}
      {active && !active.outcome && (
        <button
          onClick={() => navigate('/session')}
          className="mb-6 w-full rounded-xl bg-amber-900/50 border border-amber-700 px-5 py-4 text-left"
        >
          <p className="text-xs uppercase tracking-wide text-amber-300 mb-0.5">Session in progress</p>
          <p className="font-semibold text-white">Resume — Fault {active.faultCode}</p>
        </button>
      )}

      <div className="flex flex-col gap-4">
        {/* CommandIQ Resolve — Fault Isolation */}
        <button
          onClick={() => navigate('/resolve')}
          className="text-left p-6 bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-2xl transition group"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-900/50 border border-blue-700 flex items-center justify-center text-xl mb-3">
                🔍
              </div>
              <h2 className="text-lg font-semibold text-white group-hover:text-blue-300 transition">
                CommandIQ Resolve
              </h2>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Diagnose and resolve aircraft malfunctions using fault isolation guidance.
              </p>
            </div>
            <span className="text-slate-500 group-hover:text-blue-400 transition text-xl flex-shrink-0 mt-1">→</span>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-xs text-slate-500">No sign-in required</span>
            </div>
            <a
              href="https://ext-power-trainer.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
            >
              Tutorial ↗
            </a>
          </div>
        </button>

        {/* CommandIQ Assess — Guided Procedure Assessment */}
        <button
          onClick={() => navigate('/ojt')}
          className="text-left p-6 bg-slate-800 border border-slate-700 hover:border-violet-500 rounded-2xl transition group"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="w-10 h-10 rounded-xl bg-violet-900/50 border border-violet-700 flex items-center justify-center text-xl mb-3">
                📋
              </div>
              <h2 className="text-lg font-semibold text-white group-hover:text-violet-300 transition">
                CommandIQ Assess
              </h2>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Complete maintenance tasks step by step using job guide procedures, with photo verification and supervisor review.
              </p>
            </div>
            <span className="text-slate-500 group-hover:text-violet-400 transition text-xl flex-shrink-0 mt-1">→</span>
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span className="text-xs text-slate-500">Sign-in required</span>
          </div>
        </button>

        {/* CommandIQ Scan — Component Recognition */}
        <button
          onClick={() => navigate('/scan')}
          className="text-left p-6 bg-slate-800 border border-slate-700 hover:border-emerald-500 rounded-2xl transition group"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-900/50 border border-emerald-700 flex items-center justify-center text-xl mb-3">
                📷
              </div>
              <h2 className="text-lg font-semibold text-white group-hover:text-emerald-300 transition">
                CommandIQ Scan
              </h2>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Identify aircraft components with the camera and open related training content, references, and safety notes.
              </p>
            </div>
            <span className="text-slate-500 group-hover:text-emerald-400 transition text-xl flex-shrink-0 mt-1">→</span>
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-xs text-slate-500">No sign-in required</span>
          </div>
        </button>
      </div>

    </div>
  )
}
