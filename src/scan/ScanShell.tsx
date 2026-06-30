// Role-gated tabbed shell for CommandIQ Scan (mirrors ojt/Shell). Scan & Browse
// are public; Manage (admin) and Validate (supervisor/admin acting as SME)
// require sign-in. Selecting a privileged tab while signed out shows the gate.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { OjtProfile, signOut } from '../db/ojt'
import { getPendingValidationCount } from './db/scan'
import { AircraftSelect } from './scan/AircraftSelect'
import { BrowseList } from './scan/BrowseList'
import { ComponentManager } from './admin/ComponentManager'
import { ValidationQueue } from './validate/ValidationQueue'
import { ScanSignIn } from './ScanSignIn'

type Tab = 'scan' | 'browse' | 'manage' | 'validate'

interface Props {
  profile: OjtProfile | null
  onAuthChanged: () => void
}

export function ScanShell({ profile, onAuthChanged }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('scan')
  const [pendingCount, setPendingCount] = useState(0)

  const isAdmin = profile?.role === 'admin'
  const canValidate = profile?.role === 'admin' || profile?.role === 'supervisor'

  useEffect(() => {
    if (!canValidate) return
    getPendingValidationCount()
      .then(setPendingCount)
      .catch(() => {})
  }, [canValidate, activeTab])

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'scan', label: 'Scan' },
    { id: 'browse', label: 'Browse' },
    { id: 'manage', label: 'Manage' },
    { id: 'validate', label: 'Validate', badge: pendingCount || undefined },
  ]

  const privileged = activeTab === 'manage' || activeTab === 'validate'
  const needsAuth = privileged && !profile
  // Signed in but lacking the role for the selected tab.
  const forbidden =
    (activeTab === 'manage' && profile && !isAdmin) ||
    (activeTab === 'validate' && profile && !canValidate)

  async function handleSignOut() {
    await signOut()
    onAuthChanged()
    setActiveTab('scan')
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold tracking-tight">CommandIQ Scan</h1>
          {profile && (
            <p className="text-xs text-slate-400 mt-0.5">
              {profile.display_name}
              <span className="ml-2 capitalize text-slate-600">· {profile.role}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-800"
          >
            ← Home
          </Link>
          {profile && (
            <button
              onClick={handleSignOut}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-800"
            >
              Sign Out
            </button>
          )}
        </div>
      </header>

      <nav className="bg-slate-900 border-b border-slate-800 px-4 flex gap-1 flex-shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`relative py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold rounded-full bg-red-600 text-white">
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto">
        {activeTab === 'scan' && <AircraftSelect />}
        {activeTab === 'browse' && <BrowseList />}

        {needsAuth && (
          <ScanSignIn onSignedIn={onAuthChanged} onCancel={() => setActiveTab('scan')} />
        )}
        {forbidden && (
          <p className="text-slate-400 text-sm text-center py-16 px-6">
            Your account doesn't have access to this section.
          </p>
        )}

        {activeTab === 'manage' && isAdmin && <ComponentManager />}
        {activeTab === 'validate' && canValidate && <ValidationQueue />}
      </div>
    </div>
  )
}
