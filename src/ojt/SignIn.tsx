import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { signIn } from '../db/ojt'

interface Props {
  onSignedIn: () => void
}

export function OjtSignIn({ onSignedIn }: Props) {
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
      if (authError) {
        setError('Invalid man number or password.')
      } else {
        onSignedIn()
      }
    } catch {
      setError('Sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block text-xs text-slate-500 hover:text-slate-300 mb-6 transition-colors">
            ← Back to Home
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">CommandIQ Assess</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in with your man number</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="man-number" className="block text-sm font-medium text-slate-300 mb-1">
              Man Number
            </label>
            <input
              id="man-number"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              value={manNumber}
              onChange={(e) => setManNumber(e.target.value)}
              placeholder="e.g. 1234567"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !manNumber.trim() || !password}
            className="mt-2 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
