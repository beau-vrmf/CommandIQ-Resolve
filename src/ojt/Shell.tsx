import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  OjtProfile,
  signOut,
  getPendingReviewCount,
  getReturnedCount,
} from '../db/ojt'
import { ProcedureList } from './trainee/ProcedureList'
import { ReviewQueue } from './supervisor/ReviewQueue'
import { ProcedureManager } from './admin/ProcedureManager'

interface Props {
  profile: OjtProfile
  onSignedOut: () => void
}

type Tab = 'procedures' | 'reviews' | 'manage'

export function OjtShell({ profile, onSignedOut }: Props) {
  const isSupervisorOrAdmin = profile.role === 'supervisor' || profile.role === 'admin'
  const isAdmin = profile.role === 'admin'
  const isTrainee = profile.role === 'trainee'
  const [activeTab, setActiveTab] = useState<Tab>('procedures')
  const [pendingCount, setPendingCount] = useState(0)
  const [returnedCount, setReturnedCount] = useState(0)

  useEffect(() => {
    async function loadBadges() {
      try {
        if (isSupervisorOrAdmin) {
          const count = await getPendingReviewCount(profile.id, profile.role)
          setPendingCount(count)
        }
        if (isTrainee || isSupervisorOrAdmin) {
          // Trainees see their returned count; supervisors/admins don't need this badge
          if (isTrainee) {
            const count = await getReturnedCount(profile.id)
            setReturnedCount(count)
          }
        }
      } catch {
        // badges are non-critical; ignore errors
      }
    }
    void loadBadges()
  }, [profile.id, profile.role, isSupervisorOrAdmin, isTrainee])

  async function handleSignOut() {
    await signOut()
    onSignedOut()
  }

  const tabs: { id: Tab; label: string; show: boolean; badge?: number }[] = [
    {
      id: 'procedures',
      label: 'Procedures',
      show: true,
      badge: isTrainee && returnedCount > 0 ? returnedCount : undefined,
    },
    {
      id: 'reviews',
      label: 'Reviews',
      show: isSupervisorOrAdmin,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    { id: 'manage', label: 'Manage', show: isAdmin },
  ]

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Top bar */}
      <header className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold tracking-tight">CommandIQ Assess</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {profile.rank ? `${profile.rank} ` : ''}
            {profile.display_name}
            <span className="ml-2 text-slate-500">#{profile.man_number}</span>
            <span className="ml-2 capitalize text-slate-600">· {profile.role}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
          >
            ← Home
          </Link>
          <button
            onClick={handleSignOut}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="bg-slate-900 border-b border-slate-800 px-4 flex gap-1 flex-shrink-0">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-violet-500 text-violet-400'
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

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'procedures' && <ProcedureList profile={profile} />}
        {activeTab === 'reviews' && isSupervisorOrAdmin && (
          <ReviewQueue profile={profile} />
        )}
        {activeTab === 'manage' && isAdmin && <ProcedureManager />}
      </div>
    </div>
  )
}
