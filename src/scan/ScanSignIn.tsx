// Lightweight sign-in for the Scan admin/SME tabs. Reuses the shared Supabase
// auth (man-number → email) from db/ojt; branded for CommandIQ Scan.

import { useState, FormEvent } from 'react'
import { signIn } from '../db/ojt'

interface Props {
  onSignedIn: () => void
  onCancel: () => void
}

export function ScanSignIn({ onSignedIn, onCancel }: Props) {
  const [manNumber, setManNumber] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!manNumber.trim() || !password) return
    setError(null)
    setLoading(true)
    try {
      const { error: authError } = await signIn(manNumber, password)
      if (authError) setError('Invalid man number or password.')
      else onSignedIn()
    } catch {
      setError('Sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight text-white">Content sign-in</h1>
          <p className="text-slate-400 text-sm mt-1">
            Managing or validating components requires an account.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            value={manNumber}
            onChange={(e) => setManNumber(e.target.value)}
            placeholder="Man number"
            className="input"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="input"
          />
          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !manNumber.trim() || !password}
            className="mt-1 w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <button type="button" onClick={onCancel} className="text-xs text-slate-400 hover:text-white mt-1">
            ← Back to scanning
          </button>
        </form>
      </div>
    </div>
  )
}
