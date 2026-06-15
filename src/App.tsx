import { Link, Outlet, useLocation } from 'react-router-dom'

export function App() {
  const { pathname } = useLocation()
  const showHeader = pathname !== '/session'
  const isLanding = pathname === '/'
  return (
    <div className="min-h-full flex flex-col">
      {showHeader && (
        <header className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            {isLanding ? 'CommandIQ Toolkit' : 'CommandIQ Resolve'}
          </Link>
          {!isLanding && (
            <Link
              to="/history"
              className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-800"
            >
              History
            </Link>
          )}
        </header>
      )}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  )
}
