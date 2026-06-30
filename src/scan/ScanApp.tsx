// CommandIQ Scan entry point. Unlike OjtApp (which gates the whole module behind
// auth), Scan is public by default: it loads any existing Supabase session for
// admin/SME features but never blocks scanning/browsing on sign-in.

import { useEffect, useState } from 'react'
import { supabase } from '../db/supabase'
import { getMyProfile, OjtProfile } from '../db/ojt'
import { ScanShell } from './ScanShell'

export function ScanApp() {
  const [profile, setProfile] = useState<OjtProfile | null>(null)

  async function loadProfile() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      setProfile(null)
      return
    }
    try {
      setProfile(await getMyProfile(session.user.id))
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    void loadProfile()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setProfile(null)
      if (event === 'SIGNED_IN') void loadProfile()
    })
    return () => subscription.unsubscribe()
  }, [])

  return <ScanShell profile={profile} onAuthChanged={loadProfile} />
}
