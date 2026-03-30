import { useState, useEffect } from 'react'
import { HashRouter as BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Pipeline from './pages/Pipeline'
import AdPerformance from './pages/AdPerformance'
import CreativeLibrary from './pages/CreativeLibrary'
import Tracking from './pages/Tracking'
import Settings from './pages/Settings'
import Login, { isAuthenticated } from './pages/Login'
import './index.css'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return isMobile
}

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated())
  const isMobile = useIsMobile()

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />
  }

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#111827' }}>
        <Sidebar onSignOut={() => { localStorage.removeItem('nucleus_auth'); setAuthed(false) }} isMobile={isMobile} />
        <main style={{
          marginLeft: isMobile ? 0 : 224,
          flex: 1,
          minHeight: '100vh',
          overflowY: 'auto',
          padding: isMobile ? '64px 16px 16px' : 32,
          background: '#111827',
        }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/ads" element={<AdPerformance />} />
            <Route path="/creatives" element={<CreativeLibrary />} />
            <Route path="/tracking" element={<Tracking />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
