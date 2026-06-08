// OJT Upgrade Training — entry point.
// Checks Supabase Auth session on mount; routes to sign-in or the role-gated shell.

import { useEffect, useState } from 'react'
import { supabase } from '../db/supabase'
import { getMyProfile, OjtProfile } from '../db/ojt'
import { OjtSignIn } from './SignIn'
import { OjtShell } from './Shell'

type State =
  | { phase: 'loading' }
  | { phase: 'signed-out' }
  | { phase: 'no-profile' }
  | { phase: 'ready'; profile: OjtProfile }

export function OjtApp() {
  const [state, setState] = useState<State>({ phase: 'loading' })

  async function load() {
    setState({ phase: 'loading' })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setState({ phase: 'signed-out' })
      return
    }
    try {
      console.log('[OJT] auth uid:', session.user.id)
      const profile = await getMyProfile(session.user.id)
      console.log('[OJT] profile result:', profile)
      if (!profile) {
        setState({ phase: 'no-profile' })
      } else {
        setState({ phase: 'ready', profile })
      }
    } catch (err) {
      console.error('[OJT] profile load error:', err)
      setState({ phase: 'no-profile' })
    }
  }

  useEffect(() => {
    void load()
    // Listen for auth state changes (e.g. token refresh, sign-out from another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setState({ phase: 'signed-out' })
      if (event === 'SIGNED_IN') void load()
    })
    return () => subscription.unsubscribe()
  }, [])

  if (state.phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (state.phase === 'signed-out') {
    return <OjtSignIn onSignedIn={load} />
  }

  if (state.phase === 'no-profile') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-white font-semibold text-lg">No training profile found</h1>
        <p className="text-slate-400 text-sm mt-2 max-w-xs">
          Your account exists but doesn't have an OJT profile yet. Contact your supervisor.
        </p>
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            setState({ phase: 'signed-out' })
          }}
          className="mt-6 text-sm text-slate-400 hover:text-white underline"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <OjtShell
      profile={state.profile}
      onSignedOut={() => setState({ phase: 'signed-out' })}
    />
  )
}
