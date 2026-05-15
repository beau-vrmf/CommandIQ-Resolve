import { useNavigate } from 'react-router-dom'
import { useSession } from '../store/session'

export function Landing() {
  const navigate = useNavigate()
  const active = useSession((s) => s.active)

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-8 max-w-xl mx-auto w-full">
      {active && !active.outcome && (
        <button
          onClick={() => navigate('/session')}
          className="w-full rounded-xl bg-amber-700 hover:bg-amber-600 px-5 py-4 text-left"
        >
          <p className="text-xs uppercase tracking-wide text-amber-200 mb-0.5">Session in progress</p>
          <p className="font-semibold text-white">Resume — Fault {active.faultCode}</p>
        </button>
      )}

      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-white">CommandIQ Resolve</h1>
        <p className="text-slate-400 text-lg leading-relaxed">
          Guided fault isolation for aircraft maintenance.<br />
          Follow structured decision trees to diagnose and resolve malfunctions with confidence.
        </p>
      </div>

      <button
        onClick={() => navigate('/resolve')}
        className="w-full py-5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xl font-bold shadow-lg"
      >
        Enter Resolve
      </button>

      <a
        href="https://ext-power-trainer.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-slate-400 hover:text-slate-200 underline underline-offset-4"
      >
        Tutorial
      </a>
    </div>
  )
}
