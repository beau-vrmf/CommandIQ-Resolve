import { createBrowserRouter, Navigate } from 'react-router-dom'
import { App } from './App'
import { Landing } from './pages/Landing'
import { FaultCodeList } from './pages/FaultCodeList'
import { Session } from './pages/Session'
import { Outcome } from './pages/Outcome'
import { History } from './pages/History'
import { OjtApp } from './ojt/OjtApp'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'resolve', element: <FaultCodeList /> },
      { path: 'session', element: <Session /> },
      { path: 'outcome', element: <Outcome /> },
      { path: 'history', element: <History /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  // OJT Upgrade Training — standalone, no shared shell
  { path: '/ojt', element: <OjtApp /> },
  { path: '/ojt/*', element: <OjtApp /> },
])
