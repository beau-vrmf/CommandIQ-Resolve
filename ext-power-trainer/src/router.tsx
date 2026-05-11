import { createBrowserRouter, Navigate } from 'react-router-dom'
import { App } from './App'
import { FaultCodeList } from './pages/FaultCodeList'
import { Session } from './pages/Session'
import { Outcome } from './pages/Outcome'
import { History } from './pages/History'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <FaultCodeList /> },
      { path: 'session', element: <Session /> },
      { path: 'outcome', element: <Outcome /> },
      { path: 'history', element: <History /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
